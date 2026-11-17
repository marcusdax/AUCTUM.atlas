/**
 * LeadImpactCard — storm impact panel for a selected lead or map location.
 *
 * `POST /ai/lead-insights` explains the deterministic score for a lead. When AI is
 * offline (501 / gateway down / role denied) this card degrades to the deterministic
 * `GET /storm-intel/impact` score for the lead's property coordinates (or the clicked
 * map point), so the panel always renders useful numbers.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  Copy,
  MapPin,
  Quote,
  Radar,
  RefreshCw,
  Target,
  WifiOff,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Card, { Badge } from '../ui/Card';
import Button from '../ui/Button';
import { api } from '../../services/api';
import { aiApi, describeAiError, isAiOfflineError } from '../../services/ai';
import type { LeadInsightResponse } from '../../types/ai';
import {
  clampScore,
  formatGeneratedAt,
  formatLatLng,
  impactToView,
  leadCoordinatesFromPayload,
  leadInsightToView,
  severityBadgeTone,
  type LeadImpactView,
} from './aiUtils';
import { EmptyState, PanelError, RiskGauge, SkeletonLines, SourceBadge } from './primitives';

export interface LeadImpactCardProps {
  /** Selected lead (drives POST /ai/lead-insights). */
  leadId?: string | null;
  /** Selected map point (drives GET /storm-intel/impact). */
  point?: { lat: number; lng: number } | null;
  /** False when AI status is unreachable — deterministic scoring still renders. */
  enabled?: boolean;
  className?: string;
  onClear?: () => void;
}

export const LeadImpactCard: React.FC<LeadImpactCardProps> = ({
  leadId,
  point,
  enabled = true,
  className,
  onClear,
}) => {
  const [copied, setCopied] = useState(false);
  const canUseAi = enabled !== false;

  // ── AI explanation for a selected lead ──────────────────────────────────
  const insight = useQuery<LeadInsightResponse>({
    queryKey: ['ai', 'lead-insight', leadId ?? 'none'],
    queryFn: () => aiApi.leadInsights(leadId as string),
    enabled: Boolean(leadId) && canUseAi,
    retry: 0,
    staleTime: 2 * 60_000,
  });

  const insightFailed = Boolean(leadId) && canUseAi && insight.isError;
  const aiOffline = insightFailed && isAiOfflineError(insight.error);
  const needsDeterministic = Boolean(leadId) && (!canUseAi || insightFailed);

  // ── Deterministic fallback: lead coordinates → /storm-intel/impact ──────
  const leadQuery = useQuery({
    queryKey: ['lead', leadId ?? 'none'],
    queryFn: () => api.get(`/leads/${leadId}`).then((res) => res.data),
    enabled: needsDeterministic,
    retry: 1,
    staleTime: 60_000,
  });

  const leadCoords = useMemo(() => leadCoordinatesFromPayload(leadQuery.data), [leadQuery.data]);
  const impactPoint = point ?? leadCoords;

  const impact = useQuery({
    queryKey: ['storm-intel', 'impact', impactPoint?.lat, impactPoint?.lng],
    queryFn: () => aiApi.impact(impactPoint!.lat, impactPoint!.lng),
    enabled: Boolean(impactPoint) && (needsDeterministic || !leadId),
    retry: 1,
    staleTime: 60_000,
  });

  const aiView = insight.data ? leadInsightToView(insight.data) : null;
  const deterministicView = impact.data ? impactToView(impact.data) : null;
  const view: LeadImpactView | null = aiView ?? deterministicView;

  const hasSelection = Boolean(leadId) || Boolean(point);
  const awaitingAi = Boolean(leadId) && canUseAi && insight.isLoading;
  const awaitingDeterministic =
    !awaitingAi &&
    !aiView &&
    (needsDeterministic || (!leadId && Boolean(point))) &&
    (leadQuery.isLoading || impact.isLoading);
  const leadHasNoCoords =
    needsDeterministic && !leadQuery.isLoading && !leadQuery.isError && !impactPoint;

  const retryAll = useCallback(() => {
    if (leadId) void insight.refetch();
    if (needsDeterministic) {
      void leadQuery.refetch();
      void impact.refetch();
    }
  }, [insight, impact, leadId, leadQuery, needsDeterministic]);

  const copyTalkTrack = async () => {
    const text = view?.talkTrack;
    if (!text) return;
    if (!navigator.clipboard?.writeText) {
      toast.error('Clipboard is not available in this browser');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Talk track copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy talk track');
    }
  };

  const renderView = (data: LeadImpactView, deterministic: boolean) => (
    <div className="space-y-4">
      {/* Score + summary */}
      <div className="flex flex-wrap items-start gap-4">
        <RiskGauge score={data.score} size="sm" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={severityBadgeTone(data.severityText)}>
              {data.severityText} impact
            </Badge>
            <span className="text-xs font-medium text-text-secondary">
              {data.score} / 100 storm impact
            </span>
          </div>
          {data.explanation && (
            <p className="text-sm text-text-secondary">{data.explanation}</p>
          )}
          {deterministic && !data.explanation && (
            <p className="text-sm text-text-secondary">
              Deterministic geo score — polygon containment and distance decay against active NOAA
              alerts. No AI provider required.
            </p>
          )}
        </div>
      </div>

      {/* Drivers */}
      <section aria-labelledby="lead-impact-drivers">
        <h4
          id="lead-impact-drivers"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary"
        >
          Risk drivers
        </h4>
        {data.drivers.length > 0 ? (
          <ul className="space-y-2">
            {data.drivers.map((driver) => (
              <li key={`${driver.label}-${driver.weight}`}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-text-secondary">{driver.label}</span>
                  <span className="font-semibold text-text-primary">{clampScore(driver.weight)}</span>
                </div>
                <div
                  className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--background-accent))]"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${clampScore(driver.weight)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-text-tertiary">No individual risk drivers were reported.</p>
        )}
      </section>

      {/* Next best action */}
      {data.nextBestAction && (
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <h4 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
            <Target size={15} className="text-primary" aria-hidden="true" />
            Next best action
          </h4>
          <p className="text-sm text-text-primary">{data.nextBestAction}</p>
        </section>
      )}

      {/* AI-offline recommendations (deterministic) */}
      {data.recommendations.length > 0 && (
        <section aria-labelledby="lead-impact-recommendations">
          <h4
            id="lead-impact-recommendations"
            className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary"
          >
            Recommended follow-up
          </h4>
          <ol className="list-inside list-decimal space-y-1 text-sm text-text-secondary">
            {data.recommendations.map((recommendation) => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ol>
        </section>
      )}

      {/* Talk track */}
      {data.talkTrack && (
        <section aria-labelledby="lead-impact-talk-track">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h4
              id="lead-impact-talk-track"
              className="flex items-center gap-1.5 text-sm font-semibold text-text-primary"
            >
              <Quote size={15} className="text-primary" aria-hidden="true" />
              Talk track
            </h4>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              leftIcon={<Copy size={14} />}
              onClick={copyTalkTrack}
              aria-label="Copy talk track to clipboard"
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <blockquote className="rounded-lg border-l-2 border-primary bg-[hsl(var(--background-accent))]/60 p-3 text-sm italic text-text-secondary">
            “{data.talkTrack}”
          </blockquote>
        </section>
      )}

      {/* Risk flags */}
      {data.riskFlags.length > 0 && (
        <section aria-labelledby="lead-impact-flags">
          <h4
            id="lead-impact-flags"
            className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary"
          >
            Risk flags
          </h4>
          <ul className="flex flex-wrap gap-1.5">
            {data.riskFlags.map((flag) => (
              <li key={flag}>
                <Badge variant="warning" size="sm">
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle size={11} aria-hidden="true" />
                    {flag}
                  </span>
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Nearby events */}
      {data.nearbyEvents.length > 0 && (
        <section aria-labelledby="lead-impact-nearby">
          <h4
            id="lead-impact-nearby"
            className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-tertiary"
          >
            <Radar size={13} aria-hidden="true" />
            Nearby storm events
          </h4>
          <ul className="divide-y divide-border">
            {data.nearbyEvents.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span className="min-w-0 truncate text-text-primary">{event.name}</span>
                <span className="shrink-0 text-xs text-text-tertiary">
                  {event.distanceKm.toFixed(1)} km · {event.severity}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[0.6875rem] text-text-tertiary">
        {data.generatedAt && <span>Generated {formatGeneratedAt(data.generatedAt)}</span>}
        {data.sourceLabel && <span>{data.sourceLabel}</span>}
        {!deterministic && insight.data?.latencyMs != null && (
          <span>{Math.round(insight.data.latencyMs)}ms</span>
        )}
      </footer>
    </div>
  );

  const subtitle = leadId
    ? `Lead ${leadId.slice(0, 8)}…`
    : point
      ? formatLatLng(point.lat, point.lng)
      : 'Select a lead or click the map';

  return (
    <Card
      className={clsx('flex flex-col', className)}
      role="region"
      aria-label="Lead storm impact"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--background-accent))] text-primary"
            aria-hidden="true"
          >
            <MapPin size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Lead Storm Impact</h2>
            <p className="text-xs text-text-tertiary">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {aiView && insight.data && (
            <SourceBadge
              source={insight.data.source}
              model={insight.data.model}
              fallback={!aiView || aiView.deterministic}
            />
          )}
          {deterministicView && !aiView && (
            <Badge variant="info" size="sm">
              Deterministic engine
            </Badge>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-tertiary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Close lead impact panel"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3">
        {!hasSelection && (
          <EmptyState
            icon={<MapPin size={22} />}
            title="Pick a property"
            description="Select a lead from the storm-affected list, deep-link with ?leadId=…, or click anywhere on the map to score that location against active alerts."
          />
        )}

        {hasSelection && awaitingAi && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-20 w-20 animate-pulse rounded-full bg-[hsl(var(--background-accent))]" />
              <div className="flex-1">
                <SkeletonLines rows={2} label="Explaining storm impact…" />
              </div>
            </div>
            <SkeletonLines rows={3} label="Loading lead storm impact…" />
          </div>
        )}

        {hasSelection && !awaitingAi && aiView && renderView(aiView, false)}

        {hasSelection && !awaitingAi && !aiView && (
          <div className="space-y-3">
            {insightFailed && (
              <PanelError
                offline={aiOffline}
                message={describeAiError(insight.error)}
                onRetry={retryAll}
                isRetrying={insight.isFetching}
              />
            )}

            {!insightFailed && !canUseAi && (
              <p className="flex items-start gap-2 rounded-lg border border-border bg-[hsl(var(--background-accent))]/60 p-2 text-xs text-text-tertiary" role="status">
                <WifiOff size={14} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" />
                AI offline — showing deterministic impact scoring (works without a provider).
              </p>
            )}

            {awaitingDeterministic && (
              <SkeletonLines rows={3} label="Computing deterministic storm impact…" />
            )}

            {!awaitingDeterministic && deterministicView && renderView(deterministicView, true)}

            {!awaitingDeterministic && !deterministicView && leadHasNoCoords && (
              <EmptyState
                icon={<MapPin size={22} />}
                title="No property location"
                description="This lead has no map coordinates, so it cannot be scored against storm polygons. Click the map to score a location instead."
                action={
                  <Button
                    variant="secondary"
                    size="md"
                    className="min-h-11"
                    leftIcon={<RefreshCw size={14} />}
                    onClick={retryAll}
                  >
                    Retry
                  </Button>
                }
              />
            )}

            {!awaitingDeterministic && !deterministicView && !leadHasNoCoords && impact.isError && (
              <PanelError
                offline={isAiOfflineError(impact.error)}
                message={describeAiError(impact.error)}
                onRetry={retryAll}
                isRetrying={impact.isFetching}
              />
            )}

            {!awaitingDeterministic &&
              !deterministicView &&
              !leadHasNoCoords &&
              !impact.isError &&
              !insightFailed &&
              !view && (
                <EmptyState
                  icon={<MapPin size={22} />}
                  title="No impact data"
                  description="No active storm impact was detected for this location. Select another lead or click elsewhere on the map."
                />
              )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default LeadImpactCard;
