import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { hasPermission } from "@/lib/policy";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);
  if (!hasPermission(user, "manage")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const { teamId: teamIdParam } = await params;
  const teamId = parseId(teamIdParam);
  if (!teamId) return jsonError("팀 정보가 올바르지 않습니다.");

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("팀 이름을 입력해주세요.");
  }

  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}),
    },
  });
  if (!team) return jsonError("팀을 찾을 수 없습니다.", 404);

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: { name: parsed.data.name },
  });

  await logAudit({
    actorId: user.id,
    entityType: "TEAM",
    entityId: updated.id,
    action: "UPDATE",
    before: { name: team.name },
    after: { name: updated.name },
  });

  return jsonOk({ team: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);
  if (!hasPermission(user, "manage")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const { teamId: teamIdParam } = await params;
  const teamId = parseId(teamIdParam);
  if (!teamId) return jsonError("팀 정보가 올바르지 않습니다.");

  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}),
    },
  });
  if (!team) return jsonError("팀을 찾을 수 없습니다.", 404);

  const memberCount = await prisma.user.count({ where: { teamId } });
  if (memberCount > 0) {
    return jsonError("팀에 소속된 사용자가 있어 삭제할 수 없습니다.");
  }

  await prisma.team.delete({ where: { id: teamId } });

  await logAudit({
    actorId: user.id,
    entityType: "TEAM",
    entityId: teamId,
    action: "DELETE",
    before: { name: team.name },
  });

  return jsonOk({ ok: true });
}
