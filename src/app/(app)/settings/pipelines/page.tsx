"use client";

import { useEffect, useMemo, useState } from "react";
import type { Pipeline } from "@/types/domain";

type StageDraft = {
  id: number;
  name: string;
  probability: string;
  description: string;
  stagnationDays: string;
  dealCount?: number;
};

export default function PipelineSettingsPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(
    null
  );
  const [newPipelineName, setNewPipelineName] = useState("");
  const [pipelineName, setPipelineName] = useState("");
  const [stages, setStages] = useState<StageDraft[]>([]);
  const [newStage, setNewStage] = useState({
    name: "",
    probability: "",
    description: "",
    stagnationDays: "",
  });
  const [message, setMessage] = useState<string | null>(null);

  const selectedPipeline = useMemo(
    () => pipelines.find((pipeline) => pipeline.id === selectedPipelineId),
    [pipelines, selectedPipelineId]
  );

  const refreshPipelines = async () => {
    const response = await fetch("/api/pipelines");
    if (!response.ok) return;
    const data = await response.json();
    setPipelines(data.pipelines);
    setSelectedPipelineId((prev) => {
      if (prev && data.pipelines.some((pipeline: Pipeline) => pipeline.id === prev)) {
        return prev;
      }
      return data.pipelines[0]?.id ?? null;
    });
  };

  useEffect(() => {
    refreshPipelines();
  }, []);

  useEffect(() => {
    if (!selectedPipeline) return;
    setPipelineName(selectedPipeline.name);
    setStages(
      selectedPipeline.stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        probability: stage.probability?.toString() ?? "",
        description: stage.description ?? "",
        stagnationDays: stage.stagnationDays?.toString() ?? "",
        dealCount: stage.dealCount,
      }))
    );
  }, [selectedPipeline]);

  const onCreatePipeline = async () => {
    if (!newPipelineName.trim()) return;
    const response = await fetch("/api/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPipelineName }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "파이프라인 생성에 실패했습니다.");
      return;
    }

    setNewPipelineName("");
    await refreshPipelines();
  };

  const onUpdatePipeline = async () => {
    if (!selectedPipeline) return;
    const response = await fetch(`/api/pipelines/${selectedPipeline.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pipelineName }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "파이프라인 수정에 실패했습니다.");
      return;
    }

    await refreshPipelines();
  };

  const onDeletePipeline = async () => {
    if (!selectedPipeline) return;
    const response = await fetch(`/api/pipelines/${selectedPipeline.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "파이프라인 삭제에 실패했습니다.");
      return;
    }

    setSelectedPipelineId(null);
    await refreshPipelines();
  };

  const onStageFieldChange = (
    stageId: number,
    patch: Partial<StageDraft>
  ) => {
    setStages((prev) =>
      prev.map((stage) =>
        stage.id === stageId ? { ...stage, ...patch } : stage
      )
    );
  };

  const onSaveStage = async (stageId: number) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage) return;

    const response = await fetch(`/api/stages/${stageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: stage.name,
        probability: stage.probability ? Number(stage.probability) : null,
        description: stage.description || null,
        stagnationDays: stage.stagnationDays
          ? Number(stage.stagnationDays)
          : null,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "스테이지 수정에 실패했습니다.");
      return;
    }

    await refreshPipelines();
  };

  const onAddStage = async () => {
    if (!selectedPipeline) return;
    if (!newStage.name.trim()) return;

    const response = await fetch(
      `/api/pipelines/${selectedPipeline.id}/stages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStage.name,
          probability: newStage.probability
            ? Number(newStage.probability)
            : null,
          description: newStage.description || null,
          stagnationDays: newStage.stagnationDays
            ? Number(newStage.stagnationDays)
            : null,
        }),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "스테이지 추가에 실패했습니다.");
      return;
    }

    setNewStage({ name: "", probability: "", description: "", stagnationDays: "" });
    await refreshPipelines();
  };

  const reorderStages = async (nextStages: StageDraft[]) => {
    if (!selectedPipeline) return;
    setStages(nextStages);
    await fetch(`/api/pipelines/${selectedPipeline.id}/stages/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: nextStages.map((stage) => stage.id) }),
    });
    await refreshPipelines();
  };

  const moveStage = (stageId: number, direction: "up" | "down") => {
    const index = stages.findIndex((stage) => stage.id === stageId);
    if (index < 0) return;
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= stages.length) return;
    const nextStages = [...stages];
    const [moved] = nextStages.splice(index, 1);
    nextStages.splice(nextIndex, 0, moved);
    reorderStages(nextStages);
  };

  const onDeleteStage = async (stageId: number) => {
    const response = await fetch(`/api/stages/${stageId}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "스테이지 삭제에 실패했습니다.");
      return;
    }
    await refreshPipelines();
  };

  const canDeletePipeline =
    selectedPipeline && selectedPipeline.dealCount === 0 && pipelines.length > 1;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">파이프라인 관리</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={newPipelineName}
            onChange={(event) => setNewPipelineName(event.target.value)}
            placeholder="새 파이프라인 이름"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={onCreatePipeline}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            생성
          </button>
        </div>
        {pipelines.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <label>선택</label>
            <select
              value={selectedPipelineId ?? ""}
              onChange={(event) =>
                setSelectedPipelineId(Number(event.target.value))
              }
              className="rounded border border-zinc-300 px-3 py-2"
            >
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
            <input
              value={pipelineName}
              onChange={(event) => setPipelineName(event.target.value)}
              className="rounded border border-zinc-300 px-3 py-2"
            />
            <button
              type="button"
              onClick={onUpdatePipeline}
              className="rounded border border-zinc-300 px-3 py-2"
            >
              이름 수정
            </button>
            <button
              type="button"
              disabled={!canDeletePipeline}
              onClick={onDeletePipeline}
              className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50"
            >
              삭제
            </button>
          </div>
        )}
        <p className="mt-2 text-sm text-zinc-700">
          딜이 존재하는 파이프라인은 삭제할 수 없습니다.
        </p>
      </section>

      {selectedPipeline && (
        <section className="rounded border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold">스테이지 관리</h2>
          <div className="mt-4 flex flex-col gap-4">
            {stages.map((stage, index) => {
              const canDeleteStage =
                (stage.dealCount ?? 0) === 0 && stages.length > 3;
              return (
                <div key={stage.id} className="rounded border border-zinc-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={stage.name}
                      onChange={(event) =>
                        onStageFieldChange(stage.id, { name: event.target.value })
                      }
                      className="rounded border border-zinc-300 px-2 py-1 text-sm"
                    />
                    <input
                      value={stage.probability}
                      onChange={(event) =>
                        onStageFieldChange(stage.id, {
                          probability: event.target.value,
                        })
                      }
                      type="number"
                      placeholder="가능성(%)"
                      className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm"
                    />
                    <input
                      value={stage.stagnationDays}
                      onChange={(event) =>
                        onStageFieldChange(stage.id, {
                          stagnationDays: event.target.value,
                        })
                      }
                      type="number"
                      placeholder="정체 기준일"
                      className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => moveStage(stage.id, "up")}
                      disabled={index === 0}
                      className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50"
                    >
                      위로
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStage(stage.id, "down")}
                      disabled={index === stages.length - 1}
                      className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50"
                    >
                      아래로
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveStage(stage.id)}
                      className="rounded border border-zinc-300 px-2 py-1 text-sm"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteStage(stage.id)}
                      disabled={!canDeleteStage}
                      className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                  <textarea
                    value={stage.description}
                    onChange={(event) =>
                      onStageFieldChange(stage.id, {
                        description: event.target.value,
                      })
                    }
                    placeholder="설명"
                    className="mt-2 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                    rows={2}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-6 rounded border border-zinc-200 p-3">
            <h3 className="text-sm font-semibold">스테이지 추가</h3>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={newStage.name}
                onChange={(event) =>
                  setNewStage((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="이름"
                className="rounded border border-zinc-300 px-2 py-1 text-sm"
              />
              <input
                value={newStage.probability}
                onChange={(event) =>
                  setNewStage((prev) => ({
                    ...prev,
                    probability: event.target.value,
                  }))
                }
                type="number"
                placeholder="가능성(%)"
                className="rounded border border-zinc-300 px-2 py-1 text-sm"
              />
              <input
                value={newStage.stagnationDays}
                onChange={(event) =>
                  setNewStage((prev) => ({
                    ...prev,
                    stagnationDays: event.target.value,
                  }))
                }
                type="number"
                placeholder="정체 기준일"
                className="rounded border border-zinc-300 px-2 py-1 text-sm"
              />
              <input
                value={newStage.description}
                onChange={(event) =>
                  setNewStage((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="설명"
                className="rounded border border-zinc-300 px-2 py-1 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={onAddStage}
              className="mt-3 rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              스테이지 추가
            </button>
            <p className="mt-2 text-sm text-zinc-700">
              딜이 없는 스테이지만 삭제할 수 있으며 최소 3개는 유지됩니다.
            </p>
          </div>
        </section>
      )}

      {message && <p className="text-sm text-red-600">{message}</p>}
    </div>
  );
}
