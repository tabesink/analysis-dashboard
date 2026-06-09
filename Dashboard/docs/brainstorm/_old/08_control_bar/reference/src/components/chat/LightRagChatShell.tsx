"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PanelRightOpen } from "lucide-react";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ConversationView } from "@/components/chat/ConversationView";
import { SidePanel } from "@/components/chat/SidePanel";
import { WorkspaceTree } from "@/components/chat/WorkspaceTree";
import { streamBackendMessage } from "@/lib/lightrag-client";
import {
  createId,
  mergeSourceTrees,
  setChatSessionState,
  useChatSessionStore,
} from "@/stores/chat-session-store";
import { DEFAULT_LIGHTRAG_PORT, useLightRagDomainStore } from "@/stores/lightrag-domain-store";
import type {
  AssistantTurnContext,
  ActivityEntry,
  ChatMessage,
  PipelineProgressEvent,
  RetrievalSettings,
} from "@/types/chat";

const DEFAULT_RETRIEVAL_SETTINGS: RetrievalSettings = {
  lightrag_port: DEFAULT_LIGHTRAG_PORT,
  mode: "mix",
  top_k: 10,
  chunk_top_k: 10,
  chunk_rerank_top_k: 10,
  max_token_for_text_unit: 4000,
  max_token_for_global_context: 4000,
  max_token_for_local_context: 4000,
};

type ConnectionStatus = "idle" | "connecting" | "streaming" | "error";

export function LightRagChatShell() {
  const messages = useChatSessionStore((session) => session.messages);
  const conversationId = useChatSessionStore((session) => session.conversationId);
  const contextByAssistantId = useChatSessionStore((session) => session.contextByAssistantId);
  const progressByAssistantId = useChatSessionStore((session) => session.progressByAssistantId);
  const selectedAssistantMessageId = useChatSessionStore((session) => session.selectedAssistantMessageId);
  const sourceTree = useChatSessionStore((session) => session.sourceTree);
  const status = useChatSessionStore((session) => session.status);
  const lastError = useChatSessionStore((session) => session.lastError);
  const [retrievalSettings, setRetrievalSettings] = useState<RetrievalSettings>(DEFAULT_RETRIEVAL_SETTINGS);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const lightragDomains = useLightRagDomainStore((domainState) => domainState.domains);
  const selectedPort = useLightRagDomainStore((domainState) => domainState.selectedPort);
  const domainStatus = useLightRagDomainStore((domainState) => domainState.status);
  const domainError = useLightRagDomainStore((domainState) => domainState.error);
  const loadDomains = useLightRagDomainStore((domainState) => domainState.loadDomains);
  const setSelectedPort = useLightRagDomainStore((domainState) => domainState.setSelectedPort);
  const setMessages = useCallback((update: StateUpdate<ChatMessage[]>) => {
    setChatSessionState((session) => ({ messages: resolveNext(session.messages, update) }));
  }, []);
  const setActivities = useCallback((update: StateUpdate<ActivityEntry[]>) => {
    setChatSessionState((session) => ({ activities: resolveNext(session.activities, update) }));
  }, []);
  const setProgressByAssistantId = useCallback((update: StateUpdate<Record<string, PipelineProgressEvent[]>>) => {
    setChatSessionState((session) => ({ progressByAssistantId: resolveNext(session.progressByAssistantId, update) }));
  }, []);
  const setContextByAssistantId = useCallback((update: StateUpdate<Record<string, AssistantTurnContext>>) => {
    setChatSessionState((session) => ({ contextByAssistantId: resolveNext(session.contextByAssistantId, update) }));
  }, []);
  const setSelectedAssistantMessageId = useCallback((update: StateUpdate<string | undefined>) => {
    setChatSessionState((session) => ({ selectedAssistantMessageId: resolveNext(session.selectedAssistantMessageId, update) }));
  }, []);
  const setStatus = useCallback((status: ConnectionStatus) => {
    setChatSessionState({ status });
  }, []);
  const setLastError = useCallback((lastError: string | undefined) => {
    setChatSessionState({ lastError });
  }, []);

  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  const effectiveRetrievalSettings: RetrievalSettings = useMemo(
    () => ({
      ...retrievalSettings,
      lightrag_port: selectedPort,
    }),
    [retrievalSettings, selectedPort],
  );
  const displayedLastError = lastError ?? (domainStatus === "error" ? domainError : undefined);

  const handleRetrievalSettingsChange = useCallback(
    (nextSettings: RetrievalSettings) => {
      setRetrievalSettings({ ...nextSettings, lightrag_port: selectedPort });
      if (nextSettings.lightrag_port !== undefined && nextSettings.lightrag_port !== selectedPort) {
        setSelectedPort(nextSettings.lightrag_port);
      }
    },
    [selectedPort, setSelectedPort],
  );

  const submit = useCallback(
    async (content: string) => {
      const settingsForTurn = effectiveRetrievalSettings;

      const userMessage: ChatMessage = {
        id: createId("user"),
        role: "user",
        content,
        createdAt: Date.now(),
      };
      const assistantId = createId("assistant");
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now() + 1,
      };
      const activityId = createId("activity");
      const activity: ActivityEntry = {
        id: activityId,
        label: "Query started",
        detail: `Retrieving ${settingsForTurn.mode} context from LightRAG port ${settingsForTurn.lightrag_port ?? "default"}.`,
        createdAt: Date.now(),
        status: "pending",
      };

      setMessages((current) => [...current, userMessage, assistantMessage]);
      setActivities((current) => [activity, ...current].slice(0, 8));
      setProgressByAssistantId((current) => ({ ...current, [assistantId]: [] }));
      setLastError(undefined);
      setStatus("connecting");
      setSelectedAssistantMessageId(assistantId);

      let receivedChunk = false;
      let activeAssistantId = assistantId;

      try {
        await streamBackendMessage({
          conversationId,
          query: content,
          retrievalSettings: settingsForTurn,
          onMetadata: (event) => {
            const backendAssistantId = event.assistant_message_id;
            const previousAssistantId = activeAssistantId;
            setMessages((current) =>
              current.map((message) =>
                message.id === previousAssistantId ? { ...message, id: backendAssistantId } : message,
              ),
            );
            setContextByAssistantId((current) => {
              if (!current[previousAssistantId] || previousAssistantId === backendAssistantId) {
                return current;
              }
              const moved = current[previousAssistantId];
              if (!moved) return current;
              const next = { ...current };
              delete next[previousAssistantId];
              next[backendAssistantId] = { ...moved, assistantMessageId: backendAssistantId };
              return next;
            });
            setProgressByAssistantId((current) => {
              if (!current[previousAssistantId] || previousAssistantId === backendAssistantId) {
                return current;
              }
              const moved = current[previousAssistantId];
              const next = { ...current };
              delete next[previousAssistantId];
              next[backendAssistantId] = moved;
              return next;
            });
            setSelectedAssistantMessageId((current) =>
              current === previousAssistantId || !current ? backendAssistantId : current,
            );
            activeAssistantId = backendAssistantId;
          },
          onProgress: (event) => {
            const assistantMessageId = event.assistant_message_id || activeAssistantId;
            setProgressByAssistantId((current) => ({
              ...current,
              [assistantMessageId]: [...(current[assistantMessageId] ?? []), event],
            }));
            setSelectedAssistantMessageId((current) => current ?? assistantMessageId);
            setStatus("streaming");
          },
          onContext: (event) => {
            const assistantMessageId = event.assistant_message_id || activeAssistantId;
            setChatSessionState((session) => {
              const nextSourceTree = mergeSourceTrees(session.sourceTree, event.source_tree);
              return {
                contextByAssistantId: {
                  ...session.contextByAssistantId,
                  [assistantMessageId]: {
                    assistantMessageId,
                    contextItems: event.context_items,
                    retrievalSummary: event.retrieval_summary,
                    sourceTree: nextSourceTree,
                  },
                },
                sourceTree: nextSourceTree,
              };
            });
            setSelectedAssistantMessageId(assistantMessageId);
            setStatus("streaming");
          },
          onChunk: (chunk) => {
            receivedChunk = true;
            setStatus("streaming");
            setMessages((current) =>
              current.map((message) =>
                message.id === activeAssistantId ? { ...message, content: `${message.content}${chunk}` } : message,
              ),
            );
          },
        });

        if (!receivedChunk) {
          setMessages((current) =>
            current.map((message) =>
              message.id === activeAssistantId ? { ...message, content: "No response returned." } : message,
            ),
          );
        }

        setActivities((current) =>
          current.map((activity) =>
            activity.id === activityId
              ? { ...activity, label: "Query complete", detail: "Completed grounded response.", status: "complete" }
              : activity,
          ),
        );
        setStatus("idle");
      } catch (error) {
        const message = error instanceof Error ? error.message : "LightRAG query failed.";
        setLastError(message);
        setStatus("error");
        setMessages((current) =>
          current.map((item) =>
            item.id === activeAssistantId
              ? {
                  ...item,
                  content: item.content || "The query failed before a response was returned.",
                  error: message,
                }
              : item,
          ),
        );
        setActivities((current) =>
          current.map((activity) =>
            activity.id === activityId
              ? { ...activity, label: "Query failed", detail: message, status: "error" }
              : activity,
          ),
        );
      }
    },
    [
      conversationId,
      effectiveRetrievalSettings,
      setActivities,
      setContextByAssistantId,
      setLastError,
      setMessages,
      setProgressByAssistantId,
      setSelectedAssistantMessageId,
      setStatus,
    ],
  );

  const busy = status === "connecting" || status === "streaming";
  const selectedContext = selectedAssistantMessageId ? contextByAssistantId[selectedAssistantMessageId] : undefined;
  const selectedProgress = selectedAssistantMessageId ? progressByAssistantId[selectedAssistantMessageId] : undefined;
  const displayedSourceTree = sourceTree;
  const hasAssistantMessages = messages.some((message) => message.role === "assistant");
  const loadingSelection = Boolean(
    busy && selectedAssistantMessageId && hasAssistantMessages && !contextByAssistantId[selectedAssistantMessageId],
  );

  return (
    <div className="flex h-full min-h-0 bg-[var(--background)]">
      <aside className="min-h-0 w-[280px] shrink-0 overflow-y-auto bg-[var(--background)] px-4 py-3">
        <WorkspaceTree sourceTree={displayedSourceTree} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="px-4 py-3">
          <div className="flex w-full justify-end">
            <div className="flex min-w-0 flex-wrap items-start justify-end gap-2">
              <button
                type="button"
                onClick={() => setSidePanelOpen(true)}
                className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] lg:hidden"
                aria-label="Open retrieved context"
              >
                <PanelRightOpen className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        </header>

        <ConversationView
          messages={messages}
          busy={busy}
          selectedAssistantMessageId={selectedAssistantMessageId}
          onAssistantSelect={setSelectedAssistantMessageId}
          emptyState={
            <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 text-center">
              <Image src="/logo.svg" alt="LightRAG" width={112} height={112} priority className="h-28 w-28 text-[var(--foreground)]" />
              <p className="text-2xl font-medium tracking-tight text-[var(--foreground)]">Ask a local knowledge base.</p>
              <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                Use the retrieval settings button in the composer to choose a knowledgebase, then ask a plain-language question.
              </p>
              <button
                type="button"
                onClick={() => void submit("Summarize the indexed corpus and list the most important topics.")}
                disabled={busy}
                className="mt-1 rounded-full bg-[var(--muted)] px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Summarize this knowledge base
              </button>
            </div>
          }
        />

        <div className="px-4 pt-3 pb-8 sm:px-6">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
            {displayedLastError ? (
              <div className="rounded-xl bg-[var(--muted)] px-3 py-2 text-sm text-[var(--foreground)]">
                {displayedLastError}
              </div>
            ) : null}
            <ChatComposer
              onSubmit={submit}
              disabled={busy}
              busy={busy}
              placeholder="Ask LightRAG"
              retrievalSettings={effectiveRetrievalSettings}
              onRetrievalSettingsChange={handleRetrievalSettingsChange}
              lightragDomains={lightragDomains}
            />
          </div>
        </div>
      </div>
      <SidePanel
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
        contextItems={selectedContext?.contextItems ?? []}
        retrievalSummary={selectedContext?.retrievalSummary}
        progressItems={selectedProgress ?? []}
        lastError={displayedLastError}
        hasAssistantMessages={hasAssistantMessages}
        selectedAssistantMessageId={selectedAssistantMessageId}
        loadingSelection={loadingSelection}
      />
    </div>
  );
}

type StateUpdate<T> = T | ((current: T) => T);

function resolveNext<T>(current: T, update: StateUpdate<T>) {
  return typeof update === "function" ? (update as (current: T) => T)(current) : update;
}
