'use client';

import { Button } from '@/components/ui/button';
import { SHORT_LABELS } from './constants';
import type { ActiveFilterChip, GlobalFilterChipField } from './types';

interface FilterSummaryBarProps {
  activeFilters: ActiveFilterChip[];
  onRemove: (field: GlobalFilterChipField, value: string) => void;
  onClearAll: () => void;
}

export function FilterSummaryBar({
  activeFilters,
  onRemove,
  onClearAll,
}: FilterSummaryBarProps) {
  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {activeFilters.map((item) => (
          <Button
            key={`${item.field}:${item.value}`}
            type="button"
            variant="ghost"
            onClick={() => onRemove(item.field, item.value)}
            className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            title="Remove filter"
          >
            {SHORT_LABELS[item.displayName] ?? item.displayName}: {item.value} ×
          </Button>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={onClearAll}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Clear all filters
      </Button>
    </div>
  );
}
