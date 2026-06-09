"use client";

import type React from "react";
import { CircleHelp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LightRagDomain, RetrievalQueryMode, RetrievalSettings } from "@/types/chat";

type RetrievalSettingsPopoverProps = {
  settings: RetrievalSettings;
  onChange: (settings: RetrievalSettings) => void;
  lightragDomains: LightRagDomain[];
  trigger: React.ReactNode;
};

const MODES: RetrievalQueryMode[] = ["global", "local", "hybrid", "naive", "mix"];
const FIELD_DESCRIPTIONS = {
  knowledgebase: "Healthy LightRAG knowledgebase discovered from the local domain manifest.",
  mode: "Use mix for normal chat: it combines KG retrieval with direct vector chunks. Global is relationship-driven.",
  top_k: "Number of KG items to retrieve. Represents entities in local mode and relationships in global mode.",
  chunk_top_k: "Number of text chunks to retrieve initially from vector search.",
  chunk_rerank_top_k: "Number of text chunks to keep after reranking.",
  max_token_for_text_unit: "Maximum number of tokens allowed for each retrieved text chunk.",
  max_token_for_global_context: "Maximum number of tokens allocated for relationship descriptions in global retrieval.",
  max_token_for_local_context: "Maximum number of tokens allocated for entity descriptions in local retrieval.",
};

export function RetrievalSettingsPopover({
  settings,
  onChange,
  lightragDomains,
  trigger,
}: RetrievalSettingsPopoverProps) {
  const setNumber = (key: NumberSettingKey, value: string) => {
    const parsed = parsePositiveInteger(value);
    onChange({ ...settings, [key]: parsed });
  };

  const selectedDomain = lightragDomains.find((domain) => domain.port === settings.lightrag_port);

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="max-h-[min(32rem,calc(100vh-2rem))] w-72 overflow-y-auto p-3" align="start" side="top">
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-[var(--foreground)]">Retrieval Settings</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
              Choose one LightRAG knowledgebase and tune `/query/context`. Mix mode is recommended for question-specific chunks.
            </p>
          </div>

          <DomainSelect
            domains={lightragDomains}
            selectedPort={selectedDomain?.port}
            onChange={(port) => onChange({ ...settings, lightrag_port: port })}
          />

          <div className="space-y-1.5">
            <FieldLabel label="Query Mode" description={FIELD_DESCRIPTIONS.mode} />
            <Select
              value={settings.mode}
              onValueChange={(value) => onChange({ ...settings, mode: value as RetrievalQueryMode })}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {toTitleCase(mode)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <NumberField
              label="Top K Results"
              description={FIELD_DESCRIPTIONS.top_k}
              value={settings.top_k}
              onChange={(value) => setNumber("top_k", value)}
            />
            <NumberField
              label="Chunk Top K"
              description={FIELD_DESCRIPTIONS.chunk_top_k}
              value={settings.chunk_top_k}
              onChange={(value) => setNumber("chunk_top_k", value)}
            />
            <NumberField
              label="Rerank Top K"
              description={FIELD_DESCRIPTIONS.chunk_rerank_top_k}
              value={settings.chunk_rerank_top_k}
              onChange={(value) => setNumber("chunk_rerank_top_k", value)}
            />
            <NumberField
              label="Text Unit Tokens"
              description={FIELD_DESCRIPTIONS.max_token_for_text_unit}
              value={settings.max_token_for_text_unit}
              onChange={(value) => setNumber("max_token_for_text_unit", value)}
            />
            <NumberField
              label="Global Tokens"
              description={FIELD_DESCRIPTIONS.max_token_for_global_context}
              value={settings.max_token_for_global_context}
              onChange={(value) => setNumber("max_token_for_global_context", value)}
            />
            <NumberField
              label="Local Tokens"
              description={FIELD_DESCRIPTIONS.max_token_for_local_context}
              value={settings.max_token_for_local_context}
              onChange={(value) => setNumber("max_token_for_local_context", value)}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type NumberSettingKey = Exclude<keyof RetrievalSettings, "lightrag_port" | "mode" | "ids">;

type DomainSelectProps = {
  domains: LightRagDomain[];
  selectedPort?: number;
  onChange: (port: number) => void;
};

function DomainSelect({ domains, selectedPort, onChange }: DomainSelectProps) {
  if (domains.length === 0) {
    return (
      <div className="space-y-1.5">
        <FieldLabel label="Knowledgebase" description={FIELD_DESCRIPTIONS.knowledgebase} />
        <div className="rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
          No healthy LightRAG knowledgebases found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <FieldLabel label="Knowledgebase" description={FIELD_DESCRIPTIONS.knowledgebase} />
      <Select value={selectedPort ? String(selectedPort) : undefined} onValueChange={(value) => onChange(Number(value))}>
        <SelectTrigger className="h-8 w-full">
          <SelectValue placeholder="Choose a knowledgebase" />
        </SelectTrigger>
        <SelectContent>
          {domains.map((domain) => (
            <SelectItem key={domain.domain_id} value={String(domain.port)}>
              {domain.workspace} ({domain.port})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type NumberFieldProps = {
  label: string;
  description: string;
  value?: number;
  onChange: (value: string) => void;
};

function NumberField({ label, description, value, onChange }: NumberFieldProps) {
  return (
    <div className="space-y-1.5">
      <FieldLabel label={label} description={description} />
      <Input
        type="number"
        min={1}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 text-xs"
      />
    </div>
  );
}

type FieldLabelProps = {
  label: string;
  description: string;
};

function FieldLabel({ label, description }: FieldLabelProps) {
  return (
    <Label className="flex items-center gap-1.5 text-xs text-[var(--foreground)]" title={description}>
      <span>{label}</span>
      <CircleHelp className="size-3 text-[var(--muted-foreground)]" aria-hidden />
      <span className="sr-only">{description}</span>
    </Label>
  );
}

function parsePositiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function toTitleCase(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
