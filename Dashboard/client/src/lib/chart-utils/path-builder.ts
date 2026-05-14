import type { Point } from '@/components/charts/types';

export interface PathBuildOptions {
  /** Number of decimal places for SVG coordinates (default: 2). */
  precision?: number;
  /** If true, rounds to integer pixels and ignores precision. */
  roundToInteger?: boolean;
  /** If true, skips consecutive points mapping to the same rounded coordinate. */
  thinDuplicates?: boolean;
}

/**
 * Build an SVG path "d" attribute from points.
 * 
 * Performance: Pre-allocates array, avoids string concatenation.
 * 
 * @param points - Array of {x, y} data points
 * @param scaleX - Function to scale x values to SVG coordinates
 * @param scaleY - Function to scale y values to SVG coordinates
 * @returns SVG path "d" attribute string
 * 
 * @example
 * const d = buildPathD(points, scaleX, scaleY);
 * // Returns: "M10,100 L11,99 L12,101 ..."
 */
export function buildPathD(
  points: Point[],
  scaleX: (x: number) => number,
  scaleY: (y: number) => number,
  xArray?: Float32Array,
  yArray?: Float32Array,
  options?: PathBuildOptions
): string {
  const precision = options?.precision ?? 2;
  const roundToInteger = options?.roundToInteger ?? false;
  const thinDuplicates = options?.thinDuplicates ?? false;

  const formatValue = (value: number): number =>
    roundToInteger ? Math.round(value) : Number(value.toFixed(precision));

  const buildFromArrays = (xs: Float32Array, ys: Float32Array): string => {
    const len = Math.min(xs.length, ys.length);
    if (len === 0) return '';

    const parts: string[] = [];
    let lastX: number | null = null;
    let lastY: number | null = null;

    for (let i = 0; i < len; i++) {
      const x = formatValue(scaleX(xs[i]));
      const y = formatValue(scaleY(ys[i]));
      if (thinDuplicates && lastX === x && lastY === y) continue;
      parts.push(parts.length === 0 ? `M${x},${y}` : `L${x},${y}`);
      lastX = x;
      lastY = y;
    }

    return parts.join(' ');
  };

  const buildFromPoints = (source: Point[]): string => {
    if (source.length === 0) return '';

    const parts: string[] = [];
    let lastX: number | null = null;
    let lastY: number | null = null;

    for (let i = 0; i < source.length; i++) {
      const p = source[i];
      const x = formatValue(scaleX(p.x));
      const y = formatValue(scaleY(p.y));
      if (thinDuplicates && lastX === x && lastY === y) continue;
      parts.push(parts.length === 0 ? `M${x},${y}` : `L${x},${y}`);
      lastX = x;
      lastY = y;
    }

    return parts.join(' ');
  };

  if (xArray && yArray) {
    return buildFromArrays(xArray, yArray);
  }
  return buildFromPoints(points);
}
