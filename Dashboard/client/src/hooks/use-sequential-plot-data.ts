import { useState, useCallback, useRef } from 'react';
import { useRenderStore } from '@/stores/render-store';
import { fetchAndDecodePlot, toErrorMessage } from '@/lib/plot-pipeline';

// Tunable knob: 2 is smoother for UI responsiveness, 3 favors throughput.
const MAX_CONCURRENT_PLOT_FETCHES = 1;

/**
 * Hook for sequential plot data fetching with Zustand cache.
 * 
 * Single Responsibility: Fetches plots one at a time, caching in store.
 * Open/Closed: Takes plotKeys as input, doesn't hardcode which plots to fetch.
 * 
 * Plot data is cached in render-store, surviving tab switches.
 * Progressive rendering - each plot appears as soon as its data arrives.
 */
export function useSequentialPlotData() {
  const cachedPlots = useRenderStore((s) => s.cachedPlots);
  const loadingPlots = useRenderStore((s) => s.loadingPlots);
  const plotErrors = useRenderStore((s) => s.plotErrors);
  const updateCachedPlot = useRenderStore((s) => s.updateCachedPlot);
  const setLoadingPlots = useRenderStore((s) => s.setLoadingPlots);
  const removeLoadingPlot = useRenderStore((s) => s.removeLoadingPlot);
  const setPlotError = useRenderStore((s) => s.setPlotError);
  const clearPlotError = useRenderStore((s) => s.clearPlotError);
  const clearCachedPlots = useRenderStore((s) => s.clearCachedPlots);

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fetchIdRef = useRef(0);

  const startSequentialFetch = useCallback(
    async (eventIds: string[], plotKeys: string[]) => {
      // Abort any existing fetch
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const fetchId = ++fetchIdRef.current;

      // Reset cache and set loading state
      clearCachedPlots();
      setLoadingPlots(new Set(plotKeys));
      setIsStreaming(true);
      setError(null);

      try {
        if (eventIds.length === 0 || plotKeys.length === 0) {
          return;
        }

        let cursor = 0;
        const workerCount = Math.min(MAX_CONCURRENT_PLOT_FETCHES, plotKeys.length);

        const runWorker = async () => {
          while (!controller.signal.aborted && fetchIdRef.current === fetchId) {
            const nextIndex = cursor;
            cursor += 1;
            if (nextIndex >= plotKeys.length) {
              return;
            }

            const plotKey = plotKeys[nextIndex];
            try {
              const plotData = await fetchAndDecodePlot(eventIds, plotKey, controller.signal);
              if (controller.signal.aborted || fetchIdRef.current !== fetchId) {
                return;
              }
              updateCachedPlot(plotKey, plotData);
              clearPlotError(plotKey);
            } catch (err) {
              if (controller.signal.aborted || fetchIdRef.current !== fetchId) {
                return;
              }
              const message = toErrorMessage(err);
              console.error(`Failed to fetch plot data for ${plotKey}:`, err);
              setPlotError(plotKey, message);
              setError((prev) => prev ?? 'Failed to fetch one or more plots');
            } finally {
              if (fetchIdRef.current === fetchId) {
                removeLoadingPlot(plotKey);
              }
            }
          }
        };

        await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
      } catch (err) {
        console.error('Failed during sequential plot fetching:', err);
        if (fetchIdRef.current === fetchId) {
          setError(toErrorMessage(err));
        }
      } finally {
        // Only allow the latest fetch cycle to finalize shared flags.
        if (fetchIdRef.current === fetchId) {
          setIsStreaming(false);
          if (controller.signal.aborted) {
            setLoadingPlots(new Set());
          }
          if (abortRef.current === controller) {
            abortRef.current = null;
          }
        }
      }
    },
    [clearCachedPlots, setLoadingPlots, updateCachedPlot, removeLoadingPlot, clearPlotError, setPlotError]
  );

  const stopFetch = useCallback(() => {
    abortRef.current?.abort();
    fetchIdRef.current += 1;
    setIsStreaming(false);
    setLoadingPlots(new Set());
  }, [setLoadingPlots]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    clearCachedPlots();
    setIsStreaming(false);
    setError(null);
  }, [clearCachedPlots]);

  return {
    plots: cachedPlots,
    loadingPlots,
    plotErrors,
    isStreaming,
    error,
    startSequentialFetch,
    stopFetch,
    reset,
  };
}
