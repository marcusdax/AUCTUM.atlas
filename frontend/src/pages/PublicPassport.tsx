/**
 * Public Job Passport (/p/:slug) — no auth, no app chrome.
 *
 * Contract: docs/SPRINT_10_QC_PASSPORT.md §6–§7. Renders the frozen, sanitized
 * public snapshot: Auctum seal / "Verified job record", company header, job
 * summary, photos, QC sign-offs, materials, ledger receipts and a SHA-256
 * verification card (server-side `/verify`). Unknown or unpublished slugs get a
 * branded 404. Sets document.title + `<meta name="robots" content="noindex">`
 * while mounted and restores both on unmount. Print-friendly.
 */
import React, { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  BadgeCheck,
  BadgeX,
  Check,
  ClipboardCheck,
  Fingerprint,
  Loader2,
  MapPin,
  Package,
  Phone,
  Printer,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Badge } from '../components/ui/Card';
import {
  PASSPORT_NOT_READY_MESSAGE,
  PASSPORT_PUBLIC_NOT_FOUND_MESSAGE,
  describePassportError,
  isPassportNotFoundError,
  isPassportNotReadyError,
  passportApi,
} from '../services/passport';
import type {
  PublicPassport,
  PublicPassportLedgerEntry,
  PublicPassportMaterial,
  PublicPassportQcRun,
  PassportVerifyResponse,
} from '../types/passport';
import {
  addressDisplay,
  estimatesSummary,
  formatDate,
  formatDateTime,
  formatScore,
  ledgerKindLabel,
  materialStatusLabel,
  phaseLabel,
  photoCountLabel,
  qcStatusBadgeVariant,
  qcStatusLabel,
  resolvePhotoUrl,
  shortDigest,
  verifyBadgeVariant,
  verifyLabel,
} from '../components/passport/passportUtils';

// ─────────────────────────── Small presentational pieces ───────────────────────────

const BrandShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="auctum-cloth-board flex min-h-screen flex-col [print-color-adjust:exact] print:bg-white print:p-0">
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">{children}</div>
    <div className="auctum-oxblood-trim print:hidden" aria-hidden="true" />
  </main>
);

const Masthead: React.FC<{ badge?: React.ReactNode }> = ({ badge }) => (
  <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f2ea]/20 pb-4 print:border-[hsl(var(--border))]">
    <div className="flex items-center gap-3">
      <span
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d9b464]/60 bg-[#102a1f] text-[#d9b464] print:border-[hsl(var(--border-hover))] print:bg-white print:text-ink"
        aria-hidden="true"
      >
        <ShieldCheck size={20} />
      </span>
      <div>
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-[#d9b464] print:text-[hsl(var(--text-tertiary))]">
          AUCTUM · Verified job record
        </p>
        <p className="wordmark text-lg leading-tight text-[#f1f2ea] print:text-ink">Job Passport</p>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {badge}
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-[#d9b464] px-3.5 text-xs font-semibold text-[#102a1f] transition-opacity hover:opacity-95 print:hidden"
      >
        <Printer size={14} aria-hidden="true" />
        Print
      </button>
    </div>
  </div>
);

const SummaryField: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div>
    <dt className="eyebrow">{label}</dt>
    <dd className="mt-1 flex items-start gap-1.5 text-sm font-medium text-ink">
      {icon && (
        <span className="mt-0.5 shrink-0 text-[hsl(var(--text-tertiary))]" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{value}</span>
    </dd>
  </div>
);

// ─────────────────────────── State screens ───────────────────────────

const LoadingScreen: React.FC = () => (
  <BrandShell>
    <Masthead />
    <div
      className="auctum-dossier flex flex-col items-center justify-center gap-3 px-6 py-20 text-center"
      role="status"
      aria-live="polite"
    >
      <Loader2 size={28} className="animate-spin text-[hsl(var(--text-tertiary))]" aria-hidden="true" />
      <p className="font-display text-xl text-ink">Loading verified job record…</p>
      <p className="text-sm text-[hsl(var(--text-secondary))]">
        Checking the frozen snapshot published by the contractor.
      </p>
    </div>
  </BrandShell>
);

const NotFoundScreen: React.FC = () => (
  <BrandShell>
    <Masthead />
    <div className="auctum-dossier px-6 py-16 text-center">
      <div className="brand-seal mx-auto h-14 w-14" aria-hidden="true">
        <BadgeX size={24} />
      </div>
      <h1 className="mt-4 font-display text-2xl sm:text-3xl">This Job Passport is not available</h1>
      <p className="mx-auto mt-3 max-w-xl text-sm text-[hsl(var(--text-secondary))]">
        {PASSPORT_PUBLIC_NOT_FOUND_MESSAGE}
      </p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-[hsl(var(--text-secondary))]">
        If a contractor shared this link with you, ask them for an updated one.
      </p>
    </div>
  </BrandShell>
);

const ErrorScreen: React.FC<{
  message: string;
  unavailable?: boolean;
  onRetry: () => void;
  isRetrying: boolean;
}> = ({ message, unavailable, onRetry, isRetrying }) => (
  <BrandShell>
    <Masthead />
    <div className="auctum-dossier px-6 py-14 text-center" role="alert">
      <div className="brand-seal mx-auto h-14 w-14" aria-hidden="true">
        <Fingerprint size={24} />
      </div>
      <h1 className="mt-4 font-display text-2xl sm:text-3xl">
        {unavailable ? 'Job Passports are not live yet' : 'Could not load this job record'}
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-sm text-[hsl(var(--text-secondary))]">
        {unavailable ? PASSPORT_NOT_READY_MESSAGE : message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-sm border border-[hsl(var(--border-hover))] px-4 text-sm font-medium text-text-primary transition-colors hover:bg-[hsl(var(--background-accent))] disabled:opacity-60"
      >
        {isRetrying && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
        {isRetrying ? 'Retrying…' : 'Try again'}
      </button>
    </div>
  </BrandShell>
);

// ─────────────────────────── Public page ───────────────────────────

const PublicPassportPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();

  const passportQuery = useQuery<PublicPassport>({
    queryKey: ['public-passport', slug],
    queryFn: () => passportApi.getPublicPassport(slug),
    enabled: Boolean(slug),
    retry: (failureCount, error) => !isPassportNotFoundError(error) && failureCount < 1,
    staleTime: 5 * 60_000,
  });

  const passport = passportQuery.data ?? null;

  const verifyQuery = useQuery<PassportVerifyResponse>({
    queryKey: ['public-passport-verify', slug],
    queryFn: () => passportApi.verifyPassport(slug),
    enabled: Boolean(slug) && Boolean(passport),
    retry: 1,
    staleTime: 5 * 60_000,
  });

  // document.title + robots noindex while this public page is mounted.
  useEffect(() => {
    const previousTitle = document.title;
    document.title = passport
      ? `${passport.headline || 'Job Passport'} · ${passport.company.name} — AUCTUM`
      : 'Job Passport · AUCTUM';

    const existing = document.querySelector('meta[name="robots"]');
    const created = !existing;
    const previousContent = existing?.getAttribute('content') ?? null;
    const meta = existing ?? document.createElement('meta');
    if (created) {
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');

    return () => {
      document.title = previousTitle;
      if (created) {
        meta.remove();
      } else if (previousContent !== null) {
        meta.setAttribute('content', previousContent);
      } else {
        meta.removeAttribute('content');
      }
    };
  }, [passport]);

  /** Verified ledger wins over the frozen snapshot ledger when available. */
  const ledgerEntries = useMemo<PublicPassportLedgerEntry[]>(() => {
    const verifiedLedger = verifyQuery.data?.ledger;
    if (verifiedLedger && verifiedLedger.length > 0) {
      return verifiedLedger.map((entry) => ({
        kind: entry.kind,
        description: entry.description,
        at: entry.createdAt,
      }));
    }
    return passport?.ledger ?? [];
  }, [verifyQuery.data, passport]);

  if (passportQuery.isLoading) return <LoadingScreen />;

  if (passportQuery.error) {
    if (isPassportNotFoundError(passportQuery.error)) return <NotFoundScreen />;
    return (
      <ErrorScreen
        unavailable={isPassportNotReadyError(passportQuery.error)}
        message={describePassportError(passportQuery.error)}
        onRetry={() => void passportQuery.refetch()}
        isRetrying={passportQuery.isFetching}
      />
    );
  }

  if (!passport) return <NotFoundScreen />;

  const verified = verifyQuery.data?.verified;
  const checks = passport.qc.reduce(
    (total, run) => total + (Array.isArray(run.items) ? run.items.length : 0),
    0
  );
  const passedChecks = passport.qc.reduce(
    (total, run) => total + (Array.isArray(run.items) ? run.items.filter((item) => item.passed).length : 0),
    0
  );

  return (
    <BrandShell>
      <Masthead
        badge={
          <Badge variant={verifyBadgeVariant(verified)} size="sm">
            <span className="inline-flex items-center gap-1">
              {verified === true ? (
                <BadgeCheck size={12} aria-hidden="true" />
              ) : verified === false ? (
                <BadgeX size={12} aria-hidden="true" />
              ) : (
                <Fingerprint size={12} aria-hidden="true" />
              )}
              {verifyQuery.isLoading ? 'Verifying…' : verifyLabel(verified)}
            </span>
          </Badge>
        }
      />

      {/* Circuit-board verification schematic bar (hidden on print) */}
      <div
        className="mb-6 overflow-hidden rounded-sm border border-[#f1f2ea]/20 bg-[#102a1f]/75 print:hidden"
        aria-label="Verification chain"
      >
        <div
          className="grid grid-cols-8 border-b border-[#f1f2ea]/15 py-1 text-center font-mono text-[0.625rem] text-[#f1f2ea]/45"
          aria-hidden="true"
        >
          <span>1</span><span>2</span><span>3</span><span>4</span>
          <span>5</span><span>6</span><span>7</span><span>8</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 font-mono text-[0.6875rem]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm border border-[#d9b464]/70 bg-[#143527] px-2.5 py-1 text-[#f1f2ea]">
              N1 · {photoCountLabel(passport.job.photoCount)}
            </span>
            <span className="h-[2px] w-4 bg-[#e05a3a]" aria-hidden="true" />
            <span className="rounded-sm border border-[#d9b464]/70 bg-[#143527] px-2.5 py-1 text-[#f1f2ea]">
              N2 · QC {passedChecks}/{checks}
            </span>
            <span className="h-[2px] w-4 bg-[#e05a3a]" aria-hidden="true" />
            <span className="rounded-sm border border-[#d9b464]/70 bg-[#143527] px-2.5 py-1 text-[#f1f2ea]">
              N3 · {ledgerEntries.length} LEDGER
            </span>
            <span className="h-[2px] w-4 bg-[#48a868]" aria-hidden="true" />
            <span className="rounded-sm border border-[#48a868] bg-[#143527] px-2.5 py-1 text-[#48a868]">
              N4 · {shortDigest(verifyQuery.data?.contentDigest ?? passport.verify.digest)}
            </span>
          </div>
          <span className="text-[0.625rem] uppercase tracking-[0.14em] text-[#d9b464]">
            REV v{passport.version} · {passport.verify.algorithm}
          </span>
        </div>
      </div>

      {/* Tactile Parchment Dossier */}
      <div className="auctum-dossier p-5 sm:p-8 print:border-0 print:p-0">
      {/* Hero */}
      <header className="border border-[hsl(var(--border))] p-6 sm:p-8 print:break-inside-avoid">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">
              Published {formatDate(passport.publishedAt)} · Version {passport.version}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {passport.headline}
            </h1>
            {passport.summary && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[hsl(var(--text-secondary))] sm:text-base">
                {passport.summary}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {passport.company.logoUrl && (
                <img
                  src={resolvePhotoUrl(passport.company.logoUrl)}
                  alt={`${passport.company.name} logo`}
                  className="h-9 w-9 border border-[hsl(var(--border))] object-contain"
                />
              )}
              <span className="text-sm font-semibold text-ink">{passport.company.name}</span>
              {passport.company.phone && (
                <a
                  href={`tel:${passport.company.phone.replace(/[^\d+]/g, '')}`}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[hsl(var(--primary))] hover:underline print:hidden"
                >
                  <Phone size={14} aria-hidden="true" />
                  {passport.company.phone}
                </a>
              )}
            </div>
          </div>

          <div className="shrink-0 border border-[hsl(var(--hairline-strong))] px-5 py-4 text-center">
            <div className="brand-seal mx-auto h-12 w-12" aria-hidden="true">
              <ShieldCheck size={20} />
            </div>
            <p className="stamp mt-2">Verified record</p>
            <p className="eyebrow mt-1">AUCTUM</p>
          </div>
        </div>
      </header>

      {/* Job summary */}
      <section
        aria-labelledby="passport-job-summary"
        className="mt-6 border border-[hsl(var(--border))] p-6 print:break-inside-avoid"
      >
        <h2 id="passport-job-summary" className="eyebrow">
          Job summary
        </h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryField label="Project" value={passport.job.name} />
          <SummaryField label="Phase" value={phaseLabel(passport.job.phase)} />
          <SummaryField label="Status" value={materialStatusLabel(passport.job.status)} />
          <SummaryField
            label={passport.job.status === 'COMPLETED' ? 'Completed' : 'Scheduled completion'}
            value={passport.job.completedAt ? formatDate(passport.job.completedAt) : 'In progress'}
          />
          <SummaryField
            label="Property"
            value={addressDisplay(passport.job.propertyAddress)}
            icon={<MapPin size={13} />}
          />
          <SummaryField
            label="Photo record"
            value={photoCountLabel(passport.job.photoCount)}
            icon={<ClipboardCheck size={13} />}
          />
          <SummaryField
            label="QC sign-offs"
            value={`${passedChecks}/${checks} checks passed`}
            icon={<ShieldCheck size={13} />}
          />
          <SummaryField
            label="Approved estimates"
            value={estimatesSummary(passport.estimates.count, passport.estimates.approvedTotal)}
          />
        </dl>
      </section>

      {/* Photos */}
      {passport.photos.length > 0 && (
        <section
          aria-labelledby="passport-photos"
          className="mt-6 border border-[hsl(var(--border))] p-6 print:break-inside-avoid"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="passport-photos" className="eyebrow">
              Photo record
            </h2>
            <span className="stat-mono text-xs text-[hsl(var(--text-tertiary))]">
              {photoCountLabel(passport.photos.length)}
            </span>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {passport.photos.map((photo) => (
              <li key={`${photo.url}-${photo.name}`}>
                <a
                  href={resolvePhotoUrl(photo.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="block border border-[hsl(var(--border))] transition-colors hover:border-[hsl(var(--border-hover))]"
                  aria-label={`Open photo ${photo.name}`}
                >
                  <img
                    src={resolvePhotoUrl(photo.url)}
                    alt={photo.name}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <span className="block truncate px-2 py-1.5 text-[0.625rem] text-[hsl(var(--text-secondary))]">
                    {photo.name}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* QC sign-offs */}
      {passport.qc.length > 0 && (
        <section
          aria-labelledby="passport-qc"
          className="mt-6 border border-[hsl(var(--border))] p-6 print:break-inside-avoid"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="passport-qc" className="eyebrow">
              Install QC sign-offs
            </h2>
            <span className="stat-mono text-xs text-[hsl(var(--text-tertiary))]">
              {passport.qc.filter((run) => String(run.status).toUpperCase() === 'PASSED').length} of{' '}
              {passport.qc.length} phases passed
            </span>
          </div>
          <div className="mt-3 space-y-3">
            {passport.qc.map((run, index) => (
              <QcRunCard key={`${run.phase}-${index}`} run={run} />
            ))}
          </div>
        </section>
      )}

      {/* Materials */}
      {passport.materials.length > 0 && (
        <section
          aria-labelledby="passport-materials"
          className="mt-6 border border-[hsl(var(--border))] p-6 print:break-inside-avoid"
        >
          <h2 id="passport-materials" className="eyebrow">
            Materials
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th scope="col" className="py-2 pr-3 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[hsl(var(--text-tertiary))]">
                    Material
                  </th>
                  <th scope="col" className="py-2 pr-3 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[hsl(var(--text-tertiary))]">
                    Quantity
                  </th>
                  <th scope="col" className="py-2 pr-3 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[hsl(var(--text-tertiary))]">
                    Supplier
                  </th>
                  <th scope="col" className="py-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[hsl(var(--text-tertiary))]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {passport.materials.map((material, index) => (
                  <MaterialRow key={`${material.name}-${index}`} material={material} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Ledger receipts */}
      {ledgerEntries.length > 0 && (
        <section
          aria-labelledby="passport-ledger"
          className="mt-6 border border-[hsl(var(--border))] p-6 print:break-inside-avoid"
        >
          <h2 id="passport-ledger" className="eyebrow">
            Ledger receipts
          </h2>
          <p className="mt-1 text-xs text-[hsl(var(--text-secondary))]">
            Append-only audit trail of the milestones behind this record.
          </p>
          <ol className="mt-3 space-y-3 border-l border-[hsl(var(--border))] pl-4">
            {ledgerEntries.map((entry, index) => (
              <li key={`${entry.kind}-${entry.at}-${index}`} className="relative">
                <span
                  className="absolute -left-[1.3rem] top-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-ink">
                  {ledgerKindLabel(entry.kind)}
                  <span className="ml-2 font-mono text-[0.625rem] font-normal uppercase tracking-[0.1em] text-[hsl(var(--text-tertiary))]">
                    {formatDateTime(entry.at)}
                  </span>
                </p>
                <p className="text-sm text-[hsl(var(--text-secondary))]">{entry.description}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Verification */}
      <section
        id="verify"
        aria-labelledby="passport-verify"
        className="mt-6 border border-[hsl(var(--hairline-strong))] p-6 print:break-inside-avoid"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h2 id="passport-verify" className="eyebrow">
              Tamper evidence
            </h2>
            <p className="mt-1 flex items-center gap-2 font-display text-xl font-medium">
              {verified === true ? (
                <BadgeCheck size={20} className="text-[hsl(var(--emerald))]" aria-hidden="true" />
              ) : verified === false ? (
                <BadgeX size={20} className="text-[hsl(var(--red))]" aria-hidden="true" />
              ) : (
                <Fingerprint size={20} className="text-[hsl(var(--text-tertiary))]" aria-hidden="true" />
              )}
              {verifyQuery.isLoading ? 'Verifying record…' : verifyLabel(verified)}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[hsl(var(--text-secondary))]">
              {verified === false
                ? 'The published content no longer matches its recorded SHA-256 digest. Treat this record as unverified and contact the company.'
                : 'This snapshot is frozen at publish time and checked against a SHA-256 content digest. Re-publishing creates a new version; editing the live job data never alters a published version.'}
            </p>
            {verifyQuery.isError && (
              <p className="mt-2 text-xs text-[hsl(var(--amber))]" role="status">
                Live verification is temporarily unavailable. The digest below is still the one
                recorded at publish time.
              </p>
            )}
          </div>

          <dl className="min-w-0 space-y-2 text-xs sm:max-w-xs">
            <div>
              <dt className="eyebrow">Content digest</dt>
              <dd className="stat-mono break-all text-[0.6875rem] text-ink">
                {passport.verify.digest}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Algorithm</dt>
              <dd className="text-[hsl(var(--text-secondary))]">
                {passport.verify.algorithm} · {passport.verify.canonical}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Short code</dt>
              <dd className="stat-mono text-ink">{shortDigest(passport.verify.digest, 16)}</dd>
            </div>
            {verifyQuery.data?.checkedAt && (
              <div>
                <dt className="eyebrow">Verified at</dt>
                <dd className="text-[hsl(var(--text-secondary))]">
                  {formatDateTime(verifyQuery.data.checkedAt)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {/* CTA */}
      {passport.company.phone && (
        <section className="mt-6 border border-[hsl(var(--hairline-strong))] px-6 py-8 text-center print:hidden">
          <h2 className="font-display text-2xl font-medium">Thinking about your own roof?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[hsl(var(--text-secondary))]">
            {passport.company.name} documented this project from inspection to completion. Call to
            ask about your property.
          </p>
          <a
            href={`tel:${passport.company.phone.replace(/[^\d+]/g, '')}`}
            className="mt-4 inline-flex min-h-12 items-center gap-2 bg-[hsl(var(--primary))] px-6 py-3 text-base font-medium text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Phone size={16} aria-hidden="true" />
            Call {passport.company.phone}
          </a>
        </section>
      )}

      </div>

      {/* Footer */}
      <footer className="mt-8 border-t border-[#f1f2ea]/20 pt-4 text-xs text-[#f1f2ea]/75 print:border-[hsl(var(--border))] print:text-[hsl(var(--text-tertiary))]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>
            {passport.company.name} · Published {formatDate(passport.publishedAt)} · Version{' '}
            {passport.version}
          </p>
          <p className="font-mono uppercase tracking-[0.12em] text-[#d9b464] print:text-[hsl(var(--text-tertiary))]">
            AUCTUM · Job Passport
          </p>
        </div>
        <p className="mt-2 max-w-3xl leading-relaxed">
          This record was published by {passport.company.name}. It contains no customer names, phone
          numbers, internal IDs or estimate line items. The property address is shown only according
          to the company&apos;s privacy setting.
        </p>
      </footer>
    </BrandShell>
  );
};

// ─────────────────────────── Sub-components ───────────────────────────

const QcRunCard: React.FC<{ run: PublicPassportQcRun }> = ({ run }) => (
  <article className="border border-[hsl(var(--border))] p-4 print:break-inside-avoid">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-display text-lg font-medium">{phaseLabel(run.phase)}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={qcStatusBadgeVariant(run.status)} size="sm">
          {qcStatusLabel(run.status)}
        </Badge>
        <span className="stat-mono text-xs text-[hsl(var(--text-secondary))]">
          {formatScore(run.score)}
        </span>
      </div>
    </div>
    {run.completedAt && (
      <p className="mt-1 text-xs text-[hsl(var(--text-tertiary))]">
        Signed off {formatDateTime(run.completedAt)}
      </p>
    )}
    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
      {run.items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="flex items-start gap-1.5 text-sm">
          {item.passed ? (
            <Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--emerald))]" aria-hidden="true" />
          ) : (
            <X size={14} className="mt-0.5 shrink-0 text-[hsl(var(--red))]" aria-hidden="true" />
          )}
          <span className={clsx('text-[hsl(var(--text-secondary))]', !item.passed && 'opacity-80')}>
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  </article>
);

const MaterialRow: React.FC<{ material: PublicPassportMaterial }> = ({ material }) => (
  <tr className="border-b border-[hsl(var(--border))] last:border-b-0">
    <th scope="row" className="py-2 pr-3 text-left text-sm font-medium text-ink">
      {material.name}
    </th>
    <td className="py-2 pr-3 text-sm text-[hsl(var(--text-secondary))]">
      {material.quantity} {material.unit}
    </td>
    <td className="py-2 pr-3 text-sm text-[hsl(var(--text-secondary))]">
      {material.supplierName || '—'}
    </td>
    <td className="py-2">
      <Badge variant="default" size="sm">
        <span className="inline-flex items-center gap-1">
          <Package size={10} aria-hidden="true" />
          {materialStatusLabel(material.status)}
        </span>
      </Badge>
    </td>
  </tr>
);

export default PublicPassportPage;
