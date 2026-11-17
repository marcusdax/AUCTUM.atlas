import React from 'react';
import clsx from 'clsx';

export type CardVariant = 'default' | 'bordered' | 'interactive';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  title?: string;
  subtitle?: string;
}

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background focus-visible:ring-primary';

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    { className, variant = 'default', title, subtitle, children, onClick, onKeyDown, ...props },
    ref
  ) => {
    const isInteractive = variant === 'interactive' || typeof onClick === 'function';

    const baseClasses = 'rounded-xl bg-[hsl(var(--background-card))] border transition-shadow';

    const variantClasses: Record<CardVariant, string> = {
      default: 'border-border shadow-sm',
      bordered: 'border-border',
      interactive: 'border-border shadow-sm hover:shadow-md',
    };

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        // Activate interactive cards with the keyboard (Enter / Space).
        if (isInteractive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick?.(event as unknown as React.MouseEvent<HTMLDivElement>);
        }
        onKeyDown?.(event);
      },
      [isInteractive, onClick, onKeyDown]
    );

    return (
      <div
        ref={ref}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-roledescription={isInteractive ? 'card' : undefined}
        className={clsx(
          baseClasses,
          variantClasses[variant],
          {
            [focusRing]: isInteractive,
            'cursor-pointer': isInteractive,
          },
          className
        )}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {title && (
          <div className="border-b border-border px-6 py-4">
            <h3 className="font-display text-[1.05rem] font-medium text-text-primary">{title}</h3>
            {subtitle && <p className="text-sm text-text-tertiary">{subtitle}</p>}
          </div>
        )}
        <div className={title ? 'p-6' : 'p-6'}>{children}</div>
      </div>
    );
  }
);

Card.displayName = 'Card';
export { Card };
export default Card;

// ===== Badge =====
export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'extreme'
  | 'severe'
  | 'moderate'
  | 'minor';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', size = 'md', className }) => {
  const baseClasses = 'inline-flex items-center rounded-sm font-medium';

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs';

  const variantClasses: Record<BadgeVariant, string> = {
    default: 'bg-[hsl(var(--background-accent))] text-text-secondary',
    success: 'bg-[hsl(var(--emerald))]/10 text-[hsl(var(--emerald))]',
    warning: 'bg-[hsl(var(--amber))]/10 text-[hsl(var(--amber))]',
    danger: 'bg-[hsl(var(--red))]/10 text-[hsl(var(--red))]',
    info: 'bg-[hsl(var(--primary))]/10 text-primary',
    extreme: 'bg-[hsl(var(--severity-extreme))]/10 text-[hsl(var(--severity-extreme))]',
    severe: 'bg-[hsl(var(--severity-severe))]/10 text-[hsl(var(--severity-severe))]',
    moderate: 'bg-[hsl(var(--severity-moderate))]/10 text-[hsl(var(--severity-moderate))]',
    minor: 'bg-[hsl(var(--severity-minor))]/10 text-[hsl(var(--severity-minor))]',
  };

  return (
    <span className={clsx(baseClasses, sizeClasses, variantClasses[variant], className)}>
      {children}
    </span>
  );
};

// ===== StatusDot =====
export interface StatusDotProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusDot: React.FC<StatusDotProps> = ({ status, size = 'md' }) => {
  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-[hsl(var(--emerald))]',
    COMPLETED: 'bg-[hsl(var(--emerald))]',
    APPROVED: 'bg-[hsl(var(--emerald))]',
    WON: 'bg-[hsl(var(--emerald))]',
    DELIVERED: 'bg-[hsl(var(--emerald))]',
    CANCELLED: 'bg-[hsl(var(--red))]',
    REJECTED: 'bg-[hsl(var(--red))]',
    LOST: 'bg-[hsl(var(--red))]',
    ON_HOLD: 'bg-[hsl(var(--amber))]',
    PENDING: 'bg-[hsl(var(--amber))]',
    ESTIMATE_SENT: 'bg-[hsl(var(--amber))]',
    BACKORDERED: 'bg-[hsl(var(--orange))]',
    DRAFT: 'bg-[hsl(var(--text-tertiary))]',
    SENT: 'bg-[hsl(var(--primary))]',
    CONTACTED: 'bg-[hsl(var(--primary))]',
    ORDERED: 'bg-[hsl(var(--primary))]',
    INSPECTION_SCHEDULED: 'bg-[hsl(var(--purple))]',
    NEW: 'bg-[hsl(var(--text-tertiary))]',
  };

  const colorClass = statusColors[status] || 'bg-[hsl(var(--text-tertiary))]';
  const sizeClass = size === 'sm' ? 'h-2 w-2' : 'h-3 w-3';

  // StatusDot is always paired with visible label text, so it is decorative.
  return (
    <span
      className={clsx('inline-block', sizeClass, 'rounded-full', colorClass, 'mr-2')}
      role="presentation"
      aria-hidden="true"
    />
  );
};


