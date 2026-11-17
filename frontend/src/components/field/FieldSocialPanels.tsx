/**
 * AUCTUM.COFFEE-style Spaces, Chronological Social Feed, Image Uploads & Live Streaming.
 * Adapted for Fieldwright Operators + AUCTUM · ATLAS Storm Territories.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  Camera,
  ImagePlus,
  MapPin,
  MessageSquare,
  Plus,
  Radio,
  Send,
  ShieldCheck,
  Square,
  Users,
  Video,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';
import { api, resolveFileUrl } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../providers/SocketProvider';
import socketService from '../../services/socket';

export interface MediaItem {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  fileType: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
}

export interface FieldSpaceSummary {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  district: string | null;
  roleLabel: string;
  coverUrl: string | null;
  lat: number | null;
  lng: number | null;
  jobId: string | null;
  stormEventId: string | null;
  followerCount: number;
  isFollowing: boolean;
  postCount: number;
  trust: { score: number; band: string; sealedPackets: number };
  job: { id: string; name: string; propertyAddress: string; phase: string; budget: number | null; status: string } | null;
  activeLive: LiveSession | null;
}

export interface SocialReply {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string; role: string; avatarUrl: string | null };
}

export interface SocialPost {
  id: string;
  spaceId: string | null;
  space: { id: string; slug: string; name: string; district: string | null; roleLabel: string } | null;
  kind: 'NOTE' | 'LOT_HANDOFF' | 'LIVE_CLIP' | string;
  title: string | null;
  body: string;
  jobId: string | null;
  job: { id: string; name: string; propertyAddress: string; phase: string; budget: number | null; status: string } | null;
  mediaUrls: MediaItem[];
  createdAt: string;
  author: { id: string; firstName: string; lastName: string; role: string; avatarUrl: string | null };
  keepCount: number;
  keptByMe: boolean;
  replies: SocialReply[];
}

export interface LiveSession {
  id: string;
  spaceId: string | null;
  hostUserId: string;
  title: string;
  status: string;
  transport: string;
  viewerCount: number;
  startedAt: string;
  space?: { id: string; slug: string; name: string; district?: string | null } | null;
  host?: { id: string; firstName: string; lastName: string; role: string } | null;
}

function ago(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return 'just now';
  }
}

export const FieldSpacesPanel: React.FC<{ onSelectSpace?: (space: FieldSpaceSummary) => void }> = ({
  onSelectSpace,
}) => {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [district, setDistrict] = useState('');
  const [roleLabel, setRoleLabel] = useState('Storm Crew');
  const [tagline, setTagline] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);

  const spacesQ = useQuery({
    queryKey: ['field-spaces'],
    queryFn: async () =>
      (await api.get<{ data: FieldSpaceSummary[] }>('/field/social/spaces')).data.data,
  });

  const createSpace = useMutation({
    mutationFn: () =>
      api.post('/field/social/spaces', {
        name: name.trim(),
        district: district.trim() || undefined,
        roleLabel,
        tagline: tagline.trim() || undefined,
        coverUrl: coverUrl || undefined,
      }),
    onSuccess: () => {
      toast.success('Space created');
      setName('');
      setDistrict('');
      setTagline('');
      setCoverUrl('');
      setCreateOpen(false);
      void qc.invalidateQueries({ queryKey: ['field-spaces'] });
    },
    onError: () => toast.error('Could not create Space'),
  });

  const followToggle = useMutation({
    mutationFn: (spaceId: string) => api.post(`/field/social/spaces/${spaceId}/follow`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['field-spaces'] }),
  });

  const handleCoverUpload = async (file?: File) => {
    if (!file) return;
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await api.post<{ files: MediaItem[] }>('/field/social/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.files?.[0]?.url) {
        setCoverUrl(res.data.files[0].url);
        toast.success('Cover image uploaded');
      }
    } catch {
      toast.error('Failed to upload cover image');
    } finally {
      setUploadingCover(false);
    }
  };

  const spaces = spacesQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-tertiary">
            FieldSpace · Every territory a desk
          </p>
          <h2 className="mt-1 font-display text-2xl text-text-primary">
            Every territory a Space. Every inspection a file.
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-text-secondary">
            Field operators organize around live storm corridors and active roofs. Follow a Space to tune your feed without polluting Evidence Trust scores.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 bg-[hsl(var(--primary))] px-3.5 py-2 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
        >
          <Plus size={14} aria-hidden="true" />
          {createOpen ? 'Close Composer' : 'Create Space'}
        </button>
      </div>

      {createOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length < 2) return;
            createSpace.mutate();
          }}
          className="grid gap-3 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] p-4 sm:grid-cols-2"
        >
          <div>
            <label className="block text-xs font-medium text-text-primary">Space Name</label>
            <input
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. McKinney Ridge Inspect Desk"
              className="mt-1 w-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-primary">District / Swath</label>
            <input
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="e.g. Collin County · North Sector"
              className="mt-1 w-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-primary">Crew Role</label>
            <select
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value)}
              className="mt-1 w-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary"
            >
              <option value="Storm Crew">Storm Crew</option>
              <option value="Drone Unit">Drone Unit</option>
              <option value="Adjuster Desk">Adjuster Desk</option>
              <option value="Territory">Territory</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-primary">Cover Photo</label>
            <div className="mt-1 flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] px-3 py-2 text-xs text-text-primary hover:bg-[hsl(var(--background-accent))]">
                <ImagePlus size={14} aria-hidden="true" />
                {uploadingCover ? 'Uploading…' : coverUrl ? 'Replace Cover' : 'Upload Image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleCoverUpload(e.target.files?.[0])}
                />
              </label>
              {coverUrl && (
                <img
                  src={resolveFileUrl(coverUrl)}
                  alt="Space cover preview"
                  className="h-9 w-16 border border-[hsl(var(--border))] object-cover"
                />
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-text-primary">Tagline</label>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="What inspections, swaths, or live drops happen in this Space…"
              className="mt-1 w-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button
              type="submit"
              disabled={createSpace.isPending}
              className="bg-[hsl(var(--primary))] px-4 py-2 text-xs font-medium text-[hsl(var(--primary-foreground))]"
            >
              {createSpace.isPending ? 'Creating…' : 'Publish Space'}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {spaces.map((sp) => (
          <div
            key={sp.id}
            className="flex flex-col justify-between border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] overflow-hidden"
          >
            <Link to={`/spaces/${sp.slug}`} className="group block">
              <div className="relative aspect-[16/9] bg-[hsl(var(--background-accent))]">
                {sp.coverUrl ? (
                  <img
                    src={resolveFileUrl(sp.coverUrl)}
                    alt={sp.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[hsl(var(--primary))]/25 via-[hsl(var(--background-elevated))] to-cyan-500/20 p-4">
                    <MapPin size={28} className="text-text-tertiary opacity-60" aria-hidden="true" />
                  </div>
                )}
                {sp.activeLive && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 bg-red-600 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    LIVE
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/80">
                    {sp.roleLabel} · {sp.district || 'Field Sector'}
                  </p>
                  <h3 className="font-display text-xl text-white group-hover:underline">
                    {sp.name}
                  </h3>
                </div>
              </div>
            </Link>

            <div className="flex-1 p-4 space-y-3 text-xs">
              {sp.tagline && <p className="text-text-secondary line-clamp-2">{sp.tagline}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2 text-text-tertiary">
                <span>
                  <strong className="text-text-primary">{sp.postCount}</strong> posts ·{' '}
                  <strong className="text-text-primary">{sp.followerCount}</strong> following
                </span>
                <span className="inline-flex items-center gap-1 border border-[hsl(var(--border))] px-2 py-0.5 font-mono text-text-primary">
                  <ShieldCheck size={12} className="text-emerald" aria-hidden="true" />
                  Trust {sp.trust.score} ({sp.trust.band})
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[hsl(var(--border))] px-4 py-2.5 text-xs bg-[hsl(var(--background-elevated))]">
              <div className="flex items-center gap-2">
                <Link
                  to={`/spaces/${sp.slug}`}
                  className="font-medium text-primary underline hover:opacity-80"
                >
                  Open Space &rarr;
                </Link>
                {onSelectSpace && (
                  <button
                    type="button"
                    onClick={() => onSelectSpace(sp)}
                    className="text-text-secondary underline hover:text-text-primary"
                  >
                    Filter Feed
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => followToggle.mutate(sp.id)}
                className={`px-2.5 py-1 border font-medium transition-colors ${
                  sp.isFollowing
                    ? 'border-[hsl(var(--border))] bg-[hsl(var(--background-card))] text-text-primary'
                    : 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                }`}
              >
                {sp.isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const FieldLiveRoom: React.FC<{
  spaceId?: string | null;
  spaceName?: string;
  spaces?: FieldSpaceSummary[];
}> = ({ spaceId: defaultSpaceId, spaceName, spaces = [] }) => {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { on, off } = useSocket();
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(defaultSpaceId || '');
  const [streamTitle, setStreamTitle] = useState('Live Roof Walkthrough & Hail Inspection');
  const [activeHostSession, setActiveHostSession] = useState<LiveSession | null>(null);
  const [watchingSession, setWatchingSession] = useState<LiveSession | null>(null);
  const [latestFrames, setLatestFrames] = useState<Record<string, string>>({});
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState<Array<{ id: string; authorName: string; body: string; at: string }>>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const frameTimerRef = useRef<number | null>(null);

  const liveQuery = useQuery({
    queryKey: ['field-live-active'],
    queryFn: async () =>
      (await api.get<{ data: LiveSession[] }>('/field/social/live/active')).data.data,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (defaultSpaceId) setSelectedSpaceId(defaultSpaceId);
  }, [defaultSpaceId]);

  useEffect(() => {
    const roomId = selectedSpaceId || watchingSession?.spaceId;
    if (roomId) socketService.emit('join:space', roomId);
    return () => {
      if (roomId) socketService.emit('leave:space', roomId);
    };
  }, [selectedSpaceId, watchingSession?.spaceId]);

  useEffect(() => {
    const onStarted = () => void qc.invalidateQueries({ queryKey: ['field-live-active'] });
    const onEnded = () => void qc.invalidateQueries({ queryKey: ['field-live-active'] });
    const onFrame = (payload: { sessionId: string; frame: string }) => {
      if (payload?.sessionId && payload?.frame) {
        setLatestFrames((prev) => ({ ...prev, [payload.sessionId]: payload.frame }));
      }
    };
    const onChat = (msg: { id: string; authorName: string; body: string; at: string }) => {
      if (msg?.body) {
        setChatLog((prev) => [msg, ...prev].slice(0, 40));
      }
    };
    on('field:live:started', onStarted);
    on('field:live:ended', onEnded);
    on('field:live:frame', onFrame);
    on('field:live:chat', onChat);
    return () => {
      off('field:live:started', onStarted);
      off('field:live:ended', onEnded);
      off('field:live:frame', onFrame);
      off('field:live:chat', onChat);
    };
  }, [on, off, qc]);

  const stopCamera = () => {
    if (frameTimerRef.current) {
      window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => () => stopCamera(), []);

  const pushSyntheticOrVideoFrame = async (sessionId: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 270;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vid = videoRef.current;
    if (vid && vid.readyState >= 2) {
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('AUCTUM · FIELD LIVE TELEMETRY', 24, 52);
      ctx.font = '13px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`UTC ${new Date().toISOString()}`, 24, 84);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Camera permission unavailable — streaming status heartbeat', 24, 114);
    }
    const frame = canvas.toDataURL('image/jpeg', 0.62);
    setLatestFrames((prev) => ({ ...prev, [sessionId]: frame }));
    await api.post(`/field/social/live/${sessionId}/frame`, { frame }).catch(() => {});
  };

  const startLive = async () => {
    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        mediaStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        toast('Camera unavailable — starting telemetry frame stream', { icon: '📡' });
      }
      const res = await api.post<{ data: LiveSession }>('/field/social/live/start', {
        spaceId: selectedSpaceId || defaultSpaceId || undefined,
        title: streamTitle.trim() || 'Field Live Walkthrough',
        transport: 'FRAME_RELAY',
      });
      const session = res.data.data;
      setActiveHostSession(session);
      setWatchingSession(session);
      void qc.invalidateQueries({ queryKey: ['field-live-active'] });
      void pushSyntheticOrVideoFrame(session.id);
      frameTimerRef.current = window.setInterval(() => {
        void pushSyntheticOrVideoFrame(session.id);
      }, 2000);
      toast.success('Live stream started');
    } catch {
      toast.error('Failed to start live stream');
    }
  };

  const endLive = async () => {
    if (!activeHostSession) return;
    stopCamera();
    await api.post(`/field/social/live/${activeHostSession.id}/end`).catch(() => {});
    setActiveHostSession(null);
    void qc.invalidateQueries({ queryKey: ['field-live-active'] });
    toast.success('Live stream ended');
  };

  const snapToFeed = async () => {
    const sess = activeHostSession ?? watchingSession;
    const frame = sess ? latestFrames[sess.id] : undefined;
    if (!sess || !frame) {
      toast.error('Start a live stream first to snap a frame');
      return;
    }
    try {
      const blob = await (await fetch(frame)).blob();
      const fd = new FormData();
      fd.append('files', new File([blob], `live-snap-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      const up = await api.post<{ files: MediaItem[] }>('/field/social/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await api.post('/field/social/posts', {
        kind: 'LIVE_CLIP',
        title: `Live Snap · ${sess.title}`,
        body: `Captured live frame from broadcast "${sess.title}".`,
        spaceId: sess.spaceId || selectedSpaceId || undefined,
        mediaUrls: up.data.files,
      });
      void qc.invalidateQueries({ queryKey: ['field-social-posts'] });
      toast.success('Live frame snapped & posted to Feed');
    } catch {
      toast.error('Could not publish live frame snap');
    }
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const roomSpace = selectedSpaceId || watchingSession?.spaceId || undefined;
    socketService.emit('field:live:chat', {
      spaceId: roomSpace,
      sessionId: watchingSession?.id || activeHostSession?.id,
      body: chatInput.trim(),
      authorName: user ? `${user.firstName} ${user.lastName}` : 'Operator',
    });
    setChatInput('');
  };

  const activeStreams = (liveQuery.data ?? []).filter(
    (s) => !defaultSpaceId || s.spaceId === defaultSpaceId
  );

  const displayedSession = activeHostSession ?? watchingSession ?? activeStreams[0] ?? null;

  return (
    <section className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-tertiary">
            Live Broadcast · WebRTC &amp; Socket.IO Frame Relay
          </p>
          <h3 className="font-display text-xl text-text-primary">
            {spaceName ? `${spaceName} · Live Desk` : 'Field Live Streaming & Broadcast'}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeStreams.length > 0 && (
            <span className="inline-flex items-center gap-1.5 border border-red-500/40 bg-red-500/10 px-2.5 py-1 font-mono text-xs text-red-500">
              <Radio size={13} className="animate-pulse" aria-hidden="true" />
              {activeStreams.length} LIVE NOW
            </span>
          )}
        </div>
      </div>

      {/* Host controls */}
      <div className="flex flex-wrap items-center gap-2 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] p-3 text-xs">
        {!defaultSpaceId && spaces.length > 0 && (
          <select
            value={selectedSpaceId}
            onChange={(e) => setSelectedSpaceId(e.target.value)}
            className="border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-text-primary"
            aria-label="Broadcast Space"
          >
            <option value="">Company-wide Field Stream</option>
            {spaces.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
        )}
        <input
          value={streamTitle}
          onChange={(e) => setStreamTitle(e.target.value)}
          placeholder="Broadcast title…"
          className="flex-1 min-w-48 border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-text-primary"
        />
        {!activeHostSession ? (
          <button
            type="button"
            onClick={() => void startLive()}
            className="inline-flex items-center gap-1.5 bg-red-600 px-3.5 py-1.5 font-medium text-white hover:bg-red-700"
          >
            <Video size={14} aria-hidden="true" />
            Go Live
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void snapToFeed()}
              className="inline-flex items-center gap-1 border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] px-3 py-1.5 font-medium text-text-primary hover:bg-[hsl(var(--background-accent))]"
            >
              <Camera size={13} aria-hidden="true" />
              Snap Frame to Feed
            </button>
            <button
              type="button"
              onClick={() => void endLive()}
              className="inline-flex items-center gap-1.5 border border-red-500 bg-red-500/10 px-3.5 py-1.5 font-medium text-red-500 hover:bg-red-500/20"
            >
              <Square size={12} aria-hidden="true" />
              End Broadcast
            </button>
          </div>
        )}
      </div>

      {displayedSession && (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] px-3 py-1.5 font-mono text-[11px] text-text-secondary">
          <span>
            MediaMTX WHIP/WHEP: <strong className="text-text-primary">/rtc/field-{displayedSession.id.slice(0, 8)}/whep</strong>
          </span>
          <span>
            DJI / OBS RTMP Ingest: <strong className="text-text-primary">rtmp://&lt;host&gt;:1936/field-{displayedSession.id.slice(0, 8)}</strong>
          </span>
        </div>
      )}

      {/* Stream viewer + live chat */}
      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="relative aspect-video overflow-hidden border border-[hsl(var(--border))] bg-slate-950 flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover ${activeHostSession && mediaStreamRef.current ? 'block' : 'hidden'}`}
          />
          {displayedSession && (!activeHostSession || !mediaStreamRef.current) && latestFrames[displayedSession.id] ? (
            <img
              src={latestFrames[displayedSession.id]}
              alt={displayedSession.title}
              className="h-full w-full object-cover"
            />
          ) : null}
          {!displayedSession && (
            <div className="text-center p-6 text-slate-300 space-y-1">
              <Camera size={28} className="mx-auto opacity-60" aria-hidden="true" />
              <p className="text-sm font-medium">No active broadcast selected</p>
              <p className="text-xs text-slate-400">
                Click &ldquo;Go Live&rdquo; from a roof inspection or pick an active stream below.
              </p>
            </div>
          )}
          {displayedSession && (
            <div className="absolute left-3 top-3 flex items-center gap-2 bg-black/75 px-2.5 py-1 text-xs text-white">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono font-bold">LIVE</span>
              <span>· {displayedSession.title}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] p-3 text-xs">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-tertiary">
            Live Stream Chat
          </p>
          <div className="my-2 flex-1 max-h-48 overflow-y-auto space-y-1.5">
            {chatLog.length === 0 ? (
              <p className="text-text-tertiary">Live operator notes appear here in real time.</p>
            ) : (
              chatLog.map((c) => (
                <div key={c.id} className="border-b border-[hsl(var(--border))]/50 pb-1">
                  <span className="font-semibold text-text-primary">{c.authorName}: </span>
                  <span className="text-text-secondary">{c.body}</span>
                </div>
              ))
            )}
          </div>
          <form onSubmit={sendChat} className="flex gap-1.5 pt-2 border-t border-[hsl(var(--border))]">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send live note…"
              className="flex-1 border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-text-primary"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 bg-[hsl(var(--primary))] px-2.5 py-1.5 text-[hsl(var(--primary-foreground))]"
              aria-label="Send live chat"
            >
              <Send size={12} />
            </button>
          </form>
        </div>
      </div>

      {activeStreams.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {activeStreams.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setWatchingSession(s)}
              className={`inline-flex items-center gap-1.5 border px-2.5 py-1 ${
                displayedSession?.id === s.id
                  ? 'border-red-500 bg-red-500/10 text-red-500 font-medium'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary'
              }`}
            >
              <Radio size={12} />
              {s.title} ({s.host ? `${s.host.firstName} ${s.host.lastName}` : 'Host'})
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export const FieldFeedPanel: React.FC<{
  spaceId?: string | null;
  spaceName?: string;
}> = ({ spaceId: fixedSpaceId, spaceName }) => {
  const qc = useQueryClient();
  const { on, off } = useSocket();
  const [filterMode, setFilterMode] = useState<'all' | 'following'>('all');
  const [spaceFilter, setSpaceFilter] = useState<string>(fixedSpaceId || '');
  const [kind, setKind] = useState<'NOTE' | 'LOT_HANDOFF'>('NOTE');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [jobId, setJobId] = useState('');
  const [mediaUrls, setMediaUrls] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [analysisByPost, setAnalysisByPost] = useState<
    Record<
      string,
      {
        engine: string;
        width?: number;
        height?: number;
        damageClass: string;
        hailStrikesPer100SqFt: number;
        affectedAreaPct: number;
        regions?: Array<{ x: number; y: number; w: number; h: number; label: string; confidence: number }>;
        recommendedScope: string;
      }
    >
  >({});
  const [photogrammetryResult, setPhotogrammetryResult] = useState<{
    engine: string;
    roofAreaSqFt: number;
    estimatedSquares: number;
    dominantPitch: string;
    facets: number;
    ridgeFt: number;
    valleyFt: number;
    gsdCmPerPx: number;
    imageCount: number;
  } | null>(null);
  const [estimating3D, setEstimating3D] = useState(false);

  const runPhotogrammetry = async () => {
    const urls = mediaUrls.filter((m) => m.fileType === 'IMAGE').map((m) => m.url);
    const fallbackUrls = urls.length > 0 ? urls : ['/uploads/sample-aerial-1.jpg', '/uploads/sample-aerial-2.jpg'];
    setEstimating3D(true);
    try {
      const res = await api.post('/field/social/photogrammetry', {
        fileUrls: fallbackUrls,
        propertyAddress: title.trim() || 'Field Aerial Burst',
        pitchHint: '7/12',
      });
      setPhotogrammetryResult(res.data.data);
      toast.success('WebODM 3D roof measurement complete');
    } catch {
      toast.error('Photogrammetry estimation failed');
    } finally {
      setEstimating3D(false);
    }
  };

  const analyzePhoto = async (post: SocialPost) => {
    const img = post.mediaUrls.find((m) => m.fileType === 'IMAGE') ?? post.mediaUrls[0];
    if (!img) return;
    try {
      const res = await api.post('/field/social/analyze-photo', {
        fileUrl: img.url,
        fileName: img.fileName,
        notes: `${post.title ?? ''} ${post.body}`,
      });
      setAnalysisByPost((prev) => ({ ...prev, [post.id]: res.data.data }));
      toast.success('APERTURE roof photo inspection complete');
    } catch {
      toast.error('Photo inspection failed');
    }
  };

  useEffect(() => {
    if (fixedSpaceId) setSpaceFilter(fixedSpaceId);
  }, [fixedSpaceId]);

  useEffect(() => {
    const refresh = () => void qc.invalidateQueries({ queryKey: ['field-social-posts'] });
    on('field:social:post', refresh);
    on('field:social:reply', refresh);
    return () => {
      off('field:social:post', refresh);
      off('field:social:reply', refresh);
    };
  }, [on, off, qc]);

  const spacesQ = useQuery({
    queryKey: ['field-spaces'],
    queryFn: async () =>
      (await api.get<{ data: FieldSpaceSummary[] }>('/field/social/spaces')).data.data,
  });

  const jobsQ = useQuery({
    queryKey: ['field-jobs-for-feed'],
    queryFn: async () =>
      (await api.get<{ data: Array<{ id: string; name: string; propertyAddress: string }> }>('/jobs')).data.data,
  });

  const postsQ = useQuery({
    queryKey: ['field-social-posts', spaceFilter, filterMode],
    queryFn: async () =>
      (
        await api.get<{ data: SocialPost[] }>('/field/social/posts', {
          params: {
            ...(spaceFilter ? { spaceId: spaceFilter } : {}),
            ...(filterMode === 'following' ? { followingOnly: 'true' } : {}),
          },
        })
      ).data.data,
  });

  const uploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(fileList).slice(0, 6).forEach((f) => fd.append('files', f));
      const res = await api.post<{ files: MediaItem[] }>('/field/social/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMediaUrls((prev) => [...prev, ...(res.data.files ?? [])]);
      toast.success(`Uploaded ${res.data.files?.length ?? 0} media file(s)`);
    } catch {
      toast.error('Upload failed (allowed: PNG/JPG/WEBP/GIF/MP4/WEBM)');
    } finally {
      setUploading(false);
    }
  };

  const publishPost = useMutation({
    mutationFn: () =>
      api.post('/field/social/posts', {
        kind,
        title: title.trim() || undefined,
        body: body.trim(),
        spaceId: spaceFilter || undefined,
        jobId: kind === 'LOT_HANDOFF' && jobId ? jobId : undefined,
        mediaUrls,
      }),
    onSuccess: () => {
      toast.success('Posted to Field Feed');
      setTitle('');
      setBody('');
      setMediaUrls([]);
      void qc.invalidateQueries({ queryKey: ['field-social-posts'] });
      void qc.invalidateQueries({ queryKey: ['field-spaces'] });
    },
    onError: () => toast.error('Could not publish post'),
  });

  const keepToggle = useMutation({
    mutationFn: (postId: string) => api.post(`/field/social/posts/${postId}/keep`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['field-social-posts'] }),
  });

  const sendReply = useMutation({
    mutationFn: ({ postId, text }: { postId: string; text: string }) =>
      api.post(`/field/social/posts/${postId}/reply`, { body: text }),
    onSuccess: () => {
      setReplyText('');
      setOpenReplyId(null);
      void qc.invalidateQueries({ queryKey: ['field-social-posts'] });
    },
  });

  const spaces = spacesQ.data ?? [];
  const jobs = jobsQ.data ?? [];
  const posts = postsQ.data ?? [];

  return (
    <div className="space-y-5">
      <FieldLiveRoom
        spaceId={fixedSpaceId ?? (spaceFilter || undefined)}
        spaceName={spaceName}
        spaces={spaces}
      />

      {/* AUCTUM Feed Header + Following Valve */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-tertiary">
            Feed · Chronological recency, never a popularity contest
          </p>
          <h2 className="font-display text-2xl text-text-primary">
            What was logged in the field, in exact time order.
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {!fixedSpaceId && (
            <select
              value={spaceFilter}
              onChange={(e) => setSpaceFilter(e.target.value)}
              className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] px-2.5 py-1.5 text-text-primary"
              aria-label="Filter by Space"
            >
              <option value="">All Spaces</option>
              {spaces.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 border font-medium ${
              filterMode === 'all'
                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                : 'border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary'
            }`}
          >
            All Chronological
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('following')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 border font-medium ${
              filterMode === 'following'
                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                : 'border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary'
            }`}
          >
            <Users size={12} aria-hidden="true" />
            Following Only
          </button>
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim().length < 2) return;
          publishPost.mutate();
        }}
        className="space-y-3 border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-4 text-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setKind('NOTE')}
              className={`px-3 py-1 border ${
                kind === 'NOTE'
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary'
              }`}
            >
              Field Note
            </button>
            <button
              type="button"
              onClick={() => setKind('LOT_HANDOFF')}
              className={`px-3 py-1 border ${
                kind === 'LOT_HANDOFF'
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary'
              }`}
            >
              Pass a Job / Lot
            </button>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] px-3 py-1 text-xs font-medium text-text-primary hover:bg-[hsl(var(--background-accent))]">
            <ImagePlus size={14} aria-hidden="true" />
            {uploading ? 'Uploading…' : 'Upload Photos / Clips'}
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => void uploadFiles(e.target.files)}
            />
          </label>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Optional headline (e.g. Ridge vent hail bruises — West slope)"
          className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm text-text-primary"
        />
        <textarea
          rows={3}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Log field findings, shingle pitch observations, or hand off an inspection lot…"
          className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary"
        />

        {kind === 'LOT_HANDOFF' && (
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-xs text-text-primary"
          >
            <option value="">Attach an active job / inspection lot…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name} — {j.propertyAddress}
              </option>
            ))}
          </select>
        )}

        {mediaUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {mediaUrls.map((m, idx) => (
              <div key={`${m.url}-${idx}`} className="relative h-20 w-28 border border-[hsl(var(--border))] overflow-hidden">
                {m.fileType === 'VIDEO' ? (
                  <video src={resolveFileUrl(m.url)} className="h-full w-full object-cover" />
                ) : (
                  <img src={resolveFileUrl(m.url)} alt={m.fileName} className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => setMediaUrls((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white"
                  aria-label="Remove attachment"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={estimating3D}
            onClick={() => void runPhotogrammetry()}
            className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] px-3 py-2 text-xs font-medium text-text-primary hover:bg-[hsl(var(--background-accent))] disabled:opacity-50"
          >
            {estimating3D ? 'Estimating 3D Mesh…' : 'Estimate 3D Roof (WebODM)'}
          </button>
          <button
            type="submit"
            disabled={publishPost.isPending || body.trim().length < 2}
            className="bg-[hsl(var(--primary))] px-4 py-2 text-xs font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
          >
            {publishPost.isPending ? 'Publishing…' : 'Publish to Feed'}
          </button>
        </div>

        {photogrammetryResult && (
          <div className="border border-cyan-500/40 bg-cyan-500/5 p-3 text-xs space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="font-mono text-text-primary">
                {photogrammetryResult.engine} · {photogrammetryResult.imageCount} aerial frame(s)
              </strong>
              <span className="font-mono text-emerald font-semibold">
                {photogrammetryResult.estimatedSquares} SQ ({photogrammetryResult.roofAreaSqFt} sq ft)
              </span>
            </div>
            <p className="text-text-secondary">
              Pitch {photogrammetryResult.dominantPitch} · {photogrammetryResult.facets} facets · Ridge{' '}
              {photogrammetryResult.ridgeFt} ft · Valley {photogrammetryResult.valleyFt} ft · GSD{' '}
              {photogrammetryResult.gsdCmPerPx} cm/px
            </p>
          </div>
        )}
      </form>

      {/* Posts list */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-8 text-center text-sm text-text-tertiary">
            No field posts match this filter yet. Publish the first field note or upload an inspection photo above.
          </div>
        ) : (
          posts.map((post) => (
            <article
              key={post.id}
              className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-text-primary">
                    {post.author.firstName} {post.author.lastName}
                  </span>
                  <span className="font-mono text-[10px] uppercase text-text-tertiary">
                    {post.author.role.replace('_', ' ')} · {ago(post.createdAt)}
                  </span>
                  {post.space && (
                    <Link
                      to={`/spaces/${post.space.slug}`}
                      className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] px-2 py-0.5 text-[11px] font-medium text-primary hover:underline"
                    >
                      {post.space.name}
                    </Link>
                  )}
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
                  {post.kind.replace('_', ' ')}
                </span>
              </div>

              {post.title && <h3 className="font-display text-xl text-text-primary">{post.title}</h3>}
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{post.body}</p>

              {post.job && (
                <Link
                  to={`/jobs/${post.job.id}`}
                  className="inline-flex items-center gap-2 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] px-3 py-1.5 text-xs text-text-primary hover:bg-[hsl(var(--background-accent))]"
                >
                  <MapPin size={12} aria-hidden="true" />
                  <strong>{post.job.name}</strong> · {post.job.propertyAddress} ({post.job.phase})
                </Link>
              )}

              {post.mediaUrls.length > 0 && (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {post.mediaUrls.map((m, idx) => (
                      <a
                        key={`${m.url}-${idx}`}
                        href={resolveFileUrl(m.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden border border-[hsl(var(--border))] bg-black/5"
                      >
                        {m.fileType === 'VIDEO' ? (
                          <video src={resolveFileUrl(m.url)} controls className="aspect-video w-full object-cover" />
                        ) : (
                          <img
                            src={resolveFileUrl(m.url)}
                            alt={m.fileName}
                            className="aspect-video w-full object-cover transition-transform hover:scale-[1.02]"
                          />
                        )}
                      </a>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void analyzePhoto(post)}
                      className="inline-flex items-center gap-1.5 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-[hsl(var(--background-accent))]"
                    >
                      <ShieldCheck size={12} className="text-primary" aria-hidden="true" />
                      Inspect Roof Damage (APERTURE)
                    </button>
                  </div>
                  {analysisByPost[post.id] && (
                    <div className="border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="font-mono text-primary">
                          {analysisByPost[post.id].damageClass.replace(/_/g, ' ')}
                        </strong>
                        <span className="font-mono text-text-tertiary">
                          {analysisByPost[post.id].width ? `${analysisByPost[post.id].width}×${analysisByPost[post.id].height}px · ` : ''}
                          {analysisByPost[post.id].hailStrikesPer100SqFt} hits/sq ·{' '}
                          {analysisByPost[post.id].affectedAreaPct}% affected
                          {analysisByPost[post.id].regions?.length ? ` · ${analysisByPost[post.id].regions!.length} ROI box(es)` : ''}
                        </span>
                      </div>
                      <p className="text-text-secondary">{analysisByPost[post.id].recommendedScope}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 border-t border-[hsl(var(--border))] pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => keepToggle.mutate(post.id)}
                  className={`inline-flex items-center gap-1 font-medium ${
                    post.keptByMe ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Bookmark size={13} aria-hidden="true" />
                  {post.keptByMe ? 'Kept' : 'Keep'} ({post.keepCount})
                </button>
                <button
                  type="button"
                  onClick={() => setOpenReplyId(openReplyId === post.id ? null : post.id)}
                  className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary"
                >
                  <MessageSquare size={13} aria-hidden="true" />
                  Reply ({post.replies.length})
                </button>
              </div>

              {(post.replies.length > 0 || openReplyId === post.id) && (
                <div className="space-y-2 border-l-2 border-[hsl(var(--border))] pl-3 text-xs">
                  {post.replies.map((r) => (
                    <div key={r.id}>
                      <span className="font-semibold text-text-primary">
                        {r.author.firstName} {r.author.lastName}
                      </span>{' '}
                      <span className="text-text-tertiary">· {ago(r.createdAt)}</span>
                      <p className="text-text-secondary">{r.body}</p>
                    </div>
                  ))}
                  {openReplyId === post.id && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!replyText.trim()) return;
                        sendReply.mutate({ postId: post.id, text: replyText.trim() });
                      }}
                      className="flex gap-2 pt-1"
                    >
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Add field reply…"
                        className="flex-1 border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1 text-text-primary"
                      />
                      <button
                        type="submit"
                        className="bg-[hsl(var(--primary))] px-3 py-1 font-medium text-[hsl(var(--primary-foreground))]"
                      >
                        Post Reply
                      </button>
                    </form>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
};
