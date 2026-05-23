import { useCallback, useEffect } from "react";
import { DirectedGraph } from "graphology";
import MiniSearch from "minisearch";
import { toast } from "sonner";
import { fetchGraphEntityTypes, queryGraphs } from "@/api/lightrag";
import { buildVisualizationLayout } from "@/lib/graph/visualizationModes";
import { edgeColorLightTheme, maxNodeSize, minNodeSize, nodeBorderColor } from "@/lib/constants";
import { errorMessage } from "@/lib/utils";
import { useLightRagDomainStore } from "@/stores/lightrag-domain-store";
import { RawGraph, type RawEdgeType, type RawNodeType, useGraphStore } from "@/stores/graph";
import { useSettingsStore } from "@/stores/settings";
import { useBackendState } from "@/stores/state";
import { configurePromptEntityTypes, DEFAULT_NODE_COLOR, normalizeNodeType, resolveNodeColor } from "@/utils/graphColor";

export type NodeType = {
  x: number;
  y: number;
  label: string;
  size: number;
  color: string;
  highlighted?: boolean;
  borderColor?: string;
  borderSize?: number;
};

export type EdgeType = {
  label: string;
  originalWeight?: number;
  size?: number;
  color?: string;
  type?: string;
  hidden?: boolean;
};

export default function useLightragGraph() {
  const selectedPort = useLightRagDomainStore((state) => state.selectedPort);
  const queryLabel = useSettingsStore.use.queryLabel();
  const maxDepth = useSettingsStore.use.graphQueryMaxDepth();
  const maxNodes = useSettingsStore.use.graphMaxNodes();
  const dataVersion = useGraphStore.use.graphDataVersion();
  const nodeToExpand = useGraphStore.use.nodeToExpand();
  const nodeToPrune = useGraphStore.use.nodeToPrune();

  const loadGraph = useCallback(async () => {
    const label = queryLabel?.trim() || "*";
    useGraphStore.getState().setIsFetching(true);
    useGraphStore.getState().setGraphDataFetchAttempted(true);
    useBackendState.getState().setPipelineBusy(true);

    try {
      const entityTypes = await fetchGraphEntityTypes();
      configurePromptEntityTypes(entityTypes);
      const graph = await queryGraphs(label, maxDepth, maxNodes);
      const { rawGraph } = toRawGraph(graph);
      const sigmaGraph = toSigmaGraph(rawGraph);
      const searchEngine = createSearchEngine(rawGraph);

      useGraphStore.getState().setRawGraph(rawGraph);
      useGraphStore.getState().setSigmaGraph(sigmaGraph);
      useGraphStore.getState().setSearchEngine(searchEngine);
      useGraphStore.getState().setGraphIsEmpty(rawGraph.nodes.length === 0);
      useGraphStore.getState().setLastSuccessfulQueryLabel(label);
      if (graph.is_truncated) {
        toast.info(`Graph was truncated to ${maxNodes} nodes.`);
      }
    } catch (error) {
      useBackendState.getState().setErrorMessage(errorMessage(error), "Query Graphs Error");
      toast.error(errorMessage(error));
      useGraphStore.getState().setGraphIsEmpty(true);
    } finally {
      useGraphStore.getState().setIsFetching(false);
      useBackendState.getState().setPipelineBusy(false);
    }
  }, [maxDepth, maxNodes, queryLabel]);

  useEffect(() => {
    void loadGraph();
  }, [dataVersion, loadGraph, selectedPort]);

  useEffect(() => {
    if (!nodeToExpand) return;
    const handleExpand = async () => {
      const { rawGraph, sigmaGraph } = useGraphStore.getState();
      if (!rawGraph || !sigmaGraph || !sigmaGraph.hasNode(nodeToExpand)) return;
      const node = rawGraph.getNode(nodeToExpand);
      const label = String(node?.labels[0] ?? node?.properties.entity_id ?? nodeToExpand);
      if (!label) return;

      try {
        const extendedGraph = await queryGraphs(label, 2, 1000);
        if (!extendedGraph?.nodes || !extendedGraph?.edges) return;

        const existingNodeIds = new Set(rawGraph.nodes.map((item) => item.id));
        const existingEdgeIds = new Set(rawGraph.edges.map((item) => item.id));
        const connectableNewNodeIds = new Set<string>();
        const processedNodes = extendedGraph.nodes.map((rawNode) => {
          const id = String(rawNode.id);
          const labels = Array.isArray(rawNode.labels) ? rawNode.labels.map(String) : [id];
          const properties = isRecord(rawNode.properties) ? rawNode.properties : {};
          const type = normalizeNodeType(typeof properties.entity_type === "string" ? properties.entity_type : undefined);
          return {
            id,
            labels,
            properties,
            size: minNodeSize,
            x: 0,
            y: 0,
            color: colorForType(type),
            degree: 0,
          } satisfies RawNodeType;
        });

        for (const edge of extendedGraph.edges) {
          const source = String(edge.source);
          const target = String(edge.target);
          const connectedToExpanded = source === nodeToExpand || target === nodeToExpand;
          if (!connectedToExpanded) continue;
          if (!existingNodeIds.has(source)) connectableNewNodeIds.add(source);
          if (!existingNodeIds.has(target)) connectableNewNodeIds.add(target);
        }

        if (connectableNewNodeIds.size === 0) {
          toast.info("No new neighboring nodes to expand.");
          return;
        }

        const originX = sigmaGraph.getNodeAttribute(nodeToExpand, "x") as number;
        const originY = sigmaGraph.getNodeAttribute(nodeToExpand, "y") as number;
        const spread = Math.max(3, Math.sqrt(connectableNewNodeIds.size) * 2.4);
        const newNodeSet = new Set(connectableNewNodeIds);
        let addedNodeCount = 0;

        for (const nodeId of connectableNewNodeIds) {
          const nextNode = processedNodes.find((item) => item.id === nodeId);
          if (!nextNode) continue;
          const angle = (Math.PI * 2 * addedNodeCount) / connectableNewNodeIds.size;
          const x = originX + Math.cos(angle) * spread;
          const y = originY + Math.sin(angle) * spread;
          nextNode.x = x;
          nextNode.y = y;
          rawGraph.nodes.push(nextNode);
          rawGraph.nodeIdMap[nextNode.id] = rawGraph.nodes.length - 1;
          sigmaGraph.addNode(nextNode.id, {
            label: String(nextNode.properties.entity_id ?? nextNode.labels.join(", ") ?? nextNode.id),
            color: nextNode.color,
            x,
            y,
            size: nextNode.size,
            borderColor: nodeBorderColor,
            borderSize: 0.2,
          });
          addedNodeCount += 1;
        }

        let addedEdgeCount = 0;
        for (const edge of extendedGraph.edges) {
          const source = String(edge.source);
          const target = String(edge.target);
          const bothKnown = sigmaGraph.hasNode(source) && sigmaGraph.hasNode(target);
          if (!bothKnown) continue;

          const id = String(edge.id ?? `${source}-${target}`);
          if (existingEdgeIds.has(id)) continue;
          if (!newNodeSet.has(source) && !newNodeSet.has(target) && source !== nodeToExpand && target !== nodeToExpand) {
            continue;
          }

          const properties = isRecord(edge.properties) ? edge.properties : {};
          const weight = Number(properties.weight ?? properties.keywords?.toString().length ?? 1);
          const dynamicId = `${id}-${rawGraph.edges.length + addedEdgeCount}`;
          if (sigmaGraph.hasEdge(dynamicId)) continue;

          sigmaGraph.addDirectedEdgeWithKey(dynamicId, source, target, {
            label: String(properties.description ?? edge.type ?? ""),
            originalWeight: Number.isFinite(weight) ? weight : 1,
            size: 1,
            color: edgeColorLightTheme,
            type: "curvedNoArrow",
          });
          rawGraph.edges.push({
            id,
            source,
            target,
            ...(typeof edge.type === "string" ? { type: edge.type } : {}),
            properties,
            dynamicId,
          });
          existingEdgeIds.add(id);
          addedEdgeCount += 1;
        }

        rebuildRawGraphIndexes(rawGraph);
        recomputeNodeSizes(rawGraph);
        syncNodeSizesToSigma(rawGraph, sigmaGraph);
        applyEdgeSizeScale(sigmaGraph, useSettingsStore.getState().minEdgeSize, useSettingsStore.getState().maxEdgeSize);
        useGraphStore.getState().setSearchEngine(createSearchEngine(rawGraph));
        useGraphStore.getState().setSigmaGraph(sigmaGraph);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        useGraphStore.getState().triggerNodeExpand(null);
      }
    };
    void handleExpand();
  }, [nodeToExpand]);

  useEffect(() => {
    if (!nodeToPrune) return;
    const handlePrune = () => {
      const { rawGraph, sigmaGraph } = useGraphStore.getState();
      if (!rawGraph || !sigmaGraph || !sigmaGraph.hasNode(nodeToPrune)) {
        useGraphStore.getState().triggerNodePrune(null);
        return;
      }

      const nodesToDelete = getNodesThatWillBeDeleted(nodeToPrune, sigmaGraph);
      if (nodesToDelete.size === sigmaGraph.order) {
        toast.error("Cannot prune every node from the current graph.");
        useGraphStore.getState().triggerNodePrune(null);
        return;
      }

      useGraphStore.getState().clearSelection();
      for (const nodeId of nodesToDelete) {
        if (sigmaGraph.hasNode(nodeId)) {
          sigmaGraph.dropNode(nodeId);
        }
      }

      rawGraph.nodes = rawGraph.nodes.filter((node) => !nodesToDelete.has(node.id));
      rawGraph.edges = rawGraph.edges.filter((edge) => !nodesToDelete.has(edge.source) && !nodesToDelete.has(edge.target));
      rebuildRawGraphIndexes(rawGraph);
      recomputeNodeSizes(rawGraph);
      useGraphStore.getState().setSearchEngine(createSearchEngine(rawGraph));
      useGraphStore.getState().triggerNodePrune(null);
    };

    handlePrune();
  }, [nodeToPrune]);

  return {
    refresh: loadGraph,
    getNode: (id: string) => useGraphStore.getState().rawGraph?.getNode(id),
    getEdge: (id: string) => useGraphStore.getState().rawGraph?.getEdge(id),
  };
}

function toRawGraph(
  graph: { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> },
) {
  const rawGraph = new RawGraph();
  rawGraph.nodes = graph.nodes.map((node) => {
    const id = String(node.id);
    const labels = Array.isArray(node.labels) ? node.labels.map(String) : [id];
    const properties = isRecord(node.properties) ? node.properties : {};
    const type = normalizeNodeType(typeof properties.entity_type === "string" ? properties.entity_type : undefined);
    const color = colorForType(type);
    return {
      id,
      labels,
      properties,
      size: minNodeSize,
      x: 0,
      y: 0,
      color,
      degree: 0,
    } satisfies RawNodeType;
  });

  rawGraph.nodes.forEach((node, index) => {
    rawGraph.nodeIdMap[node.id] = index;
  });

  const rawEdges: RawEdgeType[] = [];
  graph.edges.forEach((edge, index) => {
    const source = String(edge.source);
    const target = String(edge.target);
    if (rawGraph.nodeIdMap[source] === undefined || rawGraph.nodeIdMap[target] === undefined) {
      return;
    }
    rawGraph.nodes[rawGraph.nodeIdMap[source]].degree += 1;
    rawGraph.nodes[rawGraph.nodeIdMap[target]].degree += 1;
    const id = String(edge.id ?? `${source}-${target}-${index}`);
    rawEdges.push({
      id,
      source,
      target,
      ...(typeof edge.type === "string" ? { type: edge.type } : {}),
      properties: isRecord(edge.properties) ? edge.properties : {},
      dynamicId: `${id}-${index}`,
    });
  });
  rawGraph.edges = rawEdges;

  rawGraph.edges.forEach((edge, index) => {
    rawGraph.edgeIdMap[edge.id] = index;
  });
  rawGraph.buildDynamicMap();

  const degrees = rawGraph.nodes.map((node) => node.degree);
  const minDegree = Math.min(...degrees, 0);
  const maxDegree = Math.max(...degrees, 1);
  const range = Math.max(maxDegree - minDegree, 1);
  rawGraph.nodes.forEach((node) => {
    node.size = Math.round(minNodeSize + (maxNodeSize - minNodeSize) * Math.sqrt((node.degree - minDegree) / range));
  });

  const { positions } = buildVisualizationLayout(rawGraph.nodes);
  rawGraph.nodes.forEach((node) => {
    const position = positions[node.id];
    if (!position) return;
    node.x = position.x;
    node.y = position.y;
  });

  return { rawGraph };
}

function toSigmaGraph(rawGraph: RawGraph) {
  const graph = new DirectedGraph<NodeType, EdgeType>();
  rawGraph.nodes.forEach((node) => {
    graph.addNode(node.id, {
      label: String(node.properties.entity_id ?? node.labels.join(", ") ?? node.id),
      color: node.color,
      x: node.x,
      y: node.y,
      size: node.size,
      borderColor: nodeBorderColor,
      borderSize: 0.2,
    });
  });

  rawGraph.edges.forEach((edge) => {
    const weight = Number(edge.properties.weight ?? edge.properties.keywords?.toString().length ?? 1);
    graph.addDirectedEdgeWithKey(edge.dynamicId, edge.source, edge.target, {
      label: String(edge.properties.description ?? edge.type ?? ""),
      originalWeight: Number.isFinite(weight) ? weight : 1,
      size: 1,
      color: edgeColorLightTheme,
      type: "curvedNoArrow",
    });
  });

  return graph;
}

function createSearchEngine(rawGraph: RawGraph) {
  const searchEngine = new MiniSearch<{ id: string; label: string }>({
    fields: ["label"],
    storeFields: ["id", "label"],
    searchOptions: { fuzzy: 0.2, prefix: true },
  });
  searchEngine.addAll(
    rawGraph.nodes.map((node) => ({
      id: node.id,
      label: String(node.properties.entity_id ?? node.labels.join(", ") ?? node.id),
    })),
  );
  return searchEngine;
}

function rebuildRawGraphIndexes(rawGraph: RawGraph) {
  rawGraph.nodeIdMap = {};
  rawGraph.edgeIdMap = {};
  rawGraph.nodes.forEach((node, index) => {
    rawGraph.nodeIdMap[node.id] = index;
  });
  rawGraph.edges.forEach((edge, index) => {
    rawGraph.edgeIdMap[edge.id] = index;
  });
  rawGraph.buildDynamicMap();
}

function recomputeNodeSizes(rawGraph: RawGraph) {
  rawGraph.nodes.forEach((node) => {
    node.degree = 0;
  });
  rawGraph.edges.forEach((edge) => {
    const source = rawGraph.getNode(edge.source);
    const target = rawGraph.getNode(edge.target);
    if (source) source.degree += 1;
    if (target) target.degree += 1;
  });
  const degrees = rawGraph.nodes.map((node) => node.degree);
  const minDegree = Math.min(...degrees, 0);
  const maxDegree = Math.max(...degrees, 1);
  const range = Math.max(maxDegree - minDegree, 1);
  rawGraph.nodes.forEach((node) => {
    node.size = Math.round(minNodeSize + (maxNodeSize - minNodeSize) * Math.sqrt((node.degree - minDegree) / range));
  });
}

function syncNodeSizesToSigma(rawGraph: RawGraph, sigmaGraph: DirectedGraph) {
  rawGraph.nodes.forEach((node) => {
    if (!sigmaGraph.hasNode(node.id)) return;
    sigmaGraph.setNodeAttribute(node.id, "size", node.size);
  });
}

function applyEdgeSizeScale(sigmaGraph: DirectedGraph, minEdgeSize: number, maxEdgeSize: number) {
  let minWeight = Number.POSITIVE_INFINITY;
  let maxWeight = Number.NEGATIVE_INFINITY;
  sigmaGraph.forEachEdge((edge) => {
    const weight = sigmaGraph.getEdgeAttribute(edge, "originalWeight");
    if (typeof weight === "number" && Number.isFinite(weight)) {
      minWeight = Math.min(minWeight, weight);
      maxWeight = Math.max(maxWeight, weight);
    }
  });
  if (!Number.isFinite(minWeight) || !Number.isFinite(maxWeight)) {
    sigmaGraph.forEachEdge((edge) => sigmaGraph.setEdgeAttribute(edge, "size", minEdgeSize));
    return;
  }
  const range = maxWeight - minWeight;
  const scale = maxEdgeSize - minEdgeSize;
  sigmaGraph.forEachEdge((edge) => {
    const weight = Number(sigmaGraph.getEdgeAttribute(edge, "originalWeight") ?? minWeight);
    const normalized = range === 0 ? 0 : Math.pow((weight - minWeight) / range, 0.5);
    sigmaGraph.setEdgeAttribute(edge, "size", minEdgeSize + scale * normalized);
  });
}

function getNodesThatWillBeDeleted(nodeId: string, sigmaGraph: DirectedGraph) {
  const nodesToDelete = new Set<string>([nodeId]);
  sigmaGraph.forEachNode((node) => {
    if (node === nodeId) return;
    const neighbors = sigmaGraph.neighbors(node);
    if (neighbors.length === 1 && neighbors[0] === nodeId) {
      nodesToDelete.add(node);
    }
  });
  return nodesToDelete;
}

function colorForType(type: string) {
  const state = useGraphStore.getState();
  const { color, map, updated } = resolveNodeColor(type, state.typeColorMap);
  if (updated) {
    useGraphStore.setState({ typeColorMap: map });
  }
  return color || DEFAULT_NODE_COLOR;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
