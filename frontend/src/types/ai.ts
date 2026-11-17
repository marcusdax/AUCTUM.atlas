/**
 * AI Gateway & Storm Intelligence — shared frontend types.
 *
 * Mirrors docs/AI_STORM_ARCHITECTURE.md §5 (REST contracts) exactly. These types
 * describe the wire format returned by the backend; no component may invent
 * additional required fields. All responses are treated defensively in the UI
 * (the backend routes return 501 until backend-ai / backend-storm land).
 */

// ─────────────────────────── Geometry ───────────────────────────

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Map viewport used by the copilot. `lng` matches the Leaflet/API contract;
 * legacy `lon` is tolerated by consumers when reading `/storms/active`.
 */
export interface MapView {
  center: GeoPoint;
  zoom: number;
}

// ─────────────────────────── Chat (5.2) ───────────────────────────

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResponse {
  id: string;
  content: string;
  providerId: string;
  model: string;
  usage: LLMUsage;
  latencyMs: number;
  fallback: boolean;
  createdAt: string;
}

// ─────────────────────────── AI status (5.1) ───────────────────────────

export type AIRoutingStrategy = 'balanced' | 'speed' | 'reliability' | 'priority';

export interface AIFallbackChainEntry {
  providerId: string;
  model?: string;
}

export interface AIStatusUsage {
  requests: number;
  tokens: number;
  fallbackRate?: number;
}

export interface AIStatus {
  enabled: boolean;
  routing: {
    strategy: AIRoutingStrategy | string;
    stickyMinutes: number;
    fallbackChain: AIFallbackChainEntry[];
  };
  providers: ProviderView[];
  localFallback: {
    available: boolean;
    engine: string;
  };
  usage: {
    today: AIStatusUsage;
    last7d: AIStatusUsage;
  };
}

// ─────────────────────────── Storm brief (5.3) ───────────────────────────

/** Which angle the deterministic/LLM brief should emphasise. */
export type StormBriefFocus = 'damage' | 'leads' | 'safety' | 'operations';

export type StormSeverity = 'MINOR' | 'MODERATE' | 'SEVERE' | 'EXTREME';
export type StormImpactSeverity = 'NONE' | StormSeverity;

export type LeadOpportunityPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface LeadOpportunity {
  area: string;
  reason: string;
  priority: LeadOpportunityPriority | string;
}

export interface StormBrief {
  title: string;
  summary: string;
  /** Derived deterministically from the storm context (LLM may not raise/lower it). */
  severity: StormSeverity;
  riskScore: number; // 0–100, deterministic
  confidence: number; // 0–1
  damageTypes: string[];
  affectedAreas: string[];
  recommendedActions: string[];
  leadOpportunities: LeadOpportunity[];
  safetyNotes: string[];
}

export interface StormBriefRequest {
  stormIds?: string[];
  bbox?: BBox;
  focus?: StormBriefFocus;
  days?: number;
}

/** 'llm' when a provider answered; 'heuristic' when the local engine answered. */
export type AISource = 'llm' | 'heuristic';

export interface StormBriefResponse {
  generatedAt: string;
  source: AISource;
  providerId: string;
  model: string;
  latencyMs: number;
  fallback: boolean;
  brief: StormBrief;
  context: {
    stormCount: number;
    leadCount: number;
    jobCount: number;
    impactedLeadCount: number;
  };
}

// ─────────────────────────── Map copilot (5.4) ───────────────────────────

export type MapCopilotIntent =
  | 'focus_storm'
  | 'filter_severity'
  | 'show_leads'
  | 'show_jobs'
  | 'reset'
  | 'explain'
  | 'unknown';

export type MapOverlayId =
  | 'alerts'
  | 'stormEvents'
  | 'hailSwath'
  | 'leads'
  | 'jobs'
  | 'radar';

export interface MapCopilotFilters {
  severity?: string[];
  eventTypes?: string[];
}

export interface MapCopilotPlan {
  intent: MapCopilotIntent;
  explanation: string;
  center?: GeoPoint;
  zoom?: number;
  bbox?: BBox;
  overlays?: MapOverlayId[];
  filters?: MapCopilotFilters;
  highlightLeadIds?: string[];
  matchedStormIds?: string[];
}

export interface MapCopilotResponse {
  generatedAt: string;
  source: AISource;
  providerId: string;
  model: string;
  latencyMs: number;
  fallback: boolean;
  plan: MapCopilotPlan;
  suggestions: string[];
}

// ─────────────────────────── Lead insights (5.5) ───────────────────────────

export interface LeadDriver {
  label: string;
  weight: number;
}

export interface LeadInsightResponse {
  leadId: string;
  score: number; // 0–100, deterministic
  severity: StormImpactSeverity;
  drivers: LeadDriver[];
  explanation: string;
  nextBestAction: string;
  recommendedStatus?: string;
  talkTrack: string;
  riskFlags: string[];
  source: AISource;
  providerId?: string;
  model?: string;
  latencyMs: number;
  generatedAt: string;
}

// ─────────────────────────── Provider admin (5.6) ───────────────────────────

export type ProviderKind = 'remote' | 'local';

/** Health status is not fully pinned by the contract — normalise defensively in the UI. */
export type ProviderHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unconfigured'
  | 'error'
  | 'unknown';

export interface ProviderHealth {
  status: ProviderHealthStatus | string;
  lastCheckAt?: string | null;
  latencyMs?: number | null;
  error?: string | null;
}

export interface ProviderView {
  id: string;
  providerId: string;
  name: string;
  kind: ProviderKind | string;
  baseUrl?: string | null;
  enabled: boolean;
  priority: number;
  models: string[];
  configured: boolean;
  apiKeyMasked?: string | null;
  health: ProviderHealth;
}

export interface ProviderTestResult {
  ok: boolean;
  latencyMs?: number;
  model?: string;
  error?: string;
}

export interface AddProviderPayload {
  providerId: string;
  apiKey: string;
  baseUrl?: string;
  models?: string[];
  priority?: number;
  enabled?: boolean;
}

/** PATCH accepts any subset; `apiKey` (when present) rotates the stored secret. */
export interface UpdateProviderPayload {
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  priority?: number;
  enabled?: boolean;
  name?: string;
}

export interface AIProvidersResponse {
  providers: ProviderView[];
  /** Provider ids ordered by routing priority (highest priority first). */
  chain: string[];
}

export interface AITestProviderRequest {
  id: string;
}

// ─────────────────────────── Usage (5.6) ───────────────────────────

export interface AIUsageTotals {
  requests: number;
  tokens: number;
  fallbackRate?: number;
}

export interface AIUsageByDay {
  date: string;
  requests: number;
  tokens: number;
  fallbackRate?: number;
}

export interface AIUsageByProvider {
  providerId: string;
  requests: number;
  tokens: number;
  fallbackRate?: number;
}

export interface AIUsageByPurpose {
  purpose: string;
  requests: number;
  tokens: number;
}

export interface AIUsageResponse {
  totals: AIUsageTotals;
  byDay: AIUsageByDay[];
  byProvider: AIUsageByProvider[];
  byPurpose: AIUsageByPurpose[];
  /** Present when a caller asks for a window; some deployments echo `days`. */
  days?: number;
  /** Convenience snapshots (mirrors /ai/status.usage) when the backend provides them. */
  today?: AIUsageTotals;
  last7d?: AIUsageTotals;
}

// ─────────────────────────── Storm intelligence (5.7 + 4.2) ───────────────────────────

/** Event type normalised by the backend storm service (see §4.3). */
export type StormEventType =
  | 'TORNADO'
  | 'HURRICANE'
  | 'SEVERE_THUNDERSTORM'
  | 'FLASH_FLOOD'
  | 'WINTER_STORM'
  | 'WILDFIRE';

export interface StormEventSummary {
  id: string;
  externalId?: string | null;
  name: string;
  eventType: StormEventType | string;
  severity: StormSeverity;
  startDate: string;
  endDate: string;
  area?: string | null;
  source: 'NOAA' | 'MANUAL' | 'IMPORT' | string;
  /** GeoJSON Polygon/MultiPolygon when the alert zone has usable geometry. */
  geometry?: unknown;
  leadCount: number;
  jobCount: number;
  aiBrief?: unknown;
}

export interface StormContextStats {
  activeEvents: number;
  extremeCount: number;
  leadsInImpact: number;
  jobsInImpact: number;
  bySeverity: Record<string, number>;
}

export interface StormLeadRefSummary {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  status: string;
  score: number;
  stormEventId?: string | null;
}

export interface StormOverviewResponse {
  generatedAt: string;
  days?: number;
  events: StormEventSummary[];
  leads?: StormLeadRefSummary[];
  stats: StormContextStats;
}

export interface ConvertMapToLeadsRequest {
  eventId?: string;
  lat?: number;
  lng?: number;
  label?: string;
  count?: number;
}

export interface ConvertMapToLeadsResponse {
  created: number;
  existing: number;
  zone: {
    name: string;
    severity: string;
    lat: number;
    lng: number;
    impactScore: number;
    eventId?: string;
  };
  leads: Array<{
    id: string;
    firstName: string;
    lastName: string;
    propertyAddress: string;
    score: number;
    stormImpactScore: number;
    status: string;
  }>;
}

export interface ImpactNearbyEvent {
  id: string;
  name: string;
  severity: string;
  distanceKm: number;
}

export interface ImpactResult {
  score: number; // 0–100
  severity: StormImpactSeverity;
  drivers: LeadDriver[];
  nearbyEvents: ImpactNearbyEvent[];
  recommendations: string[];
}

// ─────────────────────────── UI helpers (shared, non-wire) ───────────────────────────

/** Unified view-model shared by StormBriefCard / LeadImpactCard rendering. */
export interface AIOfflineState {
  offline: boolean;
  message: string;
}
