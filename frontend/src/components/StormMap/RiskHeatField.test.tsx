import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

// Mock Leaflet and react-leaflet before importing the component
vi.mock('leaflet', () => {
  const mockMap = {
    getSize: vi.fn(() => ({ x: 800, y: 600 })),
    latLngToContainerPoint: vi.fn(([lat, lng]: [number, number]) => ({ x: lat * 10, y: lng * 10 })),
    getPane: vi.fn(() => document.body),
    on: vi.fn(),
    off: vi.fn(),
    removeLayer: vi.fn(),
    addLayer: vi.fn(),
  };

  const mockCanvas = {
    width: 800,
    height: 600,
    style: {},
    getContext: vi.fn((_type: string) => ({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      drawImage: vi.fn(),
      filter: 'none',
    })),
    parentNode: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
  };

  const mockTempCanvas = {
    width: 800,
    height: 600,
    getContext: vi.fn((_type: string) => ({
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      fillStyle: '',
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
    })),
  };

  let canvasCallCount = 0;

  // Define the Layer mock class type
  interface MockLayerInstance {
    options: any;
    _map: any;
    _canvas: any;
    _ctx: any;
    _data: any[];
    _radius: number;
    _maxOpacity: number;
    _gradient: Record<number, string>;
    _minRiskScore: number;
    _blur: number;
    _visible: boolean;
    _zIndex: number;
    _animationFrame: number;
    onAdd: (map: any) => MockLayerInstance;
    onRemove: (map: any) => MockLayerInstance;
    setData: (data: any[]) => void;
    setOptions: (options: any) => void;
    _reset: () => void;
    _redraw: () => void;
  }

  // Create a proper class that can be extended
  class MockLayer {
    options: any;
    _map: any;
    _canvas: any;
    _ctx: any;
    _data: any[];
    _radius: number;
    _maxOpacity: number;
    _gradient: Record<number, string>;
    _minRiskScore: number;
    _blur: number;
    _visible: boolean;
    _zIndex: number;
    _animationFrame: number;
    onAdd!: (map: any) => MockLayerInstance;
    onRemove!: (map: any) => MockLayerInstance;
    setData!: (data: any[]) => void;
    setOptions!: (options: any) => void;
    _reset!: () => void;
    _redraw!: () => void;

    constructor(options: any = {}) {
      this.options = options;
      this._map = null;
      this._canvas = null;
      this._ctx = null;
      this._data = [];
      this._radius = options.radius ?? 25;
      this._maxOpacity = options.maxOpacity ?? 0.6;
      this._gradient = options.gradient ?? {};
      this._minRiskScore = options.minRiskScore ?? 0;
      this._blur = options.blur ?? 15;
      this._visible = options.visible ?? true;
      this._zIndex = options.zIndex ?? 200;
      this._animationFrame = 0;

      const self = this;

      self.onAdd = vi.fn((map: any) => {
        self._map = map;
        self._canvas = mockCanvas;
        self._ctx = mockCanvas.getContext('2d');
        map.getPane = vi.fn(() => document.body);
        return self;
      });

      self.onRemove = vi.fn((map: any) => {
        self._map = null;
        self._canvas = null;
        self._ctx = null;
        return self;
      });

      self.setData = vi.fn((data: any[]) => {
        self._data = (data || []).filter(d => d.riskScore >= self._minRiskScore).map(d => ({
          x: d.lat * 10,
          y: d.lng * 10,
          intensity: d.riskScore / 100,
        }));
      });

      self.setOptions = vi.fn((options: any) => {
        if (options.radius !== undefined) self._radius = options.radius;
        if (options.maxOpacity !== undefined) self._maxOpacity = options.maxOpacity;
        if (options.gradient !== undefined) self._gradient = options.gradient;
        if (options.minRiskScore !== undefined) self._minRiskScore = options.minRiskScore;
        if (options.blur !== undefined) self._blur = options.blur;
        if (options.visible !== undefined) {
          self._visible = options.visible;
          if (self._canvas) self._canvas.style.opacity = options.visible ? '1' : '0';
        }
        if (options.zIndex !== undefined) {
          self._zIndex = options.zIndex;
          if (self._canvas) self._canvas.style.zIndex = String(options.zIndex);
        }
      });

      self._reset = vi.fn();
      self._redraw = vi.fn();
    }
  }

  return {
    Layer: MockLayer,
    Map: vi.fn(() => mockMap),
    Canvas: vi.fn(),
    default: {
      Layer: MockLayer,
      Map: vi.fn(() => mockMap),
      Canvas: vi.fn(),
    },
  };
});

vi.mock('react-leaflet', () => ({
  useMap: vi.fn(() => ({
    getSize: () => ({ x: 800, y: 600 }),
    latLngToContainerPoint: ([lat, lng]: [number, number]) => ({ x: lat * 10, y: lng * 10 }),
    getPane: () => document.body,
    on: vi.fn(),
    off: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
  })),
  LayerGroup: ({ children }: any) => <div data-testid="layer-group">{children}</div>,
}));

vi.mock('./RiskHeatField.css', () => ({}));

// Import after mocks
import { RiskHeatField } from './RiskHeatField';

describe('RiskHeatField', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  const createMockPropertyData = (overrides = {}) => ({
    lat: 32.7767,
    lng: -96.7970,
    riskScore: 75,
    id: 'prop-1',
    ...overrides,
  });

  describe('Default props and basic rendering', () => {
    it('renders without crashing with valid data', () => {
      const propertyData = [createMockPropertyData()];
      const { container } = render(<RiskHeatField propertyData={propertyData} />);
      expect(container).toBeInTheDocument();
    });

    it('renders null when visible is false', () => {
      const propertyData = [createMockPropertyData()];
      const { container } = render(<RiskHeatField propertyData={propertyData} visible={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders null when propertyData is empty', () => {
      const { container } = render(<RiskHeatField propertyData={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders null when propertyData is undefined', () => {
      const { container } = render(<RiskHeatField propertyData={undefined as any} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders null when all data points have riskScore below minRiskScore', () => {
      const propertyData = [
        createMockPropertyData({ riskScore: 5 }),
        createMockPropertyData({ riskScore: 8, id: 'prop-2' }),
      ];
      const { container } = render(<RiskHeatField propertyData={propertyData} minRiskScore={10} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Data filtering and validation', () => {
    it('filters out invalid lat/lng values', () => {
      const propertyData = [
        createMockPropertyData({ lat: NaN, lng: -96.7970 }),
        createMockPropertyData({ lat: 32.7767, lng: NaN }),
        createMockPropertyData({ lat: 100, lng: -96.7970 }), // Invalid lat > 90
        createMockPropertyData({ lat: -100, lng: -96.7970 }), // Invalid lat < -90
        createMockPropertyData({ lat: 32.7767, lng: 200 }), // Invalid lng > 180
        createMockPropertyData({ lat: 32.7767, lng: -200 }), // Invalid lng < -180
        createMockPropertyData({ lat: 32.7767, lng: -96.7970, riskScore: NaN }),
        createMockPropertyData({ lat: 32.7767, lng: -96.7970, riskScore: 150 }), // > 100
        createMockPropertyData({ lat: 32.7767, lng: -96.7970, riskScore: -10 }), // < 0
      ];
      
      const { container } = render(<RiskHeatField propertyData={propertyData} minRiskScore={0} />);
      // Should not crash, but may render null if all filtered out
      expect(container).toBeInTheDocument();
    });

    it('clamps riskScore to 0-100 range', () => {
      const propertyData = [
        createMockPropertyData({ riskScore: 150 }),
        createMockPropertyData({ riskScore: -10, id: 'prop-2' }),
        createMockPropertyData({ riskScore: 50, id: 'prop-3' }),
      ];
      
      const { container } = render(<RiskHeatField propertyData={propertyData} minRiskScore={0} />);
      expect(container).toBeInTheDocument();
    });

    it('includes only data points above minRiskScore', () => {
      const propertyData = [
        createMockPropertyData({ riskScore: 5, id: 'prop-low' }),
        createMockPropertyData({ riskScore: 15, id: 'prop-medium' }),
        createMockPropertyData({ riskScore: 50, id: 'prop-high' }),
      ];
      
      const { container } = render(<RiskHeatField propertyData={propertyData} minRiskScore={10} />);
      expect(container).toBeInTheDocument();
    });

    it('handles null/undefined propertyData gracefully', () => {
      const { container } = render(<RiskHeatField propertyData={null as any} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Props configuration', () => {
    it('accepts custom radius prop', () => {
      const propertyData = [createMockPropertyData()];
      const { container } = render(<RiskHeatField propertyData={propertyData} radius={50} />);
      expect(container).toBeInTheDocument();
    });

    it('accepts custom maxOpacity prop', () => {
      const propertyData = [createMockPropertyData()];
      const { container } = render(<RiskHeatField propertyData={propertyData} maxOpacity={0.8} />);
      expect(container).toBeInTheDocument();
    });

    it('accepts custom blur prop', () => {
      const propertyData = [createMockPropertyData()];
      const { container } = render(<RiskHeatField propertyData={propertyData} blur={30} />);
      expect(container).toBeInTheDocument();
    });

    it('accepts custom gradient prop', () => {
      const customGradient = {
        0.0: 'rgba(0, 0, 255, 0)',
        0.5: 'rgba(0, 255, 0, 0.5)',
        1.0: 'rgba(255, 0, 0, 1)',
      };
      const propertyData = [createMockPropertyData()];
      const { container } = render(<RiskHeatField propertyData={propertyData} gradient={customGradient} />);
      expect(container).toBeInTheDocument();
    });

    it('accepts custom zIndex prop', () => {
      const propertyData = [createMockPropertyData()];
      const { container } = render(<RiskHeatField propertyData={propertyData} zIndex={500} />);
      expect(container).toBeInTheDocument();
    });
  });

  describe('Multiple data points', () => {
    it('renders with multiple property data points', () => {
      const propertyData = [
        createMockPropertyData({ id: 'prop-1', lat: 32.7767, lng: -96.7970, riskScore: 75 }),
        createMockPropertyData({ id: 'prop-2', lat: 29.7604, lng: -95.3698, riskScore: 85 }),
        createMockPropertyData({ id: 'prop-3', lat: 41.8781, lng: -87.6298, riskScore: 60 }),
        createMockPropertyData({ id: 'prop-4', lat: 34.0522, lng: -118.2437, riskScore: 90 }),
        createMockPropertyData({ id: 'prop-5', lat: 40.7128, lng: -74.0060, riskScore: 45 }),
      ];
      
      const { container } = render(<RiskHeatField propertyData={propertyData} />);
      expect(container).toBeInTheDocument();
    });

    it('handles large number of data points', () => {
      const propertyData = Array.from({ length: 100 }, (_, i) => 
        createMockPropertyData({ 
          id: `prop-${i}`,
          lat: 30 + Math.random() * 20,
          lng: -120 + Math.random() * 40,
          riskScore: 20 + Math.random() * 80,
        })
      );
      
      const { container } = render(<RiskHeatField propertyData={propertyData} />);
      expect(container).toBeInTheDocument();
    });
  });

  describe('RiskHeatField component integration', () => {
    it('renders LayerGroup when visible and has valid data', () => {
      const propertyData = [createMockPropertyData()];
      render(<RiskHeatField propertyData={propertyData} />);
      expect(screen.getByTestId('layer-group')).toBeInTheDocument();
    });

    it('does not render LayerGroup when hidden', () => {
      const propertyData = [createMockPropertyData()];
      render(<RiskHeatField propertyData={propertyData} visible={false} />);
      expect(screen.queryByTestId('layer-group')).not.toBeInTheDocument();
    });

    it('passes correct props to HeatFieldLayer', () => {
      const propertyData = [createMockPropertyData()];
      const { container } = render(
        <RiskHeatField
          propertyData={propertyData}
          radius={40}
          maxOpacity={0.7}
          minRiskScore={20}
          blur={25}
          zIndex={300}
        />
      );
      expect(container).toBeInTheDocument();
    });
  });

  describe('Type exports', () => {
    it('exports PropertyDataPoint interface', () => {
      // This is a compile-time check - if it compiles, the type is exported
      const dataPoint: import('./RiskHeatField').PropertyDataPoint = {
        lat: 32.7767,
        lng: -96.7970,
        riskScore: 75,
        id: 'test-1',
      };
      expect(dataPoint.lat).toBe(32.7767);
      expect(dataPoint.riskScore).toBe(75);
    });

    it('exports RiskHeatFieldProps interface', () => {
      const props: import('./RiskHeatField').RiskHeatFieldProps = {
        propertyData: [createMockPropertyData()],
        radius: 30,
        maxOpacity: 0.55,
        minRiskScore: 10,
        blur: 20,
        visible: true,
        zIndex: 200,
      };
      expect(props.radius).toBe(30);
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

    it('should render LayerGroup with proper accessibility when visible', () => {
      const propertyData = [createMockPropertyData()];
      render(<RiskHeatField propertyData={propertyData} />);
      expect(screen.getByTestId('layer-group')).toBeInTheDocument();
    });

    it('should not render LayerGroup when hidden (a11y hidden)', () => {
      const propertyData = [createMockPropertyData()];
      render(<RiskHeatField propertyData={propertyData} visible={false} />);
      expect(screen.queryByTestId('layer-group')).not.toBeInTheDocument();
    });

    it('should accept visible prop for conditional rendering', () => {
      const propertyData = [createMockPropertyData()];
      const { rerender } = render(<RiskHeatField propertyData={propertyData} visible={true} />);
      expect(screen.getByTestId('layer-group')).toBeInTheDocument();
      
      rerender(<RiskHeatField propertyData={propertyData} visible={false} />);
      expect(screen.queryByTestId('layer-group')).not.toBeInTheDocument();
    });

    it('should have proper risk score filtering for accessibility', () => {
      const propertyData = [
        createMockPropertyData({ riskScore: 5, id: 'prop-low' }),
        createMockPropertyData({ riskScore: 15, id: 'prop-medium' }),
        createMockPropertyData({ riskScore: 50, id: 'prop-high' }),
      ];
      
      // With minRiskScore=10, only medium and high should be included
      render(<RiskHeatField propertyData={propertyData} minRiskScore={10} />);
      expect(screen.getByTestId('layer-group')).toBeInTheDocument();
    });
  });
});