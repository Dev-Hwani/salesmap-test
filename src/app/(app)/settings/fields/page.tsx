"use client";

import { useEffect, useMemo, useState } from "react";
import type { CustomField, CustomFieldOption, ObjectType } from "@/types/domain";
import { OBJECT_TYPE_LABELS, OBJECT_TYPES } from "@/lib/objectTypes";
import { getSystemFields } from "@/lib/systemFields";

type FieldDraft = CustomField;

type NewFieldState = {
  label: string;
  type: CustomField["type"];
  required: boolean;
  masked: boolean;
  visibleInCreate: boolean;
  visibleInPipeline: boolean;
  formula: string;
};

const FIELD_TYPES: Array<{ value: CustomField["type"]; label: string }> = [
  { value: "text", label: "text" },
  { value: "number", label: "number" },
  { value: "date", label: "date" },
  { value: "datetime", label: "datetime" },
  { value: "single_select", label: "single_select" },
  { value: "multi_select", label: "multi_select" },
  { value: "boolean", label: "boolean" },
  { value: "user", label: "user" },
  { value: "users", label: "users" },
  { value: "file", label: "file" },
  { value: "calculation", label: "calculation" },
];

function isSelectType(type: CustomField["type"]) {
  return type === "single_select" || type === "multi_select";
}

export default function FieldSettingsPage() {
  const [objectType, setObjectType] = useState<ObjectType>("DEAL");
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [newField, setNewField] = useState<NewFieldState>({
    label: "",
    type: "text",
    required: false,
    masked: false,
    visibleInCreate: true,
    visibleInPipeline: false,
    formula: "",
  });
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [newOptions, setNewOptions] = useState<string[]>([]);
  const [optionInputs, setOptionInputs] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const listLabel = objectType === "DEAL" ? "파이프라인 표시" : "목록 표시";
  const systemFields = useMemo(() => getSystemFields(objectType), [objectType]);

  const refreshFields = async () => {
    const response = await fetch(`/api/custom-fields?objectType=${objectType}`);
    if (!response.ok) return;
    const data = await response.json();
    setFields(data.fields);
  };

  useEffect(() => {
    refreshFields();
    setNewField((prev) => ({
      ...prev,
      label: "",
      required: false,
      masked: false,
      visibleInCreate: true,
      visibleInPipeline: false,
      formula: "",
    }));
    setNewOptions([]);
    setNewOptionLabel("");
    setOptionInputs({});
  }, [objectType]);

  useEffect(() => {
    if (!isSelectType(newField.type)) {
      setNewOptions([]);
      setNewOptionLabel("");
    }
    if (newField.type !== "calculation" && newField.formula) {
      setNewField((prev) => ({ ...prev, formula: "" }));
    }
  }, [newField.type]);

  const addNewOption = () => {
    if (!newOptionLabel.trim()) return;
    setNewOptions((prev) => [...prev, newOptionLabel.trim()]);
    setNewOptionLabel("");
  };

  const removeNewOption = (index: number) => {
    setNewOptions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const onCreateField = async () => {
    if (!newField.label.trim()) return;
    const response = await fetch("/api/custom-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectType,
        label: newField.label,
        type: newField.type,
        required: newField.required,
        masked: newField.masked,
        visibleInCreate: newField.visibleInCreate,
        visibleInPipeline: newField.visibleInPipeline,
        formula: newField.type === "calculation" ? newField.formula : undefined,
        options: isSelectType(newField.type) ? newOptions : undefined,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "필드 생성에 실패했습니다.");
      return;
    }
    setNewField({
      label: "",
      type: "text",
      required: false,
      masked: false,
      visibleInCreate: true,
      visibleInPipeline: false,
      formula: "",
    });
    setNewOptions([]);
    setNewOptionLabel("");
    await refreshFields();
  };

  const updateField = async (field: FieldDraft) => {
    const response = await fetch(`/api/custom-fields/${field.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: field.label,
        type: field.type,
        required: field.required,
        visibleInCreate: field.visibleInCreate,
        visibleInPipeline: field.visibleInPipeline,
        formula: field.type === "calculation" ? field.formula : undefined,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "필드 수정에 실패했습니다.");
      return;
    }
    await refreshFields();
  };

  const removeField = async (fieldId: number) => {
    const response = await fetch(`/api/custom-fields/${fieldId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "필드 삭제에 실패했습니다.");
      return;
    }
    await refreshFields();
  };

  const saveFieldOrder = async (nextFields: FieldDraft[]) => {
    setFields(nextFields);
    await Promise.all(
      nextFields.map((field, index) =>
        fetch(`/api/custom-fields/${field.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: index }),
        })
      )
    );
    await refreshFields();
  };

  const moveField = (fieldId: number, direction: "up" | "down") => {
    const index = fields.findIndex((field) => field.id === fieldId);
    if (index < 0) return;
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= fields.length) return;
    const nextFields = [...fields];
    const [moved] = nextFields.splice(index, 1);
    nextFields.splice(nextIndex, 0, moved);
    saveFieldOrder(nextFields);
  };

  const onFieldChange = (fieldId: number, patch: Partial<FieldDraft>) => {
    setFields((prev) =>
      prev.map((field) =>
        field.id === fieldId ? { ...field, ...patch } : field
      )
    );
  };

  const onOptionChange = (fieldId: number, optionId: number, label: string) => {
    setFields((prev) =>
      prev.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              options: field.options?.map((option) =>
                option.id === optionId ? { ...option, label } : option
              ),
            }
          : field
      )
    );
  };

  const addOption = async (fieldId: number, label: string) => {
    if (!label.trim()) return;
    const response = await fetch(`/api/custom-fields/${fieldId}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "옵션 추가에 실패했습니다.");
      return;
    }
    setOptionInputs((prev) => ({ ...prev, [fieldId]: "" }));
    await refreshFields();
  };

  const saveOption = async (option: CustomFieldOption) => {
    const response = await fetch(`/api/custom-field-options/${option.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: option.label }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "옵션 수정에 실패했습니다.");
      return;
    }
    await refreshFields();
  };

  const removeOption = async (optionId: number) => {
    const response = await fetch(`/api/custom-field-options/${optionId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "옵션 삭제에 실패했습니다.");
      return;
    }
    await refreshFields();
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">오브젝트 선택</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {OBJECT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setObjectType(type)}
              className={
                type === objectType
                  ? "rounded bg-black px-3 py-1 text-sm text-white"
                  : "rounded border border-zinc-300 px-3 py-1 text-sm"
              }
            >
              {OBJECT_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">커스텀 필드 추가</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            value={newField.label}
            onChange={(event) =>
              setNewField((prev) => ({ ...prev, label: event.target.value }))
            }
            placeholder="필드 라벨"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <select
            value={newField.type}
            onChange={(event) =>
              setNewField((prev) => ({
                ...prev,
                type: event.target.value as CustomField["type"],
              }))
            }
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            {FIELD_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {isSelectType(newField.type) && (
          <div className="mt-3 rounded border border-zinc-200 p-3">
            <p className="text-sm font-semibold">옵션</p>
            <div className="mt-2 flex gap-2">
              <input
                value={newOptionLabel}
                onChange={(event) => setNewOptionLabel(event.target.value)}
                placeholder="옵션 입력"
                className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addNewOption}
                className="rounded border border-zinc-300 px-3 py-2 text-sm"
              >
                추가
              </button>
            </div>
            {newOptions.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {newOptions.map((option, index) => (
                  <li key={`${option}-${index}`} className="flex items-center gap-2">
                    <span>{option}</span>
                    <button
                      type="button"
                      onClick={() => removeNewOption(index)}
                      className="text-xs text-red-600"
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {newField.type === "calculation" && (
          <div className="mt-3">
            <label className="flex flex-col gap-1 text-sm">
              계산식
              <input
                value={newField.formula}
                onChange={(event) =>
                  setNewField((prev) => ({ ...prev, formula: event.target.value }))
                }
                placeholder="예: ({{12}} + {{15}}) * 0.1"
                className="rounded border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newField.visibleInCreate}
              onChange={(event) =>
                setNewField((prev) => ({
                  ...prev,
                  visibleInCreate: event.target.checked,
                }))
              }
            />
            생성 화면 표시
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newField.visibleInPipeline}
              onChange={(event) =>
                setNewField((prev) => ({
                  ...prev,
                  visibleInPipeline: event.target.checked,
                }))
              }
            />
            {listLabel}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newField.required}
              onChange={(event) =>
                setNewField((prev) => ({
                  ...prev,
                  required: event.target.checked,
                }))
              }
            />
            필수
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newField.masked}
              onChange={(event) =>
                setNewField((prev) => ({
                  ...prev,
                  masked: event.target.checked,
                }))
              }
            />
            데이터 마스킹
          </label>
        </div>
        <button
          type="button"
          onClick={onCreateField}
          className="mt-3 rounded border border-zinc-300 px-3 py-2 text-sm"
        >
          추가
        </button>
      </section>

      <section className="rounded border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">시스템 필드</h2>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          {systemFields.map((field) => (
            <div key={field.key} className="flex flex-wrap items-center gap-3">
              <span className="min-w-[120px] font-medium">{field.label}</span>
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs">
                {field.type}
              </span>
              {field.required && (
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs">
                  필수
                </span>
              )}
              {field.masked && (
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs">
                  마스킹
                </span>
              )}
              {field.visibleInCreate && (
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs">
                  생성 화면 표시
                </span>
              )}
              {field.visibleInPipeline && (
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs">
                  {listLabel}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">커스텀 필드 목록</h2>
        <div className="mt-4 flex flex-col gap-4">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded border border-zinc-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={field.label}
                  onChange={(event) =>
                    onFieldChange(field.id, { label: event.target.value })
                  }
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                />
                <select
                  value={field.type}
                  onChange={(event) =>
                    onFieldChange(field.id, {
                      type: event.target.value as CustomField["type"],
                    })
                  }
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                >
                  {FIELD_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={field.visibleInCreate}
                    onChange={(event) =>
                      onFieldChange(field.id, {
                        visibleInCreate: event.target.checked,
                      })
                    }
                  />
                  생성 화면 표시
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={field.visibleInPipeline}
                    onChange={(event) =>
                      onFieldChange(field.id, {
                        visibleInPipeline: event.target.checked,
                      })
                    }
                  />
                  {listLabel}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) =>
                      onFieldChange(field.id, {
                        required: event.target.checked,
                      })
                    }
                  />
                  필수
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={field.masked} disabled />
                  마스킹(수정 불가)
                </label>
                <button
                  type="button"
                  onClick={() => moveField(field.id, "up")}
                  disabled={index === 0}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50"
                >
                  위로
                </button>
                <button
                  type="button"
                  onClick={() => moveField(field.id, "down")}
                  disabled={index === fields.length - 1}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50"
                >
                  아래로
                </button>
                <button
                  type="button"
                  onClick={() => updateField(field)}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => removeField(field.id)}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                >
                  삭제
                </button>
              </div>
              {field.type === "calculation" && (
                <div className="mt-3">
                  <label className="flex flex-col gap-1 text-sm">
                    계산식
                    <input
                      value={field.formula ?? ""}
                      onChange={(event) =>
                        onFieldChange(field.id, { formula: event.target.value })
                      }
                      placeholder="예: ({{12}} + {{15}}) * 0.1"
                      className="rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              )}
              {isSelectType(field.type) && (
                <div className="mt-3 rounded border border-zinc-200 p-3">
                  <p className="text-sm font-semibold">옵션</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      placeholder="옵션 입력"
                      className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
                      value={optionInputs[field.id] ?? ""}
                      onChange={(event) =>
                        setOptionInputs((prev) => ({
                          ...prev,
                          [field.id]: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        addOption(
                          field.id,
                          optionInputs[field.id] ?? ""
                        )
                      }
                      className="rounded border border-zinc-300 px-3 py-2 text-sm"
                    >
                      추가
                    </button>
                  </div>
                  {field.options && field.options.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {field.options.map((option) => (
                        <li key={option.id} className="flex items-center gap-2">
                          <input
                            value={option.label}
                            onChange={(event) =>
                              onOptionChange(field.id, option.id, event.target.value)
                            }
                            className="rounded border border-zinc-300 px-2 py-1 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => saveOption(option)}
                            className="text-xs text-blue-600"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => removeOption(option.id)}
                            className="text-xs text-red-600"
                          >
                            삭제
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500">옵션이 없습니다.</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {fields.length === 0 && (
            <p className="text-sm text-zinc-700">등록된 필드가 없습니다.</p>
          )}
        </div>
      </section>

      {message && <p className="text-sm text-red-600">{message}</p>}
    </div>
  );
}
