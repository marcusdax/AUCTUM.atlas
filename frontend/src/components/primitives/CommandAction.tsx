import React from 'react';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { focusRing } from '../ui/Card';

export interface CommandActionProps {
  /** Button label */
  label: string;
  /** Icon to display (ReactNode) */
  icon?: React.ReactNode;
  /** Variant style */
  variant?: 'primary' | 'secondary' | 'tertiary';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Click handler */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Additional CSS classes */
  className?: string;
  /** HTML button type */
  type?: 'button' | 'submit' | 'reset';
  /** Aria label for accessibility */
  'aria-label'?: string;
}

/**
 * ORBITAL INTELLIGENCE CommandAction Component
 * 
 * Action buttons for command/control interfaces with three variants:
 * - Primary: Main actions (cyan/blue)
 * - Secondary: Supporting actions (glass/transparent)
 * - Tertiary: Subtle/ghost actions (text only)
 * Supports loading state, disabled for offline/degraded, and focus-visible ring.
 */
const CommandAction: React.FC<CommandActionProps> = ({
  label,
  icon,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  className,
  type = 'button',
  'aria-label': ariaLabel,
}) => {
  const sizeClasses = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-5 text-base gap-2.5',
  };

  const variantClasses = {
    primary: `
      bg-[hsl(var(--primary))] text-white
      hover:bg-[hsl(var(--primary-hover))]
      active:bg-[hsl(var(--primary))]/90
      shadow-md hover:shadow-lg
      border border-transparent
    `,
    secondary: `
      bg-[hsl(var(--background-elevated))] text-text-primary
      border border-[hsl(var(--border))]
      hover:bg-[hsl(var(--background-accent))]
      hover:border-[hsl(var(--border-hover))]
      active:bg-[hsl(var(--background-accent))]
    `,
    tertiary: `
      bg-transparent text-text-secondary
      border border-transparent
      hover:bg-[hsl(var(--background-accent))]
      hover:text-text-primary
      active:bg-[hsl(var(--background-accent))]
    `,
  };

  const iconSize = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150',
        'focus:outline-none',
        focusRing,
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel || (loading ? `Loading: ${label}` : label)}
      aria-disabled={isDisabled}
      aria-busy={loading}
    >
      {loading ? (
        <Loader2 className={clsx('animate-spin', iconSize[size])} aria-hidden="true" />
      ) : icon ? (
        <span className={clsx('flex-shrink-0', iconSize[size])} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{label}</span>
    </button>
  );
};

CommandAction.displayName = 'CommandAction';
export { CommandAction };