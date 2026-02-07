import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { hasPermission } from "@/lib/policy";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  teamId: z.number().int().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);
  if (!hasPermission(user, "manage")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const { userId: userIdParam } = await params;
  const targetId = parseId(userIdParam);
  if (!targetId) return jsonError("사용자 정보가 올바르지 않습니다.");

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("요청 정보가 올바르지 않습니다.");
  }

  const target = await prisma.user.findFirst({
    where: {
      id: targetId,
      ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}),
    },
    select: { id: true, teamId: true },
  });
  if (!target) return jsonError("사용자를 찾을 수 없습니다.", 404);

  if (parsed.data.teamId) {
    const team = await prisma.team.findFirst({
      where: {
        id: parsed.data.teamId,
        ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}),
      },
      select: { id: true },
    });
    if (!team) return jsonError("팀 정보가 올바르지 않습니다.");
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { teamId: parsed.data.teamId },
    select: { id: true, name: true, email: true, role: true, managerId: true, teamId: true },
  });

  await logAudit({
    actorId: user.id,
    entityType: "USER",
    entityId: updated.id,
    action: "UPDATE",
    before: { teamId: target.teamId ?? null },
    after: { teamId: updated.teamId ?? null },
  });

  return jsonOk({ user: updated });
}
