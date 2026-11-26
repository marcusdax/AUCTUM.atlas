import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../services/passport', async () => {
  const actual =
    await vi.importActual<typeof import('../services/passport')>('../services/passport');
  return {
    ...actual,
    listJobPhotos: vi.fn(),
    passportApi: {
      getQc: vi.fn(),
      createQc: vi.fn(),
      patchQc: vi.fn(),
      completeQc: vi.fn(),
      getPassport: vi.fn(),
      publishPassport: vi.fn(),
      patchPassport: vi.fn(),
      unpublishPassport: vi.fn(),
      getPublicPassport: vi.fn(),
      verifyPassport: vi.fn(),
    },
  };
});

import { passportApi } from '../services/passport';
import PublicPassportPage from './PublicPassport';
import type { PassportVerifyResponse, PublicPassport } from '../types/passport';

const mockedGetPublicPassport = passportApi.getPublicPassport as unknown as ReturnType<typeof vi.fn>;
const mockedVerify = passportApi.verifyPassport as unknown as ReturnType<typeof vi.fn>;

const snapshot: PublicPassport = {
  slug: 'abc123',
  version: 2,
  publishedAt: '2026-11-21T12:00:00.000Z',
  headline: 'Full roof replacement — Heritage Park',
  summary: 'Architectural shingles installed over a new synthetic underlayment.',
  company: { name: 'Lone Star Roofing', phone: '(469) 555-0100', logoUrl: null },
  job: {
    name: 'Heritage Park roof replacement',
    phase: 'COMPLETED',
    status: 'COMPLETED',
    completedAt: '2026-11-20T00:00:00.000Z',
    propertyAddress: '700 Heritage Pkwy, McKinney, TX',
    photoCount: 2,
  },
  photos: [
    { url: '/uploads/north.jpg', name: 'Roof north.jpg' },
    { url: 'https://cdn.example.com/south.jpg', name: 'Roof south.jpg' },
  ],
  materials: [
    {
      name: 'Architectural shingles',
      quantity: 42,
      unit: 'squares',
      supplierName: 'ABC Supply',
      status: 'DELIVERED',
    },
  ],
  estimates: { count: 1, approvedTotal: 24500 },
  qc: [
    {
      phase: 'PRODUCTION',
      status: 'PASSED',
      score: 100,
      completedAt: '2026-11-19T00:00:00.000Z',
      items: [
        { label: 'Tear-off complete', passed: true },
        { label: 'Flashing sealed', passed: true },
      ],
    },
    {
      phase: 'INSPECTION',
      status: 'FAILED',
      score: 60,
      completedAt: '2026-11-18T00:00:00.000Z',
      items: [{ label: 'Damage photos', passed: false }],
    },
  ],
  ledger: [{ kind: 'QC_COMPLETED', description: 'Production QC passed', at: '2026-11-19T00:00:00.000Z' }],
  verify: {
    digest: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f7a8b9c0d1e2f3a4b',
    algorithm: 'SHA-256',
    canonical: 'auctum.passport.v1',
  },
};

const verifyResponse: PassportVerifyResponse = {
  verified: true,
  contentDigest: snapshot.verify.digest,
  algorithm: 'SHA-256',
  canonical: 'auctum.passport.v1',
  checkedAt: '2026-11-22T00:00:00.000Z',
  ledger: [
    {
      id: 'led-1',
      kind: 'PASSPORT_PUBLISHED',
      description: 'Passport published with 6 photos and 2 QC sign-offs',
      createdAt: '2026-11-21T12:00:00.000Z',
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, refetchOnWindowFocus: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/p/abc123']}>
        <Routes>
          <Route path="/p/:slug" element={<PublicPassportPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetPublicPassport.mockResolvedValue(snapshot);
  mockedVerify.mockResolvedValue(verifyResponse);
});

describe('PublicPassport — page states', () => {
  it('shows a loading state while the frozen snapshot is fetched', async () => {
    mockedGetPublicPassport.mockImplementationOnce(() => new Promise(() => undefined));
    renderPage();
    expect(await screen.findByText('Loading verified job record…')).toBeInTheDocument();
  });

  it('renders a branded 404 for unknown / unpublished slugs', async () => {
    mockedGetPublicPassport.mockRejectedValueOnce({ response: { status: 404 } });
    renderPage();
    expect(await screen.findByText('This Job Passport is not available')).toBeInTheDocument();
  });

  it('renders a friendly not-live state when the public route returns 501', async () => {
    mockedGetPublicPassport.mockRejectedValue({ response: { status: 501 } });
    renderPage();
    expect(await screen.findByText('Job Passports are not live yet')).toBeInTheDocument();
  });

  it('auto-retries a transient error and then renders the record', async () => {
    mockedGetPublicPassport
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(snapshot);
    renderPage();
    expect(await screen.findByText(snapshot.headline)).toBeInTheDocument();
    await waitFor(() => expect(mockedGetPublicPassport.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('offers a manual retry after a persistent connection error', async () => {
    mockedGetPublicPassport.mockRejectedValue(new Error('network down'));
    renderPage();
    expect(await screen.findByText('Could not load this job record')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
  });
});

describe('PublicPassport — verified record', () => {
  it('renders the branded record, QC sign-offs, materials, ledger and verification card', async () => {
    renderPage();

    expect(await screen.findByText(snapshot.headline)).toBeInTheDocument();
    expect(screen.getByText('Lone Star Roofing')).toBeInTheDocument();
    expect(screen.getByText('700 Heritage Pkwy, McKinney, TX')).toBeInTheDocument();
    expect(screen.getAllByText('Photo record').length).toBeGreaterThan(0);
    expect(screen.getByText('Roof north.jpg')).toBeInTheDocument();
    expect(screen.getAllByText('Production').length).toBeGreaterThan(0);
    expect(screen.getByText('Tear-off complete')).toBeInTheDocument();
    expect(screen.getByText('Architectural shingles')).toBeInTheDocument();
    expect(screen.getAllByText('Delivered').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/approved estimate/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Ledger receipts')).toBeInTheDocument();
    // Verified ledger (from /verify) is preferred over the snapshot copy.
    expect(
      await screen.findByText('Passport published with 6 photos and 2 QC sign-offs')
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Verified').length).toBeGreaterThan(0));
    expect(
      screen.getByText('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f7a8b9c0d1e2f3a4b')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Call \(469\) 555-0100/i })).toHaveAttribute(
      'href',
      'tel:4695550100'
    );
    expect(screen.getAllByText(/Published Nov 21, 2026 · Version 2/).length).toBeGreaterThan(0);
  });

  it('shows a Not verified warning when the digest no longer matches', async () => {
    mockedVerify.mockResolvedValue({ ...verifyResponse, verified: false });
    renderPage();
    expect(await screen.findByText(/no longer matches its recorded SHA-256 digest/i)).toBeInTheDocument();
    expect(screen.getAllByText('Not verified').length).toBeGreaterThan(0);
  });

  it('keeps the page usable when live verification is unavailable', async () => {
    mockedVerify.mockRejectedValue(new Error('offline'));
    renderPage();
    expect(await screen.findByText(snapshot.headline)).toBeInTheDocument();
    expect(
      await screen.findByText(/Live verification is temporarily unavailable/i)
    ).toBeInTheDocument();
    // Digest from the frozen snapshot still shown.
    expect(screen.getByText('Content digest')).toBeInTheDocument();
  });
});

describe('PublicPassport — document head', () => {
  it('sets the title + robots noindex while mounted and restores them on unmount', async () => {
    document.title = 'Before Test Title';
    const { unmount } = renderPage();

    await screen.findByText(snapshot.headline);
    await waitFor(() => expect(document.title).toContain(snapshot.headline));
    expect(document.title).toContain('Lone Star Roofing');

    const robots = document.querySelector('meta[name="robots"]');
    expect(robots?.getAttribute('content')).toContain('noindex');

    unmount();
    expect(document.title).toBe('Before Test Title');
    expect(
      document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? ''
    ).not.toContain('noindex');
  });
});
