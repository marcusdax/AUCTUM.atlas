/**
 * Install QC — pure checklist helpers.
 *
 * Everything in this module is deterministic and side-effect free (no Prisma,
 * no network) so it can be unit tested and reused by the seed script.
 *
 * Scoring/completion rules (contract §5–§6):
 *   - an item passes only when `passed` is true AND, for `requiresPhoto` items,
 *     at least one photo URL is attached;
 *   - `score` is the 0–100 share of *required* items that pass (photos included);
 *   - a run is PASSED when every required item passes and every photo-flagged
 *     item has evidence, otherwise FAILED.
 */
import type { JobPhase, QcStatus } from '@prisma/client';
import { QC_LEDGER_KIND, type QcRunItem, type QcRunView, type QcSummaryView } from './types';

const MAX_PHOTOS_PER_ITEM = 12;
const MAX_PHOTO_URL_LENGTH = 1_000;
const MAX_ITEM_NOTE_LENGTH = 500;
const MAX_RUN_NOTES_LENGTH = 4_000;

export function sanitizePhotoUrls(value: unknown, max: number = MAX_PHOTOS_PER_ITEM): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const url = raw.trim();
    if (!url || url.length > MAX_PHOTO_URL_LENGTH) continue;
    if (!out.includes(url)) out.push(url);
    if (out.length >= max) break;
  }
  return out;
}

export function sanitizeItemNote(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const note = value.trim();
  if (!note) return null;
  return note.length > MAX_ITEM_NOTE_LENGTH ? note.slice(0, MAX_ITEM_NOTE_LENGTH) : note;
}

export function sanitizeRunNotes(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const notes = value.trim();
  if (!notes) return null;
  return notes.length > MAX_RUN_NOTES_LENGTH ? notes.slice(0, MAX_RUN_NOTES_LENGTH) : notes;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Normalise `JobQcRun.items` JSON into typed items. Stored rows are always
 * written by this service, but reading defensively keeps bad data from crashing
 * the API or the public snapshot.
 */
export function parseStoredItems(value: unknown): QcRunItem[] {
  if (!Array.isArray(value)) return [];
  const items: QcRunItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const entry = raw as Record<string, unknown>;
    const key = typeof entry.key === 'string' ? entry.key.trim() : '';
    if (!key) continue;
    const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim().slice(0, 200) : key;
    items.push({
      key,
      label,
      required: toBoolean(entry.required, false),
      requiresPhoto: toBoolean(entry.requiresPhoto, false),
      passed: toBoolean(entry.passed, false),
      note: sanitizeItemNote(entry.note),
      photoUrls: sanitizePhotoUrls(entry.photoUrls),
    });
  }
  return items;
}

export interface QcItemPatch {
  key: string;
  passed: boolean;
  note?: string | null;
  photoUrls?: string[];
}

/**
 * Apply item patches to a stored checklist. Only keys that exist on the run are
 * updated (unknown keys are ignored, per contract §6), and every value is
 * re-sanitised before persistence.
 */
export function applyQcItemPatches(items: unknown, patches: unknown): QcRunItem[] {
  const current = parseStoredItems(items);
  if (!Array.isArray(patches) || patches.length === 0) return current;
  const byKey = new Map(current.map((item) => [item.key, item]));

  for (const raw of patches) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const patch = raw as Record<string, unknown>;
    if (typeof patch.key !== 'string') continue;
    const key = patch.key.trim();
    const item = byKey.get(key);
    if (!item) continue; // unknown keys are ignored
    item.passed = toBoolean(patch.passed, item.passed);
    if (patch.note !== undefined) item.note = sanitizeItemNote(patch.note);
    if (patch.photoUrls !== undefined) item.photoUrls = sanitizePhotoUrls(patch.photoUrls);
  }

  return current;
}

/** An item is satisfied when ticked and its photo requirement (if any) is met. */
export function isQcItemSatisfied(item: QcRunItem): boolean {
  if (!item.passed) return false;
  if (item.requiresPhoto && item.photoUrls.length === 0) return false;
  return true;
}

/** 0–100 score over required items (photo evidence counts as part of passing). */
export function computeQcScore(items: unknown): number {
  const list = parseStoredItems(items);
  if (list.length === 0) return 0;
  const required = list.filter((item) => item.required);
  if (required.length === 0) {
    // Defensive: a template with no required items scores on the whole checklist.
    const passed = list.filter(isQcItemSatisfied).length;
    return Math.round((passed / list.length) * 100);
  }
  const passed = required.filter(isQcItemSatisfied).length;
  return Math.round((passed / required.length) * 100);
}

/** PASSED only when every required item passes and every photo item has evidence. */
export function canCompleteQcRun(items: unknown): boolean {
  const list = parseStoredItems(items);
  if (list.length === 0) return false;
  return list.every(
    (item) =>
      (!item.required || isQcItemSatisfied(item)) &&
      (!item.requiresPhoto || item.photoUrls.length > 0)
  );
}

export function summarizeQcRuns(runs: Array<{ status: string }>): QcSummaryView {
  const totalRuns = Array.isArray(runs) ? runs.length : 0;
  const passedRuns = Array.isArray(runs) ? runs.filter((run) => run.status === 'PASSED').length : 0;
  return {
    passedRuns,
    totalRuns,
    percent: totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0,
  };
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function iso(value: unknown): string {
  return isoOrNull(value) ?? new Date(0).toISOString();
}

/** DB row → API wire shape (contract §6 `QcRun`). No internal staff data except user ids. */
export function toQcRunView(row: {
  id: string;
  jobId: string;
  phase: JobPhase;
  status: QcStatus;
  items: unknown;
  score: number;
  notes: string | null;
  completedByUserId: string | null;
  completedAt: Date | string | null;
  createdByUserId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}): QcRunView {
  return {
    id: row.id,
    jobId: row.jobId,
    phase: row.phase,
    status: row.status,
    items: parseStoredItems(row.items),
    score: clampScore(row.score),
    notes: row.notes ?? null,
    completedByUserId: row.completedByUserId ?? null,
    completedAt: isoOrNull(row.completedAt),
    createdByUserId: row.createdByUserId ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Deterministic append-only ledger key: retries never write a second receipt. */
export function qcCompletionIdempotencyKey(runId: string, status: QcStatus): string {
  return `qc:${runId}:${status}`;
}

export function qcCompletionDescription(input: {
  jobName: string;
  phase: JobPhase;
  status: QcStatus;
  score: number;
}): string {
  const phase = input.phase.charAt(0) + input.phase.slice(1).toLowerCase();
  return `${QC_LEDGER_KIND.replace(/_/g, ' ')} ${input.status} · ${input.jobName} · ${phase} checklist · ${clampScore(
    input.score
  )}/100`;
}
