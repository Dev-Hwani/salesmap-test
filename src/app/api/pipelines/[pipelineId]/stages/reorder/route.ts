import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { hasPermission } from "@/lib/policy";
import { z } from "zod";

const reorderSchema = z.object({
  orderedIds: z.array(z.number().int()).min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);
  if (!hasPermission(user, "manage")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const { pipelineId: pipelineIdParam } = await params;
  const pipelineId = parseId(pipelineIdParam);
  if (!pipelineId) return jsonError("파이프라인 정보가 올바르지 않습니다.");

  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}) },
    select: { id: true },
  });
  if (!pipeline) return jsonError("파이프라인 정보를 찾을 수 없습니다.", 404);

  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("정렬 요청이 올바르지 않습니다.");
  }

  const { orderedIds } = parsed.data;
  const stageCount = await prisma.stage.count({ where: { pipelineId } });
  if (orderedIds.length !== stageCount) {
    return jsonError("스테이지 정렬 정보가 올바르지 않습니다.");
  }

  const stages = await prisma.stage.findMany({
    where: { pipelineId },
    select: { id: true },
  });
  const stageIds = new Set(stages.map((stage) => stage.id));
  if (orderedIds.some((id) => !stageIds.has(id))) {
    return jsonError("스테이지 정렬 정보가 올바르지 않습니다.");
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.stage.update({
        where: { id },
        data: { position: index },
      })
    )
  );

  return jsonOk({ ok: true });
}
