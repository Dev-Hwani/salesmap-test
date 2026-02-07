"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Pipeline } from "@/types/domain";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type StageDraft = {
  id: number;
  name: string;
  probability: string;
  description: string;
  stagnationDays: string;
  dealCount?: number;
};

type StageFormState = {
  name: string;
  probability: string;
  description: string;
  stagnationDays: string;
};

const emptyStage: StageFormState = {
  name: "",
  probability: "",
  description: "",
  stagnationDays: "",
};

type StageCardProps = {
  stage: StageDraft;
  onChange: (patch: Partial<StageDraft>) => void;
  onSave: () => void;
  onDelete: () => void;
  canDelete: boolean;
};

function SortableStageCard({ stage, onChange, onSave, onDelete, canDelete }: StageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab rounded border border-zinc-300 px-2 py-1 text-xs"
        >
          드래그
        </button>
        <input
          value={stage.name}
          onChange={(event) => onChange({ name: event.target.value })}
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        />
        <input
          value={stage.probability}
          onChange={(event) => onChange({ probability: event.target.value })}
          type="number"
          placeholder="가능성(%)"
          className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm"
        />
        <input
          value={stage.stagnationDays}
          onChange={(event) => onChange({ stagnationDays: event.target.value })}
          type="number"
          placeholder="정체 기준일"
          className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm"
        />
        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
          딜 {stage.dealCount ?? 0}개
        </span>
        <button
          type="button"
          onClick={onSave}
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50"
        >
          삭제
        </button>
      </div>
      <textarea
        value={stage.description}
        onChange={(event) => onChange({ description: event.target.value })}
        placeholder="설명"
        className="mt-2 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
        rows={2}
      />
    </div>
  );
}

export default function PipelineSettingsPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(
    null
  );
  const [newPipelineName, setNewPipelineName] = useState("");
  const [pipelineName, setPipelineName] = useState("");
  const [stages, setStages] = useState<StageDraft[]>([]);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [insertStage, setInsertStage] = useState<StageFormState>(emptyStage);
  const [message, setMessage] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  const onStageFieldChange = (stageId: number, patch: Partial<StageDraft>) => {
    setStages((prev) =>
      prev.map((stage) => (stage.id === stageId ? { ...stage, ...patch } : stage))
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
        stagnationDays: stage.stagnationDays ? Number(stage.stagnationDays) : null,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "스테이지 수정에 실패했습니다.");
      return;
    }

    await refreshPipelines();
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

  const openInsert = (index: number) => {
    setInsertIndex(index);
    setInsertStage(emptyStage);
  };

  const onInsertStage = async () => {
    if (!selectedPipeline || insertIndex === null) return;
    if (!insertStage.name.trim()) return;

    const response = await fetch(`/api/pipelines/${selectedPipeline.id}/stages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: insertStage.name,
        probability: insertStage.probability ? Number(insertStage.probability) : null,
        description: insertStage.description || null,
        stagnationDays: insertStage.stagnationDays ? Number(insertStage.stagnationDays) : null,
        position: insertIndex,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "스테이지 추가에 실패했습니다.");
      return;
    }

    setInsertIndex(null);
    setInsertStage(emptyStage);
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

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stages.findIndex((stage) => stage.id === active.id);
    const newIndex = stages.findIndex((stage) => stage.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextStages = arrayMove(stages, oldIndex, newIndex);
    reorderStages(nextStages);
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
              onChange={(event) => setSelectedPipelineId(Number(event.target.value))}
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
          <p className="mt-1 text-xs text-zinc-600">드래그로 순서를 변경할 수 있습니다.</p>
          <div className="mt-4 flex flex-col gap-4">
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <SortableContext items={stages.map((stage) => stage.id)} strategy={verticalListSortingStrategy}>
                {stages.map((stage, index) => {
                  const canDeleteStage = (stage.dealCount ?? 0) === 0 && stages.length > 3;
                  return (
                    <div key={stage.id} className="flex flex-col gap-2">
                      <SortableStageCard
                        stage={stage}
                        onChange={(patch) => onStageFieldChange(stage.id, patch)}
                        onSave={() => onSaveStage(stage.id)}
                        onDelete={() => onDeleteStage(stage.id)}
                        canDelete={canDeleteStage}
                      />
                      <button
                        type="button"
                        onClick={() => openInsert(index + 1)}
                        className="self-start rounded border border-dashed border-zinc-300 px-3 py-1 text-xs text-zinc-700"
                      >
                        여기 아래에 스테이지 추가
                      </button>
                    </div>
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => openInsert(stages.length)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              마지막에 스테이지 추가
            </button>
          </div>

          {insertIndex !== null && (
            <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="text-sm font-semibold">스테이지 추가</h3>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={insertStage.name}
                  onChange={(event) =>
                    setInsertStage((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="이름"
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                />
                <input
                  value={insertStage.probability}
                  onChange={(event) =>
                    setInsertStage((prev) => ({ ...prev, probability: event.target.value }))
                  }
                  type="number"
                  placeholder="가능성(%)"
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                />
                <input
                  value={insertStage.stagnationDays}
                  onChange={(event) =>
                    setInsertStage((prev) => ({ ...prev, stagnationDays: event.target.value }))
                  }
                  type="number"
                  placeholder="정체 기준일"
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                />
                <input
                  value={insertStage.description}
                  onChange={(event) =>
                    setInsertStage((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="설명"
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={onInsertStage}
                  className="rounded border border-zinc-300 px-3 py-2 text-sm"
                >
                  추가
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInsertIndex(null);
                    setInsertStage(emptyStage);
                  }}
                  className="rounded border border-zinc-300 px-3 py-2 text-sm"
                >
                  취소
                </button>
              </div>
              <p className="mt-2 text-sm text-zinc-700">
                딜이 없는 스테이지만 삭제할 수 있으며 최소 3개는 유지됩니다.
              </p>
            </div>
          )}
        </section>
      )}

      {message && <p className="text-sm text-red-600">{message}</p>}
    </div>
  );
}
