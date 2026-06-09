# Visual Spec — Flex Tables (Workbench Parity)

Canonical sources:

- `reference/canartdb-ui/src/components/upload/CertificateFlatTable.tsx`
- `reference/canartdb-ui/src/components/upload/CertificatePagesTable.tsx`
- `reference/database-table-skill/DESIGN.md`
- `reference/database-table-skill/tokens.md`

---

## Stack gate

Before porting, confirm:

```bash
rg -l '@import "tailwindcss"' --type css
rg -l 'from "@radix-ui' --type tsx
```

If `tailwind.config.js` exists → stop and migrate to Tailwind v4 first.

---

## Card shell (both flat and hierarchy)

```tsx
<Card className="h-full rounded-r-lg rounded-l-none flex flex-col gap-0 overflow-hidden border py-0 shadow-none">
  <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b">...</div>
  <CardContent className="flex-1 min-h-0 overflow-auto p-0">
    <div style={{ minWidth: totalRowWidth }}>
      <div className="sticky top-0 z-10 flex items-center py-2 px-3 border-b bg-card text-xs font-semibold text-foreground/70">...</div>
    </div>
  </CardContent>
</Card>
```

| Class / rule | Why |
|--------------|-----|
| `rounded-l-none` | Table is right pane beside side panel |
| `gap-0 py-0` | Flush header to body |
| `min-h-0 overflow-auto` on CardContent | Enables sticky header inside flex parent |
| `minWidth: totalRowWidth` | Horizontal scroll when columns exceed viewport |

---

## Column layout math

### flexFor helper (copy verbatim)

```ts
function flexFor(basis: number): CSSProperties {
  return { flex: `${basis} 0 ${basis}px` };
}
```

### Width constants

| Constant | Flat table | Pages table |
|----------|------------|-------------|
| `SELECT_COLUMN_PX` | 36 | — |
| `LEVEL_1_DEFAULT_PX` | 320 | 200 |
| `MIN_COLUMN_PX` | 80 | 80 |
| `MAX_COLUMN_PX` | 400 | 400 |
| `CHAR_PX` | 7.2 | 7.2 |
| `PADDING_PX` | 32 | 32 |

---

## Row variants

### Flat data row

`flex items-center py-1.5 px-3 border-b hover:bg-muted/30 transition-colors group`

### Group row (Page)

`flex items-center py-2 px-3 border-t border-b bg-muted/60 hover:bg-muted/70 transition-colors`

### Leaf row (Table link)

First cell: `pl-[20px] border-l border-border` with `flexFor(level1Width)`

Leaf data columns: **empty spans** (no dash placeholder).

---

## Visual parity checklist

```
[ ] Card uses rounded-r-lg rounded-l-none, no shadow
[ ] Sticky header has bg-card (opaque)
[ ] All rows use flex, never <table>
[ ] Column headers and cells share flexFor widths
[ ] Leaf indent is pl-[20px] border-l border-border
[ ] Group rows bg-muted/60, leaf hover bg-muted/30
[ ] Text is text-xs throughout
[ ] Column resize handle on header right edge
[ ] Horizontal scroll when totalRowWidth > viewport
```

See `reference/database-table-skill/DESIGN.md` for full row-level class strings and 3-level variant details.
