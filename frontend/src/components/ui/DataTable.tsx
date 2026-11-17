import React from 'react';
import clsx from 'clsx';

export type SortDirection = 'asc' | 'desc';

export interface DataTableColumn<T> {
  header: React.ReactNode;
  /** Resolve the cell value: a key of T, an accessor function, or undefined. */
  accessor?: keyof T | ((row: T) => React.ReactNode);
  /** Override cell rendering. */
  cell?: (row: T) => React.ReactNode;
  /** Render an accessible sort button on this column header. */
  sortable?: boolean;
  /** CSS classes applied to every cell (header + body) in this column. */
  className?: string;
  /** CSS classes applied only to the header cell. */
  headerClassName?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  /** Stable key for a row. Defaults to the array index. */
  rowKey?: keyof T | ((row: T) => string | number);
  /** Currently sorted column. */
  sortBy?: keyof T | string;
  sortDir?: SortDirection;
  onSort?: (column: keyof T | string, direction: SortDirection) => void;
  striped?: boolean;
  hover?: boolean;
  compact?: boolean;
  /** Pagination */
  page?: number;
  pageSize?: number;
  totalRows?: number;
  onPageChange?: (page: number) => void;
  /** Table caption announced by assistive tech. */
  caption?: string;
  emptyMessage?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
  rowClassName?: (row: T) => string;
}

const cellHeight = {
  header: 'px-4 py-2.5 text-xs font-medium',
  body: 'px-4 py-2.5 text-sm',
  headerCompact: 'px-3 py-1.5 text-xs font-medium',
  bodyCompact: 'px-3 py-1.5 text-xs',
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background focus-visible:ring-primary';

function resolveValue<T>(row: T, col: DataTableColumn<T>): React.ReactNode {
  if (typeof col.cell === 'function') return col.cell(row);
  if (typeof col.accessor === 'function') return col.accessor(row);
  if (col.accessor != null) return row[col.accessor as keyof T] as React.ReactNode;
  return null;
}

function rowKeyValue<T>(
  row: T,
  rowKey: DataTableProps<T>['rowKey'] | undefined,
  index: number
): string {
  if (!rowKey) return String(index);
  try {
    return String(typeof rowKey === 'function' ? rowKey(row) : row[rowKey as keyof T]);
  } catch {
    return String(index);
  }
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  sortBy,
  sortDir,
  onSort,
  striped = true,
  hover = true,
  compact = false,
  page,
  pageSize,
  totalRows,
  onPageChange,
  caption,
  emptyMessage = 'No data to display.',
  isLoading = false,
  className,
  rowClassName,
}: DataTableProps<T>) {
  const sortedColumnKey = typeof sortBy === 'string' ? sortBy : (sortBy as string | undefined);

  const handleSort = (col: DataTableColumn<T>) => {
    if (!col.sortable || !onSort) return;
    const colKey = typeof col.accessor === 'string' ? col.accessor : undefined;
    if (!colKey) return;
    const isSameColumn = sortedColumnKey === colKey;
    const nextDir: SortDirection = isSameColumn && sortDir === 'asc' ? 'desc' : 'asc';
    onSort(colKey, nextDir);
  };

  const ariaSortFor = (col: DataTableColumn<T>): 'none' | 'ascending' | 'descending' => {
    if (!col.sortable) return 'none';
    const colKey = typeof col.accessor === 'string' ? col.accessor : undefined;
    if (!colKey || sortedColumnKey !== colKey) return 'none';
    return sortDir === 'asc' ? 'ascending' : 'descending';
  };

  const totalPages = pageSize && totalRows ? Math.ceil(totalRows / pageSize) : undefined;
  const current = page ?? 1;

  return (
    <div className={clsx('relative w-full overflow-x-auto', className)}>
      {isLoading && (
        <div
          aria-live="polite"
          aria-label={`Loading${caption ? ` ${caption}` : ''}`}
          className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--background-card))]/70"
        >
          <svg
            className="h-4 w-4 animate-spin text-primary"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm text-text-secondary">Loading…</span>
        </div>
      )}

      <table
        className="w-full border-collapse text-left align-top"
        aria-busy={isLoading || undefined}
      >
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col, i) => {
              const label = <span className="block truncate">{col.header}</span>;
              const cellNode = col.sortable ? (
                <button
                  type="button"
                  disabled={!onSort}
                  aria-sort={ariaSortFor(col)}
                  onClick={() => handleSort(col)}
                  className={clsx(
                    'flex w-full items-center gap-1 whitespace-nowrap text-left align-middle',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    focusRing
                  )}
                >
                  {label}
                  <SortIndicator dir={ariaSortFor(col)} />
                </button>
              ) : (
                <span className="block w-full whitespace-nowrap">{col.header}</span>
              );
              return (
                <th
                  key={i}
                  scope="col"
                  className={clsx(
                    'text-text-tertiary',
                    compact ? cellHeight.headerCompact : cellHeight.header,
                    col.className,
                    col.headerClassName
                  )}
                >
                  {cellNode}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.length === 0 && !isLoading && (
            <tr>
              <td
                colSpan={columns.length}
                className="p-6 text-center text-sm text-text-secondary"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
          {data.map((row, rowIndex) => (
            <tr
              key={rowKeyValue(row, rowKey, rowIndex)}
              className={clsx(
                'transition-colors',
                striped && rowIndex % 2 === 0 ? 'bg-[hsl(var(--background-elevated))]/30' : '',
                hover && 'hover:bg-[hsl(var(--background-accent))]/40',
                rowClassName ? rowClassName(row) : ''
              )}
            >
              {columns.map((col, colIndex) => (
                <td
                  key={colIndex}
                  className={clsx(
                    'align-top',
                    compact ? cellHeight.bodyCompact : cellHeight.body,
                    col.className
                  )}
                >
                  {resolveValue(row, col) ?? '\u00A0'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages !== undefined && totalPages > 1 && onPageChange && (
        <div
          aria-label="Pagination"
          className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-text-secondary"
        >
          <span>
            Page {current} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={current <= 1}
              onClick={() => onPageChange(current - 1)}
              className={clsx(
                'rounded border border-border px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50',
                focusRing
              )}
            >
              Previous
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={current >= totalPages}
              onClick={() => onPageChange(current + 1)}
              className={clsx(
                'rounded border border-border px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50',
                focusRing
              )}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortIndicator({ dir }: { dir: 'none' | 'ascending' | 'descending' }) {
  const active = dir === 'ascending' || dir === 'descending';
  const ascending = dir === 'ascending';
  const points = ascending ? 'M12 19V5 M5 12l7 7 7-7' : 'M12 5v14 M19 12l-7 7-7-7';
  return (
    <svg
      className={clsx('h-3 w-3 shrink-0', active ? 'opacity-100' : 'opacity-30')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={points} />
    </svg>
  );
}

DataTable.displayName = 'DataTable';

export default DataTable;
