import React, { useState, useMemo } from 'react';
import { Card } from '../ui';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calculator,
  FileText,
  Download,
  MoreHorizontal,
} from 'lucide-react';
import clsx from 'clsx';

export interface EstimateLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  category?: string;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export interface EstimateLineItemsProps {
  items: EstimateLineItem[];
  title?: string;
  subtitle?: string;
  showTotals?: boolean;
  showCategoryGroups?: boolean;
  sortable?: boolean;
  onItemClick?: (item: EstimateLineItem) => void;
  onExport?: (items: EstimateLineItem[]) => void;
  className?: string;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = keyof EstimateLineItem | 'totalCost';

const COLUMNS: { key: SortColumn; label: string; width?: string }[] = [
  { key: 'description', label: 'DESCRIPTION', width: '40%' },
  { key: 'quantity', label: 'QTY', width: '8%' },
  { key: 'unit', label: 'UNIT', width: '8%' },
  { key: 'unitCost', label: 'UNIT COST', width: '15%' },
  { key: 'totalCost', label: 'TOTAL', width: '15%' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function CategoryHeader({
  category,
  items,
  isExpanded,
  onToggle,
}: {
  category: string;
  items: EstimateLineItem[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const categoryTotal = items.reduce((sum, item) => sum + item.totalCost, 0);
  const itemCount = items.length;

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3 bg-[hsl(var(--background-elevated))] border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--background-accent))] transition-colors text-left"
    >
      <span
        className={clsx(
          'flex-shrink-0 w-5 h-5 flex items-center justify-center transition-transform duration-200',
          isExpanded ? 'rotate-180' : 'rotate-0'
        )}
      >
        <ChevronRight className="w-4 h-4 text-text-tertiary" />
      </span>
      <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex-1">
        {category}
      </span>
      <span className="text-xs text-text-tertiary px-2 py-0.5 bg-[hsl(var(--background))] rounded">
        {itemCount} items
      </span>
      <span className="text-sm font-mono font-semibold text-text-primary text-right w-24">
        {formatCurrency(categoryTotal)}
      </span>
    </button>
  );
}

function ItemRow({
  item,
  index,
  onClick,
  showCategory = false,
}: {
  item: EstimateLineItem;
  index: number;
  onClick?: () => void;
  showCategory?: boolean;
}) {
  return (
    <tr
      className={clsx(
        'border-b border-[hsl(var(--border))] transition-colors',
        onClick && 'cursor-pointer hover:bg-[hsl(var(--background-elevated))]'
      )}
      onClick={onClick}
    >
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-text-primary truncate">
            {item.description}
          </span>
          {showCategory && item.category && (
            <span className="text-xs text-text-tertiary uppercase tracking-wider">
              {item.category}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-mono text-text-primary">{formatNumber(item.quantity)}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-xs text-text-tertiary uppercase">{item.unit}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-mono text-text-primary">{formatCurrency(item.unitCost)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-mono font-semibold text-text-primary">
          {formatCurrency(item.totalCost)}
        </span>
      </td>
    </tr>
  );
}

function SortableHeader({
  column,
  sortColumn,
  sortDirection,
  onSort,
}: {
  column: { key: SortColumn; label: string };
  sortColumn: SortColumn | null;
  sortDirection: SortDirection;
  onSort: (key: SortColumn) => void;
}) {
  const isSorted = sortColumn === column.key;
  const isAsc = sortDirection === 'asc';

  return (
    <th
      className={clsx(
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary',
        'hover:text-text-primary transition-colors cursor-pointer select-none'
      )}
      onClick={() => onSort(column.key)}
    >
      <div className="flex items-center gap-1.5">
        <span>{column.label}</span>
        {isSorted && (
          <span className="flex items-center">
            {isAsc ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-primary" />}
          </span>
        )}
        {!isSorted && <span className="w-4 h-4 text-text-disabled"><ChevronUp className="w-4 h-4 opacity-50" /></span>}
      </div>
    </th>
  );
}

export const EstimateLineItems: React.FC<EstimateLineItemsProps> = ({
  items,
  title = 'Estimate Line Items',
  subtitle,
  showTotals = true,
  showCategoryGroups = true,
  sortable = true,
  onItemClick,
  onExport,
  className = '',
}) => {
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const handleSort = (key: SortColumn) => {
    if (sortColumn === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));
      if (sortDirection === 'desc') setSortColumn(null);
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  const sortedItems = useMemo(() => {
    if (!sortColumn || !sortDirection) return items;

    return [...items].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === undefined || bVal === undefined) return 0;

      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [items, sortColumn, sortDirection]);

  const groupedItems = useMemo(() => {
    if (!showCategoryGroups) return { '': sortedItems };

    const groups: Record<string, EstimateLineItem[]> = {};
    sortedItems.forEach((item) => {
      const category = item.category || 'General';
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
    });
    return groups;
  }, [sortedItems, showCategoryGroups]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.totalCost, 0);
    const itemCount = items.length;
    return { subtotal, itemCount };
  }, [items]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  // Initialize all categories as expanded
  React.useEffect(() => {
    if (showCategoryGroups) {
      const initialExpanded: Record<string, boolean> = {};
      Object.keys(groupedItems).forEach((cat) => {
        initialExpanded[cat] = true;
      });
      setExpandedCategories(initialExpanded);
    }
  }, [groupedItems, showCategoryGroups]);

  return (
    <Card variant="bordered" title={title} subtitle={subtitle} className={className}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table">
          <thead>
            <tr className="bg-[hsl(var(--background-elevated))]">
              {sortable ? (
                COLUMNS.map((col) => (
                  <SortableHeader
                    key={col.key}
                    column={col}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                ))
              ) : (
                COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary"
                    style={{ width: col.width }}
                  >
                    {col.label}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedItems).map(([category, catItems]) => (
              <React.Fragment key={category}>
                {showCategoryGroups && category && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="p-0">
                      <CategoryHeader
                        category={category}
                        items={catItems}
                        isExpanded={expandedCategories[category] !== false}
                        onToggle={() => toggleCategory(category)}
                      />
                    </td>
                  </tr>
                )}
                {(expandedCategories[category] !== false || !category) &&
                  catItems.map((item, idx) => (
                    <ItemRow
                      key={item.id || idx}
                      item={item}
                      index={idx}
                      onClick={() => onItemClick?.(item)}
                      showCategory={!showCategoryGroups && !!item.category}
                    />
                  ))}
              </React.Fragment>
            ))}
          </tbody>
          {showTotals && (
            <tfoot className="bg-[hsl(var(--background-elevated))]">
              <tr className="border-t-2 border-[hsl(var(--border))]">
                <td colSpan={3} className="px-4 py-3">
                  <span className="text-sm font-semibold text-text-secondary">TOTAL</span>
                  <span className="ml-2 text-xs text-text-tertiary">({totals.itemCount} items)</span>
                </td>
                <td className="px-4 py-3 text-right text-text-tertiary">—</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-lg font-bold font-mono text-text-primary">
                    {formatCurrency(totals.subtotal)}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Export Actions */}
      {(onExport || onItemClick) && (
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-[hsl(var(--border))] pt-4">
          {onExport && (
            <button
              onClick={() => onExport(items)}
              className="btn btn-secondary btn-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
          <div className="flex items-center gap-1 text-xs text-text-tertiary">
            <Calculator className="w-3.5 h-3.5" />
            <span>{totals.itemCount} line items • {formatCurrency(totals.subtotal)} total</span>
          </div>
        </div>
      )}
    </Card>
  );
};

export default EstimateLineItems;