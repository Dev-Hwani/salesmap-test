"use client";

import { useDraggable } from "@dnd-kit/core";

type FieldLine = { label: string; value: string };

type DealCardProps = {
  dealId: number;
  title: string;
  lines: FieldLine[];
};

export function DealCard({ dealId, title, lines }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `deal-${dealId}`,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded border border-zinc-200 bg-white p-3 text-sm shadow-sm ${
        isDragging ? "opacity-70" : ""
      }`}
    >
      <div className="font-medium">{title}</div>
      {lines.length > 0 && (
        <div className="mt-2 space-y-1 text-sm text-zinc-800">
          {lines.map((line) => (
            <div key={line.label}>
              {line.label}: {line.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
