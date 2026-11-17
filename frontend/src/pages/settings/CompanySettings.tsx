import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, resolveFileUrl } from '../../services/api';
import Button from '../../components/ui/Button';
import Card, { Badge } from '../../components/ui/Card';
import { Company } from '../../types';
import { toast } from 'react-hot-toast';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Loader2,
  Phone,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';

interface CompanyForm {
  name: string;
  address: string;
  phone: string;
  logoUrl: string;
}

const TIER_FEATURES: Record<
  'Starter' | 'Professional' | 'Enterprise',
  { name: string; features: string[] }
> = {
  Starter: {
    name: 'Starter',
    features: [
      'Up to 5 active jobs',
      'Basic storm alerts',
      '5 GB document storage',
      '1 team seat',
    ],
  },
  Professional: {
    name: 'Professional',
    features: [
      'Unlimited active jobs',
      'Advanced storm tracking',
      '50 GB document storage',
      'Up to 10 team seats',
      'Custom estimate templates',
    ],
  },
  Enterprise: {
    name: 'Enterprise',
    features: [
      'Everything in Professional',
      'Dedicated account manager',
      'Custom integrations',
      'Unlimited storage',
      'Priority 24/7 support',
      'White-label reports',
    ],
  },
};

const tierBadgeVariant = (
  tier: Company['subscriptionTier']
): 'default' | 'success' | 'warning' | 'info' => {
  if (tier === 'Professional') return 'success';
  if (tier === 'Enterprise') return 'warning';
  return 'default';
};

const CompanySettings: React.FC = () => {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isFetching,
    refetch,
    isError,
    error,
  } = useQuery({
    queryKey: ['company'],
    queryFn: () => api.get('/companies').then((res) => res.data),
    staleTime: 60 * 1000,
  });

  const company: Company | undefined = data?.company;

  const [form, setForm] = useState<CompanyForm>({
    name: '',
    address: '',
    phone: '',
    logoUrl: '',
  });
  const [settingsText, setSettingsText] = useState('');
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync local form + settings editor whenever the company reloads
  useEffect(() => {
    if (!company) return;
    setForm({
      name: company.name ?? '',
      address: company.address ?? '',
      phone: company.phone ?? '',
      logoUrl: company.logoUrl ?? '',
    });
    setSettingsText(
      company.settings ? JSON.stringify(company.settings, null, 2) : ''
    );
    setSettingsError(null);
  }, [company]);

  const updateCompany = useMutation({
    mutationFn: (payload: Partial<CompanyForm>) =>
      api.patch('/companies', payload).then((res) => res.data),
  });

  const updateSettings = useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      api
        .patch('/companies/settings', { settings })
        .then((res) => res.data),
  });

  const uploadLogo = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('logo', file);
      // Use the fetch adapter so the FormData (multipart) body is sent
      // verbatim — the apiClient defaults to an application/json content
      // type which would otherwise break multipart uploads.
      return api
        .post('/companies/logo', fd, {
          adapter: ['fetch'],
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((res) => res.data);
    },
    onSuccess: (res: { logoUrl?: string }) => {
      if (res?.logoUrl) {
        const logoUrl: string = res.logoUrl;
        setForm((prev) => ({ ...prev, logoUrl }));
        toast.success('Logo uploaded.');
      }
    },
    onError: () => {
      toast.error('Failed to upload logo. Please try again.');
    },
  });

  const isSaving = updateCompany.isPending || updateSettings.isPending;
  const isUploadingLogo = uploadLogo.isPending;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, or WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Logo file must be smaller than 10MB.');
      return;
    }

    uploadLogo.mutate(file);
  };

  const handleLogoRemove = () => {
    setForm((prev) => ({ ...prev, logoUrl: '' }));
    toast('Logo will be removed on next save.');
  };

  const handleSettingsChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setSettingsText(value);
    if (!value.trim()) {
      setSettingsError(null);
      return;
    }
    try {
      JSON.parse(value);
      setSettingsError(null);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const handleSave = async () => {
    if (settingsError) {
      toast.error('Please fix the settings JSON before saving.');
      return;
    }

    let settingsObj: Record<string, unknown> = {};
    if (settingsText.trim()) {
      try {
        settingsObj = JSON.parse(settingsText);
      } catch {
        toast.error('Invalid settings JSON.');
        return;
      }
    }

    try {
      await updateCompany.mutateAsync({
        name: form.name,
        address: form.address,
        phone: form.phone,
        logoUrl: form.logoUrl,
      });
      await updateSettings.mutateAsync(settingsObj);
      toast.success('Company settings saved.');
      queryClient.invalidateQueries({ queryKey: ['company'] });
    } catch (err: unknown) {
      toast.error(
        err && typeof err === 'object' && 'message' in err
          ? `Failed to save: ${err.message as string}`
          : 'Failed to save company settings.'
      );
    }
  };

  const handleReset = () => {
    refetch();
    toast('Reset to last saved values.');
  };

  const renderLogoPreview = () => {
    if (form.logoUrl) {
      return (
        <img
          src={resolveFileUrl(form.logoUrl)}
          alt={form.name || 'Company logo'}
          className="h-20 w-20 rounded-lg object-cover border border-border"
        />
      );
    }
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-border bg-[hsl(var(--background-elevated))]">
        <Upload size={32} className="text-text-tertiary" />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="mb-4 animate-spin text-primary" />
          <p className="text-text-secondary">Loading company settings…</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="py-12 text-center text-text-secondary">
        No company data available.
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">
            Company Settings
          </h1>
          <p className="text-text-secondary">
            Manage your company profile, logo, subscription, and advanced
            settings.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={16} />}
          isLoading={isFetching}
          onClick={() => refetch()}
        >
          Refresh
        </Button>
      </div>

      {(isError || updateCompany.isError || updateSettings.isError) && (
        <div className="mb-4 rounded-lg border border-red/20 bg-red/10 p-3 text-sm text-red">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>
              {isError
                ? error instanceof Error
                  ? error.message
                  : 'Failed to load company settings.'
                : 'Failed to save changes.'}
            </span>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
        className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      >
        {/* Left column: profile, logo, settings */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Company Information" subtitle="Basic company details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-text-secondary"
                >
                  Company Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  className="input mt-1"
                  placeholder="Acme Roofing Inc."
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-text-secondary"
                >
                  Phone
                </label>
                <div className="relative mt-1">
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    className="input pl-10"
                    placeholder="(555) 123-4567"
                  />
                  <Phone
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="address"
                  className="block text-sm font-medium text-text-secondary"
                >
                  Address
                </label>
                <textarea
                  id="address"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  className="input mt-1 min-h-[80px] w-full resize-y"
                  placeholder="123 Business St, City, State 12345"
                  rows={3}
                />
              </div>
            </div>
          </Card>

          <Card
            title="Company Logo"
            subtitle="PNG, JPG, or WebP up to 10MB"
          >
            <div className="flex items-start gap-6">
              {renderLogoPreview()}
              <div className="flex flex-col gap-2">
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleLogoChange}
                  disabled={isUploadingLogo}
                  className="hidden"
                />
                <label htmlFor="logo-upload" className="block">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Upload size={16} />}
                    isLoading={isUploadingLogo}
                    onClick={() =>
                      document.getElementById('logo-upload')?.click()
                    }
                  >
                    {form.logoUrl ? 'Change Logo' : 'Upload Logo'}
                  </Button>
                </label>
                {form.logoUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={16} />}
                    onClick={handleLogoRemove}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card
            title="Advanced Settings"
            subtitle="JSON configuration for your company"
          >
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="text-sm font-medium text-text-primary">
                Settings JSON editor
              </span>
              {showAdvanced ? (
                <ChevronUp size={18} className="text-text-tertiary" />
              ) : (
                <ChevronDown size={18} className="text-text-tertiary" />
              )}
            </button>

            {showAdvanced && (
              <div className="mt-3">
                <textarea
                  value={settingsText}
                  onChange={handleSettingsChange}
                  className="input mt-2 font-mono text-xs"
                  rows={10}
                  spellCheck={false}
                />
                {settingsError ? (
                  <div className="mt-2 flex items-start gap-2 text-xs text-red">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>{settingsError}</span>
                  </div>
                ) : (
                  <div className="mt-2 flex items-start gap-2 text-xs text-text-tertiary">
                    <HelpCircle size={14} className="mt-0.5 shrink-0" />
                    <span>
                      Edit your company settings as JSON. This object is
                      stored verbatim and can power integrations, custom
                      fields, and automation rules.
                    </span>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right column: subscription tier */}
        <div className="lg:col-span-1">
          <Card
            title="Subscription"
            subtitle="Your current plan"
            className="lg:sticky lg:top-6 lg:self-start"
          >
            <div className="flex items-center gap-3">
              <Badge variant={tierBadgeVariant(company.subscriptionTier)}>
                {company.subscriptionTier}
              </Badge>
              <Badge variant="success" size="sm">
                Active
              </Badge>
            </div>

            <p className="mt-4 text-sm text-text-secondary">
              Current plan: {company.subscriptionTier}
            </p>

            <div className="mt-4 space-y-1">
              <p className="text-xs font-medium uppercase text-text-tertiary">
                Features included
              </p>
              <ul className="space-y-1.5">
                {TIER_FEATURES[company.subscriptionTier].features.map(
                  (feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm text-text-secondary"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" />
                      {feature}
                    </li>
                  )
                )}
              </ul>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-[hsl(var(--background-accent))] p-3 text-xs text-text-tertiary">
              <HelpCircle size={14} className="inline mr-1" />
              Contact sales to upgrade your plan.
            </div>
          </Card>
        </div>

        {/* Form actions */}
        <div className="lg:col-span-3 flex items-center justify-end gap-3 border-t border-border pt-4">
          <Button
            variant="ghost"
            onClick={handleReset}
            disabled={isSaving || isUploadingLogo}
          >
            Reset
          </Button>
          <Button
            leftIcon={<Save size={16} />}
            isLoading={isSaving}
            onClick={() => void handleSave()}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CompanySettings;
