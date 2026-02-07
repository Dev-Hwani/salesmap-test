import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { getVisibleOwnerIds, hasPermission } from "@/lib/policy";
import { z } from "zod";

const convertSchema = z.object({
  pipelineId: z.number().int(),
  stageId: z.number().int(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);
  if (!hasPermission(user, "write")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const { leadId: leadIdParam } = await params;
  const leadId = parseId(leadIdParam);
  if (!leadId) return jsonError("리드 정보가 올바르지 않습니다.");

  const body = await request.json().catch(() => null);
  const parsed = convertSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("전환 요청이 올바르지 않습니다.");
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      companyId: true,
      deletedAt: true,
    },
  });
  if (!lead || lead.deletedAt) {
    return jsonError("리드를 찾을 수 없습니다.", 404);
  }

  const visibleOwnerIds = await getVisibleOwnerIds(user);
  if (visibleOwnerIds && !visibleOwnerIds.includes(lead.ownerId)) {
    return jsonError("해당 리드에 접근할 수 없습니다.", 403);
  }

  const existingDeal = await prisma.deal.findFirst({
    where: { sourceLeadId: leadId, deletedAt: null },
    select: { id: true },
  });
  if (existingDeal) {
    return jsonError("이미 전환된 리드입니다.");
  }

  const { pipelineId, stageId } = parsed.data;
  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}) },
    select: { id: true },
  });
  if (!pipeline) {
    return jsonError("파이프라인 정보가 올바르지 않습니다.");
  }

  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    select: { pipelineId: true },
  });
  if (!stage || stage.pipelineId !== pipelineId) {
    return jsonError("스테이지 정보가 올바르지 않습니다.");
  }

  const [deal] = await prisma.$transaction([
    prisma.deal.create({
      data: {
        name: lead.name,
        pipelineId,
        stageId,
        ownerId: lead.ownerId,
        companyId: lead.companyId,
        sourceLeadId: lead.id,
      },
      include: {
        owner: { select: { id: true, name: true, role: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
        sourceLead: { select: { id: true, name: true } },
      },
    }),
    prisma.lead.update({
      where: { id: lead.id },
      data: { status: "QUALIFIED" },
    }),
  ]);

  return jsonOk({ deal });
}
