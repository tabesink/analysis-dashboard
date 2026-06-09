"use client";

import { cn } from "@/lib/utils";
import { useGraphStore } from "@/stores/graph";

type LegendProps = {
  className?: string;
};

export default function Legend({ className }: LegendProps) {
  const typeColorMap = useGraphStore.use.typeColorMap();
  const entries = Array.from(typeColorMap.entries());

  return (
    <div className={cn("max-h-72 w-56 overflow-y-auto rounded-xl border border-[var(--border)] p-3 text-xs shadow-sm", className)}>
      <div className="mb-2 font-medium text-[var(--foreground)]">Legend</div>
      {entries.length === 0 ? (
        <div className="text-[var(--muted-foreground)]">No node types loaded.</div>
      ) : (
        <div className="space-y-2">
          {entries.map(([label, color]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="size-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="truncate text-[var(--foreground)]">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
