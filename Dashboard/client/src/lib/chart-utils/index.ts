export { buildPathD } from './path-builder';
export { getCurveDisplayColor } from './color';
export { sortCurvesForRendering } from './sort';
export { calculateAxisLimits, createScale } from './scales';
export { buildSpatialGrid, findCandidates, findNearest } from './spatial-grid';
export type { GridItem, SpatialGridConfig } from './spatial-grid';
export { drawCurve, drawHighlightedCurve, drawAxes, createOffscreenCanvas } from './canvas-renderer';
export type { RenderableCurve, CanvasDimensions, AxisConfig } from './canvas-renderer';