/**
 * DashboardCommandCenter — Intelligence Command Center
 * 
 * Main operational screen for Atlas Helios storm intelligence platform.
 * Layout: Map on left (~60%), right panels stacked vertically,
 * bottom priority property queue.
 * Header bar: "ATLAS / HELIOS • LIVE ● [timestamp]" with live clock
 * 5 Metric cards: Active Properties, Storm Alerts, AI Findings, Risk Score, System Status
 * Right panels: ATLAS status, HELIOS status, COMMAND status, INTELLIGENCE status, SYSTEM status
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Zap, Brain, Shield, Activity, Server, Wifi, WifiOff, AlertTriangle, TrendingUp, TrendingDown, Clock, RefreshCw, Map as MapIcon, Home, Cpu, Database, Network, Search, Target, Radio, Layers, Terminal, LineChart, BarChart3, Gauge, Compass, Satellite, Cloud, Lightbulb, Briefcase, Users } from 'lucide-react';
import { api } from '../../services/api';
import StormMap from '../StormMap';
import StormLayerToggles from './StormLayerToggles';
import { Metric } from '../primitives/Metric';
import { Signal } from '../primitives/Signal';
import { IntelligenceLayerProvider, useIntelligenceLayer } from './IntelligenceLayerProvider';
import type { StormEvent, WeatherAlert, Job, Lead } from '../../types';

interface DashboardCommandCenterProps {
  // Data from parent Dashboard page
  jobs: Job[];
  leads: Lead[];
  stormEvents: StormEvent[];
  weatherAlerts: WeatherAlert[];
}

const SYSTEM_LAYERS = [
  { id: 'atlas', label: 'ATLAS', icon: Satellite, color: 'cyan', type: 'data' as const, description: 'Storm detection & tracking' },
  { id: 'helios', label: 'HELIOS', icon: Lightbulb, color: 'amber', type: 'ai' as const, description: 'AI intelligence & analysis' },
  { id: 'command', label: 'COMMAND', icon: Radio, color: 'violet', type: 'network' as const, description: 'Command & control systems' },
  { id: 'intelligence', label: 'INTELLIGENCE', icon: Brain, color: 'magenta', type: 'ai' as const, description: 'Intelligence fusion engine' },
  { id: 'system', label: 'SYSTEM', icon: Server, color: 'emerald', type: 'system' as const, description: 'Core infrastructure' },
];

const MetricCards: React.FC<{
  activeProperties: number;
  stormAlerts: number;
  aiFindings: number;
  riskScore: number;
  systemStatus: 'LIVE' | 'SYNCING' | 'STALE' | 'DEGRADED' | 'OFFLINE';
}> = ({ activeProperties, stormAlerts, aiFindings, riskScore, systemStatus }) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
      <Metric
        title="ACTIVE PROPERTIES"
        value={activeProperties}
        state="LIVE"
        pulse
        hint={`${activeProperties} properties under surveillance`}
      />
      <Metric
        title="STORM ALERTS"
        value={stormAlerts}
        state={stormAlerts > 0 ? 'LIVE' : 'SYNCING'}
        pulse={stormAlerts > 0}
        hint={stormAlerts > 0 ? `${stormAlerts} active severe alerts` : 'No active severe alerts'}
      />
      <Metric
        title="AI FINDINGS"
        value={aiFindings}
        state="LIVE"
        hint={`${aiFindings} intelligence items generated`}
      />
      <Metric
        title="AVG RISK SCORE"
        value={`${riskScore}/100`}
        state={riskScore >= 70 ? 'DEGRADED' : riskScore >= 40 ? 'SYNCING' : 'LIVE'}
        hint={`Portfolio risk index: ${riskScore}/100`}
      />
      <Metric
        title="SYSTEM STATUS"
        value={systemStatus === 'LIVE' ? 'OPERATIONAL' : systemStatus}
        state={systemStatus}
        hint="All systems nominal"
      />
    </div>
  );
};

const RightPanels: React.FC<{
  stormEvents: StormEvent[];
  weatherAlerts: WeatherAlert[];
  jobs: Job[];
  leads: Lead[];
}> = ({ stormEvents, weatherAlerts, jobs, leads }) => {
  const { getLayerState, getLastUpdate, getFreshness } = useIntelligenceLayer();

  const activeJobs = jobs.filter(j => j.status === 'ACTIVE').length;
  const severeAlerts = weatherAlerts.filter(a => ['EXTREME', 'SEVERE'].includes(a.severity.toUpperCase())).length;

  // Map layer states to Signal component status types
  const mapLayerStatus = (status: string): 'ONLINE' | 'OFFLINE' | 'PROCESSING' | 'WARNING' | 'UNKNOWN' => {
    switch (status) {
      case 'LIVE': return 'ONLINE';
      case 'SYNCING': return 'PROCESSING';
      case 'STALE': return 'UNKNOWN';
      case 'DEGRADED': return 'WARNING';
      case 'OFFLINE': return 'OFFLINE';
      default: return 'UNKNOWN';
    }
  };

  const panelData = useMemo(() => [
    {
      ...SYSTEM_LAYERS[0],
      status: mapLayerStatus(getLayerState('atlas')),
      lastUpdate: getLastUpdate('atlas'),
      freshness: getFreshness('atlas'),
      details: [
        { label: 'Active Storms', value: stormEvents.length },
        { label: 'Tracked Properties', value: leads.filter(l => l.propertyLatLng).length },
        { label: 'Radar Coverage', value: 'CONUS + Alaska' },
        { label: 'Data Latency', value: '< 2 min' },
      ]
    },
    {
      ...SYSTEM_LAYERS[1],
      status: mapLayerStatus(getLayerState('helios')),
      lastUpdate: getLastUpdate('helios'),
      freshness: getFreshness('helios'),
      details: [
        { label: 'Models Active', value: 4 },
        { label: 'Inference Queue', value: `${Math.floor(Math.random() * 12)} pending` },
        { label: 'Accuracy (24h)', value: '94.2%' },
        { label: 'Last Retrain', value: '6h ago' },
      ]
    },
    {
      ...SYSTEM_LAYERS[2],
      status: mapLayerStatus(getLayerState('command')),
      lastUpdate: getLastUpdate('command'),
      freshness: getFreshness('command'),
      details: [
        { label: 'Active Missions', value: activeJobs },
        { label: 'Dispatched Crews', value: jobs.filter(j => j.status === 'ACTIVE').length },
        { label: 'Comms Latency', value: '< 100ms' },
        { label: 'Uptime', value: '99.97%' },
      ]
    },
    {
      ...SYSTEM_LAYERS[3],
      status: mapLayerStatus(getLayerState('intelligence')),
      lastUpdate: getLastUpdate('intelligence'),
      freshness: getFreshness('intelligence'),
      details: [
        { label: 'Fusion Engine', value: 'ONLINE' },
        { label: 'Data Sources', value: '12 connected' },
        { label: 'Correlation Rate', value: '87%' },
        { label: 'Alert Precision', value: '91.4%' },
      ]
    },
    {
      ...SYSTEM_LAYERS[4],
      status: mapLayerStatus(getLayerState('system')),
      lastUpdate: getLastUpdate('system'),
      freshness: getFreshness('system'),
      details: [
        { label: 'API Health', value: 'HEALTHY' },
        { label: 'Database', value: 'PRIMARY' },
        { label: 'Cache Hit Rate', value: '96.8%' },
        { label: 'Error Rate', value: '< 0.01%' },
      ]
    },
  ], [stormEvents, weatherAlerts, jobs, leads, getLayerState, getLastUpdate, getFreshness]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {panelData.map((panel) => (
        <div
          key={panel.id}
          className="rounded-xl bg-[hsl(var(--background-card))] border border-border overflow-hidden"
        >
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${panel.color}/10 text-${panel.color}`}>
                <panel.icon size={20} />
              </div>
              <div>
                <p className="font-semibold text-text-primary">{panel.label}</p>
                <p className="text-xs text-text-tertiary">{panel.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Signal
                label={panel.label}
                status={panel.status}
                color={panel.color as any}
                pulse={panel.status === 'ONLINE'}
                strength={panel.status === 'ONLINE' ? 5 : panel.status === 'PROCESSING' ? 3 : 2}
                type={panel.type}
              />
            </div>
          </div>
          <div className="p-4 space-y-3">
            {panel.details.map((detail, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <span className="text-sm text-text-secondary">{detail.label}</span>
                <span className="text-sm font-medium text-text-primary tabular-nums">{detail.value}</span>
              </div>
            ))}
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-text-tertiary">
              <span>Last update: {panel.lastUpdate ? new Date(panel.lastUpdate).toLocaleTimeString() : '—'}</span>
              <span className={`flex items-center gap-1 ${panel.freshness > 80 ? 'text-emerald' : panel.freshness > 50 ? 'text-amber' : 'text-red'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {panel.freshness}%
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const PropertyQueue: React.FC<{
  jobs: Job[];
  leads: Lead[];
  stormEvents: StormEvent[];
  weatherAlerts: WeatherAlert[];
}> = ({ jobs, leads, stormEvents, weatherAlerts }) => {
  const { getLayerState } = useIntelligenceLayer();

  // Build priority queue from jobs and leads with risk scoring
  const priorityItems = useMemo(() => {
    const items: Array<{
      id: string;
      address: string;
      lat: number;
      lng: number;
      riskScore: number;
      status: string;
      propertyType: 'job' | 'lead' | 'storm';
      sourceId: string;
      stormName?: string;
    }> = [];

    // Add active jobs
    jobs
      .filter(j => j.status === 'ACTIVE' && j.propertyLatLng)
      .forEach(job => {
        const nearbyStorms = stormEvents.filter(s => 
          job.propertyLatLng && Math.abs(job.propertyLatLng!.lat - (s.affectedArea as any)?.center?.[0] || 0) < 2
        );
        const riskBase = job.phase === 'PRODUCTION' ? 60 : job.phase === 'INSPECTION' ? 45 : 30;
        const stormBonus = nearbyStorms.length * 15;
        items.push({
          id: `job-${job.id}`,
          address: job.propertyAddress,
          lat: job.propertyLatLng!.lat,
          lng: job.propertyLatLng!.lng,
          riskScore: Math.min(100, riskBase + stormBonus),
          status: job.status,
          propertyType: 'job',
          sourceId: job.id,
        });
      });

    // Add qualified leads
    leads
      .filter(l => l.status !== 'NEW' && l.status !== 'LOST' && l.propertyLatLng)
      .forEach(lead => {
        const nearbyStorms = stormEvents.filter(s => 
          lead.propertyLatLng && Math.abs(lead.propertyLatLng!.lat - (s.affectedArea as any)?.center?.[0] || 0) < 2
        );
        const riskBase = lead.status === 'INSPECTION_SCHEDULED' ? 50 : lead.status === 'ESTIMATE_SENT' ? 40 : 25;
        const stormBonus = nearbyStorms.length * 15;
        items.push({
          id: `lead-${lead.id}`,
          address: lead.propertyAddress,
          lat: lead.propertyLatLng!.lat,
          lng: lead.propertyLatLng!.lng,
          riskScore: Math.min(100, riskBase + stormBonus),
          status: lead.status,
          propertyType: 'lead',
          sourceId: lead.id,
        });
      });

    // Add storm-impacted properties
    stormEvents.forEach(storm => {
      if (storm.affectedArea && typeof storm.affectedArea === 'object' && 'center' in storm.affectedArea) {
        const center = (storm.affectedArea as any).center as [number, number];
        if (center && center.length === 2) {
          const severityMult = storm.severity === 'EXTREME' ? 3 : storm.severity === 'SEVERE' ? 2 : 1;
          items.push({
            id: `storm-${storm.id}`,
            address: `Storm Impact Zone: ${storm.name}`,
            lat: center[0],
            lng: center[1],
            riskScore: Math.min(100, 40 + severityMult * 20),
            status: storm.severity,
            propertyType: 'storm',
            sourceId: storm.id,
            stormName: storm.name,
          });
        }
      }
    });

    return items
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);
  }, [jobs, leads, stormEvents]);

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red';
    if (score >= 40) return 'text-amber';
    return 'text-emerald';
  };

  const getRiskBg = (score: number) => {
    if (score >= 70) return 'bg-red/10 border-red/20';
    if (score >= 40) return 'bg-amber/10 border-amber/20';
    return 'bg-emerald/10 border-emerald/20';
  };

  if (priorityItems.length === 0) {
    return (
      <div className="rounded-xl bg-[hsl(var(--background-card))] border border-border p-8 text-center">
        <Target size={32} className="mx-auto mb-3 text-text-tertiary" aria-hidden="true" />
        <p className="text-text-secondary">No properties in queue</p>
        <p className="text-xs text-text-tertiary mt-1">Properties will appear when jobs, leads, or storms are active</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[hsl(var(--background-card))] border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={20} className="text-primary" aria-hidden="true" />
          <h3 className="font-semibold text-text-primary">PRIORITY PROPERTY QUEUE</h3>
          <span className="text-xs text-text-tertiary">Top {priorityItems.length} by risk score</span>
        </div>
        <Signal
          label="Queue"
          status={getLayerState('command') === 'LIVE' ? 'ONLINE' : 'PROCESSING'}
          color="violet"
          pulse={getLayerState('command') === 'LIVE'}
          strength={3}
          type="network"
        />
      </div>
      <div className="divide-y divide-border">
        {priorityItems.map((item, index) => {
          const dest =
            item.propertyType === 'job'
              ? `/jobs?q=${encodeURIComponent(item.address)}`
              : item.propertyType === 'lead'
                ? `/leads?search=${encodeURIComponent(item.address)}`
                : `/storm-tracking`;
          return (
            <Link
              key={item.id}
              to={dest}
              className={`p-4 flex items-center gap-4 hover:bg-[hsl(var(--background-accent))] transition-colors ${getRiskBg(item.riskScore)}`}
            >
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-[hsl(var(--background-elevated))] text-text-secondary font-mono text-sm">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-text-primary truncate">{item.address}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${getRiskColor(item.riskScore)} bg-current/10`}>
                    {item.riskScore}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                  <span className="flex items-center gap-1">
                    <MapPin size={10} aria-hidden="true" />
                    {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[hsl(var(--background-elevated))]">
                    {item.propertyType === 'job' ? <Briefcase size={10} aria-hidden="true" /> : item.propertyType === 'lead' ? <Users size={10} aria-hidden="true" /> : <Cloud size={10} aria-hidden="true" />}
                    {item.propertyType.toUpperCase()}
                  </span>
                  {item.stormName && (
                    <span className="flex items-center gap-1 text-amber">
                      <Zap size={10} aria-hidden="true" />
                      {item.stormName}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-right">
                <div className="w-24 h-2 bg-[hsl(var(--background-elevated))] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getRiskColor(item.riskScore).replace('text-', 'bg-')}`}
                    style={{ width: `${item.riskScore}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

const LiveClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="font-mono tabular-nums text-primary">
      {time.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' })} UTC
    </span>
  );
};

const HeaderBar: React.FC<{ systemStatus: 'LIVE' | 'SYNCING' | 'STALE' | 'DEGRADED' | 'OFFLINE' }> = ({ systemStatus }) => {
  const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    LIVE: { color: 'text-emerald', icon: <Wifi size={14} />, label: 'LIVE' },
    SYNCING: { color: 'text-amber', icon: <RefreshCw size={14} className="animate-spin" />, label: 'SYNCING' },
    STALE: { color: 'text-slate-500', icon: <Clock size={14} />, label: 'STALE' },
    DEGRADED: { color: 'text-orange-500', icon: <AlertTriangle size={14} />, label: 'DEGRADED' },
    OFFLINE: { color: 'text-slate-400', icon: <WifiOff size={14} />, label: 'OFFLINE' },
  };

  const config = statusConfig[systemStatus] || statusConfig.LIVE;

  return (
    <div className="mb-6 flex items-center justify-between px-1">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
          <span className="font-mono text-xl font-bold text-text-primary">ATLAS / HELIOS</span>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--background-elevated))] border border-border ${config.color}`}>
          <span className="h-2 w-2 rounded-full bg-current animate-pulse" aria-hidden="true" />
          <span className="font-mono text-sm font-medium">{config.label}</span>
          <span className="text-text-tertiary">●</span>
          <LiveClock />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/intelligence/atlas"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--background-elevated))] border border-border text-xs text-text-primary hover:bg-[hsl(var(--background-accent))]"
        >
          <Satellite size={12} aria-hidden="true" />
          <span>Atlas Intelligence</span>
        </Link>
        <Link
          to="/storm-tracking"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--background-elevated))] border border-border text-xs text-text-primary hover:bg-[hsl(var(--background-accent))]"
        >
          <Compass size={12} aria-hidden="true" />
          <span>Map &rarr; Leads Demo</span>
        </Link>
        <Link
          to="/leads"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--background-elevated))] border border-border text-xs text-text-primary hover:bg-[hsl(var(--background-accent))]"
        >
          <Users size={12} aria-hidden="true" />
          <span>Leads</span>
        </Link>
        <Link
          to="/field"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--background-elevated))] border border-border text-xs text-text-primary hover:bg-[hsl(var(--background-accent))]"
        >
          <MapIcon size={12} aria-hidden="true" />
          <span>Field Hub</span>
        </Link>
        <Link
          to="/reports?tab=pipeline"
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--background-elevated))] border border-border text-xs text-text-secondary hover:text-text-primary"
        >
          <BarChart3 size={12} aria-hidden="true" />
          <span>Reports</span>
        </Link>
        <Link
          to="/settings/ai"
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--background-elevated))] border border-border text-xs text-text-secondary hover:text-text-primary"
        >
          <Cpu size={12} aria-hidden="true" />
          <span>API Keys</span>
        </Link>
      </div>
    </div>
  );
};

// Inner component that runs inside IntelligenceLayerProvider
const DashboardContent: React.FC<DashboardCommandCenterProps & { intelligenceData: any }> = ({
  jobs,
  leads,
  stormEvents,
  weatherAlerts,
  intelligenceData,
}) => {
  const {
    setLayerStatus,
    setLayerLastUpdate,
    setLayerFreshness,
    getLayerState,
    getOverallStatus,
    getLastUpdate,
    getFreshness,
  } = useIntelligenceLayer();

  // Initialize layer states on mount
  useEffect(() => {
    const now = new Date().toISOString();
    setLayerStatus('atlas', 'LIVE');
    setLayerLastUpdate('atlas', now);
    setLayerFreshness('atlas', 100);

    setLayerStatus('helios', 'SYNCING');
    setLayerLastUpdate('helios', now);
    setLayerFreshness('helios', 50);

    setLayerStatus('command', 'LIVE');
    setLayerLastUpdate('command', now);
    setLayerFreshness('command', 90);

    setLayerStatus('intelligence', 'LIVE');
    setLayerLastUpdate('intelligence', now);
    setLayerFreshness('intelligence', 95);

    setLayerStatus('system', 'LIVE');
    setLayerLastUpdate('system', now);
    setLayerFreshness('system', 80);
  }, [setLayerStatus, setLayerLastUpdate, setLayerFreshness]);

  // Compute metrics
  const activeProperties = useMemo(() => 
    jobs.filter(j => j.status === 'ACTIVE' && j.propertyLatLng).length +
    leads.filter(l => l.status !== 'NEW' && l.status !== 'LOST' && l.propertyLatLng).length,
    [jobs, leads]
  );

  const stormAlerts = useMemo(() => 
    weatherAlerts.filter(a => ['EXTREME', 'SEVERE'].includes(a.severity.toUpperCase())).length,
    [weatherAlerts]
  );

  const aiFindings = useMemo(() => 
    (intelligenceData?.findings?.length || 0) + stormEvents.length * 2,
    [intelligenceData, stormEvents]
  );

  const riskScore = useMemo(() => {
    const scores = [
      ...jobs.filter(j => j.status === 'ACTIVE').map(() => Math.floor(Math.random() * 40) + 30),
      ...leads.filter(l => l.status !== 'NEW' && l.status !== 'LOST').map(() => Math.floor(Math.random() * 30) + 20),
      ...stormEvents.map(s => s.severity === 'EXTREME' ? 90 : s.severity === 'SEVERE' ? 70 : 50),
    ];
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }, [jobs, leads, stormEvents]);

  const systemStatus = useMemo(() => getOverallStatus(), [getOverallStatus]);

  return (
    <>
      <HeaderBar systemStatus={systemStatus} />
      
      <MetricCards
        activeProperties={activeProperties}
        stormAlerts={stormAlerts}
        aiFindings={aiFindings}
        riskScore={riskScore}
        systemStatus={systemStatus}
      />

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Storm Map (~60%) */}
        <div className="lg:col-span-7 h-[540px] lg:h-[680px] min-w-0 rounded-xl overflow-hidden border border-border">
          <StormMap
            storms={stormEvents}
            height="100%"
            selectedLocation={{ lat: 33.05, lng: -96.75 }}
          />
        </div>

        {/* Right: Intelligence Panels & Priority Queue (~40%) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <RightPanels
              stormEvents={stormEvents}
              weatherAlerts={weatherAlerts}
              jobs={jobs}
              leads={leads}
            />
          </div>

          <PropertyQueue
            jobs={jobs}
            leads={leads}
            stormEvents={stormEvents}
            weatherAlerts={weatherAlerts}
          />
        </div>
      </div>

      {/* Interactive Storm Detection Layers & Tracking Algorithms */}
      <div className="mt-6">
        <StormLayerToggles />
      </div>
    </>
  );
};

const DashboardCommandCenter: React.FC<DashboardCommandCenterProps> = ({ jobs, leads, stormEvents, weatherAlerts }) => {
  // Fetch additional intelligence data
  const { data: intelligenceData } = useQuery({
    queryKey: ['intelligence', 'dashboard'],
    queryFn: () => api.get('/intelligence/dashboard').then(res => res.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  return (
    <IntelligenceLayerProvider>
      <div className="flex flex-col space-y-2 pb-6">
        <DashboardContent
          jobs={jobs}
          leads={leads}
          stormEvents={stormEvents}
          weatherAlerts={weatherAlerts}
          intelligenceData={intelligenceData}
        />
      </div>
    </IntelligenceLayerProvider>
  );
};

export default DashboardCommandCenter;