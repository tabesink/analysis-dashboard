import { describe, expect, it } from 'vitest';
import { formatDamage } from './inspect-damage-format';

describe('formatDamage', () => {
  it('formats non-zero values with fixed 4 decimal places', () => {
    expect(formatDamage(1.2)).toBe('1.2000');
    expect(formatDamage(1.234567)).toBe('1.2346');
    expect(formatDamage(1234.56789)).toBe('1234.5679');
  });

  it('keeps zero compact', () => {
    expect(formatDamage(0)).toBe('0');
  });

  it('returns blank text for missing or invalid values', () => {
    expect(formatDamage(null)).toBe('');
    expect(formatDamage(undefined)).toBe('');
    expect(formatDamage(Number.NaN)).toBe('');
  });
});
