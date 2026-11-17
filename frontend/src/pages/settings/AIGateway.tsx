/**
 * Settings › AI Gateway — provider management, health, usage and FreeLLMAPI explainer.
 *
 * Contract: docs/AI_STORM_ARCHITECTURE.md §5.6 / §6.3.
 * - Provider list with health dot + text label, masked key, priority, enable toggle.
 * - Add-provider modal (provider, key, baseUrl for custom/freellmapi, models, priority).
 * - Test connection, remove (with inline confirmation).
 * - Usage summary with CSS bars and a "local fallback always works" guarantee.
 * - Mutations are OWNER/MANAGER only; everyone else sees a read-only view.
 * - /ai/providers + /ai/usage may 501 until backend-ai lands → graceful states.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  Activity,
  AlertCircle,
  ArrowDown,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import clsx from 'clsx';
import Button from '../../components/ui/Button';
import Card, { Badge } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '../../components/ui/Modal';
import { useAuthStore, hasRole } from '../../stores/authStore';
import { aiApi, describeAiError, isAiOfflineError } from '../../services/ai';
import type {
  AddProviderPayload,
  AIUsageTotals,
  ProviderTestResult,
  ProviderView,
  UpdateProviderPayload,
} from '../../types/ai';
import {
  formatCount,
  formatRate,
  providerDisplayName,
  providerHealthView,
  type ProviderHealthTone,
} from '../../components/ai/aiUtils';
import { EmptyState, PanelError, SkeletonLines } from '../../components/ai/primitives';

// ── Provider registry (frontend hints; backend keeps its own registry) ───────
interface ProviderRegistryEntry {
  id: string;
  name: string;
  hint: string;
  baseUrl?: string;
  requiresBaseUrl?: boolean;
  keyPlaceholder: string;
}

const PROVIDER_REGISTRY: ProviderRegistryEntry[] = [
  {
    id: 'groq',
    name: 'Groq',
    hint: 'Fast free-tier Llama 3.3 70B. Get a key at console.groq.com.',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyPlaceholder: 'gsk_…',
  },
  {
    id: 'google',
    name: 'Google AI Studio',
    hint: 'Gemini free tier via the OpenAI-compatible endpoint.',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyPlaceholder: 'AIza…',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    hint: 'Very fast inference on the free tier.',
    baseUrl: 'https://api.cerebras.ai/v1',
    keyPlaceholder: 'csk-…',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    hint: 'Mistral free tier (La Plateforme).',
    baseUrl: 'https://api.mistral.ai/v1',
    keyPlaceholder: 'API key',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    hint: 'Routes to many free models with one key.',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyPlaceholder: 'sk-or-…',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    hint: 'NVIDIA build.nvidia.com free endpoints.',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    keyPlaceholder: 'nvapi-…',
  },
  {
    id: 'freellmapi',
    name: 'FreeLLMAPI gateway (external)',
    hint: 'Point at a self-hosted FreeLLMAPI instance; tried first when enabled.',
    keyPlaceholder: 'Gateway key (optional)',
  },
  {
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    hint: 'Any OpenAI-compatible /v1 endpoint.',
    requiresBaseUrl: true,
    keyPlaceholder: 'API key',
  },
];

const REGISTRY_BY_ID = new Map(PROVIDER_REGISTRY.map((entry) => [entry.id, entry]));

/** Health tone → dot + text colour (always paired with a text label). */
const HEALTH_DOT: Record<ProviderHealthTone, string> = {
  healthy: 'bg-emerald',
  degraded: 'bg-amber',
  error: 'bg-red',
  unconfigured: 'bg-text-tertiary',
  unknown: 'bg-text-tertiary',
};

const HEALTH_TEXT: Record<ProviderHealthTone, string> = {
  healthy: 'text-emerald',
  degraded: 'text-amber',
  error: 'text-red',
  unconfigured: 'text-text-tertiary',
  unknown: 'text-text-tertiary',
};

// ── Add-provider form ────────────────────────────────────────────────────────
interface AddProviderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  errorMessage?: string;
  onSubmit: (payload: AddProviderPayload) => void;
}

const AddProviderForm: React.FC<AddProviderFormProps> = ({
  open,
  onOpenChange,
  isSubmitting,
  errorMessage,
  onSubmit,
}) => {
  const [providerId, setProviderId] = useState('groq');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [models, setModels] = useState('');
  const [priority, setPriority] = useState('10');
  const [enabled, setEnabled] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const entry = REGISTRY_BY_ID.get(providerId);
  const needsBaseUrl = Boolean(entry?.requiresBaseUrl);

  const reset = () => {
    setProviderId('groq');
    setApiKey('');
    setBaseUrl('');
    setModels('');
    setPriority('10');
    setEnabled(true);
    setFormError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!apiKey.trim()) {
      setFormError('An API key is required for this provider.');
      return;
    }
    if (needsBaseUrl && !baseUrl.trim()) {
      setFormError('A base URL is required for a custom OpenAI-compatible provider.');
      return;
    }
    const trimmedModels = models
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean);
    setFormError(null);
    onSubmit({
      providerId,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || undefined,
      models: trimmedModels.length ? trimmedModels : undefined,
      priority: Number.isFinite(Number(priority)) ? Number(priority) : undefined,
      enabled,
    });
  };

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalContent size="lg">
        <form onSubmit={handleSubmit}>
          <ModalHeader>
            <ModalTitle>Add AI provider</ModalTitle>
            <ModalDescription>
              Keys are encrypted at rest and only ever shown masked. Free tier keys work — no paid
              billing is required.
            </ModalDescription>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <Select
              label="Provider"
              size="lg"
              value={providerId}
              onValueChange={(value) => {
                setProviderId(value);
                setFormError(null);
              }}
              options={PROVIDER_REGISTRY.map((registryEntry) => ({
                value: registryEntry.id,
                label: registryEntry.name,
              }))}
            />
            {entry && <p className="text-xs text-text-tertiary">{entry.hint}</p>}

            <Input
              label="API key"
              size="lg"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={entry?.keyPlaceholder ?? 'API key'}
              required
            />

            {(needsBaseUrl || providerId === 'freellmapi' || providerId === 'custom') && (
              <Input
                label={
                  needsBaseUrl ? 'Base URL (required)' : 'Base URL (optional — defaults to env)'
                }
                size="lg"
                type="url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.example.com/v1"
                required={needsBaseUrl}
                helperText="Must be an OpenAI-compatible /v1 endpoint."
              />
            )}

            <Input
              label="Models (optional, comma separated)"
              size="lg"
              value={models}
              onChange={(event) => setModels(event.target.value)}
              placeholder="llama-3.3-70b-versatile, mixtral-8x7b"
              helperText="Leave empty to use the provider's default model."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Priority"
                size="lg"
                type="number"
                min={0}
                max={100}
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                helperText="Higher priority is tried first."
              />
              <label className="flex min-h-11 items-center gap-2 self-end text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
                Enable immediately
              </label>
            </div>

            {(formError || errorMessage) && (
              <p role="alert" className="rounded-lg bg-red/10 p-2 text-xs text-red">
                {formError ?? errorMessage}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="min-h-11"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="min-h-11"
              leftIcon={<KeyRound size={16} />}
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              Add provider
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

// ── Usage summary ────────────────────────────────────────────────────────────
interface UsageSummaryProps {
  today: AIUsageTotals | null;
  last7d: AIUsageTotals | null;
  byProvider: Array<{ providerId: string; requests: number; tokens: number }>;
}

const UsageBar: React.FC<{ value: number; max: number; label: string }> = ({
  value,
  max,
  label,
}) => {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--background-accent))]"
      role="img"
      aria-label={label}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
};

const UsageSummary: React.FC<UsageSummaryProps> = ({ today, last7d, byProvider }) => {
  const maxRequests = Math.max(today?.requests ?? 0, last7d?.requests ?? 0, 1);
  const fallbackRate = today?.fallbackRate ?? 0;
  const topProviders = useMemo(
    () => [...byProvider].sort((a, b) => b.requests - a.requests).slice(0, 5),
    [byProvider]
  );
  const providerMax = Math.max(...topProviders.map((provider) => provider.requests), 1);

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Requests today', value: formatCount(today?.requests ?? 0) },
          { label: 'Tokens today', value: formatCount(today?.tokens ?? 0) },
          { label: 'Requests (7d)', value: formatCount(last7d?.requests ?? 0) },
          { label: 'Tokens (7d)', value: formatCount(last7d?.tokens ?? 0) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg bg-[hsl(var(--background-accent))]/60 px-3 py-2"
          >
            <dt className="text-[0.625rem] uppercase tracking-wide text-text-tertiary">
              {stat.label}
            </dt>
            <dd className="text-lg font-semibold text-text-primary">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>Requests today</span>
          <span className="font-medium text-text-primary">
            {formatCount(today?.requests ?? 0)}
          </span>
        </div>
        <UsageBar
          value={today?.requests ?? 0}
          max={maxRequests}
          label={`${formatCount(today?.requests ?? 0)} AI requests today`}
        />
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>Fallback rate (local engine)</span>
          <span className="font-medium text-text-primary">{formatRate(fallbackRate)}</span>
        </div>
        <UsageBar
          value={fallbackRate * 100}
          max={100}
          label={`${formatRate(fallbackRate)} of AI requests used the local fallback engine`}
        />
      </div>

      {topProviders.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            By provider (7d)
          </p>
          <ul className="space-y-2">
            {topProviders.map((provider) => (
              <li key={provider.providerId}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">
                    {providerDisplayName(provider.providerId)}
                  </span>
                  <span className="font-medium text-text-primary">
                    {formatCount(provider.requests)} req · {formatCount(provider.tokens)} tok
                  </span>
                </div>
                <div className="mt-1">
                  <UsageBar
                    value={provider.requests}
                    max={providerMax}
                    label={`${providerDisplayName(provider.providerId)}: ${formatCount(
                      provider.requests
                    )} requests`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ── Provider row ─────────────────────────────────────────────────────────────
interface ProviderRowProps {
  provider: ProviderView;
  isAdmin: boolean;
  isUpdating: boolean;
  isRemoving: boolean;
  isTesting: boolean;
  testResult?: ProviderTestResult;
  updateError?: string;
  confirmRemove: boolean;
  onToggleEnabled: (provider: ProviderView) => void;
  onTest: (provider: ProviderView) => void;
  onRequestRemove: (provider: ProviderView) => void;
  onCancelRemove: () => void;
  onConfirmRemove: (provider: ProviderView) => void;
}

const ProviderRow: React.FC<ProviderRowProps> = ({
  provider,
  isAdmin,
  isUpdating,
  isRemoving,
  isTesting,
  testResult,
  updateError,
  confirmRemove,
  onToggleEnabled,
  onTest,
  onRequestRemove,
  onCancelRemove,
  onConfirmRemove,
}) => {
  const health = providerHealthView(provider.health, provider.configured);
  const registryEntry = REGISTRY_BY_ID.get(provider.providerId);
  const displayName = providerDisplayName(
    provider.providerId,
    provider.name || registryEntry?.name
  );

  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className={clsx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', HEALTH_DOT[health.tone])}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">{displayName}</h3>
              <span className="text-xs text-text-tertiary">{provider.providerId}</span>
              {provider.enabled ? (
                <Badge variant="success" size="sm">
                  Enabled
                </Badge>
              ) : (
                <Badge variant="default" size="sm">
                  Disabled
                </Badge>
              )}
            </div>
            <p className={clsx('text-xs font-medium', HEALTH_TEXT[health.tone])}>
              {health.label}
              {health.detail ? ` · ${health.detail}` : ''}
            </p>
            <p className="mt-0.5 truncate text-xs text-text-tertiary">
              Key: <span className="font-mono">{provider.apiKeyMasked || 'not set'}</span>
              {provider.baseUrl ? ` · ${provider.baseUrl}` : ''}
              {provider.models?.length ? ` · ${provider.models.join(', ')}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-[hsl(var(--background-accent))] px-2 py-1 text-xs text-text-secondary">
            Priority {provider.priority}
          </span>

          {/* Enable toggle */}
          <button
            type="button"
            onClick={() => onToggleEnabled(provider)}
            disabled={!isAdmin || isUpdating}
            aria-pressed={provider.enabled}
            aria-label={`${provider.enabled ? 'Disable' : 'Enable'} ${displayName}`}
            className={clsx(
              'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
              provider.enabled
                ? 'text-emerald hover:border-border-hover'
                : 'text-text-tertiary hover:border-border-hover'
            )}
          >
            {provider.enabled ? 'On' : 'Off'}
          </button>

          <Button
            variant="secondary"
            size="sm"
            className="min-h-11"
            leftIcon={isTesting ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />}
            onClick={() => onTest(provider)}
            disabled={!isAdmin || isTesting}
            isLoading={isTesting}
            aria-label={`Test connection for ${displayName}`}
          >
            Test
          </Button>

          {confirmRemove ? (
            <span className="flex items-center gap-1">
              <Button
                variant="danger"
                size="sm"
                className="min-h-11"
                onClick={() => onConfirmRemove(provider)}
                isLoading={isRemoving}
                aria-label={`Confirm removing ${displayName}`}
              >
                Confirm
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={onCancelRemove}
                disabled={isRemoving}
                aria-label={`Cancel removing ${displayName}`}
              >
                Cancel
              </Button>
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              leftIcon={<Trash2 size={14} />}
              onClick={() => onRequestRemove(provider)}
              disabled={!isAdmin}
              aria-label={`Remove ${displayName}`}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      {testResult && (
        <p
          role="status"
          className={clsx(
            'mt-2 flex items-center gap-1.5 text-xs',
            testResult.ok ? 'text-emerald' : 'text-red'
          )}
        >
          {testResult.ok ? (
            <CheckCircle2 size={13} aria-hidden="true" />
          ) : (
            <XCircle size={13} aria-hidden="true" />
          )}
          {testResult.ok
            ? `Connection OK${testResult.latencyMs != null ? ` · ${Math.round(testResult.latencyMs)}ms` : ''}${
                testResult.model ? ` · ${testResult.model}` : ''
              }`
            : testResult.error || 'Connection failed.'}
        </p>
      )}

      {updateError && (
        <p role="alert" className="mt-2 text-xs text-red">
          {updateError}
        </p>
      )}
    </li>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
const AIGateway: React.FC = () => {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.user?.role);
  const isAdmin =
    role === 'OWNER' || role === 'MANAGER' || hasRole(['OWNER', 'MANAGER']);

  const [addOpen, setAddOpen] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});
  const [updateErrors, setUpdateErrors] = useState<Record<string, string>>({});

  const statusQuery = useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => aiApi.status(),
    staleTime: 30_000,
    retry: 1,
  });

  const providersQuery = useQuery({
    queryKey: ['ai', 'providers'],
    queryFn: () => aiApi.providers(),
    staleTime: 30_000,
    retry: 0,
  });

  const usageQuery = useQuery({
    queryKey: ['ai', 'usage', 7],
    queryFn: () => aiApi.usage(7),
    staleTime: 60_000,
    retry: 0,
  });

  const status = statusQuery.data;
  const providers = providersQuery.data?.providers ?? [];
  const chain = providersQuery.data?.chain ?? [];

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['ai', 'providers'] });
    void queryClient.invalidateQueries({ queryKey: ['ai', 'status'] });
    void queryClient.invalidateQueries({ queryKey: ['ai', 'usage'] });
  }, [queryClient]);

  const addMutation = useMutation<ProviderView, unknown, AddProviderPayload>({
    mutationFn: (payload) => aiApi.addProvider(payload),
    onSuccess: () => {
      toast.success('AI provider added');
      setAddOpen(false);
      invalidate();
    },
    onError: (error) => toast.error(describeAiError(error)),
  });

  const updateMutation = useMutation<
    ProviderView,
    unknown,
    { id: string; payload: UpdateProviderPayload }
  >({
    mutationFn: ({ id, payload }) => aiApi.updateProvider(id, payload),
    onSuccess: () => {
      setUpdateErrors({});
      invalidate();
    },
    onError: (error, variables) => {
      const message = describeAiError(error);
      setUpdateErrors((prev) => ({ ...prev, [variables.id]: message }));
      toast.error(message);
    },
  });

  const removeMutation = useMutation<{ ok: true }, unknown, string>({
    mutationFn: (id) => aiApi.removeProvider(id),
    onSuccess: () => {
      toast.success('Provider key removed');
      setConfirmRemoveId(null);
      invalidate();
    },
    onError: (error) => toast.error(describeAiError(error)),
  });

  const testMutation = useMutation<ProviderTestResult, unknown, string>({
    mutationFn: (id) => aiApi.testProvider(id),
    onSuccess: (result, id) => {
      setTestResults((prev) => ({ ...prev, [id]: result }));
      if (result.ok) toast.success('Provider connection OK');
      else toast.error(result.error || 'Provider connection failed');
      invalidate();
    },
    onError: (error, id) => {
      const result: ProviderTestResult = { ok: false, error: describeAiError(error) };
      setTestResults((prev) => ({ ...prev, [id]: result }));
      toast.error(result.error ?? 'Provider connection failed');
    },
  });

  const testingId = testMutation.isPending ? testMutation.variables : undefined;
  const removingId = removeMutation.isPending ? removeMutation.variables : undefined;
  const updatingId = updateMutation.isPending ? updateMutation.variables?.id : undefined;

  // Usage: prefer /ai/usage, fall back to the /ai/status snapshot.
  const today: AIUsageTotals | null = status?.usage?.today ?? usageQuery.data?.today ?? null;
  const last7d: AIUsageTotals | null =
    status?.usage?.last7d ?? usageQuery.data?.last7d ?? usageQuery.data?.totals ?? null;
  const byProvider = usageQuery.data?.byProvider ?? [];

  const providersUnavailable =
    !!providersQuery.error && isAiOfflineError(providersQuery.error);
  const statusOffline = !!statusQuery.error && isAiOfflineError(statusQuery.error);

  const localFallback = status?.localFallback;
  const strategy = status?.routing?.strategy;

  const handleToggleEnabled = (provider: ProviderView) => {
    updateMutation.mutate({ id: provider.id, payload: { enabled: !provider.enabled } });
  };

  const handleTest = (provider: ProviderView) => {
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[provider.id];
      return next;
    });
    testMutation.mutate(provider.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AI Gateway</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage free-tier providers behind one OpenAI-compatible gateway. The deterministic local
            engine answers even with no keys configured.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              statusQuery.isLoading
                ? 'info'
                : statusOffline || !!statusQuery.error || status?.enabled === false
                  ? 'warning'
                  : 'success'
            }
          >
            {statusQuery.isLoading
              ? 'Checking gateway…'
              : statusQuery.error
                ? 'Status unavailable'
                : status?.enabled === false
                  ? 'Gateway disabled'
                  : 'Gateway enabled'}
          </Badge>
          {strategy && (
            <Badge variant="info" size="sm">
              Routing: {String(strategy)}
            </Badge>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="min-h-11"
            leftIcon={<RefreshCw size={14} />}
            onClick={() => {
              void statusQuery.refetch();
              void providersQuery.refetch();
              void usageQuery.refetch();
            }}
            aria-label="Refresh AI gateway data"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Admin / read-only notice */}
      {!isAdmin && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-[hsl(var(--background-accent))]/60 p-3 text-sm text-text-secondary">
          <Lock size={16} className="mt-0.5 shrink-0 text-text-tertiary" aria-hidden="true" />
          <div>
            <p className="font-medium text-text-primary">Read-only</p>
            <p className="text-xs text-text-tertiary">
              Only owners and managers can add, test or remove provider keys. AI features still work
              for your role.
            </p>
          </div>
        </div>
      )}

      {/* Status / local fallback */}
      <Card title="Gateway status">
        {statusQuery.isLoading ? (
          <SkeletonLines rows={2} label="Checking AI gateway status…" />
        ) : statusQuery.error ? (
          <PanelError
            offline={statusOffline}
            message={describeAiError(statusQuery.error)}
            onRetry={() => void statusQuery.refetch()}
            isRetrying={statusQuery.isFetching}
          />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-[hsl(var(--background-accent))]/60 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                  <Activity size={15} className="text-primary" aria-hidden="true" />
                  Routing strategy
                </p>
                <p className="mt-1 text-xs text-text-tertiary">
                  {status?.routing?.strategy ?? 'balanced'} · sticky for{' '}
                  {status?.routing?.stickyMinutes ?? 30} min
                </p>
                {chain.length > 0 && (
                  <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-text-secondary">
                    Order:{' '}
                    {chain.map((providerId, index) => (
                      <span key={`${providerId}-${index}`} className="inline-flex items-center gap-1">
                        {index > 0 && <ArrowDown size={10} aria-hidden="true" />}
                        <Badge variant="info" size="sm">
                          {providerId}
                        </Badge>
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-[hsl(var(--background-accent))]/60 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                  <ShieldCheck size={15} className="text-emerald" aria-hidden="true" />
                  Local fallback always works
                </p>
                <p className="mt-1 text-xs text-text-tertiary">
                  {localFallback?.available === false
                    ? 'Local fallback is disabled on this deployment.'
                    : `Deterministic engine${
                        localFallback?.engine ? ` (${localFallback.engine})` : ''
                      } — storm briefs, map plans and lead explanations return without any provider key or network access.`}
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-text-primary">Usage</h3>
              {usageQuery.error && !isAiOfflineError(usageQuery.error) ? (
                <p className="text-xs text-red">{describeAiError(usageQuery.error)}</p>
              ) : null}
              <UsageSummary today={today} last7d={last7d} byProvider={byProvider} />
              {!usageQuery.data && isAiOfflineError(usageQuery.error) && (
                <p className="mt-2 text-xs text-text-tertiary">
                  Detailed usage analytics are unavailable on this deployment — showing the status
                  snapshot instead.
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Providers */}
      <Card
        title="Providers"
        subtitle={`${providers.length} configured · ${chain.length > 0 ? `priority chain: ${chain.join(' → ')}` : 'priority chain starts with the highest priority enabled key'}`}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-text-tertiary">
              Keys are AES-256-GCM encrypted at rest and never returned in full.
            </p>
            {isAdmin && (
              <Button
                variant="primary"
                size="md"
                className="min-h-11"
                leftIcon={<KeyRound size={16} />}
                onClick={() => setAddOpen(true)}
              >
                Add provider
              </Button>
            )}
          </div>

          {providersQuery.isLoading ? (
            <SkeletonLines rows={3} label="Loading AI providers…" />
          ) : providersQuery.error ? (
            providersUnavailable ? (
              <div className="space-y-2 rounded-lg border border-border bg-[hsl(var(--background-accent))]/60 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                  <AlertCircle size={15} className="text-amber" aria-hidden="true" />
                  Provider management API not available yet
                </p>
                <p className="text-xs text-text-tertiary">
                  The backend AI routes return 501 until the gateway lands. Local deterministic AI
                  still answers (see Gateway status), so Storm Intelligence keeps working without
                  provider keys.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-11"
                  leftIcon={<RefreshCw size={14} />}
                  onClick={() => void providersQuery.refetch()}
                  isLoading={providersQuery.isFetching}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <PanelError
                message={describeAiError(providersQuery.error)}
                onRetry={() => void providersQuery.refetch()}
                isRetrying={providersQuery.isFetching}
              />
            )
          ) : providers.length === 0 ? (
            <EmptyState
              icon={<KeyRound size={22} />}
              title="No provider keys yet"
              description="Add a free-tier key (Groq, Google AI Studio, Cerebras, Mistral, OpenRouter, NVIDIA) or point the gateway at an external FreeLLMAPI instance. The local deterministic engine keeps working with zero keys."
              action={
                isAdmin ? (
                  <Button
                    variant="primary"
                    size="md"
                    className="min-h-11"
                    onClick={() => setAddOpen(true)}
                  >
                    Add provider
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="space-y-2">
              {providers.map((provider) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  isAdmin={isAdmin}
                  isUpdating={updatingId === provider.id}
                  isRemoving={removingId === provider.id}
                  isTesting={testingId === provider.id}
                  testResult={testResults[provider.id]}
                  updateError={updateErrors[provider.id]}
                  confirmRemove={confirmRemoveId === provider.id}
                  onToggleEnabled={handleToggleEnabled}
                  onTest={handleTest}
                  onRequestRemove={(selected) => setConfirmRemoveId(selected.id)}
                  onCancelRemove={() => setConfirmRemoveId(null)}
                  onConfirmRemove={(selected) => removeMutation.mutate(selected.id)}
                />
              ))}
            </ul>
          )}

          {updateMutation.isPending && (
            <p className="text-xs text-text-tertiary" role="status">
              Saving provider changes…
            </p>
          )}
        </div>
      </Card>

      {/* FreeLLMAPI explainer */}
      <Card title="About FreeLLMAPI">
        <div className="space-y-2 text-sm text-text-secondary">
          <p>
            ATLAS adopts the{' '}
            <a
              href="https://github.com/marcusdax/freellmapi"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              FreeLLMAPI
            </a>{' '}
            architecture: one OpenAI-compatible <code>/v1</code> endpoint in front of many free-tier
            providers, with priority routing, automatic failover and encrypted keys.
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs text-text-tertiary">
            <li>Provider calls time out (default 20s) and fail over to the next key in the chain.</li>
            <li>
              The local deterministic engine is the final fallback — AI features never hard-fail on
              this page.
            </li>
            <li>Only OpenAI-compatible endpoints you configure are ever called; no paid APIs.</li>
          </ul>
          {isAdmin && (
            <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <ShieldCheck size={13} className="text-emerald" aria-hidden="true" />
              Keys are decrypted in memory per request only and returned masked (••••abcd).
            </p>
          )}
        </div>
      </Card>

      {/* Add provider modal */}
      <AddProviderForm
        open={addOpen}
        onOpenChange={setAddOpen}
        isSubmitting={addMutation.isPending}
        errorMessage={addMutation.error ? describeAiError(addMutation.error) : undefined}
        onSubmit={(payload) => addMutation.mutate(payload)}
      />
    </div>
  );
};

export default AIGateway;

