import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { canAssignOwner, getVisibleOwnerIds } from "@/lib/policy";
import { isEmptyFieldValue, parseCustomFieldValue } from "@/lib/customFieldValues";
import { z } from "zod";

const leadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  companyId: z.number().int().optional().nullable(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "LOST"]),
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
  const leads = await prisma.lead.findMany({
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

  return jsonOk({ leads });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const visibleOwnerIds = await getVisibleOwnerIds(user);

  const body = await request.json().catch(() => null);
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("리드 정보를 확인해주세요.");
  }

  const { name, email, phone, companyId, status, ownerId, fieldValues } = parsed.data;

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
    return jsonError("해당 담당자에게 리드를 할당할 수 없습니다.");
  }

  const requiredFields = await prisma.customField.findMany({
    where: { objectType: "LEAD", deletedAt: null, required: true },
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
      where: { id: { in: fieldIds }, objectType: "LEAD", deletedAt: null },
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

  const lead = await prisma.lead.create({
    data: {
      name,
      email: email ?? null,
      phone: phone ?? null,
      companyId: companyId ?? null,
      status,
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

  return jsonOk({ lead }, 201);
}
