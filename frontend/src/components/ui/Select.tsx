import React from 'react';
import clsx from 'clsx';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> {
  /** Label rendered above the select. */
  label?: string;
  /** Placeholder shown when nothing is selected. */
  placeholder?: string;
  /** Options rendered as <SelectItem>s. */
  options?: SelectOption[];
  /** Optional grouping label rendered with <SelectLabel>. */
  groupLabel?: string;
  size?: SelectSize;
  className?: string;
}

const triggerSizeClasses: Record<SelectSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-3 text-sm',
  lg: 'h-12 px-4 text-base',
};

interface SelectTriggerProps extends SelectPrimitive.SelectTriggerProps {
  size?: SelectSize;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background focus-visible:ring-primary';

function SelectTrigger({ className, size = 'md', children, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={clsx(
        'inline-flex w-full items-center justify-between rounded-lg border',
        'border-border bg-[hsl(var(--background))]/80 text-text-primary',
        'placeholder-[hsl(var(--text-tertiary))]/80',
        'transition-colors hover:border-border-hover',
        'disabled:cursor-not-allowed disabled:opacity-60',
        focusRing,
        triggerSizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 text-text-tertiary" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ className, label, placeholder, options, groupLabel, size = 'md', ...props }, ref) => {
    const describedById = React.useId();

    return (
      <div ref={ref} className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            id={describedById}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <SelectPrimitive.Root {...props}>
          <SelectTrigger
            size={size}
            aria-describedby={label ? describedById : undefined}
            className={className}
          >
            <SelectPrimitive.Value placeholder={placeholder ?? 'Select...'} />
          </SelectTrigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className={clsx(
                'z-50 w-full min-w-[var(--radix-select-trigger-width)]',
                'overflow-y-auto rounded-lg border border-border',
                'bg-[hsl(var(--background-card))] shadow-xl py-1 text-text-primary'
              )}
            >
              <SelectPrimitive.ScrollUpButton
                className="flex cursor-default items-center justify-center py-1 text-xs text-text-tertiary"
                aria-hidden
              >
                <ChevronDown className="h-3 w-3 rotate-180" />
              </SelectPrimitive.ScrollUpButton>
              {groupLabel && (
                <SelectPrimitive.Label className="px-3 py-2 text-xs font-semibold text-text-tertiary">
                  {groupLabel}
                </SelectPrimitive.Label>
              )}
              {options
                ? options.map((opt) =>
                    opt.disabled ? (
                      <SelectPrimitive.Item
                        key={opt.value}
                        value={opt.value}
                        disabled
                        className="relative flex cursor-not-allowed items-center justify-between px-3 py-2 text-sm text-text-tertiary"
                      >
                        {opt.label}
                      </SelectPrimitive.Item>
                    ) : (
                      <SelectPrimitive.Item
                        key={opt.value}
                        value={opt.value}
                        className="relative flex items-center justify-between px-3 py-2 text-sm cursor-pointer text-text-primary hover:bg-[hsl(var(--background-accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                      >
                        <span>{opt.label}</span>
                        <SelectPrimitive.ItemIndicator>
                          <Check className="h-4 w-4 text-primary" />
                        </SelectPrimitive.ItemIndicator>
                      </SelectPrimitive.Item>
                    )
                  )
                : null}
              <SelectPrimitive.ScrollDownButton
                className="flex cursor-default items-center justify-center py-1 text-xs text-text-tertiary"
                aria-hidden
              >
                <ChevronDown className="h-3 w-3" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
