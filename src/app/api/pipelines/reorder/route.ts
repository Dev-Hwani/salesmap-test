import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { z } from "zod";

const reorderSchema = z.object({
  orderedIds: z.array(z.number().int()).min(1),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("인증이 필요합니다.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("정렬 요청이 올바르지 않습니다.");
  }

  const { orderedIds } = parsed.data;
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.pipeline.update({
        where: { id },
        data: { position: index },
      })
    )
  );

  return jsonOk({ ok: true });
}
