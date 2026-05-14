/**
 * Binary decoder for plot data.
 * 
 * Decodes Float32Array binary format from /api/v1/dashboard/plots/data/binary
 * ~8x smaller payload and ~10x faster parsing than JSON.
 * 
 * Binary format:
 * - Header: num_curves (uint32)
 * - Per curve:
 *   - event_id_len (uint16), event_id (bytes)
 *   - plot_key_len (uint16), plot_key (bytes)
 *   - num_points (uint32)
 *   - x_values (float32[num_points])
 *   - y_values (float32[num_points])
 */

import type { Point } from '@/components/charts/types';

export interface BinaryCurveData {
  eventId: string;
  plotKey: string;
  /** Raw typed arrays for advanced use (e.g., Canvas rendering). */
  xArray: Float32Array;
  yArray: Float32Array;
}

const curvePointsCache = new WeakMap<BinaryCurveData, Point[]>();
const sharedTextDecoder = new TextDecoder();

function readFloat32Array(
  view: DataView,
  buffer: ArrayBuffer,
  offset: number,
  length: number
): { values: Float32Array; nextOffset: number } {
  const byteLength = length * 4;
  const nextOffset = offset + byteLength;

  // Fast path: aligned byte offset can safely view original buffer with no copy.
  if (offset % 4 === 0) {
    return {
      values: new Float32Array(buffer, offset, length),
      nextOffset,
    };
  }

  // Fallback: unaligned data must be copied.
  const values = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    values[i] = view.getFloat32(offset + i * 4, true);
  }
  return { values, nextOffset };
}

/**
 * Decode binary plot data from ArrayBuffer.
 * 
 * @param buffer - Raw binary data from server
 * @returns Array of curve data with both Point[] and raw Float32Arrays
 */
export function decodeBinaryPlotData(buffer: ArrayBuffer): BinaryCurveData[] {
  const view = new DataView(buffer);
  let offset = 0;

  // Read number of curves
  const numCurves = view.getUint32(offset, true); // little-endian
  offset += 4;

  const curves: BinaryCurveData[] = [];

  for (let i = 0; i < numCurves; i++) {
    // Event ID (length-prefixed)
    const eventIdLen = view.getUint16(offset, true);
    offset += 2;
    const eventIdBytes = new Uint8Array(buffer, offset, eventIdLen);
    const eventId = sharedTextDecoder.decode(eventIdBytes);
    offset += eventIdLen;

    // Plot key (length-prefixed)
    const plotKeyLen = view.getUint16(offset, true);
    offset += 2;
    const plotKeyBytes = new Uint8Array(buffer, offset, plotKeyLen);
    const plotKey = sharedTextDecoder.decode(plotKeyBytes);
    offset += plotKeyLen;

    // Number of points
    const numPoints = view.getUint32(offset, true);
    offset += 4;

    // X values (Float32Array) - no-copy when aligned.
    const xResult = readFloat32Array(view, buffer, offset, numPoints);
    const xArray = xResult.values;
    offset = xResult.nextOffset;

    // Y values (Float32Array) - no-copy when aligned.
    const yResult = readFloat32Array(view, buffer, offset, numPoints);
    const yArray = yResult.values;
    offset = yResult.nextOffset;

    curves.push({
      eventId,
      plotKey,
      xArray,
      yArray,
    });
  }

  return curves;
}

/**
 * Group decoded curves by plot key.
 * 
 * @param curves - Decoded curve data
 * @returns Map of plotKey -> curves for that plot
 */
export function groupCurvesByPlotKey(
  curves: BinaryCurveData[]
): Map<string, BinaryCurveData[]> {
  const grouped = new Map<string, BinaryCurveData[]>();
  
  for (const curve of curves) {
    const existing = grouped.get(curve.plotKey);
    if (existing) {
      existing.push(curve);
    } else {
      grouped.set(curve.plotKey, [curve]);
    }
  }
  
  return grouped;
}

/**
 * Lazily materialize Point[] for consumers that require object points.
 */
export function getCurvePoints(curve: BinaryCurveData): Point[] {
  const cached = curvePointsCache.get(curve);
  if (cached) return cached;

  const len = Math.min(curve.xArray.length, curve.yArray.length);
  const points = new Array<Point>(len);
  for (let i = 0; i < len; i++) {
    points[i] = { x: curve.xArray[i], y: curve.yArray[i] };
  }
  curvePointsCache.set(curve, points);
  return points;
}
