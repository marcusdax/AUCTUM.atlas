/**
 * Storm Intelligence page — upgraded from the legacy Storm Tracking page.
 *
 * Preserves the live Active Storms list + weather detail popover, and adds:
 *  - AI Storm Intelligence Brief (StormBriefCard)
 *  - AI Map Copilot → validated map plan wiring (filters, focus, overlays, lead highlights)
 *  - Lead Storm Impact panel for a selected lead (deep-link) or clicked map point
 *  - Storm-intel event outlines from GET /storm-intel/overview on the map
 *  - AI-offline graceful mode (status endpoint unreachable ⇒ panels show "AI offline")
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Layers, RefreshCw, WifiOff, X } from 'lucide-react';
import { api } from '../services/api';
import { aiApi } from '../services/ai';
import StormMap from '../components/StormMap';
import Button from '../components/ui/Button';
import Card, { Badge, type BadgeVariant } from '../components/ui/Card';
import StormBriefCard from '../components/ai/StormBriefCard';
import MapCopilot from '../components/ai/MapCopilot';
import LeadImpactCard from '../components/ai/LeadImpactCard';
import MapToLeadsDemoPanel from '../components/intelligence/MapToLeadsDemoPanel';
import StormLayerToggles from '../components/intelligence/StormLayerToggles';
import {
  filterActiveStorms,
  filterStormEvents,
  formatLatLng,
  geometryCenter,
  overlayVisibilityFromPlan,
  planFocus,
  severityBadgeTone,
  severityLabel,
} from '../components/ai/aiUtils';
import type { MapCopilotPlan, StormEventSummary } from '../types/ai';

/** Severity → Badge variant (uses the design-system severity colors). */
const SEVERITY_VARIANT: Record<string, BadgeVariant> = {
  Extreme: 'extreme',
  Severe: 'severe',
  Moderate: 'moderate',
  Minor: 'minor',
  Unknown: 'info',
};

/** Severity → Tailwind border-l color for storm list items */
const SEVERITY_BORDER: Record<string, string> = {
  Extreme: 'border-l-4 border-severity-extreme',
  Severe: 'border-l-4 border-severity-severe',
  Moderate: 'border-l-4 border-severity-moderate',
  Minor: 'border-l-4 border-severity-minor',
  Unknown: 'border-l-4 border-text-tertiary',
};

/** Severity → Tailwind dot color class. */
const SEVERITY_DOT: Record<string, string> = {
  Extreme: 'bg-severity-extreme',
  Severe: 'bg-severity-severe',
  Moderate: 'bg-severity-moderate',
  Minor: 'bg-severity-minor',
  Unknown: 'bg-text-tertiary',
};

/** Compact legend used in the header for at-a-glance severity reading. */
const SEVERITY_LEGEND = [
  { severity: 'Extreme', dot: 'bg-severity-extreme', label: 'Extreme' },
  { severity: 'Severe', dot: 'bg-severity-severe', label: 'Severe' },
  { severity: 'Moderate', dot: 'bg-severity-moderate', label: 'Moderate' },
  { severity: 'Minor', dot: 'bg-severity-minor', label: 'Minor' },
];

const US_CENTER = { lat: 39.8283, lng: -98.5795 };

const StormTracking: React.FC = () => {
  const [searchParams] = useSearchParams();
  const deepLinkLeadId = searchParams.get('leadId');

  // ── Map / weather state (preserved from the legacy page) ──────────────────
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lon: number;
    forecast?: Record<string, unknown>;
  } | null>(null);
  const [impactPoint, setImpactPoint] = useState<{ lat: number; lng: number } | null>(null);

  // ── Storm intelligence state ──────────────────────────────────────────────
  const [plan, setPlan] = useState<MapCopilotPlan | null>(null);
  const [focus, setFocus] = useState<{ center: { lat: number; lng: number }; zoom: number } | null>(
    null
  );
  const [selectedEvent, setSelectedEvent] = useState<StormEventSummary | null>(null);
  const [overlays, setOverlays] = useState({ alertPolygons: true, stormOutlines: true });

  // ── Data: legacy NOAA active alerts (preserved query key) ────────────────
  const {
    data: stormData,
    isLoading: stormsLoading,
    refetch: refetchStorms,
  } = useQuery({
    queryKey: ['storm-events'],
    queryFn: () => api.get('/storms/active').then((res) => res.data),
    refetchInterval: 60000,
  });

  // ── Data: storm intelligence overview (deterministic, no AI needed) ──────
  const {
    data: overview,
    isFetching: overviewFetching,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['storm-intel', 'overview', 7],
    queryFn: () => aiApi.stormOverview(7),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });

  // ── Data: AI status (drives the AI-online/offline presentation) ──────────
  const {
    data: aiStatus,
    isError: aiStatusError,
    isLoading: aiStatusLoading,
    refetch: refetchAiStatus,
  } = useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => aiApi.status(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });

  // Weather details when a location is selected on the map (preserved)
  const { data: weatherData } = useQuery({
    queryKey: ['weather', selectedLocation?.lat, selectedLocation?.lon],
    queryFn: () =>
      api
        .get(`/weather/severe?lat=${selectedLocation!.lat}&lon=${selectedLocation!.lon}`)
        .then((res) => res.data),
    enabled: Boolean(selectedLocation),
  });

  // Update selectedLocation with forecast data when weatherData changes
  const updatedLocation = weatherData
    ? { ...selectedLocation!, forecast: weatherData }
    : selectedLocation;

  const storms = stormData?.storms ?? [];
  const events: StormEventSummary[] = overview?.events ?? [];
  const aiOnline = !aiStatusError;
  const filters = plan?.filters;

  const visibleStorms = useMemo(() => filterActiveStorms(storms, filters), [storms, filters]);
  const visibleEvents = useMemo(() => filterStormEvents(events, filters), [events, filters]);

  const overlayVisibility = useMemo(
    () => ({ ...overlays, ...overlayVisibilityFromPlan(plan) }),
    [overlays, plan]
  );

  const planHasFilters = Boolean(filters?.severity?.length || filters?.eventTypes?.length);
  const planLeadId = plan?.highlightLeadIds?.[0] ?? null;
  // Map click wins over copilot highlight; an explicit ?leadId= deep link always wins.
  const activeLeadId = deepLinkLeadId ?? (impactPoint ? null : planLeadId);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setSelectedLocation({ lat, lon: lng });
    setImpactPoint({ lat, lng });
  }, []);

  const handleStormClick = useCallback(
    (storm: any) => {
      const coords = storm.geometry?.coordinates;
      const lat = coords?.[0]?.lat || coords?.[0]?.[1];
      const lon = coords?.[0]?.lon || coords?.[0]?.[0];
      if (lat != null && lon != null) {
        handleMapClick(lat, lon);
      }
    },
    [handleMapClick]
  );

  const handleStormEventClick = useCallback((event: StormEventSummary) => {
    setSelectedEvent(event);
    const center = geometryCenter(event.geometry);
    if (center) setFocus({ center, zoom: 8 });
  }, []);

  const handleApplyPlan = useCallback((next: MapCopilotPlan) => {
    setPlan(next);
    const target = planFocus(next);
    if (target) {
      setFocus({ center: target.center, zoom: target.zoom });
    } else if (next.intent === 'reset') {
      setFocus({ center: { ...US_CENTER }, zoom: 4 });
    }
  }, []);

  const handleClearPlan = useCallback(() => {
    setPlan(null);
  }, []);

  const refreshAll = () => {
    void refetchStorms();
    void refetchOverview();
    void refetchAiStatus();
  };

  const aiStatusLabel = aiStatusLoading
    ? 'Checking AI…'
    : aiStatusError
      ? 'AI offline'
      : aiStatus?.enabled === false
        ? 'AI gateway disabled'
        : 'AI online';
  // Count only providers with a key configured: the catalog lists every supported
  // provider, but "AI online · 7 providers" must not imply 7 usable keys.
  const aiConfiguredProviderCount =
    aiStatus?.providers?.filter((provider) => provider.enabled && provider.configured).length ?? 0;
  const aiStatusVariant: BadgeVariant = aiStatusLoading
    ? 'info'
    : aiStatusError
      ? 'warning'
      : aiStatus?.enabled === false
        ? 'warning'
        : 'success';

  return (
    <div className="space-y-4 pb-8">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Storm Intelligence</h1>
          <p className="text-text-tertiary">
            Live NOAA monitoring with an AI brief, map copilot and lead impact scoring.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={aiStatusVariant} size="sm" className="min-h-6">
            <span className="inline-flex items-center gap-1">
              {aiStatusError ? (
                <WifiOff size={12} aria-hidden="true" />
              ) : (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    aiStatusError || aiStatus?.enabled === false ? 'bg-amber' : 'bg-emerald'
                  }`}
                  aria-hidden="true"
                />
              )}
              {aiStatusLabel}
              {!aiStatusError && aiStatus?.enabled !== false
                ? aiConfiguredProviderCount > 0
                  ? ` · ${aiConfiguredProviderCount} provider${aiConfiguredProviderCount === 1 ? '' : 's'}`
                  : ' · offline engine'
                : ''}
            </span>
          </Badge>

          {/* Severity legend (desktop) */}
          <div
            className="flex flex-wrap items-center gap-2 text-xs text-text-secondary"
            aria-label="Severity legend"
          >
            {SEVERITY_LEGEND.map((item) => (
              <div key={item.severity} className="flex items-center gap-1.5">
                <span
                  className={`block h-2.5 w-2.5 shrink-0 rounded-full ${item.dot}`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <Button
            variant="secondary"
            size="md"
            leftIcon={
              <RefreshCw
                size={16}
                className={overviewFetching ? 'animate-spin' : undefined}
                aria-hidden="true"
              />
            }
            onClick={refreshAll}
            className="min-h-11 min-w-11"
            aria-label="Refresh storm data, map events and AI status"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ── AI panels: brief + lead impact ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <StormBriefCard
          className="xl:col-span-2"
          enabled={aiOnline}
          focus="leads"
          stormIds={visibleEvents.slice(0, 12).map((event) => event.id)}
        />
        <LeadImpactCard
          className="xl:col-span-1"
          enabled={aiOnline}
          leadId={activeLeadId}
          point={impactPoint}
          onClear={() => setImpactPoint(null)}
        />
      </div>

      {/* ── Interactive Map -> Intelligence -> Leads converter ── */}
      <MapToLeadsDemoPanel
        selectedEvent={selectedEvent}
        selectedPoint={impactPoint}
        activeEventsCount={visibleEvents.length}
        leadsInImpactCount={overview?.stats?.leadsInImpact ?? overview?.leads?.length ?? 0}
      />

      {/* ── Map workspace ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Sidebar: active storms + overlays */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          <Card
            title="Active Storms"
            subtitle={`${visibleStorms.length} active alert${visibleStorms.length !== 1 ? 's' : ''}${
              planHasFilters && storms.length !== visibleStorms.length
                ? ` · ${storms.length - visibleStorms.length} filtered`
                : ''
            }`}
            className="overflow-hidden"
          >
            {planHasFilters && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Active copilot filters">
                {filters?.severity?.map((severity) => (
                  <Badge key={`sev-${severity}`} variant="info" size="sm">
                    {severity}
                  </Badge>
                ))}
                {filters?.eventTypes?.map((eventType) => (
                  <Badge key={`evt-${eventType}`} variant="info" size="sm">
                    {eventType.replace(/_/g, ' ')}
                  </Badge>
                ))}
                <button
                  type="button"
                  onClick={handleClearPlan}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border px-2 text-xs text-text-secondary hover:border-border-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label="Clear copilot filters"
                >
                  <X size={12} aria-hidden="true" />
                  Clear
                </button>
              </div>
            )}

            {stormsLoading ? (
              <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading active storms">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-[hsl(var(--background-accent))]" />
                ))}
              </div>
            ) : visibleStorms.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-text-tertiary">
                  {storms.length === 0
                    ? 'No active storm alerts at this time.'
                    : 'No active alerts match the copilot filter.'}
                </p>
                {planHasFilters && (
                  <Button variant="secondary" size="sm" className="min-h-11" onClick={handleClearPlan}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {visibleStorms.map((storm: any) => {
                  const severity = storm.severity || 'Unknown';
                  const variant = SEVERITY_VARIANT[severity] ?? SEVERITY_VARIANT.Unknown;
                  const dotClass = SEVERITY_DOT[severity] ?? SEVERITY_DOT.Unknown;
                  const borderClass =
                    SEVERITY_BORDER[severity] ?? 'border-l-4 border-text-tertiary';
                  return (
                    <button
                      key={storm.id}
                      type="button"
                      className={`
                        relative flex min-h-11 w-full cursor-pointer flex-col rounded-lg border-l-4
                        border-border bg-[hsl(var(--background-card))] p-3 text-left
                        transition-colors hover:bg-[hsl(var(--background-accent))]
                        focus:outline-none focus:ring-2 focus:ring-primary
                        focus:ring-offset-2 focus:ring-offset-background
                        ${borderClass}
                        ${storm.isActive ? 'bg-[hsl(var(--background-card))]/50' : 'opacity-60'}
                      `}
                      onClick={() => handleStormClick(storm)}
                      aria-label={`${severity} storm alert: ${storm.headline || storm.type}${
                        storm.area ? `, ${storm.area}` : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`}
                            aria-hidden="true"
                          />
                          <Badge variant={variant} size="sm">
                            {severity}
                          </Badge>
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            storm.isActive ? 'text-emerald' : 'text-text-tertiary'
                          }`}
                        >
                          {storm.isActive ? 'Active' : 'Expired'}
                        </span>
                      </div>
                      <h4 className="mt-1 font-medium text-text-primary">
                        {storm.headline || storm.type}
                      </h4>
                      {storm.area && (
                        <p className="mt-1 text-xs text-text-tertiary">{storm.area}</p>
                      )}
                      {storm.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                          {storm.description}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Storm-intel events + overlay toggles */}
          <Card title="Map Layers" subtitle={`${visibleEvents.length} storm event${visibleEvents.length === 1 ? '' : 's'}`}>
            <div className="space-y-2">
              <OverlayToggle
                label="Alert polygons"
                description="NOAA warning shapes"
                pressed={overlays.alertPolygons}
                onToggle={() =>
                  setOverlays((prev) => ({ ...prev, alertPolygons: !prev.alertPolygons }))
                }
              />
              <OverlayToggle
                label="Storm outlines"
                description="Clustered storm intelligence events"
                pressed={overlays.stormOutlines}
                onToggle={() =>
                  setOverlays((prev) => ({ ...prev, stormOutlines: !prev.stormOutlines }))
                }
              />
            </div>

            {selectedEvent ? (
              <div className="mt-3 rounded-lg border border-border bg-[hsl(var(--background-accent))]/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium text-text-primary">{selectedEvent.name}</h4>
                  <Badge variant={severityBadgeTone(selectedEvent.severity)} size="sm">
                    {severityLabel(selectedEvent.severity)}
                  </Badge>
                </div>
                {selectedEvent.area && (
                  <p className="mt-1 text-xs text-text-tertiary">{selectedEvent.area}</p>
                )}
                <p className="mt-1 text-xs text-text-secondary">
                  {selectedEvent.leadCount ?? 0} lead
                  {(selectedEvent.leadCount ?? 0) === 1 ? '' : 's'} ·{' '}
                  {selectedEvent.jobCount ?? 0} job
                  {(selectedEvent.jobCount ?? 0) === 1 ? '' : 's'} in impact
                </p>
                {!geometryCenter(selectedEvent.geometry) && (
                  <p className="mt-1 text-xs text-text-tertiary">
                    No polygon geometry for this event — listed for context only.
                  </p>
                )}
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    leftIcon={<X size={14} />}
                    onClick={() => setSelectedEvent(null)}
                  >
                    Clear selection
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-text-tertiary">
                <Layers size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                Click a storm outline on the map to inspect its lead and job impact.
              </p>
            )}
          </Card>
        </div>

        {/* Map + copilot */}
        <div className="flex flex-col gap-3 lg:col-span-3">
          <MapCopilot
            enabled={aiOnline}
            view={
              selectedLocation
                ? { center: { lat: selectedLocation.lat, lng: selectedLocation.lon }, zoom: 9 }
                : null
            }
            activePlan={plan}
            onApplyPlan={handleApplyPlan}
            onClearPlan={handleClearPlan}
          />

          {/* Applied plan summary (also kept visible outside the copilot panel) */}
          {plan?.center && (
            <p className="text-xs text-text-tertiary" aria-live="polite">
              Map focused on {formatLatLng(plan.center.lat, plan.center.lng)} · zoom{' '}
              {planFocus(plan)?.zoom ?? '—'}
            </p>
          )}

          <div className="h-[520px] overflow-hidden rounded-xl border border-border lg:h-[600px]">
            <StormMap
              storms={visibleStorms}
              stormEvents={visibleEvents}
              onStormEventClick={handleStormEventClick}
              highlightLeadIds={plan?.highlightLeadIds}
              focus={focus}
              overlayVisibility={overlayVisibility}
              onMapClick={handleMapClick}
              selectedLocation={updatedLocation}
              height="100%"
            />
          </div>
        </div>
      </div>

      {/* ── Canonical Command Map Overlays & Tracking Algorithms ── */}
      <StormLayerToggles />

      {/* Weather Details Panel (preserved) */}
      {selectedLocation && weatherData && (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-xs sm:max-w-sm">
          <Card
            title="Weather Details"
            subtitle={
              weatherData.location?.city ||
              `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lon.toFixed(4)}`
            }
          >
            <div className="space-y-2 text-sm">
              {weatherData.hasAlerts && (
                <div className="flex items-center gap-2 text-destructive">
                  <Badge variant="danger" size="sm">
                    {weatherData.alertCount} Active Alert{weatherData.alertCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
              )}
              {weatherData.forecast?.periods && (
                <div className="text-xs text-text-secondary">
                  {weatherData.forecast.periods[0]?.shortForecast || 'No forecast available'}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// ── Small overlay toggle used by the Map Layers card ─────────────────────────
interface OverlayToggleProps {
  label: string;
  description: string;
  pressed: boolean;
  onToggle: () => void;
}

const OverlayToggle: React.FC<OverlayToggleProps> = ({
  label,
  description,
  pressed,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={pressed}
    aria-label={`${label}: ${pressed ? 'shown' : 'hidden'}`}
    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  >
    <span>
      <span className="block text-sm font-medium text-text-primary">{label}</span>
      <span className="block text-xs text-text-tertiary">{description}</span>
    </span>
    <span
      className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        pressed ? 'bg-primary' : 'bg-[hsl(var(--border))]'
      }`}
      aria-hidden="true"
    >
      <span
        className={`h-4 w-4 rounded-full bg-white transition-transform ${
          pressed ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </span>
  </button>
);

export default StormTracking;
