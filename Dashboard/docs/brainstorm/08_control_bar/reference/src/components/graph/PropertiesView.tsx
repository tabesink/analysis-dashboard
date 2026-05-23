"use client";

import { useState } from "react";
import { CheckIcon, GitBranchPlus, PencilIcon, Scissors, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateEntity, updateRelation } from "@/api/lightrag";
import { useGraphStore, type RawEdgeType, type RawNodeType } from "@/stores/graph";
import { useSettingsStore } from "@/stores/settings";

export default function PropertiesView() {
  const selectedNode = useGraphStore.use.selectedNode();
  const focusedNode = useGraphStore.use.focusedNode();
  const selectedEdge = useGraphStore.use.selectedEdge();
  const focusedEdge = useGraphStore.use.focusedEdge();
  const rawGraph = useGraphStore.use.rawGraph();
  const sigmaGraph = useGraphStore.use.sigmaGraph();

  const item = resolveSelectedItem({ focusedEdge, focusedNode, rawGraph, selectedEdge, selectedNode });

  if (!item?.value) {
    return null;
  }

  const selectedItem = item as { kind: "node"; value: RawNodeType } | { kind: "edge"; value: RawEdgeType };

  return (
    <div className="max-h-[calc(100vh-7rem)] w-80 overflow-y-auto rounded-lg border-2 border-[var(--border)] bg-[var(--background)]/85 p-2 text-xs shadow-sm backdrop-blur-lg">
      {selectedItem.kind === "node" ? (
        <NodePropertiesView node={selectedItem.value} relationships={getNodeRelationships(selectedItem.value, rawGraph, sigmaGraph)} />
      ) : (
        <EdgePropertiesView edge={selectedItem.value} rawGraph={rawGraph} />
      )}
    </div>
  );
}

function NodePropertiesView({
  node,
  relationships,
}: {
  node: RawNodeType;
  relationships: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="pl-1 text-sm font-bold tracking-wide text-blue-700">Node</h3>
        <NodeActions node={node} />
      </div>

      <div className="max-h-32 overflow-auto rounded bg-[var(--primary)]/5 p-1">
        <ReadOnlyPropertyRow name="ID" value={String(node.id)} />
        <ReadOnlyPropertyRow
          name="Labels"
          value={node.labels.join(", ")}
          onClick={() => useGraphStore.getState().setSelectedNode(node.id, true)}
        />
        <ReadOnlyPropertyRow name="Degree" value={String(node.degree)} />
      </div>

      <h3 className="pl-1 text-sm font-bold tracking-wide text-amber-700">Properties</h3>
      <div className="max-h-40 overflow-auto rounded bg-[var(--primary)]/5 p-1">
        {Object.keys(node.properties)
          .filter((name) => name !== "created_at" && name !== "truncate")
          .sort(sortNodePropertyNames)
          .map((name) => (
            <PropertyRow
              key={name}
              name={displayPropertyName(name)}
              propertyKey={name}
              value={formatValue(node.properties[name])}
              item={{ kind: "node", value: node }}
              editable={name === "description" || name === "entity_id" || name === "entity_type"}
            />
          ))}
      </div>

      {relationships.length > 0 ? (
        <>
          <h3 className="pl-1 text-sm font-bold tracking-wide text-emerald-700">Relationships(with subgraph)</h3>
          <div className="max-h-40 overflow-auto rounded bg-[var(--primary)]/5 p-1">
            {relationships.map((relationship) => (
              <ReadOnlyPropertyRow
                key={relationship.id}
                name="Neigh"
                value={relationship.label}
                onClick={() => useGraphStore.getState().setSelectedNode(relationship.id, true)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function EdgePropertiesView({ edge, rawGraph }: { edge: RawEdgeType; rawGraph: ReturnType<typeof useGraphStore.getState>["rawGraph"] }) {
  const sourceNode = rawGraph?.getNode(edge.source);
  const targetNode = rawGraph?.getNode(edge.target);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="pl-1 text-sm font-bold tracking-wide text-violet-700">Edge</h3>
      <div className="max-h-40 overflow-auto rounded bg-[var(--primary)]/5 p-1">
        <ReadOnlyPropertyRow name="ID" value={edge.id} />
        {edge.type ? <ReadOnlyPropertyRow name="Type" value={edge.type} /> : null}
        <ReadOnlyPropertyRow
          name="Source"
          value={sourceNode?.labels.join(", ") || edge.source}
          onClick={() => useGraphStore.getState().setSelectedNode(edge.source, true)}
        />
        <ReadOnlyPropertyRow
          name="Target"
          value={targetNode?.labels.join(", ") || edge.target}
          onClick={() => useGraphStore.getState().setSelectedNode(edge.target, true)}
        />
      </div>

      <h3 className="pl-1 text-sm font-bold tracking-wide text-amber-700">Properties</h3>
      <div className="max-h-40 overflow-auto rounded bg-[var(--primary)]/5 p-1">
        {Object.keys(edge.properties)
          .filter((name) => name !== "created_at")
          .sort()
          .map((name) => (
            <PropertyRow
              key={name}
              name={displayPropertyName(name)}
              propertyKey={name}
              value={formatValue(edge.properties[name])}
              item={{ kind: "edge", value: edge }}
              editable={name === "description" || name === "keywords"}
            />
          ))}
      </div>
    </div>
  );
}

function NodeActions({ node }: { node: RawNodeType }) {
  return (
    <div className="flex gap-2">
      <Button
        variant="ghost"
        size="icon-xs"
        className="border border-gray-400 hover:bg-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
        aria-label="Expand node"
        onClick={() => useGraphStore.getState().triggerNodeExpand(node.id)}
      >
        <GitBranchPlus className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="border border-gray-400 hover:bg-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
        aria-label="Prune node"
        onClick={() => useGraphStore.getState().triggerNodePrune(node.id)}
      >
        <Scissors className="size-4" />
      </Button>
    </div>
  );
}

function PropertyRow({
  name,
  propertyKey,
  value,
  item,
  editable,
}: {
  name: string;
  propertyKey: string;
  value: string;
  item: { kind: "node"; value: RawNodeType } | { kind: "edge"; value: RawEdgeType };
  editable: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (item.kind === "node") {
        const entityId = String(item.value.properties.entity_id ?? item.value.id);
        await updateEntity(entityId, { [propertyKey]: draft }, propertyKey === "entity_id", true);
        await useGraphStore.getState().updateNodeAndSelect(item.value.id, entityId, propertyKey, draft);
        if (propertyKey === "entity_id") {
          useSettingsStore.getState().triggerSearchLabelDropdownRefresh();
        }
      } else {
        await updateRelation(item.value.source, item.value.target, { [propertyKey]: draft });
        await useGraphStore
          .getState()
          .updateEdgeAndSelect(item.value.id, item.value.dynamicId, item.value.source, item.value.target, propertyKey, draft);
      }
      toast.success("Property updated");
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update property");
      setDraft(value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="shrink-0 tracking-wide text-[var(--primary)]/60">
        {name}
        {editable ? (
          <button
            type="button"
            className="ml-1 inline-flex align-middle text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${name}`}
          >
            <PencilIcon className="size-3" />
          </button>
        ) : null}
      </span>
      <span>:</span>
      {editing ? (
        <span className="flex min-w-0 flex-1 items-center gap-1">
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} className="h-7 min-w-0 text-xs" />
          <Button variant="ghost" size="icon-xs" disabled={saving || draft === value} onClick={() => void save()} aria-label={`Save ${name}`}>
            <CheckIcon className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={saving}
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
            aria-label={`Cancel ${name}`}
          >
            <XIcon className="size-3" />
          </Button>
        </span>
      ) : (
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded p-1 hover:bg-[var(--primary)]/10" title={value}>
          {value}
        </span>
      )}
    </div>
  );
}

function ReadOnlyPropertyRow({ name, value, onClick }: { name: string; value: string; onClick?: () => void }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="shrink-0 tracking-wide text-[var(--primary)]/60">{name}</span>
      <span>:</span>
      <button
        type="button"
        disabled={!onClick}
        onClick={onClick}
        title={value}
        className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded p-1 text-left disabled:cursor-default enabled:hover:bg-[var(--primary)]/10"
      >
        {value}
      </button>
    </div>
  );
}

function getNodeRelationships(
  node: RawNodeType,
  rawGraph: ReturnType<typeof useGraphStore.getState>["rawGraph"],
  sigmaGraph: ReturnType<typeof useGraphStore.getState>["sigmaGraph"],
) {
  if (!rawGraph || !sigmaGraph || !sigmaGraph.hasNode(node.id)) return [];
  return sigmaGraph.edges(node.id).flatMap((edgeId) => {
    const edge = rawGraph.getEdge(edgeId, true);
    if (!edge) return [];
    const neighborId = node.id === edge.source ? edge.target : edge.source;
    const neighbor = rawGraph.getNode(neighborId);
    if (!neighbor) return [];
    return [
      {
        id: neighborId,
        label: String(neighbor.properties.entity_id ?? neighbor.labels.join(", ") ?? neighborId),
      },
    ];
  });
}

function resolveSelectedItem({
  focusedEdge,
  focusedNode,
  rawGraph,
  selectedEdge,
  selectedNode,
}: {
  focusedEdge: string | null;
  focusedNode: string | null;
  rawGraph: ReturnType<typeof useGraphStore.getState>["rawGraph"];
  selectedEdge: string | null;
  selectedNode: string | null;
}) {
  if (focusedNode) return { kind: "node" as const, value: rawGraph?.getNode(focusedNode) };
  if (selectedNode) return { kind: "node" as const, value: rawGraph?.getNode(selectedNode) };
  if (focusedEdge) return { kind: "edge" as const, value: rawGraph?.getEdge(focusedEdge) };
  if (selectedEdge) return { kind: "edge" as const, value: rawGraph?.getEdge(selectedEdge) };
  return null;
}

function displayPropertyName(name: string) {
  const displayNames: Record<string, string> = {
    description: "Description",
    entity_id: "Name",
    entity_type: "Type",
    file_path: "Source",
    source_id: "SrcID",
    section_path: "Section",
    section_paths: "Sections",
    section_node_id: "Section Node",
    section_node_ids: "Section Nodes",
    block_ids: "Blocks",
    artifact_manifest_path: "Manifest",
    artifact_manifest_paths: "Manifests",
    page_start: "Page Start",
    page_end: "Page End",
  };
  return displayNames[name] ?? name;
}

function sortNodePropertyNames(a: string, b: string) {
  const order = [
    "description",
    "entity_id",
    "entity_type",
    "section_path",
    "section_paths",
    "page_start",
    "page_end",
    "file_path",
    "source_id",
    "section_node_id",
    "section_node_ids",
    "block_ids",
    "artifact_manifest_path",
    "artifact_manifest_paths",
  ];
  const aIndex = order.indexOf(a);
  const bIndex = order.indexOf(b);
  if (aIndex !== -1 || bIndex !== -1) {
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  }
  return a.localeCompare(b);
}

function formatValue(value: unknown) {
  if (typeof value === "string") return value.replace(/<SEP>/g, ";\n");
  if (value === undefined || value === null) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
