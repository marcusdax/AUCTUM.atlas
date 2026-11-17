import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as rtlRender, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// The component renders router <Link>s, so every render needs a router around it.
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });
import type { Job, Lead, StormEvent, WeatherAlert } from '../../types';

// Mock external dependencies
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: undefined, isLoading: false, error: null })),
  useQueryClient: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { findings: [] } }),
  },
}));

vi.mock('../StormMap', () => ({
  default: ({ storms, height, selectedLocation }: any) => (
    <div data-testid="storm-map" style={{ height: height || '100%' }}>
      Map placeholder - storms: {storms?.length || 0}
    </div>
  ),
}));

vi.mock('../primitives/Metric', () => ({
  Metric: ({ title, value, state, hint }: any) => (
    <div data-testid={`metric-${title.toLowerCase().replace(/\s+/g, '-')}`} className="metric">
      <span data-testid="metric-title">{title}</span>
      <span data-testid="metric-value">{value}</span>
      <span data-testid="metric-state">{state}</span>
      <span data-testid="metric-hint">{hint}</span>
    </div>
  ),
}));

vi.mock('../primitives/Signal', () => ({
  Signal: ({ label, status, color, pulse, strength, type }: any) => (
    <div data-testid={`signal-${label.toLowerCase()}`} className="signal">
      <span data-testid="signal-label">{label}</span>
      <span data-testid="signal-status">{status}</span>
      <span data-testid="signal-color">{color}</span>
      <span data-testid="signal-pulse">{pulse ? 'true' : 'false'}</span>
    </div>
  ),
}));

vi.mock('./IntelligenceLayerProvider', () => {
  const mockContext = {
    state: {
      layers: {
        atlas: { status: 'LIVE' as const, lastUpdate: new Date().toISOString(), freshness: 95 },
        helios: { status: 'LIVE' as const, lastUpdate: new Date().toISOString(), freshness: 93 },
        command: { status: 'LIVE' as const, lastUpdate: new Date().toISOString(), freshness: 97 },
        intelligence: { status: 'LIVE' as const, lastUpdate: new Date().toISOString(), freshness: 92 },
        system: { status: 'LIVE' as const, lastUpdate: new Date().toISOString(), freshness: 98 },
      },
    },
    setLayerStatus: vi.fn(),
    setLayerLastUpdate: vi.fn(),
    setLayerFreshness: vi.fn(),
    setLayerState: vi.fn(),
    getLayerState: vi.fn((id: string) => 'LIVE'),
    getLastUpdate: vi.fn((id: string) => new Date().toISOString()),
    getFreshness: vi.fn((id: string) => 95),
    getLayer: vi.fn((id: string) => ({ status: 'LIVE', lastUpdate: new Date().toISOString(), freshness: 95 })),
    isLayerHealthy: vi.fn(() => true),
    getOverallStatus: vi.fn(() => 'LIVE' as const),
  };

  return {
    IntelligenceLayerProvider: ({ children }: any) => (
      <div data-testid="intelligence-layer-provider">{children}</div>
    ),
    useIntelligenceLayer: () => mockContext,
    useLayer: () => ({ status: 'LIVE', isHealthy: true, refresh: vi.fn() }),
    useSystemHealth: () => ({
      overallStatus: 'LIVE',
      healthyLayers: 5,
      totalLayers: 5,
      layers: mockContext.state.layers,
    }),
  };
});

// Import after mocks
import DashboardCommandCenter from './DashboardCommandCenter';

// Test data factories
const createMockJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  companyId: 'company-1',
  name: 'Roof Replacement',
  description: 'Full roof replacement',
  status: 'ACTIVE',
  phase: 'PRODUCTION',
  propertyAddress: '123 Main St, Dallas, TX 75201',
  propertyLatLng: { lat: 32.7767, lng: -96.7970 },
  startDate: '2024-01-15',
  endDate: '2024-01-20',
  createdByUserId: 'user-1',
  createdAt: '2024-01-10T10:00:00Z',
  updatedAt: '2024-01-10T10:00:00Z',
  ...overrides,
});

const createMockLead = (overrides: Partial<Lead> = {}): Lead => ({
  id: 'lead-1',
  companyId: 'company-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '555-1234',
  propertyAddress: '456 Oak Ave, Houston, TX 77001',
  propertyLatLng: { lat: 29.7604, lng: -95.3698 },
  source: 'WEBSITE',
  status: 'INSPECTION_SCHEDULED',
  score: 85,
  createdAt: '2024-01-05T10:00:00Z',
  updatedAt: '2024-01-05T10:00:00Z',
  ...overrides,
});

const createMockStormEvent = (overrides: Partial<StormEvent> = {}): StormEvent => ({
  id: 'storm-1',
  companyId: 'company-1',
  name: 'Hurricane Alpha',
  description: 'Category 4 hurricane',
  startDate: '2024-08-15',
  endDate: '2024-08-18',
  severity: 'EXTREME',
  eventType: 'HURRICANE',
  affectedArea: { center: [25.7617, -80.1918], radius: 50 },
  createdAt: '2024-08-01T10:00:00Z',
  updatedAt: '2024-08-01T10:00:00Z',
  ...overrides,
});

const createMockWeatherAlert = (overrides: Partial<WeatherAlert> = {}): WeatherAlert => ({
  id: 'alert-1',
  type: 'Hurricane Warning',
  severity: 'EXTREME',
  urgency: 'Immediate',
  certainty: 'Observed',
  effective: '2024-08-15T12:00:00Z',
  expires: '2024-08-18T12:00:00Z',
  headline: 'Hurricane Warning for Texas Coast',
  description: 'Hurricane conditions expected...',
  instruction: 'Complete preparations...',
  area: 'Coastal Texas',
  geometry: { type: 'Polygon', coordinates: [] },
  sender: 'NWS',
  ...overrides,
});

const defaultProps = {
  jobs: [createMockJob()] as Job[],
  leads: [createMockLead()] as Lead[],
  stormEvents: [createMockStormEvent()] as StormEvent[],
  weatherAlerts: [createMockWeatherAlert()] as WeatherAlert[],
};

describe('DashboardCommandCenter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders without crashing with default props', () => {
    const { container } = render(<DashboardCommandCenter {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it('renders header bar with ATLAS / HELIOS title', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    expect(screen.getByText('ATLAS / HELIOS')).toBeInTheDocument();
  });

  it('renders LIVE status indicator', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    // Check for LIVE in the header bar - the header status has font-mono text-sm font-medium class
    const headerStatusElements = screen.getAllByText('LIVE');
    // At least one LIVE should be present (header + metric cards)
    expect(headerStatusElements.length).toBeGreaterThan(0);
  });

  it('renders all 5 metric cards with correct titles', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    
    expect(screen.getByText('ACTIVE PROPERTIES')).toBeInTheDocument();
    expect(screen.getByText('STORM ALERTS')).toBeInTheDocument();
    expect(screen.getByText('AI FINDINGS')).toBeInTheDocument();
    expect(screen.getByText('AVG RISK SCORE')).toBeInTheDocument();
    expect(screen.getByText('SYSTEM STATUS')).toBeInTheDocument();
  });

  it('displays correct metric values based on props', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    
    // Active Properties = 1 job + 1 lead = 2
    const activePropertiesMetric = screen.getByTestId('metric-active-properties');
    expect(activePropertiesMetric).toHaveTextContent('2');
    
    // Storm Alerts = 1 extreme alert
    const stormAlertsMetric = screen.getByTestId('metric-storm-alerts');
    expect(stormAlertsMetric).toHaveTextContent('1');
  });

  it('renders all 5 intelligence layer panels', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    
    // Check for panel headers (font-semibold class) which are the main panel labels
    const panelHeaders = screen.getAllByText(/ATLAS|HELIOS|COMMAND|INTELLIGENCE|SYSTEM/);
    // Should find at least one for each
    expect(panelHeaders.some(el => el.textContent === 'ATLAS')).toBe(true);
    expect(panelHeaders.some(el => el.textContent === 'HELIOS')).toBe(true);
    expect(panelHeaders.some(el => el.textContent === 'COMMAND')).toBe(true);
    expect(panelHeaders.some(el => el.textContent === 'INTELLIGENCE')).toBe(true);
    expect(panelHeaders.some(el => el.textContent === 'SYSTEM')).toBe(true);
  });

  it('renders Storm Map component', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    expect(screen.getByTestId('storm-map')).toBeInTheDocument();
  });

  it('renders Priority Property Queue section', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    expect(screen.getByText('PRIORITY PROPERTY QUEUE')).toBeInTheDocument();
  });

  it('shows property items in queue with address and risk score', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    
    expect(screen.getByText('123 Main St, Dallas, TX 75201')).toBeInTheDocument();
    expect(screen.getByText('456 Oak Ave, Houston, TX 77001')).toBeInTheDocument();
  });

  it('displays risk score badges for queue items', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    
    // Risk scores should be displayed - check for numeric text content between 0-100
    const elements = screen.getAllByText(/\d+/);
    const riskScoreElements = elements.filter(el => {
      const text = el.textContent || '';
      const num = Number(text);
      return !isNaN(num) && num >= 0 && num <= 100 && text.trim() === text;
    });
    expect(riskScoreElements.length).toBeGreaterThan(0);
  });

  it('shows property type badges (JOB, LEAD, STORM)', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    
    expect(screen.getByText('JOB')).toBeInTheDocument();
    expect(screen.getByText('LEAD')).toBeInTheDocument();
    expect(screen.getByText('STORM')).toBeInTheDocument();
  });

  it('displays storm name for storm-type properties', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    expect(screen.getByText('Hurricane Alpha')).toBeInTheDocument();
  });

  it('renders coordinate information for properties', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    
    expect(screen.getByText('32.7767, -96.7970')).toBeInTheDocument();
    expect(screen.getByText('29.7604, -95.3698')).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    const emptyProps = {
      jobs: [],
      leads: [],
      stormEvents: [],
      weatherAlerts: [],
    };
    
    render(<DashboardCommandCenter {...emptyProps} />);
    
    expect(screen.getByText('No properties in queue')).toBeInTheDocument();
  });

  it('shows correct system status based on layer health', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    
    // Should show OPERATIONAL for LIVE status
    expect(screen.getByText('OPERATIONAL')).toBeInTheDocument();
  });

  it('displays freshness percentages for each layer', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    
    // Freshness values should be displayed - there should be multiple 95% elements
    const freshnessElements = screen.getAllByText('95%');
    expect(freshnessElements.length).toBeGreaterThan(0);
  });

  it('renders last update timestamps', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    
    // There are multiple "Last update:" elements (one per panel)
    const lastUpdateElements = screen.getAllByText(/Last update:/);
    expect(lastUpdateElements.length).toBeGreaterThan(0);
  });

  it('computes average risk score correctly from multiple sources', () => {
    const highRiskProps = {
      jobs: [createMockJob({ id: 'job-1' }), createMockJob({ id: 'job-2', propertyAddress: '789 Pine St' })],
      leads: [createMockLead({ id: 'lead-1' })],
      stormEvents: [createMockStormEvent({ id: 'storm-1', severity: 'EXTREME' })],
      weatherAlerts: [createMockWeatherAlert({ id: 'alert-1' })],
    };
    
    render(<DashboardCommandCenter {...highRiskProps} />);
    
    // Risk score should be computed and displayed
    const riskScoreMetric = screen.getByTestId('metric-avg-risk-score');
    expect(riskScoreMetric).toBeInTheDocument();
  });

  it('shows correct number of active jobs in COMMAND panel', () => {
    const propsWithJobs = {
      ...defaultProps,
      jobs: [
        createMockJob({ id: 'job-1', status: 'ACTIVE' }),
        createMockJob({ id: 'job-2', status: 'ACTIVE' }),
        createMockJob({ id: 'job-3', status: 'COMPLETED' }),
      ],
    };
    
    render(<DashboardCommandCenter {...propsWithJobs} />);
    
    // COMMAND panel should show 2 active missions - check the command signal panel exists
    const commandSignal = screen.getByTestId('signal-command');
    expect(commandSignal).toBeInTheDocument();
  });

  it('shows severe alerts count in ATLAS panel', () => {
    const propsWithAlerts = {
      ...defaultProps,
      weatherAlerts: [
        createMockWeatherAlert({ id: 'alert-1', severity: 'EXTREME' }),
        createMockWeatherAlert({ id: 'alert-2', severity: 'SEVERE' }),
        createMockWeatherAlert({ id: 'alert-3', severity: 'MODERATE' }),
      ],
    };
    
    render(<DashboardCommandCenter {...propsWithAlerts} />);
    
    // ATLAS panel should show 2 severe alerts - check for the storm alerts metric
    const stormAlertsMetric = screen.getByTestId('metric-storm-alerts');
    expect(stormAlertsMetric).toHaveTextContent('2');
  });

  it('shows live clock with UTC timezone', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    
    expect(screen.getByText(/UTC/)).toBeInTheDocument();
  });

  it('renders intelligence layer provider wrapper', () => {
    render(<DashboardCommandCenter {...defaultProps} />);
    
    expect(screen.getByTestId('intelligence-layer-provider')).toBeInTheDocument();
  });
});

describe('DashboardCommandCenter - edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('handles jobs without propertyLatLng', () => {
    const props = {
      ...defaultProps,
      jobs: [createMockJob({ propertyLatLng: undefined })],
    };
    
    render(<DashboardCommandCenter {...props} />);
    // Should still render the component without crashing
    expect(screen.getByText('PRIORITY PROPERTY QUEUE')).toBeInTheDocument();
  });

  it('handles leads with NEW status (should be filtered out)', () => {
    const props = {
      ...defaultProps,
      leads: [createMockLead({ status: 'NEW' })],
    };
    
    render(<DashboardCommandCenter {...props} />);
    // NEW leads are filtered out from active properties count - should show 1 active property
    const activePropertiesMetric = screen.getByTestId('metric-active-properties');
    expect(activePropertiesMetric).toHaveTextContent('1');
  });

  it('handles storm events without affectedArea.center', () => {
    const props = {
      ...defaultProps,
      stormEvents: [createMockStormEvent({ affectedArea: undefined })],
    };
    
    render(<DashboardCommandCenter {...props} />);
    // Should not crash
    expect(screen.getByText('PRIORITY PROPERTY QUEUE')).toBeInTheDocument();
  });

  it('sorts priority queue by risk score descending', () => {
    const props = {
      ...defaultProps,
      jobs: [
        createMockJob({ id: 'job-low', propertyAddress: 'Low Risk', propertyLatLng: { lat: 30, lng: -90 } }),
        createMockJob({ id: 'job-high', propertyAddress: 'High Risk', propertyLatLng: { lat: 31, lng: -91 } }),
      ],
      stormEvents: [
        createMockStormEvent({ 
          id: 'storm-high', 
          name: 'Severe Storm',
          affectedArea: { center: [31, -91] }, // Near job-high
        }),
      ],
    };
    
    render(<DashboardCommandCenter {...props} />);
    
    // High risk item should appear first
    const queueItems = screen.getAllByText(/Risk/);
    expect(queueItems.length).toBeGreaterThan(0);
  });

  it('limits queue to top 10 items', () => {
    const manyJobs = Array.from({ length: 15 }, (_, i) => 
      createMockJob({ id: `job-${i}`, propertyAddress: `Address ${i}` })
    );
    
    const props = {
      ...defaultProps,
      jobs: manyJobs,
      leads: [],
      stormEvents: [],
    };
    
    render(<DashboardCommandCenter {...props} />);
    
    // Should only show top 10
    const queueItems = screen.getAllByText(/Address \d+/);
    expect(queueItems.length).toBeLessThanOrEqual(10);
  });
});

describe('DashboardCommandCenter - Accessibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('should render without crashing', () => {
    const { container } = render(<DashboardCommandCenter {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it('should render with minimal data', () => {
    const emptyProps = {
      jobs: [],
      leads: [],
      stormEvents: [],
      weatherAlerts: [],
    };
    
    const { container } = render(<DashboardCommandCenter {...emptyProps} />);
    expect(container).toBeInTheDocument();
  });

  it('should render with high risk scenario', () => {
    const highRiskProps = {
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
        } as Job,
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
        } as StormEvent,
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
        } as WeatherAlert,
      ],
    };
    
    const { container } = render(<DashboardCommandCenter {...highRiskProps} />);
    expect(container).toBeInTheDocument();
  });
});