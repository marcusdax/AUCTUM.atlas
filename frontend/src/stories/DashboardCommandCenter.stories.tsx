import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect } from '@storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import DashboardCommandCenter from '@/components/intelligence/DashboardCommandCenter';
import { IntelligenceLayerProvider } from '@/components/intelligence/IntelligenceLayerProvider';
import type { Job, Lead, StormEvent, WeatherAlert } from '@/types';

// Create a query client for testing
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
});

// Wrapper to provide IntelligenceLayerProvider context
const ProviderWrapper = ({ children }: { children: React.ReactNode }) => (
  <IntelligenceLayerProvider
    initialLayers={{
      atlas: { status: 'LIVE', lastUpdate: new Date().toISOString(), freshness: 100 },
      helios: { status: 'LIVE', lastUpdate: new Date().toISOString(), freshness: 100 },
      command: { status: 'LIVE', lastUpdate: new Date().toISOString(), freshness: 100 },
      intelligence: { status: 'LIVE', lastUpdate: new Date().toISOString(), freshness: 100 },
      system: { status: 'LIVE', lastUpdate: new Date().toISOString(), freshness: 100 },
    }}
  >
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  </IntelligenceLayerProvider>
);

const mockJobs: Job[] = [
  {
    id: 'job-1',
    companyId: 'comp-1',
    name: 'Job One',
    status: 'ACTIVE',
    phase: 'PRODUCTION',
    propertyAddress: '1247 Oak Ridge Dr, Austin, TX 78704',
    propertyLatLng: { lat: 30.2672, lng: -97.7431 },
    grossProfit: 15000,
    budget: 25000,
    actualCost: 18000,
    estimatedCost: 22000,
    createdByUserId: 'user-1',
    createdAt: '2026-09-10T08:00:00Z',
    updatedAt: '2026-09-12T10:30:00Z',
    leadId: 'lead-1',
    lead: {
      id: 'lead-1',
      companyId: 'comp-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      phone: '+1-512-555-0100',
      propertyAddress: '1247 Oak Ridge Dr, Austin, TX 78704',
      propertyLatLng: { lat: 30.2672, lng: -97.7431 },
      source: 'WEBSITE',
      status: 'INSPECTION_SCHEDULED',
      createdAt: '2026-09-10T08:00:00Z',
      updatedAt: '2026-09-12T10:30:00Z',
    },
    company: {
      id: 'comp-1',
      name: 'Acme Roofing',
      subscriptionTier: 'Professional',
      createdAt: '2026-09-10T08:00:00Z',
      updatedAt: '2026-09-12T10:30:00Z',
    },
  },
  {
    id: 'job-2',
    companyId: 'comp-2',
    name: 'Job Two',
    status: 'ACTIVE',
    phase: 'INSPECTION',
    propertyAddress: '3856 Maple Ave, Dallas, TX 75201',
    propertyLatLng: { lat: 32.7767, lng: -96.7970 },
    grossProfit: 8500,
    budget: 12000,
    actualCost: 9500,
    estimatedCost: 11000,
    createdByUserId: 'user-2',
    createdAt: '2026-09-11T09:00:00Z',
    updatedAt: '2026-09-12T11:15:00Z',
    leadId: 'lead-2',
    lead: {
      id: 'lead-2',
      companyId: 'comp-2',
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@example.com',
      phone: '+1-512-555-0101',
      propertyAddress: '3856 Maple Ave, Dallas, TX 75201',
      propertyLatLng: { lat: 32.7767, lng: -96.7970 },
      source: 'PHONE',
      status: 'ESTIMATE_SENT',
      createdAt: '2026-09-11T09:00:00Z',
      updatedAt: '2026-09-12T11:15:00Z',
    },
    company: {
      id: 'comp-2',
      name: 'Coastal Roofing',
      subscriptionTier: 'Professional',
      createdAt: '2026-09-11T09:00:00Z',
      updatedAt: '2026-09-12T11:15:00Z',
    },
  },
];

const mockLeads: Lead[] = [
  {
    id: 'lead-1',
    companyId: 'comp-1',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    phone: '+1-512-555-0100',
    propertyAddress: '789 Pine St, San Antonio, TX 78209',
    propertyLatLng: { lat: 29.4241, lng: -98.4936 },
    source: 'WEBSITE',
    status: 'INSPECTION_SCHEDULED',
    assignedToUserId: 'user-1',
    stormEventId: 'storm-1',
    score: 72,
    notes: 'Scheduled inspection after storm',
    jobId: 'job-1',
    createdAt: '2026-09-10T14:30:00Z',
    updatedAt: '2026-09-12T09:00:00Z',
    assignedTo: {
      id: 'user-1',
      companyId: 'comp-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      role: 'PROJECT_MANAGER',
      isActive: true,
      createdAt: '2026-09-10T08:00:00Z',
      updatedAt: '2026-09-12T10:30:00Z',
    },
    stormEvent: {
      id: 'storm-1',
      name: 'Thunderstorm Alpha',
    } as StormEvent,
    job: {
      id: 'job-1',
      name: 'Job One',
      status: 'ACTIVE',
      phase: 'PRODUCTION',
      propertyAddress: '1247 Oak Ridge Dr, Austin, TX 78704',
    } as Job,
  },
  {
    id: 'lead-2',
    companyId: 'comp-2',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    phone: '+1-512-555-0101',
    propertyAddress: '456 Elm Rd, Houston, TX 77002',
    propertyLatLng: { lat: 29.7604, lng: -95.3698 },
    source: 'PHONE',
    status: 'ESTIMATE_SENT',
    assignedToUserId: 'user-1',
    stormEventId: 'storm-2',
    score: 55,
    jobId: 'job-2',
    createdAt: '2026-09-09T11:15:00Z',
    updatedAt: '2026-09-11T16:45:00Z',
    assignedTo: {
      id: 'user-2',
      companyId: 'comp-2',
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@example.com',
      role: 'SALES_REP',
      isActive: true,
      createdAt: '2026-09-11T09:00:00Z',
      updatedAt: '2026-09-12T11:15:00Z',
    },
    stormEvent: {
      id: 'storm-2',
      name: 'Storm Beta',
    } as StormEvent,
    job: {
      id: 'job-2',
      name: 'Job Two',
      status: 'ACTIVE',
      phase: 'INSPECTION',
      propertyAddress: '3856 Maple Ave, Dallas, TX 75201',
    } as Job,
  },
];

const mockStormEvents: StormEvent[] = [
  {
    id: 'storm-1',
    companyId: 'comp-5',
    name: 'Thunderstorm Alpha',
    description: 'Severe thunderstorm with hail',
    startDate: '2026-09-12T06:00:00Z',
    endDate: '2026-09-12T12:00:00Z',
    severity: 'SEVERE',
    eventType: 'SEVERE_THUNDERSTORM',
    affectedArea: { center: [30.2672, -97.7431] },
    createdAt: '2026-09-12T06:00:00Z',
    updatedAt: '2026-09-12T10:00:00Z',
  },
];

const mockWeatherAlerts: WeatherAlert[] = [
  {
    id: 'alert-1',
    type: 'Tornado Warning',
    severity: 'SEVERE',
    urgency: 'Immediate',
    certainty: 'Likely',
    effective: '2026-09-12T10:00:00Z',
    expires: '2026-09-12T14:00:00Z',
    headline: 'Tornado Warning for Travis County',
    description: 'Doppler radar indicated tornado near Austin',
    instruction: 'Take shelter immediately',
    area: 'Travis County, TX',
    geometry: {},
    sender: 'system',
  },
];

const meta = {
  title: 'AtlasHelios/DashboardCommandCenter',
  component: DashboardCommandCenter,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DashboardCommandCenter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <ProviderWrapper>
      <DashboardCommandCenter {...args} />
    </ProviderWrapper>
  ),
  args: {
    jobs: mockJobs,
    leads: mockLeads,
    stormEvents: mockStormEvents,
    weatherAlerts: mockWeatherAlerts,
  },
};

export const WithData: Story = {
  name: 'With Mock Data',
  render: (args) => (
    <ProviderWrapper>
      <DashboardCommandCenter {...args} />
    </ProviderWrapper>
  ),
  args: {
    jobs: [...mockJobs, ...Array(5).fill(null).map((_, i) => ({
      id: `job-${i+3}`,
      companyId: `comp-${i+3}`,
      name: `Job ${i+3}`,
      status: ['ACTIVE', 'COMPLETED', 'ON_HOLD'][i % 3] as Job['status'],
      phase: ['INSPECTION', 'ESTIMATE', 'PRODUCTION'][i % 3] as Job['phase'],
      propertyAddress: `${(i+3)*100} Test St, Test City, TX 75000`,
      propertyLatLng: { lat: 30 + (i * 0.1), lng: -97 - (i * 0.1) },
      grossProfit: 5000 + (i * 1000),
      budget: 10000 + (i * 2000),
      actualCost: 6000 + (i * 1500),
      estimatedCost: 9000 + (i * 1000),
      createdByUserId: `user-${i+1}`,
      createdAt: `2026-09-${10+i}T${String(8+i).padStart(2, '0')}:00:00Z`,
      updatedAt: `2026-09-${12}T${String(10+i%3).padStart(2, '0')}:${String(30+i*5).padStart(2, '0')}:00Z`,
    }))],
    leads: [...mockLeads, ...Array(3).fill(null).map((_, i) => ({
      id: `lead-${i+3}`,
      companyId: `comp-${i+3}`,
      firstName: 'Test',
      lastName: `User ${i+3}`,
      email: `test.user${i+3}@example.com`,
      phone: `+1-555-010${i+3}`,
      propertyAddress: `${(i+3)*50} Sample Ave, Sample City, TX 76000`,
      propertyLatLng: { lat: 29 + (i * 0.05), lng: -98 - (i * 0.05) },
      source: ['WEBSITE', 'PHONE', 'REFERRAL'][i % 3] as Lead['source'],
      status: ['NEW', 'CONTACTED', 'WON'][i % 3] as Lead['status'],
      createdAt: `2026-09-${9+i}T${String(10+i).padStart(2, '0')}:${String(15+i*10).padStart(2, '0')}:00Z`,
      updatedAt: `2026-09-${11+i}T${String(14+i%2).padStart(2, '0')}:${String(20+i*15).padStart(2, '0')}:00Z`,
    }))],
    stormEvents: [...mockStormEvents, ...Array(2).fill(null).map((_, i) => ({
      id: `storm-${i+2}`,
      companyId: `comp-${i+3}`,
      name: `Storm ${i+2}`,
      description: `Storm description ${i+2}`,
      startDate: `2026-09-${11+i}T00:00:00Z`,
      endDate: `2026-09-${12}T00:00:00Z`,
      severity: ['MINOR', 'MODERATE', 'SEVERE', 'EXTREME'][i % 4] as StormEvent['severity'],
      eventType: ['TORNADO', 'HURRICANE', 'SEVERE_THUNDERSTORM', 'FLASH_FLOOD', 'WINTER_STORM', 'WILDFIRE'][i % 6] as StormEvent['eventType'],
      affectedArea: { center: [29 + (i * 0.2), -96 - (i * 0.15)] },
      createdAt: `2026-09-${11+i}T${String(6+i*2).padStart(2, '0')}:${String(30+i*10).padStart(2, '0')}:00Z`,
      updatedAt: `2026-09-${12}T${String(10+i).padStart(2, '0')}:${String(45+i*5).padStart(2, '0')}:00Z`,
    }))],
    weatherAlerts: [...mockWeatherAlerts, ...Array(2).fill(null).map((_, i) => ({
      id: `alert-${i+2}`,
      type: ['Severe Thunderstorm Warning', 'Flash Flood Watch', 'Winter Weather Advisory'][i % 3],
      severity: ['MINOR', 'MODERATE', 'SEVERE'][i % 3] as WeatherAlert['severity'],
      urgency: ['Expected', 'Immediate', 'Past'][i % 3],
      certainty: ['Likely', 'Possible', 'Observed'][i % 3],
      effective: `2026-09-${12}T${String(8+i*3).padStart(2, '0')}:${String(0+i*15).padStart(2, '0')}:00Z`,
      expires: `2026-09-${12}T${String(12+i*3).padStart(2, '0')}:${String(0+i*15).padStart(2, '0')}:00Z`,
      headline: `Weather Alert for Test County ${i+1}`,
      description: `Test weather alert description ${i+1}`,
      instruction: `Take appropriate precautions for alert ${i+1}`,
      area: `Test County ${i+1}, TX`,
      geometry: {},
      sender: 'system',
    }))],
  },
};

export const Minimal: Story = {
  name: 'Minimal Data',
  render: (args) => (
    <ProviderWrapper>
      <DashboardCommandCenter {...args} />
    </ProviderWrapper>
  ),
  args: {
    jobs: [],
    leads: [],
    stormEvents: [],
    weatherAlerts: [],
  },
};

export const HighRisk: Story = {
  name: 'High Risk Scenario',
  render: (args) => (
    <ProviderWrapper>
      <DashboardCommandCenter {...args} />
    </ProviderWrapper>
  ),
  args: {
    jobs: [
      {
        id: 'job-high-risk',
        companyId: 'comp-hr',
        name: 'High Risk Job',
        status: 'ACTIVE',
        phase: 'PRODUCTION',
        propertyAddress: '999 High Risk Blvd, Danger Zone, TX 79999',
        propertyLatLng: { lat: 32.0, lng: -102.0 },
        grossProfit: 50000,
        budget: 75000,
        actualCost: 65000,
        estimatedCost: 70000,
        createdByUserId: 'user-1',
        createdAt: '2026-09-11T08:00:00Z',
        updatedAt: '2026-09-12T12:00:00Z',
      },
    ],
    leads: [],
    stormEvents: [
      {
        id: 'storm-extreme',
        companyId: 'comp-ext',
        name: 'Hurricane Helios',
        description: 'Category 4 hurricane approaching Gulf Coast',
        startDate: '2026-09-12T04:00:00Z',
        endDate: '2026-09-13T04:00:00Z',
        severity: 'EXTREME',
        eventType: 'HURRICANE',
        affectedArea: { center: [32.0, -102.0] },
        createdAt: '2026-09-12T04:00:00Z',
        updatedAt: '2026-09-12T12:00:00Z',
      },
    ],
    weatherAlerts: [
      {
        id: 'alert-extreme',
        type: 'Hurricane Warning',
        severity: 'EXTREME',
        urgency: 'Immediate',
        certainty: 'Observed',
        effective: '2026-09-12T06:00:00Z',
        expires: '2026-09-13T06:00:00Z',
        headline: 'Hurricane Warning for Coastal Texas',
        description: 'Category 4 hurricane approaching Gulf Coast',
        instruction: 'Evacuate coastal areas immediately',
        area: 'Gulf Coast, TX',
        geometry: {},
        sender: 'system',
      },
    ],
  },
};

export const Accessible: Story = {
  name: 'Accessibility Test',
  render: (args) => (
    <ProviderWrapper>
      <DashboardCommandCenter {...args} />
    </ProviderWrapper>
  ),
  args: {
    jobs: mockJobs,
    leads: mockLeads,
    stormEvents: mockStormEvents,
    weatherAlerts: mockWeatherAlerts,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Test landmarks
    await expect(canvas.getByRole('banner')).toBeInTheDocument();
    await expect(canvas.getByRole('main')).toBeInTheDocument();
    await expect(canvas.getByRole('region', { name: /Priority Property Queue/i })).toBeInTheDocument();
    // Test button labels
    const buttons = canvas.getAllByRole('button');
    for (const button of buttons) {
      await expect(button).toHaveAccessibleName();
    }
    // Test ARIA attributes
    const liveRegions = canvas.getAllByRole('status');
    expect(liveRegions.length).toBeGreaterThan(0);
    // Check for proper heading structure
    const headings = canvas.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'keyboard', enabled: true },
          { id: 'label', enabled: true },
          { id: 'landmark-one-main', enabled: true },
          { id: 'region', enabled: true },
        ],
      },
    },
  },
};

export const Interaction: Story = {
  name: 'Interaction Test',
  render: (args) => (
    <ProviderWrapper>
      <DashboardCommandCenter {...args} />
    </ProviderWrapper>
  ),
  args: {
    jobs: mockJobs,
    leads: mockLeads,
    stormEvents: mockStormEvents,
    weatherAlerts: mockWeatherAlerts,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/ATLAS \/ HELIOS/i)).toBeInTheDocument();
    await expect(canvas.getByText(/LIVE/i)).toBeInTheDocument();
    await expect(canvas.getByText(/ACTIVE PROPERTIES/i)).toBeInTheDocument();
    await expect(canvas.getByText(/PRIORITY PROPERTY QUEUE/i)).toBeInTheDocument();
    const metricCards = canvas.getAllByRole('group', { name: /Metric/i });
    await expect(metricCards).toHaveLength(5);
    const panels = canvas.getAllByRole('region');
    await expect(panels.length).toBeGreaterThan(0);
  },
};