/**
 * System Intelligence Page - Core infrastructure & system health
 */

import React from 'react';
import { Server, Database, Network, Cpu, HardDrive, Wifi, WifiOff, Shield, AlertTriangle, TrendingUp, Activity, RefreshCw, Gauge } from 'lucide-react';
import { Signal } from '../../components/primitives/Signal';
import { Metric } from '../../components/primitives/Metric';
import { Card } from '../../components/ui/Card';

const SystemIntelligencePage: React.FC = () => {
  return (
    <div className="h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
            <Server size={28} className="text-emerald" aria-hidden="true" />
            System Intelligence
          </h1>
          <p className="text-text-secondary mt-1">Core infrastructure, platform health & system operations</p>
        </div>
        <Signal
          label="System Core"
          status="ONLINE"
          color="emerald"
          pulse
          strength={5}
          type="system"
          description="Core infrastructure"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          title="API HEALTH"
          value="HEALTHY"
          state="LIVE"
          pulse
          hint="All endpoints responding"
        />
        <Metric
          title="DATABASE"
          value="PRIMARY"
          state="LIVE"
          hint="Replication lag: < 10ms"
        />
        <Metric
          title="CACHE HIT RATE"
          value="96.8%"
          state="LIVE"
          hint="Redis cluster"
        />
        <Metric
          title="ERROR RATE"
          value="< 0.01%"
          state="LIVE"
          hint="Last 24 hours"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="API Endpoints" subtitle="Service health & performance">
          <div className="space-y-3">
            {[
              { name: '/api/v1/auth', status: 'HEALTHY', p50: '12ms', p99: '45ms', errorRate: '0.00%', uptime: '99.99%' },
              { name: '/api/v1/jobs', status: 'HEALTHY', p50: '28ms', p99: '89ms', errorRate: '0.01%', uptime: '99.98%' },
              { name: '/api/v1/leads', status: 'HEALTHY', p50: '22ms', p99: '76ms', errorRate: '0.00%', uptime: '99.99%' },
              { name: '/api/v1/estimates', status: 'HEALTHY', p50: '35ms', p99: '112ms', errorRate: '0.01%', uptime: '99.97%' },
              { name: '/api/v1/weather', status: 'HEALTHY', p50: '156ms', p99: '423ms', errorRate: '0.02%', uptime: '99.95%' },
              { name: '/api/v1/maps', status: 'HEALTHY', p50: '89ms', p99: '234ms', errorRate: '0.01%', uptime: '99.96%' },
              { name: '/api/v1/intelligence', status: 'SYNCING', p50: '234ms', p99: '567ms', errorRate: '0.03%', uptime: '99.94%' },
              { name: '/api/v1/storm-events', status: 'HEALTHY', p50: '67ms', p99: '189ms', errorRate: '0.00%', uptime: '99.98%' },
            ].map((api, i) => {
              const signalStatus = api.status === 'HEALTHY' ? 'ONLINE' : 'PROCESSING';
              return (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <Signal label={api.name} status={signalStatus} color="emerald" pulse={api.status === 'HEALTHY'} strength={api.status === 'HEALTHY' ? 5 : 3} type="network" />
                  </div>
                  <div className="text-right text-sm text-text-tertiary">
                    <div>p50: <span className="text-text-primary font-medium">{api.p50}</span> • p99: <span className="text-text-primary font-medium">{api.p99}</span></div>
                    <div>Errors: <span className="text-text-primary font-medium">{api.errorRate}</span> • Uptime: <span className="text-text-primary font-medium">{api.uptime}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Infrastructure" subtitle="Platform resources & capacity">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-cyan" />
                  <span className="font-medium text-text-primary">CPU Utilization</span>
                </div>
                <span className="text-text-primary font-mono">34.2%</span>
              </div>
              <div className="h-2 bg-[hsl(var(--background-elevated))] rounded-full overflow-hidden">
                <div className="h-full bg-cyan rounded-full transition-all" style={{ width: '34.2%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-primary" />
                  <span className="font-medium text-text-primary">Database Connections</span>
                </div>
                <span className="text-text-primary font-mono">127 / 200</span>
              </div>
              <div className="h-2 bg-[hsl(var(--background-elevated))] rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: '63.5%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive size={16} className="text-amber" />
                  <span className="font-medium text-text-primary">Disk Usage</span>
                </div>
                <span className="text-text-primary font-mono">1.2 TB / 4 TB (30%)</span>
              </div>
              <div className="h-2 bg-[hsl(var(--background-elevated))] rounded-full overflow-hidden">
                <div className="h-full bg-amber rounded-full transition-all" style={{ width: '30%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Network size={16} className="text-violet" />
                  <span className="font-medium text-text-primary">Network I/O</span>
                </div>
                <span className="text-text-primary font-mono">2.4 Gbps / 10 Gbps</span>
              </div>
              <div className="h-2 bg-[hsl(var(--background-elevated))] rounded-full overflow-hidden">
                <div className="h-full bg-violet rounded-full transition-all" style={{ width: '24%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-emerald" />
                  <span className="font-medium text-text-primary">Memory Usage</span>
                </div>
                <span className="text-text-primary font-mono">18.4 GB / 64 GB (28.8%)</span>
              </div>
              <div className="h-2 bg-[hsl(var(--background-elevated))] rounded-full overflow-hidden">
                <div className="h-full bg-emerald rounded-full transition-all" style={{ width: '28.8%' }} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Service Dependencies" subtitle="External service health">
          <div className="space-y-3">
            {[
              { name: 'PostgreSQL (Primary)', type: 'Database', status: 'HEALTHY', latency: '2ms', region: 'us-east-1' },
              { name: 'PostgreSQL (Replica)', type: 'Database', status: 'HEALTHY', latency: '4ms', region: 'us-west-2' },
              { name: 'Redis Cluster', type: 'Cache', status: 'HEALTHY', latency: '1ms', region: 'us-east-1' },
              { name: 'Kafka Cluster', type: 'Message Queue', status: 'HEALTHY', latency: '3ms', region: 'us-east-1' },
              { name: 'MinIO (S3)', type: 'Object Storage', status: 'HEALTHY', latency: '12ms', region: 'us-east-1' },
              { name: 'NWS API', type: 'External API', status: 'HEALTHY', latency: '234ms', region: 'External' },
              { name: 'NOAA Radar', type: 'External API', status: 'HEALTHY', latency: '156ms', region: 'External' },
              { name: 'GOES Satellite', type: 'External API', status: 'SYNCING', latency: '423ms', region: 'External' },
              { name: 'Auth0', type: 'Auth Provider', status: 'HEALTHY', latency: '89ms', region: 'Global' },
              { name: 'SendGrid', type: 'Email Service', status: 'HEALTHY', latency: '112ms', region: 'Global' },
            ].map((dep, i) => {
              const signalStatus = dep.status === 'HEALTHY' ? 'ONLINE' : 'PROCESSING';
              return (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                  <div className="flex items-center gap-3">
                    <Signal label={dep.name} status={signalStatus} color="emerald" pulse={dep.status === 'HEALTHY'} strength={dep.status === 'HEALTHY' ? 5 : 3} type="network" />
                  </div>
                  <div className="text-right text-sm text-text-tertiary">
                    <div>Type: <span className="text-text-primary font-medium">{dep.type}</span> • Region: <span className="text-text-primary font-medium">{dep.region}</span></div>
                    <div>Latency: <span className="text-text-primary font-medium">{dep.latency}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="System Events" subtitle="Recent operational events">
          <div className="space-y-3">
            {[
              { time: '2 min ago', level: 'INFO', service: 'api-gateway', message: 'New deployment v2.4.1 rolled out successfully' },
              { time: '15 min ago', level: 'INFO', service: 'intelligence-engine', message: 'Model retrain completed: Storm Classification v3.2.1' },
              { time: '1h ago', level: 'WARN', service: 'weather-ingestion', message: 'GOES satellite feed delayed by 3 min (resolved)' },
              { time: '3h ago', level: 'INFO', service: 'database', message: 'Automated backup completed: 2.4 TB in 47 min' },
              { time: '6h ago', level: 'INFO', service: 'cache', message: 'Redis cluster failover test passed' },
              { time: '12h ago', level: 'WARN', service: 'kafka', message: 'Consumer lag spike detected (resolved in 2 min)' },
              { time: '1d ago', level: 'INFO', service: 'storm-map', message: 'New radar tile layer deployed: NEXRAD Level 3' },
              { time: '2d ago', level: 'INFO', service: 'system', message: 'Scheduled maintenance window completed' },
            ].map((event, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-8 w-8 items-center justify-center rounded ${event.level === 'WARN' ? 'bg-amber/10 text-amber' : 'bg-emerald/10 text-emerald'}`}>
                    {event.level === 'WARN' ? <AlertTriangle size={14} /> : <Shield size={14} />}
                  </div>
                  <div>
                    <p className="font-medium text-text-primary truncate">{event.message}</p>
                    <p className="text-xs text-text-tertiary">{event.service} • {event.time}</p>
                  </div>
                </div>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${event.level === 'WARN' ? 'bg-amber/10 text-amber' : 'bg-emerald/10 text-emerald'}`}>
                  {event.level}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Deployment Status" subtitle="Current release & rollout">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
            <p className="text-xs text-text-tertiary uppercase tracking-wider">Current Version</p>
            <p className="text-2xl font-bold text-text-primary mt-1">v2.4.1</p>
            <p className="text-xs text-text-tertiary mt-2">Released: 2h ago</p>
          </div>
          <div className="p-4 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
            <p className="text-xs text-text-tertiary uppercase tracking-wider">Rollout Status</p>
            <p className="text-2xl font-bold text-emerald mt-1">COMPLETE</p>
            <p className="text-xs text-text-tertiary mt-2">All 12 pods healthy</p>
          </div>
          <div className="p-4 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
            <p className="text-xs text-text-tertiary uppercase tracking-wider">Next Release</p>
            <p className="text-2xl font-bold text-primary mt-1">v2.5.0</p>
            <p className="text-xs text-text-tertiary mt-2">Scheduled: 3 days</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SystemIntelligencePage;