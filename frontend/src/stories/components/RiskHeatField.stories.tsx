import type { Meta, StoryObj } from '@storybook/react';

import { within, userEvent, expect } from '@storybook/test';

import { MapContainer, TileLayer } from 'react-leaflet';

import { RiskHeatField, type PropertyDataPoint } from '@/components/StormMap/RiskHeatField';

const meta = {
  title: 'AtlasHelios/RiskHeatField',
  component: RiskHeatField,
} satisfies Meta<typeof RiskHeatField>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper for all risk heat field stories that need a map container
const MapWrapper = ({ children }: { children: React.ReactNode }) => (
  <MapContainer center={[30.2672, -97.7431]} zoom={10} style={{ height: '400px', width: '100%' }}>
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    />
    {children}
  </MapContainer>
);

// Sample property data for Austin area
const samplePropertyData: PropertyDataPoint[] = [
  { lat: 30.2672, lng: -97.7431, riskScore: 94, id: 'prop-1' },
  { lat: 30.2700, lng: -97.7500, riskScore: 65, id: 'prop-2' },
  { lat: 30.2500, lng: -97.7300, riskScore: 78, id: 'prop-3' },
  { lat: 30.2800, lng: -97.7200, riskScore: 45, id: 'prop-4' },
  { lat: 30.2600, lng: -97.7600, riskScore: 32, id: 'prop-5' },
  { lat: 30.2900, lng: -97.7100, riskScore: 88, id: 'prop-6' },
  { lat: 30.2400, lng: -97.7700, riskScore: 55, id: 'prop-7' },
  { lat: 30.3000, lng: -97.6900, riskScore: 91, id: 'prop-8' },
];

export const Default: Story = {
  render: (args) => (
    <MapWrapper>
      <RiskHeatField {...args} />
    </MapWrapper>
  ),
  args: {
    propertyData: samplePropertyData,
  },
};

export const HighRiskOnly: Story = {
  render: (args) => (
    <MapWrapper>
      <RiskHeatField {...args} />
    </MapWrapper>
  ),
  args: {
    propertyData: samplePropertyData,
    minRiskScore: 70,
    maxOpacity: 0.8,
    blur: 10,
  },
};

export const LowIntensity: Story = {
  render: (args) => (
    <MapWrapper>
      <RiskHeatField {...args} />
    </MapWrapper>
  ),
  args: {
    propertyData: samplePropertyData,
    minRiskScore: 0,
    maxOpacity: 0.3,
    blur: 25,
    radius: 15,
  },
};

export const CustomGradient: Story = {
  render: (args) => (
    <MapWrapper>
      <RiskHeatField {...args} />
    </MapWrapper>
  ),
  args: {
    propertyData: samplePropertyData,
    gradient: {
      0.0: 'rgba(0, 255, 255, 0)',
      0.3: 'rgba(0, 255, 255, 0.3)',
      0.6: 'rgba(255, 255, 0, 0.6)',
      1.0: 'rgba(255, 0, 0, 0.8)',
    },
  },
};

export const NoData: Story = {
  render: () => (
    <MapWrapper>
      <RiskHeatField propertyData={[]} />
    </MapWrapper>
  ),
  args: {
    propertyData: [],
  },
};

export const Accessible: Story = {
  render: (args) => (
    <MapWrapper>
      <RiskHeatField {...args} />
    </MapWrapper>
  ),
  args: {
    propertyData: samplePropertyData,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Test color contrast for heat field elements
    const heatElements = canvasElement.querySelectorAll('[data-testid="layer-group"]');
    expect(heatElements.length).toBeGreaterThan(0);
    // Test keyboard focus for map controls
    const mapContainer = canvasElement.querySelector('.leaflet-container');
    expect(mapContainer).toBeInTheDocument();
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'keyboard', enabled: true },
        ],
      },
    },
  },
};