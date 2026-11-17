import type { Meta, StoryObj } from '@storybook/react';

import { within, userEvent, expect } from '@storybook/test';

import { MapContainer, TileLayer } from 'react-leaflet';

import PropertyNode, { PropertyNodeProps } from '@/components/intelligence/PropertyNode';

const meta = {
  title: 'AtlasHelios/PropertyNode',
  component: PropertyNode,
} satisfies Meta<typeof PropertyNode>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper for all property node stories that need a map container
const MapWrapper = ({ children }: { children: React.ReactNode }) => (
  <MapContainer center={[30.2672, -97.7431]} zoom={10} style={{ height: '400px', width: '100%' }}>
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    />
    {children}
  </MapContainer>
);

export const LowRisk: Story = {
  render: (args) => (
    <MapWrapper>
      <PropertyNode {...args} />
    </MapWrapper>
  ),
  args: {
    lat: 30.2672,
    lng: -97.7431,
    address: '1247 Oak Ridge Dr, Austin, TX 78704',
    riskScore: 15,
    status: 'NEW',
    propertyType: 'property',
    id: 'prop-low-1',
    sourceId: 'src-low-1',
  },
};

export const ModerateRisk: Story = {
  name: 'Moderate Risk (20-39)',
  render: (args) => (
    <MapWrapper>
      <PropertyNode {...args} />
    </MapWrapper>
  ),
  args: {
    lat: 30.2700,
    lng: -97.7500,
    address: '3856 Maple Ave, Dallas, TX 75201',
    riskScore: 35,
    status: 'INSPECTION_SCHEDULED',
    propertyType: 'lead',
    id: 'prop-mod-1',
    sourceId: 'src-mod-1',
  },
};

export const HighRisk: Story = {
  name: 'High Risk (40-69)',
  render: (args) => (
    <MapWrapper>
      <PropertyNode {...args} />
    </MapWrapper>
  ),
  args: {
    lat: 30.2500,
    lng: -97.7300,
    address: '789 Pine St, San Antonio, TX 78209',
    riskScore: 65,
    status: 'ESTIMATE_SENT',
    propertyType: 'lead',
    id: 'prop-high-1',
    sourceId: 'src-high-1',
  },
};

export const CriticalRisk: Story = {
  name: 'Critical Risk (70+)',
  render: (args) => (
    <MapWrapper>
      <PropertyNode {...args} />
    </MapWrapper>
  ),
  args: {
    lat: 32.7767,
    lng: -96.7970,
    address: '999 High Risk Blvd, Danger Zone, TX 79999',
    riskScore: 94,
    status: 'ACTIVE',
    propertyType: 'job',
    id: 'prop-crit-1',
    sourceId: 'src-crit-1',
    stormName: 'Hurricane Helios',
  },
};

export const WithMetadata: Story = {
  name: 'With Metadata',
  render: (args) => (
    <MapWrapper>
      <PropertyNode {...args} />
    </MapWrapper>
  ),
  args: {
    lat: 29.4241,
    lng: -98.4936,
    address: '456 Elm Rd, Houston, TX 77002',
    riskScore: 78,
    status: 'ACTIVE',
    propertyType: 'job',
    id: 'prop-meta-1',
    sourceId: 'src-meta-1',
    stormName: 'Storm Surge',
    metadata: {
      roof_type: 'asphalt shingle',
      year_built: 2005,
      sq_footage: 2400,
      stories: 2,
      bedrooms: 4,
      bathrooms: 3,
    },
  },
};

export const IsSelected: Story = {
  name: 'Selected Node',
  render: (args) => (
    <MapWrapper>
      <PropertyNode {...args} />
    </MapWrapper>
  ),
  args: {
    lat: 30.2672,
    lng: -97.7431,
    address: '1247 Oak Ridge Dr, Austin, TX 78704',
    riskScore: 94,
    status: 'ACTIVE',
    propertyType: 'property',
    id: 'prop-selected-1',
    sourceId: 'src-selected-1',
    isSelected: true,
  },
};

export const WithClickHandler: Story = {
  name: 'With Click Handler',
  render: (args) => (
    <MapWrapper>
      <PropertyNode {...args} />
    </MapWrapper>
  ),
  args: {
    lat: 30.2672,
    lng: -97.7431,
    address: '1247 Oak Ridge Dr, Austin, TX 78704',
    riskScore: 87,
    status: 'ACTIVE',
    propertyType: 'job',
    id: 'prop-click-1',
    sourceId: 'src-click-1',
    stormName: 'Thunderstorm Alpha',
    onClick: (property: PropertyNodeProps) => {
      console.log('Property clicked:', property);
    },
  },
};

export const Accessible: Story = {
  render: (args) => (
    <MapWrapper>
      <PropertyNode {...args} />
    </MapWrapper>
  ),
  args: {
    lat: 30.2672,
    lng: -97.7431,
    address: '1247 Oak Ridge Dr, Austin, TX 78704',
    riskScore: 15,
    status: 'NEW',
    propertyType: 'property',
    id: 'prop-a11y-1',
    sourceId: 'src-a11y-1',
  },
};

export const Interaction: Story = {
  render: (args) => (
    <MapWrapper>
      <PropertyNode {...args} />
    </MapWrapper>
  ),
  args: {
    lat: 30.2672,
    lng: -97.7431,
    address: '1247 Oak Ridge Dr, Austin, TX 78704',
    riskScore: 94,
    status: 'ACTIVE',
    propertyType: 'property',
    id: 'prop-interaction-1',
    sourceId: 'src-interaction-1',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const marker = canvasElement.querySelector('.leaflet-marker-icon');
    await expect(marker).toBeInTheDocument();
    await expect(marker).toHaveClass('high-risk');
    let popup = canvasElement.querySelector('.property-node-popup');
    await expect(popup).toBeNull();
    await userEvent.click(marker as Element);
    popup = canvasElement.querySelector('.property-node-popup');
    await expect(popup).toBeInTheDocument();
    const address = canvas.getByText(/1247 Oak Ridge Dr/i);
    await expect(address).toBeInTheDocument();
    const riskBadge = canvas.getByText(/CRITICAL \(94\)/);
    await expect(riskBadge).toBeInTheDocument();
  },
};

export const AccessibilityInteraction: Story = {
  name: 'Accessibility Interaction Test',
  render: (args) => (
    <MapWrapper>
      <PropertyNode {...args} />
    </MapWrapper>
  ),
  args: {
    lat: 30.2672,
    lng: -97.7431,
    address: '1247 Oak Ridge Dr, Austin, TX 78704',
    riskScore: 15,
    status: 'NEW',
    propertyType: 'property',
    id: 'prop-a11y-interaction-1',
    sourceId: 'src-a11y-interaction-1',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Test focusability - marker should be focusable
    const marker = canvasElement.querySelector('[data-testid="circle-marker"]') as HTMLElement;
    await expect(marker).toBeInTheDocument();
    // Test that marker has proper role and is focusable
    expect(marker.getAttribute('role')).toBeTruthy();
    // Test alt text / aria-label for marker
    const markerLabel = marker.getAttribute('aria-label') || marker.getAttribute('title');
    expect(markerLabel).toBeTruthy();
    // Test keyboard navigation
    marker.focus();
    await expect(marker).toHaveFocus();
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'keyboard', enabled: true },
          { id: 'label', enabled: true },
        ],
      },
    },
  },
};