'use client';

import { Select } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemedSelectProps<T extends string | number> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

/** Short themed choice lists use a button so mobile browsers do not open a keyboard. */
export function ThemedSelect<T extends string | number>({ options, value, onChange, ariaLabel, className, disabled = false }: ThemedSelectProps<T>) {
  return (
    <Select.Root<T> items={options} value={value} onValueChange={next => { if (next !== null) onChange(next); }} disabled={disabled}>
      <Select.Trigger aria-label={ariaLabel} className={cn('flex min-h-10 min-w-0 w-full md:min-h-8 items-center justify-between gap-2 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60', className)}>
        <Select.Value className="truncate" />
        <Select.Icon><ChevronDown className="size-3.5 shrink-0" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4} alignItemWithTrigger={false} className="z-[60]">
          <Select.Popup className="max-h-[200px] min-w-[var(--anchor-width)] overflow-auto rounded-md border border-input bg-popover text-popover-foreground shadow-md">
            <Select.List>
              {options.map(option => (
                <Select.Item key={option.value} value={option.value} className="flex cursor-pointer items-center justify-between gap-2 px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent">
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator><Check className="size-3.5" /></Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
