import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { canAssignOwner, getVisibleOwnerIds } from "@/lib/policy";
import { isEmptyFieldValue, parseCustomFieldValue } from "@/lib/customFieldValues";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  companyId: z.number().int().optional().nullable(),
  ownerId: z.number().int(),
  fieldValues: z
    .array(
      z.object({
        fieldId: z.number().int(),
        value: z.union([z.string(), z.number(), z.null()]),
      })
    )
    .optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const visibleOwnerIds = await getVisibleOwnerIds(user);
  const contacts = await prisma.contact.findMany({
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
        },
      },
    },
  });

  return jsonOk({ contacts });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const visibleOwnerIds = await getVisibleOwnerIds(user);

  const body = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("고객 정보를 확인해주세요.");
  }

  const { name, email, phone, companyId, ownerId, fieldValues } = parsed.data;

  if (companyId) {
    const company = await prisma.company.findFirst({
      where: {
        id: companyId,
        deletedAt: null,
        ...(visibleOwnerIds ? { ownerId: { in: visibleOwnerIds } } : {}),
      },
      select: { id: true },
    });
    if (!company) {
      return jsonError("회사 정보가 올바르지 않습니다.");
    }
  }

  const ownerAllowed = await canAssignOwner(user, ownerId);
  if (!ownerAllowed) {
    return jsonError("해당 담당자에게 고객을 할당할 수 없습니다.");
  }

  const requiredFields = await prisma.customField.findMany({
    where: { objectType: "CONTACT", deletedAt: null, required: true },
    select: { id: true },
  });
  const missingRequired = requiredFields.filter(
    (field) =>
      !fieldValues?.some(
        (value) => value.fieldId === field.id && !isEmptyFieldValue(value.value)
      )
  );
  if (missingRequired.length > 0) {
    return jsonError("필수 커스텀 필드를 입력해주세요.");
  }

  const fieldValueCreates = [];
  if (fieldValues && fieldValues.length > 0) {
    const fieldIds = fieldValues.map((value) => value.fieldId);
    const fields = await prisma.customField.findMany({
      where: { id: { in: fieldIds }, objectType: "CONTACT", deletedAt: null },
    });

    if (fields.length !== fieldIds.length) {
      return jsonError("커스텀 필드 정보가 올바르지 않습니다.");
    }

    for (const field of fields) {
      const input = fieldValues.find((value) => value.fieldId === field.id);
      if (!input) continue;

      const parsedValue = parseCustomFieldValue(field, input.value);
      if (!parsedValue.ok) {
        return jsonError(parsedValue.error);
      }
      fieldValueCreates.push(parsedValue.data);
    }
  }

  const contact = await prisma.contact.create({
    data: {
      name,
      email: email ?? null,
      phone: phone ?? null,
      companyId: companyId ?? null,
      ownerId,
      fieldValues: { create: fieldValueCreates },
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
  });

  return jsonOk({ contact }, 201);
}
