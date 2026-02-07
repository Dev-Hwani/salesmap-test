import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getAssignableUsers } from "@/lib/policy";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("인증이 필요합니다.", 401);
  }

  const users = await getAssignableUsers(user);
  return jsonOk({ users });
}
