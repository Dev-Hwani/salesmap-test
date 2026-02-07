"use client";

import { useMemo } from "react";

export type FilterOperator = "is" | "is_not";
export type FilterCondition = {
  id: string;
  fieldKey: string;
  operator: FilterOperator;
  value: string;
};

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
};

export function FilterBar({ filters, setFilters, fields }: FilterBarProps) {
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

  const removeFilter = (id: string) => {
    setFilters(filters.filter((filter) => filter.id !== id));
  };

  const renderValueInput = (filter: FilterCondition) => {
    const field = fieldByKey[filter.fieldKey];
    if (!field) {
      return (
        <input
          value={filter.value}
          onChange={(event) =>
            updateFilter(filter.id, { value: event.target.value })
          }
          className="rounded border border-zinc-300 px-2 py-1"
        />
      );
    }

    if (field.type === "date") {
      return (
        <input
          type="date"
          value={filter.value}
          onChange={(event) =>
            updateFilter(filter.id, { value: event.target.value })
          }
          className="rounded border border-zinc-300 px-2 py-1"
        />
      );
    }

    if (field.type === "datetime") {
      return (
        <input
          type="datetime-local"
          value={filter.value}
          onChange={(event) =>
            updateFilter(filter.id, { value: event.target.value })
          }
          className="rounded border border-zinc-300 px-2 py-1"
        />
      );
    }

    if (field.type === "number" || field.type === "calculation") {
      return (
        <input
          type="number"
          step="any"
          value={filter.value}
          onChange={(event) =>
            updateFilter(filter.id, { value: event.target.value })
          }
          className="rounded border border-zinc-300 px-2 py-1"
        />
      );
    }

    if (
      field.type === "single_select" ||
      field.type === "multi_select" ||
      field.type === "user" ||
      field.type === "users" ||
      field.type === "boolean"
    ) {
      const options = field.options ?? [];
      return (
        <select
          value={filter.value}
          onChange={(event) =>
            updateFilter(filter.id, { value: event.target.value })
          }
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

    return (
      <input
        type="text"
        value={filter.value}
        onChange={(event) =>
          updateFilter(filter.id, { value: event.target.value })
        }
        className="rounded border border-zinc-300 px-2 py-1"
      />
    );
  };

  return (
    <section className="rounded border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">필터</h2>
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
            return (
              <div
                key={filter.id}
                className="flex flex-wrap items-center gap-2"
              >
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
                    updateFilter(filter.id, {
                      operator: event.target.value as FilterOperator,
                    })
                  }
                  className="rounded border border-zinc-300 px-2 py-1"
                >
                  <option value="is">is</option>
                  <option value="is_not">is not</option>
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
