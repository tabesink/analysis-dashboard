# Spacing Tokens

These are the named constants the canonical implementation depends on. Copy them verbatim into the target's table component — do not invent new values, do not round, do not "simplify" by removing the `+ 1` for the border.

The `+ 1` matters: each `border-l` paints a 1-pixel line that consumes width inside the wrapper. Without accounting for it the leaf cells drift one pixel left of the column header.

## Row paint constants

```ts
/** Horizontal padding inside every row (matches the `px-3` utility). */
export const ROW_PADDING_X_PX = 12;

/** Subgroup wrapper indent: `ml-6` (24px) plus the 1px `border-l border-border` line. */
export const SUBGROUP_INDENT_PX = 24 + 1;

/** Leaf wrapper indent: `ml-5` (20px) plus the 1px `border-l border-border` line. */
export const LEAF_INDENT_PX = 20 + 1;
```

## Column width constants

```ts
/** Width applied to a column when no specific width has been computed yet. */
export const FALLBACK_COLUMN_PX = 80;

/** Lower clamp for column resize. Below this columns become unreadable. */
export const MIN_COLUMN_PX = 80;

/** Upper clamp for column resize. */
export const MAX_COLUMN_PX = 400;

/** Default width of the level-1 (Group) column on first paint. Tuned so a typical
 *  3-level program/version/event row aligns its leaf data with the column headers
 *  above without the user having to drag. Adjust per target if level-1 labels are
 *  much shorter or longer. */
export const LEVEL_1_DEFAULT_PX = 250;
```

## Per-column heuristic seed

When the page first mounts, seed each column's width from the longest known value (or column label, whichever is longer):

```ts
/** Per-column character width (tuned for the table's `text-xs` cells, sort arrow,
 *  filter icon, and horizontal padding). */
const CHAR_PX = 7.2;

/** Sum of per-cell horizontal padding + sort arrow + filter icon spacing. */
const PADDING_PX = 32;

export function widthForValues(label: string, values: string[]): number {
  const longest = values.reduce((max, v) => Math.max(max, v.length), label.length);
  return Math.min(
    MAX_COLUMN_PX,
    Math.max(MIN_COLUMN_PX, Math.ceil(longest * CHAR_PX) + PADDING_PX),
  );
}
```

This is intentionally a heuristic — exact text measurement (canvas + getComputedStyle) is overkill for first paint. Users resize what they care about; the seed only needs to be "close enough not to clip the header label".

## Resize clamp constants

```ts
/** Default minimum column width during drag (overridable per column). */
export const RESIZE_MIN_PX = 60;

/** Default maximum column width during drag (overridable per column). */
export const RESIZE_MAX_PX = 600;
```

These differ from `MIN_COLUMN_PX` / `MAX_COLUMN_PX` on purpose: the seed values clamp the heuristic, the resize values clamp the user gesture.

## Why these specific numbers

| Constant            | Source                                                                                              |
|---------------------|-----------------------------------------------------------------------------------------------------|
| `ROW_PADDING_X_PX`  | Tailwind `px-3` = 0.75rem = 12px at the default 16px root font size                                 |
| `SUBGROUP_INDENT_PX`| Tailwind `ml-6` = 1.5rem = 24px, plus 1px `border-l`                                                |
| `LEAF_INDENT_PX`    | Tailwind `ml-5` = 1.25rem = 20px, plus 1px `border-l`                                               |
| `LEVEL_1_DEFAULT_PX`| Empirically tuned in `client/src/app/database/page.tsx` so default leaf data lines up with headers  |
| `CHAR_PX`           | Empirically tuned for Geist Sans at `text-xs` (12px)                                                 |
| `PADDING_PX`        | `px-2` cell padding (16px) + sort button (~8px) + filter icon (~8px)                                 |

If the target uses a different font (not Geist) or a different base font size, `CHAR_PX` and `PADDING_PX` may need re-tuning. Everything else is fixed by the Tailwind utility classes the design system uses.
