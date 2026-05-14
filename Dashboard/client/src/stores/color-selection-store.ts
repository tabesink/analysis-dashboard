/**
 * Color Selection Store - manages curve colors for plot rendering.
 *
 * Single source of truth for:
 *   - Per-program palette colors (shared across versions of that program)
 *   - Per-program/version palette overrides (distinct shades within a program)
 *   - Per-event override colors (only valid while the event is pinned;
 *     `usePinnedEventsStore` clears the override on unpin)
 *
 * `useCurveColoring.getCurveColor` resolves a curve as:
 *   eventOverrideColors[id] ?? getProgramVersionColor(...)
 *
 * PERSISTENCE: User color customizations persist in localStorage via Zustand
 * persist middleware. A `version: 2` migration drops legacy keys
 * (colorMode/byFilter/legacy palettes) from older storage payloads.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { COLOR_PALETTE } from '@/config/constants';
import Color from 'color';
import {
  distributeShades,
  findColorFamily,
} from '@/components/ui/shadcn-io/color-picker';

// ============================================================================
// TYPES
// ============================================================================

type ProgramColors = Record<string, string>;
type ProgramVersionColors = Record<string, string>;
type EventColors = Record<string, string>;

interface ColorSelectionStore {
  // Revision used to detect color changes that require re-render
  colorRevision: number;

  // Per-event color overrides (takes precedence when set; pinned-only lifecycle)
  eventOverrideColors: EventColors;
  setEventOverrideColor: (eventId: string, color: string) => void;
  resetEventOverrideColor: (eventId: string) => void;
  resetAllEventOverrideColors: () => void;
  getEventOverrideColor: (eventId: string) => string | undefined;

  // Hierarchical program/version colors
  programColors: ProgramColors;
  programVersionColors: ProgramVersionColors; // key = `${programId}::${version}`
  setProgramColor: (programId: string, color: string) => void;
  resetProgramColor: (programId: string) => void;
  resetAllProgramColors: () => void;
  setProgramVersionColor: (programId: string, version: string, color: string) => void;
  resetProgramVersionColor: (programId: string, version: string) => void;
  resetAllProgramVersionColors: () => void;
  getProgramColor: (programId: string, allProgramIds: string[]) => string;
  getProgramVersionColor: (
    programId: string,
    version: string,
    allProgramIds: string[],
    /** Sorted unique versions for this program (enables distinct shades of the program color). */
    versionsForProgram?: string[],
  ) => string;
  syncProgramColors: (programIds: string[]) => void;
}

// ============================================================================
// UTILITIES
// ============================================================================

function generateProgramColor(index: number): string {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

/**
 * Distinct shades for versions under one program: same hue family as `baseHex` when it matches
 * the discrete picker palette; otherwise mix toward white/black from the base.
 */
function computeVersionShadesFromBase(baseHex: string, count: number): string[] {
  if (count <= 1) {
    return [baseHex];
  }
  const family = findColorFamily(baseHex);
  if (family) {
    return distributeShades(family, count);
  }
  try {
    const base = Color(baseHex);
    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      if (t <= 0.5) {
        return base.mix(Color('#ffffff'), (t / 0.5) * 0.5).hex();
      }
      return base.mix(Color('#000000'), ((t - 0.5) / 0.5) * 0.45).hex();
    });
  } catch {
    return Array.from({ length: count }, () => baseHex);
  }
}

function buildProgramVersionKey(programId: string, version: string): string {
  return `${programId}::${version}`;
}

// ============================================================================
// DEBOUNCED STORAGE ADAPTER
// ============================================================================

const PERSIST_DEBOUNCE_MS = 500;

const debouncedLocalStorage = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    getItem: (name: string) => localStorage.getItem(name),
    setItem: (name: string, value: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        localStorage.setItem(name, value);
        timer = null;
      }, PERSIST_DEBOUNCE_MS);
    },
    removeItem: (name: string) => {
      if (timer) clearTimeout(timer);
      localStorage.removeItem(name);
    },
  };
})();

// ============================================================================
// STORE
// ============================================================================

export const useColorSelectionStore = create<ColorSelectionStore>()(
  persist(
    (set, get) => ({
      colorRevision: 0,

      // Per-event color overrides
      eventOverrideColors: {},
      setEventOverrideColor: (eventId, color) =>
        set((s) => ({
          eventOverrideColors: { ...s.eventOverrideColors, [eventId]: color },
          colorRevision: s.colorRevision + 1,
        })),
      resetEventOverrideColor: (eventId) =>
        set((s) => {
          if (!(eventId in s.eventOverrideColors)) return s;
          const { [eventId]: _, ...rest } = s.eventOverrideColors;
          return { eventOverrideColors: rest, colorRevision: s.colorRevision + 1 };
        }),
      resetAllEventOverrideColors: () =>
        set((s) => ({
          eventOverrideColors: {},
          colorRevision: s.colorRevision + 1,
        })),
      getEventOverrideColor: (eventId) => get().eventOverrideColors[eventId],

      // Hierarchical program/version colors
      programColors: {},
      programVersionColors: {},
      setProgramColor: (programId, color) =>
        set((s) => ({
          programColors: { ...s.programColors, [programId]: color },
          colorRevision: s.colorRevision + 1,
        })),
      resetProgramColor: (programId) =>
        set((s) => {
          const { [programId]: _, ...restProgram } = s.programColors;
          const prefix = `${programId}::`;
          const nextVersion: ProgramVersionColors = {};
          for (const [key, color] of Object.entries(s.programVersionColors)) {
            if (!key.startsWith(prefix)) {
              nextVersion[key] = color;
            }
          }
          return {
            programColors: restProgram,
            programVersionColors: nextVersion,
            colorRevision: s.colorRevision + 1,
          };
        }),
      resetAllProgramColors: () =>
        set((s) => ({ programColors: {}, colorRevision: s.colorRevision + 1 })),
      setProgramVersionColor: (programId, version, color) =>
        set((s) => ({
          programVersionColors: {
            ...s.programVersionColors,
            [buildProgramVersionKey(programId, version)]: color,
          },
          colorRevision: s.colorRevision + 1,
        })),
      resetProgramVersionColor: (programId, version) =>
        set((s) => {
          const key = buildProgramVersionKey(programId, version);
          const { [key]: _, ...rest } = s.programVersionColors;
          return { programVersionColors: rest, colorRevision: s.colorRevision + 1 };
        }),
      resetAllProgramVersionColors: () =>
        set((s) => ({ programVersionColors: {}, colorRevision: s.colorRevision + 1 })),
      getProgramColor: (programId, allProgramIds) => {
        const state = get();
        if (state.programColors[programId]) {
          return state.programColors[programId];
        }
        const index = allProgramIds.indexOf(programId);
        return generateProgramColor(index >= 0 ? index : 0);
      },
      getProgramVersionColor: (programId, version, allProgramIds, versionsForProgram) => {
        const state = get();
        const key = buildProgramVersionKey(programId, version);
        if (state.programVersionColors[key]) {
          return state.programVersionColors[key];
        }
        const base = state.getProgramColor(programId, allProgramIds);
        if (!versionsForProgram || versionsForProgram.length <= 1) {
          return base;
        }
        const idx = versionsForProgram.indexOf(version);
        const safeIdx = idx >= 0 ? idx : 0;
        const shades = computeVersionShadesFromBase(base, versionsForProgram.length);
        return shades[safeIdx] ?? base;
      },
      syncProgramColors: (programIds) => {
        const state = get();
        const nextProgramColors: ProgramColors = { ...state.programColors };
        let hasChanges = false;

        programIds.forEach((programId, index) => {
          if (!state.programColors[programId]) {
            nextProgramColors[programId] = generateProgramColor(index);
            hasChanges = true;
          }
        });

        if (hasChanges) {
          set((s) => ({ programColors: nextProgramColors, colorRevision: s.colorRevision + 1 }));
        }
      },
    }),
    {
      name: 'color-selection-storage',
      version: 2,
      // Drop legacy keys (colorMode, byFilter, legacy palettes) from v1 payloads
      // so returning users rehydrate cleanly into the trimmed schema.
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState as Partial<ColorSelectionStore>;
        }
        const { programColors, programVersionColors, eventOverrideColors } =
          persistedState as Record<string, unknown>;
        return {
          programColors: (programColors as ProgramColors) ?? {},
          programVersionColors: (programVersionColors as ProgramVersionColors) ?? {},
          eventOverrideColors: (eventOverrideColors as EventColors) ?? {},
        } as Partial<ColorSelectionStore>;
      },
      storage: createJSONStorage(() => debouncedLocalStorage),
      partialize: (state) => ({
        eventOverrideColors: state.eventOverrideColors,
        programColors: state.programColors,
        programVersionColors: state.programVersionColors,
      }),
    }
  )
);
