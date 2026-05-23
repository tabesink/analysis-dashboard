"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Unplug } from "lucide-react";
import { RetrievalSettingsPopover } from "@/components/chat/RetrievalSettingsPopover";
import { cn } from "@/lib/utils";
import type { LightRagDomain, RetrievalSettings } from "@/types/chat";

type ChatComposerProps = {
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  onSubmit: (content: string) => void | Promise<void>;
  retrievalSettings: RetrievalSettings;
  onRetrievalSettingsChange: (settings: RetrievalSettings) => void;
  lightragDomains: LightRagDomain[];
  className?: string;
};

const MAX_HEIGHT_PX = 220;

export function ChatComposer({
  disabled,
  busy,
  placeholder = "Ask LightRAG",
  onSubmit,
  retrievalSettings,
  onRetrievalSettingsChange,
  lightragDomains,
  className,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [resize, value]);

  const send = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setValue("");
    await onSubmit(trimmed);
  }, [disabled, onSubmit, value]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-end gap-2 rounded-full border border-transparent bg-[var(--muted)]/70 px-4 py-2 transition-colors focus-within:bg-[var(--background)] focus-within:ring-1 focus-within:ring-[var(--border)]">
        <RetrievalSettingsPopover
          settings={retrievalSettings}
          onChange={onRetrievalSettingsChange}
          lightragDomains={lightragDomains}
          trigger={
            <button
              type="button"
              className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
              aria-label="Open retrieval settings"
            >
              <Unplug className="size-4" aria-hidden />
            </button>
          }
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="max-h-48 min-h-[1.5rem] flex-1 resize-none overflow-y-auto border-none bg-transparent py-1.5 text-base leading-relaxed text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Message"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={disabled || !value.trim()}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={busy ? "LightRAG is busy" : "Send message"}
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
