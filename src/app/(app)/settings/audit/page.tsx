"use client";

import { useEffect, useState } from "react";

type AuditLog = {
  id: number;
  entityType: string;
  entityId: number | null;
  action: string;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
  createdAt: string;
  actor?: { id: number; name: string; role: string };
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/audit-logs")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) {
          setError("로그를 불러오지 못했습니다.");
          return;
        }
        setLogs(data.logs ?? []);
      })
      .catch(() => setError("로그를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-zinc-800">로딩 중...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold">활동 로그</h1>
      <div className="mt-4 space-y-3">
        {logs.length === 0 && <p className="text-sm text-zinc-600">로그가 없습니다.</p>}
        {logs.map((log) => (
          <div
            key={log.id}
            className="rounded border border-zinc-200 px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
              <span>{formatDate(log.createdAt)}</span>
              <span>·</span>
              <span>
                {log.actor?.name ?? "알 수 없음"} ({log.actor?.role ?? "-"})
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs">
                {log.entityType}
              </span>
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs">
                {log.action}
              </span>
              {log.entityId !== null && (
                <span className="text-xs text-zinc-500">ID {log.entityId}</span>
              )}
            </div>
            {(log.before || log.after || log.meta) && (
              <pre className="mt-2 whitespace-pre-wrap rounded bg-zinc-50 p-3 text-xs text-zinc-700">
{JSON.stringify({ before: log.before, after: log.after, meta: log.meta }, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
