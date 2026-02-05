import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { z } from "zod";

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  type: z.enum(["text", "number", "date"]).optional(),
  visibleInCreate: z.boolean().optional(),
  visibleInPipeline: z.boolean().optional(),
  position: z.number().int().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const { fieldId: fieldIdParam } = await params;
  const fieldId = parseId(fieldIdParam);
  if (!fieldId) return jsonError("필드 정보가 올바르지 않습니다.");

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("수정 요청이 올바르지 않습니다.");
  }

  if (parsed.data.type) {
    const valueCount = await prisma.dealFieldValue.count({
      where: { fieldId },
    });
    if (valueCount > 0) {
      return jsonError("값이 있는 필드는 타입을 변경할 수 없습니다.");
    }
  }

  const field = await prisma.customField.update({
    where: { id: fieldId },
    data: parsed.data,
  });

  return jsonOk({ field });
}
