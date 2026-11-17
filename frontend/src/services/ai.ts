/**
 * AI Gateway + Storm Intelligence API client.
 *
 * Contract: docs/AI_STORM_ARCHITECTURE.md §5/§6.2. All calls go through the shared
 * authenticated axios instance (`services/api.ts`, baseURL `/api/v1`, JWT interceptor).
 * Errors bubble as `AxiosError` — UI panels use the helpers below to render an
 * AI-offline state instead of crashing (the backend returns 501 until backend-ai lands).
 */
import { AxiosError } from 'axios';
import { api } from './api';
import type {
  AIProvidersResponse,
  AIStatus,
  AIUsageResponse,
  AddProviderPayload,
  ChatMessage,
  ChatResponse,
  ConvertMapToLeadsRequest,
  ConvertMapToLeadsResponse,
  ImpactResult,
  LeadInsightResponse,
  MapCopilotResponse,
  MapView,
  ProviderTestResult,
  ProviderView,
  StormBriefRequest,
  StormBriefResponse,
  StormEventSummary,
  StormOverviewResponse,
  UpdateProviderPayload,
} from '../types/ai';

/** User-facing copy for the graceful AI-offline mode. */
export const AI_OFFLINE_MESSAGE =
  'AI services are offline. Storm data, the map and deterministic impact scoring still work.';

export const AI_NOT_READY_MESSAGE =
  'This AI capability is not available on this deployment yet. Deterministic storm data still works.';

/** Extract an HTTP status from an unknown error (null for network failures). */
export function aiErrorStatus(error: unknown): number | null {
  if (error instanceof AxiosError) {
    return error.response?.status ?? null;
  }
  // Duck-type in case a non-axios error carries a response (e.g. mocked clients).
  const candidate = error as { response?: { status?: unknown }; status?: unknown } | null;
  const status = candidate?.response?.status ?? candidate?.status;
  return typeof status === 'number' ? status : null;
}

/**
 * True when the failure means "AI is unavailable" rather than "bad request":
 * gateway not implemented (404/501), upstream failure (502/503/504) or no
 * network response at all. 401/403/429 are actionable errors and are NOT offline.
 */
export function isAiOfflineError(error: unknown): boolean {
  const status = aiErrorStatus(error);
  if (status === null) return true; // network error / timeout
  return [404, 501, 502, 503, 504].includes(status);
}

/** Friendly, non-technical message for any AI call failure. */
export function describeAiError(error: unknown): string {
  const status = aiErrorStatus(error);
  switch (status) {
    case 400:
      return 'That request could not be understood. Try rephrasing or refreshing.';
    case 401:
      return 'Your session expired. Sign in again to use AI features.';
    case 403:
      return 'You do not have permission to use this AI feature. Ask an owner or manager.';
    case 404:
    case 501:
      return AI_NOT_READY_MESSAGE;
    case 429:
      return 'AI rate limit reached. Try again in a moment.';
    default:
      if (status !== null && status >= 500) {
        return 'The AI gateway had a problem. Try again in a moment.';
      }
      if (status === null) {
        return 'Cannot reach the AI gateway. Check your connection and retry.';
      }
      return (
        (error as { message?: string } | null)?.message ||
        'Something went wrong while contacting the AI gateway.'
      );
  }
}

/** Normalise the two shapes a provider write endpoint may return. */
function unwrapProvider(data: unknown): ProviderView {
  const maybe = data as { provider?: ProviderView } | ProviderView | null;
  if (maybe && typeof maybe === 'object' && 'provider' in maybe && maybe.provider) {
    return maybe.provider;
  }
  return maybe as ProviderView;
}

export const aiApi = {
  // ── Status ────────────────────────────────────────────────────────────────
  status: (): Promise<AIStatus> => api.get<AIStatus>('/ai/status').then((res) => res.data),

  // ── Chat (generic) ────────────────────────────────────────────────────────
  chat: (payload: {
    messages: ChatMessage[];
    conversationId?: string;
    json?: boolean;
  }): Promise<ChatResponse> =>
    api.post<ChatResponse>('/ai/chat', payload).then((res) => res.data),

  // ── Storm intelligence brief ──────────────────────────────────────────────
  stormBrief: (payload: StormBriefRequest = {}): Promise<StormBriefResponse> =>
    api.post<StormBriefResponse>('/ai/storm-brief', payload).then((res) => res.data),

  // ── Map copilot (NL → validated plan) ─────────────────────────────────────
  mapCopilot: (payload: { query: string; view?: MapView }): Promise<MapCopilotResponse> =>
    api.post<MapCopilotResponse>('/ai/map-copilot', payload).then((res) => res.data),

  // ── Lead insight explanation over the deterministic score ─────────────────
  leadInsights: (leadId: string): Promise<LeadInsightResponse> =>
    api
      .post<LeadInsightResponse>('/ai/lead-insights', { leadId })
      .then((res) => res.data),

  // ── Provider admin (OWNER / MANAGER) ──────────────────────────────────────
  providers: (): Promise<AIProvidersResponse> =>
    api.get<AIProvidersResponse>('/ai/providers').then((res) => res.data),

  addProvider: (payload: AddProviderPayload): Promise<ProviderView> =>
    api.post('/ai/providers', payload).then((res) => unwrapProvider(res.data)),

  updateProvider: (id: string, payload: UpdateProviderPayload): Promise<ProviderView> =>
    api.patch(`/ai/providers/${id}`, payload).then((res) => unwrapProvider(res.data)),

  removeProvider: (id: string): Promise<{ ok: true }> =>
    api.delete<{ ok: true }>(`/ai/providers/${id}`).then((res) => res.data),

  testProvider: (id: string): Promise<ProviderTestResult> =>
    api
      .post<ProviderTestResult>(`/ai/providers/${id}/test`)
      .then((res) => res.data),

  // ── Usage ─────────────────────────────────────────────────────────────────
  usage: (days = 7): Promise<AIUsageResponse> =>
    api
      .get<AIUsageResponse>('/ai/usage', { params: { days } })
      .then((res) => res.data),

  // ── Storm intelligence (deterministic, no AI needed) ──────────────────────
  stormOverview: (days = 7): Promise<StormOverviewResponse> =>
    api
      .get<StormOverviewResponse>('/storm-intel/overview', { params: { days } })
      .then((res) => res.data),

  /** Deterministic point impact — works with no LLM provider configured. */
  impact: (lat: number, lng: number): Promise<ImpactResult> =>
    api
      .get<ImpactResult>('/storm-intel/impact', { params: { lat, lng } })
      .then((res) => res.data),

  /** Events that have usable geometry, for map outlines. */
  stormEvents: (days = 7): Promise<StormEventSummary[]> =>
    aiApi
      .stormOverview(days)
      .then((overview) => (Array.isArray(overview?.events) ? overview.events : [])),

  /** Convert a clicked map zone or active storm event into storm-scored Leads. */
  convertMapToLeads: (
    payload: ConvertMapToLeadsRequest = {}
  ): Promise<ConvertMapToLeadsResponse> =>
    api
      .post<ConvertMapToLeadsResponse>('/storm-intel/convert-to-leads', payload)
      .then((res) => res.data),

  /** Trigger company-wide deterministic lead impact rescore. */
  rescoreLeads: (eventId?: string): Promise<{ scored: number; updated: number }> =>
    api
      .post<{ scored: number; updated: number }>('/storm-intel/rescore-leads', {
        ...(eventId ? { eventId } : {}),
      })
      .then((res) => res.data),
};

export default aiApi;
