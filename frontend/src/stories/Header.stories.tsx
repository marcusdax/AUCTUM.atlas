import type { Meta, StoryObj } from '@storybook/react';

import { within, userEvent, expect } from '@storybook/test';

import Layout from '@/components/Layout';

const meta = {
  title: 'AtlasHelios/Layout',
  component: Layout,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Layout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const Interaction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggleButton = canvas.getByRole('button', { name: /Toggle menu/i });
    await expect(toggleButton).toBeInTheDocument();
    await userEvent.click(toggleButton);
  },
};