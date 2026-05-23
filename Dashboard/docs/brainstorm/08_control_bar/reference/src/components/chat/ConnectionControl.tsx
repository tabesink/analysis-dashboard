"use client";

import { Check, Server } from "lucide-react";
import { cn } from "@/lib/utils";

type ConnectionControlProps = {
  port: number;
  draftPort: string;
  status: "idle" | "connecting" | "streaming" | "error";
  error?: string;
  onDraftPortChange: (value: string) => void;
  onApplyPort: () => void;
};

export function ConnectionControl({
  port,
  draftPort,
  status,
  error,
  onDraftPortChange,
  onApplyPort,
}: ConnectionControlProps) {
  const hasDraftChange = draftPort !== String(port);
  const statusLabel = status === "streaming" ? "Streaming" : status === "connecting" ? "Connecting" : status === "error" ? "Error" : "Ready";

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--foreground)]">
          <Server className="size-3.5 text-[var(--muted-foreground)]" aria-hidden />
          <span className="text-[var(--muted-foreground)]">Backend</span>
          <input
            value={draftPort}
            onChange={(event) => onDraftPortChange(event.target.value.replace(/[^\d]/g, "").slice(0, 5))}
            onKeyDown={(event) => {
              if (event.key === "Enter") onApplyPort();
            }}
            inputMode="numeric"
            className="w-16 bg-transparent font-mono text-xs text-[var(--foreground)] outline-none"
            aria-label="Backend server port"
          />
        </label>
        <button
          type="button"
          onClick={onApplyPort}
          disabled={!hasDraftChange}
          className="inline-flex size-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Apply port"
        >
          <Check className="size-3.5" aria-hidden />
        </button>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]",
            status === "error" ? "bg-[var(--destructive)] text-[var(--destructive-foreground)]" : "bg-[var(--muted)] text-[var(--muted-foreground)]",
          )}
          title={error}
        >
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          {statusLabel}
        </span>
      </div>
      <p className="truncate font-mono text-[11px] text-[var(--muted-foreground)]">http://127.0.0.1:{port}</p>
    </div>
  );
}
