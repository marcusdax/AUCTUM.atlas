/**
 * Storm zone -> leads.
 * Shared by StormTracking (/storm-tracking) and AtlasIntelligence.
 *
 * Pick a storm outline or click the map, then pull leads for that zone:
 *   - existing leads inside it are linked to the storm and rescored;
 *   - real street addresses inside it (MapMap / OpenStreetMap) that are not leads
 *     yet become canvass leads, homeowner "not yet identified". Nothing is invented.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, BarChart3, Briefcase, CheckCircle2, MapPin, RefreshCw, Target, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Card, { Badge } from '../ui/Card';
import Button from '../ui/Button';
import { aiApi, describeAiError } from '../../services/ai';
import type { ConvertedLead, ConvertMapToLeadsResponse, StormEventSummary } from '../../types/ai';

interface MapToLeadsDemoPanelProps {
  selectedEvent?: StormEventSummary | null;
  selectedPoint?: { lat: number; lng: number } | null;
  activeEventsCount?: number;
  leadsInImpactCount?: number;
}

const RADIUS_OPTIONS = [0.5, 1, 2, 3];
const MAX_NEW_OPTIONS = [10, 25, 50, 100];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function LeadList({ title, leads, empty }: { title: string; leads: ConvertedLead[]; empty: string }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">{title}</h4>
      {leads.length === 0 ? (
        <p className="text-xs text-text-tertiary">{empty}</p>
      ) : (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {leads.slice(0, 12).map((lead) => (
            <li key={lead.id}>
              <Link
                to={`/leads/${lead.id}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-[hsl(var(--background-card))] px-2.5 py-2 text-xs hover:border-border-hover"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-text-primary">{lead.propertyAddress}</span>
                  <span className="block truncate text-text-tertiary">
                    {lead.firstName} {lead.lastName}
                  </span>
                </span>
                <Badge variant={lead.stormImpactScore >= 60 ? 'severe' : 'info'} size="sm">
                  {lead.stormImpactScore}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {leads.length > 12 && <p className="text-xs text-text-tertiary">and {leads.length - 12} more in the Leads pipeline.</p>}
    </div>
  );
}

export const MapToLeadsDemoPanel: React.FC<MapToLeadsDemoPanelProps> = ({
  selectedEvent,
  selectedPoint,
  activeEventsCount = 0,
  leadsInImpactCount = 0,
}) => {
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<ConvertMapToLeadsResponse | null>(null);
  const [radiusKm, setRadiusKm] = useState(1);
  const [maxNew, setMaxNew] = useState(25);

  const eventId = selectedEvent?.id && !selectedEvent.id.startsWith('live:') ? selectedEvent.id : undefined;
  const canPull = Boolean(selectedPoint || eventId);

  const convertMutation = useMutation({
    mutationFn: () =>
      aiApi.convertMapToLeads({
        ...(eventId ? { eventId, label: selectedEvent!.name } : {}),
        ...(selectedPoint ? { lat: selectedPoint.lat, lng: selectedPoint.lng, radiusKm } : {}),
        count: maxNew,
      }),
    onSuccess: (data) => {
      setLastResult(data);
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
      void queryClient.invalidateQueries({ queryKey: ['storm-intel'] });
      void queryClient.invalidateQueries({ queryKey: ['storms'] });
      toast.success(
        `${data.zone.name}: ${plural(data.existing, 'existing lead')} flagged, ${plural(data.created, 'new canvass lead')}`
      );
    },
    onError: (err) => toast.error(describeAiError(err)),
  });

  const rescoreMutation = useMutation({
    mutationFn: () => aiApi.rescoreLeads(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
      void queryClient.invalidateQueries({ queryKey: ['storm-intel'] });
      toast.success(`Rescored ${plural(res.scored, 'located lead')} (${res.updated} changed)`);
    },
    onError: (err) => toast.error(describeAiError(err)),
  });

  const target = selectedPoint
    ? `${radiusKm} km around (${selectedPoint.lat.toFixed(4)}, ${selectedPoint.lng.toFixed(4)})`
    : selectedEvent
      ? eventId
        ? `${selectedEvent.name} (${selectedEvent.severity}), its own outline`
        : `${selectedEvent.name}: a live alert. Click inside it on the map to pull leads there.`
      : 'Select a storm outline or click the map to choose a zone.';

  const lookup = lastResult?.addressLookup;

  return (
    <Card
      title="Storm zone → Leads"
      subtitle="Flags the leads you already have inside a storm zone and adds every real street address in it as a canvass lead."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border bg-[hsl(var(--background-accent))]/50 p-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="info" size="sm">
                <MapPin size={12} className="mr-1" aria-hidden="true" />
                Zone
              </Badge>
              <span className="font-medium text-text-primary">{target}</span>
            </div>
            <p className="text-xs text-text-tertiary">
              <strong className="text-text-primary">{activeEventsCount}</strong> active storm events ·{' '}
              <strong className="text-text-primary">{leadsInImpactCount}</strong> leads inside an impact radius now
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            {selectedPoint && (
              <label className="text-xs text-text-secondary">
                <span className="mb-1 block">Radius</span>
                <select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="rounded-md border border-border bg-[hsl(var(--background-card))] px-2 py-1.5 text-text-primary"
                >
                  {RADIUS_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r} km
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-xs text-text-secondary">
              <span className="mb-1 block">New leads, at most</span>
              <select
                value={maxNew}
                onChange={(e) => setMaxNew(Number(e.target.value))}
                className="rounded-md border border-border bg-[hsl(var(--background-card))] px-2 py-1.5 text-text-primary"
              >
                {MAX_NEW_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={() => rescoreMutation.mutate()}
              isLoading={rescoreMutation.isPending}
            >
              Rescore all leads
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Target size={14} />}
              onClick={() => convertMutation.mutate()}
              isLoading={convertMutation.isPending}
              disabled={!canPull}
              title={canPull ? undefined : 'Select a storm outline or click the map first'}
            >
              Pull leads for this zone
            </Button>
          </div>
        </div>

        {lastResult && lookup && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                <CheckCircle2 size={14} className="text-emerald" aria-hidden="true" />
                {lastResult.zone.name} · {lastResult.zone.areaKm2} km² · impact {lastResult.zone.impactScore}/100
              </span>
              <Link
                to="/leads?source=STORM_EVENT"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline hover:opacity-80"
              >
                Open storm leads
                <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </div>

            {lookup.status !== 'ok' || lookup.message ? (
              <p
                role="status"
                className={`flex items-start gap-1.5 rounded-md p-2 text-xs ${lookup.status === 'ok' ? 'bg-[hsl(var(--background-accent))] text-text-secondary' : 'bg-amber/10 text-amber'}`}
              >
                <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                {lookup.message ?? 'Address lookup did not run.'}
              </p>
            ) : (
              <p className="text-xs text-text-tertiary">
                Checked {plural(lookup.sampledPoints, 'point')} across the zone: {plural(lookup.addressesFound, 'address', 'addresses')} found,{' '}
                {lookup.alreadyLeads} already leads, {plural(lookup.droppedBusinesses, 'business', 'businesses')} skipped
                {lookup.capped ? `, capped at ${maxNew} new` : ''}. Source: {lookup.source}.
              </p>
            )}

            <LeadList
              title={`Existing leads in the zone (${lastResult.existing})`}
              leads={lastResult.existingLeads}
              empty="None of your located leads are inside this zone."
            />
            <LeadList
              title={`New canvass leads (${lastResult.created})`}
              leads={lastResult.newLeads}
              empty={lookup.status === 'ok' ? 'No new addresses to add.' : 'None: address lookup did not run.'}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
          <Link
            to="/leads?source=STORM_EVENT"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-[hsl(var(--background-elevated))] px-2.5 py-1 text-text-primary hover:bg-[hsl(var(--background-accent))]"
          >
            <Users size={12} aria-hidden="true" />
            Storm leads
          </Link>
          <Link
            to="/field"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-[hsl(var(--background-elevated))] px-2.5 py-1 text-text-primary hover:bg-[hsl(var(--background-accent))]"
          >
            <Briefcase size={12} aria-hidden="true" />
            Field Hub dispatch
          </Link>
          <Link
            to="/reports?tab=pipeline"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-[hsl(var(--background-elevated))] px-2.5 py-1 text-text-primary hover:bg-[hsl(var(--background-accent))]"
          >
            <BarChart3 size={12} aria-hidden="true" />
            Pipeline report
          </Link>
        </div>
      </div>
    </Card>
  );
};

export default MapToLeadsDemoPanel;
