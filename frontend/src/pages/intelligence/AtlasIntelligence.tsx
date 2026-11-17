/**
 * Atlas Intelligence Page - Storm detection & tracking intelligence
 */

import React from 'react';
import { Satellite, Zap, MapPin, TrendingUp, AlertTriangle, Wifi, WifiOff, RefreshCw, Layers } from 'lucide-react';
import { Signal } from '../../components/primitives/Signal';
import { Metric } from '../../components/primitives/Metric';
import { Card } from '../../components/ui/Card';

const AtlasIntelligencePage: React.FC = () => {
  return (
    <div className="h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
            <Satellite size={28} className="text-cyan" aria-hidden="true" />
            Atlas Intelligence
          </h1>
          <p className="text-text-secondary mt-1">Storm detection, tracking & radar intelligence</p>
        </div>
        <Signal
          label="Atlas Core"
          status="ONLINE"
          color="cyan"
          pulse
          strength={5}
          type="data"
          description="Storm detection & tracking"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          title="ACTIVE STORMS"
          value={3}
          state="LIVE"
          pulse
          hint="Tracking across CONUS"
        />
        <Metric
          title="RADAR COVERAGE"
          value="99.2%"
          state="LIVE"
          hint="NWS radar network"
        />
        <Metric
          title="DATA LATENCY"
          value="< 2 min"
          state="LIVE"
          hint="Real-time feed"
        />
        <Metric
          title="ALERT PRECISION"
          value="91.4%"
          state="SYNCING"
          hint="NOAA validation"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Storm Detection Layers" subtitle="Real-time data sources">
          <div className="space-y-4">
            {[
              { name: 'NWS Radar (NEXRAD)', status: 'LIVE', latency: '< 30s', coverage: 'CONUS + Alaska' },
              { name: 'Storm Prediction Center', status: 'LIVE', latency: '< 2m', coverage: 'National' },
              { name: 'GOES Satellite', status: 'LIVE', latency: '< 5m', coverage: 'Hemispheric' },
              { name: 'Lightning Detection', status: 'LIVE', latency: '< 10s', coverage: 'CONUS' },
              { name: 'Storm Reports (LSR)', status: 'SYNCING', latency: '< 1m', coverage: 'Spotter network' },
            ].map((layer, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                <div className="flex items-center gap-3">
                  <Signal label={layer.name} status={layer.status as any} color="cyan" pulse={layer.status === 'LIVE'} strength={layer.status === 'LIVE' ? 5 : 3} type="data" />
                </div>
                <div className="text-right text-sm text-text-tertiary">
                  <div>Latency: <span className="text-text-primary font-medium">{layer.latency}</span></div>
                  <div>Coverage: <span className="text-text-primary font-medium">{layer.coverage}</span></div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Tracking Algorithms" subtitle="Active intelligence models">
          <div className="space-y-4">
            {[
              { name: 'Cell Tracking (TITAN)', version: 'v3.2', accuracy: '94.2%', status: 'ACTIVE' },
              { name: 'Tornado Vortex Sig.', version: 'v2.1', accuracy: '89.7%', status: 'ACTIVE' },
              { name: 'Hail Size Estimation', version: 'v1.8', accuracy: '87.3%', status: 'ACTIVE' },
              { name: 'Wind Gust Prediction', version: 'v2.5', accuracy: '91.1%', status: 'SYNCING' },
              { name: 'Flash Flood Guidance', version: 'v1.4', accuracy: '82.6%', status: 'ACTIVE' },
            ].map((algo, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
                    <Zap size={18} />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{algo.name}</p>
                    <p className="text-xs text-text-tertiary">v{algo.version}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${algo.status === 'ACTIVE' ? 'bg-emerald/10 text-emerald' : 'bg-amber/10 text-amber'}`}>
                    {algo.status}
                  </span>
                  <div className="text-xs text-text-tertiary mt-1">Accuracy: <span className="text-text-primary font-medium">{algo.accuracy}</span></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Recent Storm Events" subtitle="Last 24 hours">
        <div className="space-y-3">
          {[
            { name: 'Supercell Cluster - OK/TX', severity: 'EXTREME', time: '12 min ago', alerts: 12, properties: 342 },
            { name: 'Severe T-Storm Line - MS/AL', severity: 'SEVERE', time: '45 min ago', alerts: 8, properties: 156 },
            { name: 'Tornado Warning - KS/NE', severity: 'EXTREME', time: '1h 23m ago', alerts: 5, properties: 89 },
            { name: 'Flash Flood Watch - CO/WY', severity: 'MODERATE', time: '2h 11m ago', alerts: 3, properties: 67 },
          ].map((event, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${event.severity === 'EXTREME' ? 'bg-red/10 text-red' : event.severity === 'SEVERE' ? 'bg-orange/10 text-orange' : 'bg-amber/10 text-amber'}`}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="font-semibold text-text-primary">{event.name}</p>
                  <p className="text-sm text-text-tertiary">{event.time}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className={`font-medium px-2 py-0.5 rounded ${event.severity === 'EXTREME' ? 'bg-red/10 text-red' : event.severity === 'SEVERE' ? 'bg-orange/10 text-orange' : 'bg-amber/10 text-amber'}`}>
                  {event.severity}
                </span>
                <span><MapPin size={14} className="inline mr-1" /> {event.alerts} alerts</span>
                <span><Zap size={14} className="inline mr-1" /> {event.properties} properties</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AtlasIntelligencePage;