import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { canAssignOwner, getVisibleOwnerIds, hasPermission } from "@/lib/policy";
import { logAudit } from "@/lib/audit";
import { filterMasked, getMaskedFieldIds } from "@/lib/masking";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  stageId: z.number().int().optional(),
  ownerId: z.number().int().optional(),
  companyId: z.number().int().nullable().optional(),
  contactId: z.number().int().nullable().optional(),
  expectedRevenue: z.number().nullable().optional(),
  closeDate: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);
  if (!hasPermission(user, "write")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const { dealId: dealIdParam } = await params;
  const dealId = parseId(dealIdParam);
  if (!dealId) return jsonError("딜 정보가 올바르지 않습니다.");

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("수정 요청이 올바르지 않습니다.");
  }

  const deal = await prisma.deal.findFirst({
    where: {
      id: dealId,
      deletedAt: null,
      ...(user.workspaceId ? { pipeline: { workspaceId: user.workspaceId } } : {}),
    },
    select: { id: true, pipelineId: true, ownerId: true, stageId: true, name: true },
  });
  if (!deal) return jsonError("딜을 찾을 수 없습니다.", 404);

  const visibleOwnerIds = await getVisibleOwnerIds(user);
  if (visibleOwnerIds && !visibleOwnerIds.includes(deal.ownerId)) {
    return jsonError("해당 딜에 접근할 수 없습니다.", 403);
  }

  if (parsed.data.stageId) {
    const stage = await prisma.stage.findUnique({
      where: { id: parsed.data.stageId },
      select: { pipelineId: true },
    });
    if (!stage || stage.pipelineId !== deal.pipelineId) {
      return jsonError("스테이지 정보가 올바르지 않습니다.");
    }
  }

  if (parsed.data.ownerId) {
    const ownerAllowed = await canAssignOwner(user, parsed.data.ownerId);
    if (!ownerAllowed) {
      return jsonError("해당 담당자에게 딜을 할당할 수 없습니다.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, "companyId")) {
    if (parsed.data.companyId) {
      const company = await prisma.company.findFirst({
        where: {
          id: parsed.data.companyId,
          deletedAt: null,
          ...(visibleOwnerIds ? { ownerId: { in: visibleOwnerIds } } : {}),
        },
        select: { id: true },
      });
      if (!company) {
        return jsonError("회사 정보가 올바르지 않습니다.");
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, "contactId")) {
    if (parsed.data.contactId) {
      const contact = await prisma.contact.findFirst({
        where: {
          id: parsed.data.contactId,
          deletedAt: null,
          ...(visibleOwnerIds ? { ownerId: { in: visibleOwnerIds } } : {}),
        },
        select: { id: true },
      });
      if (!contact) {
        return jsonError("고객 정보가 올바르지 않습니다.");
      }
    }
  }

  let closeDateValue: Date | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(parsed.data, "closeDate")) {
    if (parsed.data.closeDate === null || parsed.data.closeDate === "") {
      closeDateValue = null;
    } else if (parsed.data.closeDate) {
      const parsedDate = new Date(parsed.data.closeDate);
      if (Number.isNaN(parsedDate.getTime())) {
        return jsonError("마감일 값이 올바르지 않습니다.");
      }
      closeDateValue = parsedDate;
    }
  }

  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: {
      ...parsed.data,
      closeDate: closeDateValue,
    },
    include: {
      owner: { select: { id: true, name: true, role: true } },
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      sourceLead: { select: { id: true, name: true } },
      fieldValues: {
        select: {
          fieldId: true,
          valueText: true,
          valueNumber: true,
          valueDate: true,
          valueDateTime: true,
          valueBoolean: true,
          valueUserId: true,
          valueOptionId: true,
          valueUser: { select: { id: true, name: true, role: true } },
          valueOption: { select: { id: true, label: true } },
        },
      },
    },
  });

  if (deal.stageId !== updated.stageId) {
    await logAudit({
      actorId: user.id,
      entityType: "DEAL",
      entityId: updated.id,
      action: "STAGE_MOVE",
      meta: { fromStageId: deal.stageId, toStageId: updated.stageId },
    });
  } else {
    await logAudit({
      actorId: user.id,
      entityType: "DEAL",
      entityId: updated.id,
      action: "UPDATE",
      before: { name: deal.name, ownerId: deal.ownerId },
      after: { name: updated.name, ownerId: updated.ownerId },
    });
  }

  const maskedIds = await getMaskedFieldIds("DEAL", user.workspaceId);
  const sanitized = {
    ...updated,
    fieldValues: filterMasked(updated.fieldValues, maskedIds),
  };

  return jsonOk({ deal: sanitized });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);
  if (!hasPermission(user, "delete")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const { dealId: dealIdParam } = await params;
  const dealId = parseId(dealIdParam);
  if (!dealId) return jsonError("딜 정보가 올바르지 않습니다.");

  const deal = await prisma.deal.findFirst({
    where: {
      id: dealId,
      deletedAt: null,
      ...(user.workspaceId ? { pipeline: { workspaceId: user.workspaceId } } : {}),
    },
    select: { id: true, ownerId: true, name: true },
  });
  if (!deal) return jsonError("딜을 찾을 수 없습니다.", 404);

  const visibleOwnerIds = await getVisibleOwnerIds(user);
  if (visibleOwnerIds && !visibleOwnerIds.includes(deal.ownerId)) {
    return jsonError("해당 딜에 접근할 수 없습니다.", 403);
  }

  await prisma.deal.update({
    where: { id: dealId },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    actorId: user.id,
    entityType: "DEAL",
    entityId: dealId,
    action: "DELETE",
    before: { name: deal.name, ownerId: deal.ownerId },
  });

  return jsonOk({ ok: true });
}
