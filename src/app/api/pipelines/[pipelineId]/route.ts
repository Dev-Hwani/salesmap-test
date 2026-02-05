import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("인증이 필요합니다.", 401);
  }

  const { pipelineId } = await params;
  const id = parseId(pipelineId);
  if (!id) return jsonError("파이프라인 정보가 올바르지 않습니다.");

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("수정 요청이 올바르지 않습니다.");
  }

  const pipeline = await prisma.pipeline.update({
    where: { id },
    data: parsed.data,
  });

  return jsonOk({ pipeline });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("인증이 필요합니다.", 401);
  }

  const { pipelineId } = await params;
  const id = parseId(pipelineId);
  if (!id) return jsonError("파이프라인 정보가 올바르지 않습니다.");

  const pipelineCount = await prisma.pipeline.count();
  if (pipelineCount <= 1) {
    return jsonError("파이프라인은 최소 1개 이상 유지해야 합니다.");
  }

  const dealCount = await prisma.deal.count({ where: { pipelineId: id } });
  if (dealCount > 0) {
    return jsonError("딜이 존재하는 파이프라인은 삭제할 수 없습니다.");
  }

  await prisma.$transaction([
    prisma.stage.deleteMany({ where: { pipelineId: id } }),
    prisma.pipeline.delete({ where: { id } }),
  ]);

  const remaining = await prisma.pipeline.findMany({
    orderBy: { position: "asc" },
    select: { id: true },
  });
  await prisma.$transaction(
    remaining.map((pipeline, index) =>
      prisma.pipeline.update({
        where: { id: pipeline.id },
        data: { position: index },
      })
    )
  );

  return jsonOk({ ok: true });
}
