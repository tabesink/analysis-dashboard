import { resolveApiBase } from "@/lib/api/client";
import type { BackendStreamEvent, LightRagDomain, RetrievalSettings } from "@/types/chat";

type StreamQueryOptions = {
  conversationId: string;
  query: string;
  retrievalSettings: RetrievalSettings;
  signal?: AbortSignal;
  onChunk: (chunk: string) => void;
  onContext?: (event: Extract<BackendStreamEvent, { event: "context" }>) => void;
  onMetadata?: (event: Extract<BackendStreamEvent, { event: "metadata" }>) => void;
  onProgress?: (event: Extract<BackendStreamEvent, { event: "progress" }>) => void;
};

export function endpointFromPort(port: number) {
  return `http://127.0.0.1:${port}`;
}

export async function fetchLightRagDomains(): Promise<LightRagDomain[]> {
  const response = await fetch(`${resolveApiBase()}/api/lightrag/domains`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`);
  }

  return (await response.json()) as LightRagDomain[];
}

export async function streamBackendMessage({
  conversationId,
  query,
  retrievalSettings,
  signal,
  onChunk,
  onContext,
  onMetadata,
  onProgress,
}: StreamQueryOptions) {
  const baseUrl = resolveApiBase();
  const response = await fetch(`${baseUrl}/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/x-ndjson",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: query,
      mode: retrievalSettings.mode,
      retrieval_settings: toBackendRetrievalSettings(retrievalSettings),
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`);
  }

  if (!response.body) {
    throw new Error("The server returned an empty stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      processLine(line, { onChunk, onContext, onMetadata, onProgress });
    }
  }

  if (buffer.trim()) {
    processLine(buffer, { onChunk, onContext, onMetadata, onProgress });
  }
}

function processLine(
  line: string,
  handlers: {
    onChunk: (chunk: string) => void;
    onContext?: (event: Extract<BackendStreamEvent, { event: "context" }>) => void;
    onMetadata?: (event: Extract<BackendStreamEvent, { event: "metadata" }>) => void;
    onProgress?: (event: Extract<BackendStreamEvent, { event: "progress" }>) => void;
  },
) {
  const trimmed = line.trim();
  if (!trimmed) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`Could not parse streaming response: ${trimmed}`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Unexpected streaming response: ${trimmed}`);
  }

  if (parsed.event === "error" && typeof parsed.message === "string") {
    throw new Error(parsed.message);
  }

  if (parsed.event === "metadata") {
    handlers.onMetadata?.(parsed as Extract<BackendStreamEvent, { event: "metadata" }>);
    return;
  }

  if (parsed.event === "context") {
    handlers.onContext?.(parsed as Extract<BackendStreamEvent, { event: "context" }>);
    return;
  }

  if (parsed.event === "progress") {
    handlers.onProgress?.(parsed as Extract<BackendStreamEvent, { event: "progress" }>);
    return;
  }

  if (parsed.event === "token" && typeof parsed.text === "string") {
    handlers.onChunk(parsed.text);
    return;
  }

  if (typeof parsed.response === "string") {
    handlers.onChunk(parsed.response);
  }
}

function toBackendRetrievalSettings(settings: RetrievalSettings) {
  const retrievalSettings = {
    lightrag_port: settings.lightrag_port,
    top_k: settings.top_k,
    chunk_top_k: settings.chunk_top_k,
    chunk_rerank_top_k: settings.chunk_rerank_top_k,
    max_token_for_text_unit: settings.max_token_for_text_unit,
    max_token_for_global_context: settings.max_token_for_global_context,
    max_token_for_local_context: settings.max_token_for_local_context,
    ids: settings.ids,
  };
  return Object.fromEntries(
    Object.entries(retrievalSettings).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined;
    }),
  );
}

async function readErrorDetail(response: Response) {
  try {
    const text = await response.text();
    if (!text) return "";
    try {
      const parsed = JSON.parse(text) as unknown;
      if (isRecord(parsed) && typeof parsed.detail === "string") {
        return parsed.detail;
      }
    } catch {
      return text;
    }
    return text;
  } catch {
    return "";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
