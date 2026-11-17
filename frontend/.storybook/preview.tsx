import type { Preview } from '@storybook/react-vite'
import React from 'react'
import { IntelligenceLayerProvider } from '@/components/intelligence/IntelligenceLayerProvider'
import { BrowserRouter } from 'react-router-dom'

// Mock fetch for Storybook visual regression tests
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    // Mock /intelligence/dashboard
    if (typeof input === 'string' && input.includes('/intelligence/dashboard')) {
      return Promise.resolve(new Response(JSON.stringify({
        findings: [/* ... 3 storm findings ... */],
        totalProperties: 1247, highRiskProperties: 47,
        systemStatus: 'LIVE', lastUpdated: '2024-10-15T16:05:00Z',
        weatherAlerts: 3, activeStorms: 2,
        mapCenter: [35.2137, -86.5873], zoomLevel: 7
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    }
    // Mock /maps/storm-markers
    if (typeof input === 'string' && input.includes('/maps/storm-markers')) {
      return Promise.resolve(new Response(JSON.stringify([
        { id: 'marker-1', lat: 35.2137, lng: -86.5873, type: 'storm', severity: 'severe', radius: 15.5 },
        { id: 'marker-2', lat: 39.7392, lng: -87.6298, type: 'storm', severity: 'moderate', radius: 8.2 },
        { id: 'marker-3', lat: 31.7683, lng: -89.6452, type: 'alert', severity: 'mild', radius: 12.8 }
      ]), { status: 200, headers: { 'content-type': 'application/json' } }));
    }
    // Mock /maps/alerts-geojson
    if (typeof input === 'string' && input.includes('/maps/alerts-geojson')) {
      return Promise.resolve(new Response(JSON.stringify({
        type: 'FeatureCollection', features: [{
          type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[35.2137, -86.5873], [35.5, -86.0], [34.8, -87.0], [35.2137, -86.5873]]] },
          properties: { id: 'alert-1', type: 'severe_hail', confidence: 94.7, severity: 'severe', affectedProperties: 247, timestamp: '2024-10-15T14:32:00Z' }
        }]
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    }
    // Mock /maps/storm-trajectories
    if (typeof input === 'string' && input.includes('/maps/storm-trajectories')) {
      return Promise.resolve(new Response(JSON.stringify([{
        id: 'trajectory-1', points: [[35.2137, -86.5873], [36.1, -87.0], [37.2, -88.0]],
        type: 'hail', speed: '45km/h', direction: 'NNE', probability: 0.87,
        startTime: '2024-10-15T14:32:00Z', endTime: '2024-10-15T18:45:00Z'
      }]), { status: 200, headers: { 'content-type': 'application/json' } }));
    }
    // Mock /maps/property-intelligence
    if (typeof input === 'string' && input.includes('/maps/property-intelligence')) {
      return Promise.resolve(new Response(JSON.stringify([{
        id: 'property-1', lat: 35.2137, lng: -86.5873, type: 'insured', value: 485000, roofType: 'shingle',
        stormRisk: 'high', riskScore: 94, propertyClass: 'premium', lastInspection: '2024-09-15',
        coverage: { wind: 'standard', hail: 'limited', flood: 'excluded' },
        vulnerability: { wind: 8, hail: 9, flood: 3 }
      }, {
        id: 'property-2', lat: 39.7392, lng: -87.6298, type: 'uninsured', value: 275000, roofType: 'metal',
        stormRisk: 'moderate', riskScore: 71, propertyClass: 'standard', lastInspection: '2024-08-20',
        coverage: { wind: 'comprehensive', hail: 'standard', flood: 'limited' },
        vulnerability: { wind: 6, hail: 7, flood: 2 }
      }]), { status: 200, headers: { 'content-type': 'application/json' } }));
    }
    return originalFetch(input, init);
  };
}

// Mock XMLHttpRequest for axios calls in Storybook visual regression tests
if (typeof window !== 'undefined') {
  const originalXHROpen = window.XMLHttpRequest.prototype.open;
  const originalXHRSend = window.XMLHttpRequest.prototype.send;
  
  window.XMLHttpRequest.prototype.open = function(method, url) {
    this._mockUrl = url;
    return originalXHROpen.apply(this, arguments);
  };
  
  window.XMLHttpRequest.prototype.send = function(body) {
    const url = this._mockUrl || '';
    
    // Mock /intelligence/dashboard
    if (url.includes('/intelligence/dashboard')) {
      setTimeout(() => {
        this.readyState = 4;
        this.status = 200;
        this.responseText = JSON.stringify({
          findings: [{id:'f1',type:'storm',severity:'severe',confidence:94.7,affectedProperties:247,geometry:{type:'Polygon',coordinates:[[[35.2137,-86.5873],[35.5,-86.0],[34.8,-87.0],[35.2137,-86.5873]]]},properties:{name:'Thunderstorm Alpha',description:'Severe hail storm',startTime:'2024-10-15T14:32:00Z',endTime:'2024-10-15T18:45:00Z'}}],
          totalProperties: 1247, highRiskProperties: 47,
          systemStatus: 'LIVE', lastUpdated: '2024-10-15T16:05:00Z',
          weatherAlerts: 3, activeStorms: 2,
          mapCenter: [35.2137, -86.5873], zoomLevel: 7
        });
        this.dispatchEvent(new Event('load'));
        this.onload?.(new Event('load'));
      }, 0);
      return;
    }
    
    // Mock /maps/storm-markers
    if (url.includes('/maps/storm-markers')) {
      setTimeout(() => {
        this.readyState = 4;
        this.status = 200;
        this.responseText = JSON.stringify([
          { id: 'marker-1', lat: 35.2137, lng: -86.5873, type: 'storm', severity: 'severe', radius: 15.5 },
          { id: 'marker-2', lat: 39.7392, lng: -87.6298, type: 'storm', severity: 'moderate', radius: 8.2 },
          { id: 'marker-3', lat: 31.7683, lng: -89.6452, type: 'alert', severity: 'mild', radius: 12.8 }
        ]);
        this.dispatchEvent(new Event('load'));
        this.onload?.(new Event('load'));
      }, 0);
      return;
    }
    
    // Mock /maps/alerts-geojson
    if (url.includes('/maps/alerts-geojson')) {
      setTimeout(() => {
        this.readyState = 4;
        this.status = 200;
        this.responseText = JSON.stringify({
          type: 'FeatureCollection', features: [{
            type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[35.2137,-86.5873],[35.5,-86.0],[34.8,-87.0],[35.2137,-86.5873]]] },
            properties: { id: 'alert-1', type: 'severe_hail', confidence: 94.7, severity: 'severe', affectedProperties: 247, timestamp: '2024-10-15T14:32:00Z' }
          }]
        });
        this.dispatchEvent(new Event('load'));
        this.onload?.(new Event('load'));
      }, 0);
      return;
    }
    
    // Mock /maps/storm-trajectories
    if (url.includes('/maps/storm-trajectories')) {
      setTimeout(() => {
        this.readyState = 4;
        this.status = 200;
        this.responseText = JSON.stringify([{
          id: 'trajectory-1', points: [[35.2137,-86.5873],[36.1,-87.0],[37.2,-88.0]],
          type: 'hail', speed: '45km/h', direction: 'NNE', probability: 0.87,
          startTime: '2024-10-15T14:32:00Z', endTime: '2024-10-15T18:45:00Z'
        }]);
        this.dispatchEvent(new Event('load'));
        this.onload?.(new Event('load'));
      }, 0);
      return;
    }
    
    // Mock /maps/property-intelligence
    if (url.includes('/maps/property-intelligence')) {
      setTimeout(() => {
        this.readyState = 4;
        this.status = 200;
        this.responseText = JSON.stringify([{
          id: 'property-1', lat: 35.2137, lng: -86.5873, type: 'insured', value: 485000, roofType: 'shingle',
          stormRisk: 'high', riskScore: 94, propertyClass: 'premium', lastInspection: '2024-09-15',
          coverage: { wind: 'standard', hail: 'limited', flood: 'excluded' },
          vulnerability: { wind: 8, hail: 9, flood: 3 }
        }, {
          id: 'property-2', lat: 39.7392, lng: -87.6298, type: 'uninsured', value: 275000, roofType: 'metal',
          stormRisk: 'moderate', riskScore: 71, propertyClass: 'standard', lastInspection: '2024-08-20',
          coverage: { wind: 'comprehensive', hail: 'standard', flood: 'limited' },
          vulnerability: { wind: 6, hail: 7, flood: 2 }
        }]);
        this.dispatchEvent(new Event('load'));
        this.onload?.(new Event('load'));
      }, 0);
      return;
    }
    
    return originalXHRSend.apply(this, arguments);
  };
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
          {
            id: 'keyboard',
            enabled: true,
          },
          {
            id: 'label',
            enabled: true,
          },
          {
            id: 'landmark-one-main',
            enabled: true,
          },
          {
            id: 'region',
            enabled: true,
          },
        ],
      },
    },
  },
  decorators: [
    (Story) => {
      if (typeof window !== 'undefined') {
        performance.mark?.('storybook-render-start')
      }
      return (
        <IntelligenceLayerProvider>
          <BrowserRouter>
            <Story />
          </BrowserRouter>
        </IntelligenceLayerProvider>
      )
    },
  ],
}

export default preview