import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

// Replace the shared axios instance with a spy object so we can assert the
// exact endpoint paths/payloads the AI UI will call.
vi.mock('./api', () => {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
  return { api, default: api };
});

import { api } from './api';
import {
  AI_NOT_READY_MESSAGE,
  aiApi,
  aiErrorStatus,
  describeAiError,
  isAiOfflineError,
} from './ai';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('aiApi — contract §6.2 endpoint wiring', () => {
  it('GET /ai/status', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { enabled: true, providers: [] } });
    const result = await aiApi.status();
    expect(mockedApi.get).toHaveBeenCalledWith('/ai/status');
    expect(result.enabled).toBe(true);
  });

  it('POST /ai/chat passes messages through', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'c1', content: 'hi' } });
    const messages = [{ role: 'user' as const, content: 'brief me' }];
    const result = await aiApi.chat({ messages, conversationId: 'c1' });
    expect(mockedApi.post).toHaveBeenCalledWith('/ai/chat', {
      messages,
      conversationId: 'c1',
    });
    expect(result.content).toBe('hi');
  });

  it('POST /ai/storm-brief defaults to an empty payload', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { source: 'heuristic' } });
    await aiApi.stormBrief();
    expect(mockedApi.post).toHaveBeenCalledWith('/ai/storm-brief', {});
  });

  it('POST /ai/storm-brief sends focus + storm ids', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { source: 'heuristic' } });
    await aiApi.stormBrief({ focus: 'leads', stormIds: ['e1', 'e2'] });
    expect(mockedApi.post).toHaveBeenCalledWith('/ai/storm-brief', {
      focus: 'leads',
      stormIds: ['e1', 'e2'],
    });
  });

  it('POST /ai/map-copilot sends query + current view', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { plan: { intent: 'reset' } } });
    const view = { center: { lat: 33, lng: -96 }, zoom: 8 };
    await aiApi.mapCopilot({ query: 'reset view', view });
    expect(mockedApi.post).toHaveBeenCalledWith('/ai/map-copilot', {
      query: 'reset view',
      view,
    });
  });

  it('POST /ai/lead-insights sends the lead id', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { leadId: 'lead-1', score: 80 } });
    await aiApi.leadInsights('lead-1');
    expect(mockedApi.post).toHaveBeenCalledWith('/ai/lead-insights', { leadId: 'lead-1' });
  });

  it('GET /ai/providers returns providers + chain', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { providers: [{ id: 'p1' }], chain: ['groq'] },
    });
    const result = await aiApi.providers();
    expect(mockedApi.get).toHaveBeenCalledWith('/ai/providers');
    expect(result.chain).toEqual(['groq']);
  });

  it('POST /ai/providers unwraps { provider }', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { provider: { id: 'p2', providerId: 'groq' } } });
    const provider = await aiApi.addProvider({ providerId: 'groq', apiKey: 'gsk_x' });
    expect(mockedApi.post).toHaveBeenCalledWith('/ai/providers', {
      providerId: 'groq',
      apiKey: 'gsk_x',
    });
    expect(provider.id).toBe('p2');
  });

  it('PATCH /ai/providers/:id unwraps { provider }', async () => {
    mockedApi.patch.mockResolvedValueOnce({ data: { provider: { id: 'p2', enabled: false } } });
    const provider = await aiApi.updateProvider('p2', { enabled: false });
    expect(mockedApi.patch).toHaveBeenCalledWith('/ai/providers/p2', { enabled: false });
    expect(provider.enabled).toBe(false);
  });

  it('DELETE and test endpoints hit the provider routes', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: { ok: true } });
    mockedApi.post.mockResolvedValueOnce({ data: { ok: true, latencyMs: 120 } });

    await expect(aiApi.removeProvider('p2')).resolves.toEqual({ ok: true });
    expect(mockedApi.delete).toHaveBeenCalledWith('/ai/providers/p2');

    const testResult = await aiApi.testProvider('p2');
    expect(mockedApi.post).toHaveBeenCalledWith('/ai/providers/p2/test');
    expect(testResult.latencyMs).toBe(120);
  });

  it('GET /ai/usage forwards the days window', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { totals: { requests: 3, tokens: 40 } } });
    await aiApi.usage(14);
    expect(mockedApi.get).toHaveBeenCalledWith('/ai/usage', { params: { days: 14 } });
  });

  it('GET /storm-intel/overview forwards days and stormEvents flattens events', async () => {
    const events = [{ id: 'e1', severity: 'SEVERE' }];
    mockedApi.get.mockResolvedValue({
      data: { generatedAt: 'x', events, stats: {} },
    });
    const overview = await aiApi.stormOverview(3);
    expect(mockedApi.get).toHaveBeenCalledWith('/storm-intel/overview', {
      params: { days: 3 },
    });
    expect(overview.events).toEqual(events);
    await expect(aiApi.stormEvents(7)).resolves.toEqual(events);
  });

  it('GET /storm-intel/impact sends lat/lng params', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { score: 42, severity: 'MODERATE' } });
    const impact = await aiApi.impact(33.05, -96.75);
    expect(mockedApi.get).toHaveBeenCalledWith('/storm-intel/impact', {
      params: { lat: 33.05, lng: -96.75 },
    });
    expect(impact.score).toBe(42);
  });
});

describe('AI error handling — graceful offline mode', () => {
  it('detects offline statuses (501/503/404/network) but not actionable ones', () => {
    expect(isAiOfflineError({ response: { status: 501 } })).toBe(true);
    expect(isAiOfflineError({ response: { status: 503 } })).toBe(true);
    expect(isAiOfflineError({ response: { status: 404 } })).toBe(true);
    expect(isAiOfflineError(new Error('network down'))).toBe(true); // no response
    expect(isAiOfflineError({ response: { status: 403 } })).toBe(false);
    expect(isAiOfflineError({ response: { status: 429 } })).toBe(false);
    expect(isAiOfflineError({ response: { status: 400 } })).toBe(false);
  });

  it('reads status codes from real AxiosErrors', () => {
    const error = new AxiosError(
      'Request failed',
      'ERR_BAD_RESPONSE',
      undefined,
      undefined,
      {
        status: 501,
        statusText: 'Not Implemented',
        headers: {},
        config: { headers: {} } as never,
        data: { error: 'not implemented' },
      }
    );
    expect(aiErrorStatus(error)).toBe(501);
    expect(isAiOfflineError(error)).toBe(true);
  });

  it('returns status-specific user-facing messages', () => {
    expect(describeAiError({ response: { status: 501 } })).toBe(AI_NOT_READY_MESSAGE);
    expect(describeAiError({ response: { status: 403 } })).toContain('permission');
    expect(describeAiError({ response: { status: 429 } })).toContain('rate limit');
    expect(describeAiError({ response: { status: 500 } })).toContain('AI gateway');
    expect(describeAiError({ response: { status: 401 } })).toContain('session expired');
    expect(describeAiError(new Error('offline'))).toContain('Cannot reach');
  });
});
