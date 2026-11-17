/**
 * Pure helpers shared by the AI Storm Intelligence UI.
 *
 * Everything here is deterministic and side-effect free so it can be unit tested
 * without Leaflet, axios or a backend (see aiUtils.test.ts).
 */
import type {
  AISource,
  ImpactResult,
  LeadDriver,
  LeadInsightResponse,
  MapCopilotFilters,
  MapCopilotPlan,
  MapView,
  ProviderHealth,
  StormEventSummary,
} from '../../types/ai';

// ─────────────────────────── Severity / risk ───────────────────────────

export type RiskTone = 'extreme' | 'severe' | 'moderate' | 'minor' | 'none';

export interface RiskBand {
  /** Clamped 0–100 score. */
  score: number;
  /** Text label paired with the number — risk is never conveyed by colour alone. */
  label: string;
  tone: RiskTone;
}

const RISK_THRESHOLDS: Array<{ min: number; label: string; tone: RiskTone }> = [
  { min: 80, label: 'Extreme risk', tone: 'extreme' },
  { min: 60, label: 'Severe risk', tone: 'severe' },
  { min: 40, label: 'Moderate risk', tone: 'moderate' },
  { min: 20, label: 'Minor risk', tone: 'minor' },
  { min: 0, label: 'Low risk', tone: 'none' },
];

/** Clamp an arbitrary numeric-ish value into 0–100. */
export function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Deterministic risk band: number + text label + semantic tone. */
export function riskBand(score: unknown): RiskBand {
  const clamped = clampScore(score);
  const band = RISK_THRESHOLDS.find((t) => clamped >= t.min) ?? RISK_THRESHOLDS[RISK_THRESHOLDS.length - 1];
  return { score: clamped, label: band.label, tone: band.tone };
}

const SEVERITY_ORDER = ['NONE', 'MINOR', 'MODERATE', 'SEVERE', 'EXTREME'] as const;

/** Normalise any severity casing (`SEVERE`, `Severe`, `severe`) to a known rank. */
export function severityRank(severity: unknown): number {
  const upper = String(severity ?? '').trim().toUpperCase();
  const index = SEVERITY_ORDER.indexOf(upper as (typeof SEVERITY_ORDER)[number]);
  return index === -1 ? 0 : index;
}

/** `SEVERE` → `Severe` (matches the design-system severity badge variants). */
export function severityLabel(severity: unknown): string {
  const upper = String(severity ?? '').trim().toUpperCase();
  if (!upper) return 'Unknown';
  if (upper === 'NONE') return 'None';
  return upper.charAt(0) + upper.slice(1).toLowerCase();
}

/** Map severity to a design-system badge variant. */
export function severityBadgeTone(
  severity: unknown
): 'extreme' | 'severe' | 'moderate' | 'minor' | 'info' {
  switch (String(severity ?? '').toUpperCase()) {
    case 'EXTREME':
      return 'extreme';
    case 'SEVERE':
      return 'severe';
    case 'MODERATE':
      return 'moderate';
    case 'MINOR':
      return 'minor';
    default:
      return 'info';
  }
}

/** Human label for a lead-opportunity priority. */
export function priorityTone(priority: unknown): 'danger' | 'warning' | 'info' {
  switch (String(priority ?? '').toUpperCase()) {
    case 'HIGH':
      return 'danger';
    case 'MEDIUM':
      return 'warning';
    default:
      return 'info';
  }
}

/** Human label for an AI source (`llm` + model vs deterministic fallback). */
export function aiSourceLabel(
  source: AISource | string | undefined,
  model?: string | null,
  fallback?: boolean
): string {
  if (fallback || source === 'heuristic' || !source) return 'Offline engine';
  return model ? `AI · ${model}` : 'AI · managed provider';
}

/** Readable event-type label: `SEVERE_THUNDERSTORM` → `Severe thunderstorm`. */
export function eventTypeLabel(eventType: unknown): string {
  const raw = String(eventType ?? '').trim();
  if (!raw) return 'Storm';
  return raw
    .toLowerCase()
    .split('_')
    .map((part, i) => (i === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

// ─────────────────────────── Geometry ───────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

function isValidPoint(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Recursively collect `[lng, lat]` coordinate pairs out of a GeoJSON geometry. */
function collectCoordinates(node: unknown, out: Array<[number, number]>): void {
  if (!Array.isArray(node)) return;
  if (typeof node[0] === 'number' && typeof node[1] === 'number') {
    out.push([node[0], node[1]]);
    return;
  }
  for (const child of node) collectCoordinates(child, out);
}

/**
 * Bounding-box centre of a GeoJSON geometry (Polygon/MultiPolygon/Point/…),
 * used to fly the map to a storm-event outline. Returns null when the geometry
 * has no usable coordinates (events without geometry are listed but not mapped).
 */
export function geometryCenter(geometry: unknown): LatLng | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const coords = (geometry as { coordinates?: unknown }).coordinates;
  if (!coords) return null;

  const points: Array<[number, number]> = [];
  collectCoordinates(coords, points);

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let valid = 0;
  for (const [lng, lat] of points) {
    if (!isValidPoint(lat, lng)) continue;
    valid += 1;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  if (valid === 0) return null;
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

/** Clamp a copilot plan's centre/zoom into valid Leaflet bounds. */
export function planFocus(plan: MapCopilotPlan | null | undefined): MapView | null {
  if (!plan || !plan.center) return null;
  const lat = Number(plan.center.lat);
  const lng = Number(plan.center.lng);
  if (!isValidPoint(lat, lng)) return null;
  const rawZoom = Number(plan.zoom);
  const zoom = Number.isFinite(rawZoom) ? Math.max(3, Math.min(15, Math.round(rawZoom))) : 7;
  return { center: { lat, lng }, zoom };
}

/**
 * Pull a valid coordinate out of a `GET /leads/:id` payload, used by LeadImpactCard
 * to fall back to deterministic impact scoring when the AI gateway is offline.
 * Accepts both direct and `{ data: lead }` envelopes plus `lng`/`lon` aliases.
 */
export function leadCoordinatesFromPayload(payload: unknown): LatLng | null {
  if (!payload || typeof payload !== 'object') return null;
  const envelope = payload as { data?: unknown };
  const lead = (envelope.data && typeof envelope.data === 'object' ? envelope.data : payload) as {
    propertyLatLng?: { lat?: unknown; lng?: unknown; lon?: unknown } | null;
  };
  const coords = lead?.propertyLatLng;
  if (!coords) return null;
  const lat = Number(coords.lat);
  const lng = Number(coords.lng ?? coords.lon);
  if (!isValidPoint(lat, lng)) return null;
  return { lat, lng };
}

// ─────────────────────────── Plan → map wiring ───────────────────────────

export interface OverlayVisibility {
  alertPolygons?: boolean;
  stormOutlines?: boolean;
  radar?: boolean;
}

/**
 * Translate a copilot plan's overlay list into StormMap's additive
 * `overlayVisibility` prop. Returns `{}` when the plan does not control overlays.
 */
export function overlayVisibilityFromPlan(plan: MapCopilotPlan | null | undefined): OverlayVisibility {
  if (!plan || !Array.isArray(plan.overlays)) return {};
  return {
    alertPolygons: plan.overlays.includes('alerts'),
    stormOutlines: plan.overlays.includes('stormEvents'),
    radar: plan.overlays.includes('radar'),
  };
}

const EVENT_TYPE_MATCHERS: Record<string, RegExp> = {
  TORNADO: /tornado/i,
  HURRICANE: /hurricane|tropical/i,
  SEVERE_THUNDERSTORM: /thunderstorm|wind/i,
  FLASH_FLOOD: /flood/i,
  WINTER_STORM: /winter|blizzard|ice/i,
  WILDFIRE: /fire/i,
};

/** True when a `/storms/active` alert's free-text type matches a canonical event type. */
export function alertMatchesEventTypes(alertType: unknown, eventTypes?: string[]): boolean {
  if (!eventTypes?.length) return true;
  const text = String(alertType ?? '');
  return eventTypes.some((raw) => {
    const key = String(raw ?? '').toUpperCase();
    const matcher = EVENT_TYPE_MATCHERS[key];
    if (matcher) return matcher.test(text);
    return text.toUpperCase().includes(key);
  });
}

/** Filter `/storm-intel/overview` events by the copilot plan's severity/event-type filters. */
export function filterStormEvents(
  events: StormEventSummary[] | null | undefined,
  filters: MapCopilotFilters | null | undefined
): StormEventSummary[] {
  const list = Array.isArray(events) ? events : [];
  if (!filters) return list;
  const severities = (filters.severity ?? []).map((s) => String(s).toUpperCase());
  const eventTypes = (filters.eventTypes ?? []).map((t) => String(t).toUpperCase());
  return list.filter((event) => {
    if (severities.length && !severities.includes(String(event.severity ?? '').toUpperCase())) {
      return false;
    }
    if (eventTypes.length && !eventTypes.includes(String(event.eventType ?? '').toUpperCase())) {
      return false;
    }
    return true;
  });
}

export interface ActiveStormLike {
  id?: string;
  type?: string;
  severity?: string;
  headline?: string;
  [key: string]: unknown;
}

/** Filter the legacy `/storms/active` NOAA alert list using the copilot plan filters. */
export function filterActiveStorms<T extends ActiveStormLike>(
  storms: T[] | null | undefined,
  filters: MapCopilotFilters | null | undefined
): T[] {
  const list = Array.isArray(storms) ? storms : [];
  if (!filters) return list;
  const severities = (filters.severity ?? []).map((s) => String(s).toUpperCase());
  const eventTypes = (filters.eventTypes ?? []).map((t) => String(t).toUpperCase());
  return list.filter((storm) => {
    if (severities.length) {
      const severity = String(storm.severity ?? '').toUpperCase();
      // NOAA uses `Severe`/`Extreme`; severities from the plan may be canonical.
      if (!severities.includes(severity)) return false;
    }
    if (eventTypes.length && !alertMatchesEventTypes(storm.type ?? storm.headline, eventTypes)) {
      return false;
    }
    return true;
  });
}

export type PlanChipKind =
  | 'intent'
  | 'severity'
  | 'eventType'
  | 'overlay'
  | 'focus'
  | 'leads'
  | 'storms';

export interface PlanChip {
  id: string;
  kind: PlanChipKind;
  label: string;
}

const OVERLAY_LABELS: Record<string, string> = {
  alerts: 'Alert polygons',
  stormEvents: 'Storm outlines',
  hailSwath: 'Hail swath',
  leads: 'Leads',
  jobs: 'Jobs',
  radar: 'Radar',
};

/** Human-readable chips describing what a copilot plan changed on the map. */
export function buildPlanChips(plan: MapCopilotPlan | null | undefined): PlanChip[] {
  if (!plan) return [];
  const chips: PlanChip[] = [];
  const severities = plan.filters?.severity ?? [];
  const eventTypes = plan.filters?.eventTypes ?? [];

  if (severities.length) {
    chips.push({ id: 'severity', kind: 'severity', label: `Severity: ${severities.join(', ')}` });
  }
  if (eventTypes.length) {
    chips.push({ id: 'eventTypes', kind: 'eventType', label: `Event: ${eventTypes.join(', ')}` });
  }
  if (Array.isArray(plan.overlays) && plan.overlays.length) {
    chips.push({
      id: 'overlays',
      kind: 'overlay',
      label: `Overlays: ${plan.overlays.map((o) => OVERLAY_LABELS[o] ?? o).join(', ')}`,
    });
  }
  const focus = planFocus(plan);
  if (focus) {
    chips.push({
      id: 'focus',
      kind: 'focus',
      label: `Focus: ${focus.center.lat.toFixed(2)}, ${focus.center.lng.toFixed(2)} · z${focus.zoom}`,
    });
  }
  if (plan.highlightLeadIds?.length) {
    chips.push({
      id: 'leads',
      kind: 'leads',
      label: `${plan.highlightLeadIds.length} lead${plan.highlightLeadIds.length === 1 ? '' : 's'} highlighted`,
    });
  }
  if (plan.matchedStormIds?.length) {
    chips.push({
      id: 'storms',
      kind: 'storms',
      label: `${plan.matchedStormIds.length} storm${plan.matchedStormIds.length === 1 ? '' : 's'} matched`,
    });
  }
  return chips;
}

/** True when a plan actually changes map state (used to show a "Clear plan" button). */
export function planHasEffect(plan: MapCopilotPlan | null | undefined): boolean {
  if (!plan) return false;
  return buildPlanChips(plan).length > 0 || plan.intent !== 'unknown';
}

// ─────────────────────────── Lead impact view-model ───────────────────────────

export interface LeadImpactView {
  score: number;
  severityText: string;
  risk: RiskBand;
  drivers: LeadDriver[];
  nextBestAction?: string;
  talkTrack?: string;
  riskFlags: string[];
  explanation?: string;
  nearbyEvents: Array<{ id: string; name: string; severity: string; distanceKm: number }>;
  recommendations: string[];
  sourceLabel: string;
  generatedAt?: string;
  /** True when the numbers come from the deterministic engine only. */
  deterministic: boolean;
}

function normaliseDrivers(drivers: unknown): LeadDriver[] {
  if (!Array.isArray(drivers)) return [];
  return drivers
    .filter((d): d is LeadDriver => Boolean(d) && typeof d === 'object')
    .map((d) => ({
      label: String((d as LeadDriver).label ?? 'Factor'),
      weight: clampScore((d as LeadDriver).weight),
    }));
}

function formatFlags(flags: unknown): string[] {
  if (!Array.isArray(flags)) return [];
  return flags
    .map((flag) => (typeof flag === 'string' ? flag : String(flag ?? '')))
    .filter((flag) => flag.trim().length > 0);
}

/** View-model for `POST /ai/lead-insights` (LLM explains the deterministic score). */
export function leadInsightToView(insight: LeadInsightResponse): LeadImpactView {
  const score = clampScore(insight?.score);
  return {
    score,
    severityText: severityLabel(insight?.severity),
    risk: riskBand(score),
    drivers: normaliseDrivers(insight?.drivers),
    nextBestAction: insight?.nextBestAction || undefined,
    talkTrack: insight?.talkTrack || undefined,
    riskFlags: formatFlags(insight?.riskFlags),
    explanation: insight?.explanation || undefined,
    nearbyEvents: [],
    recommendations: [],
    sourceLabel: aiSourceLabel(insight?.source, insight?.model),
    generatedAt: insight?.generatedAt,
    deterministic: insight?.source === 'heuristic',
  };
}

/** View-model for `GET /storm-intel/impact` (always deterministic, no AI needed). */
export function impactToView(impact: ImpactResult): LeadImpactView {
  const score = clampScore(impact?.score);
  const nearby = Array.isArray(impact?.nearbyEvents)
    ? impact.nearbyEvents.map((event) => ({
        id: String(event?.id ?? ''),
        name: String(event?.name ?? 'Storm event'),
        severity: String(event?.severity ?? 'UNKNOWN'),
        distanceKm: Number(event?.distanceKm) || 0,
      }))
    : [];
  return {
    score,
    severityText: severityLabel(impact?.severity),
    risk: riskBand(score),
    drivers: normaliseDrivers(impact?.drivers),
    nearbyEvents: nearby,
    recommendations: formatFlags(impact?.recommendations),
    riskFlags: [],
    sourceLabel: 'Deterministic engine',
    deterministic: true,
  };
}

// ─────────────────────────── Provider admin helpers ───────────────────────────

export type ProviderHealthTone = 'healthy' | 'degraded' | 'error' | 'unconfigured' | 'unknown';

export interface ProviderHealthView {
  tone: ProviderHealthTone;
  label: string;
  detail?: string;
}

/** Normalise arbitrary backend health strings into a tone + human label. */
export function providerHealthView(
  health: ProviderHealth | null | undefined,
  configured = true
): ProviderHealthView {
  if (!configured) {
    return { tone: 'unconfigured', label: 'Not configured', detail: 'Add an API key to enable.' };
  }
  const raw = String(health?.status ?? 'unknown').toLowerCase();
  const detailParts: string[] = [];
  const latency = health?.latencyMs;
  if (typeof latency === 'number' && latency >= 0) {
    detailParts.push(`${Math.round(latency)}ms`);
  }
  const lastCheckAt = health?.lastCheckAt;
  if (lastCheckAt) {
    const checked = formatGeneratedAt(lastCheckAt);
    if (checked) detailParts.push(`checked ${checked}`);
  }
  const healthError = health?.error;
  if (healthError) detailParts.push(String(healthError));
  const detail = detailParts.length ? detailParts.join(' · ') : undefined;

  switch (raw) {
    case 'healthy':
    case 'ok':
    case 'up':
      return { tone: 'healthy', label: 'Healthy', detail };
    case 'degraded':
    case 'slow':
    case 'cooldown':
      return { tone: 'degraded', label: 'Degraded', detail };
    case 'error':
    case 'down':
    case 'failed':
    case 'unhealthy':
      return { tone: 'error', label: 'Unhealthy', detail };
    case 'unconfigured':
    case 'missing':
      return { tone: 'unconfigured', label: 'Not configured', detail };
    default:
      return { tone: 'unknown', label: 'Unknown', detail };
  }
}

const PROVIDER_NAME_LABELS: Record<string, string> = {
  groq: 'Groq',
  google: 'Google AI Studio',
  cerebras: 'Cerebras',
  mistral: 'Mistral',
  openrouter: 'OpenRouter',
  nvidia: 'NVIDIA NIM',
  freellmapi: 'FreeLLMAPI gateway',
  custom: 'Custom (OpenAI-compatible)',
  local: 'Local deterministic engine',
};

/** Friendly provider name for known ids; falls back to the id. */
export function providerDisplayName(providerId: unknown, name?: string | null): string {
  if (name && String(name).trim()) return String(name);
  const id = String(providerId ?? '').trim();
  return PROVIDER_NAME_LABELS[id.toLowerCase()] ?? (id || 'Unknown provider');
}

// ─────────────────────────── Formatting ───────────────────────────

/** Locale date/time label; returns '' for missing/invalid timestamps. */
export function formatGeneratedAt(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** `33.0512, -96.7501` */
export function formatLatLng(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '—';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/** Compact integer formatting for usage counters (1234 → 1,234). */
export function formatCount(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString();
}

/** Percentage string from a 0–1 ratio (0.25 → 25%). */
export function formatRate(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0%';
  return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
}
