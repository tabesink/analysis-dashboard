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
  const midpoint = 0.55;

  if (t <= midpoint) {
    const local = t / midpoint;
    const r = Math.round(37 + (245 - 37) * local);
    const g = Math.round(99 + (158 - 99) * local);
    const b = Math.round(235 + (11 - 235) * local);
    return `rgb(${r}, ${g}, ${b})`;
  }

  const local = (t - midpoint) / (1 - midpoint);
  const r = Math.round(245 + (220 - 245) * local);
  const g = Math.round(158 + (38 - 158) * local);
  const b = Math.round(11 + (38 - 11) * local);
  return `rgb(${r}, ${g}, ${b})`;
}
