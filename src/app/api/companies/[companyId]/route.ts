import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseId } from "@/lib/ids";
import { canAssignOwner, getVisibleOwnerIds } from "@/lib/policy";
import { hasStoredValue, isEmptyFieldValue, parseCustomFieldValue } from "@/lib/customFieldValues";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  industry: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  ownerId: z.number().int().optional(),
  fieldValues: z
    .array(
      z.object({
        fieldId: z.number().int(),
        value: z.union([z.string(), z.number(), z.null()]),
      })
    )
    .optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const { companyId: companyIdParam } = await params;
  const companyId = parseId(companyIdParam);
  if (!companyId) return jsonError("회사 정보가 올바르지 않습니다.");

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("수정 요청이 올바르지 않습니다.");
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, ownerId: true, deletedAt: true },
  });
  if (!company || company.deletedAt) {
    return jsonError("회사를 찾을 수 없습니다.", 404);
  }

  const visibleOwnerIds = await getVisibleOwnerIds(user);
  if (visibleOwnerIds && !visibleOwnerIds.includes(company.ownerId)) {
    return jsonError("해당 회사에 접근할 수 없습니다.", 403);
  }

  if (parsed.data.ownerId) {
    const ownerAllowed = await canAssignOwner(user, parsed.data.ownerId);
    if (!ownerAllowed) {
      return jsonError("해당 담당자에게 회사를 할당할 수 없습니다.");
    }
  }

  const existingValues = await prisma.companyFieldValue.findMany({
    where: { companyId },
    select: {
      fieldId: true,
      valueText: true,
      valueNumber: true,
      valueDate: true,
      valueDateTime: true,
    },
  });
  const existingMap = new Map(existingValues.map((value) => [value.fieldId, value]));

  const requiredFields = await prisma.customField.findMany({
    where: { objectType: "COMPANY", deletedAt: null, required: true },
    select: { id: true },
  });
  const missingRequired = requiredFields.filter((field) => {
    const input = parsed.data.fieldValues?.find((value) => value.fieldId === field.id);
    if (input && !isEmptyFieldValue(input.value)) return false;
    return !hasStoredValue(existingMap.get(field.id));
  });
  if (missingRequired.length > 0) {
    return jsonError("필수 커스텀 필드를 입력해주세요.");
  }

  const updates = [] as ReturnType<typeof prisma.companyFieldValue.upsert>[];
  if (parsed.data.fieldValues && parsed.data.fieldValues.length > 0) {
    const fieldIds = parsed.data.fieldValues.map((value) => value.fieldId);
    const fields = await prisma.customField.findMany({
      where: { id: { in: fieldIds }, objectType: "COMPANY", deletedAt: null },
    });

    if (fields.length !== fieldIds.length) {
      return jsonError("커스텀 필드 정보가 올바르지 않습니다.");
    }

    for (const field of fields) {
      const input = parsed.data.fieldValues.find((value) => value.fieldId === field.id);
      if (!input) continue;

      const parsedValue = parseCustomFieldValue(field, input.value);
      if (!parsedValue.ok) {
        return jsonError(parsedValue.error);
      }

      const { fieldId, ...valueData } = parsedValue.data;
      updates.push(
        prisma.companyFieldValue.upsert({
          where: { companyId_fieldId: { companyId, fieldId } },
          create: { companyId, fieldId, ...valueData },
          update: valueData,
        })
      );
    }
  }

  const [updated] = await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: {
        name: parsed.data.name,
        industry: parsed.data.industry,
        size: parsed.data.size,
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
          },
        },
      },
    }),
    ...updates,
  ]);

  return jsonOk({ company: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const { companyId: companyIdParam } = await params;
  const companyId = parseId(companyIdParam);
  if (!companyId) return jsonError("회사 정보가 올바르지 않습니다.");

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, ownerId: true, deletedAt: true },
  });
  if (!company || company.deletedAt) {
    return jsonError("회사를 찾을 수 없습니다.", 404);
  }

  const visibleOwnerIds = await getVisibleOwnerIds(user);
  if (visibleOwnerIds && !visibleOwnerIds.includes(company.ownerId)) {
    return jsonError("해당 회사에 접근할 수 없습니다.", 403);
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { deletedAt: new Date() },
  });

  return jsonOk({ ok: true });
}
