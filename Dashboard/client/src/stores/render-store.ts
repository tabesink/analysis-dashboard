/**
 * Zustand store for render state
 * Manages rendering progress, version tracking, and cached plot data.
 *
 * Note: rendered_event_ids are persisted in the server session,
 * not in this ephemeral store. This store tracks:
 * - Transient render state (isRendering)
 * - renderVersion for cache invalidation
 * - cachedPlots for plot data that survives tab switches
 */

import { create } from 'zustand';
import type { SVGPlotCurvesData } from '@/types/api';

const MAX_CACHED_PLOTS = 10

interface RenderState {
  renderVersion: number;

  isRendering: boolean;
  startRendering: () => void;
  stopRendering: () => void;

  clearSelectedInteractivePlot: () => void;

  selectedPlotKey: string | null;
  setSelectedPlotKey: (key: string | null) => void;

  cachedPlots: Map<string, SVGPlotCurvesData>;
  loadingPlots: Set<string>;
  plotErrors: Record<string, string>;
  updateCachedPlot: (plotKey: string, data: SVGPlotCurvesData) => void;
  setLoadingPlots: (plots: Set<string>) => void;
  removeLoadingPlot: (plotKey: string) => void;
  setPlotError: (plotKey: string, error: string) => void;
  clearPlotError: (plotKey: string) => void;
  clearCachedPlots: () => void;
}

export const useRenderStore = create<RenderState>((set) => ({
  renderVersion: 0,

  isRendering: false,
  startRendering: () => set({ isRendering: true }),
  stopRendering: () => set({ isRendering: false }),

  clearSelectedInteractivePlot: () => set({ selectedPlotKey: null }),

  selectedPlotKey: null,
  setSelectedPlotKey: (key) => set({ selectedPlotKey: key }),

  cachedPlots: new Map(),
  loadingPlots: new Set(),
  plotErrors: {},
  updateCachedPlot: (plotKey, data) =>
    set((state) => {
      const next = new Map(state.cachedPlots);
      next.set(plotKey, data);
      if (next.size > MAX_CACHED_PLOTS) {
        const iter = next.keys();
        let evictCount = next.size - MAX_CACHED_PLOTS;
        while (evictCount-- > 0) {
          next.delete(iter.next().value!);
        }
      }
      return { cachedPlots: next };
    }),
  setLoadingPlots: (plots) => set({ loadingPlots: plots }),
  removeLoadingPlot: (plotKey) =>
    set((state) => {
      const next = new Set(state.loadingPlots);
      next.delete(plotKey);
      return { loadingPlots: next };
    }),
  setPlotError: (plotKey, error) =>
    set((state) => ({
      plotErrors: { ...state.plotErrors, [plotKey]: error },
    })),
  clearPlotError: (plotKey) =>
    set((state) => {
      if (!(plotKey in state.plotErrors)) return state;
      const next = { ...state.plotErrors };
      delete next[plotKey];
      return { plotErrors: next };
    }),
  clearCachedPlots: () => set({ cachedPlots: new Map(), loadingPlots: new Set(), plotErrors: {} }),
}));
