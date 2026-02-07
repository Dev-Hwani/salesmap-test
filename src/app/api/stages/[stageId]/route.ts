import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  stagnationDays: z.number().int().min(0).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const { stageId: stageIdParam } = await params;
  const stageId = parseId(stageIdParam);
  if (!stageId) return jsonError("스테이지 정보가 올바르지 않습니다.");

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("수정 요청이 올바르지 않습니다.");
  }

  const stage = await prisma.stage.update({
    where: { id: stageId },
    data: parsed.data,
  });

  return jsonOk({ stage });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const { stageId: stageIdParam } = await params;
  const stageId = parseId(stageIdParam);
  if (!stageId) return jsonError("스테이지 정보가 올바르지 않습니다.");

  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    select: { id: true, pipelineId: true },
  });

  if (!stage) return jsonError("스테이지를 찾을 수 없습니다.", 404);

  const dealCount = await prisma.deal.count({ where: { stageId } });
  if (dealCount > 0) {
    return jsonError("딜이 존재하는 스테이지는 삭제할 수 없습니다.");
  }

  const stageCount = await prisma.stage.count({
    where: { pipelineId: stage.pipelineId },
  });
  if (stageCount <= 3) {
    return jsonError("스테이지는 최소 3개 이상 유지해야 합니다.");
  }

  await prisma.stage.delete({ where: { id: stageId } });

  const remaining = await prisma.stage.findMany({
    where: { pipelineId: stage.pipelineId },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  await prisma.$transaction(
    remaining.map((item, index) =>
      prisma.stage.update({
        where: { id: item.id },
        data: { position: index },
      })
    )
  );

  return jsonOk({ ok: true });
}
