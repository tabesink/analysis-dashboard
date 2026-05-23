"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";

type ConversationViewProps = {
  messages: ChatMessage[];
  busy?: boolean;
  className?: string;
  emptyState?: React.ReactNode;
  selectedAssistantMessageId?: string;
  onAssistantSelect?: (messageId: string) => void;
};

export function ConversationView({
  messages,
  busy,
  className,
  emptyState,
  selectedAssistantMessageId,
  onAssistantSelect,
}: ConversationViewProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const previousScrollTopRef = useRef<number | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const scrollContainerToBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const jumpToBottom = useCallback(() => {
    scrollContainerToBottom();
    setShouldAutoScroll(true);
  }, [scrollContainerToBottom]);

  useEffect(() => {
    if (!shouldAutoScroll) return;
    scrollContainerToBottom();
  }, [busy, messages, scrollContainerToBottom, shouldAutoScroll]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const distanceFromBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight);
    const previousScrollTop = previousScrollTopRef.current;
    const scrollDelta = previousScrollTop === null ? 0 : previousScrollTop - el.scrollTop;

    if (scrollDelta > 10) {
      setShouldAutoScroll(false);
    } else if (distanceFromBottom < 56) {
      setShouldAutoScroll(true);
    }

    previousScrollTopRef.current = el.scrollTop;
  };

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      onTouchStart={() => setShouldAutoScroll(false)}
      className={cn("relative grid flex-1 grid-cols-1 overflow-y-auto px-4 sm:px-6", className)}
    >
      <div className="mx-auto flex min-h-full w-full max-w-4xl [grid-column:1/1] [grid-row:1/1]">
        <div
          className={cn(
            "flex w-full flex-col gap-8",
            messages.length === 0
              ? "min-h-full flex-1 justify-center items-center px-0 py-8"
              : "py-10",
          )}
        >
          {messages.length === 0 ? <div className="w-full">{emptyState}</div> : null}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isSelected={message.role === "assistant" && message.id === selectedAssistantMessageId}
              onSelect={message.role === "assistant" ? () => onAssistantSelect?.(message.id) : undefined}
            />
          ))}
        </div>
      </div>
      {!shouldAutoScroll ? (
        <div className="pointer-events-none flex items-end justify-end pb-5 [grid-column:1/1] [grid-row:1/1]">
          <button
            type="button"
            onClick={jumpToBottom}
            className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)]"
            aria-label="Jump to latest message"
          >
            <ArrowDown className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
