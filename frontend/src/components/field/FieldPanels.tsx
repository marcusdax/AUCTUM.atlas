/**
 * Field Hub Sprint 2 panels:
 *  - OperatorOnboardingPanel (5-step resumable setup + SHA-256 agreement + Android pairing)
 *  - SealPacketPanel (consent-gated objective capture & SHA-256 sealing)
 *  - VaultPanel (sealed packets, genesis chain verification, custody export)
 *  - PayoutsPanel (derived integer-cent balances, fee-disclosed quotes, append-only ledger)
 *  - BriefPanel (operating rules, what Fieldwright refuses to do, APK download)
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Copy,
  Download,
  FileCheck2,
  Lock,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { api } from '../../services/api';

export interface OperatorProfile {
  id: string;
  userId: string;
  w9Status: 'UNSUBMITTED' | 'SUBMITTED' | 'VERIFIED';
  agreementHash: string | null;
  agreementSignedAt: string | null;
  tools: string[];
  serviceRadiusKm: number;
  devicePaired: boolean;
  pairingCode: string | null;
}

export interface EvidencePacketRow {
  id: string;
  code: string;
  title: string;
  consentName: string;
  consentRole: string;
  consentScope: string;
  consentMethod: string;
  consentHash: string;
  headHash: string;
  merkleLeaf: string;
  tier: number;
  sealState: string;
  demo: boolean;
  sealedAt: string;
  recordsJson: Array<{ seq: number; kind: string; summary: string; hash: string }>;
  c2paManifestJson?: {
    specVersion?: string;
    signature?: { alg?: string; manifestDigest?: string };
  } | null;
  rekorAnchorJson?: {
    mode?: string;
    logIndex?: number;
    inclusionDigest?: string;
  } | null;
}

interface LedgerRow {
  id: string;
  kind: string;
  amountCents: number;
  status: string;
  description: string;
  createdAt: string;
}

interface PayoutQuote {
  amountCents: number;
  feeCents: number;
  netCents: number;
  mode: 'STANDARD' | 'INSTANT';
  etaLabel: string;
  feeDisclosure: string;
}

const TOOL_OPTIONS = [
  { id: 'PHONE_CAMERA', label: 'Android Camera' },
  { id: 'DRONE_PART_107', label: 'Part 107 Drone' },
  { id: 'LIDAR_RIG', label: 'LiDAR Rig' },
  { id: 'THERMAL_CAM', label: 'Thermal Sensor' },
  { id: 'RPZ_GAUGE', label: 'RPZ Gauge' },
];

const fmtCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// ── 1. 5-Step Operator Onboarding ────────────────────────────────────────

export const OperatorOnboardingPanel: React.FC<{
  profile: OperatorProfile | undefined;
  userEmail: string;
  onRadiusSync: (km: number) => void;
}> = ({ profile, userEmail, onRadiusSync }) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const update = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.put<{ data: OperatorProfile }>('/field/profile', payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['field-profile'] });
      if (res.data?.data?.serviceRadiusKm) {
        onRadiusSync(res.data.data.serviceRadiusKm);
      }
    },
  });

  if (!profile) return null;

  const stepsDone = [
    Boolean(userEmail),
    profile.w9Status !== 'UNSUBMITTED',
    Boolean(profile.agreementHash),
    profile.tools.length > 0,
    profile.devicePaired,
  ];
  const completedCount = stepsDone.filter(Boolean).length;

  const toggleTool = (toolId: string) => {
    const next = profile.tools.includes(toolId)
      ? profile.tools.filter((t) => t !== toolId)
      : [...profile.tools, toolId];
    update.mutate({ tools: next });
  };

  return (
    <section
      aria-label="Operator onboarding"
      className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-3.5 text-text-primary"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CheckCircle2
            size={18}
            className={completedCount === 5 ? 'text-[hsl(var(--emerald))]' : 'text-text-secondary'}
            aria-hidden="true"
          />
          <div>
            <div className="text-sm font-semibold text-text-primary">
              Operator Setup: {completedCount}/5 steps complete
            </div>
            <div className="text-xs text-text-secondary">
              W-9: {profile.w9Status} · Agreement:{' '}
              {profile.agreementHash ? `Signed (${profile.agreementHash.slice(0, 8)}…)` : 'Pending'} ·{' '}
              Android: {profile.devicePaired ? 'Device paired' : 'Not paired'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-1.5 text-xs font-medium border border-[hsl(var(--border-hover))] bg-[hsl(var(--background-elevated))] text-text-primary hover:bg-[hsl(var(--background-accent))]"
        >
          {open ? 'Hide Onboarding' : completedCount === 5 ? 'Edit Profile & Pairing' : 'Finish Setup'}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 md:grid-cols-5 border-t border-[hsl(var(--border))] pt-4 text-xs">
          <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] p-3 space-y-1.5">
            <div className="font-mono uppercase text-[0.625rem] text-text-tertiary">1. Account</div>
            <div className="font-medium text-text-primary break-all">{userEmail}</div>
            <div className="text-[hsl(var(--emerald))] font-mono">Verified session</div>
          </div>

          <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] p-3 space-y-2">
            <div className="font-mono uppercase text-[0.625rem] text-text-tertiary">2. Tax &amp; W-9</div>
            <div className="text-text-secondary">Status: <strong className="text-text-primary">{profile.w9Status}</strong></div>
            {profile.w9Status === 'UNSUBMITTED' && (
              <button
                type="button"
                disabled={update.isPending}
                onClick={() => update.mutate({ w9Status: 'SUBMITTED' })}
                className="w-full py-1.5 px-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium"
              >
                Submit Demo W-9
              </button>
            )}
          </div>

          <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] p-3 space-y-2">
            <div className="font-mono uppercase text-[0.625rem] text-text-tertiary">3. 1099 Agreement</div>
            <p className="text-text-secondary leading-snug">
              You choose jobs, hours &amp; order. Decline with zero penalty. No exclusivity.
            </p>
            {profile.agreementHash ? (
              <div className="font-mono text-[0.6875rem] text-[hsl(var(--emerald))] break-all">
                SHA-256: {profile.agreementHash.slice(0, 12)}…
              </div>
            ) : (
              <button
                type="button"
                disabled={update.isPending}
                onClick={() => update.mutate({ signAgreement: true })}
                className="w-full py-1.5 px-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium"
              >
                Sign &amp; Hash Agreement
              </button>
            )}
          </div>

          <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] p-3 space-y-2">
            <div className="font-mono uppercase text-[0.625rem] text-text-tertiary">4. Tools &amp; Radius</div>
            <div className="space-y-1">
              {TOOL_OPTIONS.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5 text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profile.tools.includes(t.id)}
                    onChange={() => toggleTool(t.id)}
                    className="accent-[hsl(var(--primary))]"
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] p-3 space-y-2">
            <div className="font-mono uppercase text-[0.625rem] text-text-tertiary">5. Pair Android App</div>
            {profile.pairingCode ? (
              <div className="font-mono text-sm font-bold text-text-primary">
                {profile.pairingCode}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => update.mutate({ generatePairing: true })}
                className="w-full py-1.5 px-2 border border-[hsl(var(--border-hover))] text-text-primary"
              >
                Generate Pair Code
              </button>
            )}
            {!profile.devicePaired && profile.pairingCode && (
              <button
                type="button"
                onClick={() => update.mutate({ confirmPairing: true })}
                className="w-full py-1.5 px-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium"
              >
                Confirm Device Paired
              </button>
            )}
            <a
              href="/downloads/fieldwright-debug.apk"
              download="fieldwright-debug.apk"
              className="inline-flex items-center gap-1 underline text-text-secondary hover:text-text-primary"
            >
              <Smartphone size={12} aria-hidden="true" /> Get Fieldwright .apk
            </a>
          </div>
        </div>
      )}
    </section>
  );
};

// ── 2. Consent-Gated Capture & Seal Panel ────────────────────────────────

export const SealPacketPanel: React.FC<{
  queueItemId: string;
  jobName: string;
  onCancel: () => void;
  onSealed: () => void;
}> = ({ queueItemId, jobName, onCancel, onSealed }) => {
  const qc = useQueryClient();
  const [consentName, setConsentName] = useState('Dana Whitfield');
  const [consentRole, setConsentRole] = useState('Homeowner');
  const [consentScope, setConsentScope] = useState(
    'Exterior roof surfaces, slopes & gutters. Not the interior. Not faces or plates.',
  );
  const [measurementMeters, setMeasurementMeters] = useState('0.9');
  const [referenceLabel, setReferenceLabel] = useState('Shingle course (90 cm)');
  const [notes, setNotes] = useState('Objective exterior frames captured with calibrated reference.');

  const seal = useMutation({
    mutationFn: () =>
      api.post(`/field/queue/${queueItemId}/seal`, {
        consentName,
        consentRole,
        consentScope,
        consentMethod: 'IN_APP_SIGNATURE',
        measurementMeters: Number(measurementMeters),
        referenceLabel,
        notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-queue'] });
      qc.invalidateQueries({ queryKey: ['field-packets'] });
      qc.invalidateQueries({ queryKey: ['field-payouts'] });
      onSealed();
    },
  });

  return (
    <section
      aria-label="Consent and seal packet"
      className="border border-[hsl(var(--primary))] bg-[hsl(var(--background-card))] p-4 space-y-3 text-text-primary"
    >
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-2">
        <div>
          <h3 className="font-semibold text-text-primary flex items-center gap-2">
            <Lock size={15} aria-hidden="true" />
            Consent Gate &amp; Seal Packet · {jobName}
          </h3>
          <p className="text-xs text-text-secondary">
            Objective measurements only (TREC safe harbor). No valuations or opinions permitted.
          </p>
        </div>
        <button type="button" onClick={onCancel} className="text-xs underline text-text-secondary">
          Cancel
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 text-xs">
        <label className="block space-y-1 text-text-secondary">
          <span>Authorizing Person (Consent Required)</span>
          <input
            type="text"
            value={consentName}
            onChange={(e) => setConsentName(e.target.value)}
            className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary px-2.5 py-1.5"
          />
        </label>
        <label className="block space-y-1 text-text-secondary">
          <span>Role</span>
          <input
            type="text"
            value={consentRole}
            onChange={(e) => setConsentRole(e.target.value)}
            className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary px-2.5 py-1.5"
          />
        </label>
        <label className="block space-y-1 sm:col-span-2 text-text-secondary">
          <span>Consented Scope (Recorded verbatim in packet)</span>
          <input
            type="text"
            value={consentScope}
            onChange={(e) => setConsentScope(e.target.value)}
            className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary px-2.5 py-1.5"
          />
        </label>
        <label className="block space-y-1 text-text-secondary">
          <span>Calibrated Span (meters)</span>
          <input
            type="number"
            step="0.01"
            min="0.05"
            value={measurementMeters}
            onChange={(e) => setMeasurementMeters(e.target.value)}
            className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary px-2.5 py-1.5"
          />
        </label>
        <label className="block space-y-1 text-text-secondary">
          <span>Physical Reference</span>
          <select
            value={referenceLabel}
            onChange={(e) => setReferenceLabel(e.target.value)}
            className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary px-2.5 py-1.5"
          >
            <option value="Site card (30 cm)">Site card (30 cm)</option>
            <option value="Shingle course (90 cm)">Shingle course (90 cm)</option>
            <option value="Standard door (91 cm)">Standard door (91 cm)</option>
          </select>
        </label>
        <label className="block space-y-1 sm:col-span-2 text-text-secondary">
          <span>Objective Observation Notes</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary px-2.5 py-1.5"
          />
        </label>
      </div>

      {seal.isError && (
        <p role="alert" className="text-xs text-[hsl(var(--red))]">
          {(seal.error as any)?.response?.data?.error || 'Could not seal packet.'}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={seal.isPending || !consentName.trim()}
          onClick={() => seal.mutate()}
          className="px-4 py-2 text-sm font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50"
        >
          {seal.isPending ? 'Hashing & Sealing…' : 'Record Consent & Seal SHA-256 Packet'}
        </button>
      </div>
    </section>
  );
};

// ── 3. Vault Panel ───────────────────────────────────────────────────────

export const VaultPanel: React.FC = () => {
  const [verifyMap, setVerifyMap] = useState<Record<string, { valid: boolean; detail: string }>>({});
  const [exportText, setExportText] = useState<string | null>(null);

  const packets = useQuery({
    queryKey: ['field-packets'],
    queryFn: async () =>
      (await api.get<{ data: EvidencePacketRow[] }>('/field/packets')).data.data,
  });

  const verify = async (id: string) => {
    const res = await api.post<{ data: { valid: boolean; detail: string } }>(
      `/field/packets/${id}/verify`,
    );
    setVerifyMap((m) => ({ ...m, [id]: res.data.data }));
  };

  const exportPacket = async (id: string) => {
    const res = await api.get<{ data: { custodyText: string; canonicalJson: string } }>(
      `/field/packets/${id}/export`,
    );
    setExportText(`${res.data.data.custodyText}\n\nCanonical JSON:\n${res.data.data.canonicalJson}`);
  };

  const rows = packets.data ?? [];

  return (
    <section aria-label="Evidence vault" className="space-y-4 text-text-primary">
      {packets.isLoading && <p className="text-sm text-text-secondary">Loading sealed packets…</p>}
      {!packets.isLoading && rows.length === 0 && (
        <p className="text-sm text-text-secondary">
          No sealed packets yet. Schedule a queued job, start capture, and seal it with consent.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((p) => {
          const check = verifyMap[p.id];
          return (
            <article
              key={p.id}
              className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-4 space-y-2.5"
            >
              <div className="h-0.5 w-16 bg-[hsl(var(--emerald))]" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-medium text-text-primary">
                  {p.code} &middot; {p.title}
                </h3>
                <span className="border border-[hsl(var(--border))] px-2 py-0.5 font-mono text-[0.625rem] uppercase text-text-secondary">
                  {p.demo ? 'SAMPLE — excluded from log' : 'SEALED'}
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                Consent: <strong className="text-text-primary">{p.consentName}</strong> ({p.consentRole}) &mdash;{' '}
                {p.consentScope}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-text-tertiary">
                <span>Tier {p.tier} · Verified</span>
                <span>{Array.isArray(p.recordsJson) ? p.recordsJson.length : 3} records</span>
                <span title={p.headHash}>Head {p.headHash.slice(0, 8)}…</span>
                {p.c2paManifestJson?.signature?.manifestDigest && (
                  <span
                    className="border border-emerald/40 bg-emerald/10 px-1.5 py-0.5 text-[10px] text-emerald"
                    title={p.c2paManifestJson.signature.manifestDigest}
                  >
                    C2PA v{p.c2paManifestJson.specVersion || '2.1'}
                  </span>
                )}
                {p.rekorAnchorJson?.logIndex != null && (
                  <span
                    className="border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-primary"
                    title={p.rekorAnchorJson.inclusionDigest}
                  >
                    {p.rekorAnchorJson.mode === 'SIGSTORE_REKOR' ? 'Rekor' : 'Audit Log'} #{p.rekorAnchorJson.logIndex}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(p.headHash)}
                  className="inline-flex items-center gap-1 underline text-text-secondary hover:text-text-primary"
                >
                  <Copy size={11} aria-hidden="true" /> Copy hash
                </button>
              </div>
              {check && (
                <div
                  className={`text-xs font-mono px-2.5 py-1.5 border ${
                    check.valid
                      ? 'border-[hsl(var(--emerald))] text-[hsl(var(--emerald))]'
                      : 'border-[hsl(var(--red))] text-[hsl(var(--red))]'
                  }`}
                >
                  {check.detail}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => verify(p.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                >
                  <ShieldCheck size={13} aria-hidden="true" />
                  Verify Chain
                </button>
                <button
                  type="button"
                  onClick={() => exportPacket(p.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[hsl(var(--border-hover))] bg-[hsl(var(--background-elevated))] text-text-primary"
                >
                  <FileCheck2 size={13} aria-hidden="true" />
                  Export Custody
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {exportText && (
        <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <strong className="text-text-primary">Portable Custody Export</strong>
            <button type="button" onClick={() => setExportText(null)} className="underline text-text-secondary">
              Close
            </button>
          </div>
          <pre className="text-xs font-mono whitespace-pre-wrap break-all text-text-primary">
            {exportText}
          </pre>
        </div>
      )}
    </section>
  );
};

// ── 4. Payouts Panel ─────────────────────────────────────────────────────

export const PayoutsPanel: React.FC = () => {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'STANDARD' | 'INSTANT'>('STANDARD');
  const [amountDollars, setAmountDollars] = useState('50');

  const payoutsQuery = useQuery({
    queryKey: ['field-payouts'],
    queryFn: async () =>
      (
        await api.get<{
          data: {
            balances: { availableCents: number; pendingCents: number; paidLifetimeCents: number };
            entries: LedgerRow[];
          };
        }>('/field/payouts')
      ).data.data,
  });

  const amountCents = Math.max(0, Math.round(Number(amountDollars || 0) * 100));

  const quoteQuery = useQuery({
    queryKey: ['field-payout-quote', amountCents, mode],
    queryFn: async () =>
      (await api.post<{ data: PayoutQuote }>('/field/payouts/quote', { amountCents, mode })).data
        .data,
    enabled: amountCents >= 100,
    retry: false,
  });

  const requestPayout = useMutation({
    mutationFn: () =>
      api.post('/field/payouts', {
        amountCents,
        mode,
        idempotencyKey: `web-${amountCents}-${mode}-${Date.now()}`,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field-payouts'] }),
  });

  const b = payoutsQuery.data?.balances ?? {
    availableCents: 0,
    pendingCents: 0,
    paidLifetimeCents: 0,
  };
  const entries = payoutsQuery.data?.entries ?? [];

  return (
    <section aria-label="Payouts and ledger" className="space-y-5 text-text-primary">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-4">
          <div className="text-xs font-mono uppercase text-text-tertiary">Available</div>
          <div className="text-2xl font-display font-semibold text-text-primary mt-1">
            {fmtCents(b.availableCents)}
          </div>
          <div className="text-xs text-text-secondary mt-1">No platform fee ever charged to worker</div>
        </div>
        <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-4">
          <div className="text-xs font-mono uppercase text-text-tertiary">Pending Review</div>
          <div className="text-2xl font-display font-semibold text-text-primary mt-1">
            {fmtCents(b.pendingCents)}
          </div>
          <div className="text-xs text-text-secondary mt-1">Released when packet seals</div>
        </div>
        <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-4">
          <div className="text-xs font-mono uppercase text-text-tertiary">Paid Lifetime</div>
          <div className="text-2xl font-display font-semibold text-text-primary mt-1">
            {fmtCents(b.paidLifetimeCents)}
          </div>
          <div className="text-xs text-text-secondary mt-1">Mock ledger (no live PSP rail in demo)</div>
        </div>
      </div>

      <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-4 space-y-3">
        <h3 className="font-semibold text-text-primary flex items-center gap-2">
          <Wallet size={16} aria-hidden="true" />
          Request Payout (Fee-Disclosed)
        </h3>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="text-text-secondary">
            Amount ($)
            <input
              type="number"
              min={1}
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
              className="ml-2 w-28 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary px-2 py-1.5"
            />
          </label>
          <label className="text-text-secondary">
            Rail
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'STANDARD' | 'INSTANT')}
              className="ml-2 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary px-2 py-1.5"
            >
              <option value="STANDARD">Standard ACH (Free · 1–3 days)</option>
              <option value="INSTANT">Instant Debit (1.5% · $0.50–$5.00 cap)</option>
            </select>
          </label>
          <button
            type="button"
            disabled={requestPayout.isPending || amountCents <= 0 || amountCents > b.availableCents}
            onClick={() => requestPayout.mutate()}
            className="px-4 py-1.5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium disabled:opacity-40"
          >
            Request Payout
          </button>
        </div>
        {quoteQuery.data && (
          <p className="text-xs font-mono text-text-secondary border-l-2 border-[hsl(var(--emerald))] pl-2.5">
            {quoteQuery.data.feeDisclosure}
          </p>
        )}
        {requestPayout.isError && (
          <p role="alert" className="text-xs text-[hsl(var(--red))]">
            {(requestPayout.error as any)?.response?.data?.error || 'Payout request failed.'}
          </p>
        )}
      </div>

      <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-4 space-y-2">
        <h3 className="font-semibold text-sm text-text-primary">Append-Only Ledger</h3>
        {entries.length === 0 ? (
          <p className="text-xs text-text-secondary">No ledger entries yet. Seal a packet in Queue to earn credits.</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))] text-xs">
            {entries.map((e) => (
              <li key={e.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono uppercase text-text-tertiary mr-2">{e.kind}</span>
                  <span className="text-text-primary">{e.description}</span>
                </div>
                <span className="font-mono font-semibold text-text-primary">
                  {e.amountCents >= 0 ? '+' : ''}
                  {fmtCents(e.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

// ── 5. Brief Panel ───────────────────────────────────────────────────────

export const BriefPanel: React.FC = () => (
  <section aria-label="Operating rules and app download" className="grid gap-4 md:grid-cols-2 text-text-primary">
    <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-4 space-y-2">
      <h3 className="font-display text-lg font-medium text-text-primary">How pay &amp; evidence work</h3>
      <ul className="space-y-1.5 text-sm text-text-secondary list-disc pl-5">
        <li>The payout shown on an offer is yours. Requesters pay the 15% platform fee, never you.</li>
        <li>Standard ACH is free. Instant payout is 1.5%, minimum $0.50, capped at $5.00.</li>
        <li>Money and evidence move independently: a dispute lowers a packet tier, never your ledger math.</li>
        <li>You choose your hours, radius, queue order and whether to skip an offer. No penalty for declining.</li>
      </ul>
    </div>
    <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-4 space-y-3">
      <h3 className="font-display text-lg font-medium text-text-primary">What Fieldwright refuses to do</h3>
      <ul className="space-y-1.5 text-sm text-text-secondary list-disc pl-5">
        <li>No crypto tokens, no speculative wallets, no volatile payouts.</li>
        <li>No GPS spoofing, no covert recording, no background location tracking.</li>
        <li>No face recognition or licence-plate watchlists. Consent scope is a blocking gate.</li>
        <li>Demo captures are always marked SAMPLE and excluded from public transparency logs.</li>
      </ul>
      <div className="pt-2">
        <a
          href="/downloads/fieldwright-debug.apk"
          download="fieldwright-debug.apk"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
        >
          <Download size={15} aria-hidden="true" />
          Download Android Field App (.apk)
        </a>
      </div>
    </div>
  </section>
);
