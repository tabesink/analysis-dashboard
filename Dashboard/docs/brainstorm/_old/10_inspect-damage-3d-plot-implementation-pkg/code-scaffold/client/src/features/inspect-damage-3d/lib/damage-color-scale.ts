export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function normalizeValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

export function getDamageColor(value: number, min: number, max: number): string {
  const t = normalizeValue(value, min, max);

  // Small deterministic blue -> amber -> red scale.
  // Keep this local instead of adding a color-scale dependency.
  const stops = [
    { t: 0, rgb: [37, 99, 235] },
    { t: 0.5, rgb: [245, 158, 11] },
    { t: 1, rgb: [220, 38, 38] },
  ] as const;

  const lower = t <= 0.5 ? stops[0] : stops[1];
  const upper = t <= 0.5 ? stops[1] : stops[2];
  const localT = lower.t === upper.t ? 0 : (t - lower.t) / (upper.t - lower.t);

  const [r, g, b] = lower.rgb.map((channel, index) =>
    Math.round(channel + (upper.rgb[index] - channel) * localT),
  );

  return `rgb(${r}, ${g}, ${b})`;
}
