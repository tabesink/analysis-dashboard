import type { Curve } from '@/components/charts/types';

/**
 * Sort curves for correct rendering order:
 * 1. Sort by version ascending so highest version is topmost
 * 2. When pinned mode is active, pinned events render on top
 */
export function sortCurvesForRendering(
  curves: Curve[],
  versionMap: Record<string, string>,
  pinnedSet?: Set<string>,
): Curve[] {
  return [...curves].sort((a, b) => {
    if (pinnedSet && pinnedSet.size > 0) {
      const aIsPinned = pinnedSet.has(a.eventId);
      const bIsPinned = pinnedSet.has(b.eventId);
      if (aIsPinned !== bIsPinned) {
        return aIsPinned ? 1 : -1;
      }
    }

    const versionA = versionMap[a.eventId] || '';
    const versionB = versionMap[b.eventId] || '';
    return versionA.localeCompare(versionB);
  });
}
