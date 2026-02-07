import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { z } from "zod";

const updateSchema = z.object({
  label: z.string().min(1),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ optionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const { optionId: optionIdParam } = await params;
  const optionId = parseId(optionIdParam);
  if (!optionId) return jsonError("옵션 정보가 올바르지 않습니다.");

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("옵션 정보를 확인해주세요.");
  }

  const option = await prisma.customFieldOption.findUnique({
    where: { id: optionId },
    select: { id: true, fieldId: true, deletedAt: true },
  });
  if (!option || option.deletedAt) {
    return jsonError("옵션을 찾을 수 없습니다.", 404);
  }

  const siblings = await prisma.customFieldOption.findMany({
    where: { fieldId: option.fieldId, deletedAt: null, NOT: { id: optionId } },
    select: { label: true },
  });
  const normalized = parsed.data.label.trim().toLowerCase();
  if (siblings.some((item) => item.label.trim().toLowerCase() === normalized)) {
    return jsonError("이미 존재하는 옵션입니다.");
  }

  const updated = await prisma.customFieldOption.update({
    where: { id: optionId },
    data: { label: parsed.data.label.trim() },
  });

  return jsonOk({ option: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ optionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const { optionId: optionIdParam } = await params;
  const optionId = parseId(optionIdParam);
  if (!optionId) return jsonError("옵션 정보가 올바르지 않습니다.");

  const option = await prisma.customFieldOption.findUnique({
    where: { id: optionId },
    select: { id: true, fieldId: true, deletedAt: true },
  });
  if (!option || option.deletedAt) {
    return jsonError("옵션을 찾을 수 없습니다.", 404);
  }

  await prisma.customFieldOption.update({
    where: { id: optionId },
    data: { deletedAt: new Date() },
  });

  const remaining = await prisma.customFieldOption.findMany({
    where: { fieldId: option.fieldId, deletedAt: null },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  await prisma.$transaction(
    remaining.map((item, index) =>
      prisma.customFieldOption.update({
        where: { id: item.id },
        data: { position: index },
      })
    )
  );

  return jsonOk({ ok: true });
}
