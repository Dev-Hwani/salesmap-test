import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseObjectType } from "@/lib/objectTypes";
import { extractFormulaFieldIds, validateFormulaSyntax } from "@/lib/calculation";
import { hasPermission } from "@/lib/policy";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const fieldSchema = z.object({
  objectType: z.enum(["DEAL", "LEAD", "CONTACT", "COMPANY"]),
  label: z.string().min(1),
  type: z.enum([
    "text",
    "number",
    "date",
    "datetime",
    "single_select",
    "multi_select",
    "boolean",
    "user",
    "users",
    "file",
    "calculation",
  ]),
  required: z.boolean().optional(),
  masked: z.boolean().optional(),
  visibleInCreate: z.boolean().optional(),
  visibleInPipeline: z.boolean().optional(),
  formula: z.string().optional(),
  options: z.array(z.string().min(1)).optional(),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const objectType =
    parseObjectType(request.nextUrl.searchParams.get("objectType")) ?? "DEAL";

  const fields = await prisma.customField.findMany({
    where: {
      objectType,
      deletedAt: null,
      ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}),
    },
    orderBy: { position: "asc" },
    include: {
      options: {
        where: { deletedAt: null },
        orderBy: { position: "asc" },
      },
    },
  });

  return jsonOk({ fields });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);
  if (!hasPermission(user, "manage")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = fieldSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("필드 정보를 확인해주세요.");
  }

  const { type, label, objectType } = parsed.data;

  if (type === "calculation") {
    const formula = parsed.data.formula?.trim();
    const error = formula ? validateFormulaSyntax(formula) : "계산식을 입력해주세요.";
    if (error) return jsonError(error);

    const referencedIds = extractFormulaFieldIds(formula ?? "");
    if (referencedIds.length > 0) {
      const refFields = await prisma.customField.findMany({
        where: {
          id: { in: referencedIds },
          objectType,
          deletedAt: null,
          ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}),
        },
        select: { id: true, type: true },
      });
      const invalid = referencedIds.filter(
        (id) => !refFields.some((field) => field.id === id && field.type === "number")
      );
      if (invalid.length > 0) {
        return jsonError("계산식은 숫자 필드만 참조할 수 있습니다.");
      }
    }
  }

  if (type === "single_select" || type === "multi_select") {
    const options = parsed.data.options ?? [];
    if (options.length === 0) {
      return jsonError("선택형 필드는 옵션을 1개 이상 추가해야 합니다.");
    }
    const normalized = options.map((option) => option.trim().toLowerCase());
    const unique = new Set(normalized);
    if (unique.size !== options.length) {
      return jsonError("중복된 옵션 라벨이 있습니다.");
    }
  }

  const fieldCount = await prisma.customField.count({
    where: {
      objectType,
      deletedAt: null,
      ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}),
    },
  });
  const field = await prisma.customField.create({
    data: {
      objectType,
      label,
      type,
      formula: parsed.data.formula ?? null,
      required: parsed.data.required ?? false,
      masked: parsed.data.masked ?? false,
      visibleInCreate: parsed.data.visibleInCreate ?? true,
      visibleInPipeline: parsed.data.visibleInPipeline ?? false,
      position: fieldCount,
      workspaceId: user.workspaceId ?? null,
    },
    include: {
      options: {
        where: { deletedAt: null },
        orderBy: { position: "asc" },
      },
    },
  });

  await logAudit({
    actorId: user.id,
    entityType: "CUSTOM_FIELD",
    entityId: field.id,
    action: "CREATE",
    after: { label: field.label, objectType: field.objectType, type: field.type },
  });

  if ((type === "single_select" || type === "multi_select") && parsed.data.options) {
    await prisma.customFieldOption.createMany({
      data: parsed.data.options.map((option, index) => ({
        fieldId: field.id,
        label: option.trim(),
        position: index,
      })),
    });
  }

  return jsonOk({ field }, 201);
}
