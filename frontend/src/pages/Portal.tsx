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
        <header className="auctum-cloth-board overflow-hidden rounded-sm border border-[#2a4a3b]">
          {/* Numbered drafting ruler */}
          <div
            className="grid grid-cols-8 border-b border-[#f1f2ea]/15 py-1 text-center font-mono text-[0.625rem] text-[#f1f2ea]/45"
            aria-hidden="true"
          >
            <span>1</span><span>2</span><span>3</span><span>4</span>
            <span>5</span><span>6</span><span>7</span><span>8</span>
          </div>

          <div className="grid lg:grid-cols-12">
            <div className="p-6 sm:p-8 lg:col-span-8 lg:border-r lg:border-[#f1f2ea]/15 space-y-4">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-[#d9b464]">
                Partner Review Portal · Live Docker Stack
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#f1f2ea]">
                Fieldwright Field Hub &times; AUCTUM.atlas
              </h1>
              <p className="max-w-2xl text-sm sm:text-base text-[#f1f2ea]/85 leading-relaxed">
                Two connected surfaces on one PostgreSQL + Redis + Express backend: the
                operator-first <strong className="text-[#f1f2ea]">Fieldwright Hub</strong> (sign up &rarr; Ground map &rarr; jobs queued)
                and <strong className="text-[#f1f2ea]">AUCTUM.atlas</strong> (NOAA storm intelligence, dispatch &amp; estimating CRM).
              </p>

              {/* Circuit-board signal trace strip */}
              <div className="overflow-x-auto pt-2">
                <div className="inline-flex min-w-[460px] items-center gap-2 font-mono text-[0.6875rem]">
                  <span className="rounded-sm border border-[#d9b464] bg-[#102a1f]/90 px-2.5 py-1.5 text-[#f1f2ea]">
                    N1 · NOAA SWATH
                  </span>
                  <span className="h-[2px] w-6 bg-[#e05a3a]" aria-hidden="true" />
                  <span className="rounded-sm border border-[#d9b464] bg-[#102a1f]/90 px-2.5 py-1.5 text-[#f1f2ea]">
                    N2 · LEAD SCORE
                  </span>
                  <span className="h-[2px] w-6 bg-[#e05a3a]" aria-hidden="true" />
                  <span className="rounded-sm border border-[#d9b464] bg-[#102a1f]/90 px-2.5 py-1.5 text-[#f1f2ea]">
                    N3 · ESTIMATE
                  </span>
                  <span className="h-[2px] w-6 bg-[#48a868]" aria-hidden="true" />
                  <span className="rounded-sm border border-[#48a868] bg-[#102a1f]/90 px-2.5 py-1.5 text-[#48a868]">
                    N4 · SHA-256 PASSPORT
                  </span>
                </div>
              </div>
            </div>

            {/* Engineering Title Block + Stack Telemetry */}
            <div className="flex flex-col justify-between border-t border-[#f1f2ea]/15 lg:col-span-4 lg:border-t-0">
              <div className="grid grid-cols-12 border-b border-[#f1f2ea]/15 font-mono text-[0.625rem] uppercase">
                <div className="col-span-7 border-r border-[#f1f2ea]/15 p-3">
                  <div className="text-[#f1f2ea]/50">System</div>
                  <div className="mt-0.5 font-semibold text-[#f1f2ea]">ATLAS ENGINE</div>
                </div>
                <div className="col-span-3 border-r border-[#f1f2ea]/15 p-3">
                  <div className="text-[#f1f2ea]/50">DWG NO.</div>
                  <div className="mt-0.5 font-semibold text-[#f1f2ea]">ATL-1.2</div>
                </div>
                <div className="col-span-2 p-3">
                  <div className="text-[#f1f2ea]/50">REV</div>
                  <div className="mt-0.5 font-semibold text-[#d9b464]">B</div>
                </div>
              </div>

              <div className="p-5 space-y-2 text-xs">
                <div className="font-mono uppercase tracking-[0.14em] text-[0.625rem] text-[#d9b464]">
                  Stack Telemetry
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-[#f1f2ea]/10 pb-1.5">
                  <span className="text-[#f1f2ea]/80">API Gateway</span>
                  <span className="font-mono font-medium text-[#f1f2ea]">
                    {health.isLoading ? 'checking…' : health.isError ? 'offline' : 'healthy'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-[#f1f2ea]/10 pb-1.5">
                  <span className="text-[#f1f2ea]/80">PostgreSQL</span>
                  <span className="font-mono font-medium text-[#f1f2ea]">
                    {dbConnected ? 'connected' : health.isLoading ? '…' : 'check'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#f1f2ea]/80">NOAA Feeds</span>
                  <span className="font-mono font-medium text-[#f1f2ea]">
                    {noaaConnected ? 'connected' : health.isLoading ? '…' : 'check'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="border-t border-[#e05a3a]/40 bg-[#8c2f22]/30 px-6 py-3 text-sm text-[#f1f2ea]"
            >
              {error}
            </div>
          )}
          <div className="auctum-oxblood-trim" aria-hidden="true" />
        </header>

        <section className="grid gap-6 md:grid-cols-2" aria-label="Connected platforms">
          {/* Card 1: Fieldwright Field Hub */}
          <article className="auctum-bevel-card flex flex-col justify-between space-y-6 p-6">
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
                className="inline-flex min-h-[44px] items-center gap-2 rounded-sm bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary-hover))] disabled:opacity-60"
              >
                <Sparkles size={15} aria-hidden="true" />
                {busyTarget === '/field' ? 'Signing in…' : user ? 'Open Field Hub' : 'Launch Field Hub (Demo)'}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
              <Link
                to="/register"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-[hsl(var(--border-hover))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--text-primary))] transition-colors hover:bg-[hsl(var(--background-accent))]"
              >
                Operator Sign Up
              </Link>
              <a
                href="/downloads/fieldwright-debug.apk"
                download="fieldwright-debug.apk"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-[hsl(var(--border-hover))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--text-primary))] transition-colors hover:bg-[hsl(var(--background-accent))]"
              >
                <Download size={15} aria-hidden="true" />
                Download Field App (.apk)
              </a>
            </div>
          </article>

          {/* Card 2: AUCTUM.atlas */}
          <article className="auctum-bevel-card flex flex-col justify-between space-y-6 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
                <div className="flex items-center gap-2">
                  <Radio size={18} className="text-[hsl(var(--red))]" aria-hidden="true" />
                  <span className="font-mono text-xs uppercase tracking-[0.14em]">
                    AUCTUM.atlas (Storm &amp; CRM)
                  </span>
                </div>
                <span className="rounded-sm border border-[hsl(var(--border))] px-2 py-0.5 font-mono text-[0.625rem] uppercase">
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
                className="inline-flex min-h-[44px] items-center gap-2 rounded-sm bg-[hsl(var(--red))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--red-hover))] disabled:opacity-60"
              >
                <Radio size={15} aria-hidden="true" />
                {busyTarget === '/command' ? 'Signing in…' : user ? 'Open Command Center' : 'Launch Command Center'}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={busyTarget !== null}
                onClick={() => enterDemo('/intelligence/atlas')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-[hsl(var(--border-hover))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--text-primary))] transition-colors hover:bg-[hsl(var(--background-accent))]"
              >
                <Satellite size={15} aria-hidden="true" />
                Atlas Intelligence
              </button>
              <button
                type="button"
                disabled={busyTarget !== null}
                onClick={() => enterDemo('/storm-tracking')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-[hsl(var(--border-hover))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--text-primary))] transition-colors hover:bg-[hsl(var(--background-accent))]"
              >
                Storm Map
              </button>
              <button
                type="button"
                disabled={busyTarget !== null}
                onClick={() => enterDemo('/jobs')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-[hsl(var(--border-hover))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--text-primary))] transition-colors hover:bg-[hsl(var(--background-accent))]"
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
