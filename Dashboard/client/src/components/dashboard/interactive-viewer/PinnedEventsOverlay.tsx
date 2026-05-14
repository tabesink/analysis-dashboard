'use client';

import { useMemo } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/shadcn-io/color-picker';
import { useAllEvents } from '@/hooks/use-all-events';
import { useCurveColoring } from '@/hooks/use-curve-coloring';
import { usePinnedEventsStore } from '@/stores/pinned-events-store';
import { useColorSelectionStore } from '@/stores/color-selection-store';
import { getEventDisplayName } from '@/lib/utils';

interface PinnedEventRow {
  eventId: string;
  fullName: string;
}

export function PinnedEventsOverlay() {
  const pinnedEventIds = usePinnedEventsStore((state) => state.pinnedEventIds);
  const unpinEvent = usePinnedEventsStore((state) => state.unpinEvent);

  const eventOverrideColors = useColorSelectionStore((state) => state.eventOverrideColors);
  const setEventOverrideColor = useColorSelectionStore((state) => state.setEventOverrideColor);
  const resetEventOverrideColor = useColorSelectionStore((state) => state.resetEventOverrideColor);

  const { allEvents } = useAllEvents();
  const { getCurveColor } = useCurveColoring();

  const eventMetaMap = useMemo(() => {
    const map = new Map<string, { programId: string; version: string }>();
    for (const event of allEvents) {
      map.set(event.event_id, {
        programId: event.program_id,
        version: event.version,
      });
    }
    return map;
  }, [allEvents]);

  const rows = useMemo<PinnedEventRow[]>(() => {
    return pinnedEventIds.map((eventId) => {
      const metadata = eventMetaMap.get(eventId);
      const eventName = getEventDisplayName(eventId);

      if (!metadata) {
        return { eventId, fullName: eventName };
      }

      return {
        eventId,
        fullName: `${metadata.programId} / ${metadata.version} / ${eventName}`,
      };
    });
  }, [pinnedEventIds, eventMetaMap]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-3 right-3 z-20 w-[28rem] max-w-[calc(100%-1.5rem)] rounded-lg border border-border/50 bg-background/35 shadow-sm">
      <div className="px-3 py-2">
        <p className="text-xs font-semibold text-foreground">Pinned events ({rows.length})</p>
      </div>

      <div className="max-h-48 overflow-auto p-1.5">
        <div className="space-y-0.5">
          {rows.map((row) => {
            const color = getCurveColor(row.eventId);
            const hasOverride = !!eventOverrideColors[row.eventId];
            return (
              <div
                key={row.eventId}
                className="flex items-center gap-1.5 rounded-md bg-background/35 px-2 py-0.25"
              >
                <ColorPicker
                  value={color}
                  onChange={(nextColor) => setEventOverrideColor(row.eventId, nextColor)}
                  className="h-3 w-3 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate text-xs" title={row.fullName}>
                  {row.fullName}
                </span>
                {hasOverride && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => resetEventOverrideColor(row.eventId)}
                    title="Reset to computed color"
                    aria-label={`Reset color for ${row.fullName}`}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => unpinEvent(row.eventId)}
                  title="Unpin event"
                  aria-label={`Unpin ${row.fullName}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
