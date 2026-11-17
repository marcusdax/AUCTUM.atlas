import React from 'react';
import { Card } from '../ui';
import {
  Home,
  ChevronDown,
  ChevronRight,
  Search,
  GitCompare,
  Calculator,
  TrendingUp,
} from 'lucide-react';
import clsx from 'clsx';

export interface ComponentResult {
  confidence: number;
  status: string;
  subItems?: SubItem[];
}

export interface SubItem {
  name: string;
  confidence: number;
}

export interface ModelResults {
  roof?: ComponentResult;
  siding?: ComponentResult;
  gutters?: ComponentResult;
  windows?: ComponentResult;
}

export interface PropertyModelSummaryProps {
  propertyAddress: string;
  modelResults: ModelResults;
  overallConfidence: number;
  onInspect?: () => void;
  onCompare?: () => void;
  onEstimate?: () => void;
}

const ComponentLabels: Record<string, string> = {
  roof: 'ROOF',
  siding: 'SIDING',
  gutters: 'GUTTERS',
  windows: 'WINDOWS',
};

const SubItemLabels: Record<string, string> = {
  'hail-impact': 'Hail impact',
  'wind-displacement': 'Wind displacement',
  'missing-shingles': 'Missing shingles',
  'cracked-panels': 'Cracked panels',
  'loose-fasteners': 'Loose fasteners',
  'dented-sections': 'Dented sections',
  'clogged-downspouts': 'Clogged downspouts',
  'sagging-sections': 'Sagging sections',
  'broken-seals': 'Broken seals',
  'cracked-glass': 'Cracked glass',
  'frame-damage': 'Frame damage',
};

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

function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={clsx('h-2 rounded-full bg-[hsl(var(--border))] overflow-hidden', className)}>
      <div
        className={clsx('h-full transition-all duration-1000 ease-out', getConfidenceBgColor(value))}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function StatusDot({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const statusColors: Record<string, string> = {
    GOOD: 'bg-[hsl(var(--emerald))]',
    FAIR: 'bg-[hsl(var(--amber))]',
    POOR: 'bg-[hsl(var(--red))]',
    UNKNOWN: 'bg-[hsl(var(--text-tertiary))]',
  };
  const colorClass = statusColors[status] || 'bg-[hsl(var(--text-tertiary))]';
  const sizeClass = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';
  return <span className={clsx(sizeClass, 'rounded-full', colorClass)} />;
}

function ComponentRow({
  componentKey,
  name,
  confidence,
  status,
  subItems,
  isExpanded,
  onToggle,
}: {
  componentKey: string;
  name: string;
  confidence: number;
  status: string;
  subItems?: SubItem[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasSubItems = subItems && subItems.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-text-primary hover:text-text-secondary transition-colors"
          aria-expanded={isExpanded}
          aria-controls={`${componentKey}-subitems`}
        >
          {hasSubItems && (
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary w-24">
            {name}
          </span>
          <StatusDot status={status} size="sm" />
          <ProgressBar value={confidence} className="flex-1 max-w-xs" />
          <span className={clsx('text-sm font-mono font-semibold w-12 text-right', getConfidenceColor(confidence))}>
            {confidence}%
          </span>
        </button>
      </div>

      {hasSubItems && isExpanded && (
        <div id={`${componentKey}-subitems`} className="ml-10 space-y-1.5 animate-fadeIn">
          {subItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="w-5 h-5 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--border))]" />
              </span>
              <span className="text-xs text-text-tertiary w-24 capitalize">
                {SubItemLabels[item.name] || item.name.replace(/-/g, ' ')}
              </span>
              <ProgressBar value={item.confidence} className="flex-1 max-w-xs" />
              <span className={clsx('text-xs font-mono font-medium w-10 text-right', getConfidenceColor(item.confidence))}>
                {item.confidence}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const PropertyModelSummary: React.FC<PropertyModelSummaryProps> = ({
  propertyAddress,
  modelResults,
  overallConfidence,
  onInspect,
  onCompare,
  onEstimate,
}) => {
  const [expandedComponents, setExpandedComponents] = React.useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpandedComponents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const components = Object.entries(modelResults).map(([componentKey, result]) => ({
    componentKey,
    name: ComponentLabels[componentKey] || componentKey.toUpperCase(),
    confidence: result.confidence,
    status: result.status,
    subItems: result.subItems,
  }));

  return (
    <Card variant="bordered" title="AI Property Assessment" subtitle={propertyAddress}>
      <div className="space-y-6">
        {/* Component Breakdown */}
        <div className="space-y-4">
          {components.map((comp) => (
            <ComponentRow
              key={comp.componentKey}
              {...comp}
              isExpanded={expandedComponents[comp.componentKey] || false}
              onToggle={() => toggleExpand(comp.componentKey)}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-[hsl(var(--border))]" />

        {/* Overall Confidence Gauge */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-[hsl(var(--intelligence-cyan))]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                AI CONFIDENCE
              </p>
              <p className={clsx('text-3xl font-bold font-mono', getConfidenceColor(overallConfidence))}>
                {overallConfidence.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onInspect}
              className="btn btn-secondary btn-sm flex items-center gap-2"
              disabled={!onInspect}
            >
              <Search className="w-4 h-4" />
              INSPECT
            </button>
            <button
              onClick={onCompare}
              className="btn btn-secondary btn-sm flex items-center gap-2"
              disabled={!onCompare}
            >
              <GitCompare className="w-4 h-4" />
              COMPARE
            </button>
            <button
              onClick={onEstimate}
              className="btn btn-primary btn-sm flex items-center gap-2"
              disabled={!onEstimate}
            >
              <Calculator className="w-4 h-4" />
              ESTIMATE
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PropertyModelSummary;