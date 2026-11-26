/**
 * PassportPanel — Job Passport publication controls (admin).
 *
 * Contract: docs/SPRINT_10_QC_PASSPORT.md §6–§7. Shows publication state, lets an
 * OWNER/MANAGER choose privacy (EXACT / STREET_ONLY / HIDDEN), write the public
 * headline + summary, pick a hero photo, publish/update (new frozen snapshot +
 * version), save settings, unpublish, copy the public link and render a QR code
 * client-side with the existing `qrcode` package. Read-only for other roles.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';
import QRCode from 'qrcode';
import {
  Check,
  ExternalLink,
  GitBranch,
  Image as ImageIcon,
  Link2,
  Lock,
  Printer,
  QrCode as QrCodeIcon,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import Button from '../ui/Button';
import Card, { Badge } from '../ui/Card';
import Input from '../ui/Input';
import { useAuthStore, hasRole } from '../../stores/authStore';
import {
  PASSPORT_NOT_READY_MESSAGE,
  describePassportError,
  isPassportNotFoundError,
  isPassportNotReadyError,
  listJobPhotos,
  passportApi,
} from '../../services/passport';
import type {
  GetPassportResponse,
  JobPassport,
  JobPhotoDocument,
  PassportPrivacy,
  PublishPassportBody,
} from '../../types/passport';
import {
  PRIVACY_OPTIONS,
  buildPublicUrl,
  formatDateTime,
  isPassportAdmin,
  isPassportPublished,
  privacyDescription,
  privacyLabel,
  publicPathFor,
  resolvePhotoUrl,
  shortDigest,
} from './passportUtils';
import { PassportEmpty, PassportError, PassportNotice, SkeletonLines } from './PassportStates';

export interface PassportPanelProps {
  jobId: string;
  className?: string;
}

const DEFAULT_PRIVACY: PassportPrivacy = 'STREET_ONLY';

export const PassportPanel: React.FC<PassportPanelProps> = ({ jobId, className }) => {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.user?.role);
  const canMutate = isPassportAdmin(role) || hasRole(['OWNER', 'MANAGER']);

  const passportQuery = useQuery<GetPassportResponse>({
    queryKey: ['job-passport', jobId],
    queryFn: () => passportApi.getPassport(jobId),
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

  const passport = passportQuery.data?.passport ?? null;
  const photos = photosQuery.data ?? [];

  const [privacy, setPrivacy] = useState<PassportPrivacy>(DEFAULT_PRIVACY);
  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [heroPhotoUrl, setHeroPhotoUrl] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);

  // Sync the form with the latest server record.
  useEffect(() => {
    if (!passport) return;
    setPrivacy(passport.privacy ?? DEFAULT_PRIVACY);
    setHeadline(passport.headline ?? '');
    setSummary(passport.summary ?? '');
    setHeroPhotoUrl(passport.heroPhotoUrl ?? '');
  }, [passport?.id, passport?.updatedAt]);

  const publicPath =
    passportQuery.data?.publicPath ?? (passport?.enabled ? publicPathFor(passport.slug) : null);
  const absolutePublicUrl =
    passport?.enabled && passport?.slug ? buildPublicUrl(passport.slug) : null;

  // Client-side QR (no network) — graceful when unavailable (e.g. no canvas).
  useEffect(() => {
    let cancelled = false;
    if (!absolutePublicUrl) {
      setQrDataUrl(null);
      setQrFailed(false);
      return undefined;
    }
    QRCode.toDataURL(absolutePublicUrl, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#17231d', light: '#f1f2ea' },
    })
      .then((url: string) => {
        if (cancelled) return;
        setQrDataUrl(url);
        setQrFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setQrDataUrl(null);
        setQrFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [absolutePublicUrl]);

  const writeCache = useCallback(
    (nextPassport: JobPassport, nextPublicPath: string | null) => {
      queryClient.setQueryData<GetPassportResponse>(['job-passport', jobId], {
        passport: nextPassport,
        publicPath: nextPublicPath,
      });
    },
    [jobId, queryClient]
  );

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['job-passport', jobId] });
  }, [jobId, queryClient]);

  const publishMutation = useMutation({
    mutationFn: (body: PublishPassportBody) => passportApi.publishPassport(jobId, body),
    onSuccess: (result) => {
      writeCache(result.passport, result.publicPath);
      invalidate();
      setFormError(null);
      toast.success(
        `Job Passport published — version ${result.passport.version}, digest ${shortDigest(
          result.contentDigest,
          8
        )}`
      );
    },
    onError: (error) => {
      const message = describePassportError(error);
      setFormError(message);
      toast.error(message);
    },
  });

  const patchMutation = useMutation({
    mutationFn: (body: {
      privacy?: PassportPrivacy;
      headline?: string;
      summary?: string;
      heroPhotoUrl?: string | null;
    }) => passportApi.patchPassport(jobId, body),
    onSuccess: (updated) => {
      writeCache(updated, updated.enabled ? publicPathFor(updated.slug) : null);
      invalidate();
      setFormError(null);
      toast.success('Passport settings saved');
    },
    onError: (error) => {
      const message = describePassportError(error);
      setFormError(message);
      toast.error(message);
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: () => passportApi.unpublishPassport(jobId),
    onSuccess: () => {
      setConfirmUnpublish(false);
      invalidate();
      toast.success('Job Passport unpublished');
    },
    onError: (error) => toast.error(describePassportError(error)),
  });

  const isSaving = publishMutation.isPending || patchMutation.isPending;
  const isPublished = Boolean(passport?.enabled);

  const formBody = useMemo(
    () => ({
      privacy,
      headline: headline.trim(),
      summary: summary.trim(),
      heroPhotoUrl: heroPhotoUrl || null,
    }),
    [privacy, headline, summary, heroPhotoUrl]
  );

  const handlePublish = () => {
    if (!headline.trim()) {
      setFormError('Add a public headline before publishing — it is the title homeowners see.');
      return;
    }
    setFormError(null);
    publishMutation.mutate(formBody);
  };

  const handleSaveSettings = () => {
    setFormError(null);
    patchMutation.mutate(formBody);
  };

  const handleCopy = async () => {
    if (!absolutePublicUrl) return;
    if (!navigator.clipboard?.writeText) {
      toast.error('Clipboard is not available in this browser');
      return;
    }
    try {
      await navigator.clipboard.writeText(absolutePublicUrl);
      setCopied(true);
      toast.success('Public link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const renderBody = () => {
    if (passportQuery.isLoading) {
      return (
        <div className="space-y-3">
          <SkeletonLines rows={2} label="Loading Job Passport…" />
          <SkeletonLines rows={4} label="Loading publication settings…" />
        </div>
      );
    }

    if (passportQuery.error) {
      if (isPassportNotReadyError(passportQuery.error)) {
        return (
          <PassportNotice
            title="Job Passport is not available on this deployment yet"
            tone="warning"
            action={
              <Button
                variant="secondary"
                size="md"
                className="min-h-11"
                onClick={() => void passportQuery.refetch()}
                isLoading={passportQuery.isFetching}
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
          title={isPassportNotFoundError(passportQuery.error) ? 'Job not found' : 'Could not load the Job Passport'}
          message={describePassportError(passportQuery.error)}
          onRetry={() => void passportQuery.refetch()}
          isRetrying={passportQuery.isFetching}
        />
      );
    }

    // No passport record yet and the viewer cannot publish.
    if (!passport && !canMutate) {
      return (
        <PassportEmpty
          icon={<Lock size={24} />}
          title="No Job Passport yet"
          description="An owner or manager can publish a public, privacy-safe job record from this tab."
        />
      );
    }

    return (
      <div className="space-y-5">
        {/* Status line */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isPublished ? 'success' : passport ? 'default' : 'info'} size="md">
              {isPublished ? 'Published' : passport ? 'Unpublished' : 'Not created'}
            </Badge>
            {passport && (
              <span className="stat-mono text-xs text-text-secondary">
                v{passport.version} · {isPassportPublished(passport) ? 'live' : 'private'}
              </span>
            )}
            {!canMutate && (
              <Badge variant="default" size="sm">
                Read-only · owner/manager can edit
              </Badge>
            )}
          </div>
          {passport?.publishedAt && (
            <span className="text-xs text-text-tertiary">
              Last published {formatDateTime(passport.publishedAt)}
            </span>
          )}
        </div>

        {/* Privacy */}
        <div>
          <label htmlFor="passport-privacy" className="text-sm font-medium text-text-secondary">
            Address privacy
          </label>
          <select
            id="passport-privacy"
            value={privacy}
            onChange={(event) => setPrivacy(event.target.value as PassportPrivacy)}
            disabled={!canMutate || isSaving}
            className="mt-1 min-h-11 w-full border border-border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 sm:max-w-sm"
            aria-describedby="passport-privacy-help"
          >
            {PRIVACY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p id="passport-privacy-help" className="mt-1 text-xs text-text-tertiary">
            {privacyDescription(privacy)}
          </p>
        </div>

        {/* Headline + summary */}
        <Input
          label="Public headline"
          value={headline}
          onChange={(event) => {
            setHeadline(event.target.value);
            if (formError) setFormError(null);
          }}
          maxLength={140}
          disabled={!canMutate || isSaving}
          placeholder="e.g. Full roof replacement — Heritage Park, McKinney"
          helperText={`${headline.length}/140 characters · required to publish`}
        />

        <div>
          <label htmlFor="passport-summary" className="text-sm font-medium text-text-secondary">
            Public summary (optional)
          </label>
          <textarea
            id="passport-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            maxLength={500}
            rows={3}
            disabled={!canMutate || isSaving}
            placeholder="What the crew installed, materials used, and the outcome homeowners can expect."
            className="mt-1 w-full border border-border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
            aria-describedby="passport-summary-help"
          />
          <p id="passport-summary-help" className="mt-1 text-xs text-text-tertiary">
            {summary.length}/500 characters. Customer names, notes and internal IDs are never shown.
          </p>
        </div>

        {/* Hero photo */}
        <fieldset>
          <legend className="text-sm font-medium text-text-secondary">Hero photo (optional)</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setHeroPhotoUrl('')}
              disabled={!canMutate || isSaving}
              aria-pressed={heroPhotoUrl === ''}
              className={clsx(
                'flex min-h-11 flex-col items-center justify-center gap-1 border p-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60',
                heroPhotoUrl === ''
                  ? 'border-primary bg-primary/10 text-text-primary'
                  : 'border-border text-text-secondary hover:border-border-hover'
              )}
            >
              <ImageIcon size={18} aria-hidden="true" />
              No hero photo
            </button>
            {photos.map((photo) => {
              const selected = heroPhotoUrl === photo.fileUrl;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setHeroPhotoUrl(photo.fileUrl)}
                  disabled={!canMutate || isSaving}
                  aria-pressed={selected}
                  aria-label={`Use photo ${photo.name} as the public hero`}
                  className={clsx(
                    'flex min-h-11 flex-col overflow-hidden border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60',
                    selected ? 'border-primary' : 'border-border hover:border-border-hover'
                  )}
                >
                  <img
                    src={resolvePhotoUrl(photo.fileUrl)}
                    alt=""
                    loading="lazy"
                    className="h-16 w-full object-cover"
                  />
                  <span className="flex items-center gap-1 p-1.5 text-[0.625rem] text-text-secondary">
                    {selected && <Check size={10} aria-hidden="true" />}
                    <span className="truncate">{photo.name}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {photosQuery.isLoading && <p className="mt-1 text-xs text-text-tertiary">Loading job photos…</p>}
          {!photosQuery.isLoading && photos.length === 0 && (
            <p className="mt-1 text-xs text-text-tertiary">
              No PHOTO documents on this job yet — you can still publish without a hero photo.
            </p>
          )}
        </fieldset>

        {formError && (
          <p role="alert" className="border-l-2 border-[hsl(var(--red))] bg-[hsl(var(--red))]/10 px-3 py-2 text-sm text-red">
            {formError}
          </p>
        )}

        {/* Actions */}
        {canMutate && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button
              variant="primary"
              size="lg"
              className="min-h-11"
              leftIcon={isPublished ? <GitBranch size={16} /> : <UploadCloud size={16} />}
              onClick={handlePublish}
              isLoading={publishMutation.isPending}
              disabled={isSaving}
            >
              {isPublished ? 'Publish new version' : 'Publish passport'}
            </Button>
            {isPublished && (
              <Button
                variant="secondary"
                size="lg"
                className="min-h-11"
                onClick={handleSaveSettings}
                isLoading={patchMutation.isPending}
                disabled={isSaving}
              >
                Save settings
              </Button>
            )}
            {isPublished && !confirmUnpublish && (
              <Button
                variant="outline"
                size="lg"
                className="min-h-11"
                onClick={() => setConfirmUnpublish(true)}
                disabled={isSaving}
              >
                Unpublish
              </Button>
            )}
            {isPublished && confirmUnpublish && (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-text-secondary">Hide this record immediately?</span>
                <Button
                  variant="danger"
                  size="md"
                  className="min-h-11"
                  onClick={() => unpublishMutation.mutate()}
                  isLoading={unpublishMutation.isPending}
                >
                  Yes, unpublish
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  className="min-h-11"
                  onClick={() => setConfirmUnpublish(false)}
                  disabled={unpublishMutation.isPending}
                >
                  Cancel
                </Button>
              </span>
            )}
          </div>
        )}

        {/* Public link + QR */}
        {isPublished && publicPath && absolutePublicUrl ? (
          <div className="border border-border bg-[hsl(var(--background-elevated))] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <p className="eyebrow">Public record</p>
                <p className="break-all font-mono text-sm text-text-primary">{absolutePublicUrl}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="md"
                    className="min-h-11"
                    leftIcon={copied ? <Check size={14} /> : <Link2 size={14} />}
                    onClick={handleCopy}
                    aria-label="Copy public Job Passport link"
                  >
                    {copied ? 'Copied' : 'Copy link'}
                  </Button>
                  <a
                    href={publicPath}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 border border-border px-4 text-sm font-medium text-text-primary transition-colors hover:bg-[hsl(var(--background-accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    Open public page
                  </a>
                  <a
                    href={publicPath}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 border border-border px-4 text-sm font-medium text-text-primary transition-colors hover:bg-[hsl(var(--background-accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Printer size={14} aria-hidden="true" />
                    Print view
                  </a>
                </div>
              </div>

              <div className="shrink-0 text-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR code linking to this Job Passport"
                    className="h-32 w-32 border border-border bg-parchment p-1"
                    width={128}
                    height={128}
                  />
                ) : qrFailed ? (
                  <p className="max-w-[8rem] text-xs text-text-tertiary">
                    QR code unavailable in this browser.
                  </p>
                ) : (
                  <div
                    className="flex h-32 w-32 items-center justify-center border border-dashed border-border"
                    role="status"
                    aria-label="Generating QR code"
                  >
                    <QrCodeIcon size={28} className="animate-pulse text-text-tertiary" aria-hidden="true" />
                  </div>
                )}
                <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-text-tertiary">
                  Scan to verify
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Version / digest metadata */}
        {passport && (
          <div className="grid gap-2 border-t border-border pt-3 text-xs text-text-secondary sm:grid-cols-2">
            <p className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Version</span>
              <span className="stat-mono">v{passport.version}</span>
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Content digest</span>
              <code
                className="stat-mono text-text-primary"
                title={passport.contentDigest ?? undefined}
              >
                {shortDigest(passport.contentDigest, 16)}
              </code>
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Privacy</span>
              <span>{privacyLabel(passport.privacy)}</span>
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Unpublished</span>
              <span>{formatDateTime(passport.unpublishedAt)}</span>
            </p>
          </div>
        )}

        <p className="flex items-start gap-2 border-t border-border pt-3 text-xs text-text-tertiary">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald" aria-hidden="true" />
          Published snapshots are frozen with a SHA-256 content digest. Publishing again creates a
          new version; unpublishing hides the public page immediately. Every publish writes an
          append-only ledger receipt.
        </p>
      </div>
    );
  };

  return (
    <Card
      title="Job Passport"
      subtitle="Opt-in public job record with a frozen, privacy-safe snapshot"
      className={className}
      role="region"
      aria-label="Job Passport"
    >
      {renderBody()}
    </Card>
  );
};

export default PassportPanel;
