/**
 * Canvas Renderer - Drawing utilities for canvas plots
 * 
 * Single Responsibility: Renders curves and axes to canvas context
 */

import type { AxisLimits } from '@/components/charts/types';

const GRID_COLOR = '#e5e5e5';
const TICK_LABEL_COLOR = '#666';
const TICK_LABEL_FONT = '18px sans-serif';
const X_TICK_OFFSET = 30;
const Y_TICK_OFFSET = 10;
const X_LABEL_BOTTOM_MARGIN = 20;
const Y_LABEL_LEFT_MARGIN = 25;

export interface RenderableCurve {
  color: string;
  opacity: number;
  path: { x: number; y: number }[];
}

export interface TypedArrayCurve {
  color: string;
  opacity: number;
  xPath: Float32Array;
  yPath: Float32Array;
}

export interface CanvasDimensions {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

export interface AxisConfig {
  xLabel: string;
  yLabel: string;
  gridCount: number;
}

export interface OffscreenCanvasOptions {
  drawAxes?: boolean;
  fillBackground?: boolean;
}

/**
 * Draws a single curve path to the canvas
 */
export function drawCurve(
  ctx: CanvasRenderingContext2D,
  curve: RenderableCurve,
  strokeWidth: number = 1.5
): void {
  const { path, color, opacity } = curve;
  if (path.length === 0) return;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.globalAlpha = opacity;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();
}

/**
 * Draws a highlighted curve with outline
 */
export function drawHighlightedCurve(
  ctx: CanvasRenderingContext2D,
  curve: RenderableCurve,
  outlineColor: string = 'black',
  outlineWidth: number = 4.5,
  strokeWidth: number = 2.5
): void {
  const { path, color } = curve;
  if (path.length === 0) return;

  ctx.globalAlpha = 1;

  // Draw outline first
  ctx.beginPath();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = outlineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();

  // Draw colored stroke on top
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();
}

/**
 * Draws grid lines and axis labels
 */
export function drawAxes(
  ctx: CanvasRenderingContext2D,
  dimensions: CanvasDimensions,
  axisLimits: AxisLimits,
  config: AxisConfig
): void {
  const { width, height, padding } = dimensions;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const { gridCount, xLabel, yLabel } = config;

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;

  const xStep = plotWidth / (gridCount - 1);
  const yStep = plotHeight / (gridCount - 1);

  // Vertical grid lines
  for (let i = 0; i < gridCount; i++) {
    const x = padding.left + i * xStep;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + plotHeight);
    ctx.stroke();
  }

  // Horizontal grid lines
  for (let i = 0; i < gridCount; i++) {
    const y = padding.top + i * yStep;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotWidth, y);
    ctx.stroke();
  }

  ctx.fillStyle = TICK_LABEL_COLOR;
  ctx.font = TICK_LABEL_FONT;
  ctx.textAlign = 'center';

  const xRange = axisLimits.xMax - axisLimits.xMin;
  for (let i = 0; i < gridCount; i++) {
    const x = padding.left + i * xStep;
    const value = axisLimits.xMin + (i / (gridCount - 1)) * xRange;
    ctx.fillText(value.toFixed(1), x, height - padding.bottom + X_TICK_OFFSET);
  }

  ctx.textAlign = 'right';
  const yRange = axisLimits.yMax - axisLimits.yMin;
  for (let i = 0; i < gridCount; i++) {
    const y = padding.top + i * yStep;
    const value = axisLimits.yMax - (i / (gridCount - 1)) * yRange;
    ctx.fillText(value.toFixed(1), padding.left - Y_TICK_OFFSET, y + 6);
  }

  ctx.textAlign = 'center';
  ctx.fillText(xLabel, padding.left + plotWidth / 2, height - X_LABEL_BOTTOM_MARGIN);

  ctx.save();
  ctx.translate(Y_LABEL_LEFT_MARGIN, padding.top + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

/**
 * Draws a single curve from paired Float32Arrays (zero-copy, no Point[] allocation).
 */
export function drawCurveFromArrays(
  ctx: CanvasRenderingContext2D,
  curve: TypedArrayCurve,
  strokeWidth: number = 1.5
): void {
  const { xPath, yPath, color, opacity } = curve;
  const len = Math.min(xPath.length, yPath.length);
  if (len === 0) return;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.globalAlpha = opacity;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.moveTo(xPath[0], yPath[0]);
  for (let i = 1; i < len; i++) {
    ctx.lineTo(xPath[i], yPath[i]);
  }
  ctx.stroke();
}

/**
 * Draws a highlighted curve with outline from Float32Arrays.
 */
export function drawHighlightedCurveFromArrays(
  ctx: CanvasRenderingContext2D,
  curve: TypedArrayCurve,
  outlineColor: string = 'black',
  outlineWidth: number = 4.5,
  strokeWidth: number = 2.5
): void {
  const { xPath, yPath, color } = curve;
  const len = Math.min(xPath.length, yPath.length);
  if (len === 0) return;

  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = outlineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(xPath[0], yPath[0]);
  for (let i = 1; i < len; i++) {
    ctx.lineTo(xPath[i], yPath[i]);
  }
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.moveTo(xPath[0], yPath[0]);
  for (let i = 1; i < len; i++) {
    ctx.lineTo(xPath[i], yPath[i]);
  }
  ctx.stroke();
}

/**
 * Creates an offscreen canvas with all curves pre-rendered
 */
export function createOffscreenCanvas(
  curves: RenderableCurve[],
  dimensions: CanvasDimensions,
  axisLimits: AxisLimits,
  axisConfig: AxisConfig
): HTMLCanvasElement {
  const { width, height, padding } = dimensions;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return offscreen;

  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);

  // Clip to plot area for curves
  ctx.save();
  ctx.beginPath();
  ctx.rect(padding.left, padding.top, plotWidth, plotHeight);
  ctx.clip();

  // Draw all curves
  for (const curve of curves) {
    drawCurve(ctx, curve);
  }

  ctx.restore();
  ctx.globalAlpha = 1;

  // Draw axes on top
  drawAxes(ctx, dimensions, axisLimits, axisConfig);

  return offscreen;
}

/**
 * Creates an offscreen canvas from Float32Array-based curves (avoids Point[] allocation).
 */
export function createOffscreenCanvasFromArrays(
  curves: TypedArrayCurve[],
  dimensions: CanvasDimensions,
  axisLimits?: AxisLimits,
  axisConfig?: AxisConfig,
  options?: OffscreenCanvasOptions
): HTMLCanvasElement {
  const { width, height, padding } = dimensions;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const { drawAxes: shouldDrawAxes = true, fillBackground = true } = options ?? {};

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return offscreen;

  if (fillBackground) {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(padding.left, padding.top, plotWidth, plotHeight);
  ctx.clip();

  for (const curve of curves) {
    drawCurveFromArrays(ctx, curve);
  }

  ctx.restore();
  ctx.globalAlpha = 1;

  if (shouldDrawAxes && axisLimits && axisConfig) {
    drawAxes(ctx, dimensions, axisLimits, axisConfig);
  }

  return offscreen;
}
