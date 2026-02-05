"use client";

import { useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import type { CustomField, Deal, Pipeline, Stage } from "@/types/domain";
import { DealCard } from "@/components/pipeline/DealCard";
import { StageColumn } from "@/components/pipeline/StageColumn";
import {
  FieldOption,
  FilterBar,
  FilterCondition,
} from "@/components/pipeline/FilterBar";
import { DealForm } from "@/components/pipeline/DealForm";

type BaseFieldKey = "name" | "expectedRevenue" | "closeDate";

const baseFields: FieldOption[] = [
  { key: "name", label: "딜 이름", type: "text" },
  { key: "expectedRevenue", label: "예상 매출", type: "number" },
  { key: "closeDate", label: "마감일", type: "date" },
];

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function dateToYMD(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function getCustomFieldValue(
  deal: Deal,
  field: CustomField
): string | number | null {
  const match = deal.fieldValues.find((value) => value.fieldId === field.id);
  if (!match) return null;
  if (field.type === "text") return match.valueText ?? "";
  if (field.type === "number") return match.valueNumber ?? null;
  if (field.type === "date") return match.valueDate ? dateToYMD(match.valueDate) : "";
  return null;
}

function matchesFilter(
  deal: Deal,
  filter: FilterCondition,
  fields: CustomField[]
) {
  if (!filter.value) return true;

  if (filter.fieldKey.startsWith("custom-")) {
    const id = Number(filter.fieldKey.replace("custom-", ""));
    const field = fields.find((item) => item.id === id);
    if (!field) return true;
    const value = getCustomFieldValue(deal, field);
    if (field.type === "text") {
      const dealValue = normalizeText(String(value ?? ""));
      const filterValue = normalizeText(filter.value);
      return filter.operator === "is"
        ? dealValue === filterValue
        : dealValue !== filterValue;
    }
    if (field.type === "number") {
      const numeric = Number(filter.value);
      if (Number.isNaN(numeric)) return true;
      const dealValue = Number(value ?? NaN);
      return filter.operator === "is"
        ? dealValue === numeric
        : dealValue !== numeric;
    }
    if (field.type === "date") {
      const dealValue = String(value ?? "");
      return filter.operator === "is"
        ? dealValue === filter.value
        : dealValue !== filter.value;
    }
  }

  const baseKey = filter.fieldKey as BaseFieldKey;
  if (baseKey === "name") {
    const dealValue = normalizeText(deal.name);
    const filterValue = normalizeText(filter.value);
    return filter.operator === "is"
      ? dealValue === filterValue
      : dealValue !== filterValue;
  }

  if (baseKey === "expectedRevenue") {
    const numeric = Number(filter.value);
    if (Number.isNaN(numeric)) return true;
    const dealValue = deal.expectedRevenue ?? NaN;
    return filter.operator === "is"
      ? dealValue === numeric
      : dealValue !== numeric;
  }

  if (baseKey === "closeDate") {
    const dealValue = dateToYMD(deal.closeDate ?? null);
    return filter.operator === "is"
      ? dealValue === filter.value
      : dealValue !== filter.value;
  }

  return true;
}

export default function PipelinePage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(
    null
  );
  const [deals, setDeals] = useState<Deal[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [showDealForm, setShowDealForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedPipeline = pipelines.find(
    (pipeline) => pipeline.id === selectedPipelineId
  );

  const fieldOptions = useMemo(() => {
    const customOptions: FieldOption[] = fields.map((field) => ({
      key: `custom-${field.id}`,
      label: field.label,
      type: field.type,
    }));
    return [...baseFields, ...customOptions];
  }, [fields]);

  const visibleFields = useMemo(
    () => fields.filter((field) => field.visibleInPipeline),
    [fields]
  );

  const filteredDeals = useMemo(() => {
    if (filters.length === 0) return deals;
    return deals.filter((deal) =>
      filters.every((filter) => matchesFilter(deal, filter, fields))
    );
  }, [deals, filters, fields]);

  const stageDealsMap = useMemo(() => {
    const map = new Map<number, Deal[]>();
    if (!selectedPipeline) return map;

    selectedPipeline.stages.forEach((stage) => {
      map.set(stage.id, []);
    });

    filteredDeals.forEach((deal) => {
      if (!map.has(deal.stageId)) {
        map.set(deal.stageId, []);
      }
      map.get(deal.stageId)?.push(deal);
    });

    return map;
  }, [filteredDeals, selectedPipeline]);

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

  const refreshFields = async () => {
    const response = await fetch("/api/custom-fields");
    if (!response.ok) return;
    const data = await response.json();
    setFields(data.fields);
  };

  const refreshDeals = async (pipelineId: number) => {
    const response = await fetch(`/api/deals?pipelineId=${pipelineId}`);
    if (!response.ok) return;
    const data = await response.json();
    setDeals(data.deals);
  };

  useEffect(() => {
    Promise.all([refreshPipelines(), refreshFields()]).finally(() =>
      setLoading(false)
    );
  }, []);

  useEffect(() => {
    if (selectedPipelineId) {
      refreshDeals(selectedPipelineId);
    }
  }, [selectedPipelineId]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : "";
    if (!activeId.startsWith("deal-") || !overId.startsWith("stage-")) {
      return;
    }

    const dealId = Number(activeId.replace("deal-", ""));
    const stageId = Number(overId.replace("stage-", ""));
    if (!dealId || !stageId) return;

    const targetDeal = deals.find((deal) => deal.id === dealId);
    if (!targetDeal || targetDeal.stageId === stageId) return;

    setDeals((prev) =>
      prev.map((deal) =>
        deal.id === dealId ? { ...deal, stageId } : deal
      )
    );

    const response = await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });

    if (!response.ok && selectedPipelineId) {
      await refreshDeals(selectedPipelineId);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-800">로딩 중...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-black">파이프라인</label>
          <select
            value={selectedPipelineId ?? ""}
            onChange={(event) => setSelectedPipelineId(Number(event.target.value))}
            className="min-w-[180px] rounded border border-zinc-400 bg-white px-3 py-2 text-sm text-black shadow-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
          >
            {pipelines.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setShowDealForm(true)}
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          딜 생성
        </button>
      </div>

      <FilterBar filters={filters} setFilters={setFilters} fields={fieldOptions} />

      {selectedPipeline ? (
        <DndContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {selectedPipeline.stages.map((stage: Stage) => {
              const stageDeals = stageDealsMap.get(stage.id) ?? [];
              return (
                <StageColumn
                  key={stage.id}
                  stageId={stage.id}
                  name={stage.name}
                  probability={stage.probability}
                  stagnationDays={stage.stagnationDays}
                >
                  {stageDeals.length === 0 && (
                    <p className="text-sm text-zinc-700">딜 없음</p>
                  )}
                  {stageDeals.map((deal) => {
                    const lines = [
                      deal.owner?.name
                        ? { label: "담당자", value: deal.owner.name }
                        : null,
                      deal.expectedRevenue !== null
                        ? {
                            label: "예상 매출",
                            value: deal.expectedRevenue.toLocaleString(),
                          }
                        : null,
                      deal.closeDate
                        ? {
                            label: "마감일",
                            value: dateToYMD(deal.closeDate),
                          }
                        : null,
                      ...visibleFields.map((field) => {
                        const value = getCustomFieldValue(deal, field);
                        if (value === null || value === "") return null;
                        return {
                          label: field.label,
                          value: String(value),
                        };
                      }),
                    ].filter(Boolean) as { label: string; value: string }[];

                    return (
                      <DealCard
                        key={deal.id}
                        dealId={deal.id}
                        title={deal.name}
                        lines={lines}
                      />
                    );
                  })}
                </StageColumn>
              );
            })}
          </div>
        </DndContext>
      ) : (
        <p className="text-sm text-zinc-800">
          파이프라인을 먼저 생성해주세요.
        </p>
      )}

      <DealForm
        open={showDealForm}
        onClose={() => setShowDealForm(false)}
        pipelineId={selectedPipelineId}
        stages={selectedPipeline?.stages ?? []}
        fields={fields}
        onCreated={() => selectedPipelineId && refreshDeals(selectedPipelineId)}
      />
    </div>
  );
}
