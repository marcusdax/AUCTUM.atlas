import type { Meta, StoryObj } from '@storybook/react';

import { within, userEvent, expect } from '@storybook/test';

import { Button } from '@/components/ui/Button';

const meta = {
  title: 'AtlasHelios/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Button',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Button',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Button',
  },
};

export const Accessible: Story = {
  args: {
    variant: 'primary',
    children: 'Submit',
  },
};

export const Interaction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /Submit/i });
    await expect(button).toBeInTheDocument();
    await userEvent.click(button);
  },
};