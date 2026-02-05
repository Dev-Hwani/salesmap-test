import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("인증이 필요합니다.", 401);
  }

  return jsonOk({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      managerId: user.managerId,
    },
  });
}
