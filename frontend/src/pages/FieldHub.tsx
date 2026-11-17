/**
 * Field Hub — Sprint 2 Operator Hub (Ground · Queue · Vault · Payouts · Brief).
 * Wired to OperatorOnboardingPanel, StormLayerToggles, Consent-Gated Seal,
 * Genesis Chain Verification, and Integer-Cent Ledger.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polygon,
  Popup,
  useMap,
} from 'react-leaflet';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Layers, Radio, Satellite } from 'lucide-react';
import type { FeatureCollection, Geometry } from 'geojson';
import { api } from '../services/api';
import { aiApi } from '../services/ai';
import { useAuthStore } from '../stores/authStore';
import {
  STORM_DETECTION_LAYERS,
  TRACKING_ALGORITHMS,
  useMapLayersStore,
} from '../stores/mapLayersStore';
import {
  BriefPanel,
  OperatorOnboardingPanel,
  PayoutsPanel,
  SealPacketPanel,
  VaultPanel,
  type OperatorProfile,
} from '../components/field/FieldPanels';
import {
  FieldFeedPanel,
  FieldSpacesPanel,
} from '../components/field/FieldSocialPanels';
import type { StormEventSummary } from '../types/ai';
import 'leaflet/dist/leaflet.css';

type HubTab = 'ground' | 'queue' | 'spaces' | 'feed' | 'vault' | 'payouts' | 'brief';
type Sort = 'pay' | 'distance' | 'deadline';
interface Offer {
  id: string;
  name: string;
  propertyAddress: string;
  latLng: { lat: number; lng: number } | null;
  budget: number | null;
  endDate: string | null;
  phase: string;
  distanceKm: number | null;
  etaMin: number | null;
  payPerHour: number | null;
}
interface QueueItem {
  id: string;
  jobId: string;
  status: 'QUEUED' | 'SCHEDULED' | 'IN_PROGRESS' | 'SEALED' | 'SUBMITTED';
  position: number;
  proposedPrice: number | null;
  job: {
    id: string;
    name: string;
    propertyAddress: string;
    latLng: { lat: number; lng: number } | null;
    budget: number | null;
  };
}

const DEFAULT_CENTER = { lat: 33.05, lng: -96.75 };
const RADAR_URL = 'https://radar.weather.gov/ridge/standard/{z}/{x}/{y}_0.png';
const GOES_URL =
  'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-east-vis-1km-900913/{z}/{x}/{y}.png';
const money = (n: number | null) =>
  n == null ? '—' : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function polygonPositions(geometry: Geometry | null | undefined): [number, number][] | null {
  if (!geometry || !('coordinates' in geometry)) return null;
  if (geometry.type === 'Polygon') {
    return (geometry.coordinates[0] as [number, number][]).map(([lng, lat]) => [lat, lng]);
  }
  if (geometry.type === 'MultiPolygon') {
    const ring = geometry.coordinates[0]?.[0] as [number, number][] | undefined;
    return ring ? ring.map(([lng, lat]) => [lat, lng]) : null;
  }
  return null;
}

function Recenter({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView([center.lat, center.lng]);
  }, [center.lat, center.lng, map]);
  return null;
}

export default function FieldHub() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<HubTab>('ground');
  const [sort, setSort] = useState<Sort>('pay');
  const [radiusKm, setRadiusKm] = useState(80);
  const [origin, setOrigin] = useState(DEFAULT_CENTER);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [price, setPrice] = useState('');
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [showLayersDrawer, setShowLayersDrawer] = useState(false);
  const [sealingItem, setSealingItem] = useState<QueueItem | null>(null);
  const [feedSpace, setFeedSpace] = useState<{ id: string; name: string } | null>(null);

  const {
    detectionLayers,
    trackingAlgos,
    toggleDetectionLayer,
    toggleTrackingAlgo,
  } = useMapLayersStore();

  const profileQuery = useQuery({
    queryKey: ['field-profile'],
    queryFn: async () => (await api.get<{ data: OperatorProfile }>('/field/profile')).data.data,
  });

  const offers = useQuery({
    queryKey: ['field-offers', sort, radiusKm, origin.lat, origin.lng],
    queryFn: async () =>
      (
        await api.get<{ data: Offer[] }>('/field/offers', {
          params: { ...origin, radiusKm, sort },
        })
      ).data.data,
  });

  const queueQuery = useQuery({
    queryKey: ['field-queue'],
    queryFn: async () =>
      (
        await api.get<{ data: QueueItem[]; conflicts: string[][] }>('/field/queue')
      ).data,
  });

  const stormOverview = useQuery({
    queryKey: ['storm-intel', 'overview', 7],
    queryFn: () => aiApi.stormOverview(7),
    staleTime: 60_000,
    retry: 1,
  });

  const alertsGeoJson = useQuery({
    queryKey: ['alerts-geojson'],
    queryFn: () => api.get('/maps/alerts-geojson').then((r) => r.data as FeatureCollection),
    staleTime: 300_000,
    enabled: detectionLayers.spc,
    retry: 1,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['field-offers'] });
    qc.invalidateQueries({ queryKey: ['field-queue'] });
  };
  const add = useMutation({
    mutationFn: (p: { jobId: string; proposedPrice?: number }) => api.post('/field/queue', p),
    onSuccess: () => {
      setSelected(null);
      setPrice('');
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/field/queue/${id}`),
    onSuccess: refresh,
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.put('/field/queue/order', { ids }),
    onSuccess: refresh,
  });
  const optimizeRoute = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ ok: boolean; originalKm: number; optimizedKm: number; savedKm: number }>(
          '/field/queue/optimize',
          origin
        )
      ).data,
    onSuccess: () => refresh(),
  });
  const advanceStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: QueueItem['status'] }) =>
      api.patch(`/field/queue/${id}/status`, { status }),
    onSuccess: refresh,
  });

  const visible = useMemo(
    () => (offers.data ?? []).filter((o) => !skipped.has(o.id)),
    [offers.data, skipped],
  );
  const stormEvents: StormEventSummary[] = stormOverview.data?.events ?? [];
  const q = queueQuery.data?.data ?? [];
  const conflicts = queueQuery.data?.conflicts ?? [];

  const move = (idx: number, dir: -1 | 1) => {
    const ids = q.map((i) => i.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorder.mutate(ids);
  };
  const locate = () =>
    navigator.geolocation?.getCurrentPosition((p) =>
      setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }),
    );

  const activeLayerCount = Object.values(detectionLayers).filter(Boolean).length;
  const activeAlgoCount = Object.values(trackingAlgos).filter(Boolean).length;

  return (
    <div className="space-y-4 text-text-primary pb-8" data-testid="field-hub">
      <header className="space-y-3 border-b border-[hsl(var(--border))] pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display text-text-primary">Field Hub</h1>
            <p className="text-xs text-text-secondary">
              1. Sign up &rarr; 2. Ground map &rarr; 3. Queue &rarr; 4. Spaces, Feed &amp; Live &rarr; 5. Seal &amp; Vault &rarr; 6. Payouts
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {tab === 'ground' && (
              <button
                type="button"
                onClick={() => setShowLayersDrawer((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary hover:bg-[hsl(var(--background-accent))]"
              >
                <Layers size={14} aria-hidden="true" />
                <span>
                  Storm Layers ({activeLayerCount}/5) · Models ({activeAlgoCount}/5)
                </span>
              </button>
            )}
            <Link
              to="/storm-tracking"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary hover:bg-[hsl(var(--background-accent))]"
            >
              Storm Map
            </Link>
            <Link
              to="/leads"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary hover:bg-[hsl(var(--background-accent))]"
            >
              Leads
            </Link>
            <Link
              to="/command"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary hover:bg-[hsl(var(--background-accent))]"
            >
              <Radio size={14} aria-hidden="true" />
              Command Center
            </Link>
            <Link
              to="/intelligence/atlas"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary hover:bg-[hsl(var(--background-accent))]"
            >
              <Satellite size={14} aria-hidden="true" />
              Atlas Intel
            </Link>
            <a
              href="/downloads/fieldwright-debug.apk"
              download="fieldwright-debug.apk"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90"
            >
              <Download size={14} aria-hidden="true" />
              Android App (.apk)
            </a>
            <Link to="/portal" className="underline text-text-secondary hover:text-text-primary px-1">
              Partner Portal
            </Link>
          </div>
        </div>

        <nav className="flex flex-wrap gap-1.5" role="tablist" aria-label="Field hub sections">
          {(
            [
              { id: 'ground', label: 'Ground' },
              { id: 'queue', label: `Queue (${q.length})` },
              { id: 'spaces', label: 'Spaces' },
              { id: 'feed', label: 'Feed & Live' },
              { id: 'vault', label: 'Vault' },
              { id: 'payouts', label: 'Payouts' },
              { id: 'brief', label: 'Brief' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-sm font-medium border border-[hsl(var(--border))] transition-colors ${
                tab === t.id
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]'
                  : 'bg-[hsl(var(--background-card))] text-text-primary hover:bg-[hsl(var(--background-accent))]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <OperatorOnboardingPanel
        profile={profileQuery.data}
        userEmail={user?.email ?? ''}
        onRadiusSync={(km) => setRadiusKm(km)}
      />

      {tab === 'ground' && showLayersDrawer && (
        <section
          aria-label="Storm detection layers and tracking algorithms"
          className="grid gap-4 md:grid-cols-2 border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-4 text-xs"
        >
          <div className="space-y-2">
            <h2 className="font-semibold text-text-primary">
              Storm Detection Layers <span className="text-text-tertiary font-normal">· Real-time data sources</span>
            </h2>
            <div className="grid gap-1.5">
              {STORM_DETECTION_LAYERS.map((l) => (
                <label
                  key={l.id}
                  className="flex items-center justify-between gap-2 p-2 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={detectionLayers[l.id]}
                      onChange={() => toggleDetectionLayer(l.id)}
                      className="accent-[hsl(var(--primary))]"
                    />
                    <span className="font-medium">{l.name}</span>
                  </span>
                  <span className="text-text-secondary font-mono">
                    {l.status} · {l.latency} · {l.coverage}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold text-text-primary">
              Tracking Algorithms <span className="text-text-tertiary font-normal">· Active intelligence models</span>
            </h2>
            <div className="grid gap-1.5">
              {TRACKING_ALGORITHMS.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center justify-between gap-2 p-2 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={trackingAlgos[a.id]}
                      onChange={() => toggleTrackingAlgo(a.id)}
                      className="accent-[hsl(var(--primary))]"
                    />
                    <span className="font-medium">{a.name}</span>
                    <span className="font-mono text-text-tertiary">{a.version}</span>
                  </span>
                  <span className="text-text-secondary font-mono">
                    {a.status} · {a.accuracy}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === 'ground' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="h-[560px] border border-[hsl(var(--border))] overflow-hidden">
            <MapContainer center={[origin.lat, origin.lng]} zoom={9} className="h-full w-full">
              <Recenter center={origin} />
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {detectionLayers.nexrad && (
                <TileLayer url={RADAR_URL} attribution="NOAA NWS" opacity={0.55} maxZoom={15} />
              )}
              {detectionLayers.goes && (
                <TileLayer url={GOES_URL} attribution="NOAA GOES" opacity={0.4} maxZoom={12} />
              )}
              {detectionLayers.spc &&
                (alertsGeoJson.data?.features ?? []).map((f, idx) => {
                  const pos = polygonPositions(f.geometry);
                  if (!pos) return null;
                  return (
                    <Polygon
                      key={`spc-${idx}`}
                      positions={pos}
                      pathOptions={{ color: '#cb8622', fillColor: '#cb8622', fillOpacity: 0.14, weight: 1.5 }}
                    />
                  );
                })}
              {detectionLayers.lsr &&
                stormEvents.map((ev) => {
                  const pos = polygonPositions(ev.geometry as Geometry | null | undefined);
                  if (!pos) return null;
                  return (
                    <Polygon
                      key={`lsr-${ev.id}`}
                      positions={pos}
                      pathOptions={{ color: '#8c2f22', fillColor: '#8c2f22', fillOpacity: 0.18, weight: 2 }}
                    >
                      <Popup>
                        <div className="text-xs text-[#17231d]">
                          <strong>{ev.name}</strong> ({ev.severity})
                        </div>
                      </Popup>
                    </Polygon>
                  );
                })}
              {visible
                .filter((o) => o.latLng)
                .map((o) => (
                  <React.Fragment key={o.id}>
                    {detectionLayers.lightning && trackingAlgos.hail && (
                      <CircleMarker
                        center={[o.latLng!.lat, o.latLng!.lng]}
                        radius={14}
                        interactive={false}
                        pathOptions={{
                          color: '#cb8622',
                          weight: 1,
                          fillColor: '#cb8622',
                          fillOpacity: 0.12,
                        }}
                      />
                    )}
                    <CircleMarker
                      center={[o.latLng!.lat, o.latLng!.lng]}
                      radius={9}
                      pathOptions={{
                        color: '#ffffff',
                        weight: 2,
                        fillColor: '#8c2f22',
                        fillOpacity: 0.85,
                      }}
                      eventHandlers={{ click: () => setSelected(o) }}
                    >
                      <Popup>
                        <div className="text-xs text-[#17231d]">
                          {o.name} · {money(o.budget)}
                        </div>
                      </Popup>
                    </CircleMarker>
                  </React.Fragment>
                ))}
            </MapContainer>
          </div>

          <aside className="space-y-3" aria-label="Offers">
            <div className="flex flex-wrap items-center gap-3 text-sm text-text-primary border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-2.5">
              <label className="flex items-center gap-1.5 text-text-secondary">
                <span>Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary px-2 py-1 text-xs rounded-sm"
                >
                  <option value="pay">Pay / hour</option>
                  <option value="distance">Distance</option>
                  <option value="deadline">Deadline</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-text-secondary">
                <span>Radius {radiusKm} km</span>
                <input
                  type="range"
                  min={5}
                  max={200}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="accent-[hsl(var(--primary))]"
                />
              </label>
              <button
                type="button"
                onClick={locate}
                className="underline text-xs font-medium text-text-primary hover:opacity-80 ml-auto"
              >
                Use my location
              </button>
            </div>

            {offers.isLoading && <p className="text-sm text-text-secondary">Loading offers…</p>}
            {offers.isError && (
              <p role="alert" className="text-sm text-[hsl(var(--red))]">
                Could not load offers.
              </p>
            )}
            {!offers.isLoading && visible.length === 0 && (
              <p className="text-sm text-text-secondary">No offers in range. Widen the radius.</p>
            )}

            <ul className="space-y-2 max-h-[380px] overflow-auto">
              {visible.map((o) => (
                <li
                  key={o.id}
                  className={`border p-2.5 bg-[hsl(var(--background-card))] transition-colors ${
                    selected?.id === o.id
                      ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]'
                      : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--background-accent))]'
                  }`}
                >
                  <button
                    type="button"
                    className="text-left w-full text-text-primary"
                    onClick={() => setSelected(o)}
                  >
                    <strong className="block text-sm text-text-primary">{o.name}</strong>
                    <div className="text-xs text-text-secondary">{o.propertyAddress}</div>
                    <div className="text-sm text-text-primary mt-1 font-mono">
                      {money(o.budget)} · {o.payPerHour ? `${money(o.payPerHour)}/h` : 'rate n/a'} ·{' '}
                      {o.distanceKm != null ? `${o.distanceKm} km (~${o.etaMin} min)` : 'distance n/a'}
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {selected && (
              <section
                className="border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] p-3.5 space-y-2.5 text-text-primary"
                aria-label="Job detail"
              >
                <h2 className="font-semibold text-text-primary">{selected.name}</h2>
                <p className="text-sm text-text-secondary">
                  {selected.propertyAddress} · phase {selected.phase}
                </p>
                <p className="text-sm text-text-primary">Posted rate: {money(selected.budget)}</p>
                <label className="text-sm text-text-secondary block">
                  Propose your price (optional)
                  <input
                    type="number"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="ml-2 w-28 border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-text-primary px-2 py-1 rounded-sm"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={add.isPending}
                    className="px-3 py-1.5 text-sm font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-60"
                    onClick={() =>
                      add.mutate({
                        jobId: selected.id,
                        ...(price ? { proposedPrice: Number(price) } : {}),
                      })
                    }
                  >
                    Add to queue
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm border border-[hsl(var(--border-hover))] bg-[hsl(var(--background-card))] text-text-primary hover:bg-[hsl(var(--background-accent))]"
                    onClick={() => {
                      setSkipped(new Set(skipped).add(selected.id));
                      setSelected(null);
                    }}
                  >
                    Skip (no penalty)
                  </button>
                </div>
                {add.isError && (
                  <p role="alert" className="text-sm text-[hsl(var(--red))]">
                    Could not add — it may already be queued or no longer available.
                  </p>
                )}
              </section>
            )}
          </aside>
        </div>
      )}

      {tab === 'queue' && (
        <section aria-label="My queue" className="space-y-4 text-text-primary">
          <div className="flex flex-wrap items-center justify-between gap-2 border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-3 text-xs">
            <span>
              {q.length} queued inspection{q.length === 1 ? '' : 's'}
              {optimizeRoute.data
                ? ` · Optimized route: ${optimizeRoute.data.optimizedKm} km (saved ${optimizeRoute.data.savedKm} km)`
                : ''}
            </span>
            <button
              type="button"
              disabled={q.length < 2 || optimizeRoute.isPending}
              onClick={() => optimizeRoute.mutate()}
              className="px-3 py-1.5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium disabled:opacity-50"
            >
              {optimizeRoute.isPending ? 'Optimizing…' : 'Optimize Route Order'}
            </button>
          </div>
          {conflicts.length > 0 && (
            <div className="border-l-2 border-[hsl(var(--amber))] bg-[hsl(var(--background-elevated))] px-3 py-2 text-xs text-text-primary">
              Advisory: {conflicts.length} scheduled window overlap{conflicts.length > 1 ? 's' : ''} in your queue. You choose the sequence.
            </div>
          )}

          {sealingItem && (
            <SealPacketPanel
              queueItemId={sealingItem.id}
              jobName={sealingItem.job.name}
              onCancel={() => setSealingItem(null)}
              onSealed={() => {
                setSealingItem(null);
                setTab('vault');
              }}
            />
          )}

          {queueQuery.isLoading && <p className="text-sm text-text-secondary">Loading queue…</p>}
          {!queueQuery.isLoading && q.length === 0 && (
            <p className="text-sm text-text-secondary">Nothing queued. Browse the map.</p>
          )}
          <ol className="space-y-2">
            {q.map((i, idx) => (
              <li
                key={i.id}
                className="border border-[hsl(var(--border))] bg-[hsl(var(--background-card))] p-3 flex flex-wrap items-center gap-3"
              >
                <span className="font-mono w-6 text-text-secondary">{idx + 1}</span>
                <div className="flex-1 min-w-[200px]">
                  <strong className="text-text-primary">{i.job.name}</strong>
                  <div className="text-xs text-text-secondary">{i.job.propertyAddress}</div>
                  <div className="text-sm text-text-primary mt-0.5">
                    {i.proposedPrice != null
                      ? `Your price ${money(i.proposedPrice)}`
                      : `Posted ${money(i.job.budget)}`}{' '}
                    · <span className="font-mono text-xs text-text-secondary">{i.status}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {i.status === 'QUEUED' && (
                    <button
                      type="button"
                      onClick={() => advanceStatus.mutate({ id: i.id, status: 'SCHEDULED' })}
                      className="px-2.5 py-1.5 border border-[hsl(var(--border-hover))] bg-[hsl(var(--background-elevated))] text-text-primary"
                    >
                      Schedule
                    </button>
                  )}
                  {(i.status === 'QUEUED' || i.status === 'SCHEDULED') && (
                    <button
                      type="button"
                      onClick={() => advanceStatus.mutate({ id: i.id, status: 'IN_PROGRESS' })}
                      className="px-2.5 py-1.5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium"
                    >
                      Start Capture
                    </button>
                  )}
                  {i.status === 'IN_PROGRESS' && (
                    <button
                      type="button"
                      onClick={() => setSealingItem(i)}
                      className="px-2.5 py-1.5 bg-[hsl(var(--emerald))] text-white font-medium"
                    >
                      Capture &amp; Seal Packet
                    </button>
                  )}
                  {i.status === 'SEALED' && (
                    <button
                      type="button"
                      onClick={() => setTab('vault')}
                      className="px-2.5 py-1.5 border border-[hsl(var(--emerald))] text-[hsl(var(--emerald))] font-medium"
                    >
                      View in Vault
                    </button>
                  )}

                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={idx === 0}
                    onClick={() => move(idx, -1)}
                    className="px-2 py-1 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={idx === q.length - 1}
                    onClick={() => move(idx, 1)}
                    className="px-2 py-1 border border-[hsl(var(--border))] bg-[hsl(var(--background-elevated))] text-text-primary disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="underline text-[hsl(var(--red))] hover:opacity-80"
                    onClick={() => remove.mutate(i.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {tab === 'spaces' && (
        <FieldSpacesPanel
          onSelectSpace={(sp) => {
            setFeedSpace({ id: sp.id, name: sp.name });
            setTab('feed');
          }}
        />
      )}
      {tab === 'feed' && (
        <FieldFeedPanel spaceId={feedSpace?.id ?? null} spaceName={feedSpace?.name} />
      )}
      {tab === 'vault' && <VaultPanel />}
      {tab === 'payouts' && <PayoutsPanel />}
      {tab === 'brief' && <BriefPanel />}
    </div>
  );
}
