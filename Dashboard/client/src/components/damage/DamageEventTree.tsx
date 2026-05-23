'use client';

import { useMemo, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn, getEventDisplayName } from '@/lib/utils';
import type { EventMetadata } from '@/types/api';

export interface DamageColumnDef {
  key: string;
  label: string;
}

export interface DamageEventTreeProps {
  events: EventMetadata[];
  columnDefinitions: DamageColumnDef[];
  channelKeys: string[];
  columnWidths: Record<string, number>;
  programIdWidth: number;
  expandedPrograms: Set<string>;
  expandedVersions: Set<string>;
  onToggleProgramExpanded: (programId: string) => void;
  onToggleVersionExpanded: (versionKey: string) => void;
  getColumnValue: (event: EventMetadata, columnKey: string) => string;
  renderChannelCell: (eventId: string, channelKey: string) => ReactNode;
}

interface VersionGroup {
  version: string;
  events: EventMetadata[];
  eventCount: number;
}

interface ProgramGroup {
  programId: string;
  versions: VersionGroup[];
  totalEventCount: number;
}

const ROW_PADDING_X_PX = 12;
const VERSION_INDENT_PX = 24 + 1;
const LEAF_INDENT_PX = 20 + 1;
const FALLBACK_COLUMN_PX = 80;

export function DamageEventTree({
  events,
  columnDefinitions,
  channelKeys,
  columnWidths,
  programIdWidth,
  expandedPrograms,
  expandedVersions,
  onToggleProgramExpanded,
  onToggleVersionExpanded,
  getColumnValue,
  renderChannelCell,
}: DamageEventTreeProps) {
  const versionRowFirstCellWidth = Math.max(
    0,
    programIdWidth - ROW_PADDING_X_PX - VERSION_INDENT_PX,
  );
  const leafRowFirstCellWidth = Math.max(
    0,
    programIdWidth - ROW_PADDING_X_PX - VERSION_INDENT_PX - LEAF_INDENT_PX,
  );
  const widthOf = (key: string) => columnWidths[key] ?? FALLBACK_COLUMN_PX;

  const tree: ProgramGroup[] = useMemo(() => {
    const programMap = new Map<string, Map<string, EventMetadata[]>>();

    for (const event of events) {
      if (!programMap.has(event.program_id)) {
        programMap.set(event.program_id, new Map());
      }
      const versionMap = programMap.get(event.program_id)!;
      if (!versionMap.has(event.version)) {
        versionMap.set(event.version, []);
      }
      versionMap.get(event.version)!.push(event);
    }

    return [...programMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([programId, versionMap]) => {
        const versions: VersionGroup[] = [...versionMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([version, versionEvents]) => ({
            version,
            events: versionEvents,
            eventCount: versionEvents.length,
          }));
        return {
          programId,
          versions,
          totalEventCount: versions.reduce((sum, version) => sum + version.eventCount, 0),
        };
      });
  }, [events]);

  const renderEmptyDataColumns = () => (
    <>
      {columnDefinitions.map((col) => (
        <span
          key={col.key}
          className="shrink-0 px-2"
          style={{ width: widthOf(col.key) }}
        />
      ))}
      {channelKeys.map((channelKey) => (
        <span
          key={channelKey}
          className="shrink-0 px-2"
          style={{ width: widthOf(channelKey) }}
        />
      ))}
    </>
  );

  if (tree.length === 0) return null;

  const suppressLastRowBorder = true;

  return (
    <div className="w-full">
      {tree.map((program, programIndex) => {
        const isProgramOpen = expandedPrograms.has(program.programId);
        const isFirstProgram = programIndex === 0;

        return (
          <Collapsible
            key={program.programId}
            open={isProgramOpen}
            onOpenChange={() => onToggleProgramExpanded(program.programId)}
          >
            <div
              className={cn(
                'flex items-center gap-2 py-2 px-3 border-t border-b bg-muted/60 hover:bg-muted/70 transition-colors',
                isFirstProgram && '-mt-px',
              )}
            >
              <CollapsibleTrigger className="p-0.5 hover:bg-muted rounded-sm transition-colors">
                <ChevronDown
                  className={cn(
                    'size-3.5 text-muted-foreground transition-transform duration-200',
                    !isProgramOpen && '-rotate-90',
                  )}
                />
              </CollapsibleTrigger>
              <span
                className="text-xs font-semibold text-foreground select-none cursor-pointer"
                onClick={() => onToggleProgramExpanded(program.programId)}
              >
                {program.programId}
              </span>
              <span className="text-xs text-muted-foreground">
                ({program.totalEventCount})
              </span>
            </div>

            <CollapsibleContent>
              <div className="ml-6 border-l border-border">
                {program.versions.map((versionGroup, versionIndex) => {
                  const versionKey = `${program.programId}::${versionGroup.version}`;
                  const isVersionOpen = expandedVersions.has(versionKey);
                  const isLastVersionInProgram =
                    versionIndex === program.versions.length - 1;
                  const versionRowIsProgramTail =
                    isLastVersionInProgram && !isVersionOpen;

                  return (
                    <Collapsible
                      key={versionKey}
                      open={isVersionOpen}
                      onOpenChange={() => onToggleVersionExpanded(versionKey)}
                    >
                      <div
                        className={cn(
                          'flex items-center py-1.5 px-3 border-b hover:bg-muted/30 transition-colors',
                          versionRowIsProgramTail && suppressLastRowBorder && 'border-b-0',
                        )}
                      >
                        <div
                          className="flex items-center gap-2 shrink-0 pl-1"
                          style={{ width: versionRowFirstCellWidth }}
                        >
                          <CollapsibleTrigger className="p-0.5 hover:bg-muted rounded-sm transition-colors">
                            <ChevronDown
                              className={cn(
                                'size-3 text-muted-foreground transition-transform duration-200',
                                !isVersionOpen && '-rotate-90',
                              )}
                            />
                          </CollapsibleTrigger>
                          <span
                            className="text-xs font-medium text-foreground select-none cursor-pointer"
                            onClick={() => onToggleVersionExpanded(versionKey)}
                          >
                            {versionGroup.version}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({versionGroup.eventCount})
                          </span>
                        </div>
                        <div className="flex items-center">
                          {renderEmptyDataColumns()}
                        </div>
                      </div>

                      <CollapsibleContent>
                        <div className="ml-5 border-l border-border">
                          {versionGroup.events.map((event, eventIndex) => {
                            const displayName = getEventDisplayName(event.event_id);
                            const isProgramTailEvent =
                              isLastVersionInProgram &&
                              eventIndex === versionGroup.events.length - 1;

                            return (
                              <div
                                key={event.event_id}
                                className={cn(
                                  'flex items-center py-1.5 px-3 border-b hover:bg-muted/30 transition-colors',
                                  isProgramTailEvent && suppressLastRowBorder && 'border-b-0',
                                )}
                              >
                                <div
                                  className="flex items-center gap-2 shrink-0 pl-1"
                                  style={{ width: leafRowFirstCellWidth }}
                                >
                                  <span
                                    className="text-xs text-muted-foreground truncate"
                                    title={displayName}
                                  >
                                    {displayName}
                                  </span>
                                </div>
                                <div className="flex items-center">
                                  {columnDefinitions.map((col) => {
                                    const value = getColumnValue(event, col.key);
                                    return (
                                      <span
                                        key={col.key}
                                        className="shrink-0 text-xs text-foreground/80 truncate px-2 text-center"
                                        style={{ width: widthOf(col.key) }}
                                        title={value}
                                      >
                                        {value || '-'}
                                      </span>
                                    );
                                  })}
                                  {channelKeys.map((channelKey) => (
                                    <span
                                      key={channelKey}
                                      className="shrink-0 px-2 text-center tabular-nums text-xs"
                                      style={{ width: widthOf(channelKey) }}
                                    >
                                      {renderChannelCell(event.event_id, channelKey)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
      <div className="border-b border-border" aria-hidden />
    </div>
  );
}
