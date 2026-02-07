import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { hasPermission } from "@/lib/policy";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const teamSchema = z.object({
  name: z.string().min(1),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);
  if (!hasPermission(user, "manage")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const teams = await prisma.team.findMany({
    where: user.workspaceId ? { workspaceId: user.workspaceId } : undefined,
    orderBy: { createdAt: "asc" },
  });

  return jsonOk({ teams });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);
  if (!hasPermission(user, "manage")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = teamSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("팀 이름을 입력해주세요.");
  }

  if (!user.workspaceId) {
    return jsonError("워크스페이스 정보가 올바르지 않습니다.");
  }

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      workspaceId: user.workspaceId,
    },
  });

  await logAudit({
    actorId: user.id,
    entityType: "TEAM",
    entityId: team.id,
    action: "CREATE",
    after: { name: team.name },
  });

  return jsonOk({ team }, 201);
}
