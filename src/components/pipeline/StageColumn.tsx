"use client";

import { useDroppable } from "@dnd-kit/core";

type StageColumnProps = {
  stageId: number;
  name: string;
  probability: number | null;
  stagnationDays: number | null;
  children: React.ReactNode;
};

export function StageColumn({
  stageId,
  name,
  probability,
  stagnationDays,
  children,
}: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stageId}`,
  });

  return (
    <div className="flex min-w-[260px] flex-col gap-3 rounded border border-zinc-200 bg-zinc-100 p-3">
      <div>
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-sm text-zinc-800">
          가능성: {probability ?? "-"}% · 정체 기준: {stagnationDays ?? "-"}일
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[120px] flex-col gap-3 rounded border border-dashed border-zinc-300 p-2 ${
          isOver ? "bg-white" : "bg-transparent"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
