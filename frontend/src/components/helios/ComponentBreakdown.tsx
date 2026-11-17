import React from 'react';
import { Card } from '../ui';
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';

export interface SubItem {
  name: string;
  confidence: number;
  severity?: 'extreme' | 'severe' | 'moderate' | 'minor' | 'info';
}

export interface ComponentBreakdownProps {
  name: string;
  confidence: number;
  status: string;
  subItems?: SubItem[];
  isCollapsed?: boolean;
  onToggle?: () => void;
  showHeader?: boolean;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 75) return 'text-[hsl(var(--emerald))]';
  if (confidence >= 50) return 'text-[hsl(var(--amber))]';
  return 'text-[hsl(var(--red))]';
}

function getConfidenceBgColor(confidence: number): string {
  if (confidence >= 75) return 'bg-[hsl(var(--emerald))]';
  if (confidence >= 50) return 'bg-[hsl(var(--amber))]';
  return 'bg-[hsl(var(--red))]';
}

function getSeverityColor(severity?: string): string {
  const colors: Record<string, string> = {
    extreme: 'text-[hsl(var(--severity-extreme))]',
    severe: 'text-[hsl(var(--severity-severe))]',
    moderate: 'text-[hsl(var(--severity-moderate))]',
    minor: 'text-[hsl(var(--severity-minor))]',
    info: 'text-[hsl(var(--primary))]',
  };
  return colors[severity || ''] || 'text-text-tertiary';
}

function getSeverityIcon(severity?: string) {
  switch (severity) {
    case 'extreme':
      return <XCircle className="w-3 h-3 text-[hsl(var(--severity-extreme))]" />;
    case 'severe':
      return <AlertCircle className="w-3 h-3 text-[hsl(var(--severity-severe))]" />;
    case 'moderate':
      return <AlertCircle className="w-3 h-3 text-[hsl(var(--severity-moderate))]" />;
    case 'minor':
      return <CheckCircle className="w-3 h-3 text-[hsl(var(--severity-minor))]" />;
    default:
      return null;
  }
}

function ProgressBar({
  value,
  className = '',
  height = 2,
  showLabel = true,
}: {
  value: number;
  className?: string;
  height?: number;
  showLabel?: boolean;
}) {
  return (
    <div className={clsx('rounded-full bg-[hsl(var(--border))] overflow-hidden', className)} style={{ height: `${height}px` }}>
      <div
        className={clsx('h-full transition-all duration-1000 ease-out', getConfidenceBgColor(value))}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function StatusIndicator({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' | 'lg' }) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    GOOD: { color: 'bg-[hsl(var(--emerald))]', label: 'Good' },
    FAIR: { color: 'bg-[hsl(var(--amber))]', label: 'Fair' },
    POOR: { color: 'bg-[hsl(var(--red))]', label: 'Poor' },
    CRITICAL: { color: 'bg-[hsl(var(--severity-extreme))]', label: 'Critical' },
    UNKNOWN: { color: 'bg-[hsl(var(--text-tertiary))]', label: 'Unknown' },
  };

  const config = statusConfig[status] || statusConfig.UNKNOWN;
  const sizeClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  return (
    <span className="flex items-center gap-1.5">
      <span className={clsx('rounded-full', config.color, sizeClasses[size])} />
      <span className="text-xs font-medium text-text-secondary capitalize">{config.label.toLowerCase()}</span>
    </span>
  );
}

function SubItemRow({ item, index }: { item: SubItem; index: number }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-5 h-5 flex items-center justify-center">
        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--border))]" />
      </span>
      {item.severity && getSeverityIcon(item.severity)}
      <span className="text-xs text-text-tertiary flex-1 min-w-0 truncate capitalize">
        {item.name.replace(/-/g, ' ')}
      </span>
      <ProgressBar value={item.confidence} className="flex-1 max-w-md" height={3} showLabel={false} />
      <span className={clsx('text-xs font-mono font-medium w-10 text-right', getConfidenceColor(item.confidence))}>
        {item.confidence}%
      </span>
    </div>
  );
}

export const ComponentBreakdown: React.FC<ComponentBreakdownProps> = ({
  name,
  confidence,
  status,
  subItems = [],
  isCollapsed = false,
  onToggle,
  showHeader = true,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(!isCollapsed);
  const hasSubItems = subItems.length > 0;

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
    onToggle?.();
  };

  if (!showHeader) {
    return (
      <div className="space-y-2 animate-slideUp">
        {hasSubItems && isExpanded && (
          <div className="ml-4 space-y-1 border-l border-[hsl(var(--border))] pl-4">
            {subItems.map((item, idx) => (
              <SubItemRow key={idx} item={item} index={idx} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card variant="bordered" className="overflow-hidden">
      <button
        onClick={handleToggle}
        className={clsx(
          'w-full flex items-center gap-3 p-4 transition-colors',
          'hover:bg-[hsl(var(--background-elevated))]',
          hasSubItems ? 'cursor-pointer' : 'cursor-default'
        )}
        aria-expanded={isExpanded}
        disabled={!hasSubItems}
      >
        {hasSubItems && (
          <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-text-tertiary transition-transform duration-200">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        )}
        {!hasSubItems && <span className="flex-shrink-0 w-6" />}

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-sm font-semibold text-text-primary capitalize">{name}</span>
          <StatusIndicator status={status} size="sm" />
        </div>

        <ProgressBar value={confidence} className="w-32 flex-shrink-0" height={4} showLabel={false} />
        <span className={clsx('text-sm font-mono font-bold w-12 text-right', getConfidenceColor(confidence))}>
          {confidence}%
        </span>
      </button>

      {hasSubItems && isExpanded && (
        <div className="animate-slideUp border-t border-[hsl(var(--border))]">
          <div className="p-4 space-y-1">
            {subItems.map((item, idx) => (
              <SubItemRow key={idx} item={item} index={idx} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default ComponentBreakdown;