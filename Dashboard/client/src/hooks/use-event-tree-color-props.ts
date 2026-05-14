'use client';

import { useMemo } from 'react';
import { useAllEvents } from './use-all-events';
import { useColorSelectionStore } from '@/stores/color-selection-store';
import type { HierarchicalEventTreeProps } from '@/components/dashboard/shared/HierarchicalEventTree';
import type { EventMetadata } from '@/types/api';

type ColorTreeProps = Pick<
  HierarchicalEventTreeProps,
  | 'showColorSwatches'
  | 'getProgramColor'
  | 'onProgramColorChange'
  | 'onProgramColorReset'
  | 'isProgramColorCustomized'
  | 'getVersionColor'
  | 'onVersionColorChange'
  | 'onVersionColorReset'
  | 'isVersionColorCustomized'
>;

/**
 * Wires `HierarchicalEventTree` color-swatch props to `useColorSelectionStore`.
 *
 * Used by both the grid-mode `LoadDataSection` and the interactive-mode
 * `CurveSelector` so the side-panel swatches always agree with the rendered
 * curve color.
 */
export function useEventTreeColorProps(): ColorTreeProps {
  const { allEvents } = useAllEvents();

  const programColors = useColorSelectionStore((s) => s.programColors);
  const programVersionColors = useColorSelectionStore((s) => s.programVersionColors);
  const setProgramColor = useColorSelectionStore((s) => s.setProgramColor);
  const resetProgramColor = useColorSelectionStore((s) => s.resetProgramColor);
  const setProgramVersionColor = useColorSelectionStore((s) => s.setProgramVersionColor);
  const resetProgramVersionColor = useColorSelectionStore((s) => s.resetProgramVersionColor);
  const getProgramColor = useColorSelectionStore((s) => s.getProgramColor);
  const getProgramVersionColor = useColorSelectionStore((s) => s.getProgramVersionColor);

  const globalSortedProgramIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of allEvents) ids.add(e.program_id);
    return Array.from(ids).sort();
  }, [allEvents]);

  const sortedVersionsByProgramId = useMemo(() => {
    const m = new Map<string, string[]>();
    const add = (e: EventMetadata) => {
      if (!m.has(e.program_id)) m.set(e.program_id, []);
      const arr = m.get(e.program_id)!;
      if (!arr.includes(e.version)) arr.push(e.version);
    };
    allEvents.forEach(add);
    for (const versions of m.values()) {
      versions.sort((a, b) => a.localeCompare(b));
    }
    return m;
  }, [allEvents]);

  return useMemo<ColorTreeProps>(
    () => ({
      showColorSwatches: true,
      getProgramColor: (programId) => getProgramColor(programId, globalSortedProgramIds),
      onProgramColorChange: setProgramColor,
      onProgramColorReset: resetProgramColor,
      isProgramColorCustomized: (programId) => Boolean(programColors[programId]),
      getVersionColor: (programId, version) =>
        getProgramVersionColor(
          programId,
          version,
          globalSortedProgramIds,
          sortedVersionsByProgramId.get(programId) ?? [],
        ),
      onVersionColorChange: setProgramVersionColor,
      onVersionColorReset: resetProgramVersionColor,
      isVersionColorCustomized: (programId, version) =>
        Boolean(programVersionColors[`${programId}::${version}`]),
    }),
    [
      programColors,
      programVersionColors,
      setProgramColor,
      resetProgramColor,
      setProgramVersionColor,
      resetProgramVersionColor,
      getProgramColor,
      getProgramVersionColor,
      globalSortedProgramIds,
      sortedVersionsByProgramId,
    ],
  );
}
