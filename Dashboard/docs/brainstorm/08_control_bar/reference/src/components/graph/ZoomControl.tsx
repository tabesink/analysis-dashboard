"use client";

import { FullscreenIcon, RotateCcwIcon, RotateCwIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useCamera, useSigma } from "@react-sigma/core";
import { Button } from "@/components/ui/button";

export default function ZoomControl() {
  const { zoomIn, zoomOut, reset } = useCamera({ duration: 200, factor: 1.5 });
  const sigma = useSigma();

  const rotateCamera = (delta: number) => {
    const camera = sigma.getCamera();
    const state = camera.getState();
    camera.animate({ angle: state.angle + delta }, { duration: 200 });
  };

  const resetZoom = () => {
    try {
      sigma.setCustomBBox(null);
      sigma.refresh();
      const graph = sigma.getGraph();
      if (!graph?.order || graph.nodes().length === 0) {
        reset();
        return;
      }
      sigma.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1.1 }, { duration: 1000 });
    } catch {
      reset();
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Rotate clockwise" title="Rotate clockwise" onClick={() => rotateCamera(Math.PI / 8)}>
        <RotateCwIcon className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Rotate counterclockwise"
        title="Rotate counterclockwise"
        onClick={() => rotateCamera(-Math.PI / 8)}
      >
        <RotateCcwIcon className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Reset zoom" title="Reset zoom" onClick={resetZoom}>
        <FullscreenIcon className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Zoom in" title="Zoom in" onClick={() => zoomIn()}>
        <ZoomInIcon className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Zoom out" title="Zoom out" onClick={() => zoomOut()}>
        <ZoomOutIcon className="size-4" />
      </Button>
    </>
  );
}
