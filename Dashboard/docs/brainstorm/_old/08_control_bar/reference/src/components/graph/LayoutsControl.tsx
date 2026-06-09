"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useSigma } from "@react-sigma/core";
import { useLayoutCirclepack } from "@react-sigma/layout-circlepack";
import { useLayoutCircular } from "@react-sigma/layout-circular";
import { useLayoutForce, useWorkerLayoutForce } from "@react-sigma/layout-force";
import { useLayoutForceAtlas2, useWorkerLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import { useLayoutNoverlap, useWorkerLayoutNoverlap } from "@react-sigma/layout-noverlap";
import { useLayoutRandom } from "@react-sigma/layout-random";
import { animateNodes } from "sigma/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { buildVisualizationLayout } from "@/lib/graph/visualizationModes";
import { useGraphStore } from "@/stores/graph";
import { useSettingsStore } from "@/stores/settings";

type LayoutResult = Record<string, { x: number; y: number }>;
type LayoutHookLike = { positions: () => LayoutResult };
type WorkerLayoutHookLike = { start?: () => void; stop?: () => void; kill?: () => void };
type LayoutName = "Circular" | "Circlepack" | "Random" | "Noverlaps" | "Force Directed" | "Force Atlas";

export default function LayoutsControl() {
  const sigma = useSigma();
  const maxIterations = useSettingsStore.use.graphLayoutMaxIterations();
  const [layout, setLayout] = useState<LayoutName>("Circular");
  const [opened, setOpened] = useState(false);
  const [isWorkerRunning, setIsWorkerRunning] = useState(false);
  const workerTimerRef = useRef<number | null>(null);

  const layoutCircular = useLayoutCircular() as unknown as LayoutHookLike;
  const layoutCirclepack = useLayoutCirclepack() as unknown as LayoutHookLike;
  const layoutRandom = useLayoutRandom() as unknown as LayoutHookLike;
  const layoutNoverlap = useLayoutNoverlap({
    maxIterations,
    settings: { margin: 5, expansion: 1.1, gridSize: 1, ratio: 1, speed: 3 },
  }) as unknown as LayoutHookLike;
  const layoutForce = useLayoutForce({
    maxIterations,
    settings: { attraction: 0.0003, repulsion: 0.02, gravity: 0.02, inertia: 0.4, maxMove: 100 },
  }) as unknown as LayoutHookLike;
  const layoutForceAtlas2 = useLayoutForceAtlas2({ iterations: maxIterations }) as unknown as LayoutHookLike;

  const workerNoverlap = useWorkerLayoutNoverlap() as unknown as WorkerLayoutHookLike;
  const workerForce = useWorkerLayoutForce() as unknown as WorkerLayoutHookLike;
  const workerForceAtlas2 = useWorkerLayoutForceAtlas2() as unknown as WorkerLayoutHookLike;

  const layoutMap = useMemo<Record<LayoutName, { layout: LayoutHookLike; worker?: WorkerLayoutHookLike }>>(
    () => ({
      Circular: { layout: layoutCircular },
      Circlepack: { layout: layoutCirclepack },
      Random: { layout: layoutRandom },
      Noverlaps: { layout: layoutNoverlap, worker: workerNoverlap },
      "Force Directed": { layout: layoutForce, worker: workerForce },
      "Force Atlas": { layout: layoutForceAtlas2, worker: workerForceAtlas2 },
    }),
    [
      layoutCirclepack,
      layoutCircular,
      layoutForce,
      layoutForceAtlas2,
      layoutNoverlap,
      layoutRandom,
      workerForce,
      workerForceAtlas2,
      workerNoverlap,
    ],
  );

  const stopWorkerAnimation = useCallback(() => {
    if (workerTimerRef.current !== null) {
      window.clearInterval(workerTimerRef.current);
      workerTimerRef.current = null;
    }
    const current = layoutMap[layout];
    current?.worker?.kill?.();
    current?.worker?.stop?.();
    setIsWorkerRunning(false);
  }, [layout, layoutMap]);

  useEffect(() => () => stopWorkerAnimation(), [stopWorkerAnimation]);

  const runLayout = useCallback((nextLayout: LayoutName) => {
    stopWorkerAnimation();
    const graph = sigma.getGraph();
    if (nextLayout === "Random") {
      const rawGraph = useGraphStore.getState().rawGraph;
      if (!rawGraph) return;
      const { positions } = buildVisualizationLayout(rawGraph.nodes);
      animateNodes(graph, positions, { duration: 400 });
      setLayout(nextLayout);
      return;
    }
    const positions = layoutMap[nextLayout].layout.positions();
    animateNodes(graph, positions, { duration: 400 });
    setLayout(nextLayout);
  }, [layoutMap, sigma, stopWorkerAnimation]);

  const toggleWorkerAnimation = useCallback(() => {
    const entry = layoutMap[layout];
    if (!entry?.worker) return;
    const graph = sigma.getGraph();

    if (isWorkerRunning) {
      stopWorkerAnimation();
      return;
    }

    entry.worker.start?.();
    const tick = () => {
      const positions = entry.layout.positions();
      animateNodes(graph, positions, { duration: 300 });
    };
    tick();
    workerTimerRef.current = window.setInterval(tick, 200);
    setIsWorkerRunning(true);
    window.setTimeout(() => {
      if (workerTimerRef.current !== null) {
        stopWorkerAnimation();
      }
    }, 3000);
  }, [isWorkerRunning, layout, layoutMap, sigma, stopWorkerAnimation]);

  const workerAvailable = Boolean(layoutMap[layout]?.worker);

  return (
    <div className="flex flex-col">
      {workerAvailable ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={isWorkerRunning ? "Stop layout animation" : "Start layout animation"}
          title={isWorkerRunning ? "Stop layout animation" : "Start layout animation"}
          onClick={toggleWorkerAnimation}
        >
          {isWorkerRunning ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
        </Button>
      ) : null}
      <Popover open={opened} onOpenChange={setOpened}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Layout graph" title="Layout graph" onClick={() => setOpened((prev) => !prev)}>
            <GripIcon className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={8} collisionPadding={5} className="min-w-auto p-1">
          <Command>
            <CommandList>
              <CommandGroup>
                {Object.keys(layoutMap).map((name) => (
                  <CommandItem
                    key={name}
                    onSelect={() => {
                      runLayout(name as LayoutName);
                    }}
                    className="cursor-pointer text-xs"
                  >
                    {name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
