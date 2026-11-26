/**
 * QcPanel — Install QC phase checklists for a job.
 *
 * Contract: docs/SPRINT_10_QC_PASSPORT.md §5–§7. Fetches QC runs/templates, lets
 * an operator start a DRAFT run per phase, tick required items, attach photo
 * evidence from the job's PHOTO documents, leave notes, complete the run and see
 * the PASSED/FAILED result + append-only ledger receipt.
 *
 * The backend returns 501 until backend-qc lands; that is rendered as a friendly
 * "not available yet" notice with retry, never a crash.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Image as ImageIcon,
  Plus,
  Receipt,
  XCircle,
} from 'lucide-react';
import Button from '../ui/Button';
import Card, { Badge } from '../ui/Card';
import Input from '../ui/Input';
import {
  PASSPORT_NOT_READY_MESSAGE,
  describePassportError,
  isPassportNotFoundError,
  isPassportNotReadyError,
  listJobPhotos,
  passportApi,
} from '../../services/passport';
import type {
  CompleteQcResponse,
  JobPhase,
  JobPhotoDocument,
  LedgerReceipt,
  QcItem,
  QcPatchBody,
  QcRun,
  QcStateResponse,
} from '../../types/passport';
import {
  PHASE_ORDER,
  clampScore,
  defaultQcPhase,
  formatDateTime,
  formatPercent,
  formatScore,
  latestRunsByPhase,
  ledgerKindLabel,
  phaseLabel,
  qcCompleteness,
  qcStatusBadgeVariant,
  qcStatusLabel,
  resolvePhotoUrl,
  templateForPhase,
} from './passportUtils';
import { PassportEmpty, PassportError, PassportNotice, SkeletonLines } from './PassportStates';

export interface QcPanelProps {
  jobId: string;
  /** Current job phase — used to preselect the phase. */
  jobPhase?: JobPhase;
  className?: string;
}

const EMPTY_RUNS: QcRun[] = [];

export const QcPanel: React.FC<QcPanelProps> = ({ jobId, jobPhase, className }) => {
  const queryClient = useQueryClient();

  const qcQuery = useQuery<QcStateResponse>({
    queryKey: ['job-qc', jobId],
    queryFn: () => passportApi.getQc(jobId),
    enabled: Boolean(jobId),
    retry: 0,
    staleTime: 30_000,
  });

  const photosQuery = useQuery<JobPhotoDocument[]>({
    queryKey: ['job-photos', jobId],
    queryFn: () => listJobPhotos(jobId),
    enabled: Boolean(jobId),
    retry: 1,
    staleTime: 60_000,
  });

  const [selectedPhase, setSelectedPhase] = useState<JobPhase | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, QcItem>>({});
  const [notesDraft, setNotesDraft] = useState('');
  const [photoPickerKey, setPhotoPickerKey] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Record<string, LedgerReceipt>>({});

  const runs = qcQuery.data?.data ?? EMPTY_RUNS;
  const templates = qcQuery.data?.templates ?? [];
  const summary = qcQuery.data?.summary;
  const photos = photosQuery.data ?? [];

  const runsByPhase = useMemo(() => latestRunsByPhase(runs), [runs]);
  const effectivePhase: JobPhase = selectedPhase ?? defaultQcPhase(jobPhase, runsByPhase);
  const run = runsByPhase[effectivePhase];
  const template = templateForPhase(templates, effectivePhase);
  const isDraft = run?.status === 'DRAFT';

  // Seed local editable drafts whenever the viewed run changes.
  useEffect(() => {
    if (!run) {
      setItemDrafts({});
      setNotesDraft('');
      return;
    }
    const drafts: Record<string, QcItem> = {};
    for (const item of run.items ?? []) drafts[item.key] = item;
    setItemDrafts(drafts);
    setNotesDraft(run.notes ?? '');
    setPhotoPickerKey(null);
  }, [run?.id]);

  const mergeRun = useCallback(
    (updated: QcRun) => {
      queryClient.setQueryData<QcStateResponse>(['job-qc', jobId], (previous) =>
        previous
          ? { ...previous, data: previous.data.map((entry) => (entry.id === updated.id ? updated : entry)) }
          : previous
      );
    },
    [jobId, queryClient]
  );

  const invalidateQc = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['job-qc', jobId] });
  }, [jobId, queryClient]);

  const createMutation = useMutation({
    mutationFn: (phase: JobPhase) => passportApi.createQc(jobId, phase),
    onSuccess: (created) => {
      setSelectedPhase(created.phase);
      toast.success(`${phaseLabel(created.phase)} QC run started`);
      invalidateQc();
    },
    onError: (error) => toast.error(describePassportError(error)),
  });

  const patchMutation = useMutation({
    mutationFn: ({ runId, body }: { runId: string; body: QcPatchBody }) =>
      passportApi.patchQc(jobId, runId, body),
    onSuccess: (updated) => {
      mergeRun(updated);
      invalidateQc();
    },
    onError: (error) => toast.error(describePassportError(error)),
  });

  const completeMutation = useMutation({
    mutationFn: ({ runId }: { runId: string }) =>
      passportApi.completeQc(jobId, runId, notesDraft.trim() ? { notes: notesDraft.trim() } : {}),
    onSuccess: (result: CompleteQcResponse) => {
      setReceipts((previous) => ({ ...previous, [result.run.id]: result.ledgerReceipt }));
      mergeRun(result.run);
      invalidateQc();
      toast.success(
        result.run.status === 'PASSED'
          ? 'QC passed — ledger receipt written'
          : 'QC completed with failures — ledger receipt written'
      );
    },
    onError: (error) => toast.error(describePassportError(error)),
  });

  // ── Editable items for the selected DRAFT run ────────────────────────────
  const items = useMemo<QcItem[]>(() => {
    if (!run) return [];
    return (run.items ?? []).map((item) => itemDrafts[item.key] ?? item);
  }, [run, itemDrafts]);

  const draftRun = useMemo<QcRun | null>(() => (run ? { ...run, items } : null), [run, items]);
  const completeness = useMemo(
    () => qcCompleteness(draftRun, template),
    [draftRun, template]
  );

  const patchDraftItem = (next: QcItem) => {
    setItemDrafts((previous) => ({ ...previous, [next.key]: next }));
    if (!run || run.status !== 'DRAFT') return;
    patchMutation.mutate({
      runId: run.id,
      body: {
        items: [
          {
            key: next.key,
            passed: Boolean(next.passed),
            note: next.note ?? undefined,
            photoUrls: next.photoUrls ?? [],
          },
        ],
      },
    });
  };

  const toggleItem = (item: QcItem) => {
    patchDraftItem({ ...item, passed: !item.passed });
  };

  const changeNote = (item: QcItem, note: string) => {
    setItemDrafts((previous) => ({ ...previous, [item.key]: { ...item, note } }));
  };

  const commitNote = (item: QcItem) => {
    patchDraftItem(itemDrafts[item.key] ?? item);
  };

  const togglePhoto = (item: QcItem, photoUrl: string) => {
    const current = item.photoUrls ?? [];
    const photoUrls = current.includes(photoUrl)
      ? current.filter((url) => url !== photoUrl)
      : [...current, photoUrl];
    patchDraftItem({ ...item, photoUrls });
  };

  const commitRunNotes = () => {
    if (!run || run.status !== 'DRAFT') return;
    if ((run.notes ?? '') === notesDraft) return;
    patchMutation.mutate({ runId: run.id, body: { notes: notesDraft } });
  };

  // ── Query states ─────────────────────────────────────────────────────────
  const renderError = () => {
    const error = qcQuery.error;
    if (!error) return null;
    if (isPassportNotReadyError(error)) {
      return (
        <PassportNotice
          title="QC checklists are not available on this deployment yet"
          tone="warning"
          action={
            <Button
              variant="secondary"
              size="md"
              className="min-h-11"
              onClick={() => void qcQuery.refetch()}
              isLoading={qcQuery.isFetching}
            >
              Retry
            </Button>
          }
        >
          <p>{PASSPORT_NOT_READY_MESSAGE}</p>
        </PassportNotice>
      );
    }
    return (
      <PassportError
        title={isPassportNotFoundError(error) ? 'Job not found' : 'Could not load QC runs'}
        message={describePassportError(error)}
        onRetry={() => void qcQuery.refetch()}
        isRetrying={qcQuery.isFetching}
      />
    );
  };

  // ── Checklist row ────────────────────────────────────────────────────────
  const renderDraftItem = (item: QcItem) => {
    const expanded = photoPickerKey === item.key;
    const attached = item.photoUrls ?? [];
    const missingPhoto = item.requiresPhoto && attached.length === 0;
    return (
      <li key={item.key} className="border border-border p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <label className="flex min-h-11 flex-1 cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={Boolean(item.passed)}
              onChange={() => toggleItem(item)}
              className="mt-1 h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`Mark "${item.label}" as ${item.passed ? 'not passed' : 'passed'}`}
            />
            <span>
              <span className="text-sm font-medium text-text-primary">{item.label}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                {item.required && (
                  <Badge variant="warning" size="sm">
                    Required
                  </Badge>
                )}
                {item.requiresPhoto && (
                  <Badge variant={attached.length ? 'success' : 'danger'} size="sm">
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon size={10} aria-hidden="true" />
                      {attached.length ? `${attached.length} photo${attached.length === 1 ? '' : 's'}` : 'Photo required'}
                    </span>
                  </Badge>
                )}
                {item.passed && (
                  <Badge variant="success" size="sm">
                    Passed
                  </Badge>
                )}
              </span>
            </span>
          </label>

          <Button
            variant="secondary"
            size="sm"
            className="min-h-11"
            leftIcon={<Camera size={14} />}
            onClick={() => setPhotoPickerKey(expanded ? null : item.key)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Attach'} photo evidence for "${item.label}"`}
          >
            {expanded ? 'Hide photos' : 'Photos'}
          </Button>
        </div>

        {expanded && (
          <div className="mt-3 border-t border-border pt-3">
            {photosQuery.isLoading ? (
              <SkeletonLines rows={1} label="Loading job photos…" />
            ) : photos.length === 0 ? (
              <p className="text-sm text-text-tertiary">
                No PHOTO documents on this job yet. Upload dated photos in the Documents tab, then
                attach them here as evidence.
              </p>
            ) : (
              <>
                <p className="eyebrow mb-2">Attach photo evidence</p>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {photos.map((photo) => {
                    const selected = attached.includes(photo.fileUrl);
                    return (
                      <li key={photo.id}>
                        <button
                          type="button"
                          onClick={() => togglePhoto(item, photo.fileUrl)}
                          aria-pressed={selected}
                          aria-label={`${selected ? 'Remove' : 'Attach'} photo ${photo.name}`}
                          className={clsx(
                            'flex min-h-11 w-full items-center gap-2 border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                            selected
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-border-hover'
                          )}
                        >
                          <img
                            src={resolvePhotoUrl(photo.fileUrl)}
                            alt=""
                            loading="lazy"
                            className="h-10 w-10 shrink-0 object-cover"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-text-primary">
                              {photo.name}
                            </span>
                            <span className="block text-[0.625rem] text-text-tertiary">
                              {selected ? 'Attached' : 'Tap to attach'}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {missingPhoto && (
              <p className="mt-2 text-xs text-[hsl(var(--amber))]" role="status">
                This item cannot pass without at least one photo.
              </p>
            )}
          </div>
        )}

        <div className="mt-3">
          <Input
            size="md"
            label="Note (optional)"
            value={item.note ?? ''}
            onChange={(event) => changeNote(item, event.target.value)}
            onBlur={() => commitNote(item)}
            placeholder="e.g. Storm damage on north slope documented"
          />
        </div>
      </li>
    );
  };

  const renderCompletedItem = (item: QcItem) => (
    <li key={item.key} className="flex items-start gap-2 border-b border-border py-2 last:border-b-0">
      {item.passed ? (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald" aria-hidden="true" />
      ) : (
        <XCircle size={16} className="mt-0.5 shrink-0 text-red" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="text-sm text-text-primary">
          {item.label}{' '}
          <span className="text-xs text-text-tertiary">{item.passed ? 'passed' : 'not passed'}</span>
        </p>
        {item.note && <p className="text-xs text-text-tertiary">{item.note}</p>}
        {item.photoUrls && item.photoUrls.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.photoUrls.map((url) => (
              <a
                key={url}
                href={resolvePhotoUrl(url)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center"
                aria-label="Open attached photo evidence"
              >
                <img
                  src={resolvePhotoUrl(url)}
                  alt=""
                  loading="lazy"
                  className="h-10 w-10 object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  );

  const renderReceipt = (targetRun: QcRun) => {
    const receipt = receipts[targetRun.id];
    return (
      <div className="mt-3 border border-border bg-[hsl(var(--background-elevated))] p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Receipt size={15} className="text-primary" aria-hidden="true" />
          Ledger receipt
        </p>
        {receipt ? (
          <dl className="mt-1 space-y-0.5 text-xs text-text-secondary">
            <div className="flex flex-wrap gap-2">
              <dt className="text-text-tertiary">Event</dt>
              <dd className="font-mono">{ledgerKindLabel(receipt.kind)}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="text-text-tertiary">Description</dt>
              <dd>{receipt.description}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="text-text-tertiary">Recorded</dt>
              <dd className="font-mono">{formatDateTime(receipt.createdAt)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-1 text-xs text-text-secondary">
            A receipt was written to the append-only field ledger when this run was completed.
            Reload the page to see the latest ledger metadata.
          </p>
        )}
      </div>
    );
  };

  const renderPhase = () => {
    // No run yet → template preview + start action
    if (!run) {
      return (
        <div className="space-y-4">
          <PassportEmpty
            icon={<ClipboardCheck size={26} />}
            title={`No ${phaseLabel(effectivePhase)} QC run yet`}
            description={`Start a ${phaseLabel(effectivePhase)} checklist from the approved SOP template. Required items and photo evidence must pass before the run can be signed off.`}
            action={
              <Button
                variant="primary"
                size="lg"
                className="min-h-11"
                leftIcon={<Plus size={16} />}
                onClick={() => createMutation.mutate(effectivePhase)}
                isLoading={createMutation.isPending}
              >
                Start {phaseLabel(effectivePhase)} QC
              </Button>
            }
          />
          {template && (
            <div className="border border-border p-3">
              <p className="eyebrow mb-2">Template preview</p>
              <ul className="space-y-1.5">
                {template.items.map((item) => (
                  <li key={item.key} className="flex flex-wrap items-center gap-2 text-sm">
                    <FileCheck2 size={13} className="text-text-tertiary" aria-hidden="true" />
                    <span className="text-text-primary">{item.label}</span>
                    {item.required && (
                      <Badge variant="warning" size="sm">
                        Required
                      </Badge>
                    )}
                    {item.requiresPhoto && (
                      <Badge variant="default" size="sm">
                        Photo
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    // Completed run → read-only result + receipt
    if (!isDraft) {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={qcStatusBadgeVariant(run.status)} size="md">
                {qcStatusLabel(run.status)}
              </Badge>
              <span className="stat-mono text-sm font-semibold text-text-primary">
                {formatScore(run.score)}
              </span>
              {run.completedAt && (
                <span className="text-xs text-text-tertiary">
                  Signed off {formatDateTime(run.completedAt)}
                </span>
              )}
            </div>
            <Button
              variant="secondary"
              size="md"
              className="min-h-11"
              leftIcon={<Plus size={14} />}
              onClick={() => createMutation.mutate(effectivePhase)}
              isLoading={createMutation.isPending}
            >
              Start a new run
            </Button>
          </div>

          {run.notes && (
            <p className="text-sm text-text-secondary">
              <span className="eyebrow">Notes:</span> {run.notes}
            </p>
          )}

          <ul className="border border-border px-3">{items.map(renderCompletedItem)}</ul>
          {renderReceipt(run)}
        </div>
      );
    }

    // Draft → editable checklist
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default" size="md">
              Draft
            </Badge>
            <span className="text-xs text-text-tertiary">
              Started {formatDateTime(run.createdAt)}
            </span>
            {patchMutation.isPending && (
              <span className="flex items-center gap-1 text-xs text-text-tertiary" role="status">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
                Saving…
              </span>
            )}
          </div>
          <span className="stat-mono text-xs text-text-secondary">
            {completeness.requiredPassed}/{completeness.requiredTotal} required ·{' '}
            {formatPercent(completeness.percent)}
          </span>
        </div>

        <ul className="space-y-2">{items.map(renderDraftItem)}</ul>

        <div>
          <label
            htmlFor={`qc-notes-${run.id}`}
            className="text-sm font-medium text-text-secondary"
          >
            Run notes (optional)
          </label>
          <textarea
            id={`qc-notes-${run.id}`}
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            onBlur={commitRunNotes}
            rows={2}
            placeholder="Summary of findings for this phase"
            className="mt-1 w-full border border-border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="text-xs text-text-secondary" role="status">
            {completeness.complete ? (
              <span className="flex items-center gap-1.5 text-emerald">
                <CheckCircle2 size={14} aria-hidden="true" />
                All required items pass with photo evidence.
              </span>
            ) : (
              <span>
                {completeness.missingRequired.length > 0
                  ? `${completeness.missingRequired.length} required item${
                      completeness.missingRequired.length === 1 ? '' : 's'
                    } still open.`
                  : 'Add the required items to complete this run.'}
                {completeness.photoRequiredTotal > completeness.photoSatisfied
                  ? ` Photo evidence missing on ${
                      completeness.photoRequiredTotal - completeness.photoSatisfied
                    } item${
                      completeness.photoRequiredTotal - completeness.photoSatisfied === 1 ? '' : 's'
                    }.`
                  : ''}
              </span>
            )}
          </div>
          <Button
            variant="primary"
            size="lg"
            className="min-h-11"
            leftIcon={<FileCheck2 size={16} />}
            onClick={() => completeMutation.mutate({ runId: run.id })}
            isLoading={completeMutation.isPending}
            aria-label={`Complete ${phaseLabel(effectivePhase)} QC run`}
          >
            Complete QC
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card
      title="Install QC"
      subtitle="Phase checklists, photo evidence and a signed ledger receipt"
      className={className}
      role="region"
      aria-label="Install QC"
    >
      {qcQuery.isLoading ? (
        <div className="space-y-3">
          <SkeletonLines rows={2} label="Loading QC runs…" />
          <SkeletonLines rows={4} label="Loading QC checklist…" />
        </div>
      ) : qcQuery.error ? (
        renderError()
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
              <span className="eyebrow">QC progress</span>
              <span className="stat-mono">
                {summary?.passedRuns ?? 0}/{summary?.totalRuns ?? runs.length} runs passed ·{' '}
                {formatPercent(summary?.percent ?? 0)}
              </span>
            </div>
            <div
              className="mt-1 h-2 w-full overflow-hidden bg-[hsl(var(--background-accent))]"
              role="progressbar"
              aria-label="QC runs passed"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={clampScore(summary?.percent ?? 0)}
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${clampScore(summary?.percent ?? 0)}%` }}
              />
            </div>
          </div>

          {/* Phase selector */}
          <div role="tablist" aria-label="QC phases" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {PHASE_ORDER.map((phase) => {
              const phaseRun = runsByPhase[phase];
              const active = phase === effectivePhase;
              return (
                <button
                  key={phase}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedPhase(phase)}
                  className={clsx(
                    'flex min-h-11 flex-col items-start gap-1 border px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    active
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-border-hover'
                  )}
                >
                  <span className="text-xs font-medium text-text-primary">{phaseLabel(phase)}</span>
                  <span className="flex items-center gap-1.5">
                    <Badge variant={phaseRun ? qcStatusBadgeVariant(phaseRun.status) : 'default'} size="sm">
                      {phaseRun ? qcStatusLabel(phaseRun.status) : 'No run'}
                    </Badge>
                    {phaseRun && (
                      <span className="stat-mono text-[0.625rem] text-text-tertiary">
                        {clampScore(phaseRun.score)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div role="tabpanel" aria-label={`${phaseLabel(effectivePhase)} QC run`}>
            {renderPhase()}
          </div>
        </div>
      )}
    </Card>
  );
};

export default QcPanel;
