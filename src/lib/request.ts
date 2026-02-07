import { NextRequest } from "next/server";

export type ParsedRequest<T> = {
  body: T | null;
  filesByFieldId: Map<number, File[]>;
};

export async function parseRequestWithFiles<T>(
  request: NextRequest
): Promise<ParsedRequest<T>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const payload = form.get("payload");
    if (!payload || typeof payload !== "string") {
      return { body: null, filesByFieldId: new Map() };
    }
    const body = JSON.parse(payload) as T;
    const filesByFieldId = new Map<number, File[]>();

    for (const [key, value] of form.entries()) {
      if (!key.startsWith("file-")) continue;
      const fieldId = Number(key.replace("file-", ""));
      if (!fieldId || typeof value === "string") continue;
      const list = filesByFieldId.get(fieldId) ?? [];
      list.push(value as File);
      filesByFieldId.set(fieldId, list);
    }

    return { body, filesByFieldId };
  }

  const body = (await request.json().catch(() => null)) as T | null;
  return { body, filesByFieldId: new Map() };
}
