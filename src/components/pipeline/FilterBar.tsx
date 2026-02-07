"use client";

import { useMemo } from "react";

export type FilterOperator =
  | "is"
  | "is_not"
  | "contains"
  | "not_contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "before"
  | "after";

export type FilterCondition = {
  id: string;
  fieldKey: string;
  operator: FilterOperator;
  value: string;
  valueTo?: string;
};

export type FilterMode = "and" | "or";

export type FieldOptionType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "single_select"
  | "multi_select"
  | "boolean"
  | "user"
  | "users"
  | "calculation";

export type FieldOption = {
  key: string;
  label: string;
  type: FieldOptionType;
  options?: Array<{ value: string; label: string }>;
};

type FilterBarProps = {
  filters: FilterCondition[];
  setFilters: (filters: FilterCondition[]) => void;
  fields: FieldOption[];
  mode: FilterMode;
  setMode: (mode: FilterMode) => void;
};

export function FilterBar({ filters, setFilters, fields, mode, setMode }: FilterBarProps) {
  const defaultFieldKey = fields[0]?.key ?? "";

  const fieldByKey = useMemo(() => {
    return Object.fromEntries(fields.map((field) => [field.key, field]));
  }, [fields]);

  const addFilter = () => {
    if (!defaultFieldKey) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    setFilters([
      ...filters,
      {
        id,
        fieldKey: defaultFieldKey,
        operator: "is",
        value: "",
        valueTo: "",
      },
    ]);
  };

  const updateFilter = (id: string, patch: Partial<FilterCondition>) => {
    setFilters(
      filters.map((filter) =>
        filter.id === id ? { ...filter, ...patch } : filter
      )
    );
  };

  const updateOperator = (id: string, operator: FilterOperator) => {
    updateFilter(id, { operator, ...(operator === "between" ? {} : { valueTo: "" }) });
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter((filter) => filter.id !== id));
  };

  const getOperators = (field?: FieldOption) => {
    if (!field) return ["is", "is_not"] as FilterOperator[];
    if (field.type === "text") {
      return ["is", "is_not", "contains", "not_contains"] as FilterOperator[];
    }
    if (field.type === "number" || field.type === "calculation") {
      return ["is", "is_not", "gt", "gte", "lt", "lte", "between"] as FilterOperator[];
    }
    if (field.type === "date" || field.type === "datetime") {
      return ["is", "is_not", "before", "after", "between"] as FilterOperator[];
    }
    return ["is", "is_not"] as FilterOperator[];
  };

  const renderValueInput = (filter: FilterCondition) => {
    const field = fieldByKey[filter.fieldKey];
    const inputType = field?.type === "date"
      ? "date"
      : field?.type === "datetime"
        ? "datetime-local"
        : field?.type === "number" || field?.type === "calculation"
          ? "number"
          : "text";

    if (
      field &&
      ["single_select", "multi_select", "user", "users", "boolean"].includes(field.type)
    ) {
      const options = field.options ?? [];
      return (
        <select
          value={filter.value}
          onChange={(event) => updateFilter(filter.id, { value: event.target.value })}
          className="rounded border border-zinc-300 px-2 py-1"
        >
          <option value="">선택</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (filter.operator === "between") {
      return (
        <div className="flex items-center gap-2">
          <input
            type={inputType}
            value={filter.value}
            onChange={(event) => updateFilter(filter.id, { value: event.target.value })}
            className="rounded border border-zinc-300 px-2 py-1"
          />
          <span className="text-xs text-zinc-500">~</span>
          <input
            type={inputType}
            value={filter.valueTo ?? ""}
            onChange={(event) => updateFilter(filter.id, { valueTo: event.target.value })}
            className="rounded border border-zinc-300 px-2 py-1"
          />
        </div>
      );
    }

    return (
      <input
        type={inputType}
        value={filter.value}
        onChange={(event) => updateFilter(filter.id, { value: event.target.value })}
        className="rounded border border-zinc-300 px-2 py-1"
      />
    );
  };

  return (
    <section className="rounded border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">필터</h2>
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("and")}
              className={`rounded border px-2 py-1 ${
                mode === "and" ? "border-black bg-black text-white" : "border-zinc-300"
              }`}
            >
              AND
            </button>
            <button
              type="button"
              onClick={() => setMode("or")}
              className={`rounded border px-2 py-1 ${
                mode === "or" ? "border-black bg-black text-white" : "border-zinc-300"
              }`}
            >
              OR
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={addFilter}
          className="rounded border border-zinc-300 px-3 py-1 text-sm"
        >
          조건 추가
        </button>
      </div>
      {filters.length === 0 && (
        <p className="mt-3 text-sm text-zinc-700">
          조건을 추가하면 결과가 즉시 반영됩니다.
        </p>
      )}
      {filters.length > 0 && (
        <div className="mt-3 flex flex-col gap-3 text-sm">
          {filters.map((filter) => {
            const field = fieldByKey[filter.fieldKey];
            const operators = getOperators(field);
            return (
              <div key={filter.id} className="flex flex-wrap items-center gap-2">
                <select
                  value={filter.fieldKey}
                  onChange={(event) =>
                    updateFilter(filter.id, { fieldKey: event.target.value })
                  }
                  className="rounded border border-zinc-300 px-2 py-1"
                >
                  {fields.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filter.operator}
                  onChange={(event) =>
                    updateOperator(filter.id, event.target.value as FilterOperator)
                  }
                  className="rounded border border-zinc-300 px-2 py-1"
                >
                  {operators.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                {renderValueInput(filter)}
                <button
                  type="button"
                  onClick={() => removeFilter(filter.id)}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                >
                  제거
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
