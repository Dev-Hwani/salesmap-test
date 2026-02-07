import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { parseObjectType } from "@/lib/objectTypes";
import { getVisibleOwnerIds, hasPermission } from "@/lib/policy";
import { saveUploadedFile } from "@/lib/fileStorage";
import { logAudit } from "@/lib/audit";

async function getFileRecord(objectType: string, fileId: number) {
  if (objectType === "DEAL") {
    return prisma.dealFieldFile.findUnique({
      where: { id: fileId },
      include: { deal: { select: { ownerId: true } } },
    });
  }
  if (objectType === "LEAD") {
    return prisma.leadFieldFile.findUnique({
      where: { id: fileId },
      include: { lead: { select: { ownerId: true } } },
    });
  }
  if (objectType === "CONTACT") {
    return prisma.contactFieldFile.findUnique({
      where: { id: fileId },
      include: { contact: { select: { ownerId: true } } },
    });
  }
  return prisma.companyFieldFile.findUnique({
    where: { id: fileId },
    include: { company: { select: { ownerId: true } } },
  });
}

function getOwnerId(objectType: string, record: any) {
  if (!record) return null;
  if (objectType === "DEAL") return record.deal?.ownerId ?? null;
  if (objectType === "LEAD") return record.lead?.ownerId ?? null;
  if (objectType === "CONTACT") return record.contact?.ownerId ?? null;
  return record.company?.ownerId ?? null;
}

function getFileModel(objectType: string) {
  if (objectType === "DEAL") return prisma.dealFieldFile;
  if (objectType === "LEAD") return prisma.leadFieldFile;
  if (objectType === "CONTACT") return prisma.contactFieldFile;
  return prisma.companyFieldFile;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ objectType: string; fileId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);
  if (!hasPermission(user, "write")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const { objectType: objectTypeParam, fileId: fileIdParam } = await params;
  const objectType = parseObjectType(objectTypeParam);
  if (!objectType) return jsonError("요청 정보가 올바르지 않습니다.");

  const fileId = parseId(fileIdParam);
  if (!fileId) return jsonError("파일 정보가 올바르지 않습니다.");

  const record = await getFileRecord(objectType, fileId);
  if (!record) return jsonError("파일을 찾을 수 없습니다.", 404);

  const field = await prisma.customField.findFirst({
    where: {
      id: record.fieldId,
      objectType,
      deletedAt: null,
      ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}),
    },
    select: { masked: true },
  });
  if (field?.masked) {
    return jsonError("마스킹된 필드는 교체할 수 없습니다.", 403);
  }

  const ownerId = getOwnerId(objectType, record);
  const visibleOwnerIds = await getVisibleOwnerIds(user);
  if (ownerId && visibleOwnerIds && !visibleOwnerIds.includes(ownerId)) {
    return jsonError("해당 파일에 접근할 수 없습니다.", 403);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("업로드 파일이 없습니다.");
  }

  const stored = await saveUploadedFile(file, objectType, record.fieldId);
  const model = getFileModel(objectType);

  const latest = await model.findFirst({
    where: { groupKey: record.groupKey },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 1) + 1;

  await model.updateMany({
    where: { groupKey: record.groupKey, isCurrent: true },
    data: { isCurrent: false, replacedAt: new Date() },
  });

  const created = await model.create({
    data: {
      ...(objectType === "DEAL" ? { dealId: record.dealId } : {}),
      ...(objectType === "LEAD" ? { leadId: record.leadId } : {}),
      ...(objectType === "CONTACT" ? { contactId: record.contactId } : {}),
      ...(objectType === "COMPANY" ? { companyId: record.companyId } : {}),
      fieldId: record.fieldId,
      originalName: stored.originalName,
      storagePath: stored.storagePath,
      mimeType: stored.mimeType,
      size: stored.size,
      groupKey: record.groupKey,
      version: nextVersion,
      isCurrent: true,
      replacedAt: null,
    },
  });

  await logAudit({
    actorId: user.id,
    entityType: "FILE",
    entityId: created.id,
    action: "FILE_REPLACE",
    meta: { objectType, fieldId: created.fieldId, version: created.version },
  });

  return jsonOk({ file: created });
}
