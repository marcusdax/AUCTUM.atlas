/**
 * Install QC + Job Passport — shared frontend types.
 *
 * Mirrors docs/SPRINT_10_QC_PASSPORT.md §6 exactly (QC run/template endpoints,
 * admin passport endpoints and the frozen public PublicPassport snapshot).
 * Wire data is treated defensively in the UI because the backend routes may
 * still return 501 while backend-qc lands.
 */
import type { Document } from './index';

// ─────────────────────────── QC ───────────────────────────

/** Job phases are the QC templates' phases (see §5). */
export type JobPhase = 'INSPECTION' | 'ESTIMATE' | 'PRODUCTION' | 'INVOICING' | 'COMPLETED';

export const JOB_PHASES: JobPhase[] = [
  'INSPECTION',
  'ESTIMATE',
  'PRODUCTION',
  'INVOICING',
  'COMPLETED',
];

export type QcStatus = 'DRAFT' | 'PASSED' | 'FAILED';

/** One checklist item as stored in `JobQcRun.items` (JSON). */
export interface QcItem {
  key: string;
  label: string;
  required?: boolean;
  requiresPhoto?: boolean;
  passed: boolean;
  note?: string | null;
  photoUrls?: string[];
}

export interface QcRun {
  id: string;
  jobId: string;
  phase: JobPhase;
  status: QcStatus;
  items: QcItem[];
  /** 0–100, required items only (computed by the backend). */
  score: number;
  notes?: string | null;
  completedByUserId?: string | null;
  completedAt?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

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

export interface QcSummary {
  passedRuns: number;
  totalRuns: number;
  /** 0–100 share of runs that passed. */
  percent: number;
}

/** `GET /jobs/:jobId/qc` */
export interface QcStateResponse {
  data: QcRun[];
  templates: QcTemplate[];
  summary: QcSummary;
}

/** `PATCH /jobs/:jobId/qc/:runId` — only the listed items are updated. */
export interface QcItemPatch {
  key: string;
  passed: boolean;
  note?: string;
  photoUrls?: string[];
}

export interface QcPatchBody {
  items?: QcItemPatch[];
  notes?: string;
}

export interface LedgerReceipt {
  id: string;
  kind: string;
  description: string;
  createdAt: string;
}

/** `POST /jobs/:jobId/qc/:runId/complete` */
export interface CompleteQcResponse {
  run: QcRun;
  ledgerReceipt: LedgerReceipt;
}

// ─────────────────────────── Passport (admin) ───────────────────────────

export type PassportPrivacy = 'EXACT' | 'STREET_ONLY' | 'HIDDEN';

export interface JobPassport {
  id: string;
  companyId: string;
  jobId: string;
  /** Unguessable public slug (never an internal id). */
  slug: string;
  enabled: boolean;
  privacy: PassportPrivacy;
  headline?: string | null;
  summary?: string | null;
  heroPhotoUrl?: string | null;
  /** Frozen public payload — admin view normally omits it; optional for diagnostics. */
  snapshot?: unknown;
  contentDigest?: string | null;
  version: number;
  publishedAt?: string | null;
  unpublishedAt?: string | null;
  lastPublishedByUserId?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present when enabled (`/p/<slug>`). */
  publicPath?: string | null;
}

/** `GET /jobs/:jobId/passport` */
export interface GetPassportResponse {
  passport: JobPassport | null;
  /** `/p/<slug>` when enabled, otherwise null. */
  publicPath: string | null;
}

export interface PublishPassportBody {
  privacy?: PassportPrivacy;
  headline?: string;
  summary?: string;
  heroPhotoUrl?: string | null;
}

/** `POST /jobs/:jobId/passport/publish` */
export interface PublishPassportResponse {
  passport: JobPassport;
  publicPath: string;
  contentDigest: string;
  ledgerReceipt: LedgerReceipt;
}

export interface PatchPassportBody {
  privacy?: PassportPrivacy;
  headline?: string;
  summary?: string;
  heroPhotoUrl?: string | null;
  enabled?: boolean;
}

// ─────────────────────────── Public snapshot ───────────────────────────

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
    algorithm: 'SHA-256';
    canonical: 'auctum.passport.v1';
  };
}

/** `GET /public/passport/:slug` */
export interface PublicPassportResponse {
  data: PublicPassport;
}

export interface PassportVerifyLedgerEntry {
  id: string;
  kind: string;
  description: string;
  createdAt: string;
}

/** `GET /public/passport/:slug/verify` */
export interface PassportVerifyResponse {
  verified: boolean;
  contentDigest: string;
  algorithm: 'SHA-256';
  canonical: 'auctum.passport.v1';
  checkedAt: string;
  ledger: PassportVerifyLedgerEntry[];
}

// ─────────────────────────── Admin helpers ───────────────────────────

/** Photo documents are the only evidence source for QC items (fileType = PHOTO). */
export type JobPhotoDocument = Pick<
  Document,
  'id' | 'name' | 'fileUrl' | 'fileType' | 'createdAt'
> & { size?: number };

/** Roles allowed to mutate passports (matches backend `requireRole`). */
export const PASSPORT_ADMIN_ROLES = ['OWNER', 'MANAGER'] as const;
