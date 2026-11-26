/**
 * Canonical Install QC templates — contract §5.
 *
 * Five phase-specific SOP checklists. Per the approved reading of §5:
 *   - every SOP item is `required: true` by default (the operator guide says
 *     "required items must be ticked");
 *   - `requiresPhoto: true` exactly where the contract marks "(photo)" —
 *     such an item only passes once at least one photo URL is attached.
 *
 * The frontend renders whatever this returns, so keys/labels/flags are part of
 * the shared contract: do not rename them.
 */
import type { JobPhase } from '@prisma/client';
import { QC_PHASE_LABELS, QC_PHASES, type QcRunItem, type QcTemplate, type QcTemplateItem } from './types';

interface RawItem {
  key: string;
  label: string;
  /** true where the contract marks "(photo)" */
  photo?: boolean;
}

function item(key: string, label: string, opts: { photo?: boolean } = {}): QcTemplateItem {
  return {
    key,
    label,
    // Approved default: every SOP item is required unless a future template says otherwise.
    required: true,
    requiresPhoto: opts.photo === true,
  };
}

const RAW_TEMPLATES: Array<{ phase: JobPhase; items: RawItem[] }> = [
  {
    phase: 'INSPECTION',
    items: [
      { key: 'access_safety', label: 'Roof access and fall protection verified' },
      { key: 'attic_ventilation', label: 'Attic and ventilation inspected' },
      { key: 'damage_photos', label: 'Damage documented in dated photos', photo: true },
      { key: 'measurements', label: 'Measurements taken or aerial report attached' },
      { key: 'homeowner_consent', label: 'Homeowner consent captured' },
    ],
  },
  {
    phase: 'ESTIMATE',
    items: [
      { key: 'scope_matches_damage', label: 'Scope matches documented damage', photo: true },
      { key: 'line_items_priced', label: 'Every line item has cost and price' },
      { key: 'exclusions_stated', label: 'Exclusions and assumptions stated' },
      { key: 'supplement_path', label: 'Supplement/change-order path explained' },
      { key: 'proposal_ready', label: 'Proposal ready for signature' },
    ],
  },
  {
    phase: 'PRODUCTION',
    items: [
      { key: 'tear_off', label: 'Tear-off complete and deck inspected', photo: true },
      { key: 'underlayment', label: 'Underlayment installed to spec' },
      { key: 'flashing', label: 'Flashing and penetrations sealed' },
      { key: 'ventilation', label: 'Ventilation balanced' },
      { key: 'site_cleanup', label: 'Site cleaned and debris removed', photo: true },
    ],
  },
  {
    phase: 'INVOICING',
    items: [
      { key: 'final_photos', label: 'Final photo set captured', photo: true },
      { key: 'final_qc', label: 'Final QC run passed' },
      { key: 'change_orders', label: 'Change orders signed' },
      { key: 'invoice_matches_contract', label: 'Invoice matches contract' },
      { key: 'lien_waiver', label: 'Lien waiver ready' },
    ],
  },
  {
    phase: 'COMPLETED',
    items: [
      { key: 'warranty_issued', label: 'Warranty issued to homeowner', photo: true },
      { key: 'walkthrough', label: 'Homeowner walkthrough completed' },
      { key: 'maintenance_guide', label: 'Maintenance guide shared' },
      { key: 'review_requested', label: 'Review requested' },
    ],
  },
];

/** Canonical templates in phase order (contract §5). */
export const QC_TEMPLATES: QcTemplate[] = RAW_TEMPLATES.map((raw) => ({
  phase: raw.phase,
  label: QC_PHASE_LABELS[raw.phase],
  items: raw.items.map((entry) => item(entry.key, entry.label, { photo: entry.photo })),
}));

export function isQcPhase(value: unknown): value is JobPhase {
  return typeof value === 'string' && (QC_PHASES as readonly string[]).includes(value);
}

export function getQcTemplate(phase: JobPhase): QcTemplate | undefined {
  return QC_TEMPLATES.find((template) => template.phase === phase);
}

/** A fresh, un-ticked item set for a new DRAFT run. */
export function buildQcRunItems(phase: JobPhase): QcRunItem[] {
  const template = getQcTemplate(phase);
  if (!template) return [];
  return template.items.map((templateItem) => ({
    ...templateItem,
    passed: false,
    note: null,
    photoUrls: [],
  }));
}
