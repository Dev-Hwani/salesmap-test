"use client";

import { useEffect, useMemo, useState } from "react";
import type { Team, UserSummary } from "@/types/domain";

type UserRow = UserSummary & { email?: string; managerId?: number | null; teamId?: number | null };

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    const [teamsRes, usersRes] = await Promise.all([fetch("/api/teams"), fetch("/api/users")]);

    if (!teamsRes.ok || !usersRes.ok) {
      setError("팀 정보를 불러오지 못했습니다.");
      setLoading(false);
      return;
    }

    const teamsData = await teamsRes.json();
    const usersData = await usersRes.json();
    setTeams(teamsData.teams ?? []);
    setUsers(usersData.users ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, []);

  const memberCountMap = useMemo(() => {
    const map = new Map<number, number>();
    users.forEach((user) => {
      if (!user.teamId) return;
      map.set(user.teamId, (map.get(user.teamId) ?? 0) + 1);
    });
    return map;
  }, [users]);

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    const response = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTeamName.trim() }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "팀 생성에 실패했습니다.");
      return;
    }
    setNewTeamName("");
    await refresh();
  };

  const startEdit = (team: Team) => {
    setEditingTeamId(team.id);
    setEditingTeamName(team.name);
  };

  const saveEdit = async () => {
    if (!editingTeamId) return;
    const response = await fetch(`/api/teams/${editingTeamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingTeamName.trim() }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "팀 수정에 실패했습니다.");
      return;
    }
    setEditingTeamId(null);
    setEditingTeamName("");
    await refresh();
  };

  const removeTeam = async (teamId: number) => {
    const response = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "팀 삭제에 실패했습니다.");
      return;
    }
    await refresh();
  };

  const updateUserTeam = async (userId: number, teamId: string) => {
    const nextId = teamId ? Number(teamId) : null;
    const response = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: nextId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "팀 배정에 실패했습니다.");
      return;
    }
    await refresh();
  };

  if (loading) {
    return <p className="text-sm text-zinc-800">로딩 중...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">팀 관리</h1>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={newTeamName}
            onChange={(event) => setNewTeamName(event.target.value)}
            placeholder="새 팀 이름"
            className="w-64 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={createTeam}
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
          >
            팀 생성
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 space-y-3">
          {teams.length === 0 && <p className="text-sm text-zinc-600">등록된 팀이 없습니다.</p>}
          {teams.map((team) => {
            const memberCount = memberCountMap.get(team.id) ?? 0;
            const isEditing = editingTeamId === team.id;
            return (
              <div
                key={team.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-zinc-200 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {isEditing ? (
                    <input
                      value={editingTeamName}
                      onChange={(event) => setEditingTeamName(event.target.value)}
                      className="rounded border border-zinc-300 px-3 py-1 text-sm"
                    />
                  ) : (
                    <div className="text-sm font-medium">{team.name}</div>
                  )}
                  <span className="text-xs text-zinc-500">멤버 {memberCount}명</span>
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="rounded border border-zinc-300 px-2 py-1 text-sm"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTeamId(null);
                          setEditingTeamName("");
                        }}
                        className="rounded border border-zinc-300 px-2 py-1 text-sm"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(team)}
                        className="rounded border border-zinc-300 px-2 py-1 text-sm"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTeam(team.id)}
                        className="rounded border border-zinc-300 px-2 py-1 text-sm"
                        disabled={memberCount > 0}
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">사용자 팀 배정</h2>
        <div className="mt-4 space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-zinc-200 px-4 py-3"
            >
              <div className="text-sm">
                {user.name} ({user.role})
              </div>
              <select
                value={user.teamId ? String(user.teamId) : ""}
                onChange={(event) => updateUserTeam(user.id, event.target.value)}
                className="rounded border border-zinc-300 px-3 py-1 text-sm"
              >
                <option value="">팀 없음</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
