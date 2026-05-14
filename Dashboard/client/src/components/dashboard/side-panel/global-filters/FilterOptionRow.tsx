'use client';

import { Checkbox } from '@/components/ui/checkbox';

interface FilterOptionRowProps {
  option: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
}

export function FilterOptionRow({
  option,
  count,
  checked,
  onToggle,
}: FilterOptionRowProps) {
  return (
    <label className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="size-3.5 rounded-[3px] border-border/70 bg-background data-[state=checked]:bg-primary/90 data-[state=checked]:border-primary/90 [&_svg]:size-3"
      />
      <span className="text-xs truncate flex-1">{option}</span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </label>
  );
}
