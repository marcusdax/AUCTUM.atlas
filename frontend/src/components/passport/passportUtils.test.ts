import { describe, it, expect } from 'vitest';
import type { JobPhase, QcRun } from '../../types/passport';
import {
  PHASE_ORDER,
  addressDisplay,
  buildPublicUrl,
  clampScore,
  defaultQcPhase,
  estimatesSummary,
  formatCurrency,
  formatPercent,
  formatScore,
  isPassportAdmin,
  isPassportPublished,
  latestRunsByPhase,
  ledgerKindLabel,
  materialStatusLabel,
  phaseLabel,
  photoCountLabel,
  privacyDescription,
  privacyLabel,
  publicPathFor,
  qcCompleteness,
  qcStatusBadgeVariant,
  qcStatusLabel,
  shortDigest,
  templateForPhase,
  verifyBadgeVariant,
  verifyLabel,
} from './passportUtils';
import type { QcItem, QcTemplate } from '../../types/passport';

const item = (overrides: Partial<QcItem> = {}): QcItem => ({
  key: 'tear_off',
  label: 'Tear-off complete',
  required: true,
  requiresPhoto: true,
  passed: false,
  photoUrls: [],
  ...overrides,
});

const run = (overrides: Partial<QcRun> = {}): QcRun => ({
  id: 'run-1',
  jobId: 'job-1',
  phase: 'PRODUCTION',
  status: 'DRAFT',
  items: [],
  score: 0,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  ...overrides,
});

describe('phase + QC status helpers', () => {
  it('labels every phase and survives unknown values', () => {
    expect(PHASE_ORDER).toEqual([
      'INSPECTION',
      'ESTIMATE',
      'PRODUCTION',
      'INVOICING',
      'COMPLETED',
    ]);
    expect(phaseLabel('PRODUCTION')).toBe('Production');
    expect(phaseLabel('invoicing')).toBe('Invoicing');
    expect(phaseLabel('SOMETHING_ELSE')).toBe('SOMETHING ELSE');
    expect(phaseLabel(null)).toBe('Unknown phase');
  });

  it('maps QC status to label + badge (text always accompanies colour)', () => {
    expect(qcStatusLabel('PASSED')).toBe('Passed');
    expect(qcStatusLabel('FAILED')).toBe('Failed');
    expect(qcStatusLabel('DRAFT')).toBe('Draft');
    expect(qcStatusLabel('nope')).toBe('Unknown');
    expect(qcStatusBadgeVariant('PASSED')).toBe('success');
    expect(qcStatusBadgeVariant('FAILED')).toBe('danger');
    expect(qcStatusBadgeVariant('DRAFT')).toBe('default');
  });

  it('clamps and formats scores/percentages', () => {
    expect(clampScore(143)).toBe(100);
    expect(clampScore(-4)).toBe(0);
    expect(clampScore(Number.NaN)).toBe(0);
    expect(formatScore(86.4)).toBe('86 / 100');
    expect(formatPercent(82.6)).toBe('83%');
    expect(formatPercent(undefined)).toBe('0%');
  });
});

describe('latestRunsByPhase / templateForPhase', () => {
  it('keeps the newest run per phase', () => {
    const older = run({ id: 'a', phase: 'INSPECTION', createdAt: '2026-11-01T00:00:00Z' });
    const newer = run({ id: 'b', phase: 'INSPECTION', createdAt: '2026-11-05T00:00:00Z' });
    const production = run({ id: 'c', phase: 'PRODUCTION' });
    const byPhase = latestRunsByPhase([older, newer, production]);
    expect(byPhase.INSPECTION?.id).toBe('b');
    expect(byPhase.PRODUCTION?.id).toBe('c');
    expect(byPhase.COMPLETED).toBeUndefined();
    expect(latestRunsByPhase(null)).toEqual({});
  });

  it('finds the template for a phase', () => {
    const templates: QcTemplate[] = [
      { phase: 'PRODUCTION', label: 'Production', items: [] },
      { phase: 'COMPLETED', label: 'Completed', items: [] },
    ];
    expect(templateForPhase(templates, 'COMPLETED')?.label).toBe('Completed');
    expect(templateForPhase(templates, 'INSPECTION')).toBeUndefined();
    expect(templateForPhase(null, 'COMPLETED')).toBeUndefined();
  });
});

describe('qcCompleteness', () => {
  it('counts required items that pass WITH photo evidence', () => {
    const result = qcCompleteness(
      {
        items: [
          item({ key: 'a', label: 'A', passed: true, photoUrls: ['/uploads/a.jpg'] }),
          item({ key: 'b', label: 'B', passed: true, photoUrls: [] }),
          item({ key: 'c', label: 'C', required: false, requiresPhoto: false, passed: false }),
          item({ key: 'd', label: 'D', passed: false }),
        ],
      },
      null
    );
    expect(result.requiredTotal).toBe(3);
    expect(result.requiredPassed).toBe(1);
    expect(result.photoRequiredTotal).toBe(3);
    expect(result.photoSatisfied).toBe(1);
    expect(result.missingRequired).toEqual(['B', 'D']);
    expect(result.complete).toBe(false);
    expect(result.percent).toBe(33);
  });

  it('is complete when every required item passes and has its photo', () => {
    const result = qcCompleteness(
      {
        items: [
          item({ key: 'a', label: 'A', passed: true, photoUrls: ['/uploads/a.jpg'] }),
          item({ key: 'b', label: 'B', passed: true, photoUrls: [] }),
        ],
      },
      null
    );
    expect(result.complete).toBe(false);
    const noPhoto = qcCompleteness(
      { items: [{ key: 'a', label: 'A', passed: true, photoUrls: [] }] },
      { items: [{ key: 'a', label: 'A', required: true, requiresPhoto: false }] }
    );
    expect(noPhoto.complete).toBe(true);
  });

  it('falls back to the template flags when a run item omits them', () => {
    const result = qcCompleteness(
      { items: [{ key: 'x', label: 'X', passed: true, photoUrls: [] }] },
      { items: [{ key: 'x', label: 'X', required: true, requiresPhoto: false }] }
    );
    expect(result.requiredTotal).toBe(1);
    expect(result.requiredPassed).toBe(1);
    expect(result.complete).toBe(true);
  });

  it('handles empty runs', () => {
    expect(qcCompleteness(null).complete).toBe(false);
    expect(qcCompleteness({ items: [] }).requiredTotal).toBe(0);
  });
});

describe('privacy + address helpers', () => {
  it('labels privacy modes and explains them', () => {
    expect(privacyLabel('EXACT')).toBe('Exact address');
    expect(privacyLabel('STREET_ONLY')).toBe('Street only');
    expect(privacyLabel('HIDDEN')).toBe('Hidden');
    expect(privacyLabel(undefined)).toBe('Street only');
    expect(privacyDescription('HIDDEN')).toContain('no address');
    expect(privacyDescription('STREET_ONLY')).toContain('street name');
  });

  it('renders honest copy for withheld addresses', () => {
    expect(addressDisplay('700 Heritage Pkwy, McKinney, TX')).toBe('700 Heritage Pkwy, McKinney, TX');
    expect(addressDisplay('700 Heritage Pkwy')).toBe('700 Heritage Pkwy');
    expect(addressDisplay(null, 'HIDDEN')).toBe('Address kept private');
    expect(addressDisplay(null)).toBe('Address shared on request');
    expect(addressDisplay('   ')).toBe('Address shared on request');
  });
});

describe('public path / QR URL / digest helpers', () => {
  it('builds the public path only for a non-empty slug', () => {
    expect(publicPathFor('abc123')).toBe('/p/abc123');
    expect(publicPathFor('  ')).toBeNull();
    expect(publicPathFor(null)).toBeNull();
  });

  it('builds absolute public URLs with a clean origin', () => {
    expect(buildPublicUrl('abc123', 'https://roofs.example.com/')).toBe(
      'https://roofs.example.com/p/abc123'
    );
    expect(buildPublicUrl('a b', 'https://roofs.example.com')).toBe(
      'https://roofs.example.com/p/a%20b'
    );
  });

  it('shortens digests for display', () => {
    expect(shortDigest('a1b2c3d4e5f6a7b8c9')).toBe('a1b2c3d4e5f6…');
    expect(shortDigest('abc')).toBe('abc');
    expect(shortDigest(null)).toBe('—');
    expect(shortDigest('a1b2c3d4e5f6a7b8c9', 8)).toBe('a1b2c3d4…');
  });

  it('maps verification state to text + badge', () => {
    expect(verifyLabel(true)).toBe('Verified');
    expect(verifyLabel(false)).toBe('Not verified');
    expect(verifyLabel(null)).toBe('Verifying…');
    expect(verifyBadgeVariant(true)).toBe('success');
    expect(verifyBadgeVariant(false)).toBe('danger');
    expect(verifyBadgeVariant(null)).toBe('default');
  });
});

describe('admin + formatting helpers', () => {
  it('gates passport mutations to OWNER/MANAGER', () => {
    expect(isPassportAdmin('OWNER')).toBe(true);
    expect(isPassportAdmin('MANAGER')).toBe(true);
    expect(isPassportAdmin('SALES_REP')).toBe(false);
    expect(isPassportAdmin(null)).toBe(false);
  });

  it('detects a published record', () => {
    expect(isPassportPublished({ enabled: true, publishedAt: '2026-11-01T00:00:00Z' } as never)).toBe(true);
    expect(isPassportPublished({ enabled: false, publishedAt: '2026-11-01T00:00:00Z' } as never)).toBe(false);
    expect(isPassportPublished(null)).toBe(false);
  });

  it('formats money + estimate summaries', () => {
    expect(formatCurrency(145000)).toBe('$145,000');
    expect(formatCurrency(undefined)).toBe('—');
    expect(estimatesSummary(2, 145000)).toBe('2 approved estimates · $145,000');
    expect(estimatesSummary(1, 0)).toBe('1 approved estimate');
    expect(estimatesSummary(0, 0)).toBe('0 approved estimates');
  });

  it('humanises ledger/material labels and photo counts', () => {
    expect(ledgerKindLabel('QC_COMPLETED')).toBe('Qc completed');
    expect(ledgerKindLabel('PASSPORT_PUBLISHED')).toBe('Passport published');
    expect(materialStatusLabel('DELIVERED')).toBe('Delivered');
    expect(materialStatusLabel('ON_HOLD')).toBe('On Hold');
    expect(photoCountLabel(1)).toBe('1 photo');
    expect(photoCountLabel(12)).toBe('12 photos');
  });

  it('defaults the QC phase to the job phase then to any draft', () => {
    expect(defaultQcPhase('PRODUCTION', {})).toBe<JobPhase>('PRODUCTION');
    expect(defaultQcPhase('nope', { INVOICING: run({ phase: 'INVOICING', status: 'DRAFT' }) })).toBe<JobPhase>(
      'INVOICING'
    );
    expect(defaultQcPhase(undefined, {})).toBe<JobPhase>('INSPECTION');
  });
});
