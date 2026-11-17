import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { ConvertMapToLeadsResponse } from '../../types/ai';

const convertMapToLeads = vi.fn();
vi.mock('../../services/ai', () => ({
  aiApi: { convertMapToLeads: (...a: unknown[]) => convertMapToLeads(...a), rescoreLeads: vi.fn() },
  describeAiError: (e: Error) => e.message,
}));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MapToLeadsDemoPanel from './MapToLeadsDemoPanel';

const lead = (id: string, firstName: string, lastName: string, propertyAddress: string, score: number) => ({
  id, firstName, lastName, propertyAddress, score, stormImpactScore: score, status: 'NEW',
});

const result = (overrides: Partial<ConvertMapToLeadsResponse> = {}): ConvertMapToLeadsResponse => ({
  created: 1,
  existing: 1,
  zone: { name: 'Map zone (33.171, -96.702)', severity: 'SEVERE', lat: 33.171, lng: -96.702, impactScore: 72, shape: 'radius', radiusKm: 1, areaKm2: 3.14 },
  existingLeads: [lead('a', 'Blake', 'Hoffman', '3812 Canyon Creek Dr, McKinney, TX', 82)],
  newLeads: [lead('b', 'Homeowner', '(not yet identified)', '3132 Hudson Crossing, McKinney, Texas', 70)],
  leads: [],
  addressLookup: { status: 'ok', source: 'MapMap reverse geocoding (OpenStreetMap address data)', sampledPoints: 50, addressesFound: 12, alreadyLeads: 1, droppedBusinesses: 2, capped: false },
  ...overrides,
});

const renderPanel = (props: React.ComponentProps<typeof MapToLeadsDemoPanel>) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter>
        <MapToLeadsDemoPanel {...props} />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('Storm zone -> Leads panel', () => {
  beforeEach(() => convertMapToLeads.mockReset());

  it('cannot pull leads until a zone is chosen', () => {
    renderPanel({});
    expect(screen.getByRole('button', { name: /pull leads for this zone/i })).toBeDisabled();
  });

  it('sends the clicked point with the chosen radius and limit, and lists both kinds of lead', async () => {
    convertMapToLeads.mockResolvedValue(result());
    renderPanel({ selectedPoint: { lat: 33.1712, lng: -96.7021 } });
    fireEvent.change(screen.getByLabelText('Radius'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/new leads, at most/i), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /pull leads for this zone/i }));

    await waitFor(() => expect(screen.getByText(/new canvass leads \(1\)/i)).toBeInTheDocument());
    expect(convertMapToLeads).toHaveBeenCalledWith({ lat: 33.1712, lng: -96.7021, radiusKm: 2, count: 50 });
    expect(screen.getByText('3812 Canyon Creek Dr, McKinney, TX')).toBeInTheDocument();
    expect(screen.getByText('3132 Hudson Crossing, McKinney, Texas')).toBeInTheDocument();
    expect(screen.getByText(/homeowner \(not yet identified\)/i)).toBeInTheDocument();
    expect(screen.getByText(/checked 50 points/i)).toBeInTheDocument();
  });

  it('says plainly when address lookup is not configured', async () => {
    convertMapToLeads.mockResolvedValue(
      result({
        created: 0,
        newLeads: [],
        addressLookup: { status: 'unconfigured', source: null, sampledPoints: 0, addressesFound: 0, alreadyLeads: 0, droppedBusinesses: 0, capped: false, message: 'Address lookup is not configured (set MAPMAP_API_KEY). Existing leads in the zone were still flagged.' },
      })
    );
    renderPanel({ selectedEvent: { id: '6f1c2c1e-3b5a-4d2b-9a77-0d3f2e1c4b5a', name: 'Collin County hail', severity: 'SEVERE' } as never });
    fireEvent.click(screen.getByRole('button', { name: /pull leads for this zone/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/not configured/i));
    expect(convertMapToLeads).toHaveBeenCalledWith({ eventId: '6f1c2c1e-3b5a-4d2b-9a77-0d3f2e1c4b5a', label: 'Collin County hail', count: 25 });
    expect(screen.getByText(/none: address lookup did not run/i)).toBeInTheDocument();
  });
});
