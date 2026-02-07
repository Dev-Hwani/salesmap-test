import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseObjectType } from "@/lib/objectTypes";
import { z } from "zod";

const fieldSchema = z.object({
  objectType: z.enum(["DEAL", "LEAD", "CONTACT", "COMPANY"]),
  label: z.string().min(1),
  type: z.enum(["text", "number", "date", "datetime"]),
  required: z.boolean().optional(),
  masked: z.boolean().optional(),
  visibleInCreate: z.boolean().optional(),
  visibleInPipeline: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const objectType =
    parseObjectType(request.nextUrl.searchParams.get("objectType")) ?? "DEAL";

  const fields = await prisma.customField.findMany({
    where: { objectType, deletedAt: null },
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

  const fieldCount = await prisma.customField.count({
    where: { objectType: parsed.data.objectType, deletedAt: null },
  });
  const field = await prisma.customField.create({
    data: {
      objectType: parsed.data.objectType,
      label: parsed.data.label,
      type: parsed.data.type,
      required: parsed.data.required ?? false,
      masked: parsed.data.masked ?? false,
      visibleInCreate: parsed.data.visibleInCreate ?? true,
      visibleInPipeline: parsed.data.visibleInPipeline ?? false,
      position: fieldCount,
    },
  });

  return jsonOk({ field }, 201);
}
