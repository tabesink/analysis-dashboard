"use client";

import { useEffect } from "react";
import { useLoadGraph, useRegisterEvents, useSetSettings, useSigma } from "@react-sigma/core";
import { useGraphStore } from "@/stores/graph";
import { useSettingsStore } from "@/stores/settings";
import {
  edgeColorDarkTheme,
  edgeColorHighlightedDarkTheme,
  edgeColorHighlightedLightTheme,
  edgeColorSelected,
  labelColorDarkTheme,
  labelColorHighlightedDarkTheme,
  nodeBorderColorSelected,
  nodeColorDisabled,
} from "@/lib/constants";

const isButtonPressed = (ev: MouseEvent | TouchEvent) => {
  if (ev.type.startsWith("mouse")) {
    return (ev as MouseEvent).buttons !== 0;
  }
  return false;
};

export default function GraphControl() {
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();
  const setSettings = useSetSettings();
  const sigmaGraph = useGraphStore.use.sigmaGraph();
  const showNodeLabel = useSettingsStore.use.showNodeLabel();
  const showEdgeLabel = useSettingsStore.use.showEdgeLabel();
  const enableEdgeEvents = useSettingsStore.use.enableEdgeEvents();
  const hideUnselectedEdges = useSettingsStore.use.enableHideUnselectedEdges();
  const minEdgeSize = useSettingsStore.use.minEdgeSize();
  const maxEdgeSize = useSettingsStore.use.maxEdgeSize();
  const selectedNode = useGraphStore.use.selectedNode();
  const focusedNode = useGraphStore.use.focusedNode();
  const selectedEdge = useGraphStore.use.selectedEdge();
  const focusedEdge = useGraphStore.use.focusedEdge();
  const theme = useSettingsStore.use.theme();

  useEffect(() => {
    if (!sigmaGraph) return;
    loadGraph(sigmaGraph);
    useGraphStore.getState().setSigmaInstance(sigma);
  }, [loadGraph, sigma, sigmaGraph]);

  useEffect(() => {
    const isDarkTheme =
      theme === "dark" || (theme === "system" && document.documentElement.classList.contains("dark"));
    const labelColor = isDarkTheme ? labelColorDarkTheme : undefined;
    const edgeColor = isDarkTheme ? edgeColorDarkTheme : undefined;
    const edgeHighlightColor = isDarkTheme ? edgeColorHighlightedDarkTheme : edgeColorHighlightedLightTheme;

    setSettings({
      renderLabels: showNodeLabel,
      renderEdgeLabels: showEdgeLabel,
      enableEdgeEvents,
      nodeReducer: (node, data) => {
        const graph = sigma.getGraph();
        const nodeData: {
          highlighted?: boolean;
          color?: string;
          size?: number;
          borderColor?: string;
          labelColor?: string;
        } = { ...data, highlighted: false, labelColor };

        const activeNode = focusedNode ?? selectedNode;
        const activeEdge = focusedEdge ?? selectedEdge;

        if (activeNode && graph.hasNode(activeNode)) {
          if (node === activeNode || graph.neighbors(activeNode).includes(node)) {
            nodeData.highlighted = true;
            if (node === selectedNode) {
              nodeData.borderColor = nodeBorderColorSelected;
            }
          }
        } else if (activeEdge && graph.hasEdge(activeEdge)) {
          if (graph.extremities(activeEdge).includes(node)) {
            nodeData.highlighted = true;
            nodeData.size = Math.max((typeof data.size === "number" ? data.size : 1) + 1, 3);
          }
        }

        if (nodeData.highlighted) {
          if (isDarkTheme) {
            nodeData.labelColor = labelColorHighlightedDarkTheme;
          }
        } else if (activeNode || activeEdge) {
          nodeData.color = nodeColorDisabled;
        }

        return nodeData;
      },
      edgeReducer: (edge, data) => {
        const graph = sigma.getGraph();
        const edgeData: { hidden?: boolean; labelColor?: string; color?: string } = {
          ...data,
          hidden: false,
          labelColor,
          color: edgeColor,
        };

        const activeNode = focusedNode ?? selectedNode;
        if (activeNode && graph.hasNode(activeNode)) {
          if (hideUnselectedEdges && !graph.extremities(edge).includes(activeNode)) {
            edgeData.hidden = true;
          } else if (graph.extremities(edge).includes(activeNode)) {
            edgeData.color = edgeHighlightColor;
          }
          return edgeData;
        }

        const activeSelectedEdge = selectedEdge && graph.hasEdge(selectedEdge) ? selectedEdge : null;
        const activeFocusedEdge = focusedEdge && graph.hasEdge(focusedEdge) ? focusedEdge : null;
        if (activeSelectedEdge || activeFocusedEdge) {
          if (edge === activeSelectedEdge) {
            edgeData.color = edgeColorSelected;
          } else if (edge === activeFocusedEdge) {
            edgeData.color = edgeHighlightColor;
          } else if (hideUnselectedEdges) {
            edgeData.hidden = true;
          }
        }

        return edgeData;
      },
    });
  }, [
    enableEdgeEvents,
    focusedEdge,
    focusedNode,
    hideUnselectedEdges,
    selectedEdge,
    selectedNode,
    setSettings,
    showEdgeLabel,
    showNodeLabel,
    sigma,
    theme,
  ]);

  useEffect(() => {
    const handlers: Record<string, unknown> = {
      clickNode: (event: { node: string }) => useGraphStore.getState().setSelectedNode(event.node),
      enterNode: (event: { node: string; event: { original: MouseEvent | TouchEvent } }) => {
        if (!isButtonPressed(event.event.original)) {
          useGraphStore.getState().setFocusedNode(event.node);
        }
      },
      leaveNode: (event: { event: { original: MouseEvent | TouchEvent } }) => {
        if (!isButtonPressed(event.event.original)) {
          useGraphStore.getState().setFocusedNode(null);
        }
      },
      clickStage: () => useGraphStore.getState().clearSelection(),
    };

    if (enableEdgeEvents) {
      handlers.clickEdge = (event: { edge: string }) => useGraphStore.getState().setSelectedEdge(event.edge);
      handlers.enterEdge = (event: { edge: string; event: { original: MouseEvent | TouchEvent } }) => {
        if (!isButtonPressed(event.event.original)) {
          useGraphStore.getState().setFocusedEdge(event.edge);
        }
      };
      handlers.leaveEdge = (event: { event: { original: MouseEvent | TouchEvent } }) => {
        if (!isButtonPressed(event.event.original)) {
          useGraphStore.getState().setFocusedEdge(null);
        }
      };
    }

    registerEvents(handlers);
  }, [enableEdgeEvents, registerEvents]);

  useEffect(() => {
    if (!sigmaGraph) return;
    const graph = sigma.getGraph();

    let minWeight = Number.POSITIVE_INFINITY;
    let maxWeight = Number.NEGATIVE_INFINITY;
    graph.forEachEdge((edge) => {
      const weight = graph.getEdgeAttribute(edge, "originalWeight");
      if (typeof weight === "number" && Number.isFinite(weight)) {
        minWeight = Math.min(minWeight, weight);
        maxWeight = Math.max(maxWeight, weight);
      }
    });

    if (!Number.isFinite(minWeight) || !Number.isFinite(maxWeight)) {
      graph.forEachEdge((edge) => graph.setEdgeAttribute(edge, "size", minEdgeSize));
      sigma.refresh();
      return;
    }

    const weightRange = maxWeight - minWeight;
    const sizeScale = maxEdgeSize - minEdgeSize;
    graph.forEachEdge((edge) => {
      const raw = graph.getEdgeAttribute(edge, "originalWeight");
      const weight = typeof raw === "number" && Number.isFinite(raw) ? raw : minWeight;
      const normalized = weightRange === 0 ? 0 : Math.pow((weight - minWeight) / weightRange, 0.5);
      graph.setEdgeAttribute(edge, "size", minEdgeSize + sizeScale * normalized);
    });
    sigma.refresh();
  }, [maxEdgeSize, minEdgeSize, sigma, sigmaGraph]);

  return null;
}
