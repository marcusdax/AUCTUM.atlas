/**
 * Rendering smoke tests for the AI Storm Intelligence panels.
 *
 * Focus: the AI-offline path must never crash or render a blank panel, and the
 * happy paths must render risk numbers + text (never colour alone), source badges
 * and map-copilot wiring. Only React Query / axios calls are mocked.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../services/ai', async () => {
  const actual = await vi.importActual<typeof import('../../services/ai')>('../../services/ai');
  return {
    ...actual,
    aiApi: {
      status: vi.fn(),
      chat: vi.fn(),
      stormBrief: vi.fn(),
      mapCopilot: vi.fn(),
      leadInsights: vi.fn(),
      providers: vi.fn(),
      addProvider: vi.fn(),
      updateProvider: vi.fn(),
      removeProvider: vi.fn(),
      testProvider: vi.fn(),
      usage: vi.fn(),
      stormOverview: vi.fn(),
      impact: vi.fn(),
      stormEvents: vi.fn(),
    },
  };
});

import { aiApi } from '../../services/ai';
import { api } from '../../services/api';
import { StormBriefCard } from './StormBriefCard';
import { MapCopilot } from './MapCopilot';
import { LeadImpactCard } from './LeadImpactCard';
import type {
  ImpactResult,
  LeadInsightResponse,
  MapCopilotResponse,
  StormBriefResponse,
} from '../../types/ai';

type Mock = ReturnType<typeof vi.fn>;

const mockedAi = aiApi as unknown as {
  stormBrief: Mock;
  mapCopilot: Mock;
  leadInsights: Mock;
  impact: Mock;
};
const mockedApi = api as unknown as { get: Mock };

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const briefResponse: StormBriefResponse = {
  generatedAt: '2026-11-16T21:00:00.000Z',
  source: 'llm',
  providerId: 'groq',
  model: 'llama-3.3-70b-versatile',
  latencyMs: 1840,
  fallback: false,
  brief: {
    title: 'Hail & wind corridor over Collin County',
    summary: 'Two severe thunderstorm warnings overlap 9 open leads.',
    severity: 'SEVERE',
    riskScore: 78,
    confidence: 0.82,
    damageTypes: ['Hail', 'Wind'],
    affectedAreas: ['Collin County, TX', 'McKinney, TX'],
    recommendedActions: ['Call the 9 impacted leads within 24h', 'Prioritize inspections'],
    leadOpportunities: [
      { area: 'McKinney, TX', reason: '9 open leads inside the polygon', priority: 'HIGH' },
    ],
    safetyNotes: ['Avoid roof access during active lightning'],
  },
  context: { stormCount: 3, leadCount: 9, jobCount: 4, impactedLeadCount: 9 },
};

const copilotResponse: MapCopilotResponse = {
  generatedAt: '2026-11-16T21:00:00.000Z',
  source: 'heuristic',
  providerId: 'local',
  model: 'deterministic-v1',
  latencyMs: 4,
  fallback: true,
  plan: {
    intent: 'filter_severity',
    explanation: 'Showing severe and extreme alerts only.',
    center: { lat: 33.05, lng: -96.75 },
    zoom: 8,
    overlays: ['alerts'],
    filters: { severity: ['SEVERE', 'EXTREME'] },
    highlightLeadIds: [],
    matchedStormIds: [],
  },
  suggestions: ['Show leads inside the hail swath'],
};

const impactResult: ImpactResult = {
  score: 42,
  severity: 'MODERATE',
  drivers: [{ label: 'Distance to hail swath', weight: 42 }],
  nearbyEvents: [{ id: 'e1', name: 'Hail swath', severity: 'SEVERE', distanceKm: 12.4 }],
  recommendations: ['Schedule an inspection within 48 hours.'],
};

const leadInsight: LeadInsightResponse = {
  leadId: 'lead-1',
  score: 86,
  severity: 'EXTREME',
  drivers: [{ label: 'Inside warning polygon', weight: 100 }],
  explanation: 'This property sits inside the tornado warning polygon.',
  nextBestAction: 'Call the homeowner within 24 hours.',
  talkTrack: 'A tornado warning crossed your neighborhood…',
  riskFlags: ['Active lightning'],
  source: 'llm',
  providerId: 'groq',
  model: 'llama-3.3-70b-versatile',
  latencyMs: 900,
  generatedAt: '2026-11-16T21:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StormBriefCard — AI online', () => {
  it('renders the brief with a numeric + text risk gauge and AI source badge', async () => {
    mockedAi.stormBrief.mockResolvedValueOnce(briefResponse);
    renderWithClient(<StormBriefCard />);

    expect(
      await screen.findByText('Hail & wind corridor over Collin County')
    ).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: /Storm risk 78 out of 100 — Severe risk/ })).toBeInTheDocument();
    expect(screen.getByText('AI · llama-3.3-70b-versatile')).toBeInTheDocument();
    expect(screen.getByText('Severe severity')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument();
    // Numbered action checklist
    expect(screen.getByLabelText('Call the 9 impacted leads within 24h')).toBeInTheDocument();
    // Lead opportunity links to the leads page
    expect(screen.getByRole('link', { name: /View leads in McKinney, TX/i })).toHaveAttribute(
      'href',
      '/leads?search=McKinney%2C%20TX'
    );
    expect(mockedAi.stormBrief).toHaveBeenCalledTimes(1);
  });
});

describe('StormBriefCard — AI offline', () => {
  it('shows the offline state without calling the API when AI status is unreachable', async () => {
    renderWithClient(<StormBriefCard enabled={false} />);
    expect(await screen.findByText('AI offline')).toBeInTheDocument();
    expect(mockedAi.stormBrief).not.toHaveBeenCalled();
  });

  it('renders a retryable error (not a crash) when the brief endpoint returns 501', async () => {
    mockedAi.stormBrief.mockRejectedValueOnce({ response: { status: 501 } });
    renderWithClient(<StormBriefCard />);

    expect(
      await screen.findByText(/not available on this deployment yet/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry AI request/i })).toBeInTheDocument();
  });
});

describe('MapCopilot', () => {
  it('disables input and explains the offline mode when AI is unreachable', () => {
    renderWithClient(<MapCopilot enabled={false} onApplyPlan={vi.fn()} />);
    expect(screen.getByLabelText('Ask the map copilot')).toBeDisabled();
    expect(
      screen.getByText(/natural-language map commands are unavailable/i)
    ).toBeInTheDocument();
  });

  it('submits a query and applies the validated plan to the map', async () => {
    mockedAi.mapCopilot.mockResolvedValueOnce(copilotResponse);
    const onApplyPlan = vi.fn();
    const { container } = renderWithClient(
      <MapCopilot enabled onApplyPlan={onApplyPlan} onClearPlan={vi.fn()} view={null} />
    );

    fireEvent.change(screen.getByLabelText('Ask the map copilot'), {
      target: { value: 'show extreme tornado warnings' },
    });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => expect(onApplyPlan).toHaveBeenCalledWith(copilotResponse.plan));
    expect(mockedAi.mapCopilot).toHaveBeenCalledWith({
      query: 'show extreme tornado warnings',
      view: undefined,
    });
    expect(await screen.findByText('Showing severe and extreme alerts only.')).toBeInTheDocument();
    expect(screen.getByText('Severity: SEVERE, EXTREME')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear map copilot plan/i })).toBeInTheDocument();
  });
});

describe('LeadImpactCard', () => {
  it('renders the empty state with no selection', () => {
    renderWithClient(<LeadImpactCard />);
    expect(screen.getByText('Pick a property')).toBeInTheDocument();
  });

  it('renders deterministic impact for a clicked map point', async () => {
    mockedAi.impact.mockResolvedValueOnce(impactResult);
    renderWithClient(<LeadImpactCard point={{ lat: 32.7767, lng: -96.797 } } />);

    expect(await screen.findByText(/42 \/ 100 storm impact/)).toBeInTheDocument();
    expect((await screen.findAllByText('Deterministic engine')).length).toBeGreaterThan(0);
    expect(screen.getByText('Moderate impact')).toBeInTheDocument();
    expect(screen.getByText('Distance to hail swath')).toBeInTheDocument();
  });

  it('renders the AI explanation for a selected lead', async () => {
    mockedAi.leadInsights.mockResolvedValueOnce(leadInsight);
    renderWithClient(<LeadImpactCard leadId="lead-1" />);

    expect(await screen.findByText(/tornado warning crossed your neighborhood/)).toBeInTheDocument();
    expect(screen.getByText('Next best action')).toBeInTheDocument();
    expect(screen.getByText('Call the homeowner within 24 hours.')).toBeInTheDocument();
    expect(
      (await screen.findAllByText('AI · llama-3.3-70b-versatile')).length
    ).toBeGreaterThan(0);
    expect(screen.getByText('Active lightning')).toBeInTheDocument();
  });

  it('falls back to deterministic scoring when lead insights return 501', async () => {
    mockedAi.leadInsights.mockRejectedValueOnce({ response: { status: 501 } });
    mockedApi.get.mockResolvedValueOnce({ data: { propertyLatLng: { lat: 32.7767, lng: -96.797 } } });
    mockedAi.impact.mockResolvedValueOnce(impactResult);
    renderWithClient(<LeadImpactCard leadId="lead-1" />);

    expect((await screen.findAllByText('Deterministic engine')).length).toBeGreaterThan(0);
    expect(mockedApi.get).toHaveBeenCalledWith('/leads/lead-1');
    expect(await screen.findByText(/42 \/ 100 storm impact/)).toBeInTheDocument();
  });
});
