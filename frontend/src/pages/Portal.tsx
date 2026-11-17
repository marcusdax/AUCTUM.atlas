/**
 * Partner Portal — public entry point showcasing Fieldwright Field Hub
 * (sign up -> Ground map -> jobs queued) alongside AUCTUM.atlas
 * (Storm Intelligence & RoofPro CRM), running on the same live backend.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  ArrowRight,
  Compass,
  Download,
  Layers,
  ListChecks,
  MapPin,
  Radio,
  Satellite,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const DEMO_EMAIL = 'demo@roofprocrm.com';
const DEMO_PASSWORD = 'RoofPro!2026';

interface HealthPayload {
  status: string;
  service?: string;
  integrations?: {
    database?: { connected: boolean; provider?: string };
    noaa_weather?: { connected: boolean };
  };
}

export default function Portal() {
  const navigate = useNavigate();
  const { user, login } = useAuthStore();
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [error, setError] = useState('');

  const health = useQuery({
    queryKey: ['portal-health'],
    queryFn: async () => (await axios.get<HealthPayload>('/api/v1/health')).data,
    retry: 1,
  });

  const enterDemo = async (destination: string) => {
    setError('');
    setBusyTarget(destination);
    try {
      if (!user) {
        await login(DEMO_EMAIL, DEMO_PASSWORD);
      }
      navigate(destination);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start demo session. Try signing in manually.',
      );
    } finally {
      setBusyTarget(null);
    }
  };

  const dbConnected = health.data?.integrations?.database?.connected;
  const noaaConnected = health.data?.integrations?.noaa_weather?.connected;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--text-primary))]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        <header className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                Partner Review Portal · Live Docker Stack
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
                Fieldwright Field Hub &times; AUCTUM.atlas
              </h1>
              <p className="text-sm sm:text-base text-[hsl(var(--text-secondary))] leading-relaxed">
                Two connected surfaces on one PostgreSQL + Redis + Express backend: the
                operator-first <strong>Fieldwright Hub</strong> (sign up &rarr; Ground map &rarr; jobs queued)
                and <strong>AUCTUM.atlas</strong> (NOAA storm intelligence, dispatch &amp; estimating CRM).
              </p>
            </div>

            <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] px-4 py-3 text-xs space-y-1.5 min-w-[220px]">
              <div className="font-mono uppercase tracking-[0.12em] text-[0.625rem] text-[hsl(var(--text-tertiary))]">
                Stack Telemetry
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>API Gateway</span>
                <span className="font-mono font-medium">
                  {health.isLoading ? 'checking…' : health.isError ? 'offline' : 'healthy'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>PostgreSQL</span>
                <span className="font-mono font-medium">
                  {dbConnected ? 'connected' : health.isLoading ? '…' : 'check'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>NOAA Feeds</span>
                <span className="font-mono font-medium">
                  {noaaConnected ? 'connected' : health.isLoading ? '…' : 'check'}
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 border-l-2 border-[hsl(var(--red))] bg-[hsl(var(--red))]/10 px-3 py-2 text-sm text-[hsl(var(--red))]"
            >
              {error}
            </div>
          )}
        </header>

        <section className="grid gap-6 md:grid-cols-2" aria-label="Connected platforms">
          {/* Card 1: Fieldwright Field Hub */}
          <article className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
                <div className="flex items-center gap-2">
                  <Compass size={18} className="text-[hsl(var(--primary))]" aria-hidden="true" />
                  <span className="font-mono text-xs uppercase tracking-[0.14em]">
                    Fieldwright Hub (v1 Operator)
                  </span>
                </div>
                <span className="border border-[hsl(var(--border))] px-2 py-0.5 font-mono text-[0.625rem] uppercase">
                  /field
                </span>
              </div>

              <h2 className="font-display text-2xl font-medium">
                Sign up &rarr; Ground map &rarr; Queue &rarr; Vault &amp; Payouts
              </h2>
              <p className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed">
                5-step operator onboarding with SHA-256 contractor agreement, Ground map wired to
                live storm layers, operator-ordered queue, consent-gated SHA-256 packet sealing,
                and integer-cent fee-disclosed payouts.
              </p>

              <ol className="space-y-2 border-t border-[hsl(var(--border))] pt-4 text-sm">
                <li className="flex items-center gap-2.5">
                  <UserPlus size={15} className="shrink-0 opacity-75" aria-hidden="true" />
                  <span><strong>1. Sign up &amp; Onboard:</strong> W-9, SHA-256 1099 agreement, tools &amp; Android pairing.</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <MapPin size={15} className="shrink-0 opacity-75" aria-hidden="true" />
                  <span><strong>2. Ground map:</strong> Leaflet map with NEXRAD/GOES/TITAN overlays &amp; ranked offers.</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <ListChecks size={15} className="shrink-0 opacity-75" aria-hidden="true" />
                  <span><strong>3. Seal, Vault &amp; Payouts:</strong> Consent gate, genesis chain verify &amp; fee-disclosed ledger.</span>
                </li>
              </ol>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                disabled={busyTarget !== null}
                onClick={() => enterDemo('/field')}
                className="inline-flex items-center gap-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                <Sparkles size={15} aria-hidden="true" />
                {busyTarget === '/field' ? 'Signing in…' : user ? 'Open Field Hub' : 'Launch Field Hub (Demo)'}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 border border-[hsl(var(--border-hover))] text-[hsl(var(--text-primary))] px-4 py-2.5 text-sm font-medium hover:bg-[hsl(var(--background-accent))]"
              >
                Operator Sign Up
              </Link>
              <a
                href="/downloads/fieldwright-debug.apk"
                download="fieldwright-debug.apk"
                className="inline-flex items-center gap-2 border border-[hsl(var(--border-hover))] text-[hsl(var(--text-primary))] px-4 py-2.5 text-sm font-medium hover:bg-[hsl(var(--background-accent))]"
              >
                <Download size={15} aria-hidden="true" />
                Download Field App (.apk)
              </a>
            </div>
          </article>

          {/* Card 2: AUCTUM.atlas */}
          <article className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
                <div className="flex items-center gap-2">
                  <Radio size={18} className="text-[hsl(var(--red))]" aria-hidden="true" />
                  <span className="font-mono text-xs uppercase tracking-[0.14em]">
                    AUCTUM.atlas (Storm &amp; CRM)
                  </span>
                </div>
                <span className="border border-[hsl(var(--border))] px-2 py-0.5 font-mono text-[0.625rem] uppercase">
                  /command · /storm-tracking
                </span>
              </div>

              <h2 className="font-display text-2xl font-medium">
                Storm intelligence, leads, jobs &amp; estimates
              </h2>
              <p className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed">
                Demand-side CRM powered by live NOAA/NWS storm swaths, geocoded leads across DFW,
                job tracking, estimating, and an AI gateway with deterministic offline fallback.
                Active CRM jobs appear automatically on the Field Hub Ground map.
              </p>

              <ul className="space-y-2 border-t border-[hsl(var(--border))] pt-4 text-sm">
                <li className="flex items-center gap-2.5">
                  <Layers size={15} className="shrink-0 opacity-75" aria-hidden="true" />
                  <span><strong>Command Center &amp; Storm Map:</strong> Live radar, hail polygons &amp; lead scoring.</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <ShieldCheck size={15} className="shrink-0 opacity-75" aria-hidden="true" />
                  <span><strong>Jobs &amp; Estimates:</strong> Seeded DFW properties ready to inspect and queue.</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                disabled={busyTarget !== null}
                onClick={() => enterDemo('/command')}
                className="inline-flex items-center gap-2 bg-[hsl(var(--red))] text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                <Radio size={15} aria-hidden="true" />
                {busyTarget === '/command' ? 'Signing in…' : user ? 'Open Command Center' : 'Launch Command Center'}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={busyTarget !== null}
                onClick={() => enterDemo('/intelligence/atlas')}
                className="inline-flex items-center gap-2 border border-[hsl(var(--border-hover))] text-[hsl(var(--text-primary))] px-4 py-2.5 text-sm font-medium hover:bg-[hsl(var(--background-accent))]"
              >
                <Satellite size={15} aria-hidden="true" />
                Atlas Intelligence
              </button>
              <button
                type="button"
                disabled={busyTarget !== null}
                onClick={() => enterDemo('/storm-tracking')}
                className="inline-flex items-center gap-2 border border-[hsl(var(--border-hover))] text-[hsl(var(--text-primary))] px-4 py-2.5 text-sm font-medium hover:bg-[hsl(var(--background-accent))]"
              >
                Storm Map
              </button>
              <button
                type="button"
                disabled={busyTarget !== null}
                onClick={() => enterDemo('/jobs')}
                className="inline-flex items-center gap-2 border border-[hsl(var(--border-hover))] text-[hsl(var(--text-primary))] px-4 py-2.5 text-sm font-medium hover:bg-[hsl(var(--background-accent))]"
              >
                CRM Jobs
              </button>
            </div>
          </article>
        </section>

        <footer className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[hsl(var(--text-secondary))]">
          <div>
            <strong>Demo credentials:</strong>{' '}
            <code className="font-mono">{DEMO_EMAIL}</code> / <code className="font-mono">{DEMO_PASSWORD}</code>
            {user && (
              <span className="ml-3 font-mono text-[hsl(var(--primary))]">
                Signed in as {user.email}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 font-mono">
            <a href="/downloads/fieldwright-debug.apk" download="fieldwright-debug.apk" className="underline">Download APK</a>
            <Link to="/login" className="underline">Sign in page</Link>
            <Link to="/register" className="underline">Create account</Link>
            <a href="/api/v1/health" target="_blank" rel="noreferrer" className="underline">API health JSON</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
