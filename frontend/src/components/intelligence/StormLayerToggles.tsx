/**
 * Interactive Storm Detection Layers & Tracking Algorithms toggle panels.
 * Wired to useMapLayersStore so toggles immediately update StormMap in
 * Command Center, Atlas Intelligence, Storm Tracking, and Field Hub.
 */
import React from 'react';
import { Zap } from 'lucide-react';
import { Card } from '../ui/Card';
import { Signal } from '../primitives/Signal';
import {
  STORM_DETECTION_LAYERS,
  TRACKING_ALGORITHMS,
  useMapLayersStore,
} from '../../stores/mapLayersStore';

interface SwitchProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
}

const LayerSwitch: React.FC<SwitchProps> = ({ checked, onToggle, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={`Toggle ${label}`}
    onClick={onToggle}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors ${
      checked
        ? 'border-[hsl(var(--emerald))] bg-[hsl(var(--emerald))]'
        : 'border-[hsl(var(--border-hover))] bg-[hsl(var(--background))]'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-1'
      }`}
    />
  </button>
);

export const StormLayerToggles: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const {
    detectionLayers,
    trackingAlgos,
    toggleDetectionLayer,
    toggleTrackingAlgo,
    resetDefaults,
  } = useMapLayersStore();

  return (
    <div className={compact ? 'space-y-4' : 'grid grid-cols-1 lg:grid-cols-2 gap-6'}>
      <Card
        title="Storm Detection Layers"
        subtitle="Real-time data sources"
      >
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={resetDefaults}
            className="text-xs font-mono text-text-secondary underline hover:text-text-primary"
          >
            Reset defaults
          </button>
        </div>
        <div className="space-y-3">
          {STORM_DETECTION_LAYERS.map((layer) => {
            const enabled = detectionLayers[layer.id];
            return (
              <div
                key={layer.id}
                className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
                  enabled
                    ? 'bg-[hsl(var(--background-elevated))] border-[hsl(var(--border-hover))]'
                    : 'bg-[hsl(var(--background))] border-border opacity-75'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <LayerSwitch
                    checked={enabled}
                    onToggle={() => toggleDetectionLayer(layer.id)}
                    label={layer.name}
                  />
                  <Signal
                    label={layer.name}
                    status={layer.status === 'LIVE' ? 'ONLINE' : 'SYNCING'}
                    color="cyan"
                    pulse={enabled && layer.status === 'LIVE'}
                    strength={layer.status === 'LIVE' ? 5 : 3}
                    type="data"
                  />
                </div>
                <div className="text-right text-xs text-text-tertiary">
                  <div>
                    Data stream status:{' '}
                    <span
                      className={`font-semibold ${
                        layer.status === 'LIVE' ? 'text-emerald' : 'text-amber'
                      }`}
                    >
                      {layer.status}
                    </span>
                  </div>
                  <div>
                    Latency: <span className="text-text-primary font-medium">{layer.latency}</span>
                    {' · '}
                    Coverage: <span className="text-text-primary font-medium">{layer.coverage}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Tracking Algorithms" subtitle="Active intelligence models">
        <div className="space-y-3">
          {TRACKING_ALGORITHMS.map((algo) => {
            const enabled = trackingAlgos[algo.id];
            return (
              <div
                key={algo.id}
                className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
                  enabled
                    ? 'bg-[hsl(var(--background-elevated))] border-[hsl(var(--border-hover))]'
                    : 'bg-[hsl(var(--background))] border-border opacity-75'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <LayerSwitch
                    checked={enabled}
                    onToggle={() => toggleTrackingAlgo(algo.id)}
                    label={algo.name}
                  />
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
                    <Zap size={17} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{algo.name}</p>
                    <p className="text-xs font-mono text-text-tertiary">{algo.version}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      algo.status === 'ACTIVE'
                        ? 'bg-emerald/10 text-emerald'
                        : 'bg-amber/10 text-amber'
                    }`}
                  >
                    {algo.status}
                  </span>
                  <div className="text-xs text-text-tertiary mt-1">
                    Accuracy: <span className="text-text-primary font-medium">{algo.accuracy}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default StormLayerToggles;
