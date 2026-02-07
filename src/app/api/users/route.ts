import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { hasPermission } from "@/lib/policy";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);
  if (!hasPermission(user, "manage")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const users = await prisma.user.findMany({
    where: user.workspaceId ? { workspaceId: user.workspaceId } : undefined,
    select: { id: true, name: true, email: true, role: true, managerId: true, teamId: true },
    orderBy: { id: "asc" },
  });

  return jsonOk({ users });
}
