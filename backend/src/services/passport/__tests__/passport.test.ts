/**
 * passport.test.ts — slug generation, privacy mapping, snapshot sanitising and
 * the SHA-256 canonical digest (contract §6). No DB/network.
 * Run: npx tsx --test src/services/passport/__tests__/passport.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  composePublicPassport,
  computeContentDigest,
  finalizeSnapshot,
  generatePassportSlug,
  normalizePassportSlug,
  normalizePhotoUrl,
  passportPublishDescription,
  passportPublishIdempotencyKey,
  publicPathFor,
  sanitizeHeroPhotoUrl,
  sanitizePropertyAddress,
  toPassportAdminView,
  verifySnapshotDigest,
  type ComposePassportInput,
} from '../passport';
import { CROCKFORD_ALPHABET, PASSPORT_SLUG_LENGTH } from '../types';

function photoSeeds(count: number): ComposePassportInput['photos'] {
  return Array.from({ length: count }, (_, index) => ({
    url: `uploads/demo-photo-${index + 1}.svg`,
    name: `Roof photo ${index + 1}`,
  }));
}

function composeInput(overrides: Partial<ComposePassportInput> = {}): ComposePassportInput {
  return {
    slug: 'ABCDEFGHJK',
    version: 1,
    publishedAt: '2026-11-26T12:00:00.000Z',
    headline: 'Verified roof record — Coleman',
    summary: 'Tear-off, underlayment and flashing verified with photo evidence.',
    privacy: 'STREET_ONLY',
    company: { name: 'RoofPro Demo Roofing', phone: '(214) 555-0100', logoUrl: 'uploads/logo.png' },
    job: {
      name: 'Coleman — Full Roof Replacement',
      phase: 'PRODUCTION',
      status: 'ACTIVE',
      completedAt: '2026-11-28T00:00:00.000Z',
      propertyAddress: '1420 W Hunt St, McKinney, TX 75069',
    },
    photos: photoSeeds(3),
    materials: [
      {
        name: 'Architectural Shingles — Class 3',
        quantity: 28,
        unit: 'sq',
        supplierName: 'ABC Supply Co.',
        status: 'DELIVERED',
      },
    ],
    estimates: { count: 2, approvedTotal: 25_600.5 },
    qc: [
      {
        phase: 'PRODUCTION',
        status: 'PASSED',
        score: 100,
        completedAt: '2026-11-27T18:00:00.000Z',
        items: [
          { label: 'Tear-off complete and deck inspected', passed: true },
          { label: 'Site cleaned and debris removed', passed: true },
        ],
      },
      {
        phase: 'INSPECTION',
        status: 'DRAFT',
        score: 20,
        completedAt: null,
        items: [{ label: 'Damage documented in dated photos', passed: false }],
      },
    ],
    ledger: [
      { kind: 'QC_RUN', description: 'QC RUN PASSED · Coleman · Production · 100/100', at: '2026-11-27T18:00:00.000Z' },
    ],
    ...overrides,
  };
}

// ─────────────────────────── slugs ───────────────────────────

test('generates a 10-char Crockford base32 slug from injected entropy', () => {
  assert.equal(generatePassportSlug(() => Buffer.alloc(PASSPORT_SLUG_LENGTH, 0)), '0000000000');
  assert.equal(generatePassportSlug(() => Buffer.alloc(PASSPORT_SLUG_LENGTH, 31)), 'ZZZZZZZZZZ');
  const random = generatePassportSlug();
  assert.equal(random.length, PASSPORT_SLUG_LENGTH);
  assert.match(random, /^[0-9A-HJKMNP-TV-Z]{10}$/);
  for (const char of random) assert.ok(CROCKFORD_ALPHABET.includes(char));
});

test('generated slugs are unique across a sample', () => {
  const slugs = new Set(Array.from({ length: 200 }, () => generatePassportSlug()));
  assert.ok(slugs.size >= 199, `expected near-unique slugs, got ${slugs.size}/200`);
});

test('normalizes slugs for lookup and rejects malformed input', () => {
  assert.equal(normalizePassportSlug(' abcdefghjk '), 'ABCDEFGHJK');
  assert.equal(normalizePassportSlug('0123456789'), '0123456789');
  assert.equal(normalizePassportSlug('ZZZZZZZZZZ'), 'ZZZZZZZZZZ');
  assert.equal(normalizePassportSlug('IIIIIIIIII'), null, 'I is not in the Crockford alphabet');
  assert.equal(normalizePassportSlug('short'), null);
  assert.equal(normalizePassportSlug('has-dash00'), null);
  assert.equal(normalizePassportSlug(''), null);
  assert.equal(normalizePassportSlug(null), null);
  assert.equal(normalizePassportSlug(42), null);
});

test('publicPathFor builds the shareable /p/<slug> path', () => {
  assert.equal(publicPathFor('ABCDEFGHJK'), '/p/ABCDEFGHJK');
});

// ─────────────────────────── privacy ───────────────────────────

test('maps privacy to the contract address rules', () => {
  const address = '700 Heritage Pkwy, Prosper, TX 75078';
  assert.equal(sanitizePropertyAddress(address, 'EXACT'), address);
  assert.equal(sanitizePropertyAddress(address, 'STREET_ONLY'), '700 Heritage Pkwy');
  assert.equal(sanitizePropertyAddress(address, 'HIDDEN'), null);
  // No comma: street-only keeps the whole line rather than dropping it.
  assert.equal(sanitizePropertyAddress('700 Heritage Pkwy', 'STREET_ONLY'), '700 Heritage Pkwy');
  assert.equal(sanitizePropertyAddress('   ', 'EXACT'), null);
  assert.equal(sanitizePropertyAddress(null, 'EXACT'), null);
});

test('only http(s) and uploads evidence URLs survive sanitising', () => {
  assert.equal(normalizePhotoUrl('uploads/a.jpg'), 'uploads/a.jpg');
  assert.equal(normalizePhotoUrl('/uploads/a.jpg'), '/uploads/a.jpg');
  assert.equal(normalizePhotoUrl('https://cdn.example.com/a.jpg'), 'https://cdn.example.com/a.jpg');
  assert.equal(normalizePhotoUrl('javascript:alert(1)'), null);
  assert.equal(normalizePhotoUrl('data:image/svg+xml;base64,AAAA'), null);
  assert.equal(normalizePhotoUrl('  '), null);
  assert.equal(normalizePhotoUrl(42), null);
  assert.equal(sanitizeHeroPhotoUrl(null), null);
  assert.equal(sanitizeHeroPhotoUrl('uploads/hero.jpg'), 'uploads/hero.jpg');
  assert.equal(sanitizeHeroPhotoUrl('javascript:evil'), null);
});

// ─────────────────────────── snapshot ───────────────────────────

test('composes a sanitised public snapshot with the exact contract shape', () => {
  const body = composePublicPassport(composeInput());
  assert.equal(body.slug, 'ABCDEFGHJK');
  assert.equal(body.version, 1);
  assert.equal(body.publishedAt, '2026-11-26T12:00:00.000Z');
  assert.equal(body.headline, 'Verified roof record — Coleman');
  assert.deepEqual(body.company, {
    name: 'RoofPro Demo Roofing',
    phone: '(214) 555-0100',
    logoUrl: 'uploads/logo.png',
  });
  assert.equal(body.job.name, 'Coleman — Full Roof Replacement');
  assert.equal(body.job.phase, 'PRODUCTION');
  assert.equal(body.job.completedAt, '2026-11-28T00:00:00.000Z');
  assert.equal(body.job.propertyAddress, '1420 W Hunt St', 'STREET_ONLY hides the rest of the address');
  assert.equal(body.job.photoCount, 3);
  assert.equal(body.photos.length, 3);
  assert.deepEqual(body.photos[0], { url: 'uploads/demo-photo-1.svg', name: 'Roof photo 1' });
  assert.deepEqual(body.materials, [
    {
      name: 'Architectural Shingles — Class 3',
      quantity: 28,
      unit: 'sq',
      supplierName: 'ABC Supply Co.',
      status: 'DELIVERED',
    },
  ]);
  assert.deepEqual(body.estimates, { count: 2, approvedTotal: 25_600.5 });
  // Only completed sign-offs are published; DRAFT runs never appear.
  assert.equal(body.qc.length, 1);
  assert.equal(body.qc[0].status, 'PASSED');
  assert.deepEqual(body.qc[0].items, [
    { label: 'Tear-off complete and deck inspected', passed: true },
    { label: 'Site cleaned and debris removed', passed: true },
  ]);
  assert.equal(body.ledger.length, 1);
  assert.equal(body.ledger[0].kind, 'QC_RUN');
});

test('caps photos, materials, QC runs and ledger entries', () => {
  const body = composePublicPassport(
    composeInput({
      photos: photoSeeds(30),
      materials: Array.from({ length: 40 }, (_, index) => ({
        name: `Material ${index}`,
        quantity: index,
        unit: 'ea',
        supplierName: 'Supplier',
        status: 'DELIVERED',
      })),
      qc: Array.from({ length: 15 }, (_, index) => ({
        phase: 'PRODUCTION',
        status: 'PASSED',
        score: 100,
        completedAt: '2026-11-27T18:00:00.000Z',
        items: [],
      })),
      ledger: Array.from({ length: 40 }, (_, index) => ({
        kind: 'QC_RUN',
        description: `Entry ${index}`,
        at: '2026-11-27T18:00:00.000Z',
      })),
    })
  );
  assert.equal(body.photos.length, 12);
  assert.equal(body.job.photoCount, 12);
  assert.equal(body.materials.length, 24);
  assert.equal(body.qc.length, 10);
  assert.equal(body.ledger.length, 20);
});

test('never leaks internal ids, customer PII, notes or staff identities', () => {
  const input = composeInput() as ComposePassportInput & Record<string, unknown>;
  // Deliberately pass extra/internal fields: the composer must ignore them.
  (input.job as Record<string, unknown>).customerName = 'Jane Homeowner';
  (input.job as Record<string, unknown>).customerEmail = 'jane@example.com';
  (input.job as Record<string, unknown>).notes = 'internal sales notes';
  (input.job as Record<string, unknown>).id = 'job-internal-id';
  (input.job as Record<string, unknown>).createdByUserId = 'user-internal';
  input.internalId = 'job-internal-id';
  input.leadId = 'lead-internal';

  const body = composePublicPassport(input);
  const serialized = JSON.stringify(body);
  for (const forbidden of [
    'Jane Homeowner',
    'jane@example.com',
    'internal sales notes',
    'job-internal-id',
    'user-internal',
    'lead-internal',
    '"customerName"',
    '"notes"',
  ]) {
    assert.equal(serialized.includes(forbidden), false, `snapshot leaked ${forbidden}`);
  }
  // The only allowed identity-adjacent value is the company phone.
  assert.equal(serialized.includes('(214) 555-0100'), true);
});

test('HIDDEN privacy nulls the address in the snapshot', () => {
  const body = composePublicPassport(composeInput({ privacy: 'HIDDEN' }));
  assert.equal(body.job.propertyAddress, null);
});

test('falls back to a non-empty headline when none is supplied', () => {
  const body = composePublicPassport(composeInput({ headline: null }));
  assert.ok(body.headline.length > 0);
  assert.ok(body.headline.includes('Coleman') || body.headline.includes('Verified'));
});

// ─────────────────────────── digest ───────────────────────────

test('computes a 64-char hex digest over canonical JSON', () => {
  const body = composePublicPassport(composeInput());
  const digest = computeContentDigest(body);
  assert.match(digest, /^[0-9a-f]{64}$/);
  // Canonical JSON: key insertion order does not change the digest.
  const reordered = {
    ledger: body.ledger,
    qc: body.qc,
    estimates: body.estimates,
    materials: body.materials,
    photos: body.photos,
    job: body.job,
    company: body.company,
    summary: body.summary,
    headline: body.headline,
    publishedAt: body.publishedAt,
    version: body.version,
    slug: body.slug,
  };
  assert.equal(computeContentDigest(reordered), digest);
});

test('finalize + verify round-trips and detects tampering', () => {
  const body = composePublicPassport(composeInput());
  const digest = computeContentDigest(body);
  const snapshot = finalizeSnapshot(body, digest);

  assert.deepEqual(snapshot.verify, { digest, algorithm: 'SHA-256', canonical: 'auctum.passport.v1' });
  assert.equal(computeContentDigest(snapshot), digest, 'verify block is excluded from the digest');
  assert.deepEqual(verifySnapshotDigest(snapshot, digest), { verified: true, recomputed: digest });

  // Tamper with a published field.
  const tampered = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
  tampered.job.propertyAddress = '999 Evil Street, Hacker, TX';
  assert.equal(verifySnapshotDigest(tampered, digest).verified, false);

  // Tampering with only the embedded digest also fails.
  const fakeVerify = {
    ...snapshot,
    verify: { ...snapshot.verify, digest: 'f'.repeat(64) },
  };
  assert.equal(verifySnapshotDigest(fakeVerify, digest).verified, false);

  // Missing stored digest cannot verify.
  assert.equal(verifySnapshotDigest(snapshot, null).verified, false);
  assert.equal(verifySnapshotDigest(snapshot, '').verified, false);
});

// ─────────────────────────── admin view ───────────────────────────

test('admin view omits the snapshot and exposes publicPath only when enabled', () => {
  const row = {
    id: 'passport-1',
    companyId: 'company-1',
    jobId: 'job-1',
    slug: 'ABCDEFGHJK',
    enabled: true,
    privacy: 'STREET_ONLY' as const,
    headline: 'Verified roof record',
    summary: null,
    heroPhotoUrl: null,
    snapshot: { secret: true },
    contentDigest: 'a'.repeat(64),
    version: 2,
    publishedAt: new Date('2026-11-26T12:00:00.000Z'),
    unpublishedAt: null,
    lastPublishedByUserId: 'user-1',
    createdByUserId: 'user-1',
    createdAt: new Date('2026-11-25T12:00:00.000Z'),
    updatedAt: new Date('2026-11-26T12:00:00.000Z'),
  };
  const view = toPassportAdminView(row);
  assert.equal(view.publicPath, '/p/ABCDEFGHJK');
  assert.equal(view.publishedAt, '2026-11-26T12:00:00.000Z');
  assert.equal(view.contentDigest, 'a'.repeat(64));
  assert.equal('snapshot' in view, false, 'admin view never returns the snapshot');

  const disabled = toPassportAdminView({ ...row, enabled: false });
  assert.equal(disabled.publicPath, null);
});

test('publish idempotency keys are deterministic and version/digest scoped', () => {
  const key = passportPublishIdempotencyKey('passport-1', 1, 'a'.repeat(64));
  assert.equal(key, `passport:passport-1:v1:${'a'.repeat(64)}`);
  assert.equal(key, passportPublishIdempotencyKey('passport-1', 1, 'a'.repeat(64)));
  assert.notEqual(key, passportPublishIdempotencyKey('passport-1', 2, 'a'.repeat(64)));
  assert.notEqual(key, passportPublishIdempotencyKey('passport-1', 1, 'b'.repeat(64)));
  assert.match(passportPublishDescription('Coleman', 2), /Coleman/);
  assert.match(passportPublishDescription('Coleman', 2), /v2/);
});
