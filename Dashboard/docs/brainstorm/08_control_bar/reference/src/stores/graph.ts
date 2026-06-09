import { create } from "zustand";
import { DirectedGraph } from "graphology";
import MiniSearch from "minisearch";
import { createSelectors } from "@/lib/utils";
import { DEFAULT_NODE_COLOR, resolveNodeColor } from "@/utils/graphColor";

export type RawNodeType = {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
  size: number;
  x: number;
  y: number;
  color: string;
  degree: number;
};

export type RawEdgeType = {
  id: string;
  source: string;
  target: string;
  type?: string;
  properties: Record<string, unknown>;
  dynamicId: string;
};

export class RawGraph {
  nodes: RawNodeType[] = [];
  edges: RawEdgeType[] = [];
  nodeIdMap: Record<string, number> = {};
  edgeIdMap: Record<string, number> = {};
  edgeDynamicIdMap: Record<string, number> = {};

  getNode = (nodeId: string) => {
    const nodeIndex = this.nodeIdMap[nodeId];
    return nodeIndex === undefined ? undefined : this.nodes[nodeIndex];
  };

  getEdge = (edgeId: string, dynamicId = true) => {
    const edgeIndex = dynamicId ? this.edgeDynamicIdMap[edgeId] : this.edgeIdMap[edgeId];
    return edgeIndex === undefined ? undefined : this.edges[edgeIndex];
  };

  buildDynamicMap = () => {
    this.edgeDynamicIdMap = {};
    this.edges.forEach((edge, index) => {
      this.edgeDynamicIdMap[edge.dynamicId] = index;
    });
  };
}

type GraphState = {
  selectedNode: string | null;
  focusedNode: string | null;
  selectedEdge: string | null;
  focusedEdge: string | null;
  rawGraph: RawGraph | null;
  sigmaGraph: DirectedGraph | null;
  sigmaInstance: unknown | null;
  searchEngine: MiniSearch | null;
  moveToSelectedNode: boolean;
  isFetching: boolean;
  graphIsEmpty: boolean;
  lastSuccessfulQueryLabel: string;
  typeColorMap: Map<string, string>;
  graphDataFetchAttempted: boolean;
  labelsFetchAttempted: boolean;
  nodeToExpand: string | null;
  nodeToPrune: string | null;
  graphDataVersion: number;
  setSigmaInstance: (instance: unknown | null) => void;
  setSelectedNode: (nodeId: string | null, moveToSelectedNode?: boolean) => void;
  setFocusedNode: (nodeId: string | null) => void;
  setSelectedEdge: (edgeId: string | null) => void;
  setFocusedEdge: (edgeId: string | null) => void;
  clearSelection: () => void;
  reset: () => void;
  setMoveToSelectedNode: (moveToSelectedNode: boolean) => void;
  setGraphIsEmpty: (isEmpty: boolean) => void;
  setLastSuccessfulQueryLabel: (label: string) => void;
  setRawGraph: (rawGraph: RawGraph | null) => void;
  setSigmaGraph: (sigmaGraph: DirectedGraph | null) => void;
  setIsFetching: (isFetching: boolean) => void;
  setTypeColorMap: (typeColorMap: Map<string, string>) => void;
  setSearchEngine: (engine: MiniSearch | null) => void;
  resetSearchEngine: () => void;
  setGraphDataFetchAttempted: (attempted: boolean) => void;
  setLabelsFetchAttempted: (attempted: boolean) => void;
  triggerNodeExpand: (nodeId: string | null) => void;
  triggerNodePrune: (nodeId: string | null) => void;
  incrementGraphDataVersion: () => void;
  updateNodeAndSelect: (nodeId: string, entityId: string, propertyName: string, newValue: string) => Promise<void>;
  updateEdgeAndSelect: (
    edgeId: string,
    dynamicId: string,
    sourceId: string,
    targetId: string,
    propertyName: string,
    newValue: string,
  ) => Promise<void>;
};

const useGraphStoreBase = create<GraphState>()((set, get) => ({
  selectedNode: null,
  focusedNode: null,
  selectedEdge: null,
  focusedEdge: null,
  rawGraph: null,
  sigmaGraph: null,
  sigmaInstance: null,
  searchEngine: null,
  moveToSelectedNode: false,
  isFetching: false,
  graphIsEmpty: false,
  lastSuccessfulQueryLabel: "",
  typeColorMap: new Map<string, string>(),
  graphDataFetchAttempted: false,
  labelsFetchAttempted: false,
  nodeToExpand: null,
  nodeToPrune: null,
  graphDataVersion: 0,
  setSigmaInstance: (sigmaInstance) => set({ sigmaInstance }),
  setSelectedNode: (selectedNode, moveToSelectedNode = false) => set({ selectedNode, selectedEdge: null, moveToSelectedNode }),
  setFocusedNode: (focusedNode) => set({ focusedNode }),
  setSelectedEdge: (selectedEdge) => set({ selectedEdge, selectedNode: null }),
  setFocusedEdge: (focusedEdge) => set({ focusedEdge }),
  clearSelection: () => set({ selectedNode: null, focusedNode: null, selectedEdge: null, focusedEdge: null }),
  reset: () =>
    set({
      selectedNode: null,
      focusedNode: null,
      selectedEdge: null,
      focusedEdge: null,
      rawGraph: null,
      sigmaGraph: null,
      searchEngine: null,
      graphIsEmpty: false,
      moveToSelectedNode: false,
    }),
  setMoveToSelectedNode: (moveToSelectedNode) => set({ moveToSelectedNode }),
  setGraphIsEmpty: (graphIsEmpty) => set({ graphIsEmpty }),
  setLastSuccessfulQueryLabel: (lastSuccessfulQueryLabel) => set({ lastSuccessfulQueryLabel }),
  setRawGraph: (rawGraph) => set({ rawGraph }),
  setSigmaGraph: (sigmaGraph) => set({ sigmaGraph }),
  setIsFetching: (isFetching) => set({ isFetching }),
  setTypeColorMap: (typeColorMap) => set({ typeColorMap }),
  setSearchEngine: (searchEngine) => set({ searchEngine }),
  resetSearchEngine: () => set({ searchEngine: null }),
  setGraphDataFetchAttempted: (graphDataFetchAttempted) => set({ graphDataFetchAttempted }),
  setLabelsFetchAttempted: (labelsFetchAttempted) => set({ labelsFetchAttempted }),
  triggerNodeExpand: (nodeToExpand) => set({ nodeToExpand }),
  triggerNodePrune: (nodeToPrune) => set({ nodeToPrune }),
  incrementGraphDataVersion: () => set((state) => ({ graphDataVersion: state.graphDataVersion + 1 })),
  updateNodeAndSelect: async (nodeId, entityId, propertyName, newValue) => {
    const { sigmaGraph, rawGraph } = get();
    if (!sigmaGraph || !rawGraph) return;
    const rawNode = rawGraph.getNode(nodeId);
    if (!rawNode) return;
    rawNode.properties[propertyName] = newValue;
    if (propertyName === "entity_id" && nodeId === entityId && nodeId !== newValue && sigmaGraph.hasNode(nodeId)) {
      sigmaGraph.addNode(newValue, { ...sigmaGraph.getNodeAttributes(nodeId), label: newValue });
      for (const neighbor of sigmaGraph.neighbors(nodeId)) {
        sigmaGraph.addEdge(newValue, neighbor, { label: "", size: 1 });
      }
      sigmaGraph.dropNode(nodeId);
      set({ selectedNode: newValue });
      return;
    }
    if (sigmaGraph.hasNode(nodeId)) {
      sigmaGraph.setNodeAttribute(nodeId, "label", String(rawNode.properties.entity_id ?? rawNode.labels.join(", ")));
      if (propertyName === "entity_type") {
        const { color, map, updated } = resolveNodeColor(newValue, get().typeColorMap);
        const resolvedColor = color || DEFAULT_NODE_COLOR;
        rawNode.color = resolvedColor;
        sigmaGraph.setNodeAttribute(nodeId, "color", resolvedColor);
        if (updated) {
          set({ typeColorMap: map });
        }
      }
    }
    set({ selectedNode: nodeId });
  },
  updateEdgeAndSelect: async (edgeId, dynamicId, sourceId, targetId, propertyName, newValue) => {
    const { sigmaGraph, rawGraph } = get();
    if (!sigmaGraph || !rawGraph) return;
    const rawEdge = rawGraph.getEdge(dynamicId);
    if (rawEdge) rawEdge.properties[propertyName] = newValue;
    if (!sigmaGraph.hasEdge(dynamicId)) return;
    sigmaGraph.setEdgeAttribute(dynamicId, "label", String(rawEdge?.properties.description ?? `${sourceId} -> ${targetId}`));
    set({ selectedEdge: edgeId });
  },
}));

export const useGraphStore = createSelectors(useGraphStoreBase);
