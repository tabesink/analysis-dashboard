/**
 * Zustand store for per-plot axis sync state
 *
 * When synced (default): Plot uses global axis limits shared across all plots
 * When unsynced: Plot uses its own calculated axis limits
 */

import { create } from 'zustand';

interface PlotSyncState {
  syncState: Record<string, boolean>;
  isSynced: (plotKey: string) => boolean;
  toggleSync: (plotKey: string) => void;
}

export const usePlotSettingsStore = create<PlotSyncState>((set, get) => ({
  syncState: {},

  isSynced: (plotKey) => {
    const state = get().syncState[plotKey];
    return state === undefined ? true : state;
  },

  toggleSync: (plotKey) =>
    set((state) => {
      const currentSynced = state.syncState[plotKey] ?? true;
      return {
        syncState: {
          ...state.syncState,
          [plotKey]: !currentSynced,
        },
      };
    }),
}));
