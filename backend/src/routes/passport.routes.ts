/**
 * Install QC + Job Passport — protected routes.
 * Mounted at /api/v1/jobs (after the base jobs router).
 *
 * Contract: docs/SPRINT_10_QC_PASSPORT.md §6. Every query is tenant-scoped by
 * `req.user.companyId`; cross-tenant job ids behave as 404. Passport mutations
 * are gated to OWNER/MANAGER (frontend hides the actions from other roles);
 * QC runs stay available to any authenticated company member.
 */
import { Router, type NextFunction, type Response } from 'express';
import { requireRole, type AuthRequest } from '../middleware/auth';
import {
  completeQcRun,
  createQcRun,
  getPassportState,
  getQcState,
  patchPassport,
  patchQcRun,
  publishPassport,
  unpublishPassport,
  PassportServiceError,
  type PatchPassportBody,
  type PublishPassportBody,
} from '../services/passport/repo';
import { isQcPhase } from '../services/passport/templates';
import { PASSPORT_PRIVACIES } from '../services/passport/types';

const router = Router();

const PASSPORT_ADMIN_ROLES = ['OWNER', 'MANAGER'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────── helpers ───────────────────────────

type AsyncHandler = (req: AuthRequest, res: Response) => Promise<unknown> | unknown;

function handle(fn: AsyncHandler) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

function fail(res: Response, status: number, error: string, code?: string) {
  return res.status(status).json({ error, ...(code ? { code } : {}) });
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function asObject(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function isPrivacy(value: unknown): boolean {
  return typeof value === 'string' && (PASSPORT_PRIVACIES as readonly string[]).includes(value);
}

/** Validate the passport publish/patch body field types before touching the service. */
function validatePassportBody(
  body: Record<string, unknown>,
  opts: { allowEnabled: boolean }
): string | null {
  if (body.privacy !== undefined && !isPrivacy(body.privacy)) return 'privacy must be EXACT, STREET_ONLY or HIDDEN';
  if (body.headline !== undefined && typeof body.headline !== 'string') return 'headline must be a string';
  if (body.summary !== undefined && typeof body.summary !== 'string') return 'summary must be a string';
  if (
    body.heroPhotoUrl !== undefined &&
    body.heroPhotoUrl !== null &&
    typeof body.heroPhotoUrl !== 'string'
  ) {
    return 'heroPhotoUrl must be a string or null';
  }
  if (opts.allowEnabled && body.enabled !== undefined && typeof body.enabled !== 'boolean') {
    return 'enabled must be a boolean';
  }
  return null;
}

// ─────────────────────────── QC ───────────────────────────

// GET /jobs/:jobId/qc — runs + canonical templates + summary
router.get(
  '/:jobId/qc',
  handle(async (req, res) => {
    if (!req.user) return fail(res, 401, 'Not authenticated', 'AUTH_NOT_AUTHENTICATED');
    if (!isUuid(req.params.jobId)) return fail(res, 400, 'Invalid job id', 'INVALID_JOB_ID');
    res.json(await getQcState(req.user.companyId, req.params.jobId));
  })
);

// POST /jobs/:jobId/qc — create a DRAFT run from the phase template (409 when one exists)
router.post(
  '/:jobId/qc',
  handle(async (req, res) => {
    if (!req.user) return fail(res, 401, 'Not authenticated', 'AUTH_NOT_AUTHENTICATED');
    if (!isUuid(req.params.jobId)) return fail(res, 400, 'Invalid job id', 'INVALID_JOB_ID');
    const body = asObject(req.body) ?? {};
    if (!isQcPhase(body.phase)) {
      return fail(res, 400, 'phase must be one of INSPECTION, ESTIMATE, PRODUCTION, INVOICING, COMPLETED', 'INVALID_PHASE');
    }
    const run = await createQcRun({
      companyId: req.user.companyId,
      jobId: req.params.jobId,
      phase: body.phase,
      userId: req.user.id,
    });
    res.status(201).json({ run });
  })
);

// PATCH /jobs/:jobId/qc/:runId — update DRAFT items/notes (unknown keys ignored)
router.patch(
  '/:jobId/qc/:runId',
  handle(async (req, res) => {
    if (!req.user) return fail(res, 401, 'Not authenticated', 'AUTH_NOT_AUTHENTICATED');
    if (!isUuid(req.params.jobId)) return fail(res, 400, 'Invalid job id', 'INVALID_JOB_ID');
    if (!isUuid(req.params.runId)) return fail(res, 400, 'Invalid QC run id', 'INVALID_QC_RUN_ID');
    const body = asObject(req.body) ?? {};
    if (body.items !== undefined && !Array.isArray(body.items)) {
      return fail(res, 400, 'items must be an array', 'INVALID_ITEMS');
    }
    if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
      return fail(res, 400, 'notes must be a string', 'INVALID_NOTES');
    }
    const run = await patchQcRun({
      companyId: req.user.companyId,
      jobId: req.params.jobId,
      runId: req.params.runId,
      items: body.items,
      notes: body.notes,
    });
    res.json({ run });
  })
);

// POST /jobs/:jobId/qc/:runId/complete — PASSED/FAILED + append-only ledger receipt
router.post(
  '/:jobId/qc/:runId/complete',
  handle(async (req, res) => {
    if (!req.user) return fail(res, 401, 'Not authenticated', 'AUTH_NOT_AUTHENTICATED');
    if (!isUuid(req.params.jobId)) return fail(res, 400, 'Invalid job id', 'INVALID_JOB_ID');
    if (!isUuid(req.params.runId)) return fail(res, 400, 'Invalid QC run id', 'INVALID_QC_RUN_ID');
    const body = asObject(req.body) ?? {};
    if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
      return fail(res, 400, 'notes must be a string', 'INVALID_NOTES');
    }
    const result = await completeQcRun({
      companyId: req.user.companyId,
      jobId: req.params.jobId,
      runId: req.params.runId,
      userId: req.user.id,
      notes: body.notes,
    });
    res.json(result);
  })
);

// ─────────────────────────── Passport (admin) ───────────────────────────

// GET /jobs/:jobId/passport — admin view + public path when enabled
router.get(
  '/:jobId/passport',
  handle(async (req, res) => {
    if (!req.user) return fail(res, 401, 'Not authenticated', 'AUTH_NOT_AUTHENTICATED');
    if (!isUuid(req.params.jobId)) return fail(res, 400, 'Invalid job id', 'INVALID_JOB_ID');
    res.json(await getPassportState(req.user.companyId, req.params.jobId));
  })
);

// POST /jobs/:jobId/passport/publish — create/re-freeze snapshot, bump version
router.post(
  '/:jobId/passport/publish',
  requireRole(...PASSPORT_ADMIN_ROLES),
  handle(async (req, res) => {
    if (!req.user) return fail(res, 401, 'Not authenticated', 'AUTH_NOT_AUTHENTICATED');
    if (!isUuid(req.params.jobId)) return fail(res, 400, 'Invalid job id', 'INVALID_JOB_ID');
    const body = asObject(req.body) ?? {};
    const bodyError = validatePassportBody(body, { allowEnabled: false });
    if (bodyError) return fail(res, 400, bodyError, 'INVALID_PASSPORT_BODY');
    const result = await publishPassport({
      companyId: req.user.companyId,
      jobId: req.params.jobId,
      userId: req.user.id,
      body: body as PublishPassportBody,
    });
    res.json(result);
  })
);

// PATCH /jobs/:jobId/passport — update settings; `enabled:false` unpublishes
router.patch(
  '/:jobId/passport',
  requireRole(...PASSPORT_ADMIN_ROLES),
  handle(async (req, res) => {
    if (!req.user) return fail(res, 401, 'Not authenticated', 'AUTH_NOT_AUTHENTICATED');
    if (!isUuid(req.params.jobId)) return fail(res, 400, 'Invalid job id', 'INVALID_JOB_ID');
    const body = asObject(req.body) ?? {};
    const bodyError = validatePassportBody(body, { allowEnabled: true });
    if (bodyError) return fail(res, 400, bodyError, 'INVALID_PASSPORT_BODY');
    const passport = await patchPassport({
      companyId: req.user.companyId,
      jobId: req.params.jobId,
      userId: req.user.id,
      body: body as PatchPassportBody,
    });
    res.json({ passport });
  })
);

// POST /jobs/:jobId/passport/unpublish — hide the public page immediately
router.post(
  '/:jobId/passport/unpublish',
  requireRole(...PASSPORT_ADMIN_ROLES),
  handle(async (req, res) => {
    if (!req.user) return fail(res, 401, 'Not authenticated', 'AUTH_NOT_AUTHENTICATED');
    if (!isUuid(req.params.jobId)) return fail(res, 400, 'Invalid job id', 'INVALID_JOB_ID');
    res.json(await unpublishPassport({ companyId: req.user.companyId, jobId: req.params.jobId }));
  })
);

// ─────────────────────────── error mapping ───────────────────────────

router.use((err: Error & { statusCode?: number; code?: string }, _req: AuthRequest, res: Response, _next: NextFunction) => {
  if (err instanceof PassportServiceError) {
    return fail(res, err.statusCode, err.message, err.code);
  }
  console.error('[jobs/qc-passport] error:', err.message);
  return fail(res, 500, 'QC and passport request failed', 'PASSPORT_INTERNAL_ERROR');
});

export default router;
