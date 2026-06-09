"use client";

import { useState, type PointerEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContextPanelItem, PipelineProgressEvent } from "@/types/chat";

const SIDE_PANEL_MIN_WIDTH = 400;
const SIDE_PANEL_MAX_WIDTH = 720;

type SidePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextItems: ContextPanelItem[];
  retrievalSummary?: string;
  progressItems?: PipelineProgressEvent[];
  lastError?: string;
  hasAssistantMessages: boolean;
  selectedAssistantMessageId?: string;
  loadingSelection?: boolean;
};

export function SidePanel({
  open,
  onOpenChange,
  contextItems,
  retrievalSummary,
  progressItems = [],
  lastError,
  hasAssistantMessages,
  selectedAssistantMessageId,
  loadingSelection,
}: SidePanelProps) {
  const [panelWidth, setPanelWidth] = useState(SIDE_PANEL_MIN_WIDTH);

  function startPanelResize(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = panelWidth;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    function handlePointerMove(moveEvent: globalThis.PointerEvent) {
      const nextWidth = startWidth + startX - moveEvent.clientX;

      setPanelWidth(Math.min(SIDE_PANEL_MAX_WIDTH, Math.max(SIDE_PANEL_MIN_WIDTH, nextWidth)));
    }

    function stopPanelResize() {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopPanelResize);
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopPanelResize);
  }

  const content = (
    <PanelContent
      contextItems={contextItems}
      retrievalSummary={retrievalSummary}
      progressItems={progressItems}
      lastError={lastError}
      hasAssistantMessages={hasAssistantMessages}
      selectedAssistantMessageId={selectedAssistantMessageId}
      loadingSelection={loadingSelection}
      onClose={() => onOpenChange(false)}
    />
  );

  return (
    <>
      <aside
        className="relative hidden shrink-0 border-l border-[var(--border)] bg-[var(--background)] lg:flex"
        style={{ width: panelWidth }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize context panel"
          onPointerDown={startPanelResize}
          className="absolute inset-y-0 left-0 z-10 w-2 -translate-x-1 cursor-col-resize touch-none"
        />
        {content}
      </aside>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/20 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => onOpenChange(false)}
        aria-hidden={!open}
      >
        <div
          className={cn(
            "ml-auto flex h-full w-[min(100vw,400px)] transform bg-[var(--background)] shadow-xl transition-transform",
            open ? "translate-x-0" : "translate-x-full",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {content}
        </div>
      </div>
    </>
  );
}

function PanelContent({
  contextItems,
  retrievalSummary,
  progressItems,
  lastError,
  hasAssistantMessages,
  selectedAssistantMessageId,
  loadingSelection,
  onClose,
}: {
  contextItems: ContextPanelItem[];
  retrievalSummary?: string;
  progressItems: PipelineProgressEvent[];
  lastError?: string;
  hasAssistantMessages: boolean;
  selectedAssistantMessageId?: string;
  loadingSelection?: boolean;
  onClose: () => void;
}) {
  const summary = loadingSelection
    ? "Retrieving context for this response..."
    : retrievalSummary || "No retrieved context yet.";

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Context</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">Retrieved evidence for the current response.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] lg:hidden"
            aria-label="Close side panel"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-4">
        <Separator />
        <section className="py-5">
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">{summary}</p>
          {lastError ? <p className="mt-2 text-xs leading-5 text-[var(--destructive)]">{lastError}</p> : null}
        </section>
        {progressItems.length ? (
          <section className="space-y-3 pb-5">
            <p className="text-xs font-medium tracking-tight text-[var(--foreground)]">Pipeline</p>
            <div className="space-y-3">
              {progressItems.map((item, index) => (
                <PipelineProgressItem key={`${item.step}-${item.status}-${index}`} item={item} />
              ))}
            </div>
          </section>
        ) : null}
        <section className="space-y-5">
          {contextItems.length ? (
            contextItems.map((item) => <ContextItem key={item.id} item={item} />)
          ) : loadingSelection ? (
            <p className="text-xs leading-5 text-[var(--muted-foreground)]">Waiting for retrieval results...</p>
          ) : !hasAssistantMessages ? (
            <p className="text-xs leading-5 text-[var(--muted-foreground)]">
              Ask a question to populate document-ordered retrieved evidence.
            </p>
          ) : !selectedAssistantMessageId ? (
            <p className="text-xs leading-5 text-[var(--muted-foreground)]">
              Select an assistant response in the timeline to inspect its retrieved context.
            </p>
          ) : (
            <p className="text-xs leading-5 text-[var(--muted-foreground)]">
              No retrieved context is available for this response.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function PipelineProgressItem({ item }: { item: PipelineProgressEvent }) {
  const isFailed = item.status === "failed";
  const isWarning = item.status === "warning";
  const statusLabel = item.status === "complete" ? "Done" : item.status[0].toUpperCase() + item.status.slice(1);

  return (
    <article className="text-xs leading-5">
      <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
        <span className="text-[var(--foreground)]">{progressStepLabel(item.step)}</span>
        <span
          className={cn(
            isFailed && "text-[var(--destructive)]",
            isWarning && "text-[var(--foreground)]",
          )}
        >
          {statusLabel}
        </span>
      </div>
      <p className={cn("mt-1 whitespace-pre-wrap", isFailed ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]")}>
        {item.message}
      </p>
    </article>
  );
}

function progressStepLabel(step: PipelineProgressEvent["step"]) {
  const labels: Record<PipelineProgressEvent["step"], string> = {
    prepare: "Prepare",
    plan: "Plan",
    retrieve: "Retrieve",
    index: "Index",
    context: "Context",
    synthesize: "Synthesize",
    stream: "Generate",
    finalize: "Finalize",
  };
  return labels[step];
}

function Separator() {
  return <div className="border-t border-[var(--border)]" />;
}

function ContextItem({ item }: { item: ContextPanelItem }) {
  if (item.kind === "table") {
    return <TableContextItem item={item} />;
  }
  if (item.kind === "figure") {
    return <FigureContextItem item={item} />;
  }
  return <TextContextItem item={item} />;
}

function TextContextItem({ item }: { item: ContextPanelItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="text-xs leading-5">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="block w-full text-left text-[var(--foreground)] hover:text-[var(--foreground)]"
        aria-expanded={expanded}
      >
        {item.title}
      </button>
      <p className={cn("mt-1 whitespace-pre-wrap text-[var(--muted-foreground)]", expanded ? "line-clamp-none" : "line-clamp-3")}>
        {item.content || "No text content was returned for this chunk."}
      </p>
    </article>
  );
}

function TableContextItem({ item }: { item: ContextPanelItem }) {
  return (
    <article className="text-xs leading-5">
      <div className="rounded-xl border border-[var(--border)]">
        <div className="border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--foreground)]">{item.title}</div>
        <div className="max-h-64 overflow-auto p-3">
          <pre className="min-w-full w-max whitespace-pre font-mono text-xs leading-5 text-[var(--muted-foreground)]">
            {item.content || "Table content will appear here when returned by retrieval."}
          </pre>
        </div>
      </div>
    </article>
  );
}

function FigureContextItem({ item }: { item: ContextPanelItem }) {
  return (
    <article className="text-xs leading-5">
      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        <div className="border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--foreground)]">{item.title}</div>
        <div className="p-3 text-xs leading-5 text-[var(--muted-foreground)]">
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]">
            figure artifact placeholder
          </div>
          <p className="mt-2 whitespace-pre-wrap">{item.content || "Backend image/artifact loading will be wired later."}</p>
        </div>
      </div>
    </article>
  );
}
