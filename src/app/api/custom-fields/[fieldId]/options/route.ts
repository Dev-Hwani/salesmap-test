import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { z } from "zod";

const optionSchema = z.object({
  label: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const { fieldId: fieldIdParam } = await params;
  const fieldId = parseId(fieldIdParam);
  if (!fieldId) return jsonError("필드 정보가 올바르지 않습니다.");

  const body = await request.json().catch(() => null);
  const parsed = optionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("옵션 정보를 확인해주세요.");
  }

  const field = await prisma.customField.findUnique({
    where: { id: fieldId },
    select: { id: true, type: true, deletedAt: true },
  });
  if (!field || field.deletedAt) {
    return jsonError("필드를 찾을 수 없습니다.", 404);
  }
  if (field.type !== "single_select" && field.type !== "multi_select") {
    return jsonError("선택형 필드에서만 옵션을 추가할 수 있습니다.");
  }

  const existing = await prisma.customFieldOption.findMany({
    where: { fieldId, deletedAt: null },
    select: { label: true },
  });
  const normalized = parsed.data.label.trim().toLowerCase();
  if (existing.some((option) => option.label.trim().toLowerCase() === normalized)) {
    return jsonError("이미 존재하는 옵션입니다.");
  }

  const position = existing.length;
  const option = await prisma.customFieldOption.create({
    data: {
      fieldId,
      label: parsed.data.label.trim(),
      position,
    },
  });

  return jsonOk({ option }, 201);
}
