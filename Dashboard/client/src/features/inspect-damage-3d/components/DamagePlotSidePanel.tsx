'use client';

import dynamic from 'next/dynamic';
import { Box, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DAMAGE_CHANNELS } from '../lib/damage-channel-axis';
import {
  buildDamagePlotCells,
  filterDamageRowsByVersion,
  getDamageVersionOptions,
} from '../lib/build-damage-plot-matrix';
import { computeDamagePlotLayout } from '../lib/damage-plot-layout';
import type { InspectDamagePlotRow } from '../lib/damage-plot-types';

const MAX_RENDERED_CELLS = 300;

const DamagePlotCanvas = dynamic(() => import('./DamagePlotCanvas.client'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading 3D canvas...
    </div>
  ),
});

type DamagePlotSidePanelProps = {
  rows: InspectDamagePlotRow[];
  className?: string;
};

export function DamagePlotSidePanel({ rows, className }: DamagePlotSidePanelProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<string | undefined>();

  const versions = useMemo(() => getDamageVersionOptions(rows), [rows]);
  const effectiveVersion = selectedVersion && versions.includes(selectedVersion)
    ? selectedVersion
    : versions[0];

  const versionRows = useMemo(
    () => filterDamageRowsByVersion(rows, effectiveVersion),
    [effectiveVersion, rows],
  );
  const cells = useMemo(
    () => buildDamagePlotCells(versionRows, DAMAGE_CHANNELS),
    [versionRows],
  );
  const renderedCells = cells.slice(0, MAX_RENDERED_CELLS);
  const isCapped = cells.length > renderedCells.length;
  const layout = useMemo(
    () => computeDamagePlotLayout(renderedCells, DAMAGE_CHANNELS),
    [renderedCells],
  );
  const availableChannelCount = useMemo(
    () => new Set(cells.map((cell) => cell.channelKey)).size,
    [cells],
  );

  if (collapsed) {
    return (
      <aside className={cn('flex w-10 shrink-0 border-l bg-background', className)}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-full w-full rounded-none"
          onClick={() => setCollapsed(false)}
          aria-label="Open 3D damage plot"
          title="Open 3D damage plot"
        >
          <Box className="h-4 w-4" />
        </Button>
      </aside>
    );
  }

  return (
    <aside className={cn('flex w-[520px] shrink-0 flex-col border-l bg-background', className)}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold">3D Damage Plot</h2>
          <p className="text-xs text-muted-foreground">Selected events by version and channel</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse 3D damage plot"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2 border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-muted-foreground">Version</label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setCollapsed(true)}
          >
            <ChevronLeft className="mr-1 h-3 w-3" />
            Hide
          </Button>
        </div>
        <Select
          value={effectiveVersion}
          onValueChange={setSelectedVersion}
          disabled={versions.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select version" />
          </SelectTrigger>
          <SelectContent>
            {versions.map((version) => (
              <SelectItem key={version} value={version}>
                {version}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>Events: {versionRows.length}</div>
          <div>Channels: {availableChannelCount}/{DAMAGE_CHANNELS.length}</div>
          <div>Cells: {renderedCells.length}</div>
          <div>Versions: {versions.length}</div>
        </div>
        {isCapped ? (
          <p className="text-xs text-amber-700">
            Showing {MAX_RENDERED_CELLS} of {cells.length} cells. Narrow the selection for this MVP.
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 p-3">
        <div className="h-full min-h-[420px] overflow-hidden rounded-md border bg-white">
          {versions.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Calculate damage for selected events to populate the 3D plot.
            </div>
          ) : renderedCells.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              No renderable damage values are available for this version.
            </div>
          ) : (
            <DamagePlotCanvas layout={layout} />
          )}
        </div>
      </div>

      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        Damage range: {layout.minDamage.toExponential(2)} to {layout.maxDamage.toExponential(2)}
      </div>
    </aside>
  );
}
