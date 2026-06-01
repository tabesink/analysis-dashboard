import type {
  DamageChannelDefinition,
  DamagePlotCell,
  DamagePlotLayout,
} from './damage-plot-types';
import { getDamageColor } from './damage-color-scale';

export type DamagePlotLayoutOptions = {
  cellSize?: number;
  gap?: number;
  maxBarHeight?: number;
  minVisibleBarHeight?: number;
};

export function computeDamagePlotLayout(
  cells: readonly DamagePlotCell[],
  channels: readonly DamageChannelDefinition[],
  options: DamagePlotLayoutOptions = {},
): DamagePlotLayout {
  const cellSize = options.cellSize ?? 0.8;
  const gap = options.gap ?? 0.24;
  const spacing = cellSize + gap;
  const maxBarHeight = options.maxBarHeight ?? 8;
  const minVisibleBarHeight = options.minVisibleBarHeight ?? 0.04;

  const damages = cells.map((cell) => cell.damage).filter(Number.isFinite);
  const minDamage = damages.length ? Math.min(...damages) : 0;
  const maxDamage = damages.length ? Math.max(...damages) : 0;
  const scaleDamage = (value: number) => {
    if (value === 0) return minVisibleBarHeight;
    if (maxDamage <= 0) return minVisibleBarHeight;
    return Math.max(minVisibleBarHeight, (value / maxDamage) * maxBarHeight);
  };

  const eventLabels = Array.from(
    new Map(cells.map((cell) => [cell.eventIndex, cell.eventLabel])).entries(),
  )
    .sort(([a], [b]) => a - b)
    .map(([, label]) => label);

  const channelLabels = [...channels]
    .sort((a, b) => a.order - b.order)
    .map((channel) => channel.shortLabel);

  // User-facing axes: X = channels, Y = events, Z = damage.
  // Three.js axes: X = channels, Z = events/depth, Y = damage height.
  const bars = cells.map((cell) => {
    const height = scaleDamage(cell.damage);
    const x = cell.channelIndex * spacing;
    const z = cell.eventIndex * spacing;
    const y = height / 2;

    return {
      ...cell,
      position: [x, y, z] as [number, number, number],
      scale: [cellSize, height, cellSize] as [number, number, number],
      color: getDamageColor(cell.damage, minDamage, maxDamage),
    };
  });

  const width = Math.max(1, channels.length * spacing);
  const depth = Math.max(1, eventLabels.length * spacing);
  const height = Math.max(1, maxBarHeight);

  return {
    bars,
    channelLabels,
    eventLabels,
    cellSpacing: spacing,
    minDamage,
    maxDamage,
    bounds: { width, depth, height },
    center: [width / 2 - spacing / 2, height / 2, depth / 2 - spacing / 2],
  };
}
