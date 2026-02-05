import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { setAuthCookie, signToken } from "@/lib/auth";
import { validateManagerForRole } from "@/lib/policy";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(4),
  role: z.enum(["A", "B", "C"]).optional(),
  managerId: z.number().int().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("잘못된 요청입니다.");
  }

  const { name, email, password } = parsed.data;
  let { role, managerId } = parsed.data;

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    role = "A";
    managerId = null;
  } else if (!role) {
    return jsonError("역할을 선택해주세요.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return jsonError("이미 사용 중인 이메일입니다.");
  }

  const isManagerValid = await validateManagerForRole(role, managerId ?? null);
  if (!isManagerValid) {
    return jsonError("매니저 선택이 올바르지 않습니다.");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      managerId: managerId ?? null,
    },
    select: { id: true, name: true, email: true, role: true, managerId: true },
  });

  const token = signToken(user.id);
  const response = jsonOk({ user }, 201);
  setAuthCookie(response, token);
  return response;
}
