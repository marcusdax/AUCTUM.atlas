/**
 * Install QC + Job Passport API client.
 *
 * Contract: docs/SPRINT_10_QC_PASSPORT.md §6. Wraps the shared authenticated axios
 * instance (`services/api.ts`, baseURL `/api/v1`, JWT interceptor) so every call is
 * tenant-scoped by the server. Errors bubble as `AxiosError`; the panels use the
 * helpers below to render loading / empty / 404 / 501 states instead of crashing.
 */
import { AxiosError } from 'axios';
import { api } from './api';
import type {
  CompleteQcResponse,
  GetPassportResponse,
  JobPassport,
  JobPhotoDocument,
  JobPhase,
  PatchPassportBody,
  PublicPassport,
  PublicPassportResponse,
  PublishPassportBody,
  PublishPassportResponse,
  PassportVerifyResponse,
  QcPatchBody,
  QcRun,
  QcStateResponse,
} from '../types/passport';

/** Copy shown when the backend routes have not landed yet (501). */
export const PASSPORT_NOT_READY_MESSAGE =
  'Install QC and the Job Passport are not available on this deployment yet. The job record itself still works.';

/** Copy shown for an unknown/unpublished public slug. */
export const PASSPORT_PUBLIC_NOT_FOUND_MESSAGE =
  'This Job Passport was not found. The link may be incorrect, or the company may have unpublished this record.';

/** HTTP status from an unknown error (null for network failures). */
export function passportErrorStatus(error: unknown): number | null {
  if (error instanceof AxiosError) {
    return error.response?.status ?? null;
  }
  const candidate = error as { response?: { status?: unknown }; status?: unknown } | null;
  const status = candidate?.response?.status ?? candidate?.status;
  return typeof status === 'number' ? status : null;
}

/** 501/502/503/504 or no response at all = the feature is not available here. */
export function isPassportUnavailableError(error: unknown): boolean {
  const status = passportErrorStatus(error);
  if (status === null) return true;
  return [501, 502, 503, 504].includes(status);
}

/** The backend route exists but is not implemented/enabled (no network errors). */
export function isPassportNotReadyError(error: unknown): boolean {
  const status = passportErrorStatus(error);
  return status !== null && [501, 502, 503, 504].includes(status);
}

/** 404 on a resource the current user can see means "not found / not published". */
export function isPassportNotFoundError(error: unknown): boolean {
  return passportErrorStatus(error) === 404;
}

export function isPassportForbiddenError(error: unknown): boolean {
  return passportErrorStatus(error) === 403;
}

/** Friendly, non-technical copy for any QC/passport failure. */
export function describePassportError(error: unknown): string {
  const status = passportErrorStatus(error);
  switch (status) {
    case 400:
      return 'That request could not be accepted — add the missing details and try again.';
    case 401:
      return 'Your session expired. Sign in again to manage this job.';
    case 403:
      return 'You do not have permission to do that. Ask an owner or manager.';
    case 404:
      return PASSPORT_PUBLIC_NOT_FOUND_MESSAGE;
    case 409:
      return 'A draft QC run for that phase already exists. Open it to continue.';
    case 429:
      return 'Too many requests. Try again in a moment.';
    default:
      if (status !== null && status >= 500) {
        return 'The server could not complete that request. Try again in a moment.';
      }
      if (status === null) {
        return 'Cannot reach the server. Check your connection and retry.';
      }
      return (
        (error as { message?: string } | null)?.message ||
        'Something went wrong. Please try again.'
      );
  }
}

/** Resolve the newest PHOTO documents for a job (QC photo evidence + passport hero). */
export async function listJobPhotos(jobId: string): Promise<JobPhotoDocument[]> {
  const res = await api.get(`/documents/jobs/${jobId}`);
  const rows = (res.data?.data ?? res.data ?? []) as JobPhotoDocument[];
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((doc) => doc && doc.fileType === 'PHOTO' && Boolean(doc.fileUrl))
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const passportApi = {
  // ── QC (mounted at /jobs) ────────────────────────────────────────────────
  getQc: (jobId: string): Promise<QcStateResponse> =>
    api.get<QcStateResponse>(`/jobs/${jobId}/qc`).then((res) => res.data),

  /** Creates a DRAFT run from the phase template (409 when a draft exists). */
  createQc: (jobId: string, phase: JobPhase): Promise<QcRun> =>
    api
      .post<{ run: QcRun }>(`/jobs/${jobId}/qc`, { phase })
      .then((res) => res.data.run),

  /** Patch DRAFT items/notes; only the listed item keys are updated. */
  patchQc: (jobId: string, runId: string, body: QcPatchBody): Promise<QcRun> =>
    api
      .patch<{ run: QcRun }>(`/jobs/${jobId}/qc/${runId}`, body)
      .then((res) => res.data.run),

  /** Completes a DRAFT run → PASSED/FAILED + append-only ledger receipt. */
  completeQc: (jobId: string, runId: string, body: { notes?: string } = {}): Promise<CompleteQcResponse> =>
    api
      .post<CompleteQcResponse>(`/jobs/${jobId}/qc/${runId}/complete`, body)
      .then((res) => res.data),

  // ── Passport admin (mounted at /jobs) ────────────────────────────────────
  getPassport: (jobId: string): Promise<GetPassportResponse> =>
    api.get<GetPassportResponse>(`/jobs/${jobId}/passport`).then((res) => res.data),

  /** Creates or re-publishes the passport (increments version, new frozen snapshot). */
  publishPassport: (jobId: string, body: PublishPassportBody = {}): Promise<PublishPassportResponse> =>
    api
      .post<PublishPassportResponse>(`/jobs/${jobId}/passport/publish`, body)
      .then((res) => res.data),

  /** Updates settings (and `enabled:false` unpublishes). */
  patchPassport: (jobId: string, body: PatchPassportBody): Promise<JobPassport> =>
    api
      .patch<{ passport: JobPassport }>(`/jobs/${jobId}/passport`, body)
      .then((res) => res.data.passport),

  unpublishPassport: (jobId: string): Promise<{ ok: true }> =>
    api.post<{ ok: true }>(`/jobs/${jobId}/passport/unpublish`).then((res) => res.data),

  // ── Public (no auth) ─────────────────────────────────────────────────────
  getPublicPassport: (slug: string): Promise<PublicPassport> =>
    api
      .get<PublicPassportResponse>(`/public/passport/${encodeURIComponent(slug)}`)
      .then((res) => res.data.data),

  verifyPassport: (slug: string): Promise<PassportVerifyResponse> =>
    api
      .get<PassportVerifyResponse>(`/public/passport/${encodeURIComponent(slug)}/verify`)
      .then((res) => res.data),
};

export default passportApi;
