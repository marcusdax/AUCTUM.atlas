/**
 * Helios Intelligence — Customer & Insurance Adjuster Storm Brief Copilot
 * Converts configured BYOK LLM / deterministic fallback engines into actionable
 * homeowner talking points, adjuster documentation, and lead follow-up queues.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Brain,
  Check,
  Copy,
  Download,
  FileText,
  Key,
  Sparkles,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Signal } from '../../components/primitives/Signal';
import { Metric } from '../../components/primitives/Metric';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { aiApi, describeAiError } from '../../services/ai';
import type { StormBriefFocus, StormBriefResponse } from '../../types/ai';

const FOCUS_OPTIONS: Array<{ value: StormBriefFocus; label: string }> = [
  { value: 'damage', label: 'Adjuster Damage Brief' },
  { value: 'leads', label: 'Canvassing & Homeowner Outreach' },
  { value: 'operations', label: 'Crew & Materials Dispatch' },
  { value: 'safety', label: 'Safety & Tarping Priorities' },
];

const HeliosIntelligencePage: React.FC = () => {
  const [selectedStormId, setSelectedStormId] = useState<string>('ALL');
  const [focus, setFocus] = useState<StormBriefFocus>('damage');
  const [briefResult, setBriefResult] = useState<StormBriefResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['helios', 'ai-status'],
    queryFn: () => aiApi.status(),
    staleTime: 30_000,
  });

  const overviewQuery = useQuery({
    queryKey: ['helios', 'storm-overview'],
    queryFn: () => aiApi.stormOverview(14),
    staleTime: 60_000,
  });

  const briefMutation = useMutation({
    mutationFn: () =>
      aiApi.stormBrief({
        focus,
        days: 14,
        ...(selectedStormId !== 'ALL' ? { stormIds: [selectedStormId] } : {}),
      }),
    onSuccess: (res) => {
      setBriefResult(res);
      toast.success(
        res.source === 'llm'
          ? `Brief generated via ${res.providerId} (${res.model}).`
          : 'Brief generated via Deterministic Local Engine.'
      );
    },
    onError: (err) => toast.error(describeAiError(err)),
  });

  const statusData = statusQuery.data;
  const activeProviders = (statusData?.providers ?? []).filter((p) => p.configured && p.enabled);
  const events = overviewQuery.data?.events ?? [];
  const leads = (overviewQuery.data?.leads ?? []).slice().sort((a, b) => b.score - a.score);

  const formatBriefMarkdown = (res: StormBriefResponse) => {
    const b = res.brief;
    return [
      `# ${b.title}`,
      `Generated: ${res.generatedAt} · Engine: ${res.providerId} (${res.model})`,
      `Severity: ${b.severity} · Deterministic Risk Score: ${b.riskScore}/100 · Confidence: ${Math.round(b.confidence * 100)}%`,
      '',
      '## Executive Summary',
      b.summary,
      '',
      '## Observed Damage Vectors',
      ...(b.damageTypes.length ? b.damageTypes.map((d) => `- ${d}`) : ['- Inspection required']),
      '',
      '## Affected Communities',
      ...(b.affectedAreas.length ? b.affectedAreas.map((a) => `- ${a}`) : ['- Territory wide']),
      '',
      '## Homeowner & Adjuster Action Checklist',
      ...b.recommendedActions.map((act) => `- [ ] ${act}`),
      '',
      '## Priority Lead Zones',
      ...b.leadOpportunities.map((op) => `- **${op.area}** (${op.priority}): ${op.reason}`),
      '',
      '## Safety Notes',
      ...b.safetyNotes.map((s) => `- ${s}`),
    ].join('\n');
  };

  const handleCopy = async () => {
    if (!briefResult) return;
    await navigator.clipboard.writeText(formatBriefMarkdown(briefResult));
    setCopied(true);
    toast.success('Customer & adjuster brief copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!briefResult) return;
    const md = formatBriefMarkdown(briefResult);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auctum-storm-brief-${focus}.md`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="h-full space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
            <Zap size={28} className="text-amber" aria-hidden="true" />
            Helios Brief Copilot
          </h1>
          <p className="text-text-secondary mt-1">
            Generate customer-ready homeowner presentations, insurance supplement briefs, and canvass plans from live storm telemetry
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/settings/ai"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-[hsl(var(--background-accent))]"
          >
            <Key size={14} />
            Configure BYOK Keys
          </Link>
          <Signal
            label={activeProviders.length > 0 ? 'BYOK LLM Ready' : 'Deterministic Engine'}
            status="ONLINE"
            color="amber"
            pulse
            strength={5}
            type="ai"
            description="Storm & Claim Brief Generator"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          title="ROUTING MODE"
          value={(statusData?.routing?.strategy || 'balanced').toUpperCase()}
          state="LIVE"
          pulse
          hint={`${activeProviders.length} BYOK provider(s) configured`}
        />
        <Metric
          title="DETERMINISTIC FALLBACK"
          value={statusData?.localFallback?.available !== false ? 'READY' : 'OFFLINE'}
          state="LIVE"
          hint={statusData?.localFallback?.engine || 'Local rule engine'}
        />
        <Metric
          title="AI REQUESTS (7D)"
          value={statusData?.usage?.last7d?.requests ?? 0}
          state="LIVE"
          hint={`${statusData?.usage?.last7d?.tokens ?? 0} total tokens`}
        />
        <Metric
          title="STORMS IN SCOPE"
          value={events.length}
          state="LIVE"
          hint={`${leads.length} matched properties ready`}
        />
      </div>

      {/* Interactive Adjuster & Homeowner Brief Generator */}
      <Card
        title="Customer & Insurance Supplement Brief Generator"
        subtitle="Select a storm scope and operational angle to produce a downloadable brief grounded in your company's real storm data"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px]">
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Storm Event Scope
              </label>
              <select
                value={selectedStormId}
                onChange={(e) => setSelectedStormId(e.target.value)}
                className="input text-sm"
              >
                <option value="ALL">All Active Swaths ({events.length})</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.severity})
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[220px]">
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Document Focus
              </label>
              <select
                value={focus}
                onChange={(e) => setFocus(e.target.value as StormBriefFocus)}
                className="input text-sm"
              >
                {FOCUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Sparkles size={15} />}
              isLoading={briefMutation.isPending}
              onClick={() => briefMutation.mutate()}
            >
              Generate Brief
            </Button>
            {briefResult && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
                  onClick={handleCopy}
                >
                  {copied ? 'Copied' : 'Copy Markdown'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Download size={14} />}
                  onClick={handleDownload}
                >
                  Download .MD
                </Button>
              </>
            )}
          </div>

          {briefResult ? (
            <div className="space-y-4 rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">{briefResult.brief.title}</h3>
                  <p className="text-xs text-text-tertiary">
                    Generated by {briefResult.providerId} ({briefResult.model}) · {briefResult.latencyMs} ms · Risk
                    Score {briefResult.brief.riskScore}/100 ({briefResult.brief.severity})
                  </p>
                </div>
                <span className="rounded bg-amber/10 px-2.5 py-1 font-mono text-xs font-medium text-amber">
                  {briefResult.source === 'llm' ? 'LLM Enhanced' : 'Deterministic Verified'}
                </span>
              </div>
              <p className="text-sm text-text-primary leading-relaxed">{briefResult.brief.summary}</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-text-tertiary mb-2">
                    Homeowner &amp; Field Action Plan
                  </p>
                  <ul className="space-y-1.5 text-sm text-text-secondary">
                    {briefResult.brief.recommendedActions.map((act, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <FileText size={14} className="mt-0.5 shrink-0 text-amber" />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-text-tertiary mb-2">
                    High-Value Area Opportunities
                  </p>
                  <ul className="space-y-1.5 text-sm text-text-secondary">
                    {briefResult.brief.leadOpportunities.map((op, i) => (
                      <li key={i}>
                        <span className="font-medium text-text-primary">{op.area}</span> ({op.priority}):{' '}
                        {op.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-secondary">
              Click <strong>Generate Brief</strong> above to synthesize live NOAA swaths, matched CRM properties,
              and field evidence into a shareable homeowner or adjuster brief.
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Priority Homeowner Follow-Up Queue" subtitle="Highest-scoring leads ready for estimate creation">
          <div className="space-y-3">
            {leads.length === 0 ? (
              <p className="text-sm text-text-secondary">
                No scored leads available yet. Open <Link to="/storm-tracking" className="underline">Storm Map</Link> to score properties.
              </p>
            ) : (
              leads.slice(0, 6).map((lead) => (
                <div
                  key={lead.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-3"
                >
                  <div>
                    <p className="font-medium text-text-primary">{lead.name}</p>
                    <p className="text-xs text-text-tertiary">{lead.address}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-emerald/10 px-2 py-0.5 font-mono text-xs font-medium text-emerald">
                      Score {lead.score}
                    </span>
                    <Link
                      to="/estimates/new"
                      className="rounded border border-border px-2.5 py-1 text-xs text-text-primary hover:bg-[hsl(var(--background-accent))]"
                    >
                      New Estimate
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card title="Configured AI Providers & Failover Chain" subtitle="Manage keys cleanly from Settings -> AI">
          <div className="space-y-3">
            {(statusData?.providers ?? []).length === 0 ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-3">
                <div className="flex items-center gap-3">
                  <Brain size={18} className="text-amber" />
                  <div>
                    <p className="font-medium text-text-primary">Deterministic Local Engine</p>
                    <p className="text-xs text-text-tertiary">Zero external API cost · Always online</p>
                  </div>
                </div>
                <Link to="/settings/ai" className="text-xs underline text-text-primary">
                  Add BYOK Provider
                </Link>
              </div>
            ) : (
              (statusData?.providers ?? []).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-3"
                >
                  <div>
                    <p className="font-medium text-text-primary">{p.name}</p>
                    <p className="text-xs text-text-tertiary">
                      Priority #{p.priority} · {p.models.slice(0, 2).join(', ') || p.kind}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      p.configured && p.enabled ? 'bg-emerald/10 text-emerald' : 'bg-amber/10 text-amber'
                    }`}
                  >
                    {p.configured && p.enabled ? 'ACTIVE' : 'UNCONFIGURED'}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HeliosIntelligencePage;
