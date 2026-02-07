import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { ObjectType } from "@/types/domain";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "zip",
  "csv",
]);

export type StoredFileInfo = {
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
};

export function getAllowedExtensions() {
  return Array.from(ALLOWED_EXTENSIONS.values());
}

function getExtension(name: string) {
  const parts = name.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toLowerCase();
}

function safeFileName(name: string) {
  const base = path.basename(name);
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function validateFile(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: "파일 크기는 100MB 이하만 허용됩니다." } as const;
  }
  const ext = getExtension(file.name);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, error: "허용되지 않는 파일 확장자입니다." } as const;
  }
  return { ok: true, ext } as const;
}

export async function saveUploadedFile(
  file: File,
  objectType: ObjectType,
  fieldId: number
): Promise<StoredFileInfo> {
  const validation = validateFile(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const safeName = safeFileName(file.name);
  const ext = getExtension(safeName) || validation.ext;
  const fileName = `${Date.now()}-${randomUUID()}.${ext}`;
  const relativePath = path.posix.join(
    "uploads",
    objectType.toLowerCase(),
    String(fieldId),
    fileName
  );
  const absolutePath = path.join(process.cwd(), relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  return {
    originalName: safeName,
    storagePath: relativePath,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}

export async function deleteStoredFile(storagePath: string) {
  const absolutePath = path.join(process.cwd(), storagePath);
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
