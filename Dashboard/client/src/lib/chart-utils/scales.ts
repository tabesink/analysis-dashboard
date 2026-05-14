import type { AxisLimits, Curve } from '@/components/charts/types';

const INTERVAL_COUNT = 4;
const DEFAULT_EMPTY_AXIS_RANGE = 1000;

/**
 * Find a "nice" step value for axis ticks.
 * Returns values like 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, etc.
 *
 * @param rawStep - The raw step value to round
 * @returns A nice round step value
 */
function niceStep(rawStep: number): number {
  if (rawStep <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;

  let nice: number;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;

  return nice * magnitude;
}

/**
 * Round axis limits to nice values for clean tick labels.
 * Rounds min down and max up to ensure all data is visible.
 *
 * @param min - Raw minimum value
 * @param max - Raw maximum value
 * @returns Tuple of [roundedMin, roundedMax]
 */
function roundToNiceLimits(min: number, max: number): [number, number] {
  const rawRange = max - min;
  if (rawRange <= 0) return [min - 1, max + 1];

  const step = niceStep(rawRange / INTERVAL_COUNT);
  const roundedMin = Math.floor(min / step) * step;
  const roundedMax = Math.ceil(max / step) * step;

  return [roundedMin, roundedMax];
}

/**
 * Calculate axis limits from all curves.
 *
 * Finds min/max across all points, rounds to nice values for clean tick labels.
 * Min is rounded down, max is rounded up to ensure all data is visible.
 */
export function calculateAxisLimits(curves: Curve[]): AxisLimits {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;

  for (const curve of curves) {
    if (curve.xArray && curve.yArray) {
      const len = Math.min(curve.xArray.length, curve.yArray.length);
      for (let i = 0; i < len; i++) {
        const x = curve.xArray[i];
        const y = curve.yArray[i];
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
      continue;
    }

    for (const point of curve.points) {
      if (point.x < xMin) xMin = point.x;
      if (point.x > xMax) xMax = point.x;
      if (point.y < yMin) yMin = point.y;
      if (point.y > yMax) yMax = point.y;
    }
  }

  if (!isFinite(xMin)) {
    return {
      xMin: -DEFAULT_EMPTY_AXIS_RANGE,
      xMax: DEFAULT_EMPTY_AXIS_RANGE,
      yMin: -DEFAULT_EMPTY_AXIS_RANGE,
      yMax: DEFAULT_EMPTY_AXIS_RANGE,
    };
  }

  // Ensure the origin is always within the visible range for datum lines
  xMin = Math.min(xMin, 0);
  xMax = Math.max(xMax, 0);
  yMin = Math.min(yMin, 0);
  yMax = Math.max(yMax, 0);

  // Round to nice limits for clean tick values
  const [finalXMin, finalXMax] = roundToNiceLimits(xMin, xMax);
  const [finalYMin, finalYMax] = roundToNiceLimits(yMin, yMax);

  return {
    xMin: finalXMin,
    xMax: finalXMax,
    yMin: finalYMin,
    yMax: finalYMax,
  };
}

/**
 * Create a linear scale function.
 *
 * @param domainMin - Data minimum
 * @param domainMax - Data maximum
 * @param rangeMin - SVG coordinate minimum
 * @param rangeMax - SVG coordinate maximum
 * @returns Scale function
 *
 * @example
 * const scaleX = createScale(0, 100, 50, 350);
 * scaleX(50); // Returns 200
 */
export function createScale(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number
): (value: number) => number {
  const domainRange = domainMax - domainMin || 1;
  const rangeRange = rangeMax - rangeMin;

  return (value: number): number => {
    const normalized = (value - domainMin) / domainRange;
    return rangeMin + normalized * rangeRange;
  };
}

