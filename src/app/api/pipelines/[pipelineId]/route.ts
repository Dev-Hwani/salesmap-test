import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { hasPermission } from "@/lib/policy";
import { logAudit } from "@/lib/audit";
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
  if (!hasPermission(user, "manage")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const { pipelineId } = await params;
  const id = parseId(pipelineId);
  if (!id) return jsonError("파이프라인 정보가 올바르지 않습니다.");

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("수정 요청이 올바르지 않습니다.");
  }

  const pipeline = await prisma.pipeline.findFirst({
    where: { id, ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}) },
  });
  if (!pipeline) {
    return jsonError("파이프라인을 찾을 수 없습니다.", 404);
  }

  const updated = await prisma.pipeline.update({
    where: { id },
    data: parsed.data,
  });

  await logAudit({
    actorId: user.id,
    entityType: "PIPELINE",
    entityId: updated.id,
    action: "UPDATE",
    before: { name: pipeline.name, position: pipeline.position },
    after: { name: updated.name, position: updated.position },
  });

  return jsonOk({ pipeline: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("인증이 필요합니다.", 401);
  }
  if (!hasPermission(user, "manage")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const { pipelineId } = await params;
  const id = parseId(pipelineId);
  if (!id) return jsonError("파이프라인 정보가 올바르지 않습니다.");

  const pipelineCount = await prisma.pipeline.count({
    where: user.workspaceId ? { workspaceId: user.workspaceId } : undefined,
  });
  if (pipelineCount <= 1) {
    return jsonError("파이프라인은 최소 1개 이상이어야 합니다.");
  }

  const pipeline = await prisma.pipeline.findFirst({
    where: { id, ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}) },
    select: { id: true },
  });
  if (!pipeline) {
    return jsonError("파이프라인을 찾을 수 없습니다.", 404);
  }

  const dealCount = await prisma.deal.count({ where: { pipelineId: id } });
  if (dealCount > 0) {
    return jsonError("딜이 존재하는 파이프라인은 삭제할 수 없습니다.");
  }

  await prisma.$transaction([
    prisma.stage.deleteMany({ where: { pipelineId: id } }),
    prisma.pipeline.delete({ where: { id } }),
  ]);

  await logAudit({
    actorId: user.id,
    entityType: "PIPELINE",
    entityId: id,
    action: "DELETE",
    before: { id },
  });

  const remaining = await prisma.pipeline.findMany({
    where: user.workspaceId ? { workspaceId: user.workspaceId } : undefined,
    orderBy: { position: "asc" },
    select: { id: true },
  });
  await prisma.$transaction(
    remaining.map((pipelineItem, index) =>
      prisma.pipeline.update({
        where: { id: pipelineItem.id },
        data: { position: index },
      })
    )
  );

  return jsonOk({ ok: true });
}
