/**
 * Public Job Passport — no authentication.
 * Mounted at /api/v1/public/passport (before the auth middleware).
 *
 * Contract: docs/SPRINT_10_QC_PASSPORT.md §6. Public reads come from the frozen
 * `JobPassport.snapshot` written at publish time — never live rows — and both
 * routes are rate-limited per IP. Unknown/disabled slugs are 404 so an
 * unpublished link reveals nothing.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getPublicPassport, verifyPublicPassport, PassportServiceError } from '../services/passport/repo';

const router = Router();

/** 60 requests/minute per IP across public passport reads (contract §6). */
const publicLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});

type AsyncHandler = (req: Request, res: Response) => Promise<unknown> | unknown;

function handle(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

// GET /public/passport/:slug — frozen sanitized snapshot
router.get(
  '/:slug',
  publicLimiter,
  handle(async (req, res) => {
    const data = await getPublicPassport(req.params.slug);
    res.json({ data });
  })
);

// GET /public/passport/:slug/verify — recompute the SHA-256 digest server-side
router.get(
  '/:slug/verify',
  publicLimiter,
  handle(async (req, res) => {
    res.json(await verifyPublicPassport(req.params.slug));
  })
);

// ─────────────────────────── error mapping ───────────────────────────

router.use((err: Error & { statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof PassportServiceError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  console.error('[public/passport] error:', err.message);
  return res.status(500).json({ error: 'Could not load this job passport', code: 'PASSPORT_INTERNAL_ERROR' });
});

export default router;
