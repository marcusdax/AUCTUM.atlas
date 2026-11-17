import { describe, it, expect } from 'vitest';
import {
  aiSourceLabel,
  buildPlanChips,
  clampScore,
  filterActiveStorms,
  filterStormEvents,
  geometryCenter,
  impactToView,
  leadCoordinatesFromPayload,
  leadInsightToView,
  overlayVisibilityFromPlan,
  planFocus,
  providerHealthView,
  riskBand,
  severityBadgeTone,
  severityLabel,
} from './aiUtils';
import type {
  ImpactResult,
  LeadInsightResponse,
  MapCopilotPlan,
  StormEventSummary,
} from '../../types/ai';

const plan = (overrides: Partial<MapCopilotPlan> = {}): MapCopilotPlan => ({
  intent: 'filter_severity',
  explanation: 'Showing severe alerts only.',
  ...overrides,
});

const event = (overrides: Partial<StormEventSummary> = {}): StormEventSummary => ({
  id: 'evt-1',
  name: 'Hail corridor',
  eventType: 'SEVERE_THUNDERSTORM',
  severity: 'SEVERE',
  startDate: '2026-11-16T00:00:00.000Z',
  endDate: '2026-11-16T06:00:00.000Z',
  source: 'NOAA',
  leadCount: 9,
  jobCount: 2,
  ...overrides,
});

describe('riskBand — number + text, never colour alone', () => {
  it('maps threshold bands', () => {
    expect(riskBand(92)).toMatchObject({ score: 92, label: 'Extreme risk', tone: 'extreme' });
    expect(riskBand(60)).toMatchObject({ label: 'Severe risk', tone: 'severe' });
    expect(riskBand(40)).toMatchObject({ label: 'Moderate risk', tone: 'moderate' });
    expect(riskBand(20)).toMatchObject({ label: 'Minor risk', tone: 'minor' });
    expect(riskBand(5)).toMatchObject({ label: 'Low risk', tone: 'none' });
  });

  it('clamps out-of-range and invalid scores', () => {
    expect(riskBand(-10).score).toBe(0);
    expect(riskBand(150).score).toBe(100);
    expect(riskBand(Number.NaN).score).toBe(0);
    expect(riskBand('78').score).toBe(78);
    expect(clampScore(undefined)).toBe(0);
  });
});

describe('severity helpers', () => {
  it('normalises casing for labels and badge tones', () => {
    expect(severityLabel('SEVERE')).toBe('Severe');
    expect(severityLabel('extreme')).toBe('Extreme');
    expect(severityLabel('NONE')).toBe('None');
    expect(severityLabel(undefined)).toBe('Unknown');
    expect(severityBadgeTone('EXTREME')).toBe('extreme');
    expect(severityBadgeTone('moderate')).toBe('moderate');
    expect(severityBadgeTone('nope')).toBe('info');
  });
});

describe('geometryCenter', () => {
  it('computes the bbox centre of a Polygon (GeoJSON lng/lat order)', () => {
    const center = geometryCenter({
      type: 'Polygon',
      coordinates: [
        [
          [-97, 32],
          [-96, 32],
          [-96, 34],
          [-97, 34],
          [-97, 32],
        ],
      ],
    });
    expect(center).toEqual({ lat: 33, lng: -96.5 });
  });

  it('handles MultiPolygon and Point geometries', () => {
    const multi = geometryCenter({
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [-97, 32],
            [-96, 32],
            [-96, 33],
            [-97, 33],
            [-97, 32],
          ],
        ],
        [
          [
            [-95, 35],
            [-94, 35],
            [-94, 36],
            [-95, 36],
            [-95, 35],
          ],
        ],
      ],
    });
    expect(multi).toEqual({ lat: 34, lng: -95.5 });
    expect(geometryCenter({ type: 'Point', coordinates: [-96.75, 33.05] })).toEqual({
      lat: 33.05,
      lng: -96.75,
    });
  });

  it('returns null when geometry is missing or unusable', () => {
    expect(geometryCenter(undefined)).toBeNull();
    expect(geometryCenter(null)).toBeNull();
    expect(geometryCenter({ type: 'Polygon' })).toBeNull();
    expect(geometryCenter({ type: 'Polygon', coordinates: [] })).toBeNull();
    expect(geometryCenter({ type: 'Point', coordinates: [200, 100] })).toBeNull();
  });
});

describe('leadCoordinatesFromPayload', () => {
  it('reads coordinates from direct and wrapped lead payloads', () => {
    expect(leadCoordinatesFromPayload({ propertyLatLng: { lat: 33.05, lng: -96.75 } })).toEqual({
      lat: 33.05,
      lng: -96.75,
    });
    expect(
      leadCoordinatesFromPayload({ data: { propertyLatLng: { lat: 33.05, lon: -96.75 } } })
    ).toEqual({ lat: 33.05, lng: -96.75 });
  });

  it('returns null for missing or invalid coordinates', () => {
    expect(leadCoordinatesFromPayload(null)).toBeNull();
    expect(leadCoordinatesFromPayload({})).toBeNull();
    expect(leadCoordinatesFromPayload({ propertyLatLng: { lat: 200, lng: 0 } })).toBeNull();
    expect(leadCoordinatesFromPayload({ propertyLatLng: { lat: 'x', lng: 'y' } })).toBeNull();
  });
});

describe('copilot plan → map wiring', () => {
  it('filters storm intelligence events by severity and event type', () => {
    const events = [
      event({ id: 'a', severity: 'SEVERE', eventType: 'TORNADO' }),
      event({ id: 'b', severity: 'MINOR', eventType: 'FLASH_FLOOD' }),
      event({ id: 'c', severity: 'EXTREME', eventType: 'TORNADO' }),
    ];
    expect(filterStormEvents(events, { severity: ['SEVERE', 'EXTREME'] }).map((e) => e.id)).toEqual([
      'a',
      'c',
    ]);
    expect(filterStormEvents(events, { eventTypes: ['TORNADO'] }).map((e) => e.id)).toEqual([
      'a',
      'c',
    ]);
    expect(filterStormEvents(events, undefined)).toHaveLength(3);
    expect(filterStormEvents(null, { severity: ['EXTREME'] })).toEqual([]);
  });

  it('filters the legacy NOAA active-storm list with mixed casing', () => {
    const storms = [
      { id: '1', type: 'Tornado Warning', severity: 'Extreme' },
      { id: '2', type: 'Flash Flood Warning', severity: 'Moderate' },
      { id: '3', type: 'Severe Thunderstorm Warning', severity: 'Severe' },
    ];
    expect(filterActiveStorms(storms, { severity: ['SEVERE'] }).map((s) => s.id)).toEqual(['3']);
    expect(filterActiveStorms(storms, { severity: ['EXTREME'] }).map((s) => s.id)).toEqual(['1']);
    expect(filterActiveStorms(storms, { eventTypes: ['FLASH_FLOOD'] }).map((s) => s.id)).toEqual([
      '2',
    ]);
    expect(filterActiveStorms(storms, undefined)).toHaveLength(3);
  });

  it('derives overlay visibility from the plan overlay list', () => {
    expect(overlayVisibilityFromPlan(plan({ overlays: ['alerts', 'radar'] }))).toEqual({
      alertPolygons: true,
      stormOutlines: false,
      radar: true,
    });
    expect(overlayVisibilityFromPlan(plan())).toEqual({});
    expect(overlayVisibilityFromPlan(null)).toEqual({});
  });

  it('clamps plan focus into valid Leaflet bounds', () => {
    expect(planFocus(plan({ center: { lat: 33.05, lng: -96.75 }, zoom: 99 }))).toEqual({
      center: { lat: 33.05, lng: -96.75 },
      zoom: 15,
    });
    expect(planFocus(plan({ center: { lat: 33.05, lng: -96.75 }, zoom: 1 }))?.zoom).toBe(3);
    expect(planFocus(plan({ zoom: 8 }))).toBeNull();
    expect(planFocus(plan({ center: { lat: 200, lng: 0 } }))).toBeNull();
    expect(planFocus(null)).toBeNull();
  });

  it('builds readable chips for the active plan', () => {
    const chips = buildPlanChips(
      plan({
        filters: { severity: ['SEVERE', 'EXTREME'], eventTypes: ['TORNADO'] },
        overlays: ['alerts', 'stormEvents'],
        center: { lat: 33.05, lng: -96.75 },
        zoom: 8,
        highlightLeadIds: ['lead-1', 'lead-2'],
        matchedStormIds: ['evt-1'],
      })
    );
    expect(chips.map((c) => c.kind)).toEqual([
      'severity',
      'eventType',
      'overlay',
      'focus',
      'leads',
      'storms',
    ]);
    expect(chips[0].label).toContain('SEVERE');
    expect(chips[2].label).toContain('Alert polygons');
    expect(chips[4].label).toContain('2 leads highlighted');
    expect(buildPlanChips(null)).toEqual([]);
  });
});

describe('lead impact view-models', () => {
  const insight: LeadInsightResponse = {
    leadId: 'lead-1',
    score: 86,
    severity: 'EXTREME',
    drivers: [
      { label: 'Inside warning polygon', weight: 100 },
      { label: 'Roof age > 15 years', weight: 42 },
    ],
    explanation: 'This property sits inside the tornado warning polygon.',
    nextBestAction: 'Call the homeowner within 24 hours.',
    recommendedStatus: 'CONTACTED',
    talkTrack: 'We noticed a tornado warning crossed your neighborhood…',
    riskFlags: ['Active lightning', ''],
    source: 'heuristic',
    latencyMs: 4,
    generatedAt: '2026-11-16T21:00:00.000Z',
  };

  it('normalises a lead-insights response and flags the offline engine', () => {
    const view = leadInsightToView(insight);
    expect(view.score).toBe(86);
    expect(view.severityText).toBe('Extreme');
    expect(view.risk.tone).toBe('extreme');
    expect(view.sourceLabel).toBe('Offline engine');
    expect(view.deterministic).toBe(true);
    expect(view.riskFlags).toEqual(['Active lightning']);
    expect(view.drivers[1]).toEqual({ label: 'Roof age > 15 years', weight: 42 });
    expect(view.nextBestAction).toContain('Call the homeowner');
  });

  it('normalises deterministic impact results', () => {
    const impact: ImpactResult = {
      score: 61,
      severity: 'MODERATE',
      drivers: [{ label: 'Distance to hail swath', weight: 61 }],
      nearbyEvents: [{ id: 'e1', name: 'Hail swath', severity: 'SEVERE', distanceKm: 12.4 }],
      recommendations: ['Schedule an inspection within 48 hours.'],
    };
    const view = impactToView(impact);
    expect(view.score).toBe(61);
    expect(view.severityText).toBe('Moderate');
    expect(view.sourceLabel).toBe('Deterministic engine');
    expect(view.nearbyEvents[0]).toMatchObject({ id: 'e1', distanceKm: 12.4 });
    expect(view.recommendations).toEqual(['Schedule an inspection within 48 hours.']);
  });
});

describe('provider + source labels', () => {
  it('labels AI source with provider model or offline engine', () => {
    expect(aiSourceLabel('llm', 'llama-3.3-70b-versatile')).toBe('AI · llama-3.3-70b-versatile');
    expect(aiSourceLabel('llm', undefined)).toBe('AI · managed provider');
    expect(aiSourceLabel('heuristic', 'ignored')).toBe('Offline engine');
    expect(aiSourceLabel('llm', 'x', true)).toBe('Offline engine');
  });

  it('normalises provider health strings into tone + text', () => {
    expect(providerHealthView({ status: 'healthy', latencyMs: 210 }).tone).toBe('healthy');
    expect(providerHealthView({ status: 'HEALTHY' }).label).toBe('Healthy');
    expect(providerHealthView({ status: 'degraded' }).tone).toBe('degraded');
    expect(providerHealthView({ status: 'boom' }).tone).toBe('unknown');
    expect(providerHealthView(null, false)).toMatchObject({ tone: 'unconfigured' });
  });
});
