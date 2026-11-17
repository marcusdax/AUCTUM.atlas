/**
 * Interactive Map -> Storm Intelligence -> Leads conversion demo bar.
 * Shared across StormTracking (/storm-tracking) and AtlasIntelligence (/intelligence/atlas)
 * so operators can click any storm zone or map point and watch it convert into scored Leads.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  KeyRound,
  MapPin,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Card, { Badge } from '../ui/Card';
import Button from '../ui/Button';
import { aiApi, describeAiError } from '../../services/ai';
import type { ConvertMapToLeadsResponse, StormEventSummary } from '../../types/ai';

interface MapToLeadsDemoPanelProps {
  selectedEvent?: StormEventSummary | null;
  selectedPoint?: { lat: number; lng: number } | null;
  activeEventsCount?: number;
  leadsInImpactCount?: number;
}

export const MapToLeadsDemoPanel: React.FC<MapToLeadsDemoPanelProps> = ({
  selectedEvent,
  selectedPoint,
  activeEventsCount = 0,
  leadsInImpactCount = 0,
}) => {
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<ConvertMapToLeadsResponse | null>(null);

  const convertMutation = useMutation({
    mutationFn: () =>
      aiApi.convertMapToLeads({
        ...(selectedEvent?.id && !selectedEvent.id.startsWith('live:')
          ? { eventId: selectedEvent.id, label: selectedEvent.name }
          : {}),
        ...(selectedPoint ? { lat: selectedPoint.lat, lng: selectedPoint.lng } : {}),
        count: 3,
      }),
    onSuccess: (data) => {
      setLastResult(data);
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
      void queryClient.invalidateQueries({ queryKey: ['storm-intel'] });
      void queryClient.invalidateQueries({ queryKey: ['storms'] });
      toast.success(
        `${data.created} new storm lead(s) created (${data.existing} updated) in ${data.zone.name}`
      );
    },
    onError: (err) => {
      toast.error(describeAiError(err));
    },
  });

  const rescoreMutation = useMutation({
    mutationFn: () => aiApi.rescoreLeads(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
      void queryClient.invalidateQueries({ queryKey: ['storm-intel'] });
      toast.success(`Rescored ${res.scored} geocoded lead(s) (${res.updated} updated)`);
    },
    onError: (err) => {
      toast.error(describeAiError(err));
    },
  });

  const targetDescription = selectedPoint
    ? `Clicked Map Coordinates (${selectedPoint.lat.toFixed(3)}, ${selectedPoint.lng.toFixed(3)})`
    : selectedEvent
      ? `Selected Storm: ${selectedEvent.name} (${selectedEvent.severity})`
      : 'Default Active Storm / Click anywhere on the map to target a specific parcel cluster';

  const sectorQuery = lastResult?.leads[0]?.propertyAddress.split('Sector ')[1] || '';

  return (
    <Card
      title="Map → Intelligence → Leads Live Flow"
      subtitle="Select a storm polygon or click the map, score impact, and push parcel opportunities straight into CRM Leads & Field Dispatch."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-[hsl(var(--background-accent))]/50 p-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="info" size="sm">
                <MapPin size={12} className="mr-1" aria-hidden="true" />
                Target Zone
              </Badge>
              <span className="font-medium text-text-primary">{targetDescription}</span>
            </div>
            <p className="text-xs text-text-tertiary">
              Live context: <strong className="text-text-primary">{activeEventsCount}</strong> active storm event(s) ·{' '}
              <strong className="text-text-primary">{leadsInImpactCount}</strong> lead(s) currently inside impact radius
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={() => rescoreMutation.mutate()}
              isLoading={rescoreMutation.isPending}
            >
              Rescore Existing Leads
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Sparkles size={14} />}
              onClick={() => convertMutation.mutate()}
              isLoading={convertMutation.isPending}
            >
              Convert Map Zone → Leads
            </Button>
          </div>
        </div>

        {lastResult && (
          <div className="space-y-2 rounded-lg border border-emerald/40 bg-emerald/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald">
                <CheckCircle2 size={14} aria-hidden="true" />
                Converted {lastResult.zone.name} · {lastResult.created} created, {lastResult.existing} refreshed · Zone impact {lastResult.zone.impactScore}/100
              </span>
              <Link
                to={sectorQuery ? `/leads?search=${encodeURIComponent(sectorQuery)}` : '/leads'}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline hover:opacity-80"
              >
                Open converted leads in Pipeline
                <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {lastResult.leads.map((lead) => (
                <Link
                  key={lead.id}
                  to={`/leads?search=${encodeURIComponent(lead.lastName)}`}
                  className="rounded-md border border-border bg-[hsl(var(--background-card))] p-2.5 text-xs transition-colors hover:border-border-hover"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-text-primary">
                      {lead.firstName} {lead.lastName}
                    </span>
                    <Badge variant={lead.score >= 60 ? 'severe' : 'info'} size="sm">
                      Score {lead.score}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-text-secondary">{lead.propertyAddress}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-tertiary">
            Value Chain Links:
          </span>
          <Link
            to="/leads?source=STORM_EVENT"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-[hsl(var(--background-elevated))] px-2.5 py-1 text-text-primary hover:bg-[hsl(var(--background-accent))]"
          >
            <Users size={12} aria-hidden="true" />
            Storm Leads Pipeline
          </Link>
          <Link
            to="/field"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-[hsl(var(--background-elevated))] px-2.5 py-1 text-text-primary hover:bg-[hsl(var(--background-accent))]"
          >
            <Briefcase size={12} aria-hidden="true" />
            Field Hub Dispatch
          </Link>
          <Link
            to="/reports?tab=pipeline"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-[hsl(var(--background-elevated))] px-2.5 py-1 text-text-primary hover:bg-[hsl(var(--background-accent))]"
          >
            <BarChart3 size={12} aria-hidden="true" />
            Pipeline Report
          </Link>
          <Link
            to="/settings/ai"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-[hsl(var(--background-elevated))] px-2.5 py-1 text-text-primary hover:bg-[hsl(var(--background-accent))]"
          >
            <KeyRound size={12} aria-hidden="true" />
            AI Keys &amp; Read Check
          </Link>
        </div>
      </div>
    </Card>
  );
};

export default MapToLeadsDemoPanel;
