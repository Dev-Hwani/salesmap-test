import { prisma } from "@/lib/db";
import { jsonOk } from "@/lib/http";
import { getManagersForRole } from "@/lib/policy";

export async function GET() {
  const userCount = await prisma.user.count();
  const workspace = await prisma.workspace.findFirst({
    select: { id: true },
  });
  const workspaceId = workspace?.id ?? null;
  const managersForB = await getManagersForRole("B", workspaceId);
  const managersForC = await getManagersForRole("C", workspaceId);

  return jsonOk({
    hasUsers: userCount > 0,
    managersForB,
    managersForC,
  });
}
