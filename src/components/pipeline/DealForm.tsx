"use client";

import { useEffect, useMemo, useState } from "react";
import type { CustomField, Stage, UserSummary } from "@/types/domain";

type DealFormProps = {
  open: boolean;
  onClose: () => void;
  pipelineId: number | null;
  stages: Stage[];
  fields: CustomField[];
  onCreated: () => void;
};

export function DealForm({
  open,
  onClose,
  pipelineId,
  stages,
  fields,
  onCreated,
}: DealFormProps) {
  const [name, setName] = useState("");
  const [expectedRevenue, setExpectedRevenue] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [stageId, setStageId] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [assignableUsers, setAssignableUsers] = useState<UserSummary[]>([]);
  const [customValues, setCustomValues] = useState<Record<number, string>>({});
  const [customBoolValues, setCustomBoolValues] = useState<Record<number, boolean>>({});
  const [customMultiValues, setCustomMultiValues] = useState<Record<number, number[]>>({});
  const [customUserValues, setCustomUserValues] = useState<Record<number, number[]>>({});
  const [customFiles, setCustomFiles] = useState<Record<number, File[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const visibleFields = useMemo(
    () => fields.filter((field) => field.visibleInCreate),
    [fields]
  );

  useEffect(() => {
    if (!open) return;
    fetch("/api/users/assignable")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.users) setAssignableUsers(data.users);
      })
      .catch(() => null);
  }, [open]);

  useEffect(() => {
    if (assignableUsers.length > 0 && !ownerId) {
      setOwnerId(String(assignableUsers[0].id));
    }
  }, [assignableUsers, ownerId]);

  useEffect(() => {
    if (!open) return;
    setStageId(stages[0]?.id ? String(stages[0].id) : "");
  }, [open, stages]);

  useEffect(() => {
    if (!open) return;
    setCustomValues({});
    setCustomBoolValues({});
    setCustomMultiValues({});
    setCustomUserValues({});
    setCustomFiles({});
    setError(null);
    setWarning(null);
  }, [open]);

  if (!open) return null;

  const updateMultiValue = (fieldId: number, value: number) => {
    setCustomMultiValues((prev) => {
      const list = prev[fieldId] ?? [];
      const exists = list.includes(value);
      const next = exists ? list.filter((id) => id !== value) : [...list, value];
      return { ...prev, [fieldId]: next };
    });
  };

  const updateUserMultiValue = (fieldId: number, value: number) => {
    setCustomUserValues((prev) => {
      const list = prev[fieldId] ?? [];
      const exists = list.includes(value);
      const next = exists ? list.filter((id) => id !== value) : [...list, value];
      return { ...prev, [fieldId]: next };
    });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pipelineId) return;
    if (!ownerId && assignableUsers.length === 0) {
      setError("담당자 정보를 불러올 수 없습니다.");
      return;
    }
    setLoading(true);
    setError(null);
    setWarning(null);

    const fieldPayload = visibleFields
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

    const payload = {
      name,
      pipelineId,
      stageId: Number(stageId),
      ownerId: Number(ownerId || assignableUsers[0]?.id),
      expectedRevenue: expectedRevenue ? Number(expectedRevenue) : null,
      closeDate: closeDate || null,
      fieldValues: fieldPayload,
    };

    const hasFiles = Object.values(customFiles).some((files) => files.length > 0);
    const response = await fetch("/api/deals", {
      method: "POST",
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
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "딜 생성에 실패했습니다.");
      setLoading(false);
      return;
    }

    const data = await response.json().catch(() => null);
    if (data?.warnings?.length) {
      const message = data.warnings.join("\n");
      setWarning(message);
      if (typeof window !== "undefined") {
        window.alert(message);
      }
    }

    setName("");
    setExpectedRevenue("");
    setCloseDate("");
    setCustomValues({});
    setCustomBoolValues({});
    setCustomMultiValues({});
    setCustomUserValues({});
    setCustomFiles({});
    setOwnerId("");
    setStageId(stages[0]?.id ? String(stages[0].id) : "");
    setLoading(false);
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-xl rounded bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">딜 생성</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
          >
            닫기
          </button>
        </div>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            딜 이름
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              type="text"
              required
              className="rounded border border-zinc-300 px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              예상 매출
              <input
                value={expectedRevenue}
                onChange={(event) => setExpectedRevenue(event.target.value)}
                type="number"
                step="any"
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              마감일
              <input
                value={closeDate}
                onChange={(event) => setCloseDate(event.target.value)}
                type="date"
                className="rounded border border-zinc-300 px-3 py-2"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              스테이지
              <select
                value={stageId}
                onChange={(event) => setStageId(event.target.value)}
                className="rounded border border-zinc-300 px-3 py-2"
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              담당자
              <select
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
                className="rounded border border-zinc-300 px-3 py-2"
              >
                {assignableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {visibleFields.length > 0 && (
            <div className="rounded border border-zinc-200 p-3">
              <p className="text-sm font-semibold">커스텀 필드</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visibleFields.map((field) => {
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
                                onChange={() => updateMultiValue(field.id, option.id)}
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
                                onChange={() => updateUserMultiValue(field.id, user.id)}
                              />
                              {user.name} ({user.role})
                            </label>
                          ))}
                          {assignableUsers.length === 0 && (
                            <span className="text-xs text-zinc-500">사용자 정보가 없습니다.</span>
                          )}
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
          {warning && <p className="text-sm text-amber-600 whitespace-pre-line">{warning}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? "생성 중..." : "딜 생성"}
          </button>
        </form>
      </div>
    </div>
  );
}
