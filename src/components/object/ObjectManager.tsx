"use client";

import { useEffect, useMemo, useState } from "react";
import type { Company, CustomField, ObjectType, UserSummary } from "@/types/domain";
import { getSystemFields, type SystemField } from "@/lib/systemFields";
import { OBJECT_TYPE_LABELS } from "@/lib/objectTypes";

const LEAD_STATUS_OPTIONS = [
  { value: "NEW", label: "신규" },
  { value: "CONTACTED", label: "접촉" },
  { value: "QUALIFIED", label: "자격확인" },
  { value: "LOST", label: "실패" },
];

type ObjectManagerProps = {
  objectType: ObjectType;
  apiPath: string;
};

type ObjectItem = {
  id: number;
  ownerId: number;
  owner?: UserSummary;
  fieldValues: Array<{
    fieldId: number;
    valueText: string | null;
    valueNumber: number | null;
    valueDate: string | null;
    valueDateTime?: string | null;
  }>;
  [key: string]: unknown;
};

function dateToYMD(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dateTimeToLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

export function ObjectManager({ objectType, apiPath }: ObjectManagerProps) {
  const [items, setItems] = useState<ObjectItem[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<UserSummary[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ObjectItem | null>(null);
  const [baseValues, setBaseValues] = useState<Record<string, string>>({});
  const [customValues, setCustomValues] = useState<Record<number, string>>({});

  const systemFields = useMemo(() => getSystemFields(objectType), [objectType]);
  const createSystemFields = useMemo(
    () => systemFields.filter((field) => field.visibleInCreate),
    [systemFields]
  );
  const listSystemFields = useMemo(
    () => systemFields.filter((field) => field.visibleInPipeline),
    [systemFields]
  );

  const visibleCustomFields = useMemo(
    () => customFields.filter((field) => field.visibleInCreate),
    [customFields]
  );
  const listCustomFields = useMemo(
    () => customFields.filter((field) => field.visibleInPipeline),
    [customFields]
  );

  const companyMap = useMemo(() => {
    const map = new Map<number, Company>();
    companies.forEach((company) => map.set(company.id, company));
    return map;
  }, [companies]);

  const refreshAll = async () => {
    setLoading(true);
    const [itemsRes, fieldsRes, usersRes, companiesRes] = await Promise.all([
      fetch(apiPath),
      fetch(`/api/custom-fields?objectType=${objectType}`),
      fetch("/api/users/assignable"),
      fetch("/api/companies"),
    ]);

    if (itemsRes.ok) {
      const data = await itemsRes.json();
      const key =
        objectType === "COMPANY" ? "companies" : `${objectType.toLowerCase()}s`;
      setItems(data[key] ?? []);
    }

    if (fieldsRes.ok) {
      const data = await fieldsRes.json();
      setCustomFields(data.fields ?? []);
    }

    if (usersRes.ok) {
      const data = await usersRes.json();
      setAssignableUsers(data.users ?? []);
    }

    if (companiesRes.ok) {
      const data = await companiesRes.json();
      setCompanies(data.companies ?? []);
    }

    setLoading(false);
  };

  useEffect(() => {
    refreshAll().catch(() => setLoading(false));
  }, [objectType, apiPath]);

  useEffect(() => {
    if (!showForm || editingItem) return;
    const defaults: Record<string, string> = {};
    createSystemFields.forEach((field) => {
      if (field.key === "status") {
        defaults[field.key] = "NEW";
        return;
      }
      if (field.key === "ownerId" && assignableUsers[0]) {
        defaults[field.key] = String(assignableUsers[0].id);
        return;
      }
      defaults[field.key] = "";
    });
    setBaseValues(defaults);
    setCustomValues({});
  }, [showForm, editingItem, createSystemFields, assignableUsers]);

  useEffect(() => {
    if (!showForm || editingItem) return;
    if (assignableUsers.length === 0) return;
    setBaseValues((prev) =>
      prev.ownerId ? prev : { ...prev, ownerId: String(assignableUsers[0].id) }
    );
  }, [assignableUsers, showForm, editingItem]);

  const openCreate = () => {
    setEditingItem(null);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (item: ObjectItem) => {
    setEditingItem(item);
    const defaults: Record<string, string> = {};
    createSystemFields.forEach((field) => {
      const raw = item[field.key];
      if (field.key === "ownerId") {
        defaults[field.key] = raw ? String(raw) : "";
        return;
      }
      if (field.key === "companyId") {
        defaults[field.key] = raw ? String(raw) : "";
        return;
      }
      if (field.key === "status") {
        defaults[field.key] = raw ? String(raw) : "NEW";
        return;
      }
      if (field.type === "date") {
        defaults[field.key] = raw ? dateToYMD(String(raw)) : "";
        return;
      }
      if (field.type === "datetime") {
        defaults[field.key] = raw ? dateTimeToLocal(String(raw)) : "";
        return;
      }
      defaults[field.key] = raw ? String(raw) : "";
    });

    const nextCustomValues: Record<number, string> = {};
    visibleCustomFields.forEach((field) => {
      const match = item.fieldValues.find((value) => value.fieldId === field.id);
      if (!match) return;
      if (field.type === "text") nextCustomValues[field.id] = match.valueText ?? "";
      if (field.type === "number")
        nextCustomValues[field.id] = match.valueNumber?.toString() ?? "";
      if (field.type === "date")
        nextCustomValues[field.id] = match.valueDate ? dateToYMD(match.valueDate) : "";
      if (field.type === "datetime")
        nextCustomValues[field.id] = match.valueDateTime
          ? dateTimeToLocal(match.valueDateTime)
          : "";
    });

    setBaseValues(defaults);
    setCustomValues(nextCustomValues);
    setShowForm(true);
    setError(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  const submitForm = async () => {
    setError(null);
    const payload: Record<string, unknown> = {};
    let hasError = false;

    createSystemFields.forEach((field) => {
      const value = baseValues[field.key];
      if (field.required && !value) {
        setError("필수 시스템 필드를 입력해주세요.");
        hasError = true;
        return;
      }
      if (field.key === "ownerId") {
        if (!value) {
          setError("담당자를 선택해주세요.");
          hasError = true;
          return;
        }
        payload.ownerId = Number(value);
        return;
      }
      if (field.key === "companyId") {
        payload.companyId = value ? Number(value) : null;
        return;
      }
      if (field.key === "status") {
        payload.status = value || "NEW";
        return;
      }
      if (field.type === "number") {
        payload[field.key] = value ? Number(value) : null;
        return;
      }
      payload[field.key] = value || null;
    });

    if (hasError) return;

    const fieldPayload = visibleCustomFields.map((field) => ({
      fieldId: field.id,
      value: customValues[field.id] ?? "",
    }));

    payload.fieldValues = fieldPayload;

    const response = await fetch(
      editingItem ? `${apiPath}/${editingItem.id}` : apiPath,
      {
        method: editingItem ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "요청에 실패했습니다.");
      return;
    }

    await refreshAll();
    closeForm();
  };

  const removeItem = async (itemId: number) => {
    const response = await fetch(`${apiPath}/${itemId}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "삭제에 실패했습니다.");
      return;
    }
    await refreshAll();
  };

  const renderSystemValue = (item: ObjectItem, field: SystemField) => {
    if (field.key === "ownerId") return item.owner?.name ?? "";
    if (field.key === "companyId") {
      const companyId = item.companyId ? Number(item.companyId) : null;
      return companyId ? companyMap.get(companyId)?.name ?? "" : "";
    }
    if (field.key === "status") {
      const status = String(item.status ?? "");
      return LEAD_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
    }
    const raw = item[field.key];
    if (!raw) return "";
    if (field.type === "date") return dateToYMD(String(raw));
    if (field.type === "datetime") return dateTimeToLocal(String(raw));
    return String(raw);
  };

  const renderCustomValue = (item: ObjectItem, field: CustomField) => {
    const match = item.fieldValues.find((value) => value.fieldId === field.id);
    if (!match) return "";
    if (field.masked) return "••••";
    if (field.type === "text") return match.valueText ?? "";
    if (field.type === "number") return match.valueNumber?.toString() ?? "";
    if (field.type === "date") return match.valueDate ? dateToYMD(match.valueDate) : "";
    if (field.type === "datetime")
      return match.valueDateTime ? dateTimeToLocal(match.valueDateTime) : "";
    return "";
  };

  if (loading) {
    return <p className="text-sm text-zinc-800">로딩 중...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{OBJECT_TYPE_LABELS[objectType]}</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          {OBJECT_TYPE_LABELS[objectType]} 생성
        </button>
      </div>

      {error && !showForm && <p className="text-sm text-red-600">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-zinc-700">등록된 항목이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const lines = [
              ...listSystemFields.map((field) => ({
                label: field.label,
                value: renderSystemValue(item, field),
              })),
              ...listCustomFields.map((field) => ({
                label: field.label,
                value: renderCustomValue(item, field),
              })),
            ].filter((line) => line.value !== "");

            return (
              <div key={item.id} className="rounded border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    {OBJECT_TYPE_LABELS[objectType]} #{item.id}
                  </h2>
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="rounded border border-zinc-300 px-2 py-1"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded border border-zinc-300 px-2 py-1"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                {lines.length > 0 && (
                  <div className="mt-3 space-y-1 text-sm text-zinc-800">
                    {lines.map((line) => (
                      <div key={`${item.id}-${line.label}`}>
                        {line.label}: {line.value}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-xl rounded bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingItem ? "수정" : "생성"}</h2>
              <button
                type="button"
                onClick={closeForm}
                className="rounded border border-zinc-300 px-2 py-1 text-sm"
              >
                닫기
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              {createSystemFields.map((field) => {
                if (field.key === "ownerId") {
                  return (
                    <label key={field.key} className="flex flex-col gap-1 text-sm">
                      {field.label}
                      <select
                        value={baseValues[field.key] ?? ""}
                        onChange={(event) =>
                          setBaseValues((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                        required={field.required}
                        className="rounded border border-zinc-300 px-3 py-2"
                      >
                        {assignableUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.role})
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }

                if (field.key === "companyId") {
                  return (
                    <label key={field.key} className="flex flex-col gap-1 text-sm">
                      {field.label}
                      <select
                        value={baseValues[field.key] ?? ""}
                        onChange={(event) =>
                          setBaseValues((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                        className="rounded border border-zinc-300 px-3 py-2"
                      >
                        <option value="">선택 안 함</option>
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }

                if (field.key === "status") {
                  return (
                    <label key={field.key} className="flex flex-col gap-1 text-sm">
                      {field.label}
                      <select
                        value={baseValues[field.key] ?? "NEW"}
                        onChange={(event) =>
                          setBaseValues((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                        required={field.required}
                        className="rounded border border-zinc-300 px-3 py-2"
                      >
                        {LEAD_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }

                if (field.type === "date") {
                  return (
                    <label key={field.key} className="flex flex-col gap-1 text-sm">
                      {field.label}
                      <input
                        type="date"
                        value={baseValues[field.key] ?? ""}
                        onChange={(event) =>
                          setBaseValues((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                        required={field.required}
                        className="rounded border border-zinc-300 px-3 py-2"
                      />
                    </label>
                  );
                }

                if (field.type === "datetime") {
                  return (
                    <label key={field.key} className="flex flex-col gap-1 text-sm">
                      {field.label}
                      <input
                        type="datetime-local"
                        value={baseValues[field.key] ?? ""}
                        onChange={(event) =>
                          setBaseValues((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                        required={field.required}
                        className="rounded border border-zinc-300 px-3 py-2"
                      />
                    </label>
                  );
                }

                return (
                  <label key={field.key} className="flex flex-col gap-1 text-sm">
                    {field.label}
                    <input
                      type={field.type === "number" ? "number" : "text"}
                      value={baseValues[field.key] ?? ""}
                      onChange={(event) =>
                        setBaseValues((prev) => ({
                          ...prev,
                          [field.key]: event.target.value,
                        }))
                      }
                      required={field.required}
                      className="rounded border border-zinc-300 px-3 py-2"
                    />
                  </label>
                );
              })}

              {visibleCustomFields.length > 0 && (
                <div className="rounded border border-zinc-200 p-3">
                  <p className="text-sm font-semibold">커스텀 필드</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {visibleCustomFields.map((field) => (
                      <label key={field.id} className="flex flex-col gap-1 text-sm">
                        <span className="flex items-center gap-2">
                          {field.label}
                          {field.masked && (
                            <span className="text-xs text-zinc-500">마스킹</span>
                          )}
                        </span>
                        {field.type === "date" ? (
                          <input
                            type="date"
                            value={customValues[field.id] ?? ""}
                            onChange={(event) =>
                              setCustomValues((prev) => ({
                                ...prev,
                                [field.id]: event.target.value,
                              }))
                            }
                            required={field.required}
                            className="rounded border border-zinc-300 px-3 py-2"
                          />
                        ) : field.type === "datetime" ? (
                          <input
                            type="datetime-local"
                            value={customValues[field.id] ?? ""}
                            onChange={(event) =>
                              setCustomValues((prev) => ({
                                ...prev,
                                [field.id]: event.target.value,
                              }))
                            }
                            required={field.required}
                            className="rounded border border-zinc-300 px-3 py-2"
                          />
                        ) : (
                          <input
                            type={
                              field.masked && field.type === "text"
                                ? "password"
                                : field.type === "number"
                                  ? "number"
                                  : "text"
                            }
                            value={customValues[field.id] ?? ""}
                            onChange={(event) =>
                              setCustomValues((prev) => ({
                                ...prev,
                                [field.id]: event.target.value,
                              }))
                            }
                            required={field.required}
                            className="rounded border border-zinc-300 px-3 py-2"
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="button"
                onClick={submitForm}
                className="rounded bg-black px-4 py-2 text-sm text-white"
              >
                {editingItem ? "저장" : "생성"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
