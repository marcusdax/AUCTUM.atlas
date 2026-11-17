import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { CalendarEvent, User } from '../types';
import Button from '../components/ui/Button';
import { Badge, Card } from '../components/ui/Card';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import * as Dialog from '@radix-ui/react-dialog';
import {
  addDays,
  addMinutes,
  differenceInMinutes,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  formatISO,
  isToday,
  isSameDay,
  isSameMonth,
  parseISO,
  setHours,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  addMonths,
} from 'date-fns';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Clock,
  GripVertical,
  Loader2,
  MapPin,
  Plus,
  Trash,
  Users,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';

// ─── Layout constants ──────────────────────────────────────────────────

const SLOT_MINUTES = 30;
const START_HOUR = 6; // 06:00
const END_HOUR = 22; // 22:00 (10 pm)
const SLOT_COUNT = (END_HOUR - START_HOUR) * (60 / SLOT_MINUTES); // 32
const ROW_HEIGHT = 44;
const GRID_HEIGHT = SLOT_COUNT * ROW_HEIGHT; // 1408px
const PX_PER_MIN = ROW_HEIGHT / SLOT_MINUTES;
const GRID_START_MIN = START_HOUR * 60; // 360
const GRID_END_MIN = END_HOUR * 60; // 1320
const TIME_AXIS_WIDTH = 120;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RESOURCE_RAIL_WIDTH = 100;
const DAY_WIDTH = 170;

const VIEW_OPTIONS = ['day', 'week', 'month', 'timeline'] as const;
type View = (typeof VIEW_OPTIONS)[number];
type EventType = CalendarEvent['eventType'];

interface CalendarResponse {
  data: CalendarEvent[];
  count: number;
}
interface UsersResponse {
  data: User[];
  count: number;
}
interface Conflict {
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
}
interface HeatmapDay {
  date: string; // ISO date string
  eventCount: number;
  availableSlots: number;
}
interface CalendarMutateResponse {
  data: CalendarEvent;
  conflicts: Conflict[];
}
interface Resource {
  key: string;
  label: string;
  avatarUrl?: string;
  user?: User;
}
interface CalendarPayload {
  title: string;
  description?: string;
  eventType: EventType;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location?: string;
  propertyLatLng?: { lat: number; lng: number };
  jobId?: string;
  assigneeUserIds: string[];
}

interface EventFormValues {
  title: string;
  description: string;
  eventType: EventType;
  allDay: boolean;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  propertyLatLng?: { lat: number; lng: number };
  jobId: string;
  assigneeUserIds: string[];
}
interface DropTarget {
  day: Date;
  resourceKey?: string;
  slot: number;
}

const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'ESTIMATE', label: 'Estimate' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'OTHER', label: 'Other' },
];

// Design-system hue tokens (declared in styles/index.css)
const EVENT_TYPE_HUE: Record<EventType, string> = {
  INSPECTION: 'var(--primary)', // blue
  PRODUCTION: 'var(--emerald)', // green
  ESTIMATE: 'var(--purple)', // purple
  MEETING: 'var(--amber)', // amber
  OTHER: 'var(--text-tertiary)', // gray
};

const eventTypeClasses = (type: EventType) => {
  const hue = EVENT_TYPE_HUE[type];
  return {
    dot: `bg-[hsl(${hue})]`,
    chip: `bg-[hsl(${hue})]/10 text-[hsl(${hue})]`,
  };
};

// ─── Date / positioning helpers ────────────────────────────────────────

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  try {
    const d = parseISO(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const minsFromMidnight = (d: Date): number => d.getHours() * 60 + d.getMinutes();

const clamp = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v));

const hourLabel = (hour: number): string => format(setHours(new Date(), hour), 'h:mm a');

const formatTime = (value?: string | null): string => {
  const d = parseDate(value);
  return d ? format(d, 'h:mm a') : '—';
};

interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  overflowTop: boolean;
  overflowBottom: boolean;
}

const positionEvent = (event: CalendarEvent, day: Date): PositionedEvent => {
  const start = parseDate(event.startTime);
  const end = parseDate(event.endTime);
  const dayStartMs = startOfDay(day).getTime();
  const gridStartMs = dayStartMs + GRID_START_MIN * 60_000;
  const gridEndMs = dayStartMs + GRID_END_MIN * 60_000;

  if (!start || !end) {
    return { event, top: 0, height: ROW_HEIGHT, overflowTop: false, overflowBottom: false };
  }

  const sMs = start.getTime();
  const eMs = end.getTime();
  const visStart = Math.max(sMs, gridStartMs);
  const visEnd = Math.min(eMs, gridEndMs);

  let top = ((visStart - gridStartMs) / 60_000) * PX_PER_MIN;
  let height = ((visEnd - visStart) / 60_000) * PX_PER_MIN;
  const overflowTop = sMs < gridStartMs;
  const overflowBottom = eMs > gridEndMs;

  if (height < 28) height = 28;
  top = Math.max(0, Math.min(top, GRID_HEIGHT));
  height = Math.min(height, GRID_HEIGHT - top);

  return { event, top: Math.round(top), height: Math.round(height), overflowTop, overflowBottom };
};

const overlapDay = (event: CalendarEvent, day: Date): boolean => {
  const start = parseDate(event.startTime);
  const end = parseDate(event.endTime);
  if (!start || !end) return false;
  return start <= endOfDay(day) && end >= startOfDay(day);
};

const resourceOf = (event: CalendarEvent, resourceKey?: string): boolean => {
  if (!resourceKey) return true;
  if (resourceKey === '__unassigned__') {
    return !(event.assignees && event.assignees.length > 0);
  }
  return Boolean(event.assignees?.some((a) => a.userId === resourceKey));
};

// Conflict = overlap in time AND share at least one assignee.
const computeConflictIds = (events: CalendarEvent[]): Set<string> => {
  const ids = new Set<string>();
  const timed = events.filter((e) => parseDate(e.startTime) && parseDate(e.endTime));
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      const as = parseDate(a.startTime)!;
      const ae = parseDate(a.endTime)!;
      const bs = parseDate(b.startTime)!;
      const be = parseDate(b.endTime)!;
      if (!(as < be && bs < ae)) continue;
      const aIds = new Set(a.assignees?.map((x) => x.userId) ?? []);
      const bIds = new Set(b.assignees?.map((x) => x.userId) ?? []);
      if ([...aIds].some((id) => id && bIds.has(id))) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const userLabel = (u?: User): string => {
  if (!u) return '—';
  const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return name || u.email || '?';
};

// ─── Presentational atoms ─────────────────────────────────────────────

const EventDot: React.FC<{ type: EventType; className?: string }> = ({ type, className }) => (
  <span className={clsx('inline-block shrink-0 rounded-full', eventTypeClasses(type).dot, 'h-2.5 w-2.5', className)} />
);

const EventTypeChip: React.FC<{ type: EventType }> = ({ type }) => {
  const c = eventTypeClasses(type);
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', c.chip)}>
      <EventDot type={type} className="h-2 w-2" />
      {type}
    </span>
  );
};

const UserAvatar: React.FC<{ user?: User; size?: 'sm' | 'md' }> = ({ user, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'h-6 w-6 text-[9px]' : 'h-8 w-8 text-xs';
  const initials = (() => {
    const f = user?.firstName?.[0] ?? '';
    const l = user?.lastName?.[0] ?? '';
    const init = (f + l).toUpperCase();
    return init || (user?.email?.[0] ?? '?').toUpperCase() || '?';
  })();
  if (user?.avatarUrl) {
    return <img src={user.avatarUrl} alt={initials} className={clsx(sizeClasses, 'rounded-full object-cover')} />;
  }
  return (
    <div className={clsx(sizeClasses, 'flex items-center justify-center rounded-full bg-primary font-bold text-white')} title={userLabel(user)}>
      {initials}
    </div>
  );
};

// Timed event rendered inside a day time-grid cell.
const EventCard: React.FC<{
  event: CalendarEvent;
  pos: PositionedEvent;
  conflict: boolean;
  onEventClick: (e: CalendarEvent) => void;
  onDragStart: (e: React.DragEvent, ev: CalendarEvent) => void;
}> = ({ event, pos, conflict, onEventClick, onDragStart }) => {
  const overflow = pos.overflowTop || pos.overflowBottom;
  return (
    <div
      className={clsx(
        'absolute left-1 right-1 cursor-move rounded-md border-l-4 bg-[hsl(var(--background-card))] p-1.5 shadow-sm transition-shadow hover:shadow-md',
        conflict ? 'border-l-red ring-1 ring-red/40' : 'border-transparent',
        overflow && !conflict && 'ring-1 ring-amber/40'
      )}
      style={{ top: pos.top, height: pos.height }}
      onClick={(e) => {
        e.stopPropagation();
        onEventClick(event);
      }}
      draggable
      onDragStart={(e) => onDragStart(e, event)}
    >
      <div className="flex items-start gap-1.5">
        <EventDot type={event.eventType} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-text-primary">{event.title}</p>
          {!event.allDay && (
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-text-tertiary">
              <Clock size={10} />
              <span>{formatTime(event.startTime)}</span>
              {event.location && (
                <>
                  <MapPin size={10} />
                  <span className="truncate">{event.location}</span>
                </>
              )}
            </div>
          )}
        </div>
        <GripVertical size={12} className="text-text-tertiary opacity-50" />
      </div>
    </div>
  );
};

// An event row inside a month day cell.
const MonthEvent: React.FC<{ event: CalendarEvent; conflict: boolean; onEventClick: (e: CalendarEvent) => void }> = ({
  event,
  conflict,
  onEventClick,
}) => (
  <div
    className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs hover:bg-[hsl(var(--background-accent))]"
    onClick={(e) => {
      e.stopPropagation();
      onEventClick(event);
    }}
    draggable
    onDragStart={(e) => e.dataTransfer.setData('text/plain', event.id)}
  >
    <EventDot type={event.eventType} className="h-2 w-2" />
    <span className={clsx('truncate', conflict && 'text-red')} title={conflict ? 'Scheduling conflict' : undefined}>
      {event.title}
    </span>
    {!event.allDay && <span className="text-text-tertiary">({formatTime(event.startTime)})</span>}
  </div>
);

// ─── All-day lane ──────────────────────────────────────────────────────

const AllDayLane: React.FC<{
  days: Date[];
  events: CalendarEvent[];
  allDayHeight: number;
  isDay: boolean;
  showRail: boolean;
  conflictIds: Set<string>;
  onEventClick: (e: CalendarEvent) => void;
  onDragStart: (e: React.DragEvent, ev: CalendarEvent) => void;
}> = ({ days, events, allDayHeight, isDay, showRail, conflictIds, onEventClick, onDragStart }) => {
  if (allDayHeight <= 0) return null;
  const column = showRail ? '3 / -1' : '2 / -1';
  return (
    <div
      className="relative border-b border-border bg-[hsl(var(--background-elevated))]"
      style={{ gridColumn: column, gridRow: 1, height: allDayHeight }}
    >
      {!isDay &&
        days.map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 border-r border-border last:border-r-0"
            style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
          />
        ))}
      {events.length === 0 ? (
        <div className="absolute inset-0 flex items-center px-3 text-xs text-text-tertiary">No all-day events</div>
      ) : (
        events.map((ev, i) => {
          let dayIndex = 0;
          for (let k = 0; k < days.length; k++) {
            const s = parseDate(ev.startTime);
            if (s && s <= endOfDay(days[k])) {
              dayIndex = k;
              break;
            }
          }
          const span = (() => {
            const s = parseDate(ev.startTime);
            const e = parseDate(ev.endTime);
            if (!s || !e) return 1;
            return clamp(1, days.length - dayIndex, Math.ceil((e.getTime() - s.getTime()) / 86_400_000));
          })();
          return (
            <div
              key={ev.id}
              className={clsx(
                'absolute mb-0.5 cursor-move rounded-md border border-border bg-[hsl(var(--background-card))] px-2 py-1 shadow-sm',
                conflictIds.has(ev.id) && 'border-red ring-1 ring-red/40'
              )}
              style={
                isDay
                  ? { top: 28, left: 0, right: 0 }
                  : { top: 28 + Math.floor(i / 3) * 26, left: dayIndex * DAY_WIDTH, width: span * DAY_WIDTH }
              }
              onClick={(e) => {
                e.stopPropagation();
                onEventClick(ev);
              }}
              draggable
              onDragStart={(e) => onDragStart(e, ev)}
            >
              <div className="flex items-center gap-1.5 truncate text-xs">
                <EventDot type={ev.eventType} />
                <span className="font-medium text-text-primary truncate">{ev.title}</span>
              </div>
              {ev.assignees && ev.assignees.length > 0 && (
                <div className="mt-0.5 flex items-center gap-1 overflow-hidden">
                  {ev.assignees.slice(0, 3).map((a) => (
                    <UserAvatar key={a.userId} user={a.user} size="sm" />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

// ─── Day time-grid cell ─────────────────────────────────────────────────

const DayCell: React.FC<{
  day: Date;
  timedEvents: CalendarEvent[];
  resourceKey?: string;
  gridColumn: number;
  gridRow: number;
  now: Date;
  conflictIds: Set<string>;
  onEventClick: (e: CalendarEvent) => void;
  onDragStart: (e: React.DragEvent, ev: CalendarEvent) => void;
  onDayDrop: (e: React.DragEvent, target: DropTarget) => void;
  onDayClick: (day: Date) => void;
}> = ({ day, timedEvents, resourceKey, gridColumn, gridRow, now, conflictIds, onEventClick, onDragStart, onDayDrop, onDayClick }) => {
  const cellRef = useRef<HTMLDivElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const cell = cellRef.current;
    if (!cell) return;
    e.preventDefault();
    const rect = cell.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slot = clamp(0, SLOT_COUNT - 1, Math.floor(y / ROW_HEIGHT));
    onDayDrop(e, { day, resourceKey, slot });
  };

  const positioned = useMemo(
    () => timedEvents.map((ev) => positionEvent(ev, day)),
    [timedEvents, day]
  );

  return (
    <div
      ref={cellRef}
      className={clsx(
        'relative col-span-1 border-b border-l border-border',
        isToday(day) && 'bg-[hsl(var(--background))]/50'
      )}
      style={{
        gridColumn,
        gridRow,
        height: GRID_HEIGHT,
        backgroundImage: `repeating-linear-gradient(to bottom, hsl(var(--border)) 0px, hsl(var(--border)) 1px, transparent 1px, transparent ${ROW_HEIGHT}px)`,
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={handleDrop}
      onClick={() => onDayClick(day)}
    >
      {isToday(day) && (() => {
        const m = minsFromMidnight(now);
        if (m < GRID_START_MIN || m > GRID_END_MIN) return null;
        const top = (m - GRID_START_MIN) * PX_PER_MIN;
        return (
          <div className="pointer-events-none absolute inset-x-2" style={{ top }}>
            <div className="absolute -translate-y-1/2 rounded-full bg-red" style={{ height: 8, width: 8 }} />
            <div className="absolute inset-0 border-t-2 border-red" />
          </div>
        );
      })()}

      {positioned.map((p) => (
        <EventCard
          key={p.event.id}
          event={p.event}
          pos={p}
          conflict={conflictIds.has(p.event.id)}
          onEventClick={onEventClick}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  );
};

// ─── Time axis (left rail for day/week views) ──────────────────────────

const TimeAxis: React.FC<{ rowSpan: number; showRail: boolean }> = ({ rowSpan, showRail }) => {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const column = showRail ? 2 : 1;
  const railLeft = showRail ? RESOURCE_RAIL_WIDTH : 0;
  return (
    <div
      className="absolute border-r border-border bg-[hsl(var(--background-elevated))]"
      style={{
        left: railLeft,
        width: TIME_AXIS_WIDTH,
        gridColumn: column,
        gridRow: `2 / span ${rowSpan}`,
        height: rowSpan === 1 ? GRID_HEIGHT : GRID_HEIGHT * rowSpan,
      }}
    >
      <div className="absolute inset-0">
        {hours.map((h) => {
          const top = (h - START_HOUR) * (60 / SLOT_MINUTES) * PX_PER_MIN - ROW_HEIGHT / 2;
          return (
            <div key={h} className="absolute right-2 text-xs text-text-tertiary" style={{ top }}>
              {hourLabel(h)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Resource rail (leftmost column in resource mode) ──────────────────

const ResourceRail: React.FC<{ resources: Resource[]; rowSpan: number }> = ({ resources, rowSpan }) => {
  return (
    <div
      className="absolute left-0 border-r border-border bg-[hsl(var(--background-elevated))] overflow-y-auto"
      style={{
        width: RESOURCE_RAIL_WIDTH,
        gridColumn: 1,
        gridRow: `2 / span ${rowSpan}`,
        height: GRID_HEIGHT * rowSpan,
      }}
    >
      <div className="absolute inset-0">
        {resources.map((r) => (
          <div key={r.key} className="absolute inset-x-0" style={{ height: GRID_HEIGHT }}>
            <div className="flex h-full items-center gap-1.5 px-2 py-1.5">
              <UserAvatar user={r.user} size="sm" />
              <span className="block text-xs font-medium text-text-secondary">{r.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Week / Day time view ──────────────────────────────────────────────

interface TimeViewProps {
  isDay: boolean;
  currentDate: Date;
  events: CalendarEvent[];
  resourceMode: boolean;
  resources: Resource[];
  now: Date;
  conflictIds: Set<string>;
  onEventClick: (e: CalendarEvent) => void;
  onDragStart: (e: React.DragEvent, ev: CalendarEvent) => void;
  onDayDrop: (e: React.DragEvent, target: DropTarget) => void;
  onDayClick: (day: Date) => void;
}

const TimeView: React.FC<TimeViewProps> = ({
  isDay,
  currentDate,
  events,
  resourceMode,
  resources,
  now,
  conflictIds,
  onEventClick,
  onDragStart,
  onDayDrop,
  onDayClick,
}) => {
  const dayColumns = useMemo(() => {
    if (isDay) return [currentDate];
    return eachDayOfInterval({
      start: startOfWeek(currentDate, { weekStartsOn: 0 }),
      end: endOfWeek(currentDate, { weekStartsOn: 0 }),
    });
  }, [isDay, currentDate]);

  const tracks = useMemo(() => {
    if (!resourceMode) {
      return [{ key: '__all__', label: '', resourceKey: undefined as string | undefined }];
    }
    return resources.map((r) => ({ key: r.key, label: r.label, resourceKey: r.key }));
  }, [resourceMode, resources]);

  const allDayEvents = useMemo(() => events.filter((e) => e.allDay), [events]);
  const allDayHeight = allDayEvents.length ? Math.min(allDayEvents.length, 4) * 26 + 34 : 0;
  const showRail = resourceMode && resources.length > 1;
  const dayStartColumn = showRail ? 3 : 2;
  const allDayColumn = showRail ? '3 / -1' : '2 / -1';

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: showRail
      ? `${RESOURCE_RAIL_WIDTH}px ${TIME_AXIS_WIDTH}px ${isDay ? '1fr' : `repeat(7, ${DAY_WIDTH}px)`}`
      : `${TIME_AXIS_WIDTH}px ${isDay ? '1fr' : `repeat(7, ${DAY_WIDTH}px)`}`,
    gridTemplateRows: `${allDayHeight}px repeat(${tracks.length}, ${GRID_HEIGHT}px)`,
  };

  return (
    <div className="overflow-auto rounded-lg border border-border bg-[hsl(var(--background-card))]">
      {/* Day column header */}
      <div
        className="sticky top-0 z-20 flex items-end gap-0 border-b border-border bg-[hsl(var(--background-elevated))]"
        style={
          isDay
            ? undefined
            : {
                width: showRail
                  ? RESOURCE_RAIL_WIDTH + TIME_AXIS_WIDTH + 7 * DAY_WIDTH
                  : TIME_AXIS_WIDTH + 7 * DAY_WIDTH,
              }
        }
      >
        {showRail && <div className="border-r border-border" style={{ width: RESOURCE_RAIL_WIDTH }} />}
        <div className="border-r border-border px-2 py-1.5" style={{ width: TIME_AXIS_WIDTH }}>
          <span className="block text-xs text-text-tertiary">Time</span>
        </div>
        {dayColumns.map((day, i) => (
          <div
            key={i}
            className={clsx(
              'flex min-w-0 flex-col items-center gap-0.5 border-b border-r border-border px-1 pb-1.5 pt-1.5 last:border-r-0',
              isToday(day) && 'bg-[hsl(var(--background-accent))]',
              isDay ? 'flex-1' : ''
            )}
            style={isDay ? undefined : { width: DAY_WIDTH }}
          >
            <span className="text-xs font-medium text-text-secondary">{format(day, 'EEE')}</span>
            <span className={clsx('text-sm font-medium', isToday(day) ? 'text-primary' : 'text-text-primary')}>
              {format(day, 'd')}
            </span>
          </div>
        ))}
      </div>

      <div className="grid" style={gridStyle}>
        {showRail && <ResourceRail resources={resources} rowSpan={tracks.length} />}
        <TimeAxis rowSpan={tracks.length} showRail={showRail} />
        {allDayHeight > 0 && (
          <AllDayLane
            days={dayColumns}
            events={allDayEvents}
            allDayHeight={allDayHeight}
            isDay={isDay}
            showRail={showRail}
            conflictIds={conflictIds}
            onEventClick={onEventClick}
            onDragStart={onDragStart}
          />
        )}
        {tracks.map((track, ti) =>
          dayColumns.map((day, ci) => {
            const cellEvents = events.filter(
              (e) => !e.allDay && overlapDay(e, day) && resourceOf(e, track.resourceKey)
            );
            return (
              <DayCell
                key={`${track.key}-${formatISO(day)}`}
                day={day}
                timedEvents={cellEvents}
                resourceKey={track.resourceKey}
                gridColumn={dayStartColumn + ci}
                gridRow={2 + ti}
                now={now}
                conflictIds={conflictIds}
                onEventClick={onEventClick}
                onDragStart={onDragStart}
                onDayDrop={onDayDrop}
                onDayClick={onDayClick}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── Month view ────────────────────────────────────────────────────────

// ─── Timeline / agenda view ───────────────────────────────────────────────

interface TimelineViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  conflictIds: Set<string>;
  onEventClick: (e: CalendarEvent) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({ currentDate, events, conflictIds, onEventClick }) => {
  const days = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const s = parseDate(e.startTime);
      if (!s) continue;
      const key = formatISO(startOfDay(s));
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [events]);

  const today = new Date();

  return (
    <div className="grid grid-cols-[200px_1fr] gap-4 divide-x divide-border">
      {/* Day column */}
      <div className="border-l border-border">
        {days.map((day) => (
          <div
            key={formatISO(day)}
            className={clsx(
              'border-b border-border px-3 py-2 text-right text-xs font-medium',
              isSameDay(day, today) && 'bg-primary/5 text-primary'
            )}
          >
            <time dateTime={formatISO(day)}>{format(day, 'EEE d')}</time>
          </div>
        ))}
      </div>

      {/* Events column */}
      <div className="divide-y divide-border">
        {days.map((day) => {
          const dayEvents = eventsByDay.get(formatISO(startOfDay(day))) ?? [];
          return (
            <div key={formatISO(day)} className="p-3">
              {dayEvents.length === 0 ? (
                <span className="text-xs text-text-tertiary">No events</span>
              ) : (
                <div className="space-y-2">
                  {dayEvents.map((e) => (
                    <Card
                      key={e.id}
                      variant="bordered"
                      className="cursor-pointer p-3 transition-shadow hover:shadow-sm"
                      onClick={() => onEventClick(e)}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <EventTypeChip type={e.eventType} />
                        {conflictIds.has(e.id) && (
                          <Badge variant="danger" size="sm">
                            <AlertCircle size={10} />
                            Conflict
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium text-text-primary">{e.title}</h4>
                      {!e.allDay && (
                        <p className="mt-0.5 text-xs text-text-tertiary">
                          {formatTime(e.startTime)} – {formatTime(e.endTime)}
                        </p>
                      )}
                      {e.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-text-secondary">
                          <MapPin size={10} />
                          {e.location}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  conflictIds: Set<string>;
  onEventClick: (e: CalendarEvent) => void;
  onDragStart: (e: React.DragEvent, ev: CalendarEvent) => void;
  onMonthDrop: (e: React.DragEvent, day: Date) => void;
  onDayClick: (day: Date) => void;
  heatmapData?: HeatmapDay[];
  showHeatmap?: boolean;
}

const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  events,
  conflictIds,
  onEventClick,
  onDragStart,
  onMonthDrop,
  onDayClick,
  heatmapData,
  showHeatmap,
}) => {
  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    return chunk(eachDayOfInterval({ start, end }), 7);
  }, [currentDate]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const s = parseDate(e.startTime);
      if (!s) continue;
      const key = formatISO(startOfDay(s));
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [events]);

  const heatmapByDay = useMemo(() => {
    if (!heatmapData) return new Map<string, HeatmapDay>();
    const map = new Map<string, HeatmapDay>();
    heatmapData.forEach((d) => map.set(d.date, d));
    return map;
  }, [heatmapData]);

  // Intensity level based on event count (0–4+)
  const heatmapIntensity = (day: Date): number => {
    const hd = heatmapByDay.get(formatISO(startOfDay(day)));
    if (!hd) return 0;
    if (hd.eventCount === 0) return 0;
    if (hd.eventCount === 1) return 1;
    if (hd.eventCount === 2) return 2;
    if (hd.eventCount === 3) return 3;
    return 4;
  };

  const today = new Date();

  return (
    <div className="grid grid-cols-7 border border-border text-center">
      {DAY_NAMES.map((n) => (
        <div key={n} className="border-b border-border py-1.5 text-xs font-medium text-text-tertiary">
          {n}
        </div>
      ))}
      {weeks.map((week) =>
        week.map((day) => {
          const dayEvents = eventsByDay.get(formatISO(startOfDay(day))) ?? [];
          const muted = !isSameMonth(day, currentDate);
          return (
            <div
              key={formatISO(day)}
              className="relative min-h-[96px] border-b border-r border-border p-1 text-left last:border-b-0 last:border-r-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onMonthDrop(e, day);
              }}
              onClick={() => onDayClick(day)}
            >
              {/* Heatmap background — behind date number */}
              {showHeatmap && (
                <div
                  className="absolute inset-0 rounded-md"
                  style={{
                    backgroundColor: `hsl(var(--primary))`,
                    opacity: heatmapIntensity(day) * 0.12,
                  }}
                />
              )}
              <time dateTime={formatISO(day)} className="ml-auto block w-fit">
                <span
                  className={clsx(
                    'inline-flex h-5 w-5 items-center justify-center rounded-full text-xs',
                    isSameDay(day, today) && 'bg-primary text-white',
                    muted && !isSameDay(day, today) && 'text-text-tertiary'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </time>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <MonthEvent key={e.id} event={e} conflict={conflictIds.has(e.id)} onEventClick={onEventClick} />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-xs text-text-tertiary">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

// ─── Event form (drawer) ────────────────────────────────────────────────

interface EventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  date?: string;
  users: User[];
  isSubmitting: boolean;
  onSubmit: (values: CalendarPayload) => Promise<void>;
  onDelete?: (event: CalendarEvent) => void;
}

const EventForm: React.FC<EventFormProps> = ({
  open,
  onOpenChange,
  event,
  date,
  users,
  isSubmitting,
  onSubmit,
  onDelete,
}) => {
  const isEdit = Boolean(event);
  const [form, setForm] = useState<EventFormValues>({
    title: '',
    description: '',
    eventType: 'OTHER',
    allDay: false,
    date: date ?? formatISO(startOfDay(new Date()), { representation: 'date' }),
    startTime: '09:00',
    endTime: '10:00',
    location: '',
    jobId: '',
    assigneeUserIds: [],
  });

  useEffect(() => {
    if (!open) return;
    if (event) {
      const s = parseDate(event.startTime);
      const e = parseDate(event.endTime);
      setForm({
        title: event.title ?? '',
        description: event.description ?? '',
        eventType: event.eventType,
        allDay: event.allDay,
        date: s ? formatISO(s, { representation: 'date' }) : formatISO(startOfDay(new Date()), { representation: 'date' }),
        startTime: s ? format(s, 'HH:mm') : '09:00',
        endTime: e ? format(e, 'HH:mm') : '10:00',
        location: event.location ?? '',
        jobId: event.job?.id ?? '',
        assigneeUserIds: event.assignees?.map((a) => a.userId) ?? [],
      });
    } else {
      setForm({
        title: '',
        description: '',
        eventType: 'OTHER',
        allDay: false,
        date: date ?? formatISO(startOfDay(new Date()), { representation: 'date' }),
        startTime: '09:00',
        endTime: '10:00',
        location: '',
        jobId: '',
        assigneeUserIds: [],
      });
    }
  }, [open, event, date]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.checked }));
  };

  const handleAssignee = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setForm((prev) => {
      const ids = new Set(prev.assigneeUserIds);
      checked ? ids.add(value) : ids.delete(value);
      return { ...prev, assigneeUserIds: [...ids] };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) {
      toast.error('Title is required');
      return;
    }

    const payload: CalendarPayload = {
      title,
      description: form.description.trim() || undefined,
      eventType: form.eventType,
      allDay: form.allDay,
      startTime: form.allDay ? `${form.date}T00:00:00` : `${form.date}T${form.startTime}`,
      endTime: form.allDay ? `${form.date}T23:59:00` : `${form.date}T${form.endTime}`,
      location: form.location?.trim() || undefined,
      jobId: form.jobId?.trim() || undefined,
      assigneeUserIds: form.assigneeUserIds,
    };

    if (!payload.allDay) {
      const s = parseDate(payload.startTime);
      const en = parseDate(payload.endTime);
      if (!s || !en || en <= s) {
        toast.error('End time must be after start time');
        return;
      }
    }

    await onSubmit(payload);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-[hsl(var(--background-card))] p-6 shadow-xl"
          aria-label={isEdit ? 'Edit event' : 'New event'}
        >
          <div className="flex items-start justify-between">
            <Dialog.Title className="text-xl font-semibold text-text-primary">
              {isEdit ? 'Edit Event' : 'New Event'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="rounded p-1 text-text-secondary hover:bg-[hsl(var(--background-accent))]"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-sm text-text-secondary">
            {isEdit ? 'Update event details.' : 'Add a new event to the schedule.'}
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Title *
                </label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  className="input mt-1"
                  placeholder="Event title"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Event Type
                </label>
                <select name="eventType" value={form.eventType} onChange={handleChange} className="input mt-1">
                  {EVENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Date
                </label>
                <input type="date" name="date" value={form.date} onChange={handleChange} className="input mt-1" />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Start
                  </label>
                  <input
                    type="time"
                    name="startTime"
                    value={form.startTime}
                    onChange={handleChange}
                    className="input mt-1"
                    disabled={form.allDay}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    End
                  </label>
                  <input
                    type="time"
                    name="endTime"
                    value={form.endTime}
                    onChange={handleChange}
                    className="input mt-1"
                    disabled={form.allDay}
                  />
                </div>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Location
                  </label>
                  <input
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    className="input mt-1"
                    placeholder="Address or place"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="allDay"
                    type="checkbox"
                    name="allDay"
                    checked={form.allDay}
                    onChange={handleToggle}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="allDay" className="text-sm text-text-secondary">
                    All day
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Job ID
                </label>
                <input name="jobId" value={form.jobId} onChange={handleChange} className="input mt-1" placeholder="Optional job reference" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Assign to
                </label>
                {users.length === 0 ? (
                  <p className="mt-1 text-xs text-text-tertiary">No company users available.</p>
                ) : (
                  <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                    {users.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          value={u.id}
                          checked={form.assigneeUserIds.includes(u.id)}
                          onChange={handleAssignee}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <UserAvatar user={u} size="sm" />
                        <span className="text-text-primary">{userLabel(u)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  className="input mt-1"
                  placeholder="Details about this event..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              {isEdit && onDelete && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash size={16} />}
                  onClick={() => onDelete(event!)}
                  disabled={isSubmitting}
                >
                  Delete
                </Button>
              )}
              <Button variant="ghost" size="md" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="primary" size="md" type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isEdit ? 'Save Changes' : 'Create Event'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

// ─── Main calendar component ──────────────────────────────────────────

const Calendar: React.FC = () => {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<View>('week');
  const [resourceMode, setResourceMode] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [newDate, setNewDate] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('roofpro-calendar-search') ?? '';
    }
    return '';
  });
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Persist search query to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('roofpro-calendar-search', searchQuery);
    }
  }, [searchQuery]);

  // Keyboard shortcuts
  const viewRef = useRef(view);
  const currentDateRef = useRef(currentDate);
  useEffect(() => {
    viewRef.current = view;
    currentDateRef.current = currentDate;
  }, [view, currentDate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip when typing in an input/textarea or contenteditable
      const target = e.target as HTMLElement | null;
      const isFormField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (isFormField) return;

      if (e.key === 'Escape') {
        setFormOpen(false);
        setEditingEvent(null);
        setNewDate(null);
        return;
      }

      if (formOpen) return; // don't navigate while form is open

      const v = viewRef.current;
      const d = currentDateRef.current;

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setEditingEvent(null);
        setNewDate(formatISO(d, { representation: 'date' }));
        setFormOpen(true);
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setCurrentDate(new Date());
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentDate((prev) => {
          if (v === 'month') return subMonths(prev, 1);
          const step = v === 'week' || v === 'timeline' ? 7 : 1;
          return subDays(prev, step);
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentDate((prev) => {
          if (v === 'month') return addMonths(prev, 1);
          const step = v === 'week' || v === 'timeline' ? 7 : 1;
          return addDays(prev, step);
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formOpen]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { start, end } = useMemo(() => {
    switch (view) {
      case 'day':
        return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
      case 'week':
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 0 }),
          end: endOfWeek(currentDate, { weekStartsOn: 0 }),
        };
      case 'month':
      case 'timeline':
        return {
          start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }),
          end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }),
        };
    }
  }, [view, currentDate]);

  const rangeKey = `${formatISO(start)}__${formatISO(end)}__${resourceMode}`;

  const eventsQuery = useQuery<CalendarResponse>({
    queryKey: ['calendar', 'events', rangeKey],
    queryFn: () =>
      api
        .get(`/calendar?start=${encodeURIComponent(formatISO(start))}&end=${encodeURIComponent(formatISO(end))}`)
        .then((res) => res.data as CalendarResponse),
    placeholderData: { data: [], count: 0 },
    staleTime: 60_000,
    retry: 1,
  });

  const usersQuery = useQuery<UsersResponse>({
    queryKey: ['calendar', 'users'],
    queryFn: () => api.get('/calendar/users').then((res) => res.data as UsersResponse),
    placeholderData: { data: [], count: 0 },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const allEvents = useMemo(() => eventsQuery.data?.data ?? [], [eventsQuery.data?.data]);
  const conflictIds = useMemo(() => computeConflictIds(allEvents), [allEvents]);

  // Filtered events based on search query (case-insensitive across multiple fields)
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return allEvents;
    const q = searchQuery.toLowerCase();
    return allEvents.filter((e) => {
      const title = e.title?.toLowerCase() ?? '';
      const desc = e.description?.toLowerCase() ?? '';
      const loc = e.location?.toLowerCase() ?? '';
      return title.includes(q) || desc.includes(q) || loc.includes(q);
    });
  }, [allEvents, searchQuery]);

  // Heatmap availability data (fetched only when heatmap is toggled on)
  const heatmapQuery = useQuery<{ data: HeatmapDay[] }>({
    queryKey: ['calendar', 'availability', formatISO(start), formatISO(end)],
    queryFn: () =>
      api
        .get(`/calendar/availability?start=${encodeURIComponent(formatISO(start))}&end=${encodeURIComponent(formatISO(end))}`)
        .then((res) => res.data as { data: HeatmapDay[] }),
    staleTime: 2 * 60_000,
    retry: 1,
    enabled: showHeatmap,
  });

  const resources = useMemo<Resource[]>(() => {
    const users = usersQuery.data?.data ?? [];
    const list: Resource[] = [{ key: '__unassigned__', label: 'Unassigned' }];
    const seen = new Set(users.map((u) => u.id));
    users.forEach((u) => {
      list.push({ key: u.id, label: userLabel(u), avatarUrl: u.avatarUrl, user: u });
    });
    // surface any assignee users not present in the company list so nothing is hidden in resource mode
    allEvents.forEach((e) => {
      e.assignees?.forEach((a) => {
        if (a.user?.id && !seen.has(a.user.id)) {
          seen.add(a.user.id);
          list.push({ key: a.user.id, label: userLabel(a.user), avatarUrl: a.user.avatarUrl, user: a.user });
        }
      });
    });
    return list;
  }, [usersQuery.data?.data, allEvents]);

  // ── Mutations ────────────────────────────────────────────────────────

  const applyEventPatch = (
    data: CalendarResponse,
    id: string,
    patch: Record<string, unknown>,
    users: User[]
  ): CalendarResponse => {
    const mapped: Record<string, unknown> = { ...patch };
    if (Array.isArray(mapped.assigneeUserIds)) {
      const ids = mapped.assigneeUserIds as string[];
      const byId = new Map(users.map((u) => [u.id, u]));
      mapped.assignees = ids.map((uid) => ({
        id: `${id}-${uid}`,
        eventId: id,
        userId: uid,
        user: byId.get(uid),
      }));
      delete mapped.assigneeUserIds;
    }
    return {
      ...data,
      data: data.data.map((e) => (e.id === id ? ({ ...e, ...mapped } as CalendarEvent) : e)),
      count: data.data.length,
    };
  };

  const reportConflicts = (res: CalendarMutateResponse | undefined): number => {
    const conflicts = res?.conflicts ?? [];
    if (conflicts.length > 0) {
      toast(
        () => (
          <div className="flex flex-col gap-1">
            <strong>Scheduling conflict(s) detected</strong>
            <ul className="list-disc list-inside text-sm">
              {conflicts.map((c) => (
                <li key={c.eventId}>
                  {c.title} ({formatTime(c.startTime)} – {formatTime(c.endTime)})
                </li>
              ))}
            </ul>
          </div>
        ),
        { icon: '⚠️', duration: 8000 }
      );
    }
    return conflicts.length;
  };

  const updateEvent = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/calendar/${id}`, data).then((res) => res.data as CalendarMutateResponse),
    onMutate: async ({ id, data: patch }) => {
      await queryClient.cancelQueries({ queryKey: ['calendar'] });
      const cache = queryClient.getQueryCache().getAll();
      const queries = cache.filter(
        (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'calendar' && q.queryKey[1] === 'events'
      );
      const users = (queryClient.getQueryData<UsersResponse>(['calendar', 'users'])?.data) ?? [];
      const prev = new Map<string, CalendarResponse>();
      queries.forEach((q) => {
        const old = q.state.data as CalendarResponse | undefined;
        if (!old) return;
        const key = JSON.stringify(q.queryKey);
        prev.set(key, old);
        queryClient.setQueryData(q.queryKey, (oldData: CalendarResponse | undefined) =>
          oldData ? applyEventPatch(oldData, id, patch, users) : oldData
        );
      });
      return { prev };
    },
    onError: (_err: unknown, _vars: { id: string; data: Record<string, unknown> }, context) => {
      context?.prev.forEach((data, key) => queryClient.setQueryData(JSON.parse(key), data));
      toast.error('Could not save event');
    },
    onSuccess: (res) => {
      reportConflicts(res as CalendarMutateResponse);
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  const createEvent = useMutation({
    mutationFn: (payload: CalendarPayload) =>
      api.post('/calendar', payload).then((res) => res.data as CalendarMutateResponse),
    onSuccess: (res) => {
      if (reportConflicts(res as CalendarMutateResponse) === 0) toast.success('Event created');
    },
    onError: () => toast.error('Could not create event'),
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success('Event deleted');
    },
    onError: () => toast.error('Could not delete event'),
  });

  // ── Navigation & interaction ─────────────────────────────────────────
  const navigate = (dir: 'prev' | 'next' | 'today') => {
    setCurrentDate((prev) => {
      if (dir === 'today') return new Date();
      if (view === 'month') return dir === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
      const step = view === 'week' || view === 'timeline' ? 7 : 1;
      return dir === 'prev' ? subDays(prev, step) : addDays(prev, step);
    });
  };

  const openNewEvent = (day?: Date) => {
    const target = day ?? currentDate;
    setEditingEvent(null);
    setNewDate(formatISO(target, { representation: 'date' }));
    setFormOpen(true);
  };

  const openEditEvent = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setNewDate(null);
    setFormOpen(true);
  };

  const handleDayDrop = (e: React.DragEvent, target: DropTarget) => {
    const id = e.dataTransfer.getData('text/plain');
    const ev = allEvents.find((x) => x.id === id);
    if (!ev) return;
    const s = parseDate(ev.startTime);
    const en = parseDate(ev.endTime);
    if (!s || !en) return;
    const slotMins = GRID_START_MIN + target.slot * SLOT_MINUTES;
    const newStart = addMinutes(startOfDay(target.day), slotMins);
    const dur = Math.max(differenceInMinutes(en, s), 30);
    const newEnd = addMinutes(newStart, dur);
    const patch: Record<string, unknown> = { startTime: formatISO(newStart), endTime: formatISO(newEnd) };
    if (resourceMode && target.resourceKey) {
      patch.assigneeUserIds = target.resourceKey === '__unassigned__' ? [] : [target.resourceKey];
    }
    updateEvent.mutate({ id: ev.id, data: patch });
  };

  const handleMonthDrop = (e: React.DragEvent, day: Date) => {
    const id = e.dataTransfer.getData('text/plain');
    const ev = allEvents.find((x) => x.id === id);
    if (!ev) return;
    const s = parseDate(ev.startTime);
    const en = parseDate(ev.endTime);
    if (!s || !en) return;
    const newStart = addMinutes(startOfDay(day), minsFromMidnight(s));
    const dur = Math.max(differenceInMinutes(en, s), 30);
    const newEnd = addMinutes(newStart, dur);
    updateEvent.mutate({ id: ev.id, data: { startTime: formatISO(newStart), endTime: formatISO(newEnd) } });
  };

  const handleDragStart = (e: React.DragEvent, ev: CalendarEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ev.id);
  };

  const handleFormSubmit = async (values: CalendarPayload) => {
    try {
      if (editingEvent) {
        await updateEvent.mutateAsync({ id: editingEvent.id, data: { ...values } });
        toast.success('Event updated');
      } else {
        await createEvent.mutateAsync(values);
      }
      setFormOpen(false);
    } catch {
      // error surfaced by mutation onError
    }
  };

  const handleDeleteEvent = (ev: CalendarEvent) => {
    if (window.confirm(`Delete "${ev.title}"?`)) {
      deleteEvent.mutate(ev.id);
      setFormOpen(false);
    }
  };

  const isSubmitting = createEvent.isPending || updateEvent.isPending || deleteEvent.isPending;

  const headerDate = useMemo(() => {
    if (view === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy');
    if (view === 'week' || view === 'timeline') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'MMMM yyyy');
  }, [view, currentDate]);

  const showResourceToggle = view !== 'month' && view !== 'timeline';

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Calendar</h1>
          <p className="text-text-secondary">Schedule inspections, production, estimates, and meetings.</p>
        </div>
        <Button variant="primary" size="md" icon={<Plus size={18} />} onClick={() => openNewEvent()}>
          New Event
        </Button>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" icon={<ChevronLeft size={16} />} aria-label="Previous" onClick={() => navigate('prev')} />
          <Button variant="ghost" size="sm" icon={<ChevronRight size={16} />} aria-label="Next" onClick={() => navigate('next')} />
          <Button variant="secondary" size="sm" onClick={() => navigate('today')}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-[hsl(var(--background-elevated))] border border-border p-1 text-sm">
          {VIEW_OPTIONS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                if (v === 'month' || v === 'timeline') setResourceMode(false);
              }}
              className={clsx(
                'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                view === v
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:bg-[hsl(var(--background-accent))]'
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {showResourceToggle && (
          <Button
            variant={resourceMode ? 'primary' : 'ghost'}
            size="sm"
            icon={<Users size={16} />}
            onClick={() => setResourceMode((r) => !r)}
          >
            {resourceMode ? 'Resource: On' : 'Resource: Off'}
          </Button>
        )}

        {conflictIds.size > 0 && (
          <Badge variant="warning" size="sm" className="gap-1">
            <AlertCircle size={12} />
            {conflictIds.size} overlapping event{conflictIds.size === 1 ? '' : 's'}
          </Badge>
        )}

        {/* Persistent search */}
        <div className="relative w-64">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search events…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Heatmap toggle — month view only */}
        {view === 'month' && (
          <Button
            variant={showHeatmap ? 'primary' : 'ghost'}
            size="sm"
            icon={<CalendarIcon size={16} />}
            onClick={() => setShowHeatmap((h) => !h)}
          >
            Heatmap
          </Button>
        )}
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {EVENT_TYPE_OPTIONS.map((o) => (
          <EventTypeChip key={o.value} type={o.value} />
        ))}
      </div>

      {/* Conflict warning list */}
      {conflictIds.size > 0 && (
        <Card variant="bordered" className="mb-3">
          <div className="flex items-start gap-2 p-3">
            <AlertCircle size={16} className="mt-0.5 text-amber" />
            <div className="text-sm">
              <strong className="font-medium text-text-primary">Scheduling conflicts detected</strong>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-text-secondary">
                {filteredEvents
                  .filter((e) => conflictIds.has(e.id))
                  .map((e) => (
                    <li key={e.id}>
                      <span className="font-medium text-text-primary">{e.title}</span> — {formatTime(e.startTime)} to {formatTime(e.endTime)}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Grid */}
      <Card variant="bordered" className="overflow-hidden">
        {eventsQuery.isError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle size={32} className="text-red" />
            <p className="text-text-secondary">
              Could not load calendar events. {(eventsQuery.error as Error)?.message}
            </p>
            <Button variant="secondary" size="sm" onClick={() => eventsQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : eventsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-3 py-10 text-text-secondary">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading schedule…</span>
          </div>
        ) : (
          (() => {
            if (view === 'month') {
              return (
                <MonthView
                  currentDate={currentDate}
                  events={filteredEvents}
                  conflictIds={conflictIds}
                  onEventClick={openEditEvent}
                  onDragStart={handleDragStart}
                  onMonthDrop={handleMonthDrop}
                  onDayClick={openNewEvent}
                  heatmapData={heatmapQuery.data?.data}
                  showHeatmap={showHeatmap}
                />
              );
            }
            if (view === 'timeline') {
              return (
                <TimelineView
                  currentDate={currentDate}
                  events={filteredEvents}
                  conflictIds={conflictIds}
                  onEventClick={openEditEvent}
                />
              );
            }
            return (
              <TimeView
                isDay={view === 'day'}
                currentDate={currentDate}
                events={filteredEvents}
                resourceMode={resourceMode}
                resources={resources}
                now={now}
                conflictIds={conflictIds}
                onEventClick={openEditEvent}
                onDragStart={handleDragStart}
                onDayDrop={handleDayDrop}
                onDayClick={openNewEvent}
              />
            );
          })()
        )}
      </Card>

      {/* Empty state */}
      {!eventsQuery.isError && !eventsQuery.isLoading && filteredEvents.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <CalendarIcon size={40} className="text-text-tertiary opacity-40" />
          {searchQuery && (
            <p className="text-text-secondary">
              No events match "{searchQuery}".{' '}
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="underline"
              >
                Clear search
              </button>
            </p>
          )}
          {!searchQuery && (
            <p className="text-text-tertiary">No events scheduled for this period.</p>
          )}
          <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => openNewEvent()}>
            Create your first event
          </Button>
        </div>
      )}

      <EventForm
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editingEvent}
        date={newDate ?? undefined}
        users={usersQuery.data?.data ?? []}
        isSubmitting={isSubmitting}
        onSubmit={handleFormSubmit}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
};

export default Calendar;
