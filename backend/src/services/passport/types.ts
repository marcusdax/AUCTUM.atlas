/**
 * Install QC + Job Passport — shared server types and constants.
 *
 * Contract: docs/SPRINT_10_QC_PASSPORT.md §5–§6. Pure module (no Prisma/DB import
 * at runtime) so unit tests and the seed can use it without a database.
 */
import type { JobPhase, PassportPrivacy, QcStatus } from '@prisma/client';

// ─────────────────────────── Constants ───────────────────────────

export const QC_PHASES: readonly JobPhase[] = [
  'INSPECTION',
  'ESTIMATE',
  'PRODUCTION',
  'INVOICING',
  'COMPLETED',
];

export const QC_PHASE_LABELS: Record<JobPhase, string> = {
  INSPECTION: 'Inspection',
  ESTIMATE: 'Estimate',
  PRODUCTION: 'Production',
  INVOICING: 'Invoicing',
  COMPLETED: 'Completed',
};

export const PASSPORT_PRIVACIES: readonly PassportPrivacy[] = ['EXACT', 'STREET_ONLY', 'HIDDEN'];
export const DEFAULT_PASSPORT_PRIVACY: PassportPrivacy = 'STREET_ONLY';

/** Append-only ledger kinds written by this feature. */
export const QC_LEDGER_KIND = 'QC_RUN';
export const PASSPORT_LEDGER_KIND = 'PASSPORT_PUBLISH';

/** Public route prefix used by the admin payload (`/p/<slug>`). */
export const PUBLIC_PASSPORT_PATH_PREFIX = '/p/';

export const DIGEST_ALGORITHM = 'SHA-256' as const;
export const CANONICAL_VERSION = 'auctum.passport.v1' as const;

/** Public snapshot caps (keep the frozen payload small and privacy-safe). */
export const MAX_PUBLIC_PHOTOS = 12;
export const MAX_PUBLIC_MATERIALS = 24;
export const MAX_PUBLIC_QC_RUNS = 10;
export const MAX_PUBLIC_QC_ITEMS = 20;
export const MAX_LEDGER_ENTRIES = 20;

/** Slugs: 10-char Crockford base32 (unguessable, no I/L/O/U ambiguity). */
export const PASSPORT_SLUG_LENGTH = 10;
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// ─────────────────────────── QC types ───────────────────────────

export interface QcTemplateItem {
  key: string;
  label: string;
  required: boolean;
  requiresPhoto: boolean;
}

export interface QcTemplate {
  phase: JobPhase;
  label: string;
  items: QcTemplateItem[];
}

/** One checklist item as stored in `JobQcRun.items` (JSON). */
export interface QcRunItem extends QcTemplateItem {
  passed: boolean;
  note: string | null;
  photoUrls: string[];
}

/** API wire shape for a QC run (contract §6). */
export interface QcRunView {
  id: string;
  jobId: string;
  phase: JobPhase;
  status: QcStatus;
  items: QcRunItem[];
  score: number;
  notes: string | null;
  completedByUserId: string | null;
  completedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QcSummaryView {
  passedRuns: number;
  totalRuns: number;
  /** 0–100 share of runs that passed. */
  percent: number;
}

export interface LedgerReceipt {
  id: string;
  kind: string;
  description: string;
  createdAt: string;
}

// ─────────────────────────── Passport types ───────────────────────────

export interface PublicPassportCompany {
  name: string;
  phone: string | null;
  logoUrl: string | null;
}

export interface PublicPassportJob {
  name: string;
  phase: string;
  status: string;
  completedAt: string | null;
  /** null when privacy = HIDDEN; street-only when privacy = STREET_ONLY. */
  propertyAddress: string | null;
  photoCount: number;
}

export interface PublicPassportPhoto {
  url: string;
  name: string;
}

export interface PublicPassportMaterial {
  name: string;
  quantity: number;
  unit: string;
  supplierName: string;
  status: string;
}

export interface PublicPassportQcItem {
  label: string;
  passed: boolean;
}

export interface PublicPassportQcRun {
  phase: string;
  status: string;
  score: number;
  completedAt: string | null;
  items: PublicPassportQcItem[];
}

export interface PublicPassportLedgerEntry {
  kind: string;
  description: string;
  at: string;
}

export interface PublicPassport {
  slug: string;
  version: number;
  publishedAt: string;
  headline: string;
  summary: string | null;
  company: PublicPassportCompany;
  job: PublicPassportJob;
  photos: PublicPassportPhoto[];
  materials: PublicPassportMaterial[];
  estimates: { count: number; approvedTotal: number };
  qc: PublicPassportQcRun[];
  ledger: PublicPassportLedgerEntry[];
  verify: {
    digest: string;
    algorithm: typeof DIGEST_ALGORITHM;
    canonical: typeof CANONICAL_VERSION;
  };
}

/** Snapshot body before the self-describing `verify` block is attached. */
export type PublicPassportBody = Omit<PublicPassport, 'verify'>;

/** Admin view: all model fields except the frozen snapshot. */
export interface PassportAdminView {
  id: string;
  companyId: string;
  jobId: string;
  slug: string;
  enabled: boolean;
  privacy: PassportPrivacy;
  headline: string | null;
  summary: string | null;
  heroPhotoUrl: string | null;
  contentDigest: string | null;
  version: number;
  publishedAt: string | null;
  unpublishedAt: string | null;
  lastPublishedByUserId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  /** `/p/<slug>` when enabled. */
  publicPath: string | null;
}
