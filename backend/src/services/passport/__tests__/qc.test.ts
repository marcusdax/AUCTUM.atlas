/**
 * qc.test.ts — pure QC checklist helpers (patch sanitising, scoring, completion).
 * Run: npx tsx --test src/services/passport/__tests__/qc.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyQcItemPatches,
  canCompleteQcRun,
  computeQcScore,
  isQcItemSatisfied,
  parseStoredItems,
  qcCompletionDescription,
  qcCompletionIdempotencyKey,
  sanitizeItemNote,
  sanitizePhotoUrls,
  summarizeQcRuns,
  toQcRunView,
} from '../qc';
import { buildQcRunItems } from '../templates';
import type { QcRunItem } from '../types';

function tickAll(items: QcRunItem[], photo = 'uploads/evidence-1.jpg'): QcRunItem[] {
  return items.map((item) => ({
    ...item,
    passed: true,
    photoUrls: item.requiresPhoto ? [photo] : [],
  }));
}

test('parseStoredItems normalises stored JSON defensively', () => {
  const parsed = parseStoredItems([
    { key: 'tear_off', label: 'Tear-off', required: true, requiresPhoto: true, passed: true, photoUrls: ['a', 5, 'a'] },
    { key: '', label: 'no key' },
    'nonsense',
    { key: 'underlayment', passed: 'yes' },
  ]);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0].photoUrls, ['a']);
  assert.equal(parsed[0].passed, true);
  assert.equal(parsed[1].passed, false);
  assert.equal(parsed[1].label, 'underlayment');
  assert.equal(parsed[1].required, false);
});

test('sanitizePhotoUrls keeps only strings, removes duplicates and caps the list', () => {
  const many = Array.from({ length: 20 }, (_, index) => `uploads/photo-${index}.jpg`);
  const result = sanitizePhotoUrls(['uploads/a.jpg', ' uploads/a.jpg ', 'uploads/a.jpg', null, 7, many[0], ...many], 12);
  assert.equal(result.length, 12);
  assert.equal(result[0], 'uploads/a.jpg');
  assert.equal(new Set(result).size, result.length);
  assert.deepEqual(sanitizePhotoUrls('not-an-array'), []);
});

test('sanitizeItemNote trims, drops blanks and caps length', () => {
  assert.equal(sanitizeItemNote('  deck replaced  '), 'deck replaced');
  assert.equal(sanitizeItemNote('   '), null);
  assert.equal(sanitizeItemNote(42), null);
  assert.equal(sanitizeItemNote('x'.repeat(900))?.length, 500);
});

test('applyQcItemPatches updates only known keys and re-sanitises every value', () => {
  const items = buildQcRunItems('PRODUCTION');
  const patched = applyQcItemPatches(items, [
    { key: 'tear_off', passed: true, photoUrls: ['uploads/tearoff.jpg', 9, 'uploads/tearoff.jpg'], note: ' deck ok ' },
    { key: 'underlayment', passed: 'yes' },
    { key: 'not_a_real_key', passed: true },
    { key: 'flashing' }, // missing fields keep current values
  ]);
  const byKey = new Map(patched.map((item) => [item.key, item]));
  assert.equal(byKey.get('tear_off')?.passed, true);
  assert.deepEqual(byKey.get('tear_off')?.photoUrls, ['uploads/tearoff.jpg']);
  assert.equal(byKey.get('tear_off')?.note, 'deck ok');
  assert.equal(byKey.get('underlayment')?.passed, false, 'non-boolean passed is ignored');
  assert.equal(patched.some((item) => item.key === 'not_a_real_key'), false);
  assert.equal(byKey.get('flashing')?.passed, false);
  // Order is preserved from the run, not from the patch payload.
  assert.deepEqual(patched.map((item) => item.key), items.map((item) => item.key));
});

test('isQcItemSatisfied requires both a pass and photo evidence when flagged', () => {
  const base: QcRunItem = {
    key: 'tear_off',
    label: 'Tear-off complete',
    required: true,
    requiresPhoto: true,
    passed: true,
    note: null,
    photoUrls: [],
  };
  assert.equal(isQcItemSatisfied(base), false);
  assert.equal(isQcItemSatisfied({ ...base, photoUrls: ['uploads/a.jpg'] }), true);
  assert.equal(isQcItemSatisfied({ ...base, passed: false, photoUrls: ['uploads/a.jpg'] }), false);
  assert.equal(isQcItemSatisfied({ ...base, requiresPhoto: false }), true);
});

test('computeQcScore is the percentage of required items that pass', () => {
  const items = buildQcRunItems('INSPECTION');
  assert.equal(computeQcScore(items), 0);
  assert.equal(computeQcScore(tickAll(items)), 100);

  const partial = tickAll(items);
  partial[0].passed = false;
  partial[1].passed = false;
  // 3 of 5 required items pass → 60
  assert.equal(computeQcScore(partial), 60);

  // A photo-flagged item ticked without evidence does not count.
  const noPhoto = tickAll(items);
  noPhoto[2].photoUrls = []; // damage_photos
  assert.equal(computeQcScore(noPhoto), 80);

  assert.equal(computeQcScore([]), 0);
  assert.equal(computeQcScore(null), 0);
});

test('canCompleteQcRun passes only when required items and photos are satisfied', () => {
  const items = buildQcRunItems('PRODUCTION');
  assert.equal(canCompleteQcRun(items), false);
  assert.equal(canCompleteQcRun(tickAll(items)), true);

  const missingPhoto = tickAll(items);
  missingPhoto[0].photoUrls = []; // tear_off
  assert.equal(canCompleteQcRun(missingPhoto), false);
  assert.equal(computeQcScore(missingPhoto), 80);

  const unticked = tickAll(items);
  unticked[3].passed = false;
  assert.equal(canCompleteQcRun(unticked), false);

  assert.equal(canCompleteQcRun([]), false);
});

test('a FAILED checklist is unticked but still scores its passing items', () => {
  const items = buildQcRunItems('COMPLETED');
  const failed = tickAll(items);
  failed[1].passed = false; // walkthrough
  assert.equal(canCompleteQcRun(failed), false);
  assert.equal(computeQcScore(failed), 75);
});

test('summarizeQcRuns computes passed share', () => {
  assert.deepEqual(summarizeQcRuns([]), { passedRuns: 0, totalRuns: 0, percent: 0 });
  assert.deepEqual(
    summarizeQcRuns([{ status: 'PASSED' }, { status: 'FAILED' }, { status: 'PASSED' }, { status: 'DRAFT' }]),
    { passedRuns: 2, totalRuns: 4, percent: 50 }
  );
});

test('toQcRunView produces ISO strings and typed items', () => {
  const view = toQcRunView({
    id: 'run-1',
    jobId: 'job-1',
    phase: 'PRODUCTION',
    status: 'PASSED',
    items: tickAll(buildQcRunItems('PRODUCTION')),
    score: 100,
    notes: 'done',
    completedByUserId: 'user-1',
    completedAt: new Date('2026-11-26T12:00:00.000Z'),
    createdByUserId: 'user-2',
    createdAt: new Date('2026-11-26T11:00:00.000Z'),
    updatedAt: new Date('2026-11-26T12:00:00.000Z'),
  });
  assert.equal(view.completedAt, '2026-11-26T12:00:00.000Z');
  assert.equal(view.createdAt, '2026-11-26T11:00:00.000Z');
  assert.equal(view.items.length, 5);
  assert.equal(view.notes, 'done');
  assert.equal(typeof view.score, 'number');
});

test('ledger ids are deterministic so retries never double-write', () => {
  assert.equal(qcCompletionIdempotencyKey('run-1', 'PASSED'), 'qc:run-1:PASSED');
  assert.equal(qcCompletionIdempotencyKey('run-1', 'PASSED'), qcCompletionIdempotencyKey('run-1', 'PASSED'));
  assert.notEqual(qcCompletionIdempotencyKey('run-1', 'FAILED'), qcCompletionIdempotencyKey('run-1', 'PASSED'));
  const description = qcCompletionDescription({ jobName: 'Coleman', phase: 'PRODUCTION', status: 'PASSED', score: 100 });
  assert.match(description, /Coleman/);
  assert.match(description, /100\/100/);
  assert.match(description, /PASSED/);
});
