/**
 * Shared types for SVG chart components.
 * 
 * SOLID: Interface Segregation - Components depend on these abstractions.
 */

/**
 * A single data point.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * A single curve (one event's data on a plot).
 */
export interface Curve {
  eventId: string;
  eventName?: string;
  points: Point[];
  xArray?: Float32Array;
  yArray?: Float32Array;
  color?: string;
}

/**
 * Plot configuration.
 */
export interface PlotConfig {
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
  gridCount?: number;  // Number of grid lines (default: 7)
}

/**
 * Axis limits.
 */
export interface AxisLimits {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/**
 * Color configuration matching backend.
 */
export interface ColorConfig {
  defaultColor: string;
}

/**
 * Dimensions for SVG viewBox.
 */
export interface Dimensions {
  width: number;
  height: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}
