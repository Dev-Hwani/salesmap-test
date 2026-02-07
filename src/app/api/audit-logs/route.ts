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

  const logs = await prisma.auditLog.findMany({
    where: user.workspaceId ? { actor: { workspaceId: user.workspaceId } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      actor: { select: { id: true, name: true, role: true } },
    },
  });

  return jsonOk({ logs });
}
