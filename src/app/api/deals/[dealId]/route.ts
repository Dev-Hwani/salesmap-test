import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { canAssignOwner, getVisibleOwnerIds } from "@/lib/policy";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  stageId: z.number().int().optional(),
  ownerId: z.number().int().optional(),
  expectedRevenue: z.number().int().nullable().optional(),
  closeDate: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const { dealId: dealIdParam } = await params;
  const dealId = parseId(dealIdParam);
  if (!dealId) return jsonError("딜 정보가 올바르지 않습니다.");

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("수정 요청이 올바르지 않습니다.");
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, pipelineId: true, ownerId: true },
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
      fieldValues: {
        select: {
          fieldId: true,
          valueText: true,
          valueNumber: true,
          valueDate: true,
        },
      },
    },
  });

  return jsonOk({ deal: updated });
}
