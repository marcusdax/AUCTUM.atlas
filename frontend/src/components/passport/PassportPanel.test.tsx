import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const authState = vi.hoisted(() => ({ role: 'OWNER' as string | null }));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { role: string } | null }) => unknown) =>
    selector(authState.role ? { user: { role: authState.role } } : { user: null }),
  hasRole: (roles: string[]) => Boolean(authState.role && roles.includes(authState.role)),
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QRCODE'),
  },
}));

vi.mock('../../services/passport', async () => {
  const actual =
    await vi.importActual<typeof import('../../services/passport')>('../../services/passport');
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

import { listJobPhotos, passportApi } from '../../services/passport';
import PassportPanel from './PassportPanel';
import type { JobPassport } from '../../types/passport';

const mockedGetPassport = passportApi.getPassport as unknown as ReturnType<typeof vi.fn>;
const mockedPublish = passportApi.publishPassport as unknown as ReturnType<typeof vi.fn>;
const mockedPatch = passportApi.patchPassport as unknown as ReturnType<typeof vi.fn>;
const mockedUnpublish = passportApi.unpublishPassport as unknown as ReturnType<typeof vi.fn>;
const mockedListJobPhotos = listJobPhotos as unknown as ReturnType<typeof vi.fn>;

const publishedPassport: JobPassport = {
  id: 'passport-1',
  companyId: 'company-1',
  jobId: 'job-1',
  slug: 'abc123',
  enabled: true,
  privacy: 'STREET_ONLY',
  headline: 'Full roof replacement — Heritage Park',
  summary: 'Architectural shingles installed over a new synthetic underlayment.',
  heroPhotoUrl: null,
  contentDigest: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
  version: 2,
  publishedAt: '2026-11-21T12:00:00.000Z',
  unpublishedAt: null,
  createdAt: '2026-11-20T00:00:00.000Z',
  updatedAt: '2026-11-21T12:00:00.000Z',
};

const publishResponse = {
  passport: publishedPassport,
  publicPath: '/p/abc123',
  contentDigest: publishedPassport.contentDigest as string,
  ledgerReceipt: {
    id: 'led-1',
    kind: 'PASSPORT_PUBLISHED',
    description: 'Passport v2 published',
    createdAt: '2026-11-21T12:00:00.000Z',
  },
};

const photoDoc = {
  id: 'doc-1',
  name: 'Roof north.jpg',
  fileUrl: '/uploads/north.jpg',
  fileType: 'PHOTO' as const,
  createdAt: '2026-11-20T09:00:00.000Z',
};

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PassportPanel jobId="job-1" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.role = 'OWNER';
  mockedListJobPhotos.mockResolvedValue([]);
});

describe('PassportPanel — unavailable / read-only', () => {
  it('renders a friendly notice when the passport route returns 501', async () => {
    mockedGetPassport.mockRejectedValueOnce({ response: { status: 501 } });
    renderPanel();
    expect(
      await screen.findByText('Job Passport is not available on this deployment yet')
    ).toBeInTheDocument();
  });

  it('is read-only for FIELD_CREW (no mutation controls)', async () => {
    authState.role = 'FIELD_CREW';
    mockedGetPassport.mockResolvedValue({ passport: null, publicPath: null });
    renderPanel();

    expect(await screen.findByText('No Job Passport yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish passport/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Address privacy')).not.toBeInTheDocument();
  });
});

describe('PassportPanel — publishing', () => {
  it('publishes with the default STREET_ONLY privacy and shows link + QR + digest', async () => {
    mockedGetPassport.mockResolvedValue({ passport: null, publicPath: null });
    mockedListJobPhotos.mockResolvedValue([photoDoc]);
    mockedPublish.mockImplementation(async () => {
      mockedGetPassport.mockResolvedValue({
        passport: publishResponse.passport,
        publicPath: publishResponse.publicPath,
      });
      return publishResponse;
    });
    renderPanel();

    const privacy = (await screen.findByLabelText('Address privacy')) as HTMLSelectElement;
    expect(privacy.value).toBe('STREET_ONLY');

    fireEvent.change(screen.getByLabelText(/Public headline/i), {
      target: { value: '  Full roof replacement — Heritage Park  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish passport/i }));

    await waitFor(() => expect(mockedPublish).toHaveBeenCalledTimes(1));
    expect(mockedPublish.mock.calls[0][1]).toEqual({
      privacy: 'STREET_ONLY',
      headline: 'Full roof replacement — Heritage Park',
      summary: '',
      heroPhotoUrl: null,
    });

    expect(await screen.findByText('Public record')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open public page/i })).toHaveAttribute(
      'href',
      '/p/abc123'
    );
    expect(await screen.findByAltText(/QR code linking to this Job Passport/i)).toBeInTheDocument();
    expect(screen.getAllByText(/v2/).length).toBeGreaterThan(0);
  });

  it('blocks publishing without a headline', async () => {
    mockedGetPassport.mockResolvedValue({ passport: null, publicPath: null });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /Publish passport/i }));
    expect(
      await screen.findByText(/Add a public headline before publishing/i)
    ).toBeInTheDocument();
    expect(mockedPublish).not.toHaveBeenCalled();
  });
});

describe('PassportPanel — published record management', () => {
  it('shows version, digest, public link and saves privacy changes', async () => {
    mockedGetPassport.mockResolvedValue({ passport: publishedPassport, publicPath: '/p/abc123' });
    mockedPatch.mockResolvedValueOnce({ ...publishedPassport, privacy: 'HIDDEN' });
    renderPanel();

    expect(await screen.findByText('Published')).toBeInTheDocument();
    expect(screen.getByText('v2 · live')).toBeInTheDocument();
    expect(screen.getByTitle(publishedPassport.contentDigest as string)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Address privacy'), { target: { value: 'HIDDEN' } });
    fireEvent.click(screen.getByRole('button', { name: /Save settings/i }));

    await waitFor(() => expect(mockedPatch).toHaveBeenCalledTimes(1));
    expect(mockedPatch.mock.calls[0][1]).toMatchObject({
      privacy: 'HIDDEN',
      headline: publishedPassport.headline,
    });
  });

  it('unpublishes after explicit confirmation', async () => {
    mockedGetPassport.mockResolvedValue({ passport: publishedPassport, publicPath: '/p/abc123' });
    mockedUnpublish.mockResolvedValueOnce({ ok: true });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /^Unpublish$/ }));
    expect(screen.getByText(/Hide this record immediately/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Yes, unpublish/i }));

    await waitFor(() => expect(mockedUnpublish).toHaveBeenCalledWith('job-1'));
  });

  it('copies the public link to the clipboard', async () => {
    mockedGetPassport.mockResolvedValue({ passport: publishedPassport, publicPath: '/p/abc123' });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /Copy public Job Passport link/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain('/p/abc123');
  });
});
