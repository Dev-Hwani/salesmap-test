"use client";

import { useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import type { CustomField, Deal, Pipeline, Stage, UserSummary } from "@/types/domain";
import { DealCard } from "@/components/pipeline/DealCard";
import { StageColumn } from "@/components/pipeline/StageColumn";
import {
  FieldOption,
  FilterBar,
  FilterCondition,
  FilterMode,
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

function dateTimeToLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function getOptionLabel(field: CustomField, optionId: number | null) {
  if (!optionId) return "";
  return field.options?.find((option) => option.id === optionId)?.label ?? "";
}

function getCustomFieldDisplay(
  deal: Deal,
  field: CustomField,
  userMap: Map<number, UserSummary>
) {
  const match = deal.fieldValues.find((value) => value.fieldId === field.id);

  if (field.type === "text") return match?.valueText ?? "";
  if (field.type === "number") return match?.valueNumber ?? null;
  if (field.type === "date") return match?.valueDate ? dateToYMD(match.valueDate) : "";
  if (field.type === "datetime")
    return match?.valueDateTime ? dateTimeToLocal(match.valueDateTime) : "";
  if (field.type === "boolean")
    return match?.valueBoolean === null || match?.valueBoolean === undefined
      ? ""
      : match.valueBoolean
        ? "예"
        : "아니오";
  if (field.type === "single_select")
    return getOptionLabel(field, match?.valueOptionId ?? null);
  if (field.type === "multi_select") {
    const options = deal.optionValues
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
    const names = deal.userValues
      ?.filter((value) => value.fieldId === field.id)
      .map((value) => value.user?.name ?? "")
      .filter(Boolean);
    return names && names.length > 0 ? names.join(", ") : "";
  }
  if (field.type === "calculation") return match?.valueNumber ?? null;
  if (field.type === "file") {
    const count = deal.files?.filter((file) => file.fieldId === field.id).length ?? 0;
    return count > 0 ? `파일 ${count}개` : "";
  }
  return "";
}

function matchesFilter(
  deal: Deal,
  filter: FilterCondition,
  fields: CustomField[]
) {
  const operator = filter.operator;
  if (!filter.value && operator !== "between") return true;
  if (operator === "between" && (!filter.value || !filter.valueTo)) return true;

  const compareText = (dealValue: string) => {
    const normalizedDeal = normalizeText(dealValue);
    const normalizedFilter = normalizeText(filter.value);
    if (operator === "contains") return normalizedDeal.includes(normalizedFilter);
    if (operator === "not_contains") return !normalizedDeal.includes(normalizedFilter);
    if (operator === "is") return normalizedDeal === normalizedFilter;
    if (operator === "is_not") return normalizedDeal !== normalizedFilter;
    return true;
  };

  const compareNumber = (value: number | null) => {
    const target = Number(filter.value);
    if (Number.isNaN(target) || value === null || Number.isNaN(value)) return true;
    if (operator === "is") return value === target;
    if (operator === "is_not") return value !== target;
    if (operator === "gt") return value > target;
    if (operator === "gte") return value >= target;
    if (operator === "lt") return value < target;
    if (operator === "lte") return value <= target;
    if (operator === "between") {
      const end = Number(filter.valueTo ?? "");
      if (Number.isNaN(end)) return true;
      const min = Math.min(target, end);
      const max = Math.max(target, end);
      return value >= min && value <= max;
    }
    return true;
  };

  const compareDate = (value: string) => {
    if (!value) return false;
    if (operator === "is") return value === filter.value;
    if (operator === "is_not") return value !== filter.value;
    const start = new Date(filter.value);
    if (Number.isNaN(start.getTime())) return true;
    const dealDate = new Date(value);
    if (Number.isNaN(dealDate.getTime())) return true;
    if (operator === "before") return dealDate < start;
    if (operator === "after") return dealDate > start;
    if (operator === "between") {
      const endValue = filter.valueTo ?? "";
      const end = new Date(endValue);
      if (Number.isNaN(end.getTime())) return true;
      const min = start < end ? start : end;
      const max = start > end ? start : end;
      return dealDate >= min && dealDate <= max;
    }
    return true;
  };

  if (filter.fieldKey.startsWith("custom-")) {
    const id = Number(filter.fieldKey.replace("custom-", ""));
    const field = fields.find((item) => item.id === id);
    if (!field) return true;

    if (field.type === "text") {
      return compareText(String(getCustomFieldValue(deal, field) ?? ""));
    }

    if (field.type === "number" || field.type === "calculation") {
      const dealValue = Number(getCustomFieldValue(deal, field) ?? NaN);
      return compareNumber(Number.isNaN(dealValue) ? null : dealValue);
    }

    if (field.type === "date") {
      const dealValue = String(getCustomFieldValue(deal, field) ?? "");
      return compareDate(dealValue);
    }

    if (field.type === "datetime") {
      const dealValue = String(getCustomFieldValue(deal, field) ?? "");
      return compareDate(dealValue);
    }

    if (field.type === "boolean") {
      const match = deal.fieldValues.find((value) => value.fieldId === field.id);
      if (match?.valueBoolean === null || match?.valueBoolean === undefined) {
        return operator === "is_not";
      }
      const boolValue = match.valueBoolean ? "true" : "false";
      return operator === "is" ? boolValue === filter.value : boolValue !== filter.value;
    }

    if (field.type === "single_select") {
      const match = deal.fieldValues.find((value) => value.fieldId === field.id);
      const optionId = match?.valueOptionId ? String(match.valueOptionId) : "";
      return operator === "is" ? optionId === filter.value : optionId !== filter.value;
    }

    if (field.type === "multi_select") {
      const optionIds = deal.optionValues
        ?.filter((value) => value.fieldId === field.id)
        .map((value) => String(value.optionId))
        .filter(Boolean) ?? [];
      const hasValue = optionIds.includes(filter.value);
      return operator === "is" ? hasValue : !hasValue;
    }

    if (field.type === "user") {
      const match = deal.fieldValues.find((value) => value.fieldId === field.id);
      const userId = match?.valueUserId ? String(match.valueUserId) : "";
      return operator === "is" ? userId === filter.value : userId !== filter.value;
    }

    if (field.type === "users") {
      const userIds = deal.userValues
        ?.filter((value) => value.fieldId === field.id)
        .map((value) => String(value.userId))
        .filter(Boolean) ?? [];
      const hasValue = userIds.includes(filter.value);
      return operator === "is" ? hasValue : !hasValue;
    }
  }

  const baseKey = filter.fieldKey as BaseFieldKey;
  if (baseKey === "name") {
    return compareText(deal.name);
  }

  if (baseKey === "expectedRevenue") {
    return compareNumber(deal.expectedRevenue ?? null);
  }

  if (baseKey === "closeDate") {
    const dealValue = dateToYMD(deal.closeDate ?? null);
    return compareDate(dealValue);
  }

  return true;
}

function getCustomFieldValue(deal: Deal, field: CustomField) {
  const match = deal.fieldValues.find((value) => value.fieldId === field.id);
  if (!match) return null;
  if (field.type === "text") return match.valueText ?? "";
  if (field.type === "number") return match.valueNumber ?? null;
  if (field.type === "date") return match.valueDate ? dateToYMD(match.valueDate) : "";
  if (field.type === "datetime")
    return match.valueDateTime ? dateTimeToLocal(match.valueDateTime) : "";
  if (field.type === "calculation") return match.valueNumber ?? null;
  return null;
}

export default function PipelinePage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(
    null
  );
  const [deals, setDeals] = useState<Deal[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<UserSummary[]>([]);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("and");
  const [showDealForm, setShowDealForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedPipeline = pipelines.find(
    (pipeline) => pipeline.id === selectedPipelineId
  );

  const userMap = useMemo(() => {
    const map = new Map<number, UserSummary>();
    assignableUsers.forEach((user) => map.set(user.id, user));
    return map;
  }, [assignableUsers]);

  const fieldOptions = useMemo(() => {
    const customOptions: FieldOption[] = fields
      .filter((field) => !field.masked && field.type !== "file")
      .map((field) => {
        const options: FieldOption["options"] = [];
        if (field.type === "single_select" || field.type === "multi_select") {
          field.options?.forEach((option) =>
            options.push({ value: String(option.id), label: option.label })
          );
        }
        if (field.type === "boolean") {
          options.push(
            { value: "true", label: "예" },
            { value: "false", label: "아니오" }
          );
        }
        if (field.type === "user" || field.type === "users") {
          assignableUsers.forEach((user) => {
            options.push({
              value: String(user.id),
              label: `${user.name} (${user.role})`,
            });
          });
        }

        return {
          key: `custom-${field.id}`,
          label: field.label,
          type: field.type === "calculation" ? "calculation" : field.type,
          options: options.length > 0 ? options : undefined,
        };
      });
    return [...baseFields, ...customOptions];
  }, [fields, assignableUsers]);

  const visibleFields = useMemo(
    () => fields.filter((field) => field.visibleInPipeline && !field.masked),
    [fields]
  );

  const filteredDeals = useMemo(() => {
    if (filters.length === 0) return deals;
    return deals.filter((deal) => {
      const matches = filters.map((filter) => matchesFilter(deal, filter, fields));
      return filterMode === "and"
        ? matches.every(Boolean)
        : matches.some(Boolean);
    });
  }, [deals, filters, fields, filterMode]);

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
    const response = await fetch("/api/custom-fields?objectType=DEAL");
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

  const refreshUsers = async () => {
    const response = await fetch("/api/users/assignable");
    if (!response.ok) return;
    const data = await response.json();
    setAssignableUsers(data.users ?? []);
  };

  useEffect(() => {
    Promise.all([refreshPipelines(), refreshFields(), refreshUsers()]).finally(() =>
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

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        fields={fieldOptions}
        mode={filterMode}
        setMode={setFilterMode}
      />

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
                      deal.company?.name
                        ? { label: "회사", value: deal.company.name }
                        : null,
                      deal.contact?.name
                        ? { label: "고객", value: deal.contact.name }
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
                        const value = getCustomFieldDisplay(deal, field, userMap);
                        if (value === null || value === "") return null;
                        return {
                          label: field.label,
                          value: field.masked ? "••••" : String(value),
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
