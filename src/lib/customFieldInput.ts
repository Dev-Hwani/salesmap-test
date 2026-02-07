import type { CustomField } from "@prisma/client";
import {
  FieldValueInput,
  ParsedCustomFieldValue,
  parseCustomFieldValue,
} from "@/lib/customFieldValues";

export type ParsedCustomFieldInputs = {
  valueRows: Array<Record<string, unknown>>;
  multiOptionValues: Map<number, number[]>;
  multiUserValues: Map<number, number[]>;
  hasValueMap: Map<number, boolean>;
};

export function parseCustomFieldInputs({
  fields,
  inputs,
  optionMap,
  allowedUserIds,
}: {
  fields: CustomField[];
  inputs: FieldValueInput[];
  optionMap: Map<number, Set<number>>;
  allowedUserIds: Set<number>;
}): { ok: true; data: ParsedCustomFieldInputs } | { ok: false; error: string } {
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const valueRows: Array<Record<string, unknown>> = [];
  const multiOptionValues = new Map<number, number[]>();
  const multiUserValues = new Map<number, number[]>();
  const hasValueMap = new Map<number, boolean>();

  for (const input of inputs) {
    const field = fieldMap.get(input.fieldId);
    if (!field) {
      return { ok: false, error: "커스텀 필드 정보가 올바르지 않습니다." };
    }

    const parsed: ParsedCustomFieldValue = parseCustomFieldValue(field, input.value);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }

    if (field.type === "single_select") {
      const allowed = optionMap.get(field.id) ?? new Set();
      const optionId = parsed.data?.valueOptionId ?? null;
      if (optionId !== null && !allowed.has(optionId)) {
        return { ok: false, error: "선택 값이 올바르지 않습니다." };
      }
    }

    if (field.type === "multi_select") {
      const allowed = optionMap.get(field.id) ?? new Set();
      const optionIds = Array.from(new Set(parsed.optionIds ?? []));
      if (optionIds.some((id) => !allowed.has(id))) {
        return { ok: false, error: "선택 값이 올바르지 않습니다." };
      }
      multiOptionValues.set(field.id, optionIds);
    }

    if (field.type === "user") {
      const userId = parsed.data?.valueUserId ?? null;
      if (userId !== null && !allowedUserIds.has(userId)) {
        return { ok: false, error: "사용자 값이 올바르지 않습니다." };
      }
    }

    if (field.type === "users") {
      const userIds = Array.from(new Set(parsed.userIds ?? []));
      if (userIds.some((id) => !allowedUserIds.has(id))) {
        return { ok: false, error: "사용자 값이 올바르지 않습니다." };
      }
      multiUserValues.set(field.id, userIds);
    }

    if (parsed.data) {
      valueRows.push(parsed.data);
    }

    hasValueMap.set(field.id, parsed.hasValue);
  }

  return {
    ok: true,
    data: { valueRows, multiOptionValues, multiUserValues, hasValueMap },
  };
}
