/**
 * Intelligence Fusion — Live Cross-Source Customer Opportunity, Storm Verification
 * & NHESS/CLIMADA Roof Underwriting Engine
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
  ShieldAlert,
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

type RoofMaterial = 'three_tab_asphalt' | 'architectural_shingle' | 'metal_class4';

interface UnderwriteResponse {
  hailInches: number;
  hailMm: number;
  windMph: number;
  roofType: RoofMaterial;
  terminalVelocityMs: number;
  singleImpactEnergyJ: number;
  effectiveEnergyJ: number;
  materialThresholdMm: number;
  damageRatioBand: { p10: number; p50: number; p90: number };
  supplementReadiness: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  recommendedActions: string[];
  methodology: string;
  siteImpact: ImpactResult | null;
}

const PRESET_ZONES = [
  { label: 'Plano / Frisco, TX', lat: 33.05, lng: -96.75 },
  { label: 'Dallas Love Field, TX', lat: 32.847, lng: -96.851 },
  { label: 'Moore / Norman, OK', lat: 35.339, lng: -97.486 },
  { label: 'Fort Worth West, TX', lat: 32.755, lng: -97.33 },
];

const ROOF_OPTIONS: Array<{ value: RoofMaterial; label: string }> = [
  { value: 'three_tab_asphalt', label: 'Standard 3-Tab Asphalt' },
  { value: 'architectural_shingle', label: 'Architectural Laminated Shingle' },
  { value: 'metal_class4', label: 'Standing-Seam Metal / Class 4' },
];

const IntelligencePage: React.FC = () => {
  const qc = useQueryClient();
  const [latInput, setLatInput] = useState('33.0500');
  const [lngInput, setLngInput] = useState('-96.7500');
  const [hailInches, setHailInches] = useState(1.5);
  const [windMph, setWindMph] = useState(52);
  const [roofType, setRoofType] = useState<RoofMaterial>('architectural_shingle');
  const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);
  const [underwriteResult, setUnderwriteResult] = useState<UnderwriteResponse | null>(null);
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

  const underwriteMutation = useMutation({
    mutationFn: ({
      lat,
      lng,
      hail,
      wind,
      roof,
    }: {
      lat: number;
      lng: number;
      hail: number;
      wind: number;
      roof: RoofMaterial;
    }) =>
      api
        .get<UnderwriteResponse>('/storm-intel/underwrite', {
          params: { lat, lng, hailInches: hail, windMph: wind, roofType: roof },
        })
        .then((r) => r.data),
    onSuccess: (result, vars) => {
      setUnderwriteResult(result);
      if (result.siteImpact) {
        setImpactResult(result.siteImpact);
      }
      setCheckedPoint({ lat: vars.lat, lng: vars.lng });
    },
    onError: () => toast.error('Could not run property underwriting check — verify numeric inputs.'),
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

  const runVerification = (lat: number, lng: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error('Enter valid numeric latitude and longitude.');
      return;
    }
    setLatInput(lat.toFixed(4));
    setLngInput(lng.toFixed(4));
    underwriteMutation.mutate({ lat, lng, hail: hailInches, wind: windMph, roof: roofType });
  };

  const downloadUnderwritingDossier = () => {
    if (!underwriteResult || !checkedPoint) return;
    const u = underwriteResult;
    const impact = impactResult ?? u.siteImpact;
    const lines = [
      '# AUCTUM.atlas — Property Storm & Hail Underwriting Dossier',
      `Generated: ${new Date().toISOString()}`,
      `Coordinates: ${checkedPoint.lat.toFixed(5)}, ${checkedPoint.lng.toFixed(5)}`,
      '',
      '## Physical Hail Impact & Roof Vulnerability (NHESS / CLIMADA Methodology)',
      `- Hail Diameter: ${u.hailInches}" (${u.hailMm} mm)`,
      `- Sustained / Oblique Wind Speed: ${u.windMph} mph`,
      `- Roof System Evaluated: ${ROOF_OPTIONS.find((o) => o.value === u.roofType)?.label ?? u.roofType}`,
      `- Vertical Terminal Velocity (vt): ${u.terminalVelocityMs} m/s`,
      `- Vertical Kinetic Energy (E_kin): ${u.singleImpactEnergyJ} J · Wind-Adjusted Effective Energy: ${u.effectiveEnergyJ} J`,
      `- Material Damage Ratio Band (nominal p10 / p50 / p90): ${Math.round(u.damageRatioBand.p10 * 100)}% – ${Math.round(u.damageRatioBand.p50 * 100)}% – ${Math.round(u.damageRatioBand.p90 * 100)}%`,
      `- Carrier Supplement Readiness: **${u.supplementReadiness}**`,
      '',
      '## Geospatial Swath Exposure',
      ...(impact
        ? [
            `- Site Impact Score: ${impact.score}/100 (${impact.severity})`,
            ...impact.nearbyEvents.map(
              (ev) => `- Nearby Swath: ${ev.name} [${ev.severity}] (${ev.distanceKm.toFixed(1)} km)`
            ),
          ]
        : ['- Coordinates outside tracked database swatch threshold.']),
      '',
      '## Field & Adjuster Inspection Protocol',
      ...u.recommendedActions.map((a) => `- [ ] ${a}`),
      '',
      `> Methodology Note: ${u.methodology}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `underwriting-dossier-${checkedPoint.lat.toFixed(3)}_${checkedPoint.lng.toFixed(3)}.md`;
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
            Cross-source storm correlation, NHESS hail kinetic underwriting &amp; customer verification workspace
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
          title="AI & UNDERWRITING"
          value={configuredProviders > 0 ? `${configuredProviders} BYOK + Local` : 'Local Physics + AI'}
          state="LIVE"
          hint="NHESS hail model & scoring online"
        />
      </div>

      {/* Interactive Homeowner Storm Verification & NHESS/CLIMADA Hail Physics Calculator */}
      <Card
        title="Homeowner Storm Verification & Hail Kinetic Underwriting Tool"
        subtitle="Combine geospatial NOAA swath exposure with spherical ice kinetic energy physics (p10-p90 damage bands) for adjuster supplements"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Latitude</label>
              <input
                type="text"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                className="input w-full font-mono text-sm"
                placeholder="33.0500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Longitude</label>
              <input
                type="text"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                className="input w-full font-mono text-sm"
                placeholder="-96.7500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Hail Size (in): {hailInches.toFixed(2)}&quot;
              </label>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.25"
                value={hailInches}
                onChange={(e) => setHailInches(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Wind Gust (mph): {windMph}
              </label>
              <input
                type="range"
                min="10"
                max="110"
                step="5"
                value={windMph}
                onChange={(e) => setWindMph(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Roof Assembly</label>
              <select
                value={roofType}
                onChange={(e) => setRoofType(e.target.value as RoofMaterial)}
                className="input w-full text-sm"
              >
                {ROOF_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Search size={14} />}
              isLoading={underwriteMutation.isPending}
              onClick={() => runVerification(Number(latInput), Number(lngInput))}
            >
              Run Property Underwriting
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
                  onClick={downloadUnderwritingDossier}
                >
                  Download Adjuster Dossier (.MD)
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-text-tertiary">Quick verify zones:</span>
            {PRESET_ZONES.map((z) => (
              <button
                key={z.label}
                type="button"
                onClick={() => runVerification(z.lat, z.lng)}
                className="rounded border border-border bg-[hsl(var(--background-elevated))] px-2.5 py-1 text-text-secondary hover:text-text-primary"
              >
                {z.label}
              </button>
            ))}
          </div>

          {underwriteResult && (
            <div className="space-y-4 rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <p className="text-xs uppercase text-text-tertiary">Geospatial Site Score</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">
                    {impactResult?.score ?? 0}
                    <span className="text-xs font-normal text-text-tertiary"> / 100</span>
                  </p>
                  <p className="text-xs font-medium text-emerald">{impactResult?.severity ?? 'NONE'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-text-tertiary">Impact Kinetic Energy</p>
                  <p className="mt-1 text-2xl font-bold font-mono text-text-primary">
                    {underwriteResult.effectiveEnergyJ} J
                  </p>
                  <p className="text-xs text-text-secondary">
                    v_t {underwriteResult.terminalVelocityMs} m/s · {underwriteResult.hailMm} mm
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-text-tertiary">Damage Ratio (p10-p50-p90)</p>
                  <p className="mt-1 text-2xl font-bold font-mono text-amber">
                    {Math.round(underwriteResult.damageRatioBand.p50 * 100)}%
                  </p>
                  <p className="text-xs text-text-secondary">
                    Band: {Math.round(underwriteResult.damageRatioBand.p10 * 100)}% –{' '}
                    {Math.round(underwriteResult.damageRatioBand.p90 * 100)}% nominal
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-text-tertiary">Supplement Readiness</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xl font-bold text-text-primary">
                    <ShieldAlert size={18} className="text-amber" />
                    {underwriteResult.supplementReadiness}
                  </p>
                  <p className="text-xs text-text-secondary">
                    Threshold &ge; {underwriteResult.materialThresholdMm} mm
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-border pt-3 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-text-tertiary mb-1">Nearby Matched Swaths</p>
                  {!impactResult || impactResult.nearbyEvents.length === 0 ? (
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
                  <p className="text-xs uppercase text-text-tertiary mb-1">Recommended Adjuster Protocol</p>
                  <ul className="space-y-1 text-xs text-text-secondary">
                    {underwriteResult.recommendedActions.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
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
          subtitle="Click Underwrite to run full hail energy & claim dossier check"
        >
          <div className="space-y-3">
            {sortedLeads.length === 0 ? (
              <div className="rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-4 text-sm text-text-secondary">
                No geocoded CRM leads yet. Use the Property Underwriting Tool above to create a 1.5 mi canvass zone.
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
                      onClick={() => runVerification(lead.lat, lead.lng)}
                      className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                    >
                      Underwrite
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
          <Link to="/intelligence/helios" className="underline text-text-primary">Helios Copilot</Link> ) · C2SP Proof
          Checkpoints ({' '}
          <Link to="/intelligence/system" className="underline text-text-primary">System &amp; Proof</Link> ) · 36M P&amp;L
          Simulator ({' '}
          <Link to="/reports?tab=revenue-model" className="underline text-text-primary">Reports</Link> )
        </span>
        <Link to="/field" className="inline-flex items-center gap-1 font-medium text-text-primary underline">
          <Satellite size={13} /> Open Field Hub
        </Link>
      </div>
    </div>
  );
};

export default IntelligencePage;
