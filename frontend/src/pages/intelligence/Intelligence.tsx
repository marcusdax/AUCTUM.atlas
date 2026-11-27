/**
 * Intelligence Fusion — Live Cross-Source Customer Opportunity & Storm Verification Engine
 * Turns NWS alerts, NEXRAD radar swaths, H3 hex coverage, and CRM Leads/Jobs into
 * concrete homeowner verification briefs and canvassing actions.
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Brain,
  CheckCircle2,
  Compass,
  Download,
  MapPin,
  RefreshCw,
  Satellite,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Signal } from '../../components/primitives/Signal';
import { Metric } from '../../components/primitives/Metric';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';
import { aiApi } from '../../services/ai';
import type { ImpactResult } from '../../types/ai';
import type { WeatherAlert } from '../../types';

const PRESET_ZONES = [
  { label: 'Plano / Frisco, TX', lat: 33.05, lng: -96.75 },
  { label: 'Dallas Love Field, TX', lat: 32.847, lng: -96.851 },
  { label: 'Moore / Norman, OK', lat: 35.339, lng: -97.486 },
  { label: 'Fort Worth West, TX', lat: 32.755, lng: -97.33 },
];

const IntelligencePage: React.FC = () => {
  const qc = useQueryClient();
  const [latInput, setLatInput] = useState('33.0500');
  const [lngInput, setLngInput] = useState('-96.7500');
  const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);
  const [checkedPoint, setCheckedPoint] = useState<{ lat: number; lng: number } | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['fusion', 'overview'],
    queryFn: () => aiApi.stormOverview(14),
    staleTime: 30_000,
  });

  const alertsQuery = useQuery({
    queryKey: ['fusion', 'weather-alerts'],
    queryFn: () =>
      api.get<{ alerts: WeatherAlert[]; total: number }>('/weather/alerts?limit=25').then((r) => r.data),
    staleTime: 30_000,
  });

  const aiStatusQuery = useQuery({
    queryKey: ['fusion', 'ai-status'],
    queryFn: () => aiApi.status(),
    staleTime: 60_000,
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post('/storm-intel/sync').then((r) => r.data),
    onSuccess: (data) => {
      toast.success(
        `Synced live NOAA feeds (${data?.synced ?? data?.created ?? 0} updates applied).`
      );
      qc.invalidateQueries({ queryKey: ['fusion'] });
      qc.invalidateQueries({ queryKey: ['storm-intel'] });
    },
    onError: () => toast.error('Could not sync NOAA feed right now.'),
  });

  const rescoreMutation = useMutation({
    mutationFn: () => aiApi.rescoreLeads(),
    onSuccess: (res) => {
      toast.success(`Rescored ${res.scored} CRM leads (${res.updated} impact scores updated).`);
      qc.invalidateQueries({ queryKey: ['fusion'] });
    },
    onError: () => toast.error('Lead rescore failed.'),
  });

  const impactMutation = useMutation({
    mutationFn: ({ lat, lng }: { lat: number; lng: number }) => aiApi.impact(lat, lng),
    onSuccess: (result, vars) => {
      setImpactResult(result);
      setCheckedPoint(vars);
    },
    onError: () => toast.error('Could not score coordinates — verify lat/lng range.'),
  });

  const convertMutation = useMutation({
    mutationFn: ({ lat, lng, label }: { lat: number; lng: number; label?: string }) =>
      aiApi.convertMapToLeads({ lat, lng, radiusKm: 2.4, count: 15, label }),
    onSuccess: (res) => {
      toast.success(
        `Added ${res.created} canvass leads (${res.existing} existing leads rescored) in ${res.zone.name}.`
      );
      qc.invalidateQueries({ queryKey: ['fusion'] });
    },
    onError: () => toast.error('Lead conversion could not complete for this coordinate.'),
  });

  const events = overviewQuery.data?.events ?? [];
  const leads = overviewQuery.data?.leads ?? [];
  const stats = overviewQuery.data?.stats;
  const alerts = alertsQuery.data?.alerts ?? [];
  const configuredProviders = (aiStatusQuery.data?.providers ?? []).filter((p) => p.configured).length;

  const sortedLeads = useMemo(
    () => [...leads].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 8),
    [leads]
  );

  const runImpactCheck = (lat: number, lng: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error('Enter valid numeric latitude and longitude.');
      return;
    }
    setLatInput(lat.toFixed(4));
    setLngInput(lng.toFixed(4));
    impactMutation.mutate({ lat, lng });
  };

  const downloadVerificationBrief = () => {
    if (!impactResult || !checkedPoint) return;
    const lines = [
      'AUCTUM.atlas — Homeowner & Property Storm Verification Report',
      `Generated: ${new Date().toISOString()}`,
      `Coordinates: ${checkedPoint.lat.toFixed(5)}, ${checkedPoint.lng.toFixed(5)}`,
      `Deterministic Storm Impact Score: ${impactResult.score}/100 (${impactResult.severity})`,
      '',
      'Impact Drivers:',
      ...(impactResult.drivers.length > 0
        ? impactResult.drivers.map((d) => `- ${d.label} (weight ${d.weight})`)
        : ['- No active severe driver in radius']),
      '',
      'Nearby Tracked Storm Events:',
      ...(impactResult.nearbyEvents.length > 0
        ? impactResult.nearbyEvents.map(
            (ev) => `- ${ev.name} [${ev.severity}] (${ev.distanceKm.toFixed(1)} km)`
          )
        : ['- None within threshold']),
      '',
      'Recommended Field Next Steps:',
      ...impactResult.recommendations.map((rec) => `- ${rec}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storm-verification-${checkedPoint.lat.toFixed(3)}_${checkedPoint.lng.toFixed(3)}.txt`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="h-full space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
            <Brain size={28} className="text-violet" />
            Intelligence Fusion
          </h1>
          <p className="text-text-secondary mt-1">
            Cross-source storm correlation &amp; customer verification workspace (NOAA + H3 Swaths + CRM Leads)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw size={15} className={syncMutation.isPending ? 'animate-spin' : ''} />}
            onClick={() => syncMutation.mutate()}
            isLoading={syncMutation.isPending}
          >
            Sync Live NOAA
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Sparkles size={15} />}
            onClick={() => rescoreMutation.mutate()}
            isLoading={rescoreMutation.isPending}
          >
            Rescore All Leads
          </Button>
          <Link
            to="/storm-tracking"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-[hsl(var(--background-accent))]"
          >
            <Compass size={14} />
            3D Storm Map
          </Link>
          <Signal
            label="Fusion Engine"
            status="ONLINE"
            color="violet"
            pulse
            strength={5}
            type="ai"
            description="Live NOAA + CRM fusion"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          title="TRACKED SWATH EVENTS"
          value={stats?.activeEvents ?? events.length}
          state="LIVE"
          pulse
          hint={`${alerts.length} raw NWS alerts fetched`}
        />
        <Metric
          title="LEADS IN IMPACT ZONE"
          value={stats?.leadsInImpact ?? leads.length}
          state="LIVE"
          hint="Matched against active polygons"
        />
        <Metric
          title="JOBS IN IMPACT ZONE"
          value={stats?.jobsInImpact ?? 0}
          state="LIVE"
          hint="Active jobs exposed to recent weather"
        />
        <Metric
          title="AI & DETERMINISTIC ENGINES"
          value={configuredProviders > 0 ? `${configuredProviders} BYOK + Local` : 'Local Fallback'}
          state="LIVE"
          hint="Deterministic scoring always online"
        />
      </div>

      {/* Interactive Homeowner Storm Verification Tool */}
      <Card
        title="Homeowner Storm Impact Verification Tool"
        subtitle="Check exact storm exposure for any property coordinate, generate a homeowner-ready verification sheet, or spin up a 1.5 mi canvass zone"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Latitude
              </label>
              <input
                type="text"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                className="input w-36 font-mono text-sm"
                placeholder="33.0500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Longitude
              </label>
              <input
                type="text"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                className="input w-36 font-mono text-sm"
                placeholder="-96.7500"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Search size={14} />}
              isLoading={impactMutation.isPending}
              onClick={() => runImpactCheck(Number(latInput), Number(lngInput))}
            >
              Score Property Impact
            </Button>
            {checkedPoint && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Users size={14} />}
                  isLoading={convertMutation.isPending}
                  onClick={() =>
                    convertMutation.mutate({
                      lat: checkedPoint.lat,
                      lng: checkedPoint.lng,
                      label: `Canvass Zone (${checkedPoint.lat.toFixed(2)}, ${checkedPoint.lng.toFixed(2)})`,
                    })
                  }
                >
                  Emit 1.5 mi Canvass Leads
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Download size={14} />}
                  onClick={downloadVerificationBrief}
                >
                  Download Homeowner Brief
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-text-tertiary">Quick verify:</span>
            {PRESET_ZONES.map((z) => (
              <button
                key={z.label}
                type="button"
                onClick={() => runImpactCheck(z.lat, z.lng)}
                className="rounded border border-border bg-[hsl(var(--background-elevated))] px-2.5 py-1 text-text-secondary hover:text-text-primary"
              >
                {z.label}
              </button>
            ))}
          </div>

          {impactResult && (
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase text-text-tertiary">Deterministic Impact Score</p>
                <p className="mt-1 text-3xl font-bold text-text-primary">
                  {impactResult.score}
                  <span className="text-sm font-normal text-text-tertiary"> / 100</span>
                </p>
                <p className="mt-1 text-xs font-medium text-emerald">{impactResult.severity}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-text-tertiary mb-1">Nearby Matched Swaths</p>
                {impactResult.nearbyEvents.length === 0 ? (
                  <p className="text-xs text-text-secondary">No tracked storms within 25 km.</p>
                ) : (
                  <ul className="space-y-1 text-xs text-text-primary">
                    {impactResult.nearbyEvents.slice(0, 3).map((ev) => (
                      <li key={ev.id}>
                        <span className="font-medium">{ev.name}</span> · {ev.severity} ·{' '}
                        {ev.distanceKm.toFixed(1)} km
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs uppercase text-text-tertiary mb-1">Customer Next Steps</p>
                <ul className="space-y-1 text-xs text-text-secondary">
                  {impactResult.recommendations.slice(0, 3).map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Correlated Storm Swaths & Revenue Opportunity"
          subtitle="Live database swaths paired with matched CRM leads and jobs"
        >
          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-4 text-sm text-text-secondary">
                No storm swaths matched yet. Click <strong>Sync Live NOAA</strong> above to ingest active NWS polygons.
              </div>
            ) : (
              events.slice(0, 8).map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-3"
                >
                  <div>
                    <p className="font-medium text-text-primary">{ev.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {ev.area || 'Tracked Swath'} · {ev.leadCount} leads · {ev.jobCount} jobs · {ev.source}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-amber/10 px-2 py-0.5 text-xs font-medium text-amber">
                      {ev.severity}
                    </span>
                    <Link
                      to="/storm-tracking"
                      className="rounded border border-border px-2.5 py-1 text-xs text-text-primary hover:bg-[hsl(var(--background-accent))]"
                    >
                      Map
                    </Link>
                    <Link
                      to="/intelligence/helios"
                      className="rounded border border-border px-2.5 py-1 text-xs text-text-primary hover:bg-[hsl(var(--background-accent))]"
                    >
                      Brief
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card
          title="Highest-Priority Customer Leads (Live Impact Score)"
          subtitle="Click Score to inspect homeowner verification or jump straight to lead profile"
        >
          <div className="space-y-3">
            {sortedLeads.length === 0 ? (
              <div className="rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-4 text-sm text-text-secondary">
                No geocoded CRM leads yet. Use the Property Verification Tool above to create a 1.5 mi canvass zone.
              </div>
            ) : (
              sortedLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary truncate">{lead.name}</p>
                    <p className="text-xs text-text-tertiary flex items-center gap-1 truncate">
                      <MapPin size={12} /> {lead.address}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-emerald/10 px-2 py-0.5 font-mono text-xs font-semibold text-emerald">
                      Score {lead.score}
                    </span>
                    <button
                      type="button"
                      onClick={() => runImpactCheck(lead.lat, lead.lng)}
                      className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                    >
                      Verify
                    </button>
                    <Link
                      to={`/leads/${lead.id}`}
                      className="rounded border border-border px-2 py-1 text-xs text-text-primary hover:bg-[hsl(var(--background-accent))]"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-4 text-xs text-text-secondary">
        <span>
          <strong>Connected Customer Modules:</strong> Swath Detection &amp; 3D Buildings ({' '}
          <Link to="/intelligence/atlas" className="underline text-text-primary">Atlas Intelligence</Link> ) · Adjuster
          Briefs ({' '}
          <Link to="/intelligence/helios" className="underline text-text-primary">Helios Copilot</Link> ) · SHA-256
          Chain &amp; Unit Economics ({' '}
          <Link to="/reports?tab=revenue-model" className="underline text-text-primary">36M P&amp;L Model</Link> )
        </span>
        <Link to="/field" className="inline-flex items-center gap-1 font-medium text-text-primary underline">
          <Satellite size={13} /> Open Field Hub
        </Link>
      </div>
    </div>
  );
};

export default IntelligencePage;
