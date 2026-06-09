"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { SigmaContainer, useRegisterEvents, useSigma } from "@react-sigma/core";
import type { Settings as SigmaSettings } from "sigma/settings";
import { EdgeArrowProgram, NodeCircleProgram, NodePointProgram } from "sigma/rendering";
import { NodeBorderProgram } from "@sigma/node-border";
import { EdgeCurvedArrowProgram, createEdgeCurveProgram } from "@sigma/edge-curve";
import FocusOnNode from "@/components/graph/FocusOnNode";
import FullScreenControl from "@/components/graph/FullScreenControl";
import GraphControl from "@/components/graph/GraphControl";
import LayoutsControl from "@/components/graph/LayoutsControl";
import Legend from "@/components/graph/Legend";
import LegendButton from "@/components/graph/LegendButton";
import PropertiesView from "@/components/graph/PropertiesView";
import Settings from "@/components/graph/Settings";
import SettingsDisplay from "@/components/graph/SettingsDisplay";
import ZoomControl from "@/components/graph/ZoomControl";
import { Button } from "@/components/ui/button";
import useLightragGraph from "@/hooks/useLightragGraph";
import { labelColorDarkTheme, labelColorLightTheme } from "@/lib/constants";
import { useGraphStore } from "@/stores/graph";
import { useSettingsStore } from "@/stores/settings";

import "@react-sigma/core/lib/style.css";

const createSigmaSettings = (isDarkTheme: boolean): Partial<SigmaSettings> => ({
  allowInvalidContainer: true,
  defaultNodeType: "default",
  defaultEdgeType: "curvedNoArrow",
  renderEdgeLabels: false,
  edgeProgramClasses: {
    arrow: EdgeArrowProgram,
    curvedArrow: EdgeCurvedArrowProgram,
    curvedNoArrow: createEdgeCurveProgram(),
  },
  nodeProgramClasses: {
    default: NodeBorderProgram,
    circle: NodeCircleProgram,
    point: NodePointProgram,
  },
  labelGridCellSize: 60,
  labelRenderedSizeThreshold: 12,
  enableEdgeEvents: true,
  labelColor: {
    color: isDarkTheme ? labelColorDarkTheme : labelColorLightTheme,
    attribute: "labelColor",
  },
  edgeLabelColor: {
    color: isDarkTheme ? labelColorDarkTheme : labelColorLightTheme,
    attribute: "labelColor",
  },
  edgeLabelSize: 8,
  labelSize: 12,
});

export default function GraphViewer() {
  useLightragGraph();
  const prevTheme = useRef("");
  const selectedNode = useGraphStore.use.selectedNode();
  const focusedNode = useGraphStore.use.focusedNode();
  const moveToSelectedNode = useGraphStore.use.moveToSelectedNode();
  const isFetching = useGraphStore.use.isFetching();
  const showPropertyPanel = useSettingsStore.use.showPropertyPanel();
  const enableNodeDrag = useSettingsStore.use.enableNodeDrag();
  const showLegend = useSettingsStore.use.showLegend();
  const theme = useSettingsStore.use.theme();
  const [isThemeSwitching, setIsThemeSwitching] = useState(false);

  const isDarkTheme = useMemo(
    () =>
      theme === "dark" ||
      (theme === "system" && typeof document !== "undefined" && document.documentElement.classList.contains("dark")),
    [theme],
  );

  const sigmaSettings = useMemo(() => createSigmaSettings(isDarkTheme), [isDarkTheme]);

  useEffect(() => {
    const changed = prevTheme.current && prevTheme.current !== theme;
    if (changed) {
      const switchTimer = window.setTimeout(() => setIsThemeSwitching(true), 0);
      const doneTimer = window.setTimeout(() => setIsThemeSwitching(false), 150);
      prevTheme.current = theme;
      return () => {
        window.clearTimeout(switchTimer);
        window.clearTimeout(doneTimer);
      };
    }
    prevTheme.current = theme;
  }, [theme]);

  useEffect(() => {
    return () => {
      const sigma = useGraphStore.getState().sigmaInstance as { kill?: () => void } | null;
      if (!sigma?.kill) return;
      try {
        sigma.kill();
        useGraphStore.getState().setSigmaInstance(null);
      } catch {
        // noop
      }
    };
  }, []);

  const autoFocusedNode = focusedNode ?? selectedNode;
  const refreshGraph = () => {
    useSettingsStore.getState().setQueryLabel("*");
    useGraphStore.getState().setGraphDataFetchAttempted(false);
    useGraphStore.getState().setLastSuccessfulQueryLabel("");
    useGraphStore.getState().incrementGraphDataVersion();
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <SigmaContainer settings={sigmaSettings} className="!size-full !bg-background overflow-hidden">
        <GraphControl />
        {enableNodeDrag ? <GraphDragEvents /> : null}
        <FocusOnNode node={autoFocusedNode} move={moveToSelectedNode} />

        <div className="absolute top-2 left-2 z-20">
          <div className="bg-background/60 flex flex-col rounded-xl border-2 backdrop-blur-lg">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Refresh graph"
              title="Refresh graph"
              onClick={refreshGraph}
              disabled={isFetching || isThemeSwitching}
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <LayoutsControl />
            <ZoomControl />
            <FullScreenControl />
            <LegendButton />
            <Settings />
          </div>
        </div>

        {showPropertyPanel ? (
          <div className="absolute top-2 right-2 z-10">
            <PropertiesView />
          </div>
        ) : null}

        {showLegend ? (
          <div className="absolute bottom-10 right-2 z-0">
            <Legend className="bg-background/60 backdrop-blur-lg" />
          </div>
        ) : null}

        <SettingsDisplay />
      </SigmaContainer>

      {(isFetching || isThemeSwitching) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <div className="text-center">
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p>{isThemeSwitching ? "Switching Theme..." : "Loading Graph Data..."}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function GraphDragEvents() {
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();
  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  useEffect(() => {
    registerEvents({
      downNode: (event) => {
        setDraggedNode(event.node);
        sigma.getGraph().setNodeAttribute(event.node, "highlighted", true);
      },
      mousemovebody: (event) => {
        if (!draggedNode) return;
        const position = sigma.viewportToGraph(event);
        sigma.getGraph().setNodeAttribute(draggedNode, "x", position.x);
        sigma.getGraph().setNodeAttribute(draggedNode, "y", position.y);
        event.preventSigmaDefault();
        event.original.preventDefault();
        event.original.stopPropagation();
      },
      mouseup: () => {
        if (!draggedNode) return;
        sigma.getGraph().removeNodeAttribute(draggedNode, "highlighted");
        setDraggedNode(null);
      },
      mousedown: (event) => {
        const mouseEvent = event.original as MouseEvent;
        if (mouseEvent.buttons !== 0 && !sigma.getCustomBBox()) {
          sigma.setCustomBBox(sigma.getBBox());
        }
      },
    });
  }, [draggedNode, registerEvents, sigma]);

  return null;
}
