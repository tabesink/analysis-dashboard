'use client';

/**
 * Extracted from client/src/components/upload/DatabaseEventTree.tsx (lines 108-136).
 *
 * Uses Radix CheckboxPrimitive directly rather than the shadcn Checkbox wrapper
 * because the indeterminate state needs:
 *   - data-state="indeterminate" written literally
 *   - the `checked` prop set to the string 'indeterminate' (not a boolean)
 *   - a Minus icon swapped in for the Check icon
 *
 * The onClick stopPropagation is mandatory: without it, clicking the checkbox
 * also toggles the surrounding Collapsible, which is never what the user wants.
 */

import { Check, Minus } from 'lucide-react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cn } from '@/lib/utils';

export interface IndeterminateCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

export function IndeterminateCheckbox({
  checked,
  indeterminate,
  onCheckedChange,
  className,
}: IndeterminateCheckboxProps) {
  const state = indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked';

  return (
    <CheckboxPrimitive.Root
      data-state={state}
      checked={indeterminate ? 'indeterminate' : checked}
      onCheckedChange={(val) => onCheckedChange(val === true)}
      className={cn(
        'peer border-border/70 bg-background dark:bg-input/20 data-[state=checked]:bg-primary/90 data-[state=indeterminate]:bg-primary/90 data-[state=checked]:text-primary-foreground data-[state=indeterminate]:text-primary-foreground data-[state=checked]:border-primary/90 data-[state=indeterminate]:border-primary/90 focus-visible:border-ring focus-visible:ring-ring/50 size-3.5 shrink-0 rounded-[3px] border shadow-none transition-shadow outline-none focus-visible:ring-[2px] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <CheckboxPrimitive.Indicator className="grid place-content-center text-current transition-none">
        {indeterminate ? (
          <Minus className="size-3" />
        ) : (
          <Check className="size-3" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
