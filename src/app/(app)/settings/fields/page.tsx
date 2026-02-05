"use client";

import { useEffect, useState } from "react";
import type { CustomField } from "@/types/domain";

type FieldDraft = CustomField;

export default function FieldSettingsPage() {
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [newField, setNewField] = useState({
    label: "",
    type: "text",
    visibleInCreate: true,
    visibleInPipeline: false,
  });
  const [message, setMessage] = useState<string | null>(null);

  const refreshFields = async () => {
    const response = await fetch("/api/custom-fields");
    if (!response.ok) return;
    const data = await response.json();
    setFields(data.fields);
  };

  useEffect(() => {
    refreshFields();
  }, []);

  const onCreateField = async () => {
    if (!newField.label.trim()) return;
    const response = await fetch("/api/custom-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newField),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "필드 생성에 실패했습니다.");
      return;
    }
    setNewField({
      label: "",
      type: "text",
      visibleInCreate: true,
      visibleInPipeline: false,
    });
    await refreshFields();
  };

  const updateField = async (field: FieldDraft) => {
    const response = await fetch(`/api/custom-fields/${field.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: field.label,
        type: field.type,
        visibleInCreate: field.visibleInCreate,
        visibleInPipeline: field.visibleInPipeline,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "필드 수정에 실패했습니다.");
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

  return (
    <div className="flex flex-col gap-6">
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
              setNewField((prev) => ({ ...prev, type: event.target.value }))
            }
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="text">text</option>
            <option value="number">number</option>
            <option value="date">date</option>
          </select>
        </div>
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
            파이프라인 표시
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
                  <option value="text">text</option>
                  <option value="number">number</option>
                  <option value="date">date</option>
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
                  파이프라인 표시
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
              </div>
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
