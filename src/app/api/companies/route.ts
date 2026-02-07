import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { canAssignOwner, getAssignableUsers, getVisibleOwnerIds, hasPermission } from "@/lib/policy";
import { parseRequestWithFiles } from "@/lib/request";
import { parseCustomFieldInputs } from "@/lib/customFieldInput";
import { evaluateFormula } from "@/lib/calculation";
import { saveUploadedFile } from "@/lib/fileStorage";
import { logAudit } from "@/lib/audit";
import { filterMasked, getMaskedFieldIds } from "@/lib/masking";
import { z } from "zod";

const companySchema = z.object({
  name: z.string().min(1),
  industry: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  ownerId: z.number().int(),
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

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const visibleOwnerIds = await getVisibleOwnerIds(user);
  const companies = await prisma.company.findMany({
    where: {
      deletedAt: null,
      ...(visibleOwnerIds ? { ownerId: { in: visibleOwnerIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
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
        where: { isCurrent: true },
        select: {
          id: true,
          fieldId: true,
          originalName: true,
          mimeType: true,
          size: true,
          version: true,
          isCurrent: true,
          groupKey: true,
          replacedAt: true,
          createdAt: true,
        },
      },
    },
  });

  const maskedIds = await getMaskedFieldIds("COMPANY", user.workspaceId);
  const sanitized = companies.map((company) => ({
    ...company,
    fieldValues: filterMasked(company.fieldValues, maskedIds),
    optionValues: filterMasked(company.optionValues, maskedIds),
    userValues: filterMasked(company.userValues, maskedIds),
    files: filterMasked(company.files, maskedIds),
  }));

  return jsonOk({ companies: sanitized });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);
  if (!hasPermission(user, "write")) {
    return jsonError("권한이 없습니다.", 403);
  }

  const { body, filesByFieldId } = await parseRequestWithFiles<
    z.infer<typeof companySchema>
  >(request);

  const parsed = companySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("회사 정보를 확인해주세요.");
  }

  const { name, industry, size, ownerId, fieldValues } = parsed.data;

  const ownerAllowed = await canAssignOwner(user, ownerId);
  if (!ownerAllowed) {
    return jsonError("해당 담당자에게 회사를 할당할 수 없습니다.");
  }

  const inputs = fieldValues ?? [];
  const fieldIds = inputs.map((value) => value.fieldId);
  const fields = fieldIds.length
    ? await prisma.customField.findMany({
        where: {
          id: { in: fieldIds },
          objectType: "COMPANY",
          deletedAt: null,
          ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}),
        },
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

  const requiredFields = await prisma.customField.findMany({
    where: {
      objectType: "COMPANY",
      deletedAt: null,
      required: true,
      ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}),
    },
  });

  const fileFieldIds = Array.from(filesByFieldId.keys());
  const fileFields = fileFieldIds.length
    ? await prisma.customField.findMany({
        where: {
          id: { in: fileFieldIds },
          objectType: "COMPANY",
          deletedAt: null,
          ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}),
        },
      })
    : [];

  if (fileFields.length !== fileFieldIds.length) {
    return jsonError("파일 필드 정보가 올바르지 않습니다.");
  }
  if (fileFields.some((field) => field.type !== "file")) {
    return jsonError("파일 필드 정보가 올바르지 않습니다.");
  }

  const numberValueMap: Record<number, number | null> = {};
  const valueMap = new Map<number, Record<string, unknown>>();
  valueRows.forEach((row) => {
    const fieldId = row.fieldId as number;
    valueMap.set(fieldId, row);
  });
  fields.forEach((field) => {
    if (field.type !== "number") return;
    const row = valueMap.get(field.id);
    numberValueMap[field.id] = typeof row?.valueNumber === "number" ? (row.valueNumber as number) : null;
  });

  const calculationFields = await prisma.customField.findMany({
    where: {
      objectType: "COMPANY",
      deletedAt: null,
      type: "calculation",
      ...(user.workspaceId ? { workspaceId: user.workspaceId } : {}),
    },
  });

  const warnings: string[] = [];
  for (const field of calculationFields) {
    const result = field.formula
      ? evaluateFormula(field.formula, numberValueMap)
      : { value: null, warnings: [] };
    if (result.warnings.length > 0) {
      warnings.push(...result.warnings.map((warning) => `${field.label}: ${warning}`));
    }
    valueMap.set(field.id, { fieldId: field.id, valueNumber: result.value });
    hasValueMap.set(field.id, result.value !== null);
  }

  const missingRequired = requiredFields.filter((field) => {
    if (field.type === "file") {
      return (filesByFieldId.get(field.id) ?? []).length === 0;
    }
    if (field.type === "multi_select" || field.type === "users") {
      return !(hasValueMap.get(field.id) ?? false);
    }
    if (field.type === "calculation") {
      return !(hasValueMap.get(field.id) ?? false);
    }
    return !(hasValueMap.get(field.id) ?? false);
  });
  if (missingRequired.length > 0) {
    return jsonError("필수 커스텀 필드를 입력해주세요.");
  }

  const optionValueCreates = Array.from(optionValues.entries()).flatMap(
    ([fieldId, optionIds]) => optionIds.map((optionId) => ({ fieldId, optionId }))
  );
  const userValueCreates = Array.from(userValues.entries()).flatMap(
    ([fieldId, userIds]) => userIds.map((userId) => ({ fieldId, userId }))
  );

  const fileCreates = [] as Array<{
    fieldId: number;
    originalName: string;
    storagePath: string;
    mimeType: string;
    size: number;
  }>;

  try {
    for (const [fieldId, files] of filesByFieldId.entries()) {
      for (const file of files) {
        const stored = await saveUploadedFile(file, "COMPANY", fieldId);
        fileCreates.push({ fieldId, ...stored });
      }
    }
  } catch (error) {
    return jsonError((error as Error).message ?? "파일 업로드에 실패했습니다.");
  }

  const company = await prisma.company.create({
    data: {
      name,
      industry: industry ?? null,
      size: size ?? null,
      ownerId,
      fieldValues: { create: Array.from(valueMap.values()) },
      optionValues: { create: optionValueCreates },
      userValues: { create: userValueCreates },
      files: { create: fileCreates },
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
        where: { isCurrent: true },
        select: {
          id: true,
          fieldId: true,
          originalName: true,
          mimeType: true,
          size: true,
          version: true,
          isCurrent: true,
          groupKey: true,
          replacedAt: true,
          createdAt: true,
        },
      },
    },
  });

  await logAudit({
    actorId: user.id,
    entityType: "COMPANY",
    entityId: company.id,
    action: "CREATE",
    after: { name: company.name, ownerId: company.ownerId },
  });

  if (fileCreates.length > 0) {
    await logAudit({
      actorId: user.id,
      entityType: "FILE",
      entityId: null,
      action: "FILE_UPLOAD",
      meta: { objectType: "COMPANY", objectId: company.id, count: fileCreates.length },
    });
  }

  const maskedIds = await getMaskedFieldIds("COMPANY", user.workspaceId);
  const sanitized = {
    ...company,
    fieldValues: filterMasked(company.fieldValues, maskedIds),
    optionValues: filterMasked(company.optionValues, maskedIds),
    userValues: filterMasked(company.userValues, maskedIds),
    files: filterMasked(company.files, maskedIds),
  };

  return jsonOk({ company: sanitized, warnings }, 201);
}
