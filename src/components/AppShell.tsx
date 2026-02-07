"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type UserInfo = {
  id: number;
  name: string;
  role: string;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => null);
  }, []);

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
            <Link href="/pipeline">딜 파이프라인</Link>
            <Link href="/leads">리드</Link>
            <Link href="/contacts">고객</Link>
            <Link href="/companies">회사</Link>
            <Link href="/settings/pipelines">파이프라인 설정</Link>
            <Link href="/settings/fields">커스텀 필드</Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-800">
              {user ? `${user.name} (${user.role})` : "로딩 중..."}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded border border-zinc-300 px-3 py-1 text-sm"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
