export function formatDamage(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  if (value === 0) return '0';
  return value.toFixed(4);
}
