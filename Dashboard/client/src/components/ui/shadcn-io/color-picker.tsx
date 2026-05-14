'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ============================================================================
// COLOR PALETTE DEFINITION
// ============================================================================

/**
 * Discrete color palette organized by color family and shade.
 * Each row is a color family, each column is a shade (100-900).
 */
export const COLOR_FAMILIES = {
  Blue: {
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  Orange: {
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
  },
  Green: {
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  Purple: {
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },
  Red: {
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  Cyan: {
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
  },
  Yellow: {
    100: '#fef9c3',
    200: '#fef08a',
    300: '#fde047',
    400: '#facc15',
    500: '#eab308',
    600: '#ca8a04',
    700: '#a16207',
    800: '#854d0e',
    900: '#713f12',
  },
  Neutral: {
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
} as const;

export type ColorFamily = keyof typeof COLOR_FAMILIES;
export type ColorShade = keyof typeof COLOR_FAMILIES.Blue;

/** Ordered list of color families for display */
const COLOR_FAMILY_ORDER: ColorFamily[] = [
  'Blue',
  'Orange',
  'Green',
  'Purple',
  'Red',
  'Cyan',
  'Yellow',
  'Neutral',
];

/** Ordered list of shades for display */
const SHADE_ORDER: ColorShade[] = [100, 200, 300, 400, 500, 600, 700, 800, 900];

// ============================================================================
// COLOR PICKER COMPONENT
// ============================================================================

interface ColorPickerProps {
  value?: string;
  onChange?: (color: string) => void;
  className?: string;
}

/**
 * Discrete color swatch picker.
 * Displays a grid of predefined colors organized by family (rows) and shade (columns).
 * Clicking a swatch immediately selects that color.
 */
export function ColorPicker({ value = '#000000', onChange, className }: ColorPickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleColorSelect = (color: string) => {
    onChange?.(color);
    setOpen(false);
  };

  // Find which swatch is currently selected (if any)
  const isSelected = (color: string) => {
    return value?.toLowerCase() === color.toLowerCase();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'h-4 w-4 rounded border border-border/30 cursor-pointer transition-all hover:scale-110',
            className
          )}
          style={{ backgroundColor: value }}
          aria-label="Pick color"
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="end">
        <div className="space-y-1.5">
          {COLOR_FAMILY_ORDER.map((family) => (
            <div key={family} className="flex items-center gap-1">
              {/* Color family label */}
              <span className="w-14 text-caption text-muted-foreground truncate">
                {family}
              </span>
              {/* Shade swatches */}
              <div className="flex gap-0.5">
                {SHADE_ORDER.map((shade) => {
                  const color = COLOR_FAMILIES[family][shade];
                  const selected = isSelected(color);
                  return (
                    <button
                      key={shade}
                      type="button"
                      onClick={() => handleColorSelect(color)}
                      className={cn(
                        'w-4 h-4 rounded-sm transition-all hover:scale-125 hover:z-10',
                        selected && 'ring-2 ring-foreground ring-offset-1 ring-offset-background'
                      )}
                      style={{ backgroundColor: color }}
                      title={`${family} ${shade}`}
                      aria-label={`${family} ${shade}: ${color}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all shades for a color family.
 */
export function getColorFamilyShades(family: ColorFamily): string[] {
  return SHADE_ORDER.map((shade) => COLOR_FAMILIES[family][shade]);
}

/**
 * Find which color family a hex color belongs to.
 * Returns null if not found in the predefined palette.
 */
export function findColorFamily(hex: string): ColorFamily | null {
  const normalizedHex = hex.toLowerCase();
  for (const family of COLOR_FAMILY_ORDER) {
    for (const shade of SHADE_ORDER) {
      if (COLOR_FAMILIES[family][shade].toLowerCase() === normalizedHex) {
        return family;
      }
    }
  }
  return null;
}

/**
 * Get a specific shade from a color family.
 */
export function getColorShade(family: ColorFamily, shade: ColorShade): string {
  return COLOR_FAMILIES[family][shade];
}

/**
 * Generate evenly distributed shades from a color family.
 * Useful for assigning distinct shades to multiple items.
 */
export function distributeShades(family: ColorFamily, count: number): string[] {
  const shades = getColorFamilyShades(family);
  if (count <= 1) return [shades[4]]; // Return 500 shade for single item
  if (count >= shades.length) return shades;

  // Distribute evenly across available shades
  const step = (shades.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const index = Math.round(i * step);
    return shades[Math.min(index, shades.length - 1)];
  });
}

// Legacy exports for backwards compatibility
export const ColorPickerAlpha = ColorPicker;
export const ColorPickerEyeDropper = () => null;
export const ColorPickerFormat = () => null;
export const ColorPickerHue = ColorPicker;
export const ColorPickerOutput = ColorPicker;
export const ColorPickerSelection = ColorPicker;
