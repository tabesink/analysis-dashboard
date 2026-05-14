import type { Curve, ColorConfig } from '@/components/charts/types';

export function getCurveDisplayColor(curve: Curve, colorConfig: ColorConfig): string {
  return curve.color ?? colorConfig.defaultColor;
}
