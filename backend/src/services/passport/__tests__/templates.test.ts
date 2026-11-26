/**
 * templates.test.ts — canonical QC templates (contract §5).
 * Run: npx tsx --test src/services/passport/__tests__/templates.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { QC_TEMPLATES, buildQcRunItems, getQcTemplate, isQcPhase } from '../templates';
import { QC_PHASES } from '../types';

const EXPECTED: Record<string, Array<{ key: string; label: string; photo: boolean }>> = {
  INSPECTION: [
    { key: 'access_safety', label: 'Roof access and fall protection verified', photo: false },
    { key: 'attic_ventilation', label: 'Attic and ventilation inspected', photo: false },
    { key: 'damage_photos', label: 'Damage documented in dated photos', photo: true },
    { key: 'measurements', label: 'Measurements taken or aerial report attached', photo: false },
    { key: 'homeowner_consent', label: 'Homeowner consent captured', photo: false },
  ],
  ESTIMATE: [
    { key: 'scope_matches_damage', label: 'Scope matches documented damage', photo: true },
    { key: 'line_items_priced', label: 'Every line item has cost and price', photo: false },
    { key: 'exclusions_stated', label: 'Exclusions and assumptions stated', photo: false },
    { key: 'supplement_path', label: 'Supplement/change-order path explained', photo: false },
    { key: 'proposal_ready', label: 'Proposal ready for signature', photo: false },
  ],
  PRODUCTION: [
    { key: 'tear_off', label: 'Tear-off complete and deck inspected', photo: true },
    { key: 'underlayment', label: 'Underlayment installed to spec', photo: false },
    { key: 'flashing', label: 'Flashing and penetrations sealed', photo: false },
    { key: 'ventilation', label: 'Ventilation balanced', photo: false },
    { key: 'site_cleanup', label: 'Site cleaned and debris removed', photo: true },
  ],
  INVOICING: [
    { key: 'final_photos', label: 'Final photo set captured', photo: true },
    { key: 'final_qc', label: 'Final QC run passed', photo: false },
    { key: 'change_orders', label: 'Change orders signed', photo: false },
    { key: 'invoice_matches_contract', label: 'Invoice matches contract', photo: false },
    { key: 'lien_waiver', label: 'Lien waiver ready', photo: false },
  ],
  COMPLETED: [
    { key: 'warranty_issued', label: 'Warranty issued to homeowner', photo: true },
    { key: 'walkthrough', label: 'Homeowner walkthrough completed', photo: false },
    { key: 'maintenance_guide', label: 'Maintenance guide shared', photo: false },
    { key: 'review_requested', label: 'Review requested', photo: false },
  ],
};

test('exposes all five phases in contract order with labels', () => {
  assert.deepEqual(
    QC_TEMPLATES.map((template) => template.phase),
    [...QC_PHASES]
  );
  assert.deepEqual(
    QC_TEMPLATES.map((template) => template.label),
    ['Inspection', 'Estimate', 'Production', 'Invoicing', 'Completed']
  );
});

test('items match the canonical keys, labels and photo flags', () => {
  for (const template of QC_TEMPLATES) {
    const expected = EXPECTED[template.phase];
    assert.ok(expected, `unexpected phase ${template.phase}`);
    assert.equal(template.items.length, expected.length, `${template.phase} item count`);
    template.items.forEach((item, index) => {
      assert.equal(item.key, expected[index].key, `${template.phase}[${index}] key`);
      assert.equal(item.label, expected[index].label, `${template.phase}[${index}] label`);
      assert.equal(item.requiresPhoto, expected[index].photo, `${template.phase}[${index}] requiresPhoto`);
      // Approved default: every SOP item is required.
      assert.equal(item.required, true, `${template.phase}[${index}] required`);
    });
  }
});

test('photo evidence is required on exactly the contract-marked items', () => {
  const photoKeys = QC_TEMPLATES.flatMap((template) =>
    template.items.filter((item) => item.requiresPhoto).map((item) => `${template.phase}:${item.key}`)
  );
  assert.deepEqual(photoKeys.sort(), [
    'COMPLETED:warranty_issued',
    'ESTIMATE:scope_matches_damage',
    'INSPECTION:damage_photos',
    'INVOICING:final_photos',
    'PRODUCTION:site_cleanup',
    'PRODUCTION:tear_off',
  ]);
});

test('every phase has required items and a template lookup', () => {
  for (const phase of QC_PHASES) {
    const template = getQcTemplate(phase);
    assert.ok(template);
    assert.ok(template!.items.some((item) => item.required), `${phase} must have required items`);
    assert.ok(template!.items.length >= 4);
  }
});

test('isQcPhase narrows known phases only', () => {
  assert.equal(isQcPhase('PRODUCTION'), true);
  assert.equal(isQcPhase('production'), false);
  assert.equal(isQcPhase('TEAR_OFF'), false);
  assert.equal(isQcPhase(undefined), false);
  assert.equal(isQcPhase(42), false);
});

test('buildQcRunItems creates fresh un-ticked items per phase', () => {
  for (const phase of QC_PHASES) {
    const items = buildQcRunItems(phase);
    assert.equal(items.length, EXPECTED[phase].length, `${phase} item count`);
    for (const item of items) {
      assert.equal(item.passed, false);
      assert.equal(item.note, null);
      assert.deepEqual(item.photoUrls, []);
      assert.equal(item.required, true);
    }
  }
  // Guard against accidental shared arrays between runs.
  const first = buildQcRunItems('PRODUCTION');
  first[0].photoUrls.push('uploads/a.jpg');
  assert.deepEqual(buildQcRunItems('PRODUCTION')[0].photoUrls, []);
});
