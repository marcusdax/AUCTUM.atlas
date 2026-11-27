/**
 * Atlas Intelligence Page — Storm detection, live spatial map & tracking model toggles
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Satellite, MapPin, AlertTriangle, Radio, Map as MapIcon } from 'lucide-react';
import { Signal } from '../../components/primitives/Signal';
import { Metric } from '../../components/primitives/Metric';
import { Card } from '../../components/ui/Card';
import StormMap from '../../components/StormMap';
import StormLayerToggles from '../../components/intelligence/StormLayerToggles';
import MapToLeadsDemoPanel from '../../components/intelligence/MapToLeadsDemoPanel';
import { api } from '../../services/api';
import { aiApi } from '../../services/ai';
import { useMapLayersStore } from '../../stores/mapLayersStore';
import type { StormEvent, ListResponse } from '../../types';

const AtlasIntelligencePage: React.FC = () => {
  const { detectionLayers, trackingAlgos } = useMapLayersStore();
  const activeLayerCount = Object.values(detectionLayers).filter(Boolean).length;
  const activeAlgoCount = Object.values(trackingAlgos).filter(Boolean).length;

  const { data: stormsRes } = useQuery({
    queryKey: ['atlas', 'storm-events'],
    queryFn: () =>
      api.get('/storms/events').then((r) => {
        const body = r.data as { events?: StormEvent[]; data?: StormEvent[]; count?: number };
        return { data: body.events ?? body.data ?? [], count: body.count ?? 0 };
      }),
    placeholderData: { data: [], count: 0 },
    staleTime: 60_000,
    retry: 1,
  });

  const { data: overview } = useQuery({
    queryKey: ['storm-intel', 'overview', 7],
    queryFn: () => aiApi.stormOverview(7),
    staleTime: 60_000,
    retry: 1,
  });

  const stormEvents = stormsRes?.data ?? [];
  const overviewEvents = overview?.events ?? [];

  return (
    <div className="h-full space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
            <Satellite size={28} className="text-cyan" aria-hidden="true" />
            Atlas Intelligence
          </h1>
          <p className="text-text-secondary mt-1">
            Storm detection, tracking &amp; radar intelligence — synced with Command Center &amp; Field Hub
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/command"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--background-elevated))] border border-border text-xs font-medium text-text-primary hover:bg-[hsl(var(--background-accent))]"
          >
            <Radio size={14} aria-hidden="true" />
            Command Center
          </Link>
          <Link
            to="/field"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--background-elevated))] border border-border text-xs font-medium text-text-primary hover:bg-[hsl(var(--background-accent))]"
          >
            <MapIcon size={14} aria-hidden="true" />
            Field Hub
          </Link>
          <Signal
            label="Atlas Core"
            status="ONLINE"
            color="cyan"
            pulse
            strength={5}
            type="data"
            description="Storm detection & tracking"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          title="ACTIVE STORMS"
          value={stormEvents.length || overviewEvents.length || 3}
          state="LIVE"
          pulse
          hint="Tracking across CONUS"
        />
        <Metric
          title="DETECTION LAYERS"
          value={`${activeLayerCount}/5 ON`}
          state="LIVE"
          hint="NEXRAD · SPC · GOES · Lightning · LSR"
        />
        <Metric
          title="TRACKING MODELS"
          value={`${activeAlgoCount}/5 ON`}
          state="LIVE"
          hint="TITAN · TVS · Hail · Wind · Flood"
        />
        <Metric
          title="3D + RANGE RINGS"
          value="0.5 / 1.0 / 1.5 mi"
          state="LIVE"
          hint="Extruded footprints + micro-zones"
        />
      </div>

      <MapToLeadsDemoPanel
        selectedEvent={overviewEvents[0] ?? null}
        activeEventsCount={overviewEvents.length || stormEvents.length}
        leadsInImpactCount={overview?.stats?.leadsInImpact ?? overview?.leads?.length ?? 0}
      />

      <Card
        title="Live Atlas Spatial Map"
        subtitle="Toggle Storm Detection Layers, 3D building footprints & 0.5/1.0/1.5 mi range rings to target properties"
      >
        <div className="h-[460px] w-full rounded-lg overflow-hidden border border-border">
          <StormMap
            storms={stormEvents}
            stormEvents={overviewEvents}
            selectedLocation={{ lat: 33.05, lng: -96.75 }}
            height="100%"
          />
        </div>
      </Card>

      <StormLayerToggles />

      <Card title="Recent Storm Events" subtitle="Persisted storm swaths & alerts ready for lead outreach">
        <div className="space-y-3">
          {stormEvents.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-4 text-sm text-text-secondary">
              <span>No storm events ingested yet. Open Intelligence Fusion to sync live NOAA alerts.</span>
              <Link to="/intelligence" className="font-medium underline text-text-primary">
                Open Intelligence Fusion &rarr;
              </Link>
            </div>
          ) : (
            stormEvents.slice(0, 6).map((ev) => ({
              id: ev.id,
              name: ev.name,
              severity: String(ev.severity).toUpperCase(),
              time: ev.startDate ? new Date(ev.startDate).toLocaleDateString() : 'Active',
              detail: ev.description || ev.eventType?.replace(/_/g, ' ') || 'Storm swath',
            })).map((event) => (
            <Link
              key={event.id}
              to="/storm-tracking"
              className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-[hsl(var(--background-elevated))] border border-border hover:bg-[hsl(var(--background-accent))] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-lg ${
                    event.severity === 'EXTREME'
                      ? 'bg-red/10 text-red'
                      : event.severity === 'SEVERE'
                        ? 'bg-orange/10 text-orange'
                        : 'bg-amber/10 text-amber'
                  }`}
                >
                  <AlertTriangle size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-text-primary">{event.name}</p>
                  <p className="text-sm text-text-secondary">{event.detail}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span
                  className={`font-medium px-2 py-0.5 rounded ${
                    event.severity === 'EXTREME'
                      ? 'bg-red/10 text-red'
                      : event.severity === 'SEVERE'
                        ? 'bg-orange/10 text-orange'
                        : 'bg-amber/10 text-amber'
                  }`}
                >
                  {event.severity}
                </span>
                <span className="text-text-tertiary flex items-center gap-1">
                  <MapPin size={14} aria-hidden="true" /> {event.time}
                </span>
                <span className="text-xs font-mono text-text-primary underline">Inspect &rarr;</span>
              </div>
            </Link>
          ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default AtlasIntelligencePage;
