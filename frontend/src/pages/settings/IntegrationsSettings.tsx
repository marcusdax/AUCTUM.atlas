import React, { useState, useCallback } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Landmark,
  CalendarDays,
  CalendarClock,
  Image,
  Eye,
  Package,
  Webhook as WebhookIcon,
  RefreshCw,
  Trash2,
  Settings as SettingsIcon,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card, { Badge } from '../../components/ui/Card';
import {
  Integration,
  IntegrationType,
  IntegrationStatus,
} from '../../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/* ===== Integration type configuration ===== */

interface IntegrationTypeInfo {
  name: string;
  description: string;
  icon: React.ReactNode;
  connectMethod: 'oauth' | 'apikey' | 'webhook';
  iconColor: string;
}

const INTEGRATION_CONFIG: Record<IntegrationType, IntegrationTypeInfo> = {
  QUICKBOOKS: {
    name: 'QuickBooks Online',
    description: 'Sync invoices, payments, and customer data with QuickBooks Online.',
    icon: <Landmark size={24} />,
    connectMethod: 'oauth',
    iconColor: 'text-primary',
  },
  GOOGLE_CALENDAR: {
    name: 'Google Calendar',
    description: 'Sync inspection schedules and appointments to Google Calendar.',
    icon: <CalendarDays size={24} />,
    connectMethod: 'oauth',
    iconColor: 'text-primary',
  },
  OUTLOOK_CALENDAR: {
    name: 'Outlook Calendar',
    description: 'Sync calendar events and appointments with Microsoft Outlook.',
    icon: <CalendarClock size={24} />,
    connectMethod: 'oauth',
    iconColor: 'text-teal',
  },
  HOVER: {
    name: 'Hover',
    description: 'Import 3D measurements and roof estimates from Hover.',
    icon: <Image size={24} />,
    connectMethod: 'apikey',
    iconColor: 'text-purple',
  },
  EAGLEVIEW: {
    name: 'EagleView',
    description: 'Fetch aerial imagery and property measurements from EagleView.',
    icon: <Eye size={24} />,
    connectMethod: 'apikey',
    iconColor: 'text-emerald',
  },
  ABC_SUPPLY: {
    name: 'ABC Supply',
    description: 'Order materials and sync pricing from ABC Supply.',
    icon: <Package size={24} />,
    connectMethod: 'apikey',
    iconColor: 'text-amber',
  },
  WEBHOOK: {
    name: 'Webhooks',
    description: 'Configure outbound webhooks for real-time event notifications.',
    icon: <WebhookIcon size={24} />,
    connectMethod: 'webhook',
    iconColor: 'text-primary',
  },
};

const INTEGRATION_ORDER: IntegrationType[] = [
  'QUICKBOOKS',
  'GOOGLE_CALENDAR',
  'OUTLOOK_CALENDAR',
  'HOVER',
  'EAGLEVIEW',
  'ABC_SUPPLY',
  'WEBHOOK',
];

const API_KEY_HELP: Partial<Record<IntegrationType, string>> = {
  HOVER: 'Find your API key in Hover \u2192 Profile \u2192 API Access.',
  EAGLEVIEW: 'Find your API key in your EagleView developer account settings.',
  ABC_SUPPLY: 'Find your API key in ABC Supply \u2192 My Account \u2192 API Keys.',
};

const WEBHOOK_EVENTS = [
  { value: 'job.created', label: 'Job Created' },
  { value: 'job.updated', label: 'Job Updated' },
  { value: 'job.status_changed', label: 'Job Status Changed' },
  { value: 'lead.created', label: 'Lead Created' },
  { value: 'lead.status_changed', label: 'Lead Status Changed' },
  { value: 'estimate.sent', label: 'Estimate Sent' },
  { value: 'estimate.approved', label: 'Estimate Approved' },
  { value: 'calendar.event.created', label: 'Calendar Event Created' },
  { value: 'storm.alert', label: 'Storm Alert' },
];

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const getStatusBadgeVariant = (status: IntegrationStatus): BadgeVariant => {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'ERROR':
      return 'danger';
    case 'PENDING':
      return 'warning';
    default:
      return 'default';
  }
};

const getStatusText = (status: IntegrationStatus): string => {
  switch (status) {
    case 'ACTIVE':
      return 'Connected';
    case 'DISCONNECTED':
      return 'Disconnected';
    case 'PENDING':
      return 'Pending';
    case 'ERROR':
      return 'Error';
    default:
      return status;
  }
};

const formatLastSync = (lastSyncedAt?: string): string => {
  if (!lastSyncedAt) return 'Never synced';
  try {
    const date = new Date(lastSyncedAt);
    return `Synced ${formatDistanceToNow(date, { addSuffix: true })}`;
  } catch {
    return 'Never synced';
  }
};

/* ===== Modal (Radix Dialog wrapper) ===== */

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
}) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <Dialog.Content
        className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2
                   rounded-xl bg-[hsl(var(--background-card))] border border-[hsl(var(--border))]
                   p-6 shadow-xl outline-none"
      >
        <div className="flex items-start justify-between">
          <div>
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              {title}
            </Dialog.Title>
            {description && (
              <Dialog.Description className="mt-1 text-sm text-text-tertiary">
                {description}
              </Dialog.Description>
            )}
          </div>
          <Dialog.Close asChild>
            <button
              type="button"
              className="rounded-lg p-1 text-text-tertiary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
            >
              <X size={18} />
            </button>
          </Dialog.Close>
        </div>
        <div className="mt-4">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

/* ===== Settings summary (shown on card when connected) ===== */

interface SettingsSummaryProps {
  type: IntegrationType;
  integration: Integration;
}

const SettingsSummary: React.FC<SettingsSummaryProps> = ({ type, integration }) => {
  const config = INTEGRATION_CONFIG[type];

  switch (config.connectMethod) {
    case 'oauth': {
      const email =
        (integration.credentials?.accountEmail as string) ||
        (integration.credentials?.email as string) ||
        (integration.credentials?.providerAccountId as string);

      if (!email) {
        return <span className="text-text-tertiary italic">Account linked</span>;
      }
      return <span className="font-medium text-text-primary">{email}</span>;
    }

    case 'apikey': {
      const apiKey = integration.credentials?.apiKey as string | undefined;
      const label = integration.credentials?.label as string | undefined;
      const masked = apiKey ? `***•***•***•${apiKey.slice(-4)}` : '***•***•***•****';
      return (
        <span className="font-mono text-text-primary" title={label || apiKey}>
          {masked}
          {label && <span className="text-text-tertiary"> ({label})</span>}
        </span>
      );
    }

    case 'webhook': {
      const url = integration.settings?.url as string | undefined;
      if (!url) {
        return <span className="text-text-tertiary italic">URL not configured</span>;
      }
      return (
        <span className="font-mono text-text-primary" title={url}>
          {url}
        </span>
      );
    }

    default:
      return null;
  }
};

/* ===== API key form ===== */

interface ApiKeyFormProps {
  type: IntegrationType;
  integration?: Integration;
  onSubmit: (data: { apiKey: string; label: string }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

const ApiKeyForm: React.FC<ApiKeyFormProps> = ({
  type,
  integration,
  onSubmit,
  onCancel,
  isSubmitting,
}) => {
  const config = INTEGRATION_CONFIG[type];
  const isEdit = !!integration;
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState(integration?.credentials?.label as string || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() && !isEdit) {
      toast.error('Please enter an API key');
      return;
    }
    onSubmit({ apiKey: apiKey.trim(), label });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEdit && (
        <div className="flex items-start gap-3 rounded-lg bg-[hsl(var(--background-accent))] p-3 text-sm text-text-secondary">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-amber" />
          <span>{API_KEY_HELP[type] || 'You will need an API key from the service provider.'}</span>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your API key"
          className="input w-full"
        />
        {isEdit && (
          <p className="mt-1 text-xs text-text-tertiary">
            Leave empty to keep your current API key.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Label (optional)
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Production key"
          className="input w-full"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          type="submit"
          isLoading={isSubmitting}
          disabled={isSubmitting}
        >
          {isEdit ? 'Update' : 'Connect'} {config.name}
        </Button>
      </div>
    </form>
  );
};

/* ===== Webhook configuration form ===== */

interface WebhookFormProps {
  integration?: Integration;
  onSubmit: (data: { url: string; events: string[] }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

const WebhookForm: React.FC<WebhookFormProps> = ({
  integration,
  onSubmit,
  onCancel,
  isSubmitting,
}) => {
  const isEdit = !!integration;
  const [url, setUrl] = useState(
    (integration?.settings?.url as string) || '',
  );
  const [events, setEvents] = useState<string[]>(
    (integration?.settings?.events as string[]) || [],
  );

  const toggleEvent = (value: string) => {
    setEvents((prev) =>
      prev.includes(value)
        ? prev.filter((e) => e !== value)
        : [...prev, value],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error('Please enter a webhook URL');
      return;
    }
    if (events.length === 0) {
      toast.error('Please select at least one event');
      return;
    }
    onSubmit({ url: url.trim(), events });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Webhook URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-app.com/api/webhooks/roofpro"
          className="input w-full"
        />
        <p className="mt-1 text-xs text-text-tertiary">
          {isEdit
            ? 'Update the endpoint that will receive webhook events.'
            : 'This is the endpoint that RoofPro will POST to when events occur.'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Subscribed Events
        </label>
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {WEBHOOK_EVENTS.map((event) => (
            <label
              key={event.value}
              className="flex items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={events.includes(event.value)}
                onChange={() => toggleEvent(event.value)}
                className="h-4 w-4 rounded border-border bg-[hsl(var(--background))] text-primary focus:ring-primary"
              />
              <span className="text-text-primary">{event.label}</span>
              <code className="ml-auto text-xs text-text-tertiary">{event.value}</code>
            </label>
          ))}
        </div>
      </div>

      {isEdit && (
        <div className="flex items-start gap-3 rounded-lg bg-[hsl(var(--background-accent))] p-3 text-sm text-text-secondary">
          <RefreshCw size={16} className="mt-0.5 flex-shrink-0 text-amber" />
          <span>Saving will regenerate the webhook signing secret.</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          type="submit"
          isLoading={isSubmitting}
          disabled={isSubmitting}
        >
          {isEdit ? 'Update' : 'Create'} Webhook
        </Button>
      </div>
    </form>
  );
};

/* ===== OAuth info dialog ===== */

interface OAuthInfoDialogProps {
  type: IntegrationType;
  integration: Integration;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReconnect: () => void;
}

const OAuthInfoDialog: React.FC<OAuthInfoDialogProps> = ({
  type,
  integration,
  open,
  onOpenChange,
  onReconnect,
}) => {
  const config = INTEGRATION_CONFIG[type];
  const accountEmail =
    (integration.credentials?.accountEmail as string) ||
    (integration.credentials?.email as string);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={config.name}
      description="Manage your OAuth connection"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-lg bg-[hsl(var(--background-accent))] p-4">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${config.iconColor}`}
          >
            {config.icon}
          </div>
          <div>
            <p className="font-medium text-text-primary">{config.name}</p>
            {accountEmail && (
              <p className="text-sm text-text-secondary">{accountEmail}</p>
            )}
          </div>
        </div>

        <div className="text-sm text-text-secondary">
          <p className="mb-2">Connected permissions:</p>
          <ul className="list-inside list-disc space-y-1">
            <li>Read and write access to relevant data</li>
            <li>Synchronization of calendar events</li>
            <li>Webhook delivery for real-time updates</li>
          </ul>
        </div>

        {integration.lastSyncedAt && (
          <p className="text-sm">
            Last synced:{' '}
            <span className="font-medium text-text-primary">
              {formatLastSync(integration.lastSyncedAt)}
            </span>
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={16} />}
            onClick={onReconnect}
          >
            Reconnect
          </Button>
        </div>
      </div>
    </Modal>
  );
};

/* ===== Integration card ===== */

interface IntegrationCardProps {
  type: IntegrationType;
  integration?: Integration;
  onConnect: (type: IntegrationType) => void;
  onSync: (id: string) => void;
  onDisconnect: (id: string) => void;
  onManageSettings: (type: IntegrationType) => void;
  isSyncing: boolean;
}

const IntegrationCard: React.FC<IntegrationCardProps> = ({
  type,
  integration,
  onConnect,
  onSync,
  onDisconnect,
  onManageSettings,
  isSyncing,
}) => {
  const config = INTEGRATION_CONFIG[type];
  const connected = integration?.status === 'ACTIVE';
  const hasRecord = !!integration;

  return (
    <Card className="flex flex-col p-6 transition-shadow hover:shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--background-accent))] ${config.iconColor}`}
          >
            {config.icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">{config.name}</h3>
            <p className="text-sm text-text-secondary">{config.description}</p>
          </div>
        </div>
        <Badge variant={getStatusBadgeVariant(integration?.status ?? 'DISCONNECTED')} size="sm">
          {getStatusText(integration?.status ?? 'DISCONNECTED')}
        </Badge>
      </div>

      {/* Status details */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Clock size={14} className="text-text-tertiary" />
          <span className="text-text-tertiary">
            {formatLastSync(integration?.lastSyncedAt)}
          </span>
        </div>

        {connected && (
          <div className="flex items-center gap-2 text-sm">
            <SettingsIcon size={14} className="text-text-tertiary" />
            <span className="text-text-tertiary">Configuration:</span>
            <SettingsSummary type={type} integration={integration!} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
        {connected && (
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={16} />}
              onClick={() => onSync(integration!.id)}
              isLoading={isSyncing}
            >
              Sync Now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<SettingsIcon size={16} />}
              onClick={() => onManageSettings(type)}
            >
              Settings
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={16} />}
              onClick={() => onDisconnect(integration!.id)}
            >
              Disconnect
            </Button>
          </>
        )}

        {!connected && hasRecord && (
          <>
            <Button variant="primary" size="sm" onClick={() => onConnect(type)}>
              Reconnect
            </Button>
            <Button variant="danger" size="sm" onClick={() => onDisconnect(integration!.id)}>
              Remove
            </Button>
          </>
        )}

        {!connected && !hasRecord && (
          <Button variant="primary" size="sm" onClick={() => onConnect(type)}>
            Connect
          </Button>
        )}
      </div>
    </Card>
  );
};

/* ===== Main page ===== */

const IntegrationsSettings: React.FC = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.get('/integrations').then((res) => res.data),
    staleTime: 60_000,
  });

  const integrations: Integration[] = data?.data ?? [];

  const syncMutation = useMutation({
    mutationFn: (id: string) => api.post(`/integrations/${id}/sync`),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/${id}`),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/integrations', payload),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Record<string, unknown>) =>
      api.patch(`/integrations/${id}`, payload),
  });

  const isMutating = createMutation.isPending || updateMutation.isPending;
  const syncingId = syncMutation.isPending ? syncMutation.variables : null;

  const findIntegration = (type: IntegrationType): Integration | undefined =>
    integrations.find((i) => i.type === type);

  /* === Dialog state === */
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [apiKeyType, setApiKeyType] = useState<IntegrationType | null>(null);

  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);

  const [oauthInfoOpen, setOauthInfoOpen] = useState(false);
  const [oauthInfoType, setOauthInfoType] = useState<IntegrationType | null>(null);

  /* === OAuth popup === */

  const openOAuthPopup = useCallback(
    (type: IntegrationType) => {
      const width = 600;
      const height = 720;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;

      const popup = window.open(
        `${API_BASE}/api/v1/integrations/oauth/${type}/connect`,
        `oauth-${type}`,
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`,
      );

      if (!popup) {
        toast.error('Pop-up was blocked. Please allow pop-ups for this site and try again.');
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        const data = event.data;
        if (data?.type === 'roofpro:oauth:complete') {
          window.removeEventListener('message', handleMessage);
          if (data.success) {
            toast.success(`${INTEGRATION_CONFIG[type].name} connected successfully`);
            queryClient.invalidateQueries({ queryKey: ['integrations'] });
          } else {
            toast.error(data.error || 'OAuth connection failed');
          }
        }
      };

      window.addEventListener('message', handleMessage);

      const cleanup = () => {
        clearInterval(interval);
        window.removeEventListener('message', handleMessage);
      };

      const interval = setInterval(() => {
        if (popup.closed) {
          cleanup();
        }
      }, 1000);
    },
    [queryClient],
  );

  /* === Action handlers === */

  const handleConnect = (type: IntegrationType) => {
    const info = INTEGRATION_CONFIG[type];
    if (info.connectMethod === 'oauth') {
      openOAuthPopup(type);
    } else if (info.connectMethod === 'apikey') {
      setApiKeyType(type);
      setApiKeyDialogOpen(true);
    } else {
      setWebhookDialogOpen(true);
    }
  };

  const handleManageSettings = (type: IntegrationType) => {
    const info = INTEGRATION_CONFIG[type];
    if (info.connectMethod === 'oauth') {
      setOauthInfoType(type);
      setOauthInfoOpen(true);
    } else if (info.connectMethod === 'apikey') {
      setApiKeyType(type);
      setApiKeyDialogOpen(true);
    } else {
      setWebhookDialogOpen(true);
    }
  };

  const handleSync = (id: string) => {
    syncMutation.mutate(id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['integrations'] });
        toast.success('Sync started successfully');
      },
      onError: () => toast.error('Failed to start sync'),
    });
  };

  const handleDisconnect = (id: string) => {
    disconnectMutation.mutate(id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['integrations'] });
        toast.success('Integration disconnected');
      },
      onError: () => toast.error('Failed to disconnect integration'),
    });
  };

  /* === Form submit handlers === */

  const handleApiKeySubmit = (data: { apiKey: string; label: string }) => {
    if (!apiKeyType) return;

    const integration = findIntegration(apiKeyType);
    const config = INTEGRATION_CONFIG[apiKeyType];

    const credentials: Record<string, unknown> = {};
    if (data.apiKey) credentials.apiKey = data.apiKey;
    if (data.label) credentials.label = data.label;

    const payload: Record<string, unknown> = {
      type: apiKeyType,
      status: 'ACTIVE',
    };
    if (Object.keys(credentials).length > 0) {
      payload.credentials = credentials;
    }

    if (integration) {
      updateMutation.mutate(
        { id: integration.id, ...payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['integrations'] });
            toast.success(`${config.name} settings updated`);
            setApiKeyDialogOpen(false);
          },
          onError: () => toast.error('Failed to update integration'),
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['integrations'] });
          toast.success(`${config.name} connected`);
          setApiKeyDialogOpen(false);
        },
        onError: () => toast.error('Failed to connect integration'),
      });
    }
  };

  const handleWebhookSubmit = (data: { url: string; events: string[] }) => {
    const integration = findIntegration('WEBHOOK');
    const payload: Record<string, unknown> = {
      type: 'WEBHOOK',
      settings: { url: data.url, events: data.events },
      status: 'ACTIVE',
    };

    if (integration) {
      updateMutation.mutate(
        { id: integration.id, ...payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['integrations'] });
            toast.success('Webhook settings updated');
            setWebhookDialogOpen(false);
          },
          onError: () => toast.error('Failed to update webhook settings'),
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['integrations'] });
          toast.success('Webhook configured');
          setWebhookDialogOpen(false);
        },
        onError: () => toast.error('Failed to configure webhook'),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Integrations</h1>
        <p className="mt-1 text-text-secondary">
          Connect your tools and services to streamline your roofing workflow.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-red/10 p-4 text-sm text-red">
          Failed to load integrations. Please try again later.
        </div>
      )}

      {/* Integration cards */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {INTEGRATION_ORDER.map((type) => (
            <Card key={type} className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-[hsl(var(--background-accent))]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-3/4 rounded bg-[hsl(var(--background-accent))]" />
                    <div className="h-4 w-full rounded bg-[hsl(var(--background-accent))]" />
                    <div className="h-4 w-2/3 rounded bg-[hsl(var(--background-accent))]" />
                  </div>
                </div>
                <div className="h-4 w-1/4 rounded bg-[hsl(var(--background-accent))]" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {INTEGRATION_ORDER.map((type) => {
            const integration = findIntegration(type);
            return (
              <IntegrationCard
                key={type}
                type={type}
                integration={integration}
                onConnect={handleConnect}
                onSync={handleSync}
                onDisconnect={handleDisconnect}
                onManageSettings={handleManageSettings}
                isSyncing={syncingId === integration?.id}
              />
            );
          })}
        </div>
      )}

      {/* API Key Dialog */}
      {apiKeyType && (
        <Modal
          open={apiKeyDialogOpen}
          onOpenChange={setApiKeyDialogOpen}
          title={`${findIntegration(apiKeyType) ? 'Update' : 'Connect'} ${INTEGRATION_CONFIG[apiKeyType].name}`}
          description={INTEGRATION_CONFIG[apiKeyType].description}
        >
          <ApiKeyForm
            type={apiKeyType}
            integration={findIntegration(apiKeyType)}
            onSubmit={handleApiKeySubmit}
            onCancel={() => setApiKeyDialogOpen(false)}
            isSubmitting={isMutating}
          />
        </Modal>
      )}

      {/* Webhook Dialog */}
      <Modal
        open={webhookDialogOpen}
        onOpenChange={setWebhookDialogOpen}
        title="Configure Webhooks"
        description="Set up a webhook endpoint to receive real-time event notifications."
      >
        <WebhookForm
          integration={findIntegration('WEBHOOK')}
          onSubmit={handleWebhookSubmit}
          onCancel={() => setWebhookDialogOpen(false)}
          isSubmitting={isMutating}
        />
      </Modal>

      {/* OAuth Info Dialog */}
      {oauthInfoType && (
        <OAuthInfoDialog
          type={oauthInfoType}
          integration={findIntegration(oauthInfoType)!}
          open={oauthInfoOpen}
          onOpenChange={setOauthInfoOpen}
          onReconnect={() => {
            setOauthInfoOpen(false);
            openOAuthPopup(oauthInfoType);
          }}
        />
      )}
    </div>
  );
};

export default IntegrationsSettings;
