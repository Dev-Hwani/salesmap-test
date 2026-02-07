import { prisma } from "@/lib/db";
import { AuditAction, AuditEntityType } from "@prisma/client";

type AuditPayload = {
  actorId: number;
  entityType: AuditEntityType;
  entityId?: number | null;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
};

export async function logAudit({
  actorId,
  entityType,
  entityId,
  action,
  before,
  after,
  meta,
}: AuditPayload) {
  await prisma.auditLog.create({
    data: {
      actorId,
      entityType,
      entityId: entityId ?? null,
      action,
      before: before ?? undefined,
      after: after ?? undefined,
      meta: meta ?? undefined,
    },
  });
}
