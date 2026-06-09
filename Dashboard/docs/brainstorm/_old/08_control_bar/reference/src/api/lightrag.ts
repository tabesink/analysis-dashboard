import { resolveApiBase } from "@/lib/api/client";
import { popularLabelsDefaultLimit, searchLabelsDefaultLimit } from "@/lib/constants";
import { getSelectedLightRagPort } from "@/stores/lightrag-domain-store";

export type LightragNodeType = {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
};

export type LightragEdgeType = {
  id: string;
  source: string;
  target: string;
  type?: string;
  properties: Record<string, unknown>;
};

export type LightragGraphType = {
  nodes: LightragNodeType[];
  edges: LightragEdgeType[];
  is_truncated?: boolean;
};

export type EntityUpdateResponse = {
  status: string;
  message: string;
  data: Record<string, unknown>;
  operation_summary?: Record<string, unknown>;
};

export type DocActionResponse = {
  status: string;
  message: string;
};

export type QueryMode = "naive" | "local" | "global" | "hybrid" | "mix" | "bypass";

export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type QueryRequest = {
  query: string;
  mode: QueryMode;
  only_need_context?: boolean;
  only_need_prompt?: boolean;
  response_type?: string;
  stream?: boolean;
  top_k?: number;
  chunk_top_k?: number;
  max_entity_tokens?: number;
  max_relation_tokens?: number;
  max_total_tokens?: number;
  conversation_history?: Message[];
  history_turns?: number;
  user_prompt?: string;
  enable_rerank?: boolean;
};

export async function queryGraphs(label: string, maxDepth: number, maxNodes: number): Promise<LightragGraphType> {
  const params = new URLSearchParams({
    label,
    max_depth: String(maxDepth),
    max_nodes: String(maxNodes),
  });
  return request<LightragGraphType>(`/graphs?${params.toString()}`);
}

export async function fetchGraphEntityTypes(): Promise<string[]> {
  const response = await fetch(`${resolveApiBase()}/api/lightrag/entity-types`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`);
  }

  return (await response.json()) as string[];
}

export async function getPopularLabels(limit: number = popularLabelsDefaultLimit): Promise<string[]> {
  return request<string[]>(`/graph/label/popular?limit=${limit}`);
}

export async function searchLabels(query: string, limit: number = searchLabelsDefaultLimit): Promise<string[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return request<string[]>(`/graph/label/search?${params.toString()}`);
}

export async function checkEntityNameExists(entityName: string): Promise<boolean> {
  const params = new URLSearchParams({ name: entityName });
  const response = await request<{ exists: boolean }>(`/graph/entity/exists?${params.toString()}`);
  return response.exists;
}

export async function updateEntity(
  entityName: string,
  updatedData: Record<string, unknown>,
  allowRename = false,
  allowMerge = false,
): Promise<EntityUpdateResponse> {
  return request<EntityUpdateResponse>("/graph/entity/edit", {
    method: "POST",
    body: JSON.stringify({
      entity_name: entityName,
      updated_data: updatedData,
      allow_rename: allowRename,
      allow_merge: allowMerge,
    }),
  });
}

export async function updateRelation(
  sourceEntity: string,
  targetEntity: string,
  updatedData: Record<string, unknown>,
): Promise<DocActionResponse> {
  return request<DocActionResponse>("/graph/relation/edit", {
    method: "POST",
    body: JSON.stringify({
      source_id: sourceEntity,
      target_id: targetEntity,
      updated_data: updatedData,
    }),
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const port = getSelectedLightRagPort();
  const response = await fetch(`${resolveApiBase()}/api/lightrag/domains/${port}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`);
  }

  return (await response.json()) as T;
}

async function readErrorDetail(response: Response) {
  try {
    const data = (await response.json()) as unknown;
    if (typeof data === "object" && data !== null && "detail" in data && typeof data.detail === "string") {
      return data.detail;
    }
  } catch {
    return "";
  }
  return "";
}
