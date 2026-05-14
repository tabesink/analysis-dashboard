/**
 * Zustand store for ephemeral UI state
 * This state resets on page refresh (intentional)
 */

import { create } from 'zustand';

interface UIState {
  sidePanelCollapsed: boolean;
  toggleSidePanel: () => void;
  setSidePanelCollapsed: (collapsed: boolean) => void;

  activeTab: 'grid' | 'interactive';
  setActiveTab: (tab: 'grid' | 'interactive') => void;

  curveVisibility: Record<string, boolean>;
  toggleCurveVisibility: (eventId: string) => void;
  resetCurveVisibility: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidePanelCollapsed: false,
  toggleSidePanel: () =>
    set((state) => ({ sidePanelCollapsed: !state.sidePanelCollapsed })),
  setSidePanelCollapsed: (collapsed) => set({ sidePanelCollapsed: collapsed }),

  activeTab: 'grid',
  setActiveTab: (tab) => set({ activeTab: tab }),

  curveVisibility: {},
  toggleCurveVisibility: (eventId) =>
    set((state) => ({
      curveVisibility: {
        ...state.curveVisibility,
        [eventId]: state.curveVisibility[eventId] === undefined ? false : !state.curveVisibility[eventId],
      },
    })),
  resetCurveVisibility: () => set({ curveVisibility: {} }),
}));
