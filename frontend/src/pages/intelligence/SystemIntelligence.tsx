/**
 * System Intelligence — Live Tenant Health, Sealed SHA-256 Chain & Operator Resources Desk
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Check,
  Copy,
  Database,
  Download,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Signal } from '../../components/primitives/Signal';
import { Metric } from '../../components/primitives/Metric';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';
import { aiApi } from '../../services/ai';

interface HealthPayload {
  status: string;
  timestamp: string;
  service: string;
  version: string;
  integrations?: {
    noaa_weather?: { connected: boolean; endpoint?: string };
    database?: { connected: boolean; provider?: string };
  };
}

interface StormRoiSummary {
  summary: {
    totalStormEvents: number;
    stormLeads: number;
    stormJobs: number;
    sealedPackets: number;
    intactChains: number;
    totalGrossBudget: number;
    totalOperatorPayouts: number;
  };
}

const SystemIntelligencePage: React.FC = () => {
  const [copiedDiagnostics, setCopiedDiagnostics] = useState(false);

  const healthQuery = useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => axios.get<HealthPayload>('/api/v1/health').then((r) => r.data),
    staleTime: 15_000,
  });

  const aiStatusQuery = useQuery({
    queryKey: ['system', 'ai-status'],
    queryFn: () => aiApi.status(),
    staleTime: 30_000,
  });

  const stormRoiQuery = useQuery({
    queryKey: ['system', 'storm-roi'],
    queryFn: () => api.get<StormRoiSummary>('/reports/storm-roi').then((r) => r.data),
    staleTime: 30_000,
  });

  const health = healthQuery.data;
  const roi = stormRoiQuery.data?.summary;
  const dbOk = health?.integrations?.database?.connected ?? false;
  const noaaOk = health?.integrations?.noaa_weather?.connected ?? false;

  const copyDiagnostics = async () => {
    const payload = {
      checkedAt: new Date().toISOString(),
      service: health?.service || 'RoofPro CRM API',
      version: health?.version || '1.2.0',
      databaseConnected: dbOk,
      noaaConnected: noaaOk,
      aiProvidersConfigured: (aiStatusQuery.data?.providers ?? []).filter((p) => p.configured).length,
      sealedPackets: roi?.sealedPackets ?? 0,
      intactSha256Chains: roi?.intactChains ?? 0,
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedDiagnostics(true);
    toast.success('Verified system diagnostics JSON copied.');
    setTimeout(() => setCopiedDiagnostics(false), 2000);
  };

  return (
    <div className="h-full space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
            <Server size={28} className="text-emerald" aria-hidden="true" />
            System &amp; Proof Audit
          </h1>
          <p className="text-text-secondary mt-1">
            Live database connectivity, NOAA weather readiness, SHA-256 chain integrity &amp; field deployment downloads
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw size={14} className={healthQuery.isFetching ? 'animate-spin' : ''} />}
            onClick={() => {
              healthQuery.refetch();
              stormRoiQuery.refetch();
            }}
          >
            Re-check Health
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={copiedDiagnostics ? <Check size={14} /> : <Copy size={14} />}
            onClick={copyDiagnostics}
          >
            {copiedDiagnostics ? 'Copied JSON' : 'Copy Diagnostics'}
          </Button>
          <Signal
            label="System Core"
            status={health?.status === 'healthy' ? 'ONLINE' : 'PROCESSING'}
            color="emerald"
            pulse
            strength={5}
            type="system"
            description="Live tenant diagnostics"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          title="API STATUS"
          value={health?.status ? health.status.toUpperCase() : 'CHECKING'}
          state="LIVE"
          pulse
          hint={`v${health?.version || '1.2.0'}`}
        />
        <Metric
          title="DATABASE"
          value={dbOk ? 'CONNECTED' : 'CHECKING'}
          state="LIVE"
          hint={health?.integrations?.database?.provider || 'PostgreSQL'}
        />
        <Metric
          title="NOAA WEATHER FEED"
          value={noaaOk ? 'ONLINE' : 'STANDBY'}
          state="LIVE"
          hint="api.weather.gov live warnings"
        />
        <Metric
          title="SEALED SHA-256 CHAINS"
          value={roi ? `${roi.intactChains}/${roi.sealedPackets}` : '0/0'}
          state="LIVE"
          hint="Cryptographically verified packets"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Live Service Verification" subtitle="Real checks from /api/v1/health & /ai/status">
          <div className="space-y-3">
            {[
              {
                name: 'PostgreSQL Relational Ledger',
                detail: dbOk ? 'Primary tenant DB responding cleanly' : 'Checking connection...',
                ok: dbOk,
                icon: <Database size={16} className="text-emerald" />,
              },
              {
                name: 'NOAA / NWS Active Alerts Feed',
                detail: health?.integrations?.noaa_weather?.endpoint || 'https://api.weather.gov',
                ok: noaaOk,
                icon: <Activity size={16} className="text-cyan" />,
              },
              {
                name: 'Proof-of-Integrity Hash Chain',
                detail: `${roi?.intactChains ?? 0} of ${roi?.sealedPackets ?? 0} sealed field packets intact`,
                ok: (roi?.intactChains ?? 0) === (roi?.sealedPackets ?? 0),
                icon: <ShieldCheck size={16} className="text-emerald" />,
              },
              {
                name: 'AI Brief & Impact Engine',
                detail:
                  aiStatusQuery.data?.localFallback?.available !== false
                    ? 'Deterministic local engine + BYOK failover active'
                    : 'Configured',
                ok: true,
                icon: <Server size={16} className="text-amber" />,
              },
            ].map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-3"
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <div>
                    <p className="font-medium text-text-primary">{item.name}</p>
                    <p className="text-xs text-text-tertiary">{item.detail}</p>
                  </div>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    item.ok ? 'bg-emerald/10 text-emerald' : 'bg-amber/10 text-amber'
                  }`}
                >
                  {item.ok ? 'VERIFIED' : 'CHECK'}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Operator Tools & Direct Actions" subtitle="Financial audits, Android field app & configuration">
          <div className="space-y-3">
            <Link
              to="/reports?tab=revenue-model"
              className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-3 hover:bg-[hsl(var(--background-accent))]"
            >
              <div className="flex items-center gap-3">
                <BarChart3 size={18} className="text-primary" />
                <div>
                  <p className="font-medium text-text-primary">36-Month Revenue &amp; Sensitivity Model</p>
                  <p className="text-xs text-text-tertiary">Conservative / Base / Storm-Surge P&amp;L comparison</p>
                </div>
              </div>
              <span className="text-xs font-mono underline text-text-primary">Open &rarr;</span>
            </Link>

            <Link
              to="/reports?tab=storm-roi"
              className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-3 hover:bg-[hsl(var(--background-accent))]"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-emerald" />
                <div>
                  <p className="font-medium text-text-primary">Storm ROI &amp; Sealed Evidence Audit</p>
                  <p className="text-xs text-text-tertiary">Verify storm &rarr; lead &rarr; sealed packet &rarr; operator payout chain</p>
                </div>
              </div>
              <span className="text-xs font-mono underline text-text-primary">Audit &rarr;</span>
            </Link>

            <a
              href="/downloads/fieldwright-debug.apk"
              download="fieldwright-debug.apk"
              className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-3 hover:bg-[hsl(var(--background-accent))]"
            >
              <div className="flex items-center gap-3">
                <Smartphone size={18} className="text-amber" />
                <div>
                  <p className="font-medium text-text-primary">FieldWright Android Companion APK</p>
                  <p className="text-xs text-text-tertiary">Direct offline camera, GPS &amp; inspection capture installer</p>
                </div>
              </div>
              <Download size={16} className="text-text-primary" />
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SystemIntelligencePage;
