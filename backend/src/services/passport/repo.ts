/**
 * Install QC + Job Passport — database orchestration.
 *
 * Routes stay thin; the seed script reuses these functions so demo data takes
 * exactly the same code path (QC receipts and passport snapshots/digests) as
 * production requests. All queries are tenant-scoped by `companyId`.
 */
import { Prisma, type JobPhase } from '@prisma/client';
import { prisma } from '../../prisma';
import {
  DEFAULT_PASSPORT_PRIVACY,
  MAX_LEDGER_ENTRIES,
  MAX_PUBLIC_MATERIALS,
  MAX_PUBLIC_PHOTOS,
  MAX_PUBLIC_QC_RUNS,
  PASSPORT_LEDGER_KIND,
  QC_LEDGER_KIND,
  type LedgerReceipt,
  type PassportAdminView,
  type PublicPassport,
  type QcRunView,
} from './types';
import { QC_TEMPLATES, buildQcRunItems } from './templates';
import {
  applyQcItemPatches,
  canCompleteQcRun,
  computeQcScore,
  parseStoredItems,
  qcCompletionDescription,
  qcCompletionIdempotencyKey,
  sanitizeRunNotes,
  summarizeQcRuns,
  toQcRunView,
} from './qc';
import {
  composePublicPassport,
  computeContentDigest,
  finalizeSnapshot,
  generatePassportSlug,
  normalizePassportSlug,
  passportPublishDescription,
  passportPublishIdempotencyKey,
  publicPathFor,
  sanitizeHeadline,
  sanitizeHeroPhotoUrl,
  sanitizeSummary,
  toPassportAdminView,
  verifySnapshotDigest,
} from './passport';

/** Feature error with an HTTP status + stable machine-readable code. */
export class PassportServiceError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 400, code = 'PASSPORT_ERROR') {
    super(message);
    this.name = 'PassportServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const jobNotFound = () => new PassportServiceError('Job not found', 404, 'JOB_NOT_FOUND');

async function getTenantJob(companyId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId },
    include: { company: { select: { name: true, phone: true, logoUrl: true } } },
  });
  if (!job) throw jobNotFound();
  return job;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function ensureLedgerReceipt(input: {
  companyId: string;
  userId: string;
  jobId: string;
  kind: string;
  status: string;
  idempotencyKey: string;
  description: string;
}): Promise<LedgerReceipt> {
  const select = { id: true, kind: true, description: true, createdAt: true } as const;
  const existing = await prisma.fieldLedgerEntry.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select,
  });
  if (existing) return receiptOf(existing);

  try {
    const created = await prisma.fieldLedgerEntry.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        jobId: input.jobId,
        kind: input.kind,
        amountCents: 0,
        status: input.status,
        description: input.description,
        idempotencyKey: input.idempotencyKey,
      },
      select,
    });
    return receiptOf(created);
  } catch (error) {
    // Retries / concurrent completions: P2002 means the receipt already exists.
    if (isUniqueViolation(error)) {
      const row = await prisma.fieldLedgerEntry.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select,
      });
      if (row) return receiptOf(row);
    }
    throw error;
  }
}

function receiptOf(row: { id: string; kind: string; description: string; createdAt: Date }): LedgerReceipt {
  return {
    id: row.id,
    kind: row.kind,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─────────────────────────── QC ───────────────────────────

export interface QcState {
  data: QcRunView[];
  templates: typeof QC_TEMPLATES;
  summary: ReturnType<typeof summarizeQcRuns>;
}

export async function getQcState(companyId: string, jobId: string): Promise<QcState> {
  await getTenantJob(companyId, jobId);
  const runs = await prisma.jobQcRun.findMany({
    where: { companyId, jobId },
    orderBy: { createdAt: 'desc' },
  });
  return {
    data: runs.map(toQcRunView),
    templates: QC_TEMPLATES,
    summary: summarizeQcRuns(runs),
  };
}

export async function createQcRun(params: {
  companyId: string;
  jobId: string;
  phase: JobPhase;
  userId: string;
}): Promise<QcRunView> {
  const job = await getTenantJob(params.companyId, params.jobId);
  const existingDraft = await prisma.jobQcRun.findFirst({
    where: { companyId: params.companyId, jobId: params.jobId, phase: params.phase, status: 'DRAFT' },
    orderBy: { createdAt: 'desc' },
  });
  if (existingDraft) {
    throw new PassportServiceError(
      `A draft ${params.phase.toLowerCase()} QC run already exists for ${job.name}`,
      409,
      'QC_DRAFT_EXISTS'
    );
  }

  const items = buildQcRunItems(params.phase);
  if (items.length === 0) {
    throw new PassportServiceError(`Unknown QC phase: ${params.phase}`, 400, 'INVALID_PHASE');
  }

  const run = await prisma.jobQcRun.create({
    data: {
      companyId: params.companyId,
      jobId: params.jobId,
      phase: params.phase,
      status: 'DRAFT',
      items: items as unknown as Prisma.InputJsonValue,
      score: 0,
      createdByUserId: params.userId,
    },
  });
  return toQcRunView(run);
}

export async function patchQcRun(params: {
  companyId: string;
  jobId: string;
  runId: string;
  items?: unknown;
  notes?: unknown;
}): Promise<QcRunView> {
  await getTenantJob(params.companyId, params.jobId);
  const run = await prisma.jobQcRun.findFirst({
    where: { id: params.runId, jobId: params.jobId, companyId: params.companyId },
  });
  if (!run) throw new PassportServiceError('QC run not found', 404, 'QC_RUN_NOT_FOUND');
  if (run.status !== 'DRAFT') {
    throw new PassportServiceError('Completed QC runs are immutable', 409, 'QC_RUN_NOT_DRAFT');
  }

  const nextItems =
    params.items === undefined ? parseStoredItems(run.items) : applyQcItemPatches(run.items, params.items);
  const data: Prisma.JobQcRunUpdateInput = {
    items: nextItems as unknown as Prisma.InputJsonValue,
    score: computeQcScore(nextItems),
  };
  if (params.notes !== undefined) data.notes = sanitizeRunNotes(params.notes);

  const updated = await prisma.jobQcRun.update({ where: { id: run.id }, data });
  return toQcRunView(updated);
}

export async function completeQcRun(params: {
  companyId: string;
  jobId: string;
  runId: string;
  userId: string;
  notes?: unknown;
}): Promise<{ run: QcRunView; ledgerReceipt: LedgerReceipt }> {
  const job = await getTenantJob(params.companyId, params.jobId);
  const run = await prisma.jobQcRun.findFirst({
    where: { id: params.runId, jobId: params.jobId, companyId: params.companyId },
  });
  if (!run) throw new PassportServiceError('QC run not found', 404, 'QC_RUN_NOT_FOUND');

  // Idempotent retry: a completed run returns the original receipt, never a duplicate.
  if (run.status !== 'DRAFT') {
    const ledgerReceipt = await ensureLedgerReceipt({
      companyId: params.companyId,
      userId: params.userId,
      jobId: job.id,
      kind: QC_LEDGER_KIND,
      status: run.status,
      idempotencyKey: qcCompletionIdempotencyKey(run.id, run.status),
      description: qcCompletionDescription({
        jobName: job.name,
        phase: run.phase,
        status: run.status,
        score: run.score,
      }),
    });
    return { run: toQcRunView(run), ledgerReceipt };
  }

  const items = parseStoredItems(run.items);
  const status = canCompleteQcRun(items) ? 'PASSED' : 'FAILED';
  const score = computeQcScore(items);

  const updated = await prisma.jobQcRun.update({
    where: { id: run.id },
    data: {
      status,
      score,
      completedByUserId: params.userId,
      completedAt: new Date(),
      notes: params.notes !== undefined ? sanitizeRunNotes(params.notes) : run.notes,
    },
  });

  const ledgerReceipt = await ensureLedgerReceipt({
    companyId: params.companyId,
    userId: params.userId,
    jobId: job.id,
    kind: QC_LEDGER_KIND,
    status,
    idempotencyKey: qcCompletionIdempotencyKey(run.id, status),
    description: qcCompletionDescription({ jobName: job.name, phase: run.phase, status, score }),
  });

  return { run: toQcRunView(updated), ledgerReceipt };
}

// ─────────────────────────── Passport data gathering ───────────────────────────

interface PassportData {
  photos: Array<{ url: string; name: string }>;
  materials: Array<{ name: string; quantity: number; unit: string; supplierName: string; status: string }>;
  estimates: { count: number; approvedTotal: number };
  qc: Array<{
    phase: string;
    status: string;
    score: number;
    completedAt: Date | null;
    items: Array<{ label: string; passed: boolean }>;
  }>;
  ledger: Array<{ kind: string; description: string; at: Date }>;
}

/** Gather live job data for a new snapshot. Only whitelisted fields are selected. */
async function gatherPassportData(companyId: string, jobId: string): Promise<PassportData> {
  const [photoRows, materialOrders, approvedEstimates, qcRuns, ledgerRows] = await Promise.all([
    prisma.document.findMany({
      where: { companyId, jobId, fileType: 'PHOTO' },
      orderBy: { createdAt: 'desc' },
      take: MAX_PUBLIC_PHOTOS,
      select: { name: true, fileUrl: true },
    }),
    prisma.materialOrder.findMany({
      where: { companyId, jobId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        supplierName: true,
        status: true,
        items: { select: { name: true, quantity: true, unit: true } },
      },
    }),
    prisma.estimate.findMany({
      where: { companyId, jobId, status: 'APPROVED' },
      select: { totalPrice: true },
    }),
    prisma.jobQcRun.findMany({
      where: { companyId, jobId, status: { in: ['PASSED', 'FAILED'] } },
      orderBy: { completedAt: 'desc' },
      take: MAX_PUBLIC_QC_RUNS,
      select: { phase: true, status: true, score: true, completedAt: true, items: true },
    }),
    prisma.fieldLedgerEntry.findMany({
      where: { companyId, jobId, kind: { in: [QC_LEDGER_KIND, PASSPORT_LEDGER_KIND] } },
      orderBy: { createdAt: 'asc' },
      take: MAX_LEDGER_ENTRIES,
      select: { kind: true, description: true, createdAt: true },
    }),
  ]);

  const materials: PassportData['materials'] = [];
  for (const order of materialOrders) {
    for (const item of order.items) {
      materials.push({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        supplierName: order.supplierName,
        status: order.status,
      });
      if (materials.length >= MAX_PUBLIC_MATERIALS) break;
    }
    if (materials.length >= MAX_PUBLIC_MATERIALS) break;
  }

  return {
    photos: photoRows.map((row) => ({ url: row.fileUrl, name: row.name })),
    materials,
    estimates: {
      count: approvedEstimates.length,
      approvedTotal: approvedEstimates.reduce((sum, estimate) => sum + (estimate.totalPrice ?? 0), 0),
    },
    qc: qcRuns.map((run) => ({
      phase: run.phase,
      status: run.status,
      score: run.score,
      completedAt: run.completedAt,
      items: parseStoredItems(run.items).map((item) => ({ label: item.label, passed: item.passed })),
    })),
    ledger: ledgerRows.map((row) => ({ kind: row.kind, description: row.description, at: row.createdAt })),
  };
}

async function ensurePassportRow(
  companyId: string,
  job: { id: string },
  userId: string
): Promise<{
  id: string;
  companyId: string;
  jobId: string;
  slug: string;
  enabled: boolean;
  privacy: import('@prisma/client').PassportPrivacy;
  headline: string | null;
  summary: string | null;
  heroPhotoUrl: string | null;
  contentDigest: string | null;
  version: number;
  publishedAt: Date | null;
  unpublishedAt: Date | null;
  lastPublishedByUserId: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  snapshot: Prisma.JsonValue | null;
}> {
  const existing = await prisma.jobPassport.findUnique({ where: { jobId: job.id } });
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = generatePassportSlug();
    try {
      return await prisma.jobPassport.create({
        data: {
          companyId,
          jobId: job.id,
          slug,
          privacy: DEFAULT_PASSPORT_PRIVACY,
          createdByUserId: userId,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const byJob = await prisma.jobPassport.findUnique({ where: { jobId: job.id } });
        if (byJob) return byJob;
        continue; // slug collision: try another slug
      }
      throw error;
    }
  }
  throw new PassportServiceError('Could not allocate a public passport link', 500, 'PASSPORT_SLUG_FAILED');
}

// ─────────────────────────── Passport admin ───────────────────────────

export async function getPassportState(
  companyId: string,
  jobId: string
): Promise<{ passport: PassportAdminView | null; publicPath: string | null }> {
  await getTenantJob(companyId, jobId);
  const row = await prisma.jobPassport.findUnique({ where: { jobId } });
  if (!row) return { passport: null, publicPath: null };
  const view = toPassportAdminView(row);
  return { passport: view, publicPath: view.publicPath };
}

export interface PublishPassportBody {
  privacy?: unknown;
  headline?: unknown;
  summary?: unknown;
  heroPhotoUrl?: unknown;
}

export async function publishPassport(params: {
  companyId: string;
  jobId: string;
  userId: string;
  body: PublishPassportBody;
}): Promise<{
  passport: PassportAdminView;
  publicPath: string;
  contentDigest: string;
  ledgerReceipt: LedgerReceipt;
}> {
  const job = await getTenantJob(params.companyId, params.jobId);
  const row = await ensurePassportRow(params.companyId, job, params.userId);

  const privacy =
    params.body.privacy === 'EXACT' || params.body.privacy === 'STREET_ONLY' || params.body.privacy === 'HIDDEN'
      ? params.body.privacy
      : row.privacy;
  const headline = params.body.headline !== undefined ? sanitizeHeadline(params.body.headline) : row.headline;
  const summary = params.body.summary !== undefined ? sanitizeSummary(params.body.summary) : row.summary;
  const heroPhotoUrl =
    params.body.heroPhotoUrl !== undefined ? sanitizeHeroPhotoUrl(params.body.heroPhotoUrl) : row.heroPhotoUrl;

  const data = await gatherPassportData(params.companyId, job.id);
  const publishable =
    data.photos.length > 0 || data.materials.length > 0 || data.qc.length > 0 || data.estimates.count > 0;
  if (!publishable) {
    throw new PassportServiceError(
      'Nothing publishable yet — add job photos, materials, an approved estimate or a completed QC run first.',
      400,
      'PASSPORT_NOTHING_PUBLISHABLE'
    );
  }

  // First publish is v1; every re-publish increments the version.
  const alreadyPublished = Boolean(row.publishedAt || row.unpublishedAt || row.contentDigest);
  const version = alreadyPublished ? row.version + 1 : Math.max(1, row.version);
  const publishedAt = new Date();

  const snapshotBody = composePublicPassport({
    slug: row.slug,
    version,
    publishedAt: publishedAt.toISOString(),
    headline,
    summary,
    privacy,
    company: job.company,
    job: {
      name: job.name,
      phase: job.phase,
      status: job.status,
      completedAt: job.endDate,
      propertyAddress: job.propertyAddress,
    },
    photos: data.photos,
    materials: data.materials,
    estimates: data.estimates,
    qc: data.qc,
    ledger: data.ledger,
  });
  const contentDigest = computeContentDigest(snapshotBody);
  const snapshot = finalizeSnapshot(snapshotBody, contentDigest);

  const updated = await prisma.jobPassport.update({
    where: { id: row.id },
    data: {
      enabled: true,
      privacy,
      headline,
      summary,
      heroPhotoUrl,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      contentDigest,
      version,
      publishedAt,
      unpublishedAt: null,
      lastPublishedByUserId: params.userId,
    },
  });

  const ledgerReceipt = await ensureLedgerReceipt({
    companyId: params.companyId,
    userId: params.userId,
    jobId: job.id,
    kind: PASSPORT_LEDGER_KIND,
    status: 'PUBLISHED',
    idempotencyKey: passportPublishIdempotencyKey(row.id, version, contentDigest),
    description: passportPublishDescription(job.name, version),
  });

  return {
    passport: toPassportAdminView(updated),
    publicPath: publicPathFor(updated.slug),
    contentDigest,
    ledgerReceipt,
  };
}

export interface PatchPassportBody {
  privacy?: unknown;
  headline?: unknown;
  summary?: unknown;
  heroPhotoUrl?: unknown;
  enabled?: unknown;
}

export async function patchPassport(params: {
  companyId: string;
  jobId: string;
  userId: string;
  body: PatchPassportBody;
}): Promise<PassportAdminView> {
  await getTenantJob(params.companyId, params.jobId);
  const row = await prisma.jobPassport.findUnique({ where: { jobId: params.jobId } });
  if (!row) throw new PassportServiceError('Job passport not found', 404, 'PASSPORT_NOT_FOUND');

  const data: Prisma.JobPassportUpdateInput = {};
  if (params.body.privacy !== undefined) {
    if (params.body.privacy !== 'EXACT' && params.body.privacy !== 'STREET_ONLY' && params.body.privacy !== 'HIDDEN') {
      throw new PassportServiceError('Invalid privacy value', 400, 'INVALID_PRIVACY');
    }
    // Privacy/headline apply to the admin row immediately; the public snapshot
    // changes on the next publish (frozen-snapshot contract).
    data.privacy = params.body.privacy;
  }
  if (params.body.headline !== undefined) data.headline = sanitizeHeadline(params.body.headline);
  if (params.body.summary !== undefined) data.summary = sanitizeSummary(params.body.summary);
  if (params.body.heroPhotoUrl !== undefined) data.heroPhotoUrl = sanitizeHeroPhotoUrl(params.body.heroPhotoUrl);

  if (params.body.enabled !== undefined) {
    if (typeof params.body.enabled !== 'boolean') {
      throw new PassportServiceError('enabled must be a boolean', 400, 'INVALID_ENABLED');
    }
    if (params.body.enabled === false) {
      if (row.enabled) {
        data.enabled = false;
        data.publishedAt = null;
        data.unpublishedAt = new Date();
      }
    } else if (!row.snapshot) {
      throw new PassportServiceError('Publish the passport before enabling it', 400, 'PASSPORT_NOT_PUBLISHED');
    } else if (!row.enabled) {
      data.enabled = true;
      data.unpublishedAt = null;
      data.publishedAt = row.publishedAt ?? new Date();
    }
  }

  if (Object.keys(data).length === 0) return toPassportAdminView(row);
  const updated = await prisma.jobPassport.update({ where: { id: row.id }, data });
  return toPassportAdminView(updated);
}

export async function unpublishPassport(params: { companyId: string; jobId: string }): Promise<{ ok: true }> {
  await getTenantJob(params.companyId, params.jobId);
  const row = await prisma.jobPassport.findUnique({ where: { jobId: params.jobId } });
  if (!row) throw new PassportServiceError('Job passport not found', 404, 'PASSPORT_NOT_FOUND');
  if (row.enabled) {
    await prisma.jobPassport.update({
      where: { id: row.id },
      data: { enabled: false, publishedAt: null, unpublishedAt: new Date() },
    });
  }
  return { ok: true };
}

// ─────────────────────────── Public ───────────────────────────

export async function getPublicPassport(slugInput: string): Promise<PublicPassport> {
  const slug = normalizePassportSlug(slugInput);
  if (!slug) throw new PassportServiceError('Job passport not found', 404, 'PASSPORT_NOT_FOUND');
  const row = await prisma.jobPassport.findUnique({
    where: { slug },
    select: { enabled: true, snapshot: true },
  });
  if (!row || !row.enabled || !row.snapshot) {
    throw new PassportServiceError('Job passport not found', 404, 'PASSPORT_NOT_FOUND');
  }
  return row.snapshot as unknown as PublicPassport;
}

export interface PassportVerification {
  verified: boolean;
  contentDigest: string;
  algorithm: 'SHA-256';
  canonical: 'auctum.passport.v1';
  checkedAt: string;
  ledger: Array<{ id: string; kind: string; description: string; createdAt: string }>;
}

export async function verifyPublicPassport(slugInput: string): Promise<PassportVerification> {
  const slug = normalizePassportSlug(slugInput);
  if (!slug) throw new PassportServiceError('Job passport not found', 404, 'PASSPORT_NOT_FOUND');
  const row = await prisma.jobPassport.findUnique({
    where: { slug },
    select: {
      companyId: true,
      jobId: true,
      enabled: true,
      snapshot: true,
      contentDigest: true,
    },
  });
  if (!row || !row.enabled || !row.snapshot) {
    throw new PassportServiceError('Job passport not found', 404, 'PASSPORT_NOT_FOUND');
  }

  const { verified, recomputed } = verifySnapshotDigest(row.snapshot, row.contentDigest);
  const ledgerRows = await prisma.fieldLedgerEntry.findMany({
    where: {
      companyId: row.companyId,
      jobId: row.jobId,
      kind: { in: [QC_LEDGER_KIND, PASSPORT_LEDGER_KIND] },
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_LEDGER_ENTRIES,
    select: { id: true, kind: true, description: true, createdAt: true },
  });

  return {
    verified,
    contentDigest: row.contentDigest ?? recomputed,
    algorithm: 'SHA-256',
    canonical: 'auctum.passport.v1',
    checkedAt: new Date().toISOString(),
    ledger: ledgerRows.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      description: entry.description,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}
