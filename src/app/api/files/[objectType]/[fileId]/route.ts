import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { parseObjectType } from "@/lib/objectTypes";
import { getVisibleOwnerIds, hasPermission } from "@/lib/policy";
import { deleteStoredFile } from "@/lib/fileStorage";
import { logAudit } from "@/lib/audit";
import { promises as fs } from "fs";
import path from "path";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ objectType: string; fileId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

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
    return jsonError("마스킹된 필드는 접근할 수 없습니다.", 403);
  }

  const ownerId = getOwnerId(objectType, record);
  const visibleOwnerIds = await getVisibleOwnerIds(user);
  if (ownerId && visibleOwnerIds && !visibleOwnerIds.includes(ownerId)) {
    return jsonError("해당 파일에 접근할 수 없습니다.", 403);
  }

  const absolutePath = path.join(process.cwd(), record.storagePath);
  const data = await fs.readFile(absolutePath);
  const filename = encodeURIComponent(record.originalName);
  const inline = request.nextUrl.searchParams.get("inline") === "1";

  return new Response(data, {
    headers: {
      "Content-Type": record.mimeType || "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ objectType: string; fileId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);
  if (!hasPermission(user, "delete")) {
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
    return jsonError("마스킹된 필드는 접근할 수 없습니다.", 403);
  }

  const ownerId = getOwnerId(objectType, record);
  const visibleOwnerIds = await getVisibleOwnerIds(user);
  if (ownerId && visibleOwnerIds && !visibleOwnerIds.includes(ownerId)) {
    return jsonError("해당 파일에 접근할 수 없습니다.", 403);
  }

  if (objectType === "DEAL") {
    await prisma.dealFieldFile.delete({ where: { id: fileId } });
  } else if (objectType === "LEAD") {
    await prisma.leadFieldFile.delete({ where: { id: fileId } });
  } else if (objectType === "CONTACT") {
    await prisma.contactFieldFile.delete({ where: { id: fileId } });
  } else {
    await prisma.companyFieldFile.delete({ where: { id: fileId } });
  }

  await deleteStoredFile(record.storagePath);

  await logAudit({
    actorId: user.id,
    entityType: "FILE",
    entityId: fileId,
    action: "FILE_DELETE",
    meta: { objectType, fieldId: record.fieldId },
  });

  return new Response(null, { status: 204 });
}
