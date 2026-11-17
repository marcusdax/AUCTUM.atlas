import React from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Legacy convenience alias — rendered as the leading icon. */
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background focus-visible:ring-primary';

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      icon,
      leftIcon,
      rightIcon,
      isLoading,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;
    const leadingIcon = icon ?? leftIcon;

    const baseClasses = [
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
      'transition-all duration-150 ease-out',
      focusRing,
      'disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:transform-none',
      'motion-reduce:transition-none motion-reduce:hover:transform-none',
    ];

    const variantClasses: Record<ButtonVariant, string> = {
      primary:
        'bg-primary text-white hover:bg-primary-hover shadow-md hover:shadow-lg',
      secondary:
        'bg-[hsl(var(--background-elevated))] text-text-primary border border-border ' +
        'hover:bg-[hsl(var(--background-accent))]',
      ghost:
        'bg-transparent text-text-secondary hover:bg-[hsl(var(--background-card))] ' +
        'hover:text-text-primary',
      outline:
        'border border-primary text-primary hover:bg-primary/10',
      danger:
        'bg-[hsl(var(--red))] text-white hover:bg-[hsl(var(--red))]/90',
    };

    const sizeClasses: Record<ButtonSize, string> = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-5 text-base',
      xl: 'h-14 px-6 text-lg',
    };

    return (
      <button
        ref={ref}
        className={clsx(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        disabled={isDisabled}
        aria-busy={isLoading ? true : undefined}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
            {children}
          </>
        ) : (
          <>
            {leadingIcon && (
              <span aria-hidden="true" className="flex items-center">
                {leadingIcon}
              </span>
            )}
            {children}
            {rightIcon && (
              <span aria-hidden="true" className="flex items-center">
                {rightIcon}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
export { Button };
export default Button;
