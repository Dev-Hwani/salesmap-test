import { prisma } from "@/lib/db";
import { jsonOk } from "@/lib/http";
import { getManagersForRole } from "@/lib/policy";

export async function GET() {
  const userCount = await prisma.user.count();
  const managersForB = await getManagersForRole("B");
  const managersForC = await getManagersForRole("C");

  return jsonOk({
    hasUsers: userCount > 0,
    managersForB,
    managersForC,
  });
}
