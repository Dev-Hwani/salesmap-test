"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ManagerOption = { id: number; name: string; email: string };

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"A" | "B" | "C">("A");
  const [managerId, setManagerId] = useState<string>("");
  const [hasUsers, setHasUsers] = useState(false);
  const [managersForB, setManagersForB] = useState<ManagerOption[]>([]);
  const [managersForC, setManagersForC] = useState<ManagerOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/signup-context")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setHasUsers(data.hasUsers);
        setManagersForB(data.managersForB || []);
        setManagersForC(data.managersForC || []);
        if (data.hasUsers) {
          setRole("A");
        }
      })
      .catch(() => null);
  }, []);

  const managerOptions = useMemo(() => {
    if (role === "B") return managersForB;
    if (role === "C") return managersForC;
    return [];
  }, [role, managersForB, managersForC]);

  const isRoleDisabled = (nextRole: "A" | "B" | "C") => {
    if (!hasUsers) return nextRole !== "A";
    if (nextRole === "B") return managersForB.length === 0;
    if (nextRole === "C") return managersForC.length === 0;
    return false;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name,
      email,
      password,
    };

    if (hasUsers) {
      payload.role = role;
      if (role !== "A") {
        payload.managerId = managerId ? Number(managerId) : null;
      }
    }

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "회원가입에 실패했습니다.");
      setLoading(false);
      return;
    }

    window.location.href = "/pipeline";
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">회원가입</h1>
          <p className="text-sm text-black/70">세일즈맵 계정을 생성합니다.</p>
        </div>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            이름
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              type="text"
              required
              className="rounded border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="홍길동"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            이메일
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              className="rounded border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="you@example.com"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            비밀번호
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              className="rounded border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="4자리 이상"
            />
          </label>
          <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm text-black/70">
            {!hasUsers ? (
              "처음 가입하는 사용자는 별도 선택 없이 A 역할로 설정됩니다."
            ) : (
              <>
                <span className="block">사용자 역할을 선택해주세요.</span>
                <span className="block">
                  역할에 따라 접근 권한이 달라집니다.
                </span>
              </>
            )}
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium">
            역할
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as "A" | "B" | "C")
              }
              disabled={!hasUsers}
              className="rounded border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
            >
              <option value="A" disabled={isRoleDisabled("A")}>
                A
              </option>
              <option value="B" disabled={isRoleDisabled("B")}>
                B
              </option>
              <option value="C" disabled={isRoleDisabled("C")}>
                C
              </option>
            </select>
          </label>
          {hasUsers && role !== "A" && (
            <label className="flex flex-col gap-2 text-sm font-medium">
              매니저
              <select
                value={managerId}
                onChange={(event) => setManagerId(event.target.value)}
                required
                className="rounded border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                <option value="">선택하세요</option>
                {managerOptions.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name} ({manager.email})
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>
        <div className="mt-6 border-t border-zinc-200 pt-4 text-sm">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-medium underline">
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
