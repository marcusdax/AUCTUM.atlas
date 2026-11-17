/**
 * StormBriefCard — AI Storm Intelligence brief for the Storm Tracking page.
 *
 * Contract §6.3: generate/refresh, skeleton loading, retryable error, source badge
 * ("AI · <model>" vs "Offline engine"), risk gauge with NUMBER + TEXT label,
 * severity badge, damage chips, numbered action checklist, lead-opportunity rows,
 * safety notes and generatedAt. AI-offline is a first-class state, never a crash.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import Card, { Badge } from '../ui/Card';
import Button from '../ui/Button';
import { aiApi, describeAiError, isAiOfflineError } from '../../services/ai';
import type { StormBriefFocus, StormBriefResponse } from '../../types/ai';
import {
  formatCount,
  formatGeneratedAt,
  priorityTone,
  severityBadgeTone,
  severityLabel,
  clampScore,
} from './aiUtils';
import { EmptyState, PanelError, RiskGauge, SkeletonLines, SourceBadge } from './primitives';

export interface StormBriefCardProps {
  /** False when the AI status endpoint is unreachable — renders the offline state. */
  enabled?: boolean;
  focus?: StormBriefFocus;
  stormIds?: string[];
  className?: string;
  onBriefLoaded?: (response: StormBriefResponse) => void;
}

export const StormBriefCard: React.FC<StormBriefCardProps> = ({
  enabled = true,
  focus,
  stormIds,
  className,
  onBriefLoaded,
}) => {
  const [checkedActions, setCheckedActions] = useState<Set<number>>(new Set());
  const loadedRef = useRef(onBriefLoaded);
  loadedRef.current = onBriefLoaded;

  const stormKey = (stormIds ?? []).join('|');
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ai', 'storm-brief', focus ?? 'all', stormKey],
    queryFn: () =>
      aiApi.stormBrief({
        focus,
        stormIds: stormIds && stormIds.length ? stormIds : undefined,
      }),
    enabled,
    retry: 0,
    staleTime: 3 * 60_000,
  });

  useEffect(() => {
    if (data) loadedRef.current?.(data);
    setCheckedActions(new Set());
  }, [data]);

  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const toggleAction = (index: number) => {
    setCheckedActions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const offline = !!error && isAiOfflineError(error);
  const generatedAt = formatGeneratedAt(data?.generatedAt);

  return (
    <Card
      className={clsx('flex flex-col', className)}
      role="region"
      aria-label="Storm intelligence brief"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--background-accent))] text-primary"
            aria-hidden="true"
          >
            <Sparkles size={18} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Storm Intelligence Brief</h2>
            <p className="text-xs text-text-tertiary">
              {generatedAt
                ? `Generated ${generatedAt}`
                : 'Turns live NOAA alerts and your company leads into a prioritized plan.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data && (
            <SourceBadge source={data.source} model={data.model} fallback={data.fallback} />
          )}
          <Button
            variant="secondary"
            size="md"
            className="min-h-11 min-w-11"
            leftIcon={<RefreshCw size={16} className={isFetching ? 'animate-spin' : undefined} />}
            onClick={retry}
            isLoading={isFetching && !isLoading}
            aria-label="Refresh storm intelligence brief"
          >
            {data ? 'Refresh' : 'Generate'}
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {/* Offline (AI status unreachable) */}
        {!enabled && (
          <PanelError
            offline
            message="AI is offline right now. Active NOAA storm alerts, the map and deterministic impact scoring still work — try refreshing the page once the gateway is back."
          />
        )}

        {/* Loading */}
        {enabled && isLoading && (
          <div className="space-y-3">
            <SkeletonLines rows={2} label="Generating storm intelligence brief…" />
            <div className="grid gap-3 sm:grid-cols-[auto,1fr]">
              <div className="h-28 w-28 animate-pulse rounded-full bg-[hsl(var(--background-accent))]" />
              <div className="space-y-2">
                <SkeletonLines rows={3} label="Loading brief details…" />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {enabled && !isLoading && error && (
          <PanelError
            offline={offline}
            message={describeAiError(error)}
            onRetry={retry}
            isRetrying={isFetching}
          />
        )}

        {/* Empty (no brief data returned) */}
        {enabled && !isLoading && !error && !data?.brief && (
          <EmptyState
            icon={<ClipboardList size={22} />}
            title="No brief yet"
            description="The brief summarizes live NOAA alerts for your area together with your company's open leads and jobs. Generate one to see damage types, safety notes and the leads to call first."
            action={
              <Button
                variant="primary"
                size="md"
                className="min-h-11"
                leftIcon={<Sparkles size={16} />}
                onClick={retry}
                isLoading={isFetching}
              >
                Generate brief
              </Button>
            }
          />
        )}

        {/* Data */}
        {enabled && !isLoading && !error && data?.brief && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-text-primary">{data.brief.title}</h3>
                <p className="mt-1 text-sm text-text-secondary">{data.brief.summary}</p>
              </div>
              <Badge variant={severityBadgeTone(data.brief.severity)}>
                {severityLabel(data.brief.severity)} severity
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
              <RiskGauge
                score={data.brief.riskScore}
                caption={`${formatCount(Math.round((data.brief.confidence ?? 0) * 100))}% confidence`}
              />

              <div className="space-y-3">
                {data.brief.damageTypes?.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                      Likely damage
                    </p>
                    <ul className="flex flex-wrap gap-1.5" aria-label="Likely damage types">
                      {data.brief.damageTypes.map((type) => (
                        <li key={type}>
                          <Badge variant="info" size="sm">
                            {type}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.brief.affectedAreas?.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                      Affected areas
                    </p>
                    <ul className="space-y-1">
                      {data.brief.affectedAreas.map((area) => (
                        <li key={area} className="flex items-center gap-1.5 text-sm text-text-secondary">
                          <MapPin size={13} className="shrink-0 text-text-tertiary" aria-hidden="true" />
                          <span>{area}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.context && (
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: 'Storms', value: data.context.stormCount },
                      { label: 'Leads', value: data.context.leadCount },
                      { label: 'Jobs', value: data.context.jobCount },
                      { label: 'Impacted leads', value: data.context.impactedLeadCount },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg bg-[hsl(var(--background-accent))]/60 px-2 py-1.5"
                      >
                        <dt className="text-[0.625rem] uppercase tracking-wide text-text-tertiary">
                          {stat.label}
                        </dt>
                        <dd className="text-sm font-semibold text-text-primary">
                          {formatCount(stat.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>

            {data.brief.recommendedActions?.length > 0 && (
              <section aria-labelledby="storm-brief-actions">
                <h4
                  id="storm-brief-actions"
                  className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text-primary"
                >
                  <Target size={15} className="text-primary" aria-hidden="true" />
                  Recommended actions
                </h4>
                <ol className="space-y-2">
                  {data.brief.recommendedActions.map((action, index) => {
                    const checked = checkedActions.has(index);
                    return (
                      <li key={`${action}-${index}`} className="flex items-start gap-2.5">
                        <span
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--background-accent))] text-xs font-semibold text-text-secondary"
                          aria-hidden="true"
                        >
                          {index + 1}
                        </span>
                        <input
                          id={`storm-brief-action-${index}`}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAction(index)}
                          className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        />
                        <label
                          htmlFor={`storm-brief-action-${index}`}
                          className={clsx(
                            'cursor-pointer text-sm',
                            checked
                              ? 'text-text-tertiary line-through'
                              : 'text-text-primary'
                          )}
                        >
                          {action}
                        </label>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {data.brief.leadOpportunities?.length > 0 && (
              <section aria-labelledby="storm-brief-leads">
                <h4
                  id="storm-brief-leads"
                  className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-text-primary"
                >
                  <Users size={15} className="text-primary" aria-hidden="true" />
                  Lead opportunities
                </h4>
                <ul className="divide-y divide-border">
                  {data.brief.leadOpportunities.map((opportunity, index) => (
                    <li
                      key={`${opportunity.area}-${index}`}
                      className="flex flex-wrap items-start justify-between gap-2 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-text-primary">
                            {opportunity.area}
                          </span>
                          <Badge variant={priorityTone(opportunity.priority)} size="sm">
                            {String(opportunity.priority ?? 'LOW').toUpperCase()}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-text-tertiary">{opportunity.reason}</p>
                      </div>
                      <Link
                        to={`/leads?search=${encodeURIComponent(opportunity.area)}`}
                        className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label={`View leads in ${opportunity.area}`}
                      >
                        View leads
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.brief.safetyNotes?.length > 0 && (
              <section
                aria-labelledby="storm-brief-safety"
                className="rounded-lg border border-border bg-[hsl(var(--amber))]/10 p-3"
              >
                <h4
                  id="storm-brief-safety"
                  className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-text-primary"
                >
                  <ShieldAlert size={15} className="text-amber" aria-hidden="true" />
                  Safety notes
                </h4>
                <ul className="list-inside list-disc space-y-1 text-xs text-text-secondary">
                  {data.brief.safetyNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </section>
            )}

            <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[0.6875rem] text-text-tertiary">
              {generatedAt && <span>Generated {generatedAt}</span>}
              {typeof data.latencyMs === 'number' && <span>{Math.round(data.latencyMs)}ms</span>}
              {data.model && <span>Model: {data.model}</span>}
              <span aria-live="polite">
                Risk {clampScore(data.brief.riskScore)} / 100 — {severityLabel(data.brief.severity)} severity
              </span>
            </footer>
          </div>
        )}
      </div>
    </Card>
  );
};

export default StormBriefCard;
