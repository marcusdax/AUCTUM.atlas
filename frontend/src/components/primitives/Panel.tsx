import React from 'react';
import { Card } from '../ui/Card';
import clsx from 'clsx';

export interface PanelProps {
  /** Panel title */
  title?: string;
  /** Panel subtitle */
  subtitle?: string;
  /** Panel content */
  children: React.ReactNode;
  /** Variant style */
  variant?: 'default' | 'interactive';
  /** Additional CSS classes */
  className?: string;
  /** Optional action element for header */
  action?: React.ReactNode;
}

/**
 * ORBITAL INTELLIGENCE Panel Component
 * 
 * Glass-metal panel wrapper with header section.
 * Uses Card component as base with orbital styling.
 * Variants: default (static), interactive (hover effects, clickable)
 */
const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  children,
  variant = 'default',
  className,
  action,
}) => {
  const isInteractive = variant === 'interactive';

  return (
    <Card
      variant={variant}
      title={title}
      subtitle={subtitle}
      className={clsx(
        'overflow-hidden',
        'bg-[hsl(var(--background-card))]/80 backdrop-blur-sm',
        'border-[hsl(var(--border))]',
        isInteractive && 'hover:shadow-lg hover:border-[hsl(var(--border-hover))] transition-all duration-200',
        className
      )}
    >
      {title && action && (
        <div className="absolute top-0 right-0 p-4 pointer-events-none">
          <div className="pointer-events-auto">{action}</div>
        </div>
      )}
      <div className={clsx('pt-0', title ? '' : 'pt-0')}>
        {children}
      </div>
    </Card>
  );
};

Panel.displayName = 'Panel';
export { Panel };