/**
 * Job Passport — pure slug / privacy / sanitizer / digest helpers.
 *
 * Public payloads are built here from explicit inputs: nothing from Prisma rows
 * is spread into the snapshot, so internal IDs, customer PII, notes and staff
 * identities cannot leak by accident. The digest is
 * `sha256Hex(canonicalJson(snapshotWithoutVerify))` using the platform's
 * canonical-JSON helper (`services/field/evidence.ts`).
 */
import { randomBytes } from 'node:crypto';
import { canonicalJson, sha256Hex } from '../field/evidence';
import {
  CANONICAL_VERSION,
  CROCKFORD_ALPHABET,
  DIGEST_ALGORITHM,
  MAX_LEDGER_ENTRIES,
  MAX_PUBLIC_MATERIALS,
  MAX_PUBLIC_PHOTOS,
  MAX_PUBLIC_QC_ITEMS,
  MAX_PUBLIC_QC_RUNS,
  PASSPORT_LEDGER_KIND,
  PASSPORT_SLUG_LENGTH,
  PUBLIC_PASSPORT_PATH_PREFIX,
  type PassportAdminView,
  type PublicPassport,
  type PublicPassportBody,
} from './types';
import type { PassportPrivacy } from '@prisma/client';

// ─────────────────────────── Slugs ───────────────────────────

/**
 * Unguessable 10-char Crockford base32 slug (50 bits of entropy).
 * `randomBytesFn` is injectable so tests can assert charset/length deterministically.
 */
export function generatePassportSlug(randomBytesFn: (size: number) => Buffer = randomBytes): string {
  const bytes = randomBytesFn(PASSPORT_SLUG_LENGTH);
  let slug = '';
  for (let index = 0; index < PASSPORT_SLUG_LENGTH; index += 1) {
    slug += CROCKFORD_ALPHABET[bytes[index] % CROCKFORD_ALPHABET.length];
  }
  return slug;
}

const SLUG_PATTERN = /^[0-9A-HJKMNP-TV-Z]{6,64}$/;

/** Normalise a user-supplied slug for lookup (uppercase Crockford only). */
export function normalizePassportSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toUpperCase();
  if (!value || !SLUG_PATTERN.test(value)) return null;
  return value;
}

export function publicPathFor(slug: string): string {
  return `${PUBLIC_PASSPORT_PATH_PREFIX}${slug}`;
}

// ─────────────────────────── Sanitizers ───────────────────────────

const MAX_ADDRESS = 300;
const MAX_PHOTO_NAME = 160;
const MAX_HEADLINE = 160;
const MAX_SUMMARY = 1_200;
const MAX_MATERIAL_NAME = 120;
const MAX_UNIT = 20;
const MAX_SUPPLIER = 120;
const MAX_DESCRIPTION = 240;
const MAX_LABEL = 200;

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Privacy-respecting property address (contract §6):
 *   EXACT       → full address
 *   STREET_ONLY → address up to the first comma, e.g. `700 Heritage Pkwy`
 *   HIDDEN      → null
 */
export function sanitizePropertyAddress(address: unknown, privacy: PassportPrivacy | string | null | undefined): string | null {
  const full = cleanString(address, MAX_ADDRESS);
  if (!full) return null;
  switch (String(privacy ?? '').toUpperCase()) {
    case 'HIDDEN':
      return null;
    case 'EXACT':
      return full;
    case 'STREET_ONLY':
    default: {
      const firstSegment = full.split(',')[0]?.trim();
      return firstSegment ? firstSegment.slice(0, MAX_ADDRESS) : full;
    }
  }
}

/** Only http(s) and locally-served `/uploads/...` evidence URLs are published. */
export function normalizePhotoUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url || url.length > 1_000) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/uploads/')) return url;
  if (url.startsWith('uploads/')) return url;
  return null;
}

export function sanitizeHeadline(value: unknown): string | null {
  return cleanString(value, MAX_HEADLINE);
}

export function sanitizeSummary(value: unknown): string | null {
  return cleanString(value, MAX_SUMMARY);
}

export function sanitizeHeroPhotoUrl(value: unknown): string | null {
  if (value === null) return null;
  return normalizePhotoUrl(value);
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampNumber(value: unknown, min: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.round(n * 100) / 100);
}

// ─────────────────────────── Snapshot composer ───────────────────────────

export interface ComposePassportInput {
  slug: string;
  version: number;
  publishedAt: string;
  headline: string | null;
  summary: string | null;
  privacy: PassportPrivacy | string | null | undefined;
  company: { name: unknown; phone: unknown; logoUrl: unknown };
  job: {
    name: unknown;
    phase: unknown;
    status: unknown;
    completedAt: unknown;
    propertyAddress: unknown;
  };
  photos: Array<{ url: unknown; name: unknown }>;
  materials: Array<{
    name: unknown;
    quantity: unknown;
    unit: unknown;
    supplierName: unknown;
    status: unknown;
  }>;
  estimates: { count: unknown; approvedTotal: unknown };
  qc: Array<{
    phase: unknown;
    status: unknown;
    score: unknown;
    completedAt: unknown;
    items: Array<{ label: unknown; passed: unknown }>;
  }>;
  ledger: Array<{ kind: unknown; description: unknown; at: unknown }>;
}

function sanitizePhotos(photos: ComposePassportInput['photos']): PublicPassport['photos'] {
  const out: PublicPassport['photos'] = [];
  for (const photo of Array.isArray(photos) ? photos : []) {
    const url = normalizePhotoUrl(photo?.url);
    if (!url) continue;
    out.push({
      url,
      name: cleanString(photo?.name, MAX_PHOTO_NAME) ?? `Job photo ${out.length + 1}`,
    });
    if (out.length >= MAX_PUBLIC_PHOTOS) break;
  }
  return out;
}

function sanitizeMaterials(materials: ComposePassportInput['materials']): PublicPassport['materials'] {
  const out: PublicPassport['materials'] = [];
  for (const material of Array.isArray(materials) ? materials : []) {
    const name = cleanString(material?.name, MAX_MATERIAL_NAME);
    if (!name) continue;
    out.push({
      name,
      quantity: clampNumber(material?.quantity, 0),
      unit: cleanString(material?.unit, MAX_UNIT) ?? 'unit',
      supplierName: cleanString(material?.supplierName, MAX_SUPPLIER) ?? 'Supplier',
      status: cleanString(material?.status, 40)?.toUpperCase() ?? 'UNKNOWN',
    });
    if (out.length >= MAX_PUBLIC_MATERIALS) break;
  }
  return out;
}

function sanitizeQcRuns(runs: ComposePassportInput['qc']): PublicPassport['qc'] {
  const out: PublicPassport['qc'] = [];
  for (const run of Array.isArray(runs) ? runs : []) {
    const status = cleanString(run?.status, 20)?.toUpperCase();
    if (status !== 'PASSED' && status !== 'FAILED') continue; // sign-offs only, never internal DRAFTs
    const items: PublicPassport['qc'][number]['items'] = [];
    for (const item of Array.isArray(run?.items) ? run.items : []) {
      const label = cleanString(item?.label, MAX_LABEL);
      if (!label) continue;
      items.push({ label, passed: item?.passed === true });
      if (items.length >= MAX_PUBLIC_QC_ITEMS) break;
    }
    out.push({
      phase: cleanString(run?.phase, 40)?.toUpperCase() ?? 'UNKNOWN',
      status,
      score: clampInt(run?.score, 0, 100),
      completedAt: isoOrNull(run?.completedAt),
      items,
    });
    if (out.length >= MAX_PUBLIC_QC_RUNS) break;
  }
  return out;
}

function sanitizeLedger(entries: ComposePassportInput['ledger']): PublicPassport['ledger'] {
  const out: PublicPassport['ledger'] = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const kind = cleanString(entry?.kind, 40);
    const description = cleanString(entry?.description, MAX_DESCRIPTION);
    const at = isoOrNull(entry?.at);
    if (!kind || !description || !at) continue;
    out.push({ kind: kind.toUpperCase(), description, at });
    if (out.length >= MAX_LEDGER_ENTRIES) break;
  }
  return out;
}

/**
 * Build the frozen public payload. Every field is explicitly mapped and
 * sanitized — no `...spread` of database rows is ever used here.
 */
export function composePublicPassport(input: ComposePassportInput): PublicPassportBody {
  const photos = sanitizePhotos(input.photos);
  const headline =
    sanitizeHeadline(input.headline) ??
    sanitizeHeadline(input.job?.name) ??
    'Verified roof record';

  return {
    slug: input.slug,
    version: clampInt(input.version, 1, 1_000_000),
    publishedAt: isoOrNull(input.publishedAt) ?? new Date(0).toISOString(),
    headline,
    summary: sanitizeSummary(input.summary),
    company: {
      name: cleanString(input.company?.name, 160) ?? 'Roofing company',
      phone: cleanString(input.company?.phone, 40),
      logoUrl: normalizePhotoUrl(input.company?.logoUrl),
    },
    job: {
      name: cleanString(input.job?.name, 160) ?? 'Roofing job',
      phase: cleanString(input.job?.phase, 40)?.toUpperCase() ?? 'UNKNOWN',
      status: cleanString(input.job?.status, 40)?.toUpperCase() ?? 'UNKNOWN',
      completedAt: isoOrNull(input.job?.completedAt),
      propertyAddress: sanitizePropertyAddress(input.job?.propertyAddress, input.privacy),
      photoCount: photos.length,
    },
    photos,
    materials: sanitizeMaterials(input.materials),
    estimates: {
      count: clampInt(input.estimates?.count, 0, 10_000),
      approvedTotal: clampNumber(input.estimates?.approvedTotal, 0),
    },
    qc: sanitizeQcRuns(input.qc),
    ledger: sanitizeLedger(input.ledger),
  };
}

/** Attach the self-describing verify block to a composed body. */
export function finalizeSnapshot(body: PublicPassportBody, digest: string): PublicPassport {
  return {
    ...body,
    verify: {
      digest,
      algorithm: DIGEST_ALGORITHM,
      canonical: CANONICAL_VERSION,
    },
  };
}

/**
 * `sha256Hex(canonicalJson(snapshot))` — the `verify` block itself is excluded so
 * the digest is not self-referential.
 */
export function computeContentDigest(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== 'object') return sha256Hex(canonicalJson(snapshot));
  const record = snapshot as Record<string, unknown>;
  const body: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    if (key === 'verify') continue;
    body[key] = record[key];
  }
  return sha256Hex(canonicalJson(body));
}

/** Recompute the digest and compare it with the stored value. */
export function verifySnapshotDigest(
  snapshot: unknown,
  contentDigest: string | null | undefined
): { verified: boolean; recomputed: string } {
  const recomputed = computeContentDigest(snapshot);
  const stored = typeof contentDigest === 'string' ? contentDigest : '';
  const verify = snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>).verify : null;
  const embedded =
    verify && typeof verify === 'object' ? String((verify as Record<string, unknown>).digest ?? '') : '';
  return {
    verified: Boolean(stored) && recomputed === stored && embedded === stored,
    recomputed,
  };
}

/** Deterministic publish idempotency key: version + digest make retries no-ops. */
export function passportPublishIdempotencyKey(
  passportId: string,
  version: number,
  digest: string
): string {
  return `passport:${passportId}:v${clampInt(version, 1, 1_000_000)}:${digest}`;
}

export function passportPublishDescription(jobName: string, version: number): string {
  return `${PASSPORT_LEDGER_KIND.replace(/_/g, ' ')} · ${jobName} · v${clampInt(version, 1, 1_000_000)}`;
}

// ─────────────────────────── Admin view ───────────────────────────

export function toPassportAdminView(row: {
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
  publishedAt: Date | string | null;
  unpublishedAt: Date | string | null;
  lastPublishedByUserId: string | null;
  createdByUserId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}): PassportAdminView {
  return {
    id: row.id,
    companyId: row.companyId,
    jobId: row.jobId,
    slug: row.slug,
    enabled: row.enabled,
    privacy: row.privacy,
    headline: row.headline ?? null,
    summary: row.summary ?? null,
    heroPhotoUrl: row.heroPhotoUrl ?? null,
    contentDigest: row.contentDigest ?? null,
    version: row.version,
    publishedAt: isoOrNull(row.publishedAt),
    unpublishedAt: isoOrNull(row.unpublishedAt),
    lastPublishedByUserId: row.lastPublishedByUserId ?? null,
    createdByUserId: row.createdByUserId ?? null,
    createdAt: isoOrNull(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: isoOrNull(row.updatedAt) ?? new Date(0).toISOString(),
    publicPath: row.enabled ? publicPathFor(row.slug) : null,
  };
}
