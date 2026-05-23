"use client";

import { useSyncExternalStore } from "react";
import type {
  ActivityEntry,
  AssistantTurnContext,
  ChatMessage,
  PipelineProgressEvent,
  SourceTreeItem,
  SourceTreeSnapshot,
} from "@/types/chat";

type ConnectionStatus = "idle" | "connecting" | "streaming" | "error";

type ChatSessionState = {
  messages: ChatMessage[];
  activities: ActivityEntry[];
  conversationId: string;
  contextByAssistantId: Record<string, AssistantTurnContext>;
  progressByAssistantId: Record<string, PipelineProgressEvent[]>;
  selectedAssistantMessageId?: string;
  sourceTree: SourceTreeSnapshot | null;
  status: ConnectionStatus;
  lastError?: string;
};

type ChatSessionPatch = Partial<ChatSessionState> | ((state: ChatSessionState) => Partial<ChatSessionState>);

const listeners = new Set<() => void>();

let state: ChatSessionState = {
  messages: [],
  activities: [],
  conversationId: createId("conv"),
  contextByAssistantId: {},
  progressByAssistantId: {},
  sourceTree: null,
  status: "idle",
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function setChatSessionState(patch: ChatSessionPatch) {
  const nextPatch = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...nextPatch };
  listeners.forEach((listener) => listener());
}

export function useChatSessionStore<T = ChatSessionState>(
  selector: (state: ChatSessionState) => T = (value) => value as T,
): T {
  return useSyncExternalStore(subscribe, () => selector(getSnapshot()), () => selector(getSnapshot()));
}

export function mergeSourceTrees(
  existingTree: SourceTreeSnapshot | null,
  incomingTree: SourceTreeSnapshot,
): SourceTreeSnapshot {
  if (!existingTree) return incomingTree;

  const items: Record<string, SourceTreeItem> = { ...existingTree.items };
  for (const [itemId, incomingItem] of Object.entries(incomingTree.items)) {
    const existingItem = items[itemId];
    if (!existingItem) {
      items[itemId] = incomingItem;
      continue;
    }

    items[itemId] = {
      ...existingItem,
      ...incomingItem,
      children: mergeUnique(existingItem.children, incomingItem.children),
      retrieval_frame_ids: mergeUnique(existingItem.retrieval_frame_ids, incomingItem.retrieval_frame_ids),
      handles: {
        ...existingItem.handles,
        ...incomingItem.handles,
      },
    };
  }

  return {
    root_id: existingTree.root_id || incomingTree.root_id,
    items,
    expanded_item_ids: mergeUnique(existingTree.expanded_item_ids, incomingTree.expanded_item_ids),
  };
}

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mergeUnique<T>(left: T[] | undefined, right: T[] | undefined) {
  return [...new Set([...(left ?? []), ...(right ?? [])])];
}
