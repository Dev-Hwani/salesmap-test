import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { extractFormulaFieldIds, validateFormulaSyntax } from "@/lib/calculation";
import { z } from "zod";

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  type: z
    .enum([
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
    ])
    .optional(),
  required: z.boolean().optional(),
  masked: z.boolean().optional(),
  visibleInCreate: z.boolean().optional(),
  visibleInPipeline: z.boolean().optional(),
  position: z.number().int().optional(),
  formula: z.string().optional(),
});

async function getFieldUsageCount(fieldId: number, objectType: string) {
  const valueCount = await (async () => {
    if (objectType === "DEAL") return prisma.dealFieldValue.count({ where: { fieldId } });
    if (objectType === "LEAD") return prisma.leadFieldValue.count({ where: { fieldId } });
    if (objectType === "CONTACT") return prisma.contactFieldValue.count({ where: { fieldId } });
    return prisma.companyFieldValue.count({ where: { fieldId } });
  })();

  const optionCount = await (async () => {
    if (objectType === "DEAL") return prisma.dealFieldOptionValue.count({ where: { fieldId } });
    if (objectType === "LEAD") return prisma.leadFieldOptionValue.count({ where: { fieldId } });
    if (objectType === "CONTACT") return prisma.contactFieldOptionValue.count({ where: { fieldId } });
    return prisma.companyFieldOptionValue.count({ where: { fieldId } });
  })();

  const userCount = await (async () => {
    if (objectType === "DEAL") return prisma.dealFieldUserValue.count({ where: { fieldId } });
    if (objectType === "LEAD") return prisma.leadFieldUserValue.count({ where: { fieldId } });
    if (objectType === "CONTACT") return prisma.contactFieldUserValue.count({ where: { fieldId } });
    return prisma.companyFieldUserValue.count({ where: { fieldId } });
  })();

  const fileCount = await (async () => {
    if (objectType === "DEAL") return prisma.dealFieldFile.count({ where: { fieldId } });
    if (objectType === "LEAD") return prisma.leadFieldFile.count({ where: { fieldId } });
    if (objectType === "CONTACT") return prisma.contactFieldFile.count({ where: { fieldId } });
    return prisma.companyFieldFile.count({ where: { fieldId } });
  })();

  return valueCount + optionCount + userCount + fileCount;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const { fieldId: fieldIdParam } = await params;
  const fieldId = parseId(fieldIdParam);
  if (!fieldId) return jsonError("필드 정보가 올바르지 않습니다.");

  const targetField = await prisma.customField.findUnique({
    where: { id: fieldId },
    select: { id: true, objectType: true, deletedAt: true, masked: true, type: true },
  });
  if (!targetField || targetField.deletedAt) {
    return jsonError("필드를 찾을 수 없습니다.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("수정 요청이 올바르지 않습니다.");
  }

  if (
    Object.prototype.hasOwnProperty.call(parsed.data, "masked") &&
    parsed.data.masked !== targetField.masked
  ) {
    return jsonError("데이터 마스킹 옵션은 수정할 수 없습니다.");
  }

  if (parsed.data.type) {
    const usageCount = await getFieldUsageCount(fieldId, targetField.objectType);
    if (usageCount > 0) {
      return jsonError("값이 있는 필드는 타입을 변경할 수 없습니다.");
    }
    if (parsed.data.type === "calculation" && !parsed.data.formula && !targetField.formula) {
      return jsonError("계산식을 입력해주세요.");
    }
  }

  if (parsed.data.formula !== undefined) {
    if (parsed.data.type && parsed.data.type !== "calculation") {
      return jsonError("계산식은 계산 필드에서만 사용할 수 있습니다.");
    }
    if (targetField.type !== "calculation" && parsed.data.type !== "calculation") {
      return jsonError("계산식은 계산 필드에서만 사용할 수 있습니다.");
    }

    const formula = parsed.data.formula?.trim() ?? "";
    const error = validateFormulaSyntax(formula);
    if (error) return jsonError(error);

    const referencedIds = extractFormulaFieldIds(formula);
    if (referencedIds.length > 0) {
      const refFields = await prisma.customField.findMany({
        where: { id: { in: referencedIds }, objectType: targetField.objectType, deletedAt: null },
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

  const field = await prisma.customField.update({
    where: { id: fieldId },
    data: parsed.data,
    include: {
      options: {
        where: { deletedAt: null },
        orderBy: { position: "asc" },
      },
    },
  });

  return jsonOk({ field });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const { fieldId: fieldIdParam } = await params;
  const fieldId = parseId(fieldIdParam);
  if (!fieldId) return jsonError("필드 정보가 올바르지 않습니다.");

  const field = await prisma.customField.findUnique({
    where: { id: fieldId },
    select: { id: true, objectType: true, deletedAt: true },
  });
  if (!field || field.deletedAt) {
    return jsonError("필드를 찾을 수 없습니다.", 404);
  }

  await prisma.customField.update({
    where: { id: fieldId },
    data: { deletedAt: new Date() },
  });

  const remaining = await prisma.customField.findMany({
    where: { objectType: field.objectType, deletedAt: null },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  await prisma.$transaction(
    remaining.map((item, index) =>
      prisma.customField.update({
        where: { id: item.id },
        data: { position: index },
      })
    )
  );

  return jsonOk({ ok: true });
}
