import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { setAuthCookie, signToken } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("잘못된 요청입니다.");
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return jsonError("이메일 또는 비밀번호가 올바르지 않습니다.", 401);
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return jsonError("이메일 또는 비밀번호가 올바르지 않습니다.", 401);
  }

  const token = signToken(user.id);
  const response = jsonOk({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
  setAuthCookie(response, token);
  return response;
}
