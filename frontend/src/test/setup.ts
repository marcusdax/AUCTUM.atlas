import * as matchers from '@testing-library/jest-dom/matchers';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import { vi, beforeAll, afterAll, expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

// Extend Vitest Matchers<R, T> cleanly for Vitest 5 without Assertion<T> arity collision
declare module 'vitest' {
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<any, R> {
    toHaveNoViolations(): R;
  }
}

expect.extend(matchers as unknown as Parameters<typeof expect.extend>[0]);
expect.extend(toHaveNoViolations);

// Mock matchMedia for components that use it
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// Mock ResizeObserver
vi.stubGlobal('ResizeObserver', vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})));

// Mock fetch for Storybook visual regression tests
vi.stubGlobal('fetch', (input: RequestInfo, init?: RequestInit) => {
  if (typeof input === 'string') {
    // Mock /intelligence/dashboard
    if (input.includes('/intelligence/dashboard')) {
      return Promise.resolve(new Response(JSON.stringify({
        findings: [
          {
            id: 'storm-2024-10-15-001',
            type: 'severe_hail',
            confidence: 94.7,
            description: 'Large hail event detected in central region',
            timestamp: '2024-10-15T14:32:00Z',
            affectedArea: {
              center: [35.2137, -86.5873],
              radius: 15.5
            }
          },
          {
            id: 'storm-2024-10-15-002',
            type: 'tornado_warning',
            confidence: 87.3,
            description: 'Tornado warning issued for eastern counties',
            timestamp: '2024-10-15T15:18:00Z',
            affectedArea: {
              center: [39.7392, -87.6298],
              radius: 8.2
            }
          },
          {
            id: 'storm-2024-10-15-003',
            type: 'flash_flood',
            confidence: 78.9,
            description: 'Flash flood advisory for southern counties',
            timestamp: '2024-10-15T16:05:00Z',
            affectedArea: {
              center: [31.7683, -89.6452],
              radius: 12.8
            }
          }
        ],
        totalProperties: 1247,
        highRiskProperties: 47,
        systemStatus: 'LIVE',
        lastUpdated: '2024-10-15T16:05:00Z',
        weatherAlerts: 3,
        activeStorms: 2,
        mapCenter: [35.2137, -86.5873],
        zoomLevel: 7
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));
    }
    
    // Mock /maps/storm-markers
    if (input.includes('/maps/storm-markers')) {
      return Promise.resolve(new Response(JSON.stringify([
        { id: 'marker-1', lat: 35.2137, lng: -86.5873, type: 'storm', severity: 'severe', radius: 15.5 },
        { id: 'marker-2', lat: 39.7392, lng: -87.6298, type: 'storm', severity: 'moderate', radius: 8.2 },
        { id: 'marker-3', lat: 31.7683, lng: -89.6452, type: 'alert', severity: 'mild', radius: 12.8 }
      ]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));
    }
    
    // Mock /maps/alerts-geojson
    if (input.includes('/maps/alerts-geojson')) {
      return Promise.resolve(new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[[35.2137, -86.5873], [35.5, -86.0], [34.8, -87.0], [35.2137, -86.5873]]]
            },
            properties: {
              id: 'alert-1',
              type: 'severe_hail',
              confidence: 94.7,
              severity: 'severe',
              affectedProperties: 247,
              timestamp: '2024-10-15T14:32:00Z'
            }
          }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));
    }
    
    // Mock /maps/storm-trajectories
    if (input.includes('/maps/storm-trajectories')) {
      return Promise.resolve(new Response(JSON.stringify([
        {
          id: 'trajectory-1',
          points: [[35.2137, -86.5873], [36.1, -87.0], [37.2, -88.0]],
          type: 'hail',
          speed: '45km/h',
          direction: 'NNE',
          probability: 0.87,
          startTime: '2024-10-15T14:32:00Z',
          endTime: '2024-10-15T18:45:00Z'
        }
      ]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));
    }
    
    // Mock /maps/property-intelligence
    if (input.includes('/maps/property-intelligence')) {
      return Promise.resolve(new Response(JSON.stringify([
        {
          id: 'property-1',
          lat: 35.2137,
          lng: -86.5873,
          type: 'insured',
          value: 485000,
          roofType: 'shingle',
          stormRisk: 'high',
          riskScore: 94,
          propertyClass: 'premium',
          lastInspection: '2024-09-15',
          coverage: {
            wind: 'standard',
            hail: 'limited',
            flood: 'excluded'
          },
          vulnerability: {
            wind: 8,
            hail: 9,
            flood: 3
          }
        },
        {
          id: 'property-2',
          lat: 39.7392,
          lng: -87.6298,
          type: 'uninsured',
          value: 275000,
          roofType: 'metal',
          stormRisk: 'moderate',
          riskScore: 71,
          propertyClass: 'standard',
          lastInspection: '2024-08-20',
          coverage: {
            wind: 'comprehensive',
            hail: 'standard',
            flood: 'limited'
          },
          vulnerability: {
            wind: 6,
            hail: 7,
            flood: 2
          }
        }
      ]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));
    }
  }
  
  // Call the original fetch for other requests
  return fetch(input, init);
});

// Mock window.scrollTo
vi.stubGlobal('scrollTo', vi.fn());

// Suppress console.error for known warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
       args[0].includes('act(...)') ||
       args[0].includes('useLayoutEffect'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});