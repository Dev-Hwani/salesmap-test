import type { CustomField } from "@prisma/client";

export type FieldValueInputValue =
  | string
  | number
  | boolean
  | null
  | number[];

export type FieldValueInput = {
  fieldId: number;
  value: FieldValueInputValue;
};

export type StoredFieldValue = {
  valueText: string | null;
  valueNumber: number | null;
  valueDate: Date | null;
  valueDateTime: Date | null;
  valueBoolean?: boolean | null;
  valueUserId?: number | null;
  valueOptionId?: number | null;
};

type ParsedFieldValue = {
  fieldId: number;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: Date | null;
  valueDateTime?: Date | null;
  valueBoolean?: boolean | null;
  valueUserId?: number | null;
  valueOptionId?: number | null;
};

export type ParsedCustomFieldValue =
  | {
      ok: true;
      data?: ParsedFieldValue;
      optionIds?: number[];
      userIds?: number[];
      hasValue: boolean;
    }
  | { ok: false; error: string };

export function isEmptyFieldValue(value: FieldValueInput["value"]) {
  if (Array.isArray(value)) return value.length === 0;
  return value === null || value === "";
}

function parseNumber(value: FieldValueInput["value"]) {
  if (isEmptyFieldValue(value)) return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function parseBoolean(value: FieldValueInput["value"]) {
  if (isEmptyFieldValue(value)) return null;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "false") return value === "true";
  if (value === 1 || value === 0) return value === 1;
  return null;
}

function parseIdValue(value: FieldValueInput["value"]) {
  if (isEmptyFieldValue(value)) return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

export function parseCustomFieldValue(
  field: CustomField,
  value: FieldValueInput["value"]
): ParsedCustomFieldValue {
  if (field.type === "text") {
    return {
      ok: true,
      data: { fieldId: field.id, valueText: isEmptyFieldValue(value) ? null : String(value) },
      hasValue: !isEmptyFieldValue(value),
    };
  }

  if (field.type === "number") {
    const numeric = parseNumber(value);
    if (numeric === null && !isEmptyFieldValue(value)) {
      return { ok: false, error: "숫자 필드 값이 올바르지 않습니다." };
    }
    return {
      ok: true,
      data: { fieldId: field.id, valueNumber: numeric },
      hasValue: numeric !== null,
    };
  }

  if (field.type === "date") {
    if (isEmptyFieldValue(value)) {
      return { ok: true, data: { fieldId: field.id, valueDate: null }, hasValue: false };
    }
    const dateValue = new Date(String(value));
    if (Number.isNaN(dateValue.getTime())) {
      return { ok: false, error: "날짜 필드 값이 올바르지 않습니다." };
    }
    return { ok: true, data: { fieldId: field.id, valueDate: dateValue }, hasValue: true };
  }

  if (field.type === "datetime") {
    if (isEmptyFieldValue(value)) {
      return { ok: true, data: { fieldId: field.id, valueDateTime: null }, hasValue: false };
    }
    const dateValue = new Date(String(value));
    if (Number.isNaN(dateValue.getTime())) {
      return { ok: false, error: "날짜/시간 필드 값이 올바르지 않습니다." };
    }
    return {
      ok: true,
      data: { fieldId: field.id, valueDateTime: dateValue },
      hasValue: true,
    };
  }

  if (field.type === "boolean") {
    const boolValue = parseBoolean(value);
    if (boolValue === null && !isEmptyFieldValue(value)) {
      return { ok: false, error: "불리언 필드 값이 올바르지 않습니다." };
    }
    return {
      ok: true,
      data: { fieldId: field.id, valueBoolean: boolValue },
      hasValue: boolValue !== null,
    };
  }

  if (field.type === "user") {
    const userId = parseIdValue(value);
    if (userId === null && !isEmptyFieldValue(value)) {
      return { ok: false, error: "사용자 필드 값이 올바르지 않습니다." };
    }
    return {
      ok: true,
      data: { fieldId: field.id, valueUserId: userId },
      hasValue: userId !== null,
    };
  }

  if (field.type === "users") {
    if (isEmptyFieldValue(value)) {
      return { ok: true, userIds: [], hasValue: false };
    }
    if (!Array.isArray(value)) {
      return { ok: false, error: "사용자(복수) 필드 값이 올바르지 않습니다." };
    }
    const userIds = value.map((item) => Number(item)).filter((item) => !Number.isNaN(item));
    return { ok: true, userIds, hasValue: userIds.length > 0 };
  }

  if (field.type === "single_select") {
    const optionId = parseIdValue(value);
    if (optionId === null && !isEmptyFieldValue(value)) {
      return { ok: false, error: "단일 선택 필드 값이 올바르지 않습니다." };
    }
    return {
      ok: true,
      data: { fieldId: field.id, valueOptionId: optionId },
      hasValue: optionId !== null,
    };
  }

  if (field.type === "multi_select") {
    if (isEmptyFieldValue(value)) {
      return { ok: true, optionIds: [], hasValue: false };
    }
    if (!Array.isArray(value)) {
      return { ok: false, error: "복수 선택 필드 값이 올바르지 않습니다." };
    }
    const optionIds = value.map((item) => Number(item)).filter((item) => !Number.isNaN(item));
    return { ok: true, optionIds, hasValue: optionIds.length > 0 };
  }

  if (field.type === "file" || field.type === "calculation") {
    return { ok: true, hasValue: false };
  }

  return { ok: false, error: "지원하지 않는 필드 타입입니다." };
}

export function hasStoredValue(value: StoredFieldValue | undefined | null) {
  if (!value) return false;
  return (
    value.valueText !== null ||
    value.valueNumber !== null ||
    value.valueDate !== null ||
    value.valueDateTime !== null ||
    value.valueBoolean !== null ||
    value.valueUserId !== null ||
    value.valueOptionId !== null
  );
}
