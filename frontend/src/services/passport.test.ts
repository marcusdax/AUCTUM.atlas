import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

// Replace the shared axios instance so we can assert endpoint paths/payloads.
vi.mock('./api', () => {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
  return { api, default: api };
});

import { api } from './api';
import {
  PASSPORT_NOT_READY_MESSAGE,
  describePassportError,
  isPassportForbiddenError,
  isPassportNotFoundError,
  isPassportUnavailableError,
  listJobPhotos,
  passportApi,
  passportErrorStatus,
} from './passport';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('passportApi — QC endpoint wiring (§6)', () => {
  it('GET /jobs/:jobId/qc', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { data: [], templates: [], summary: { passedRuns: 0, totalRuns: 0, percent: 0 } },
    });
    const result = await passportApi.getQc('job-1');
    expect(mockedApi.get).toHaveBeenCalledWith('/jobs/job-1/qc');
    expect(result.summary.totalRuns).toBe(0);
  });

  it('POST /jobs/:jobId/qc sends the phase and unwraps { run }', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { run: { id: 'run-1', phase: 'PRODUCTION' } } });
    const run = await passportApi.createQc('job-1', 'PRODUCTION');
    expect(mockedApi.post).toHaveBeenCalledWith('/jobs/job-1/qc', { phase: 'PRODUCTION' });
    expect(run.id).toBe('run-1');
  });

  it('PATCH /jobs/:jobId/qc/:runId sends item patches and unwraps { run }', async () => {
    mockedApi.patch.mockResolvedValueOnce({ data: { run: { id: 'run-1', score: 50 } } });
    const body = {
      items: [{ key: 'tear_off', passed: true, photoUrls: ['/uploads/roof.jpg'] }],
      notes: 'Deck inspected',
    };
    const run = await passportApi.patchQc('job-1', 'run-1', body);
    expect(mockedApi.patch).toHaveBeenCalledWith('/jobs/job-1/qc/run-1', body);
    expect(run.score).toBe(50);
  });

  it('POST /jobs/:jobId/qc/:runId/complete returns the run + ledger receipt', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        run: { id: 'run-1', status: 'PASSED' },
        ledgerReceipt: { id: 'led-1', kind: 'QC_COMPLETED', description: 'QC passed', createdAt: 'x' },
      },
    });
    const result = await passportApi.completeQc('job-1', 'run-1', { notes: 'ok' });
    expect(mockedApi.post).toHaveBeenCalledWith('/jobs/job-1/qc/run-1/complete', { notes: 'ok' });
    expect(result.run.status).toBe('PASSED');
    expect(result.ledgerReceipt.kind).toBe('QC_COMPLETED');
  });

  it('complete defaults to an empty body', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { run: {}, ledgerReceipt: {} } });
    await passportApi.completeQc('job-1', 'run-1');
    expect(mockedApi.post).toHaveBeenCalledWith('/jobs/job-1/qc/run-1/complete', {});
  });
});

describe('passportApi — Passport admin endpoint wiring (§6)', () => {
  it('GET /jobs/:jobId/passport', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { passport: null, publicPath: null } });
    const result = await passportApi.getPassport('job-1');
    expect(mockedApi.get).toHaveBeenCalledWith('/jobs/job-1/passport');
    expect(result.passport).toBeNull();
  });

  it('POST /jobs/:jobId/passport/publish sends content and returns digest + receipt', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        passport: { id: 'p1', version: 2 },
        publicPath: '/p/abc123',
        contentDigest: 'deadbeef',
        ledgerReceipt: { id: 'led-2', kind: 'PASSPORT_PUBLISHED' },
      },
    });
    const body = { privacy: 'STREET_ONLY' as const, headline: 'Roof replacement' };
    const result = await passportApi.publishPassport('job-1', body);
    expect(mockedApi.post).toHaveBeenCalledWith('/jobs/job-1/passport/publish', body);
    expect(result.contentDigest).toBe('deadbeef');
    expect(result.publicPath).toBe('/p/abc123');
  });

  it('PATCH /jobs/:jobId/passport unwraps { passport }', async () => {
    mockedApi.patch.mockResolvedValueOnce({ data: { passport: { id: 'p1', enabled: false } } });
    const passport = await passportApi.patchPassport('job-1', { enabled: false });
    expect(mockedApi.patch).toHaveBeenCalledWith('/jobs/job-1/passport', { enabled: false });
    expect(passport.enabled).toBe(false);
  });

  it('POST /jobs/:jobId/passport/unpublish', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { ok: true } });
    await expect(passportApi.unpublishPassport('job-1')).resolves.toEqual({ ok: true });
    expect(mockedApi.post).toHaveBeenCalledWith('/jobs/job-1/passport/unpublish');
  });
});

describe('passportApi — public endpoints (§6)', () => {
  it('GET /public/passport/:slug unwraps { data }', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: { slug: 'abc123', headline: 'Roof' } } });
    const passport = await passportApi.getPublicPassport('abc123');
    expect(mockedApi.get).toHaveBeenCalledWith('/public/passport/abc123');
    expect(passport.headline).toBe('Roof');
  });

  it('encodes the slug in public paths', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: {} } });
    await passportApi.getPublicPassport('a/b c');
    expect(mockedApi.get).toHaveBeenCalledWith('/public/passport/a%2Fb%20c');
  });

  it('GET /public/passport/:slug/verify', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { verified: true, contentDigest: 'abc', algorithm: 'SHA-256', canonical: 'auctum.passport.v1' },
    });
    const result = await passportApi.verifyPassport('abc123');
    expect(mockedApi.get).toHaveBeenCalledWith('/public/passport/abc123/verify');
    expect(result.verified).toBe(true);
  });
});

describe('listJobPhotos', () => {
  it('returns only PHOTO documents, newest first', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'd1', fileType: 'PHOTO', fileUrl: '/uploads/new.jpg', name: 'New', createdAt: '2026-11-20T00:00:00Z' },
          { id: 'd2', fileType: 'CONTRACT', fileUrl: '/uploads/contract.pdf', name: 'Contract', createdAt: '2026-11-21T00:00:00Z' },
          { id: 'd3', fileType: 'PHOTO', fileUrl: '/uploads/old.jpg', name: 'Old', createdAt: '2026-11-01T00:00:00Z' },
          { id: 'd4', fileType: 'PHOTO', fileUrl: '', name: 'Broken', createdAt: '2026-11-22T00:00:00Z' },
        ],
      },
    });
    const photos = await listJobPhotos('job-1');
    expect(mockedApi.get).toHaveBeenCalledWith('/documents/jobs/job-1');
    expect(photos.map((photo) => photo.id)).toEqual(['d1', 'd3']);
  });

  it('tolerates malformed payloads', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: null } });
    await expect(listJobPhotos('job-1')).resolves.toEqual([]);
  });
});

describe('passport error helpers', () => {
  it('classifies HTTP statuses', () => {
    expect(passportErrorStatus({ response: { status: 404 } })).toBe(404);
    expect(passportErrorStatus(new Error('network'))).toBeNull();
    expect(isPassportNotFoundError({ response: { status: 404 } })).toBe(true);
    expect(isPassportUnavailableError({ response: { status: 501 } })).toBe(true);
    expect(isPassportUnavailableError({ response: { status: 503 } })).toBe(true);
    expect(isPassportUnavailableError(new Error('offline'))).toBe(true);
    expect(isPassportUnavailableError({ response: { status: 409 } })).toBe(false);
    expect(isPassportForbiddenError({ response: { status: 403 } })).toBe(true);
  });

  it('reads real AxiosError statuses', () => {
    const error = new AxiosError('fail', 'ERR', undefined, undefined, {
      status: 501,
      statusText: 'Not Implemented',
      headers: {},
      config: { headers: {} } as never,
      data: {},
    });
    expect(passportErrorStatus(error)).toBe(501);
    expect(isPassportUnavailableError(error)).toBe(true);
  });

  it('returns friendly copy', () => {
    expect(describePassportError({ response: { status: 501 } })).toContain('server');
    expect(describePassportError({ response: { status: 409 } })).toContain('draft QC run');
    expect(describePassportError({ response: { status: 403 } })).toContain('permission');
    expect(describePassportError({ response: { status: 404 } })).toBe(
      'This Job Passport was not found. The link may be incorrect, or the company may have unpublished this record.'
    );
    expect(PASSPORT_NOT_READY_MESSAGE).toContain('not available on this deployment');
  });
});
