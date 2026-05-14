/**
 * Pinned Events Store
 * 
 * Manages a collection of "pinned" events for focused comparison.
 * Users click curves in interactive view to pin/unpin events.
 * 
 * Lifecycle: cleared on page refresh (aligned with plot data in render-store).
 * sessionStorage middleware is kept so the store structure works, but
 * onRehydrateStorage resets state on every mount.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useColorSelectionStore } from './color-selection-store';

interface PinnedEventsState {
  pinnedEventIds: string[];
  isPinnedModeActive: boolean;

  togglePin: (eventId: string) => void;
  unpinEvent: (eventId: string) => void;
  clearAllPinned: () => void;
  isPinned: (eventId: string) => boolean;
  togglePinnedMode: () => void;
  setPinnedModeActive: (active: boolean) => void;
}

export const usePinnedEventsStore = create<PinnedEventsState>()(
  persist(
    (set, get) => ({
      pinnedEventIds: [],
      isPinnedModeActive: false,

      // Per-event color overrides only apply while pinned: any unpin transition
      // drops the matching override so the curve reverts to its version palette color.
      togglePin: (eventId) =>
        set((state) => {
          const wasPinned = state.pinnedEventIds.includes(eventId);
          if (wasPinned) {
            useColorSelectionStore.getState().resetEventOverrideColor(eventId);
          }
          return {
            pinnedEventIds: wasPinned
              ? state.pinnedEventIds.filter((id) => id !== eventId)
              : [...state.pinnedEventIds, eventId],
          };
        }),

      unpinEvent: (eventId) => {
        useColorSelectionStore.getState().resetEventOverrideColor(eventId);
        set((state) => ({
          pinnedEventIds: state.pinnedEventIds.filter((id) => id !== eventId),
        }));
      },

      clearAllPinned: () => {
        useColorSelectionStore.getState().resetAllEventOverrideColors();
        set({ pinnedEventIds: [], isPinnedModeActive: false });
      },

      isPinned: (eventId) => get().pinnedEventIds.includes(eventId),

      togglePinnedMode: () =>
        set((state) => ({ isPinnedModeActive: !state.isPinnedModeActive })),

      setPinnedModeActive: (active) =>
        set({ isPinnedModeActive: active }),
    }),
    {
      name: 'rsp-pinned-events',
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.pinnedEventIds = [];
          state.isPinnedModeActive = false;
        }
      },
    }
  )
);
