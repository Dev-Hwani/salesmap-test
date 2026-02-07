import { prisma } from "@/lib/db";
import type { ObjectType } from "@prisma/client";

export async function getMaskedFieldIds(
  objectType: ObjectType,
  workspaceId?: number | null
) {
  const fields = await prisma.customField.findMany({
    where: {
      objectType,
      deletedAt: null,
      masked: true,
      ...(workspaceId ? { workspaceId } : {}),
    },
    select: { id: true },
  });
  return new Set(fields.map((field) => field.id));
}

export function filterMasked<T extends { fieldId: number }>(
  values: T[] | undefined,
  maskedIds: Set<number>
) {
  if (!values || maskedIds.size === 0) return values ?? [];
  return values.filter((value) => !maskedIds.has(value.fieldId));
}
