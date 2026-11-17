import React from 'react';
import clsx from 'clsx';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Label text rendered above the input. */
  label?: string;
  /** Optional helper/description text shown below the input. */
  helperText?: string;
  /** Error message. When provided, the input is marked invalid and described. */
  error?: string;
  /** Size variant. Defaults to the design-system `md`. */
  size?: InputSize;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background focus-visible:ring-primary';

const sizeClasses: Record<InputSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-3 text-sm',
  lg: 'h-12 px-4 text-base',
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, size = 'md', id, ...props }, ref) => {
    const reactId = React.useId();
    const inputId = id ?? `input-${reactId}`;
    const describedBy = [helperText ? `${inputId}-helper` : null, error ? `${inputId}-error` : null]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={clsx(
            'w-full rounded-lg border bg-[hsl(var(--background))] text-text-primary',
            'placeholder-[hsl(var(--text-tertiary))]/80',
            'transition-colors file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5',
            'file:text-sm file:font-medium file:text-white',
            'disabled:cursor-not-allowed disabled:opacity-60',
            sizeClasses[size],
            error
              ? 'border-red focus-visible:ring-red/70'
              : 'border-border hover:border-border-hover focus-visible:ring-primary',
            focusRing,
            className
          )}
          {...props}
        />
        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            className="text-xs text-text-tertiary"
          >
            {helperText}
          </p>
        )}
        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-xs text-red"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
