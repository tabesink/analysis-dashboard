'use client';

import { memo, useMemo } from 'react';
import { buildPathD } from '@/lib/chart-utils/path-builder';
import type { PathBuildOptions } from '@/lib/chart-utils/path-builder';
import type { Point } from './types';

interface SVGPathProps {
  points: Point[];
  xArray?: Float32Array;
  yArray?: Float32Array;
  scaleX: (x: number) => number;
  scaleY: (y: number) => number;
  color: string;
  opacity?: number;
  strokeWidth?: number;
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel' | 'inherit';
  pathBuildOptions?: PathBuildOptions;
}

/**
 * Renders a single curve as an SVG path.
 * 
 * Single Responsibility: Only renders the path element.
 * Performance: Memoizes path string computation.
 */
export const SVGPath = memo(function SVGPath({
  points,
  xArray,
  yArray,
  scaleX,
  scaleY,
  color,
  opacity = 1,
  strokeWidth = 1.2,
  strokeLinecap = 'round',
  strokeLinejoin = 'round',
  pathBuildOptions,
}: SVGPathProps) {
  const d = useMemo(
    () => buildPathD(points, scaleX, scaleY, xArray, yArray, pathBuildOptions),
    [points, scaleX, scaleY, xArray, yArray, pathBuildOptions]
  );

  if (!d) return null;

  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap={strokeLinecap}
      strokeLinejoin={strokeLinejoin}
      opacity={opacity}
    />
  );
});
