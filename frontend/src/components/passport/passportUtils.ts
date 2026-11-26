/**
 * Pure helpers for Install QC + Job Passport UI.
 *
 * Deterministic and side-effect free so they can be unit tested without a backend
 * (see passportUtils.test.ts). Components render whatever the API returns; these
 * helpers only derive labels, badges, completeness hints and display strings.
 */
import { resolveFileUrl } from '../../services/api';
import type {
  JobPassport,
  JobPhase,
  QcRun,
  QcTemplate,
  QcTemplateItem,
  PassportPrivacy,
} from '../../types/passport';
import { PASSPORT_ADMIN_ROLES } from '../../types/passport';
import type { BadgeVariant } from '../ui/Card';

// ─────────────────────────── Phases ───────────────────────────

export const PHASE_LABELS: Record<JobPhase, string> = {
  INSPECTION: 'Inspection',
  ESTIMATE: 'Estimate',
  PRODUCTION: 'Production',
  INVOICING: 'Invoicing',
  COMPLETED: 'Completed',
};

export const PHASE_ORDER: JobPhase[] = [
  'INSPECTION',
  'ESTIMATE',
  'PRODUCTION',
  'INVOICING',
  'COMPLETED',
];

/** Human phase label; tolerant of arbitrary strings from the public snapshot. */
export function phaseLabel(phase: unknown): string {
  const key = String(phase ?? '').toUpperCase() as JobPhase;
  return PHASE_LABELS[key] ?? (key ? key.replace(/_/g, ' ') : 'Unknown phase');
}

// ─────────────────────────── QC status / score ───────────────────────────

export function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function qcStatusLabel(status: unknown): string {
  switch (String(status ?? '').toUpperCase()) {
    case 'PASSED':
      return 'Passed';
    case 'FAILED':
      return 'Failed';
    case 'DRAFT':
      return 'Draft';
    default:
      return 'Unknown';
  }
}

export function qcStatusBadgeVariant(status: unknown): BadgeVariant {
  switch (String(status ?? '').toUpperCase()) {
    case 'PASSED':
      return 'success';
    case 'FAILED':
      return 'danger';
    default:
      return 'default';
  }
}

/** `86 / 100` — always includes the number next to any colour cue. */
export function formatScore(score: unknown): string {
  return `${clampScore(score)} / 100`;
}

/** `82%` (clamped 0–100). */
export function formatPercent(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '0%';
  return `${Math.max(0, Math.min(100, Math.round(n)))}%`;
}

// ─────────────────────────── Runs / templates ───────────────────────────

/** Latest run per phase (runs arrive ordered by createdAt desc, but be defensive). */
export function latestRunsByPhase(runs: QcRun[] | null | undefined): Partial<Record<JobPhase, QcRun>> {
  const byPhase: Partial<Record<JobPhase, QcRun>> = {};
  for (const run of runs ?? []) {
    if (!run?.phase) continue;
    const existing = byPhase[run.phase];
    const runTime = new Date(run.createdAt ?? 0).getTime();
    const existingTime = existing ? new Date(existing.createdAt ?? 0).getTime() : -Infinity;
    if (!existing || runTime >= existingTime) byPhase[run.phase] = run;
  }
  return byPhase;
}

export function templateForPhase(
  templates: QcTemplate[] | null | undefined,
  phase: JobPhase
): QcTemplate | undefined {
  return (templates ?? []).find((template) => template.phase === phase);
}

export interface QcCompleteness {
  requiredTotal: number;
  /** Required items that pass AND satisfy their photo requirement. */
  requiredPassed: number;
  photoRequiredTotal: number;
  photoSatisfied: number;
  /** Labels of required items still missing a pass/photo. */
  missingRequired: string[];
  complete: boolean;
  percent: number;
}

/**
 * Client-side completeness hint for a DRAFT run. The backend remains the source of
 * truth for PASSED/FAILED; this only tells the operator what is left to do.
 */
export function qcCompleteness(
  run: Pick<QcRun, 'items'> | null | undefined,
  template?: Pick<QcTemplate, 'items'> | null
): QcCompleteness {
  const items = Array.isArray(run?.items) ? run!.items : [];
  const templateItems = new Map<string, QcTemplateItem>(
    (template?.items ?? []).map((item) => [item.key, item])
  );

  let requiredTotal = 0;
  let requiredPassed = 0;
  let photoRequiredTotal = 0;
  let photoSatisfied = 0;
  const missingRequired: string[] = [];

  for (const item of items) {
    const templateItem = templateItems.get(item.key);
    const required = Boolean(item.required ?? templateItem?.required);
    const requiresPhoto = Boolean(item.requiresPhoto ?? templateItem?.requiresPhoto);
    const hasPhoto = Array.isArray(item.photoUrls) && item.photoUrls.length > 0;
    const photoOk = !requiresPhoto || hasPhoto;
    if (requiresPhoto) {
      photoRequiredTotal += 1;
      if (hasPhoto) photoSatisfied += 1;
    }
    if (!required) continue;
    requiredTotal += 1;
    if (item.passed && photoOk) requiredPassed += 1;
    else missingRequired.push(item.label || item.key);
  }

  const percent = requiredTotal > 0 ? Math.round((requiredPassed / requiredTotal) * 100) : 0;
  return {
    requiredTotal,
    requiredPassed,
    photoRequiredTotal,
    photoSatisfied,
    missingRequired,
    complete: requiredTotal > 0 && requiredPassed === requiredTotal,
    percent,
  };
}

// ─────────────────────────── Privacy / address ───────────────────────────

export function privacyLabel(privacy: unknown): string {
  switch (String(privacy ?? '').toUpperCase()) {
    case 'EXACT':
      return 'Exact address';
    case 'STREET_ONLY':
      return 'Street only';
    case 'HIDDEN':
      return 'Hidden';
    default:
      return 'Street only';
  }
}

export function privacyDescription(privacy: unknown): string {
  switch (String(privacy ?? '').toUpperCase()) {
    case 'EXACT':
      return 'Shows the full property address on the public page.';
    case 'HIDDEN':
      return 'Shows no address at all on the public page.';
    default:
      return 'Shows the street name only (house number removed) on the public page.';
  }
}

export const PRIVACY_OPTIONS: Array<{ value: PassportPrivacy; label: string }> = [
  { value: 'EXACT', label: 'Exact address' },
  { value: 'STREET_ONLY', label: 'Street only' },
  { value: 'HIDDEN', label: 'Hidden' },
];

/**
 * Privacy-respecting address rendering for the public page. The API already
 * sanitizes the value; this only supplies honest copy when it is withheld.
 */
export function addressDisplay(
  address: string | null | undefined,
  privacy?: PassportPrivacy | string | null
): string {
  if (address && address.trim()) return address.trim();
  if (String(privacy ?? '').toUpperCase() === 'HIDDEN') return 'Address kept private';
  return 'Address shared on request';
}

// ─────────────────────────── Passport links / digest ───────────────────────────

/** Admin public path for a slug (`/p/<slug>`). */
export function publicPathFor(slug: string | null | undefined): string | null {
  const value = String(slug ?? '').trim();
  return value ? `/p/${value}` : null;
}

/** Absolute public URL used by the copy button and QR code. */
export function buildPublicUrl(slug: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== 'undefined' && window.location ? window.location.origin : '');
  const cleanBase = base.replace(/\/+$/, '');
  return `${cleanBase}/p/${encodeURIComponent(String(slug ?? '').trim())}`;
}

/** Short digest for UI (`a1b2c3d4e5f6…`); full digest stays in the verify card. */
export function shortDigest(digest: string | null | undefined, chars = 12): string {
  const value = String(digest ?? '').trim();
  if (!value) return '—';
  if (value.length <= chars) return value;
  return `${value.slice(0, chars)}…`;
}

export function verifyLabel(verified: boolean | null | undefined): string {
  if (verified === true) return 'Verified';
  if (verified === false) return 'Not verified';
  return 'Verifying…';
}

export function verifyBadgeVariant(verified: boolean | null | undefined): BadgeVariant {
  if (verified === true) return 'success';
  if (verified === false) return 'danger';
  return 'default';
}

/** True when the signed-in role may mutate passport settings. */
export function isPassportAdmin(role: string | null | undefined): boolean {
  return Boolean(role) && (PASSPORT_ADMIN_ROLES as readonly string[]).includes(String(role));
}

/** Admin view helpers: is there a published record? */
export function isPassportPublished(passport: JobPassport | null | undefined): boolean {
  return Boolean(passport?.enabled && passport?.publishedAt);
}

// ─────────────────────────── Formatting ───────────────────────────

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatCurrency(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

/** `2 approved estimates · $145,000` */
export function estimatesSummary(count: unknown, approvedTotal: unknown): string {
  const n = Number(count) || 0;
  const label = `${n} approved estimate${n === 1 ? '' : 's'}`;
  if (!approvedTotal) return label;
  return `${label} · ${formatCurrency(approvedTotal)}`;
}

/** Human label for a ledger entry kind (`QC_COMPLETED` → `QC completed`). */
export function ledgerKindLabel(kind: unknown): string {
  const raw = String(kind ?? '').trim();
  if (!raw) return 'Record';
  const words = raw.toLowerCase().replace(/[_-]+/g, ' ').trim().split(/\s+/);
  return words
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** Human label for a material order status. */
export function materialStatusLabel(status: unknown): string {
  const raw = String(status ?? '').trim();
  if (!raw) return 'Unknown';
  return raw
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Resolve an uploaded file path for photo/logo rendering. */
export function resolvePhotoUrl(fileUrl: string | null | undefined): string {
  if (!fileUrl) return '';
  return resolveFileUrl(fileUrl);
}

/** `12 photos` */
export function photoCountLabel(count: unknown): string {
  const n = Number(count) || 0;
  return `${n} photo${n === 1 ? '' : 's'}`;
}

/** The job phase a new QC run should default to. */
export function defaultQcPhase(
  jobPhase: unknown,
  runsByPhase: Partial<Record<JobPhase, QcRun>>
): JobPhase {
  const normalised = String(jobPhase ?? '').toUpperCase() as JobPhase;
  if (PHASE_ORDER.includes(normalised)) return normalised;
  const draft = PHASE_ORDER.find((phase) => runsByPhase[phase]?.status === 'DRAFT');
  return draft ?? 'INSPECTION';
}
