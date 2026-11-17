import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import PieceSvg, { buildQrSvg } from './PieceSvg';
import { contrast, isLocalBase, KIND_ORDER, KIND_SPECS, layoutPiece, scanUrl, STARTERS, textOn, wrapText } from './templates';

const brand = { primary: '#17231D', accent: '#8C2F22' };
const content = { headline: 'Hail hit your street this week', body: 'Free inspection.', cta: 'Scan me', companyName: 'Lone Star Roofing', phone: '(469) 555-0100' };

describe('wrapText', () => {
  it('wraps on word boundaries within the width', () => {
    const { lines, overflow } = wrapText('one two three four five six', 10 * 0.52 * 10, 10, 5);
    expect(overflow).toBe(false);
    expect(lines.every((l) => l.length <= 10)).toBe(true);
    expect(lines.join(' ')).toBe('one two three four five six');
  });

  it('flags overflow and ends the last line with an ellipsis', () => {
    const { lines, overflow } = wrapText('alpha beta gamma delta epsilon zeta eta theta', 10 * 0.52 * 10, 10, 2);
    expect(overflow).toBe(true);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });

  it('truncates a single word longer than the line', () => {
    const { lines } = wrapText('Supercalifragilistic', 5 * 0.52 * 10, 10, 1);
    expect(lines[0]).toHaveLength(5);
    expect(lines[0].endsWith('…')).toBe(true);
  });
});

describe('layoutPiece', () => {
  it('lays every kind out at true print size with the QR inside the page', () => {
    for (const kind of KIND_ORDER) {
      const spec = KIND_SPECS[kind];
      const l = layoutPiece(kind, { ...content, ...STARTERS[kind] }, brand);
      expect(l.width).toBe(spec.widthIn * 72);
      expect(l.height).toBe(spec.heightIn * 72);
      expect(l.qr.x - l.qr.plate).toBeGreaterThanOrEqual(0);
      expect(l.qr.y + l.qr.size + l.qr.plate).toBeLessThanOrEqual(l.height);
      expect(l.qr.x + l.qr.size + l.qr.plate).toBeLessThanOrEqual(l.width);
      // Starter copy always fits its own template.
      expect(l.overflow).toEqual([]);
    }
  });

  it('keeps every text slot inside the page width', () => {
    for (const kind of KIND_ORDER) {
      for (const slot of KIND_SPECS[kind].slots) expect(slot.x + slot.width).toBeLessThanOrEqual(KIND_SPECS[kind].widthIn + 1e-9);
    }
  });

  it('picks readable text colors and warns on weak brand contrast', () => {
    expect(textOn('#17231D')).toBe('#FFFFFF');
    expect(textOn('#F1F2EA')).toBe('#111111');
    const ok = layoutPiece('FLYER', content, brand);
    expect(ok.warnings).toEqual([]);
    const weak = layoutPiece('FLYER', content, { primary: '#797979', accent: '#8C2F22' });
    expect(contrast('#797979', textOn('#797979'))).toBeLessThan(4.5);
    expect(weak.warnings.some((w) => w.includes('main color'))).toBe(true);
  });

  it('moves the company name into the logo space when there is no logo', () => {
    const withLogo = layoutPiece('YARD_SIGN', content, brand, true).texts.find((t) => t.role === 'company')!;
    const noLogo = layoutPiece('YARD_SIGN', content, brand, false).texts.find((t) => t.role === 'company')!;
    expect(noLogo.x).toBe(KIND_SPECS.YARD_SIGN.logo!.x * 72);
    expect(noLogo.x).toBeLessThan(withLogo.x);
  });

  it('asks for a company phone when none is on file', () => {
    const l = layoutPiece('DOOR_HANGER', { ...content, phone: null }, brand);
    expect(l.texts.some((t) => t.role === 'phone')).toBe(false);
    expect(l.warnings.some((w) => w.includes('No company phone'))).toBe(true);
  });
});

describe('scan links', () => {
  it('builds the public scan URL and spots local-only bases', () => {
    expect(scanUrl('ABCDEFGH12', 'https://roofs.example.com/')).toBe('https://roofs.example.com/m/ABCDEFGH12');
    expect(isLocalBase('http://localhost:3000')).toBe(true);
    expect(isLocalBase('https://roofs.example.com')).toBe(false);
    expect(isLocalBase('not a url')).toBe(true);
  });
});

describe('PieceSvg', () => {
  it('renders a QR that encodes into the piece and the company text', async () => {
    const qr = await buildQrSvg('https://roofs.example.com/m/ABCDEFGH12');
    expect(qr.viewBox).toMatch(/^0 0 \d+ \d+$/);
    expect(qr.inner).toContain('<path');
    const { container } = render(<PieceSvg kind="DOOR_HANGER" content={content} colors={brand} qr={qr} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('4.25in');
    expect(svg.getAttribute('height')).toBe('11in');
    expect(container.textContent).toContain('Lone Star Roofing');
    expect(container.textContent).toContain('Call (469) 555-0100');
    expect(container.querySelectorAll('svg svg path').length).toBeGreaterThan(0);
  });
});
