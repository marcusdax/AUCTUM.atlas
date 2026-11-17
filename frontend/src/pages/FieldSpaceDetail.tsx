/**
 * AUCTUM Space Detail (/spaces/:spaceId) — modeled on AUCTUM.COFFEE spaces_.$spaceId.tsx.
 * Cover hero, Trust + Verified Packets stat sheet, Follow toggle, Attached Job desk,
 * Live Broadcast Room, and Space-filtered Chronological Feed.
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, MapPin, ShieldCheck } from 'lucide-react';
import { api, resolveFileUrl } from '../services/api';
import {
  FieldFeedPanel,
  type FieldSpaceSummary,
} from '../components/field/FieldSocialPanels';

export default function FieldSpaceDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const qc = useQueryClient();

  const spaceQ = useQuery({
    queryKey: ['field-space', spaceId],
    queryFn: async () =>
      (await api.get<{ data: FieldSpaceSummary }>(`/field/social/spaces/${spaceId}`)).data.data,
    enabled: Boolean(spaceId),
  });

  const followToggle = useMutation({
    mutationFn: (id: string) => api.post(`/field/social/spaces/${id}/follow`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['field-space', spaceId] });
      void qc.invalidateQueries({ queryKey: ['field-spaces'] });
    },
  });

  const sp = spaceQ.data;
  if (spaceQ.isLoading) {
    return <div className="p-8 text-center text-sm text-text-secondary">Loading Space…</div>;
  }
  if (!sp) {
    return (
      <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-8 text-center space-y-3">
        <h1 className="font-display text-2xl text-text-primary">Space unpublished</h1>
        <Link to="/spaces" className="text-sm text-primary underline">
          Return to all Spaces
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link
          to="/spaces"
          className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary underline"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          All Spaces
        </Link>
        <Link
          to="/field"
          className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] px-3 py-1 text-text-primary"
        >
          Open Field Hub
        </Link>
      </div>

      {/* Hero Sheet */}
      <section className="overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--background-card))]">
        <div className="relative min-h-56 bg-[hsl(var(--background-accent))]">
          {sp.coverUrl ? (
            <img
              src={resolveFileUrl(sp.coverUrl)}
              alt={sp.name}
              className="h-64 w-full object-cover sm:h-72"
            />
          ) : (
            <div className="h-56 w-full bg-gradient-to-br from-[hsl(var(--primary))]/30 via-[hsl(var(--background-elevated))] to-cyan-500/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/80">
              {sp.roleLabel} · {sp.district || 'Field Territory'}
            </p>
            <h1 className="mt-1 font-display text-3xl text-white sm:text-4xl">{sp.name}</h1>
            {sp.tagline && <p className="mt-1.5 max-w-2xl text-sm text-white/85">{sp.tagline}</p>}
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))]">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
              Evidence Trust
            </span>
            <p className="mt-0.5 flex items-center gap-1 font-display text-2xl text-text-primary">
              <ShieldCheck size={18} className="text-emerald" aria-hidden="true" />
              {sp.trust.score} <span className="text-xs text-text-secondary">({sp.trust.band})</span>
            </p>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
              Sealed Packets
            </span>
            <p className="mt-0.5 font-display text-2xl text-text-primary">{sp.trust.sealedPackets}</p>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
              Posts · Followers
            </span>
            <p className="mt-0.5 font-display text-2xl text-text-primary">
              {sp.postCount} · {sp.followerCount}
            </p>
          </div>
          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={() => followToggle.mutate(sp.id)}
              className={`px-4 py-2 text-xs font-medium border transition-colors ${
                sp.isFollowing
                  ? 'border-[hsl(var(--border))] bg-[hsl(var(--background-card))] text-text-primary'
                  : 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
              }`}
            >
              {sp.isFollowing ? 'Following Space' : 'Follow this Space'}
            </button>
          </div>
        </div>
      </section>

      {sp.job && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-4 text-xs">
          <div className="flex items-center gap-2">
            <Briefcase size={15} className="text-primary" aria-hidden="true" />
            <div>
              <span className="font-mono text-[10px] uppercase text-text-tertiary">On the Desk</span>
              <p className="font-semibold text-text-primary">
                {sp.job.name} — {sp.job.propertyAddress} ({sp.job.phase})
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={`/jobs/${sp.job.id}`} className="underline text-primary">
              Open Job File
            </Link>
            {sp.lat != null && sp.lng != null && (
              <Link to="/storm-tracking" className="inline-flex items-center gap-1 underline text-text-secondary">
                <MapPin size={12} /> {sp.lat.toFixed(2)}, {sp.lng.toFixed(2)}
              </Link>
            )}
          </div>
        </div>
      )}

      <FieldFeedPanel spaceId={sp.id} spaceName={sp.name} />
    </div>
  );
}
