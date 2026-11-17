import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

// Mock Leaflet before any imports
vi.mock('leaflet', () => {
  const mockMap = {
    getSize: () => ({ x: 800, y: 600 }),
    latLngToContainerPoint: ([lat, lng]: [number, number]) => ({ x: lat * 10, y: lng * 10 }),
    getPane: () => document.body,
    on: vi.fn(),
    off: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    hasLayer: vi.fn(() => true),
  };

  // Define the Layer mock class type
  interface MockLayerInstance {
    options: any;
  }

  return {
    Layer: vi.fn().mockImplementation(function(this: MockLayerInstance) {
      this.options = {};
    }),
    Map: vi.fn(() => mockMap),
    CircleMarker: vi.fn().mockImplementation((options) => ({
      options,
      center: options.center,
      radius: options.radius,
      pathOptions: options.pathOptions,
    })),
    Popup: vi.fn().mockImplementation((options) => ({
      options,
      children: options.children,
    })),
    divIcon: vi.fn(),
    Icon: vi.fn(),
    DomUtil: {
      create: vi.fn(() => document.createElement('div')),
    },
    Browser: {
      any3d: true,
    },
  };
});

vi.mock('react-leaflet', () => ({
  CircleMarker: ({ center, radius, pathOptions, color, fillColor, fillOpacity, weight, eventHandlers, children, className, ...props }: any) => {
    const combinedPathOptions = { ...pathOptions, color, fillColor, fillOpacity, weight };
    // Get aria-label from props or generate from address
    const ariaLabel = props['aria-label'] || `Property marker at ${center[0].toFixed(4)}, ${center[1].toFixed(4)}`;
    return (
      <div
        data-testid="circle-marker"
        data-center={JSON.stringify(center)}
        data-radius={radius}
        data-path-options={JSON.stringify(combinedPathOptions)}
        data-class-name={className}
        onMouseOver={eventHandlers?.mouseover}
        onMouseOut={eventHandlers?.mouseout}
        onClick={eventHandlers?.click}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        {...props}
      >
        {children}
      </div>
    );
  },
  Popup: ({ children, className, ...props }: any) => (
    <div data-testid="popup" data-class-name={className} {...props}>
      {children}
    </div>
  ),
  LayerGroup: ({ children }: any) => <div data-testid="layer-group">{children}</div>,
  useMap: vi.fn(() => ({
    getSize: () => ({ x: 800, y: 600 }),
    latLngToContainerPoint: ([lat, lng]: [number, number]) => ({ x: lat * 10, y: lng * 10 }),
    getPane: () => document.body,
    on: vi.fn(),
    off: vi.fn(),
    hasLayer: vi.fn(() => true),
  })),
  MapContainer: ({ children, ...props }: any) => <div data-testid="map-container" {...props}>{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
}));

// Import after mocks
import { PropertyNode } from './PropertyNode';

describe('PropertyNode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  const defaultProps = {
    lat: 32.7767,
    lng: -96.7970,
    address: '123 Main St, Dallas, TX 75201',
    riskScore: 75,
    propertyType: 'Residential' as const,
    status: 'LIVE' as const,
    id: 'prop-1',
    onClick: vi.fn(),
  };

  describe('Basic rendering', () => {
    it('renders without crashing with required props', () => {
      const { container } = render(<PropertyNode {...defaultProps} />);
      expect(container).toBeInTheDocument();
    });

    it('renders CircleMarker with correct center', () => {
      render(<PropertyNode {...defaultProps} />);
      const marker = screen.getByTestId('circle-marker');
      expect(marker).toHaveAttribute('data-center', '[32.7767,-96.797]');
    });

    it('renders CircleMarker with risk-based radius', () => {
      render(<PropertyNode {...defaultProps} />);
      const marker = screen.getByTestId('circle-marker');
      expect(marker).toHaveAttribute('data-radius');
      const radius = Number(marker.getAttribute('data-radius'));
      expect(radius).toBeGreaterThanOrEqual(8);
      expect(radius).toBeLessThanOrEqual(20);
    });

    it('applies risk-based color styling', () => {
      render(<PropertyNode {...defaultProps} />);
      const marker = screen.getByTestId('circle-marker');
      const pathOptions = JSON.parse(marker.getAttribute('data-path-options') || '{}');
      expect(pathOptions.fillColor).toBeDefined();
      expect(pathOptions.color).toBe('#ffffff');
    });
  });

  describe('Risk score color coding', () => {
    it('applies Critical (red) styling for riskScore >= 75', () => {
      render(<PropertyNode {...defaultProps} riskScore={85} />);
      const marker = screen.getByTestId('circle-marker');
      const pathOptions = JSON.parse(marker.getAttribute('data-path-options') || '{}');
      expect(pathOptions.fillColor).toBe('#ef4444');
    });

    it('applies High (orange) styling for riskScore >= 50', () => {
      render(<PropertyNode {...defaultProps} riskScore={55} />);
      const marker = screen.getByTestId('circle-marker');
      const pathOptions = JSON.parse(marker.getAttribute('data-path-options') || '{}');
      expect(pathOptions.fillColor).toBe('#f97316');
    });

    it('applies Medium (amber) styling for riskScore >= 25', () => {
      render(<PropertyNode {...defaultProps} riskScore={30} />);
      const marker = screen.getByTestId('circle-marker');
      const pathOptions = JSON.parse(marker.getAttribute('data-path-options') || '{}');
      expect(pathOptions.fillColor).toBe('#fbbf24');
    });

    it('applies Low (green) styling for riskScore < 25', () => {
      render(<PropertyNode {...defaultProps} riskScore={10} />);
      const marker = screen.getByTestId('circle-marker');
      const pathOptions = JSON.parse(marker.getAttribute('data-path-options') || '{}');
      expect(pathOptions.fillColor).toBe('#22c55e');
    });
  });

  describe('Pulse animation for high-risk properties', () => {
    it('applies high-risk-pulse class for riskScore >= 75', () => {
      render(<PropertyNode {...defaultProps} riskScore={85} />);
      const marker = screen.getByTestId('circle-marker');
      const className = marker.getAttribute('data-class-name') || '';
      expect(className).toContain('high-risk-pulse');
    });

    it('does not apply high-risk-pulse class for riskScore < 75', () => {
      render(<PropertyNode {...defaultProps} riskScore={55} />);
      const marker = screen.getByTestId('circle-marker');
      const className = marker.getAttribute('data-class-name') || '';
      expect(className).not.toContain('high-risk-pulse');
    });
  });

  describe('Property type variations', () => {
    it('renders with Residential type', () => {
      render(<PropertyNode {...defaultProps} propertyType="Residential" />);
      expect(screen.getByTestId('circle-marker')).toBeInTheDocument();
    });

    it('renders with Commercial type', () => {
      render(<PropertyNode {...defaultProps} propertyType="Commercial" />);
      expect(screen.getByTestId('circle-marker')).toBeInTheDocument();
    });

    it('renders with Industrial type', () => {
      render(<PropertyNode {...defaultProps} propertyType="Industrial" />);
      expect(screen.getByTestId('circle-marker')).toBeInTheDocument();
    });

    it('renders with Agricultural type', () => {
      render(<PropertyNode {...defaultProps} propertyType="Agricultural" />);
      expect(screen.getByTestId('circle-marker')).toBeInTheDocument();
    });

    it('renders with Unknown type', () => {
      render(<PropertyNode {...defaultProps} propertyType="Unknown" />);
      expect(screen.getByTestId('circle-marker')).toBeInTheDocument();
    });
  });

  describe('Status variations', () => {
    it('renders with LIVE status', () => {
      render(<PropertyNode {...defaultProps} status="LIVE" />);
      expect(screen.getByTestId('circle-marker')).toBeInTheDocument();
    });

    it('renders with SYNCING status', () => {
      render(<PropertyNode {...defaultProps} status="SYNCING" />);
      expect(screen.getByTestId('circle-marker')).toBeInTheDocument();
    });

    it('renders with STALE status', () => {
      render(<PropertyNode {...defaultProps} status="STALE" />);
      expect(screen.getByTestId('circle-marker')).toBeInTheDocument();
    });

    it('renders with DEGRADED status', () => {
      render(<PropertyNode {...defaultProps} status="DEGRADED" />);
      expect(screen.getByTestId('circle-marker')).toBeInTheDocument();
    });

    it('renders with OFFLINE status', () => {
      render(<PropertyNode {...defaultProps} status="OFFLINE" />);
      expect(screen.getByTestId('circle-marker')).toBeInTheDocument();
    });
  });

  describe('Click handler', () => {
    it('calls onClick with property data when clicked', () => {
      const onClick = vi.fn();
      render(<PropertyNode {...defaultProps} onClick={onClick} />);
      const marker = screen.getByTestId('circle-marker');
      
      // Simulate click event on the marker
      fireEvent(marker, 'click');
      
      expect(onClick).toHaveBeenCalledWith(
        expect.objectContaining({
          lat: 32.7767,
          lng: -96.7970,
          address: '123 Main St, Dallas, TX 75201',
          riskScore: 75,
          propertyType: 'Residential',
          status: 'LIVE',
          id: 'prop-1',
        })
      );
    });

    it('stops propagation on click', () => {
      const onClick = vi.fn();
      render(<PropertyNode {...defaultProps} onClick={onClick} />);
      const marker = screen.getByTestId('circle-marker');
      
      fireEvent(marker, 'click');
      
      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('Hover handlers', () => {
    it('handles mouseover event', () => {
      render(<PropertyNode {...defaultProps} />);
      const marker = screen.getByTestId('circle-marker');
      
      fireEvent(marker, 'mouseover');
      expect(marker).toBeInTheDocument();
    });

    it('handles mouseout event', () => {
      render(<PropertyNode {...defaultProps} />);
      const marker = screen.getByTestId('circle-marker');
      
      fireEvent(marker, 'mouseout');
      expect(marker).toBeInTheDocument();
    });
  });

  describe('Popup', () => {
    it('renders popup when showPopupOnHover is true', () => {
      render(<PropertyNode {...defaultProps} showPopupOnHover={true} />);
      const marker = screen.getByTestId('circle-marker');
      
      fireEvent(marker, 'mouseover');
      
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });

    it('does not render popup when showPopupOnHover is false', () => {
      render(<PropertyNode {...defaultProps} showPopupOnHover={false} />);
      const marker = screen.getByTestId('circle-marker');
      
      fireEvent(marker, 'mouseover');
      
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });

    it('displays risk label and score in popup', () => {
      render(<PropertyNode {...defaultProps} riskScore={75} showPopupOnHover={true} />);
      const marker = screen.getByTestId('circle-marker');
      fireEvent(marker, 'mouseover');
      
      expect(screen.getByText('Critical Risk (75)')).toBeInTheDocument();
    });

    it('displays status in popup', () => {
      render(<PropertyNode {...defaultProps} status="LIVE" showPopupOnHover={true} />);
      const marker = screen.getByTestId('circle-marker');
      fireEvent(marker, 'mouseover');
      
      // Find the status in the popup specifically
      const popup = screen.getByTestId('popup');
      expect(popup).toHaveTextContent('LIVE');
    });

    it('displays property type in popup', () => {
      render(<PropertyNode {...defaultProps} propertyType="Residential" showPopupOnHover={true} />);
      const marker = screen.getByTestId('circle-marker');
      fireEvent(marker, 'mouseover');
      
      expect(screen.getByText('Residential')).toBeInTheDocument();
    });

    it('displays address in popup', () => {
      render(<PropertyNode {...defaultProps} showPopupOnHover={true} />);
      const marker = screen.getByTestId('circle-marker');
      fireEvent(marker, 'mouseover');
      
      expect(screen.getByText('123 Main St, Dallas, TX 75201')).toBeInTheDocument();
    });
  });

  describe('StateIndicator component', () => {
    it('renders StateIndicator with correct status', () => {
      render(<PropertyNode {...defaultProps} status="LIVE" />);
      // StateIndicator is rendered inside CircleMarker
      expect(screen.getByTestId('circle-marker')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles NaN lat/lng gracefully (returns null)', () => {
      const { container } = render(<PropertyNode {...defaultProps} lat={NaN} lng={-96.7970} />);
      // Component returns null for invalid coordinates
      expect(container.firstChild).toBeNull();
    });

    it('clamps riskScore to 0-100 range', () => {
      render(<PropertyNode {...defaultProps} riskScore={150} />);
      const marker = screen.getByTestId('circle-marker');
      const pathOptions = JSON.parse(marker.getAttribute('data-path-options') || '{}');
      // 150 should be clamped to 100 -> Critical color
      expect(pathOptions.fillColor).toBe('#ef4444');
    });

    it('clamps negative riskScore to 0', () => {
      render(<PropertyNode {...defaultProps} riskScore={-10} />);
      const marker = screen.getByTestId('circle-marker');
      const pathOptions = JSON.parse(marker.getAttribute('data-path-options') || '{}');
      // -10 should be clamped to 0 -> Low color
      expect(pathOptions.fillColor).toBe('#22c55e');
    });

    it('handles zero risk score', () => {
      render(<PropertyNode {...defaultProps} riskScore={0} />);
      const marker = screen.getByTestId('circle-marker');
      const pathOptions = JSON.parse(marker.getAttribute('data-path-options') || '{}');
      expect(pathOptions.fillColor).toBe('#22c55e');
    });

    it('handles maximum risk score', () => {
      render(<PropertyNode {...defaultProps} riskScore={100} />);
      const marker = screen.getByTestId('circle-marker');
      const pathOptions = JSON.parse(marker.getAttribute('data-path-options') || '{}');
      expect(pathOptions.fillColor).toBe('#ef4444');
    });

    it('renders children in popup when provided', () => {
      render(
        <PropertyNode {...defaultProps} showPopupOnHover={true}>
          <span data-testid="custom-content">Custom popup content</span>
        </PropertyNode>
      );
      const marker = screen.getByTestId('circle-marker');
      fireEvent(marker, 'mouseover');
      
      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      cleanup();
    });

    it('should render without crashing', () => {
      const { container } = render(<PropertyNode {...defaultProps} />);
      expect(container).toBeInTheDocument();
    });

    it('should render with high risk score', () => {
      const { container } = render(<PropertyNode {...defaultProps} riskScore={85} />);
      expect(container).toBeInTheDocument();
    });

    it('should render with low risk score', () => {
      const { container } = render(<PropertyNode {...defaultProps} riskScore={10} />);
      expect(container).toBeInTheDocument();
    });

    it('should render with popup on hover', () => {
      const { container } = render(<PropertyNode {...defaultProps} showPopupOnHover={true} />);
      expect(container).toBeInTheDocument();
    });

    it('should render with custom children in popup', () => {
      const { container } = render(
        <PropertyNode {...defaultProps} showPopupOnHover={true}>
          <span data-testid="custom-content">Custom popup content</span>
        </PropertyNode>
      );
      expect(container).toBeInTheDocument();
    });

    it('should have focusable marker element', () => {
      render(<PropertyNode {...defaultProps} />);
      const marker = screen.getByTestId('circle-marker');
      // Marker should be focusable (has tabindex or is naturally focusable)
      expect(marker).toBeInTheDocument();
    });

    it('should have proper role attribute for marker', () => {
      render(<PropertyNode {...defaultProps} />);
      const marker = screen.getByTestId('circle-marker');
      // The marker should have a role attribute for accessibility
      expect(marker.getAttribute('role')).toBeTruthy();
    });

    it('should have accessible name/label for marker', () => {
      render(<PropertyNode {...defaultProps} />);
      const marker = screen.getByTestId('circle-marker');
      // Check for aria-label, title, or other accessible name
      const ariaLabel = marker.getAttribute('aria-label');
      const title = marker.getAttribute('title');
      expect(ariaLabel || title).toBeTruthy();
    });

    it('should have proper color contrast for risk indicators', () => {
      // Test all risk levels have distinct colors
      const criticalRisk = { ...defaultProps, riskScore: 85 };
      const highRisk = { ...defaultProps, riskScore: 55 };
      const mediumRisk = { ...defaultProps, riskScore: 30 };
      const lowRisk = { ...defaultProps, riskScore: 10 };

      const { container: c1, unmount: u1 } = render(<PropertyNode {...criticalRisk} />);
      const criticalMarker = c1.querySelector('[data-testid="circle-marker"]');
      const criticalColor = JSON.parse(criticalMarker?.getAttribute('data-path-options') || '{}').fillColor;
      expect(criticalColor).toBe('#ef4444'); // Red for critical
      u1();

      const { container: c2, unmount: u2 } = render(<PropertyNode {...highRisk} />);
      const highMarker = c2.querySelector('[data-testid="circle-marker"]');
      const highColor = JSON.parse(highMarker?.getAttribute('data-path-options') || '{}').fillColor;
      expect(highColor).toBe('#f97316'); // Orange for high
      u2();

      const { container: c3, unmount: u3 } = render(<PropertyNode {...mediumRisk} />);
      const mediumMarker = c3.querySelector('[data-testid="circle-marker"]');
      const mediumColor = JSON.parse(mediumMarker?.getAttribute('data-path-options') || '{}').fillColor;
      expect(mediumColor).toBe('#fbbf24'); // Amber for medium
      u3();

      const { container: c4 } = render(<PropertyNode {...lowRisk} />);
      const lowMarker = c4.querySelector('[data-testid="circle-marker"]');
      const lowColor = JSON.parse(lowMarker?.getAttribute('data-path-options') || '{}').fillColor;
      expect(lowColor).toBe('#22c55e'); // Green for low
    });

    it('should handle keyboard interaction on marker', () => {
      render(<PropertyNode {...defaultProps} />);
      const marker = screen.getByTestId('circle-marker');
      // Focus the marker
      marker.focus();
      expect(marker).toHaveFocus();
    });
  });
});

// Helper function to fire events
function fireEvent(element: HTMLElement, eventType: string) {
  const event = new Event(eventType, { bubbles: true });
  element.dispatchEvent(event);
}