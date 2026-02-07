import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { canAssignOwner, getAssignableUsers, getVisibleOwnerIds } from "@/lib/policy";
import { parseRequestWithFiles } from "@/lib/request";
import { parseCustomFieldInputs } from "@/lib/customFieldInput";
import { evaluateFormula } from "@/lib/calculation";
import { saveUploadedFile } from "@/lib/fileStorage";
import { hasStoredValue } from "@/lib/customFieldValues";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  companyId: z.number().int().nullable().optional(),
  ownerId: z.number().int().optional(),
  fieldValues: z
    .array(
      z.object({
        fieldId: z.number().int(),
        value: z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.null(),
          z.array(z.number()),
        ]),
      })
    )
    .optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const { contactId: contactIdParam } = await params;
  const contactId = parseId(contactIdParam);
  if (!contactId) return jsonError("고객 정보가 올바르지 않습니다.");

  const { body, filesByFieldId } = await parseRequestWithFiles<
    z.infer<typeof updateSchema>
  >(request);

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("수정 요청이 올바르지 않습니다.");
  }

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, ownerId: true, deletedAt: true },
  });
  if (!contact || contact.deletedAt) {
    return jsonError("고객을 찾을 수 없습니다.", 404);
  }

  const visibleOwnerIds = await getVisibleOwnerIds(user);
  if (visibleOwnerIds && !visibleOwnerIds.includes(contact.ownerId)) {
    return jsonError("해당 고객에 접근할 수 없습니다.", 403);
  }

  if (parsed.data.ownerId) {
    const ownerAllowed = await canAssignOwner(user, parsed.data.ownerId);
    if (!ownerAllowed) {
      return jsonError("해당 담당자에게 고객을 할당할 수 없습니다.");
    }
  }

  if (parsed.data.companyId) {
    const company = await prisma.company.findFirst({
      where: {
        id: parsed.data.companyId,
        deletedAt: null,
        ...(visibleOwnerIds ? { ownerId: { in: visibleOwnerIds } } : {}),
      },
      select: { id: true },
    });
    if (!company) {
      return jsonError("회사 정보가 올바르지 않습니다.");
    }
  }

  const inputs = parsed.data.fieldValues ?? [];
  const inputFieldIds = new Set(inputs.map((value) => value.fieldId));
  const fieldIds = inputs.map((value) => value.fieldId);
  const fields = fieldIds.length
    ? await prisma.customField.findMany({
        where: { id: { in: fieldIds }, objectType: "CONTACT", deletedAt: null },
      })
    : [];

  if (fields.length !== fieldIds.length) {
    return jsonError("커스텀 필드 정보가 올바르지 않습니다.");
  }

  const optionRows = fieldIds.length
    ? await prisma.customFieldOption.findMany({
        where: { fieldId: { in: fieldIds }, deletedAt: null },
        select: { id: true, fieldId: true },
      })
    : [];
  const optionMap = new Map<number, Set<number>>();
  optionRows.forEach((row) => {
    const set = optionMap.get(row.fieldId) ?? new Set();
    set.add(row.id);
    optionMap.set(row.fieldId, set);
  });

  const assignableUsers = await getAssignableUsers(user);
  const allowedUserIds = new Set(assignableUsers.map((u) => u.id));

  const parsedFields = parseCustomFieldInputs({
    fields,
    inputs,
    optionMap,
    allowedUserIds,
  });
  if (!parsedFields.ok) {
    return jsonError(parsedFields.error);
  }

  const valueRows = parsedFields.data.valueRows;
  const optionValues = parsedFields.data.multiOptionValues;
  const userValues = parsedFields.data.multiUserValues;
  const hasValueMap = parsedFields.data.hasValueMap;

  const existingValues = await prisma.contactFieldValue.findMany({
    where: { contactId },
    select: {
      fieldId: true,
      valueText: true,
      valueNumber: true,
      valueDate: true,
      valueDateTime: true,
      valueBoolean: true,
      valueUserId: true,
      valueOptionId: true,
    },
  });
  const existingMap = new Map(existingValues.map((value) => [value.fieldId, value]));

  const existingOptionCounts = await prisma.contactFieldOptionValue.groupBy({
    by: ["fieldId"],
    where: { contactId },
    _count: { fieldId: true },
  });
  const optionCountMap = new Map(
    existingOptionCounts.map((item) => [item.fieldId, item._count.fieldId])
  );

  const existingUserCounts = await prisma.contactFieldUserValue.groupBy({
    by: ["fieldId"],
    where: { contactId },
    _count: { fieldId: true },
  });
  const userCountMap = new Map(
    existingUserCounts.map((item) => [item.fieldId, item._count.fieldId])
  );

  const existingFileCounts = await prisma.contactFieldFile.groupBy({
    by: ["fieldId"],
    where: { contactId },
    _count: { fieldId: true },
  });
  const fileCountMap = new Map(
    existingFileCounts.map((item) => [item.fieldId, item._count.fieldId])
  );

  const fileFieldIds = Array.from(filesByFieldId.keys());
  const fileFields = fileFieldIds.length
    ? await prisma.customField.findMany({
        where: { id: { in: fileFieldIds }, objectType: "CONTACT", deletedAt: null },
      })
    : [];

  if (fileFields.length !== fileFieldIds.length) {
    return jsonError("파일 필드 정보가 올바르지 않습니다.");
  }
  if (fileFields.some((field) => field.type !== "file")) {
    return jsonError("파일 필드 정보가 올바르지 않습니다.");
  }

  const numberFields = await prisma.customField.findMany({
    where: { objectType: "CONTACT", deletedAt: null, type: "number" },
  });

  const numberValueMap: Record<number, number | null> = {};
  numberFields.forEach((field) => {
    const existing = existingMap.get(field.id);
    numberValueMap[field.id] = typeof existing?.valueNumber === "number" ? existing.valueNumber : null;
  });

  valueRows.forEach((row) => {
    const fieldId = row.fieldId as number;
    if (!(fieldId in numberValueMap)) return;
    numberValueMap[fieldId] =
      typeof row.valueNumber === "number" ? (row.valueNumber as number) : null;
  });

  const calculationFields = await prisma.customField.findMany({
    where: { objectType: "CONTACT", deletedAt: null, type: "calculation" },
  });
  const warnings: string[] = [];
  const calculationRows: Array<Record<string, unknown>> = [];
  for (const field of calculationFields) {
    const result = field.formula
      ? evaluateFormula(field.formula, numberValueMap)
      : { value: null, warnings: [] };
    if (result.warnings.length > 0) {
      warnings.push(...result.warnings.map((warning) => `${field.label}: ${warning}`));
    }
    calculationRows.push({ fieldId: field.id, valueNumber: result.value });
    hasValueMap.set(field.id, result.value !== null);
  }

  const requiredFields = await prisma.customField.findMany({
    where: { objectType: "CONTACT", deletedAt: null, required: true },
  });

  const missingRequired = requiredFields.filter((field) => {
    if (field.type === "file") {
      const existingCount = fileCountMap.get(field.id) ?? 0;
      const incomingCount = (filesByFieldId.get(field.id) ?? []).length;
      return existingCount + incomingCount === 0;
    }
    if (field.type === "multi_select") {
      if (inputFieldIds.has(field.id)) {
        return !(hasValueMap.get(field.id) ?? false);
      }
      return (optionCountMap.get(field.id) ?? 0) === 0;
    }
    if (field.type === "users") {
      if (inputFieldIds.has(field.id)) {
        return !(hasValueMap.get(field.id) ?? false);
      }
      return (userCountMap.get(field.id) ?? 0) === 0;
    }
    if (field.type === "calculation") {
      return !(hasValueMap.get(field.id) ?? false);
    }
    if (inputFieldIds.has(field.id)) {
      return !(hasValueMap.get(field.id) ?? false);
    }
    return !hasStoredValue(existingMap.get(field.id));
  });
  if (missingRequired.length > 0) {
    return jsonError("필수 커스텀 필드를 입력해주세요.");
  }

  const valueDataMap = new Map<number, Record<string, unknown>>();
  valueRows.forEach((row) => valueDataMap.set(row.fieldId as number, row));
  calculationRows.forEach((row) => valueDataMap.set(row.fieldId as number, row));

  const operations: any[] = [];

  for (const row of valueDataMap.values()) {
    const fieldId = row.fieldId as number;
    const { fieldId: _ignored, ...data } = row;
    operations.push(
      prisma.contactFieldValue.upsert({
        where: { contactId_fieldId: { contactId, fieldId } },
        create: { contactId, fieldId, ...(data as Record<string, unknown>) },
        update: data as Record<string, unknown>,
      })
    );
  }

  for (const [fieldId, optionIds] of optionValues.entries()) {
    if (!inputFieldIds.has(fieldId)) continue;
    operations.push(prisma.contactFieldOptionValue.deleteMany({ where: { contactId, fieldId } }));
    if (optionIds.length > 0) {
      operations.push(
        prisma.contactFieldOptionValue.createMany({
          data: optionIds.map((optionId) => ({ contactId, fieldId, optionId })),
        })
      );
    }
  }

  for (const [fieldId, userIds] of userValues.entries()) {
    if (!inputFieldIds.has(fieldId)) continue;
    operations.push(prisma.contactFieldUserValue.deleteMany({ where: { contactId, fieldId } }));
    if (userIds.length > 0) {
      operations.push(
        prisma.contactFieldUserValue.createMany({
          data: userIds.map((userId) => ({ contactId, fieldId, userId })),
        })
      );
    }
  }

  const fileCreates: Array<{
    contactId: number;
    fieldId: number;
    originalName: string;
    storagePath: string;
    mimeType: string;
    size: number;
  }> = [];

  try {
    for (const [fieldId, files] of filesByFieldId.entries()) {
      for (const file of files) {
        const stored = await saveUploadedFile(file, "CONTACT", fieldId);
        fileCreates.push({ contactId, fieldId, ...stored });
      }
    }
  } catch (error) {
    return jsonError((error as Error).message ?? "파일 업로드에 실패했습니다.");
  }

  if (fileCreates.length > 0) {
    operations.push(prisma.contactFieldFile.createMany({ data: fileCreates }));
  }

  operations.push(
    prisma.contact.update({
      where: { id: contactId },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        companyId: parsed.data.companyId,
        ownerId: parsed.data.ownerId,
      },
      include: {
        owner: { select: { id: true, name: true, role: true } },
        fieldValues: {
          select: {
            fieldId: true,
            valueText: true,
            valueNumber: true,
            valueDate: true,
            valueDateTime: true,
            valueBoolean: true,
            valueUserId: true,
            valueOptionId: true,
            valueUser: { select: { id: true, name: true, role: true } },
            valueOption: { select: { id: true, label: true } },
          },
        },
        optionValues: {
          select: {
            fieldId: true,
            optionId: true,
            option: { select: { id: true, label: true } },
          },
        },
        userValues: {
          select: {
            fieldId: true,
            userId: true,
            user: { select: { id: true, name: true, role: true } },
          },
        },
        files: {
          select: {
            id: true,
            fieldId: true,
            originalName: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
      },
    })
  );

  const results = await prisma.$transaction(operations);
  const updated = results[results.length - 1];

  return jsonOk({ contact: updated, warnings });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const { contactId: contactIdParam } = await params;
  const contactId = parseId(contactIdParam);
  if (!contactId) return jsonError("고객 정보가 올바르지 않습니다.");

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, ownerId: true, deletedAt: true },
  });
  if (!contact || contact.deletedAt) {
    return jsonError("고객을 찾을 수 없습니다.", 404);
  }

  const visibleOwnerIds = await getVisibleOwnerIds(user);
  if (visibleOwnerIds && !visibleOwnerIds.includes(contact.ownerId)) {
    return jsonError("해당 고객에 접근할 수 없습니다.", 403);
  }

  await prisma.contact.update({
    where: { id: contactId },
    data: { deletedAt: new Date() },
  });

  return jsonOk({ ok: true });
}
