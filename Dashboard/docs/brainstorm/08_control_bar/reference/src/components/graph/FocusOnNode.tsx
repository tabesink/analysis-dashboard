"use client";

import { useEffect } from "react";
import { useCamera, useSigma } from "@react-sigma/core";
import { useGraphStore } from "@/stores/graph";

type FocusOnNodeProps = {
  node: string | null;
  move: boolean;
};

export default function FocusOnNode({ node, move }: FocusOnNodeProps) {
  const sigma = useSigma();
  const { gotoNode } = useCamera();

  useEffect(() => {
    const graph = sigma.getGraph();

    if (move) {
      if (node && graph.hasNode(node)) {
        graph.setNodeAttribute(node, "highlighted", true);
        gotoNode(node);
      } else {
        sigma.setCustomBBox(null);
        sigma.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 0 });
      }
      useGraphStore.getState().setMoveToSelectedNode(false);
    } else if (node && graph.hasNode(node)) {
      graph.setNodeAttribute(node, "highlighted", true);
    }

    return () => {
      if (node && graph.hasNode(node)) {
        graph.setNodeAttribute(node, "highlighted", false);
      }
    };
  }, [gotoNode, move, node, sigma]);

  return null;
}
