import type { CustomField } from "@prisma/client";

export type FieldValueInput = {
  fieldId: number;
  value: string | number | null;
};

export type StoredFieldValue = {
  valueText: string | null;
  valueNumber: number | null;
  valueDate: Date | null;
  valueDateTime: Date | null;
};

type ParsedFieldValue = {
  fieldId: number;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: Date | null;
  valueDateTime?: Date | null;
};

export function isEmptyFieldValue(value: FieldValueInput["value"]) {
  return value === null || value === "";
}

function parseNumber(value: FieldValueInput["value"]) {
  if (isEmptyFieldValue(value)) return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

export function parseCustomFieldValue(
  field: CustomField,
  value: FieldValueInput["value"]
): { ok: true; data: ParsedFieldValue } | { ok: false; error: string } {
  if (field.type === "text") {
    return {
      ok: true,
      data: { fieldId: field.id, valueText: isEmptyFieldValue(value) ? null : String(value) },
    };
  }

  if (field.type === "number") {
    const numeric = parseNumber(value);
    if (numeric === null && !isEmptyFieldValue(value)) {
      return { ok: false, error: "숫자 필드 값이 올바르지 않습니다." };
    }
    return { ok: true, data: { fieldId: field.id, valueNumber: numeric } };
  }

  if (field.type === "date") {
    if (isEmptyFieldValue(value)) {
      return { ok: true, data: { fieldId: field.id, valueDate: null } };
    }
    const dateValue = new Date(String(value));
    if (Number.isNaN(dateValue.getTime())) {
      return { ok: false, error: "날짜 필드 값이 올바르지 않습니다." };
    }
    return { ok: true, data: { fieldId: field.id, valueDate: dateValue } };
  }

  if (field.type === "datetime") {
    if (isEmptyFieldValue(value)) {
      return { ok: true, data: { fieldId: field.id, valueDateTime: null } };
    }
    const dateValue = new Date(String(value));
    if (Number.isNaN(dateValue.getTime())) {
      return { ok: false, error: "날짜/시간 필드 값이 올바르지 않습니다." };
    }
    return { ok: true, data: { fieldId: field.id, valueDateTime: dateValue } };
  }

  return { ok: false, error: "지원하지 않는 필드 타입입니다." };
}

export function hasStoredValue(value: StoredFieldValue | undefined | null) {
  if (!value) return false;
  return (
    value.valueText !== null ||
    value.valueNumber !== null ||
    value.valueDate !== null ||
    value.valueDateTime !== null
  );
}
