/**
 * Intelligence Page - Intelligence fusion engine overview
 */

import React from 'react';
import { Brain, Zap, Satellite, Radio, Cpu, Database, Network, AlertTriangle, RefreshCw, Layers, Link2, GitBranch, Filter, Search } from 'lucide-react';
import { Signal } from '../../components/primitives/Signal';
import { Metric } from '../../components/primitives/Metric';
import { Card } from '../../components/ui/Card';

const IntelligencePage: React.FC = () => {
  return (
    <div className="h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
            <Brain size={28} className="text-violet" />
            Intelligence Fusion
          </h1>
          <p className="text-text-secondary mt-1">Multi-source intelligence correlation & fusion engine</p>
        </div>
        <Signal
          label="Fusion Engine"
          status="ONLINE"
          color="violet"
          pulse
          strength={5}
          type="ai"
          description="Intelligence fusion engine"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          title="DATA SOURCES"
          value={12}
          state="LIVE"
          pulse
          hint="Connected & streaming"
        />
        <Metric
          title="CORRELATION RATE"
          value="87%"
          state="LIVE"
          hint="Cross-source matches"
        />
        <Metric
          title="ALERT PRECISION"
          value="91.4%"
          state="LIVE"
          hint="Validated alerts"
        />
        <Metric
          title="FUSION LATENCY"
          value="< 3s"
          state="SYNCING"
          hint="End-to-end processing"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Data Sources" subtitle="Connected intelligence feeds">
          <div className="space-y-3">
            {[
              { name: 'NWS Alerts API', type: 'REST', status: 'LIVE', rate: '1,200/min', latency: '< 1s' },
              { name: 'NEXRAD Radar', type: 'WMS/TMS', status: 'LIVE', rate: 'Continuous', latency: '< 30s' },
              { name: 'GOES Satellite', type: 'NetCDF', status: 'LIVE', rate: '5 min', latency: '< 5m' },
              { name: 'Lightning (NLDN)', type: 'WebSocket', status: 'LIVE', rate: 'Real-time', latency: '< 10s' },
              { name: 'Storm Reports (LSR)', type: 'RSS/CSV', status: 'SYNCING', rate: '1 min', latency: '< 2m' },
              { name: 'Spotter Network', type: 'WebSocket', status: 'LIVE', rate: 'Event-driven', latency: '< 5s' },
              { name: 'Social Media (Twitter)', type: 'Streaming API', status: 'SYNCING', rate: '100/min', latency: '< 30s' },
              { name: 'Traffic Cameras', type: 'MJPEG', status: 'STALE', rate: 'On-demand', latency: '< 1m' },
              { name: 'Power Outage Maps', type: 'REST', status: 'LIVE', rate: '5 min', latency: '< 2m' },
              { name: 'Cell Tower Status', type: 'MQTT', status: 'LIVE', rate: 'Event-driven', latency: '< 10s' },
              { name: 'Insurance Claims', type: 'Batch/ETL', status: 'LIVE', rate: 'Daily', latency: '< 24h' },
              { name: 'Property Records', type: 'Database', status: 'LIVE', rate: 'On-demand', latency: '< 100ms' },
            ].map((src, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                <div className="flex items-center gap-3">
                  <Signal label={src.name} status={src.status as any} color="violet" pulse={src.status === 'LIVE'} strength={src.status === 'LIVE' ? 5 : src.status === 'SYNCING' ? 3 : 2} type="data" />
                </div>
                <div className="text-right text-sm text-text-tertiary">
                  <div>Type: <span className="text-text-primary font-medium">{src.type}</span></div>
                  <div>Rate: <span className="text-text-primary font-medium">{src.rate}</span> • Latency: <span className="text-text-primary font-medium">{src.latency}</span></div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Fusion Rules" subtitle="Active correlation logic">
          <div className="space-y-3">
            {[
              { name: 'Radar + LSR Correlation', rule: 'Storm cell + spotter report within 5km/10min', matches: '1,247/hr', precision: '94.2%' },
              { name: 'Lightning + Radar Merge', rule: 'Lightning density > 10/km² + reflectivity > 50dBZ', matches: '3,891/hr', precision: '91.8%' },
              { name: 'Satellite + Radar Sync', rule: 'Cloud top temp < -60°C + radar echo > 45dBZ', matches: '567/hr', precision: '88.4%' },
              { name: 'Social + Official Validation', rule: 'Social reports + NWS warning same polygon', matches: '234/hr', precision: '82.1%' },
              { name: 'Property Impact Scoring', rule: 'Storm track + property density + vulnerability', matches: '1,102/hr', precision: '89.7%' },
              { name: 'Multi-hazard Fusion', rule: 'Tornado + hail + wind + flood overlap', matches: '89/hr', precision: '95.3%' },
            ].map((rule, i) => (
              <div key={i} className="p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-violet/10 text-violet text-sm font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">{rule.name}</p>
                      <p className="text-xs text-text-tertiary">{rule.rule}</p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div>Matches: <span className="text-text-primary font-medium">{rule.matches}</span></div>
                    <div>Precision: <span className="text-emerald font-medium">{rule.precision}</span></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Correlation Graph" subtitle="Real-time entity relationships">
          <div className="space-y-3">
            {[
              { entity: 'Storm Cell #TX-2024-0451', connections: 12, type: 'Radar + LSR + Lightning', strength: 'STRONG' },
              { entity: 'Tornado Warning #OK-2024-0892', connections: 8, type: 'Radar + Spotter + Social', strength: 'STRONG' },
              { entity: 'Hail Swath #KS-2024-0156', connections: 15, type: 'Radar + Satellite + Claims', strength: 'MODERATE' },
              { entity: 'Flash Flood Zone #CO-2024-0334', connections: 6, type: 'Radar + Gauges + Reports', strength: 'MODERATE' },
              { entity: 'Wind Damage Path #NE-2024-0221', connections: 11, type: 'Radar + Tower + Outage', strength: 'STRONG' },
            ].map((entity, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${entity.strength === 'STRONG' ? 'bg-emerald/10 text-emerald' : 'bg-amber/10 text-amber'}`}>
                    <GitBranch size={18} />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{entity.entity}</p>
                    <p className="text-xs text-text-tertiary">{entity.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${entity.strength === 'STRONG' ? 'bg-emerald/10 text-emerald' : 'bg-amber/10 text-amber'}`}>
                    {entity.strength}
                  </span>
                  <div className="text-xs text-text-tertiary mt-1">{entity.connections} connections</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Intelligence Outputs" subtitle="Generated intelligence products">
          <div className="space-y-3">
            {[
              { product: 'Severe Weather Nowcast', frequency: '2 min', consumers: 24, latency: '< 1s', status: 'LIVE' },
              { product: 'Tornado Probability Grid', frequency: '5 min', consumers: 18, latency: '< 3s', status: 'LIVE' },
              { product: 'Hail Size Probability', frequency: '5 min', consumers: 15, latency: '< 3s', status: 'LIVE' },
              { product: 'Wind Gust Forecast', frequency: '10 min', consumers: 12, latency: '< 5s', status: 'SYNCING' },
              { product: 'Flash Flood Guidance', frequency: '15 min', consumers: 10, latency: '< 8s', status: 'LIVE' },
              { product: 'Property Risk Index', frequency: '1 min', consumers: 32, latency: '< 500ms', status: 'LIVE' },
              { product: 'Damage Assessment', frequency: 'Event', consumers: 8, latency: '< 30s', status: 'LIVE' },
              { product: 'Recovery Timeline', frequency: 'Daily', consumers: 6, latency: '< 1h', status: 'STALE' },
            ].map((prod, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                <div className="flex items-center gap-3">
                  <Signal label={prod.product} status={prod.status as any} color="violet" pulse={prod.status === 'LIVE'} strength={prod.status === 'LIVE' ? 5 : prod.status === 'SYNCING' ? 3 : 2} type="data" />
                </div>
                <div className="text-right text-sm text-text-tertiary">
                  <div>Freq: <span className="text-text-primary font-medium">{prod.frequency}</span> • Consumers: <span className="text-text-primary font-medium">{prod.consumers}</span></div>
                  <div>Latency: <span className="text-text-primary font-medium">{prod.latency}</span></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default IntelligencePage;