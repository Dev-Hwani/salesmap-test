import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { z } from "zod";

const fieldSchema = z.object({
  label: z.string().min(1),
  type: z.enum(["text", "number", "date"]),
  visibleInCreate: z.boolean().optional(),
  visibleInPipeline: z.boolean().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const fields = await prisma.customField.findMany({
    orderBy: { position: "asc" },
  });

  return jsonOk({ fields });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const body = await request.json().catch(() => null);
  const parsed = fieldSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("필드 정보를 확인해주세요.");
  }

  const fieldCount = await prisma.customField.count();
  const field = await prisma.customField.create({
    data: {
      label: parsed.data.label,
      type: parsed.data.type,
      visibleInCreate: parsed.data.visibleInCreate ?? true,
      visibleInPipeline: parsed.data.visibleInPipeline ?? false,
      position: fieldCount,
    },
  });

  return jsonOk({ field }, 201);
}
