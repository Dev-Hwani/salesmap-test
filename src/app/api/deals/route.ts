import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { canAssignOwner, getVisibleOwnerIds } from "@/lib/policy";
import { z } from "zod";

const dealSchema = z.object({
  name: z.string().min(1),
  pipelineId: z.number().int(),
  stageId: z.number().int(),
  ownerId: z.number().int(),
  expectedRevenue: z.number().int().nullable().optional(),
  closeDate: z.string().nullable().optional(),
  fieldValues: z
    .array(
      z.object({
        fieldId: z.number().int(),
        value: z.union([z.string(), z.number(), z.null()]),
      })
    )
    .optional(),
});

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return numeric;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const pipelineParam = request.nextUrl.searchParams.get("pipelineId");
  if (!pipelineParam) {
    return jsonError("파이프라인 정보가 올바르지 않습니다.");
  }
  const pipelineId = Number(pipelineParam);
  if (Number.isNaN(pipelineId)) {
    return jsonError("파이프라인 정보가 올바르지 않습니다.");
  }

  const visibleOwnerIds = await getVisibleOwnerIds(user);
  const deals = await prisma.deal.findMany({
    where: {
      pipelineId,
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
        },
      },
    },
  });

  return jsonOk({ deals });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("인증이 필요합니다.", 401);

  const body = await request.json().catch(() => null);
  const parsed = dealSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("딜 정보를 확인해주세요.");
  }

  const {
    name,
    pipelineId,
    stageId,
    ownerId,
    expectedRevenue,
    closeDate,
    fieldValues,
  } = parsed.data;

  const closeDateValue =
    closeDate && closeDate !== "" ? new Date(closeDate) : null;
  if (closeDateValue && Number.isNaN(closeDateValue.getTime())) {
    return jsonError("마감일 값이 올바르지 않습니다.");
  }

  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    select: { pipelineId: true },
  });
  if (!stage || stage.pipelineId !== pipelineId) {
    return jsonError("스테이지 정보가 올바르지 않습니다.");
  }

  const ownerAllowed = await canAssignOwner(user, ownerId);
  if (!ownerAllowed) {
    return jsonError("해당 담당자에게 딜을 할당할 수 없습니다.");
  }

  const fieldValueCreates = [];
  if (fieldValues && fieldValues.length > 0) {
    const fieldIds = fieldValues.map((value) => value.fieldId);
    const fields = await prisma.customField.findMany({
      where: { id: { in: fieldIds } },
    });

    if (fields.length !== fieldIds.length) {
      return jsonError("커스텀 필드 정보가 올바르지 않습니다.");
    }

    for (const field of fields) {
      const input = fieldValues.find((value) => value.fieldId === field.id);
      if (!input) continue;

      if (field.type === "text") {
        fieldValueCreates.push({
          fieldId: field.id,
          valueText: input.value === null ? null : String(input.value),
        });
        continue;
      }

      if (field.type === "number") {
        const numeric = parseNumber(input.value);
        if (numeric === null && input.value !== null) {
          return jsonError("숫자 필드 값이 올바르지 않습니다.");
        }
        fieldValueCreates.push({
          fieldId: field.id,
          valueNumber: numeric,
        });
        continue;
      }

      if (field.type === "date") {
        if (input.value === null || input.value === "") {
          fieldValueCreates.push({ fieldId: field.id, valueDate: null });
          continue;
        }
        const dateValue = new Date(String(input.value));
        if (Number.isNaN(dateValue.getTime())) {
          return jsonError("날짜 필드 값이 올바르지 않습니다.");
        }
        fieldValueCreates.push({ fieldId: field.id, valueDate: dateValue });
      }
    }
  }

  const deal = await prisma.deal.create({
    data: {
      name,
      pipelineId,
      stageId,
      ownerId,
      expectedRevenue: expectedRevenue ?? null,
      closeDate: closeDateValue,
      fieldValues: {
        create: fieldValueCreates,
      },
    },
    include: {
      owner: { select: { id: true, name: true, role: true } },
      fieldValues: {
        select: {
          fieldId: true,
          valueText: true,
          valueNumber: true,
          valueDate: true,
        },
      },
    },
  });

  return jsonOk({ deal }, 201);
}
