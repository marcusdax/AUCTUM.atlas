/**
 * MapCopilot — natural-language → validated map plan.
 *
 * Contract §6.3: query input with Enter submit, example chips, plan explanation,
 * active filter/overlay chips with clear, suggestions and a retryable error state.
 * The copilot never executes free text: only the backend-validated plan object is
 * applied to the map. AI-offline is handled gracefully.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CornerDownLeft, MapPinned, Sparkles, Wand2, X } from 'lucide-react';
import clsx from 'clsx';
import Card, { Badge } from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { aiApi, describeAiError, isAiOfflineError } from '../../services/ai';
import type { MapCopilotPlan, MapCopilotResponse, MapView } from '../../types/ai';
import { buildPlanChips, formatGeneratedAt, planHasEffect } from './aiUtils';
import { PanelError } from './primitives';

export interface MapCopilotProps {
  /** Current map viewport so plans can be relative ("zoom in on this area"). */
  view?: MapView | null;
  /** False when AI status is unreachable — the input is disabled with an offline notice. */
  enabled?: boolean;
  /** Plan currently applied to the map (owned by the page). */
  activePlan?: MapCopilotPlan | null;
  onApplyPlan: (plan: MapCopilotPlan) => void;
  onClearPlan?: () => void;
  className?: string;
}

const EXAMPLES = [
  'Show extreme tornado warnings',
  'Find leads inside the hail swath',
  'Reset view',
] as const;

export const MapCopilot: React.FC<MapCopilotProps> = ({
  view,
  enabled = true,
  activePlan,
  onApplyPlan,
  onClearPlan,
  className,
}) => {
  const [query, setQuery] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [response, setResponse] = useState<MapCopilotResponse | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: { query: string; view?: MapView }) => aiApi.mapCopilot(payload),
    onSuccess: (data) => {
      setResponse(data);
      if (data?.plan) onApplyPlan(data.plan);
    },
  });

  // Keep local result in sync when the page clears the applied plan externally.
  useEffect(() => {
    if (!activePlan) setResponse(null);
  }, [activePlan]);

  const ask = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setInputError('Type a question about the storm map first.');
        return;
      }
      setInputError(null);
      mutation.mutate({ query: trimmed, view: view ?? undefined });
    },
    [mutation, view]
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    ask(query);
  };

  const handleExample = (example: string) => {
    setQuery(example);
    ask(example);
  };

  const handleClear = () => {
    setResponse(null);
    setInputError(null);
    onClearPlan?.();
  };

  const error = mutation.error;
  const offline = !!error && isAiOfflineError(error);
  const plan = activePlan ?? response?.plan ?? null;
  const chips = useMemo(() => buildPlanChips(plan), [plan]);
  const explanation = response?.plan?.explanation ?? activePlan?.explanation ?? '';
  const suggestions = response?.suggestions ?? [];
  const generatedAt = formatGeneratedAt(response?.generatedAt);

  return (
    <Card className={clsx('flex flex-col', className)} role="region" aria-label="AI map copilot">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--background-accent))] text-primary"
            aria-hidden="true"
          >
            <Sparkles size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Map Copilot</h2>
            <p className="text-xs text-text-tertiary">
              Ask for a view, filter or overlay in plain English.
            </p>
          </div>
        </div>
        {response?.source && (
          <Badge
            variant={response.source === 'llm' && !response.fallback ? 'success' : 'warning'}
            size="sm"
          >
            {response.source === 'llm' && !response.fallback
              ? `AI · ${response.model || 'model'}`
              : 'Offline engine'}
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Input
            size="lg"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (inputError) setInputError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('');
            }}
            placeholder='e.g. "show extreme tornado warnings"'
            aria-label="Ask the map copilot"
            aria-invalid={inputError ? true : undefined}
            aria-describedby={inputError ? 'map-copilot-input-error' : undefined}
            disabled={!enabled}
          />
          {inputError && (
            <p id="map-copilot-input-error" role="alert" className="mt-1 text-xs text-red">
              {inputError}
            </p>
          )}
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="min-h-11 shrink-0 sm:min-w-[7rem]"
          leftIcon={<Wand2 size={16} />}
          isLoading={mutation.isPending}
          disabled={!enabled}
          aria-label="Run map copilot"
        >
          Apply
        </Button>
      </form>

      {/* Example chips */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Example copilot queries">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => handleExample(example)}
            disabled={!enabled || mutation.isPending}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-[hsl(var(--background-accent))]/60 px-3 text-xs text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles size={12} aria-hidden="true" />
            {example}
          </button>
        ))}
      </div>

      {/* Offline notice */}
      {!enabled && (
        <p className="mt-3 rounded-lg border border-border bg-[hsl(var(--background-accent))]/60 p-2 text-xs text-text-tertiary">
          AI offline — natural-language map commands are unavailable. Use the Active Storms list and
          the map overlay controls instead.
        </p>
      )}

      {/* Error */}
      {enabled && error && (
        <PanelError
          className="mt-3"
          offline={offline}
          message={describeAiError(error)}
          onRetry={() => ask(mutation.variables?.query ?? query ?? EXAMPLES[0])}
          isRetrying={mutation.isPending}
        />
      )}

      {/* Plan result */}
      {plan && planHasEffect(plan) && (
        <div className="mt-3 space-y-2" aria-live="polite">
          {explanation && (
            <p className="flex items-start gap-2 text-sm text-text-secondary">
              <MapPinned size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <span>{explanation}</span>
            </p>
          )}
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {chips.map((chip) => (
                <span
                  key={chip.id}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-[0.6875rem] font-medium text-primary"
                >
                  {chip.label}
                </span>
              ))}
              {onClearPlan && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border px-3 text-xs text-text-secondary hover:border-border-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label="Clear map copilot plan"
                >
                  <X size={12} aria-hidden="true" />
                  Clear plan
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Unknown intent / explanation-only */}
      {plan && !planHasEffect(plan) && explanation && (
        <p className="mt-3 text-sm text-text-secondary" aria-live="polite">
          {explanation}
        </p>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <p className="mb-1 flex items-center gap-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-text-tertiary">
            <CornerDownLeft size={12} aria-hidden="true" />
            Try next
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 4).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleExample(suggestion)}
                disabled={!enabled || mutation.isPending}
                className="inline-flex min-h-11 items-center rounded-lg border border-border px-2.5 text-xs text-text-secondary hover:border-border-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {generatedAt && (
        <p className="mt-2 text-[0.625rem] text-text-tertiary">
          Plan generated {generatedAt}
          {typeof response?.latencyMs === 'number' ? ` · ${Math.round(response.latencyMs)}ms` : ''}
        </p>
      )}
    </Card>
  );
};

export default MapCopilot;
