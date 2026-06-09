export type QueryMode = "naive" | "local" | "global" | "hybrid" | "mix" | "bypass";
export type RetrievalQueryMode = Exclude<QueryMode, "bypass">;

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  error?: string;
};

export type ActivityEntry = {
  id: string;
  label: string;
  detail: string;
  createdAt: number;
  status: "pending" | "complete" | "error";
};

export type ConversationHistoryItem = {
  role: ChatRole;
  content: string;
};

export type RetrievalSettings = {
  lightrag_port?: number;
  mode: RetrievalQueryMode;
  top_k?: number;
  chunk_top_k?: number;
  chunk_rerank_top_k?: number;
  max_token_for_text_unit?: number;
  max_token_for_global_context?: number;
  max_token_for_local_context?: number;
  ids?: string[];
};

export type LightRagDomain = {
  domain_id: string;
  workspace: string;
  port: number;
  service: string;
  base_url: string;
};

export type RetrievalChunkMetadata = {
  block_ids?: string[];
  artifact_refs?: string[];
  source_engine?: string;
  structure_status?: string;
  structure_version?: string;
  warnings?: string[];
  split_from_block_id?: string;
  [key: string]: unknown;
};

export type RetrievedChunk = {
  id: number;
  chunk_id?: string;
  content: string;
  file_path: string;
  full_doc_id?: string;
  source_type?: "vector" | "entity" | "relationship" | string;
  distance?: number;
  created_at?: number | string;
  tokens?: number;
  chunk_order_index?: number;
  page_start?: number;
  page_end?: number;
  section_path?: string;
  chunk_type?: string;
  artifact_manifest_path?: string;
  chunk_metadata?: RetrievalChunkMetadata;
};

export type RetrievalContext = {
  query: string;
  mode: Exclude<QueryMode, "bypass">;
  entities: Record<string, unknown>[];
  relationships: Record<string, unknown>[];
  chunks: RetrievedChunk[];
  retrieval_meta: Record<string, unknown>;
};

export type ContextPanelItem = {
  id: string;
  kind: "text" | "table" | "figure";
  title: string;
  content: string;
  page_start?: number | null;
  page_end?: number | null;
  section_path?: string | null;
  file_path?: string | null;
  chunk_id?: string | null;
  source_type?: string | null;
  handles: Record<string, unknown>;
};

export type AssistantTurnContext = {
  assistantMessageId: string;
  contextItems: ContextPanelItem[];
  retrievalSummary: string;
  sourceTree: SourceTreeSnapshot;
};

export type PipelineProgressStep =
  | "prepare"
  | "plan"
  | "retrieve"
  | "index"
  | "context"
  | "synthesize"
  | "stream"
  | "finalize";

export type PipelineProgressStatus = "running" | "complete" | "warning" | "failed";

export type PipelineProgressEvent = {
  event: "progress";
  assistant_message_id: string;
  step: PipelineProgressStep;
  status: PipelineProgressStatus;
  message: string;
};

export type SourceTreeItem = {
  name: string;
  kind?: string;
  children?: string[];
  handles?: Record<string, unknown>;
  retrieval_frame_ids?: string[];
};

export type SourceTreeSnapshot = {
  root_id: string;
  items: Record<string, SourceTreeItem>;
  expanded_item_ids?: string[];
};

export type BackendStreamEvent =
  | {
      event: "metadata";
      conversation_id: string;
      user_message_id: string;
      assistant_message_id: string;
    }
  | {
      event: "context";
      conversation_id: string;
      user_message_id: string;
      assistant_message_id: string;
      retrieval_frame_id: string | null;
      source_tree: SourceTreeSnapshot;
      context_items: ContextPanelItem[];
      retrieval_summary: string;
    }
  | PipelineProgressEvent
  | {
      event: "token";
      text: string;
    }
  | {
      event: "done";
      status: "completed" | "failed" | "cancelled";
    }
  | {
      event: "error";
      message: string;
    };
