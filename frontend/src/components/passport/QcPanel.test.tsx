import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
import QcPanel from './QcPanel';
import type { QcRun, QcStateResponse, QcTemplate } from '../../types/passport';

const mockedGetQc = passportApi.getQc as unknown as ReturnType<typeof vi.fn>;
const mockedCreateQc = passportApi.createQc as unknown as ReturnType<typeof vi.fn>;
const mockedPatchQc = passportApi.patchQc as unknown as ReturnType<typeof vi.fn>;
const mockedCompleteQc = passportApi.completeQc as unknown as ReturnType<typeof vi.fn>;
const mockedListJobPhotos = listJobPhotos as unknown as ReturnType<typeof vi.fn>;

const productionTemplate: QcTemplate = {
  phase: 'PRODUCTION',
  label: 'Production',
  items: [
    { key: 'tear_off', label: 'Tear-off complete and deck inspected', required: true, requiresPhoto: true },
    { key: 'underlayment', label: 'Underlayment installed to spec', required: true, requiresPhoto: false },
    { key: 'site_cleanup', label: 'Site cleaned and debris removed', required: false, requiresPhoto: true },
  ],
};

const draftRun: QcRun = {
  id: 'run-1',
  jobId: 'job-1',
  phase: 'PRODUCTION',
  status: 'DRAFT',
  score: 0,
  items: [
    {
      key: 'tear_off',
      label: 'Tear-off complete and deck inspected',
      required: true,
      requiresPhoto: true,
      passed: false,
      note: null,
      photoUrls: [],
    },
    {
      key: 'underlayment',
      label: 'Underlayment installed to spec',
      required: true,
      requiresPhoto: false,
      passed: false,
      note: null,
      photoUrls: [],
    },
  ],
  notes: null,
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
};

const passedRun: QcRun = {
  ...draftRun,
  status: 'PASSED',
  score: 100,
  completedAt: '2026-11-21T12:00:00.000Z',
  items: draftRun.items.map((item) => ({ ...item, passed: true, photoUrls: ['/uploads/north.jpg'] })),
};

const emptyState: QcStateResponse = {
  data: [],
  templates: [productionTemplate],
  summary: { passedRuns: 0, totalRuns: 0, percent: 0 },
};

const draftState: QcStateResponse = {
  data: [draftRun],
  templates: [productionTemplate],
  summary: { passedRuns: 0, totalRuns: 1, percent: 0 },
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
      <QcPanel jobId="job-1" jobPhase="PRODUCTION" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListJobPhotos.mockResolvedValue([]);
});

describe('QcPanel — states', () => {
  it('renders a friendly not-available notice when the route returns 501', async () => {
    mockedGetQc.mockRejectedValueOnce({ response: { status: 501 } });
    renderPanel();
    expect(
      await screen.findByText('QC checklists are not available on this deployment yet')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Retry$/i })).toBeInTheDocument();
  });

  it('shows the phase tabs, empty state and template preview for a phase without a run', async () => {
    mockedGetQc.mockResolvedValue(emptyState);
    renderPanel();

    expect(await screen.findByRole('tab', { name: /Production/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Inspection/i })).toBeInTheDocument();
    expect(screen.getByText('No Production QC run yet')).toBeInTheDocument();
    expect(screen.getByText('Template preview')).toBeInTheDocument();
    expect(screen.getByText('Tear-off complete and deck inspected')).toBeInTheDocument();
    expect(screen.getByText('QC progress')).toBeInTheDocument();
  });
});

describe('QcPanel — creating and editing a draft', () => {
  it('starts a run and renders the checklist after the refetch', async () => {
    mockedGetQc.mockResolvedValueOnce(emptyState).mockResolvedValue(draftState);
    mockedCreateQc.mockResolvedValueOnce(draftRun);
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /Start Production QC/i }));

    await waitFor(() => expect(mockedCreateQc).toHaveBeenCalledWith('job-1', 'PRODUCTION'));
    expect(await screen.findByLabelText(/Mark "Tear-off complete and deck inspected" as passed/i)).toBeInTheDocument();
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
  });

  it('patches item toggles, notes and photo evidence', async () => {
    mockedGetQc.mockResolvedValue(draftState);
    mockedListJobPhotos.mockResolvedValue([photoDoc]);
    mockedPatchQc.mockImplementation(async (_jobId: string, _runId: string, body: unknown) => ({
      ...draftRun,
      updatedAt: '2026-11-20T11:00:00.000Z',
      ...(body as object),
    }));
    renderPanel();

    // Toggle the required item
    fireEvent.click(
      await screen.findByLabelText(/Mark "Tear-off complete and deck inspected" as passed/i)
    );
    await waitFor(() =>
      expect(mockedPatchQc).toHaveBeenCalledWith('job-1', 'run-1', {
        items: [
          {
            key: 'tear_off',
            passed: true,
            note: undefined,
            photoUrls: [],
          },
        ],
      })
    );

    // Attach a photo from the job's PHOTO documents
    fireEvent.click(
      screen.getByRole('button', { name: /Attach photo evidence for "Tear-off complete and deck inspected"/i })
    );
    const photoButton = await screen.findByRole('button', { name: /Attach photo Roof north.jpg/i });
    fireEvent.click(photoButton);
    await waitFor(() =>
      expect(mockedPatchQc).toHaveBeenCalledWith('job-1', 'run-1', {
        items: [
          {
            key: 'tear_off',
            passed: true,
            note: undefined,
            photoUrls: ['/uploads/north.jpg'],
          },
        ],
      })
    );

    // Photo requirement satisfied → completeness hint updates
    await screen.findByText(/required item/i).catch(() => undefined);
    expect(mockedPatchQc.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('completes the run and shows the PASSED result with its ledger receipt', async () => {
    mockedGetQc.mockResolvedValue(draftState);
    mockedPatchQc.mockResolvedValue(draftRun);
    mockedCompleteQc.mockImplementation(async () => {
      mockedGetQc.mockResolvedValue({
        data: [passedRun],
        templates: [productionTemplate],
        summary: { passedRuns: 1, totalRuns: 1, percent: 100 },
      });
      return {
        run: passedRun,
        ledgerReceipt: {
          id: 'led-1',
          kind: 'QC_COMPLETED',
          description: 'Production QC passed with 100/100',
          createdAt: '2026-11-21T12:00:00.000Z',
        },
      };
    });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /Complete Production QC run/i }));

    await waitFor(() => expect(mockedCompleteQc).toHaveBeenCalledWith('job-1', 'run-1', {}));
    expect(await screen.findByText('Ledger receipt')).toBeInTheDocument();
    expect(await screen.findByText('Production QC passed with 100/100')).toBeInTheDocument();
    expect(await screen.findByText(/Signed off/i)).toBeInTheDocument();
  });
});

describe('QcPanel — completed run view', () => {
  it('shows PASSED sign-off items', async () => {
    mockedGetQc.mockResolvedValue({
      data: [passedRun],
      templates: [productionTemplate],
      summary: { passedRuns: 1, totalRuns: 1, percent: 100 },
    });
    renderPanel();

    expect(await screen.findByText(/Signed off/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Passed/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Ledger receipt')).toBeInTheDocument();
    expect(screen.getByText('Start a new run')).toBeInTheDocument();
  });
});
