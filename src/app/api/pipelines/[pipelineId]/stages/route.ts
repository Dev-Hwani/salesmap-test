import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { hasPermission } from "@/lib/policy";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const stageSchema = z.object({
  name: z.string().min(1),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  stagnationDays: z.number().int().min(0).nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const { pipelineId: pipelineIdParam } = await params;
  const pipelineId = parseId(pipelineIdParam);
  if (!pipelineId) return jsonError("파이프라인 정보가 올바르지 않습니다.");

  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}) },
    select: { id: true },
  });
  if (!pipeline) return jsonError("파이프라인 정보를 찾을 수 없습니다.", 404);

  const stages = await prisma.stage.findMany({
    where: { pipelineId },
    orderBy: { position: "asc" },
  });

  const counts = await prisma.deal.groupBy({
    by: ["stageId"],
    where: { pipelineId, deletedAt: null },
    _count: { _all: true },
  });
  const countMap = new Map<number, number>();
  counts.forEach((row) => countMap.set(row.stageId, row._count._all));

  return jsonOk({
    stages: stages.map((stage) => ({
      id: stage.id,
      pipelineId: stage.pipelineId,
      name: stage.name,
      probability: stage.probability,
      description: stage.description,
      stagnationDays: stage.stagnationDays,
      position: stage.position,
      dealCount: countMap.get(stage.id) ?? 0,
    })),
  });
}

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
  const parsed = stageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("스테이지 정보를 확인해주세요.");
  }

  const stageCount = await prisma.stage.count({ where: { pipelineId } });
  const requested = parsed.data.position;
  const position =
    requested === undefined
      ? stageCount
      : Math.min(Math.max(requested, 0), stageCount);

  const [, stage] = await prisma.$transaction([
    prisma.stage.updateMany({
      where: { pipelineId, position: { gte: position } },
      data: { position: { increment: 1 } },
    }),
    prisma.stage.create({
      data: {
        pipelineId,
        name: parsed.data.name,
        probability: parsed.data.probability ?? null,
        description: parsed.data.description ?? null,
        stagnationDays: parsed.data.stagnationDays ?? null,
        position,
      },
    }),
  ]);

  await logAudit({
    actorId: user.id,
    entityType: "STAGE",
    entityId: stage.id,
    action: "CREATE",
    after: { name: stage.name, pipelineId: stage.pipelineId, position: stage.position },
  });

  return jsonOk({ stage }, 201);
}
