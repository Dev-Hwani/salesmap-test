import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseDurationToSeconds } from "@/lib/time";

const COOKIE_NAME = "auth_token";
const FALLBACK_EXPIRES_IN = "7d";
const FALLBACK_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type JwtPayload = {
  userId: number;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function signToken(userId: number) {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || FALLBACK_EXPIRES_IN;
  return jwt.sign({ userId }, secret, { expiresIn });
}

export function verifyToken(token: string) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret) as JwtPayload;
}

export async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

export async function getCurrentUser() {
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const payload = verifyToken(token);
    return prisma.user.findUnique({ where: { id: payload.userId } });
  } catch {
    return null;
  }
}

export function setAuthCookie(response: NextResponse, token: string) {
  const maxAge = parseDurationToSeconds(
    process.env.JWT_EXPIRES_IN || FALLBACK_EXPIRES_IN,
    FALLBACK_MAX_AGE_SECONDS
  );
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
