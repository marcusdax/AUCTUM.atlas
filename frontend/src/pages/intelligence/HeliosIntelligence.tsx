/**
 * Helios Intelligence Page - AI intelligence & analysis
 */

import React from 'react';
import { Zap, Brain, TrendingUp, Cpu, Database, Network, AlertTriangle, RefreshCw, BarChart3, LineChart } from 'lucide-react';
import { Signal } from '../../components/primitives/Signal';
import { Metric } from '../../components/primitives/Metric';
import { Card } from '../../components/ui/Card';

const HeliosIntelligencePage: React.FC = () => {
  return (
    <div className="h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
            <Zap size={28} className="text-amber" aria-hidden="true" />
            Helios Intelligence
          </h1>
          <p className="text-text-secondary mt-1">AI-powered analysis, prediction & intelligence fusion</p>
        </div>
        <Signal
          label="Helios Core"
          status="ONLINE"
          color="amber"
          pulse
          strength={5}
          type="ai"
          description="AI intelligence & analysis"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          title="MODELS ACTIVE"
          value={4}
          state="LIVE"
          pulse
          hint="Inference engines running"
        />
        <Metric
          title="INFERENCE QUEUE"
          value="7 pending"
          state="LIVE"
          hint="Real-time processing"
        />
        <Metric
          title="ACCURACY (24h)"
          value="94.2%"
          state="LIVE"
          hint="Validated predictions"
        />
        <Metric
          title="LAST RETRAIN"
          value="6h ago"
          state="SYNCING"
          hint="Continuous learning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="AI Models" subtitle="Active inference engines">
          <div className="space-y-4">
            {[
              { name: 'Storm Classification', type: 'CNN + Transformer', accuracy: '96.4%', throughput: '1,200 req/min', status: 'ONLINE' },
              { name: 'Damage Prediction', type: 'Gradient Boosting', accuracy: '91.8%', throughput: '850 req/min', status: 'ONLINE' },
              { name: 'Risk Scoring Engine', type: 'Ensemble (XGBoost + NN)', accuracy: '94.2%', throughput: '2,100 req/min', status: 'ONLINE' },
              { name: 'Trajectory Forecasting', type: 'LSTM + Attention', accuracy: '89.7%', throughput: '450 req/min', status: 'SYNCING' },
              { name: 'Property Impact Model', type: 'Graph Neural Net', accuracy: '87.3%', throughput: '320 req/min', status: 'ONLINE' },
            ].map((model, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber/10 text-amber">
                    <Brain size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{model.name}</p>
                    <p className="text-xs text-text-tertiary">{model.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${model.status === 'ONLINE' ? 'bg-emerald/10 text-emerald' : 'bg-amber/10 text-amber'}`}>
                    {model.status}
                  </span>
                  <div className="text-xs text-text-tertiary mt-1">
                    Acc: <span className="text-text-primary font-medium">{model.accuracy}</span> • 
                    <span className="text-text-primary font-medium">{model.throughput}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Intelligence Pipeline" subtitle="Data flow & processing">
          <div className="space-y-3">
            {[
              { stage: 'Ingestion', source: 'NWS + Radar + Satellite', rate: '2.4M events/min', latency: '< 5s', health: 'HEALTHY' },
              { stage: 'Preprocessing', source: 'Normalization + QC', rate: '2.3M events/min', latency: '< 2s', health: 'HEALTHY' },
              { stage: 'Feature Engineering', source: '187 features extracted', rate: '2.3M events/min', latency: '< 8s', health: 'HEALTHY' },
              { stage: 'Inference', source: '4 models parallel', rate: '2.1M events/min', latency: '< 15s', health: 'HEALTHY' },
              { stage: 'Fusion', source: 'Multi-model ensemble', rate: '1.8M events/min', latency: '< 3s', health: 'HEALTHY' },
              { stage: 'Distribution', source: 'WebSocket + REST', rate: '1.8M events/min', latency: '< 1s', health: 'HEALTHY' },
            ].map((stage, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary text-sm font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{stage.stage}</p>
                    <p className="text-xs text-text-tertiary">{stage.source}</p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-text-secondary">Rate: <span className="text-text-primary font-medium">{stage.rate}</span></div>
                  <div className="text-text-secondary">Latency: <span className="text-text-primary font-medium">{stage.latency}</span></div>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${stage.health === 'HEALTHY' ? 'bg-emerald/10 text-emerald' : 'bg-amber/10 text-amber'}`}>
                    {stage.health}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Recent Predictions" subtitle="High-confidence AI findings">
          <div className="space-y-3">
            {[
              { type: 'Tornado Probability', location: 'Moore, OK', confidence: '97.3%', risk: 'EXTREME', time: '3 min ago' },
              { type: 'Hail Size > 2"', location: 'Norman, OK', confidence: '94.1%', risk: 'HIGH', time: '8 min ago' },
              { type: 'Wind Gust > 70mph', location: 'Wichita, KS', confidence: '91.8%', risk: 'HIGH', time: '12 min ago' },
              { type: 'Flash Flood Risk', location: 'Boulder, CO', confidence: '88.4%', risk: 'MODERATE', time: '22 min ago' },
              { type: 'Property Damage Index', location: 'Dallas Metro', confidence: '93.2%', risk: 'HIGH', time: '35 min ago' },
            ].map((pred, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${pred.risk === 'EXTREME' ? 'bg-red/10 text-red' : pred.risk === 'HIGH' ? 'bg-orange/10 text-orange' : 'bg-amber/10 text-amber'}`}>
                    <Brain size={18} />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{pred.type}</p>
                    <p className="text-xs text-text-tertiary">{pred.location} • {pred.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${pred.risk === 'EXTREME' ? 'bg-red/10 text-red' : pred.risk === 'HIGH' ? 'bg-orange/10 text-orange' : 'bg-amber/10 text-amber'}`}>
                    {pred.risk}
                  </span>
                  <div className="text-xs text-text-tertiary mt-1">Confidence: <span className="text-text-primary font-medium">{pred.confidence}</span></div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Model Performance" subtitle="24-hour rolling metrics">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                <p className="text-xs text-text-tertiary uppercase tracking-wider">Precision</p>
                <p className="text-2xl font-bold text-emerald">94.2%</p>
                <p className="text-xs text-emerald">+1.2% vs 7d</p>
              </div>
              <div className="p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                <p className="text-xs text-text-tertiary uppercase tracking-wider">Recall</p>
                <p className="text-2xl font-bold text-primary">91.8%</p>
                <p className="text-xs text-emerald">+0.8% vs 7d</p>
              </div>
              <div className="p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                <p className="text-xs text-text-tertiary uppercase tracking-wider">F1 Score</p>
                <p className="text-2xl font-bold text-amber">92.9%</p>
                <p className="text-xs text-emerald">+1.0% vs 7d</p>
              </div>
              <div className="p-3 rounded-lg bg-[hsl(var(--background-elevated))] border border-border">
                <p className="text-xs text-text-tertiary uppercase tracking-wider">AUC-ROC</p>
                <p className="text-2xl font-bold text-cyan">0.973</p>
                <p className="text-xs text-emerald">+0.004 vs 7d</p>
              </div>
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-sm text-text-secondary">
                <BarChart3 size={14} className="inline mr-1" /> 
                Training data: 2.4M samples • Last update: 6h ago • Next retrain: 18h
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HeliosIntelligencePage;