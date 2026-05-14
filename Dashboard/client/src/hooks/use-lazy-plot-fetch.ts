import { useState, useCallback, useRef, useEffect } from 'react';
import { useRenderStore } from '@/stores/render-store';
import { fetchAndDecodePlot, toErrorMessage } from '@/lib/plot-pipeline';

/**
 * Lazy-fetches a single plot key into render-store when it's missing.
 *
 * Used by InteractiveViewer so a plot can be viewed even if the grid
 * hasn't been rendered yet (e.g. direct navigation to interactive tab).
 */
export function useLazyPlotFetch(
  plotKey: string | null,
  eventIds: string[],
) {
  const cachedPlots = useRenderStore((s) => s.cachedPlots);
  const updateCachedPlot = useRenderStore((s) => s.updateCachedPlot);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fetchKeyRef = useRef<string | null>(null);

  const hasCachedData = plotKey ? cachedPlots.has(plotKey) : false;

  useEffect(() => {
    if (!plotKey || eventIds.length === 0 || hasCachedData) {
      return;
    }

    const cacheKey = `${plotKey}:${eventIds.join(',')}`;
    if (fetchKeyRef.current === cacheKey) return;
    fetchKeyRef.current = cacheKey;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const plotData = await fetchAndDecodePlot(eventIds, plotKey, controller.signal);
        if (controller.signal.aborted) return;
        updateCachedPlot(plotKey, plotData);
      } catch (err) {
        if (controller.signal.aborted) return;
        const e = err instanceof Error ? err : new Error(toErrorMessage(err));
        console.error(`Lazy fetch failed for ${plotKey}:`, err);
        setError(e);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [plotKey, eventIds, hasCachedData, updateCachedPlot]);

  const retry = useCallback(() => {
    fetchKeyRef.current = null;
    setError(null);
  }, []);

  return { isLoading, error, retry };
}
