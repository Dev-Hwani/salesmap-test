import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { z } from "zod";

const pipelineSchema = z.object({
  name: z.string().min(1),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("인증이 필요합니다.", 401);
  }

  const pipelines = await prisma.pipeline.findMany({
    orderBy: { position: "asc" },
    include: {
      stages: {
        orderBy: { position: "asc" },
        include: {
          _count: { select: { deals: true } },
        },
      },
      _count: { select: { deals: true, stages: true } },
    },
  });

  return jsonOk({
    pipelines: pipelines.map((pipeline) => ({
      id: pipeline.id,
      name: pipeline.name,
      position: pipeline.position,
      dealCount: pipeline._count.deals,
      stageCount: pipeline._count.stages,
      stages: pipeline.stages.map((stage) => ({
        id: stage.id,
        pipelineId: stage.pipelineId,
        name: stage.name,
        probability: stage.probability,
        description: stage.description,
        stagnationDays: stage.stagnationDays,
        position: stage.position,
        dealCount: stage._count.deals,
      })),
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("인증이 필요합니다.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = pipelineSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("파이프라인 이름을 입력해주세요.");
  }

  const { name } = parsed.data;
  const pipelineCount = await prisma.pipeline.count();

  const pipeline = await prisma.pipeline.create({
    data: {
      name,
      position: pipelineCount,
      stages: {
        create: [
          {
            name: "제안",
            probability: 30,
            description: "제안서를 전달하고 협의를 시작한 단계",
            stagnationDays: 14,
            position: 0,
          },
          {
            name: "수주",
            probability: 100,
            description: "계약이 확정된 단계",
            stagnationDays: 0,
            position: 1,
          },
          {
            name: "실패",
            probability: 0,
            description: "딜이 종료된 단계",
            stagnationDays: 0,
            position: 2,
          },
        ],
      },
    },
    include: {
      stages: { orderBy: { position: "asc" } },
    },
  });

  return jsonOk({
    pipeline: {
      id: pipeline.id,
      name: pipeline.name,
      position: pipeline.position,
      stages: pipeline.stages,
    },
  }, 201);
}
