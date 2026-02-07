
"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Company,
  CustomField,
  FieldFile,
  FieldOptionValue,
  FieldUserValue,
  Pipeline,
  ObjectType,
  UserSummary,
} from "@/types/domain";
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
    valueBoolean?: boolean | null;
    valueUserId?: number | null;
    valueOptionId?: number | null;
    valueUser?: UserSummary | null;
    valueOption?: { id: number; label: string } | null;
  }>;
  optionValues?: FieldOptionValue[];
  userValues?: FieldUserValue[];
  files?: FieldFile[];
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
  const [warning, setWarning] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ObjectItem | null>(null);
  const [baseValues, setBaseValues] = useState<Record<string, string>>({});
  const [customValues, setCustomValues] = useState<Record<number, string>>({});
  const [customBoolValues, setCustomBoolValues] = useState<Record<number, boolean>>({});
  const [customMultiValues, setCustomMultiValues] = useState<Record<number, number[]>>({});
  const [customUserValues, setCustomUserValues] = useState<Record<number, number[]>>({});
  const [customFiles, setCustomFiles] = useState<Record<number, File[]>>({});
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [convertTarget, setConvertTarget] = useState<ObjectItem | null>(null);
  const [convertPipelineId, setConvertPipelineId] = useState("");
  const [convertStageId, setConvertStageId] = useState("");

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

  const userMap = useMemo(() => {
    const map = new Map<number, UserSummary>();
    assignableUsers.forEach((user) => map.set(user.id, user));
    return map;
  }, [assignableUsers]);

  const selectedConvertPipeline = useMemo(() => {
    if (!convertPipelineId) return null;
    return pipelines.find((pipeline) => pipeline.id === Number(convertPipelineId)) ?? null;
  }, [pipelines, convertPipelineId]);

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

  const loadPipelines = async () => {
    const response = await fetch("/api/pipelines");
    if (!response.ok) return [] as Pipeline[];
    const data = await response.json();
    const list = data.pipelines ?? [];
    setPipelines(list);
    return list as Pipeline[];
  };

  const openConvert = async (item: ObjectItem) => {
    setError(null);
    setWarning(null);
    setConvertTarget(item);
    const list = pipelines.length > 0 ? pipelines : await loadPipelines();
    const first = list[0];
    if (first) {
      setConvertPipelineId(String(first.id));
      setConvertStageId(first.stages[0]?.id ? String(first.stages[0].id) : "");
    } else {
      setConvertPipelineId("");
      setConvertStageId("");
    }
  };

  const closeConvert = () => {
    setConvertTarget(null);
    setConvertPipelineId("");
    setConvertStageId("");
  };

  useEffect(() => {
    refreshAll().catch(() => setLoading(false));
  }, [objectType, apiPath]);

  useEffect(() => {
    if (objectType !== "LEAD") {
      closeConvert();
    }
  }, [objectType]);

  useEffect(() => {
    if (!selectedConvertPipeline) return;
    const current = Number(convertStageId);
    const exists = selectedConvertPipeline.stages.some((stage) => stage.id === current);
    if (!exists) {
      setConvertStageId(
        selectedConvertPipeline.stages[0]?.id
          ? String(selectedConvertPipeline.stages[0].id)
          : ""
      );
    }
  }, [selectedConvertPipeline, convertStageId]);
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
    setCustomBoolValues({});
    setCustomMultiValues({});
    setCustomUserValues({});
    setCustomFiles({});
    setWarning(null);
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
    setWarning(null);
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
    const nextCustomBoolValues: Record<number, boolean> = {};
    const nextCustomMultiValues: Record<number, number[]> = {};
    const nextCustomUserValues: Record<number, number[]> = {};

    visibleCustomFields.forEach((field) => {
      const match = item.fieldValues.find((value) => value.fieldId === field.id);
      if (field.type === "text") {
        nextCustomValues[field.id] = match?.valueText ?? "";
      }
      if (field.type === "number") {
        nextCustomValues[field.id] = match?.valueNumber?.toString() ?? "";
      }
      if (field.type === "date") {
        nextCustomValues[field.id] = match?.valueDate ? dateToYMD(match.valueDate) : "";
      }
      if (field.type === "datetime") {
        nextCustomValues[field.id] = match?.valueDateTime
          ? dateTimeToLocal(match.valueDateTime)
          : "";
      }
      if (field.type === "boolean") {
        if (match?.valueBoolean !== null && match?.valueBoolean !== undefined) {
          nextCustomBoolValues[field.id] = match.valueBoolean;
        }
      }
      if (field.type === "single_select") {
        nextCustomValues[field.id] = match?.valueOptionId ? String(match.valueOptionId) : "";
      }
      if (field.type === "user") {
        nextCustomValues[field.id] = match?.valueUserId ? String(match.valueUserId) : "";
      }
      if (field.type === "multi_select") {
        const values = item.optionValues
          ?.filter((value) => value.fieldId === field.id)
          .map((value) => value.optionId) ?? [];
        nextCustomMultiValues[field.id] = values;
      }
      if (field.type === "users") {
        const values = item.userValues
          ?.filter((value) => value.fieldId === field.id)
          .map((value) => value.userId) ?? [];
        nextCustomUserValues[field.id] = values;
      }
    });

    setBaseValues(defaults);
    setCustomValues(nextCustomValues);
    setCustomBoolValues(nextCustomBoolValues);
    setCustomMultiValues(nextCustomMultiValues);
    setCustomUserValues(nextCustomUserValues);
    setCustomFiles({});
    setShowForm(true);
    setError(null);
    setWarning(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  const submitForm = async () => {
    setError(null);
    setWarning(null);
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

    const fieldPayload = visibleCustomFields
      .filter((field) => field.type !== "file" && field.type !== "calculation")
      .map((field) => {
        if (field.type === "multi_select") {
          return { fieldId: field.id, value: customMultiValues[field.id] ?? [] };
        }
        if (field.type === "users") {
          return { fieldId: field.id, value: customUserValues[field.id] ?? [] };
        }
        if (field.type === "boolean") {
          const boolValue = customBoolValues[field.id];
          return { fieldId: field.id, value: boolValue ?? null };
        }
        return { fieldId: field.id, value: customValues[field.id] ?? "" };
      });

    payload.fieldValues = fieldPayload;

    const hasFiles = Object.values(customFiles).some((files) => files.length > 0);
    const response = await fetch(
      editingItem ? `${apiPath}/${editingItem.id}` : apiPath,
      {
        method: editingItem ? "PATCH" : "POST",
        headers: hasFiles ? undefined : { "Content-Type": "application/json" },
        body: hasFiles
          ? (() => {
              const formData = new FormData();
              formData.append("payload", JSON.stringify(payload));
              Object.entries(customFiles).forEach(([fieldId, files]) => {
                files.forEach((file) => formData.append(`file-${fieldId}`, file));
              });
              return formData;
            })()
          : JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "요청에 실패했습니다.");
      return;
    }

    const data = await response.json().catch(() => null);
    if (data?.warnings?.length) {
      setWarning(data.warnings.join("\n"));
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

  const removeFile = async (file: FieldFile) => {
    const response = await fetch(`/api/files/${objectType}/${file.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "파일 삭제에 실패했습니다.");
      return;
    }
    await refreshAll();
  };

  const convertLead = async () => {
    if (!convertTarget) return;
    if (!convertPipelineId || !convertStageId) {
      setError("파이프라인과 스테이지를 선택해주세요.");
      return;
    }
    const response = await fetch(`/api/leads/${convertTarget.id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pipelineId: Number(convertPipelineId),
        stageId: Number(convertStageId),
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "딜 전환에 실패했습니다.");
      return;
    }
    closeConvert();
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
    if (field.masked) return "????";
    if (field.type === "text") return match?.valueText ?? "";
    if (field.type === "number") return match?.valueNumber?.toString() ?? "";
    if (field.type === "date") return match?.valueDate ? dateToYMD(match.valueDate) : "";
    if (field.type === "datetime")
      return match?.valueDateTime ? dateTimeToLocal(match.valueDateTime) : "";
    if (field.type === "boolean") {
      if (match?.valueBoolean === null || match?.valueBoolean === undefined) return "";
      return match.valueBoolean ? "예" : "아니오";
    }
    if (field.type === "single_select") {
      if (!match?.valueOptionId) return "";
      return field.options?.find((option) => option.id === match.valueOptionId)?.label ?? "";
    }
    if (field.type === "multi_select") {
      const options = item.optionValues
        ?.filter((value) => value.fieldId === field.id)
        .map((value) => value.option?.label ?? "")
        .filter(Boolean);
      return options && options.length > 0 ? options.join(", ") : "";
    }
    if (field.type === "user") {
      const user = match?.valueUser ?? (match?.valueUserId ? userMap.get(match.valueUserId) : null);
      return user?.name ?? "";
    }
    if (field.type === "users") {
      const names = item.userValues
        ?.filter((value) => value.fieldId === field.id)
        .map((value) => value.user?.name ?? "")
        .filter(Boolean);
      return names && names.length > 0 ? names.join(", ") : "";
    }
    if (field.type === "calculation") {
      return match?.valueNumber?.toString() ?? "";
    }
    if (field.type === "file") {
      const count = item.files?.filter((file) => file.fieldId === field.id).length ?? 0;
      return count > 0 ? `파일 ${count}개` : "";
    }
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
      {warning && !showForm && (
        <p className="text-sm whitespace-pre-line text-amber-600">{warning}</p>
      )}

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
                    {objectType === "LEAD" && (
                      <button
                        type="button"
                        onClick={() => openConvert(item)}
                        disabled={Number(item.dealCount ?? 0) > 0}
                        className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50"
                      >
                        {Number(item.dealCount ?? 0) > 0 ? "전환 완료" : "딜 전환"}
                      </button>
                    )}
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
                {item.files && item.files.length > 0 && (
                  <div className="mt-3 text-sm">
                    <p className="font-semibold">파일</p>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-700">
                      {item.files.map((file) => (
                        <li key={file.id} className="flex items-center gap-2">
                          <a
                            href={`/api/files/${objectType}/${file.id}`}
                            className="underline"
                          >
                            {file.originalName}
                          </a>
                          <button
                            type="button"
                            onClick={() => removeFile(file)}
                            className="text-xs text-red-600"
                          >
                            삭제
                          </button>
                        </li>
                      ))}
                    </ul>
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
                      step={field.type === "number" ? "any" : undefined}
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
                    {visibleCustomFields.map((field) => {
                      const labelNode = (
                        <span className="flex items-center gap-2">
                          {field.label}
                          {field.masked && (
                            <span className="text-xs text-zinc-500">마스킹</span>
                          )}
                        </span>
                      );

                      if (field.type === "date") {
                        return (
                          <label key={field.id} className="flex flex-col gap-1 text-sm">
                            {labelNode}
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
                          </label>
                        );
                      }

                      if (field.type === "datetime") {
                        return (
                          <label key={field.id} className="flex flex-col gap-1 text-sm">
                            {labelNode}
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
                          </label>
                        );
                      }

                      if (field.type === "single_select") {
                        return (
                          <label key={field.id} className="flex flex-col gap-1 text-sm">
                            {labelNode}
                            <select
                              value={customValues[field.id] ?? ""}
                              onChange={(event) =>
                                setCustomValues((prev) => ({
                                  ...prev,
                                  [field.id]: event.target.value,
                                }))
                              }
                              required={field.required}
                              className="rounded border border-zinc-300 px-3 py-2"
                            >
                              <option value="">선택</option>
                              {field.options?.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      }

                      if (field.type === "multi_select") {
                        const selected = customMultiValues[field.id] ?? [];
                        return (
                          <div key={field.id} className="flex flex-col gap-2 text-sm">
                            {labelNode}
                            <div className="flex flex-col gap-1 rounded border border-zinc-200 p-2">
                              {field.options?.map((option) => (
                                <label key={option.id} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={selected.includes(option.id)}
                                    onChange={() => {
                                      setCustomMultiValues((prev) => {
                                        const list = prev[field.id] ?? [];
                                        const exists = list.includes(option.id);
                                        const next = exists
                                          ? list.filter((id) => id !== option.id)
                                          : [...list, option.id];
                                        return { ...prev, [field.id]: next };
                                      });
                                    }}
                                  />
                                  {option.label}
                                </label>
                              ))}
                              {(!field.options || field.options.length === 0) && (
                                <span className="text-xs text-zinc-500">옵션이 없습니다.</span>
                              )}
                            </div>
                          </div>
                        );
                      }

                      if (field.type === "boolean") {
                        return (
                          <label key={field.id} className="flex flex-col gap-1 text-sm">
                            {labelNode}
                            <select
                              value={
                                customBoolValues[field.id] === undefined
                                  ? ""
                                  : customBoolValues[field.id]
                                    ? "true"
                                    : "false"
                              }
                              onChange={(event) =>
                                setCustomBoolValues((prev) => ({
                                  ...prev,
                                  [field.id]: event.target.value === "true",
                                }))
                              }
                              required={field.required}
                              className="rounded border border-zinc-300 px-3 py-2"
                            >
                              <option value="">선택</option>
                              <option value="true">예</option>
                              <option value="false">아니오</option>
                            </select>
                          </label>
                        );
                      }

                      if (field.type === "user") {
                        return (
                          <label key={field.id} className="flex flex-col gap-1 text-sm">
                            {labelNode}
                            <select
                              value={customValues[field.id] ?? ""}
                              onChange={(event) =>
                                setCustomValues((prev) => ({
                                  ...prev,
                                  [field.id]: event.target.value,
                                }))
                              }
                              required={field.required}
                              className="rounded border border-zinc-300 px-3 py-2"
                            >
                              <option value="">선택</option>
                              {assignableUsers.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.name} ({user.role})
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      }

                      if (field.type === "users") {
                        const selected = customUserValues[field.id] ?? [];
                        return (
                          <div key={field.id} className="flex flex-col gap-2 text-sm">
                            {labelNode}
                            <div className="flex flex-col gap-1 rounded border border-zinc-200 p-2">
                              {assignableUsers.map((user) => (
                                <label key={user.id} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={selected.includes(user.id)}
                                    onChange={() => {
                                      setCustomUserValues((prev) => {
                                        const list = prev[field.id] ?? [];
                                        const exists = list.includes(user.id);
                                        const next = exists
                                          ? list.filter((id) => id !== user.id)
                                          : [...list, user.id];
                                        return { ...prev, [field.id]: next };
                                      });
                                    }}
                                  />
                                  {user.name} ({user.role})
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      if (field.type === "file") {
                        const files = customFiles[field.id] ?? [];
                        return (
                          <div key={field.id} className="flex flex-col gap-2 text-sm">
                            {labelNode}
                            <input
                              type="file"
                              multiple
                              onChange={(event) => {
                                const list = event.target.files
                                  ? Array.from(event.target.files)
                                  : [];
                                setCustomFiles((prev) => ({ ...prev, [field.id]: list }));
                              }}
                              className="text-sm"
                            />
                            {files.length > 0 && (
                              <ul className="text-xs text-zinc-600">
                                {files.map((file) => (
                                  <li key={file.name}>{file.name}</li>
                                ))}
                              </ul>
                            )}
                            {editingItem && editingItem.files && (
                              <ul className="text-xs text-zinc-700">
                                {editingItem.files
                                  .filter((file) => file.fieldId === field.id)
                                  .map((file) => (
                                    <li key={file.id} className="flex items-center gap-2">
                                      <a
                                        href={`/api/files/${objectType}/${file.id}`}
                                        className="underline"
                                      >
                                        {file.originalName}
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => removeFile(file)}
                                        className="text-xs text-red-600"
                                      >
                                        삭제
                                      </button>
                                    </li>
                                  ))}
                              </ul>
                            )}
                          </div>
                        );
                      }

                      if (field.type === "calculation") {
                        return (
                          <label key={field.id} className="flex flex-col gap-1 text-sm">
                            {labelNode}
                            <input
                              type="text"
                              value="자동 계산"
                              disabled
                              className="rounded border border-zinc-200 bg-zinc-100 px-3 py-2 text-zinc-600"
                            />
                          </label>
                        );
                      }

                      return (
                        <label key={field.id} className="flex flex-col gap-1 text-sm">
                          {labelNode}
                          <input
                            type={
                              field.masked && field.type === "text"
                                ? "password"
                                : field.type === "number"
                                  ? "number"
                                  : "text"
                            }
                            step={field.type === "number" ? "any" : undefined}
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
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {warning && (
                <p className="text-sm whitespace-pre-line text-amber-600">{warning}</p>
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

      {convertTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">딜 전환</h2>
              <button
                type="button"
                onClick={closeConvert}
                className="rounded border border-zinc-300 px-2 py-1 text-sm"
              >
                닫기
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <div>
                <span className="text-zinc-500">리드</span>
                <div className="font-medium">{String(convertTarget.name ?? "")}</div>
              </div>
              <label className="flex flex-col gap-1">
                파이프라인
                <select
                  value={convertPipelineId}
                  onChange={(event) => setConvertPipelineId(event.target.value)}
                  className="rounded border border-zinc-300 px-3 py-2"
                >
                  {pipelines.map((pipeline) => (
                    <option key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                스테이지
                <select
                  value={convertStageId}
                  onChange={(event) => setConvertStageId(event.target.value)}
                  className="rounded border border-zinc-300 px-3 py-2"
                >
                  {selectedConvertPipeline?.stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={convertLead}
                  disabled={!convertPipelineId || !convertStageId}
                  className="rounded bg-black px-4 py-2 text-sm text-white"
                >
                  딜 전환
                </button>
                <button
                  type="button"
                  onClick={closeConvert}
                  className="rounded border border-zinc-300 px-4 py-2 text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


