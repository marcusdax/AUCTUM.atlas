/**
 * Shared map layer & tracking algorithm toggle state across
 * Command Center (/command), Atlas Intelligence (/intelligence/atlas),
 * Storm Tracking (/storm-tracking), and Field Hub (/field).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DetectionLayerId = 'nexrad' | 'spc' | 'goes' | 'lightning' | 'lsr';
export type TrackingAlgoId = 'titan' | 'tvs' | 'hail' | 'wind' | 'flood';

export interface DetectionLayerMeta {
  id: DetectionLayerId;
  name: string;
  status: 'LIVE' | 'SYNCING';
  latency: string;
  coverage: string;
}

export interface TrackingAlgoMeta {
  id: TrackingAlgoId;
  name: string;
  version: string;
  status: 'ACTIVE' | 'SYNCING';
  accuracy: string;
}

export const STORM_DETECTION_LAYERS: DetectionLayerMeta[] = [
  { id: 'nexrad', name: 'NWS Radar (NEXRAD)', status: 'LIVE', latency: '< 30s', coverage: 'CONUS + Alaska' },
  { id: 'spc', name: 'Storm Prediction Center', status: 'LIVE', latency: '< 2m', coverage: 'National' },
  { id: 'goes', name: 'GOES Satellite', status: 'LIVE', latency: '< 5m', coverage: 'Hemispheric' },
  { id: 'lightning', name: 'Lightning Detection', status: 'LIVE', latency: '< 10s', coverage: 'CONUS' },
  { id: 'lsr', name: 'Storm Reports (LSR)', status: 'SYNCING', latency: '< 1m', coverage: 'Spotter network' },
];

export const TRACKING_ALGORITHMS: TrackingAlgoMeta[] = [
  { id: 'titan', name: 'Cell Tracking (TITAN)', version: 'v3.2', status: 'ACTIVE', accuracy: '94.2%' },
  { id: 'tvs', name: 'Tornado Vortex Sig.', version: 'v2.1', status: 'ACTIVE', accuracy: '89.7%' },
  { id: 'hail', name: 'Hail Size Estimation', version: 'v1.8', status: 'ACTIVE', accuracy: '87.3%' },
  { id: 'wind', name: 'Wind Gust Prediction', version: 'v2.5', status: 'SYNCING', accuracy: '91.1%' },
  { id: 'flood', name: 'Flash Flood Guidance', version: 'v1.4', status: 'ACTIVE', accuracy: '82.6%' },
];

interface MapLayersState {
  detectionLayers: Record<DetectionLayerId, boolean>;
  trackingAlgos: Record<TrackingAlgoId, boolean>;
  toggleDetectionLayer: (id: DetectionLayerId) => void;
  setDetectionLayer: (id: DetectionLayerId, enabled: boolean) => void;
  toggleTrackingAlgo: (id: TrackingAlgoId) => void;
  setTrackingAlgo: (id: TrackingAlgoId, enabled: boolean) => void;
  resetDefaults: () => void;
}

const DEFAULT_DETECTION: Record<DetectionLayerId, boolean> = {
  nexrad: true,
  spc: true,
  goes: false,
  lightning: true,
  lsr: true,
};

const DEFAULT_ALGOS: Record<TrackingAlgoId, boolean> = {
  titan: true,
  tvs: true,
  hail: true,
  wind: false,
  flood: true,
};

export const useMapLayersStore = create<MapLayersState>()(
  persist(
    (set) => ({
      detectionLayers: DEFAULT_DETECTION,
      trackingAlgos: DEFAULT_ALGOS,
      toggleDetectionLayer: (id) =>
        set((s) => ({
          detectionLayers: { ...s.detectionLayers, [id]: !s.detectionLayers[id] },
        })),
      setDetectionLayer: (id, enabled) =>
        set((s) => ({
          detectionLayers: { ...s.detectionLayers, [id]: enabled },
        })),
      toggleTrackingAlgo: (id) =>
        set((s) => ({
          trackingAlgos: { ...s.trackingAlgos, [id]: !s.trackingAlgos[id] },
        })),
      setTrackingAlgo: (id, enabled) =>
        set((s) => ({
          trackingAlgos: { ...s.trackingAlgos, [id]: enabled },
        })),
      resetDefaults: () =>
        set({ detectionLayers: DEFAULT_DETECTION, trackingAlgos: DEFAULT_ALGOS }),
    }),
    { name: 'auctum-map-layers' },
  ),
);
