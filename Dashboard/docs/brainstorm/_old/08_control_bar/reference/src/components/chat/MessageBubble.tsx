"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageSquareText, Target, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/chat";

type MessageBubbleProps = {
  message: ChatMessage;
  isSelected?: boolean;
  onSelect?: () => void;
};

export function MessageBubble({ message, isSelected, onSelect }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const selectableAssistant = !isUser && typeof onSelect === "function";

  return (
    <article className={cn("w-full", isUser && "flex justify-end")}>
      <div
        role={selectableAssistant ? "button" : undefined}
        tabIndex={selectableAssistant ? 0 : undefined}
        onClick={onSelect}
        onKeyDown={
          selectableAssistant
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect?.();
                }
              }
            : undefined
        }
        className={cn(
          "text-sm leading-6",
          isUser
            ? "w-fit max-w-[82%] whitespace-pre-wrap break-words rounded-full bg-[var(--secondary)] px-5 py-3 text-base leading-normal text-[var(--foreground)]"
            : "mx-auto flex w-full max-w-3xl flex-col gap-3 px-1 py-1 text-[var(--foreground)]",
          selectableAssistant &&
            "cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--border)]",
          isSelected && !isUser && "text-[var(--foreground)]",
          message.error && "text-[var(--destructive)]",
        )}
      >
        {isUser ? (
          message.content
        ) : (
          <div className="prose prose-neutral prose-sm max-w-none dark:prose-invert prose-p:my-3 prose-li:my-1 prose-pre:rounded-lg prose-pre:border-0 prose-pre:bg-[var(--muted)] prose-code:text-[var(--foreground)]">
            {message.content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            ) : (
              <span className="text-[var(--muted-foreground)]">Thinking...</span>
            )}
          </div>
        )}
        {message.error ? <p className="mt-2 text-xs">{message.error}</p> : null}
        {!isUser && message.content ? <ResponseActions /> : null}
      </div>
    </article>
  );
}

function ResponseActions() {
  return (
    <div className="mt-2 flex items-center justify-between text-xs leading-5 text-[var(--muted-foreground)]">
      <div className="flex items-center gap-1">
        <ActionButton label="Mark response helpful">
          <ThumbsUp className="size-3.5" aria-hidden />
        </ActionButton>
        <ActionButton label="Leave feedback">
          <MessageSquareText className="size-3.5" aria-hidden />
        </ActionButton>
      </div>
      <ActionButton label="Jump to retrieved context">
        <Target className="size-3.5" aria-hidden />
      </ActionButton>
    </div>
  );
}

function ActionButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex size-7 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
      aria-label={label}
    >
      {children}
    </button>
  );
}
