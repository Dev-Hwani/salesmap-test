import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { z } from "zod";

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  type: z.enum(["text", "number", "date", "datetime"]).optional(),
  required: z.boolean().optional(),
  masked: z.boolean().optional(),
  visibleInCreate: z.boolean().optional(),
  visibleInPipeline: z.boolean().optional(),
  position: z.number().int().optional(),
});

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
    select: { id: true, objectType: true, deletedAt: true },
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
    let valueCount = 0;
    if (targetField.objectType === "DEAL") {
      valueCount = await prisma.dealFieldValue.count({ where: { fieldId } });
    } else if (targetField.objectType === "LEAD") {
      valueCount = await prisma.leadFieldValue.count({ where: { fieldId } });
    } else if (targetField.objectType === "CONTACT") {
      valueCount = await prisma.contactFieldValue.count({ where: { fieldId } });
    } else if (targetField.objectType === "COMPANY") {
      valueCount = await prisma.companyFieldValue.count({ where: { fieldId } });
    }
    if (valueCount > 0) {
      return jsonError("값이 있는 필드는 타입을 변경할 수 없습니다.");
    }
  }

  const field = await prisma.customField.update({
    where: { id: fieldId },
    data: parsed.data,
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
