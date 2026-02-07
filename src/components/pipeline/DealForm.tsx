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
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
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

  if (!open) return null;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pipelineId) return;
    if (!ownerId && assignableUsers.length === 0) {
      setError("담당자 정보를 불러올 수 없습니다.");
      return;
    }
    setLoading(true);
    setError(null);

    const fieldPayload = visibleFields.map((field) => ({
      fieldId: field.id,
      value: fieldValues[String(field.id)] ?? "",
    }));

    const response = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        pipelineId,
        stageId: Number(stageId),
        ownerId: Number(ownerId || assignableUsers[0]?.id),
        expectedRevenue: expectedRevenue ? Number(expectedRevenue) : null,
        closeDate: closeDate || null,
        fieldValues: fieldPayload,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "딜 생성에 실패했습니다.");
      setLoading(false);
      return;
    }

    setName("");
    setExpectedRevenue("");
    setCloseDate("");
    setFieldValues({});
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
                {visibleFields.map((field) => (
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
                        value={fieldValues[String(field.id)] ?? ""}
                        onChange={(event) =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [String(field.id)]: event.target.value,
                          }))
                        }
                        required={field.required}
                        className="rounded border border-zinc-300 px-3 py-2"
                      />
                    ) : field.type === "datetime" ? (
                      <input
                        type="datetime-local"
                        value={fieldValues[String(field.id)] ?? ""}
                        onChange={(event) =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [String(field.id)]: event.target.value,
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
                        value={fieldValues[String(field.id)] ?? ""}
                        onChange={(event) =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [String(field.id)]: event.target.value,
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
