import React, { useMemo, useState } from 'react';
import Card, { Badge } from '../ui/Card';
import Button from '../ui/Button';
import { Download, RotateCcw, Sliders } from 'lucide-react';

type ScenarioId = 'Conservative' | 'Base' | 'Storm_Surge';
type ModelId = 'Model_A_Escrow' | 'Model_B_SaaS' | 'Model_C_DePIN' | 'Blended_Flywheel';

interface ScenarioRow {
  scenario: ScenarioId;
  model: ModelId;
  m36ArrUsd: number;
  total36mRevenueUsd: number;
  blendedGmPct: number;
  cumulativeEbitdaUsd: number;
  peakCashDrawUsd: number;
  breakevenMonth: string;
}

interface SensitivityRow {
  lever: string;
  parameterCase: string;
  model: ModelId;
  m36ArrUsd: number;
  total36mRevenueUsd: number;
  cumulativeEbitdaUsd: number;
  m36GmPct: number;
  breakevenMonth: string;
}

const SCENARIO_ROWS: ScenarioRow[] = [
  { scenario: 'Conservative', model: 'Model_A_Escrow', m36ArrUsd: 93041, total36mRevenueUsd: 134874, blendedGmPct: 49.3, cumulativeEbitdaUsd: -583375, peakCashDrawUsd: -583375, breakevenMonth: '>36M' },
  { scenario: 'Conservative', model: 'Model_B_SaaS', m36ArrUsd: 29583, total36mRevenueUsd: 88749, blendedGmPct: 80.7, cumulativeEbitdaUsd: -632588, peakCashDrawUsd: -632588, breakevenMonth: '>36M' },
  { scenario: 'Conservative', model: 'Model_C_DePIN', m36ArrUsd: 162816, total36mRevenueUsd: 181446, blendedGmPct: 86.8, cumulativeEbitdaUsd: -987244, peakCashDrawUsd: -987244, breakevenMonth: '>36M' },
  { scenario: 'Conservative', model: 'Blended_Flywheel', m36ArrUsd: 318005, total36mRevenueUsd: 434722, blendedGmPct: 77.0, cumulativeEbitdaUsd: -511262, peakCashDrawUsd: -511262, breakevenMonth: '>36M' },
  { scenario: 'Base', model: 'Model_A_Escrow', m36ArrUsd: 543947, total36mRevenueUsd: 633146, blendedGmPct: 65.2, cumulativeEbitdaUsd: -558088, peakCashDrawUsd: -558088, breakevenMonth: '>36M' },
  { scenario: 'Base', model: 'Model_B_SaaS', m36ArrUsd: 305063, total36mRevenueUsd: 441686, blendedGmPct: 81.2, cumulativeEbitdaUsd: -583046, peakCashDrawUsd: -583046, breakevenMonth: '>36M' },
  { scenario: 'Base', model: 'Model_C_DePIN', m36ArrUsd: 1400996, total36mRevenueUsd: 1329537, blendedGmPct: 86.8, cumulativeEbitdaUsd: -148709, peakCashDrawUsd: -602004, breakevenMonth: 'M24' },
  { scenario: 'Base', model: 'Blended_Flywheel', m36ArrUsd: 2440387, total36mRevenueUsd: 2552747, blendedGmPct: 82.8, cumulativeEbitdaUsd: 862087, peakCashDrawUsd: -242953, breakevenMonth: 'M16' },
  { scenario: 'Storm_Surge', model: 'Model_A_Escrow', m36ArrUsd: 2174003, total36mRevenueUsd: 2328518, blendedGmPct: 71.8, cumulativeEbitdaUsd: 150914, peakCashDrawUsd: -263449, breakevenMonth: 'M17' },
  { scenario: 'Storm_Surge', model: 'Model_B_SaaS', m36ArrUsd: 1752070, total36mRevenueUsd: 1688823, blendedGmPct: 81.7, cumulativeEbitdaUsd: -16357, peakCashDrawUsd: -343310, breakevenMonth: 'M24' },
  { scenario: 'Storm_Surge', model: 'Model_C_DePIN', m36ArrUsd: 7369045, total36mRevenueUsd: 6200165, blendedGmPct: 86.8, cumulativeEbitdaUsd: 3922255, peakCashDrawUsd: -445927, breakevenMonth: 'M15' },
  { scenario: 'Storm_Surge', model: 'Blended_Flywheel', m36ArrUsd: 12056018, total36mRevenueUsd: 10801139, blendedGmPct: 84.5, cumulativeEbitdaUsd: 7078401, peakCashDrawUsd: -143462, breakevenMonth: 'M12' },
];

const SENSITIVITY_ROWS: SensitivityRow[] = [
  { lever: 'DePIN_Annual_Query_Reuse', parameterCase: '1.5x / parcel / yr', model: 'Blended_Flywheel', m36ArrUsd: 1539747, total36mRevenueUsd: 1723581, cumulativeEbitdaUsd: 140712, m36GmPct: 80.74, breakevenMonth: 'M20' },
  { lever: 'DePIN_Annual_Query_Reuse', parameterCase: '4.2x / parcel / yr (Base)', model: 'Blended_Flywheel', m36ArrUsd: 2440387, total36mRevenueUsd: 2552747, cumulativeEbitdaUsd: 862087, m36GmPct: 83.05, breakevenMonth: 'M16' },
  { lever: 'DePIN_Annual_Query_Reuse', parameterCase: '8.0x / parcel / yr (Dense Carrier API)', model: 'Blended_Flywheel', m36ArrUsd: 3707955, total36mRevenueUsd: 3719722, cumulativeEbitdaUsd: 1877355, m36GmPct: 84.4, breakevenMonth: 'M15' },
  { lever: 'Buyer_B2B_Fee_BPS', parameterCase: '500 bps (5%)', model: 'Blended_Flywheel', m36ArrUsd: 2180532, total36mRevenueUsd: 2251674, cumulativeEbitdaUsd: 561014, m36GmPct: 81.03, breakevenMonth: 'M17' },
  { lever: 'Buyer_B2B_Fee_BPS', parameterCase: '1000 bps (10% Canonical)', model: 'Blended_Flywheel', m36ArrUsd: 2440387, total36mRevenueUsd: 2552747, cumulativeEbitdaUsd: 862087, m36GmPct: 83.05, breakevenMonth: 'M16' },
  { lever: 'Buyer_B2B_Fee_BPS', parameterCase: '1500 bps (15% Premium)', model: 'Blended_Flywheel', m36ArrUsd: 2700243, total36mRevenueUsd: 2853820, cumulativeEbitdaUsd: 1163160, m36GmPct: 84.68, breakevenMonth: 'M15' },
  { lever: 'Storm_Season_Surge', parameterCase: '1.00x (No Surge)', model: 'Blended_Flywheel', m36ArrUsd: 2361616, total36mRevenueUsd: 2401303, cumulativeEbitdaUsd: 736129, m36GmPct: 82.92, breakevenMonth: 'M17' },
  { lever: 'Storm_Season_Surge', parameterCase: '1.35x (Base)', model: 'Blended_Flywheel', m36ArrUsd: 2440387, total36mRevenueUsd: 2552747, cumulativeEbitdaUsd: 862087, m36GmPct: 83.05, breakevenMonth: 'M16' },
  { lever: 'Storm_Season_Surge', parameterCase: '1.85x (Active Hail Year)', model: 'Blended_Flywheel', m36ArrUsd: 2552917, total36mRevenueUsd: 2769096, cumulativeEbitdaUsd: 1042027, m36GmPct: 83.22, breakevenMonth: 'M15' },
  { lever: 'Payment_Rail_Cost', parameterCase: '0.80% (ACH / Prefunded Wallet)', model: 'Blended_Flywheel', m36ArrUsd: 2440387, total36mRevenueUsd: 2552747, cumulativeEbitdaUsd: 953233, m36GmPct: 86.42, breakevenMonth: 'M16' },
  { lever: 'Payment_Rail_Cost', parameterCase: '1.80% (Base Blend)', model: 'Blended_Flywheel', m36ArrUsd: 2440387, total36mRevenueUsd: 2552747, cumulativeEbitdaUsd: 862087, m36GmPct: 83.05, breakevenMonth: 'M16' },
  { lever: 'Payment_Rail_Cost', parameterCase: '2.90% (Full Card Processing)', model: 'Blended_Flywheel', m36ArrUsd: 2440387, total36mRevenueUsd: 2552747, cumulativeEbitdaUsd: 761826, m36GmPct: 79.34, breakevenMonth: 'M16' },
  { lever: 'SaaS_Monthly_Churn', parameterCase: '2.0% / mo', model: 'Blended_Flywheel', m36ArrUsd: 2636512, total36mRevenueUsd: 2724472, cumulativeEbitdaUsd: 968638, m36GmPct: 83.34, breakevenMonth: 'M16' },
  { lever: 'SaaS_Monthly_Churn', parameterCase: '3.5% / mo (Base)', model: 'Blended_Flywheel', m36ArrUsd: 2440387, total36mRevenueUsd: 2552747, cumulativeEbitdaUsd: 862087, m36GmPct: 83.05, breakevenMonth: 'M16' },
  { lever: 'SaaS_Monthly_Churn', parameterCase: '7.0% / mo (Seasonal Churn)', model: 'Blended_Flywheel', m36ArrUsd: 2228451, total36mRevenueUsd: 2328945, cumulativeEbitdaUsd: 723223, m36GmPct: 82.67, breakevenMonth: 'M17' },
];

const MODEL_LABELS: Record<ModelId, string> = {
  Model_A_Escrow: 'Model A — B2B Field Escrow',
  Model_B_SaaS: 'Model B — Contractor SaaS',
  Model_C_DePIN: 'Model C — DePIN Property Ledger',
  Blended_Flywheel: 'Blended Flywheel (A + B + C)',
};

const fmtUsd = (n: number) =>
  n < 0 ? `-$${Math.abs(Math.round(n)).toLocaleString()}` : `$${Math.round(n).toLocaleString()}`;

export function buildScenarioSummaryCsv(): string {
  const header = [
    'scenario',
    'model',
    'm36_arr_runrate_usd',
    'total_36m_revenue_usd',
    'blended_gm_pct',
    'total_36m_ebitda_usd',
    'peak_cash_draw_usd',
    'breakeven_month',
  ].join(',');
  const lines = SCENARIO_ROWS.map((r) =>
    [
      r.scenario,
      r.model,
      r.m36ArrUsd,
      r.total36mRevenueUsd,
      r.blendedGmPct,
      r.cumulativeEbitdaUsd,
      r.peakCashDrawUsd,
      r.breakevenMonth,
    ].join(',')
  );
  return [header, ...lines].join('\n');
}

interface SimPoint {
  month: number;
  monthlyRevenue: number;
  monthlyEbitda: number;
  cumulativeEbitda: number;
}

/** Deterministic interactive 36-month Flywheel simulator calibrated to canonical Base Flywheel (+$862k EBITDA / M16 breakeven). */
function simulateFlywheel(params: {
  parcelReuse: number;
  feeBps: number;
  surgeMult: number;
  railPct: number;
  saasScalePct: number;
}): {
  points: SimPoint[];
  m36Arr: number;
  totalRevenue: number;
  totalEbitda: number;
  blendedGmPct: number;
  peakCashDraw: number;
  breakevenMonth: string;
} {
  const points: SimPoint[] = [];
  let cumEbitda = 0;
  let peakCashDraw = 0;
  let totalRev = 0;
  let totalCogs = 0;
  let breakevenMonth = '>36M';

  for (let m = 1; m <= 36; m++) {
    const progress = m / 36;
    const surgeActive = (m >= 4 && m <= 7) || (m >= 16 && m <= 19) || (m >= 28 && m <= 31);
    const seasonal = surgeActive ? params.surgeMult : 1.0;

    // Calibrated component ramp matching canonical Base Blended Flywheel at defaults (4.2x, 1000 bps, 1.35x, 1.8%, 100%)
    const escrowMonthly = 45329 * Math.pow(progress, 1.65) * (params.feeBps / 1000) * (0.78 + 0.22 * seasonal);
    const saasMonthly = 25422 * Math.pow(progress, 1.35) * (params.saasScalePct / 100);
    const depinMonthly = 116750 * Math.pow(progress, 1.8) * (params.parcelReuse / 4.2) * (0.88 + 0.12 * seasonal);

    const rev = escrowMonthly + saasMonthly + depinMonthly;
    const cogs =
      escrowMonthly * (0.12 + params.railPct / 100) +
      saasMonthly * 0.19 +
      depinMonthly * 0.132;
    const fixedOpex = 24000 + 21000 * progress;
    const ebitda = rev - cogs - fixedOpex;

    totalRev += rev;
    totalCogs += cogs;
    cumEbitda += ebitda;
    if (cumEbitda < peakCashDraw) peakCashDraw = cumEbitda;
    if (breakevenMonth === '>36M' && ebitda > 0) {
      breakevenMonth = `M${m}`;
    }

    points.push({ month: m, monthlyRevenue: rev, monthlyEbitda: ebitda, cumulativeEbitda: cumEbitda });
  }

  const m36Arr = points[points.length - 1].monthlyRevenue * 12;
  const blendedGmPct = totalRev > 0 ? ((totalRev - totalCogs) / totalRev) * 100 : 0;

  return {
    points,
    m36Arr,
    totalRevenue: totalRev,
    totalEbitda: cumEbitda,
    blendedGmPct,
    peakCashDraw,
    breakevenMonth,
  };
}

export const RevenueModelTab: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId | 'ALL'>('Base');
  const [selectedLever, setSelectedLever] = useState<string>('ALL');

  // Interactive What-If Sliders
  const [parcelReuse, setParcelReuse] = useState(4.2);
  const [feeBps, setFeeBps] = useState(1000);
  const [surgeMult, setSurgeMult] = useState(1.35);
  const [railPct, setRailPct] = useState(1.8);
  const [saasScalePct, setSaasScalePct] = useState(100);

  const sim = useMemo(
    () => simulateFlywheel({ parcelReuse, feeBps, surgeMult, railPct, saasScalePct }),
    [parcelReuse, feeBps, surgeMult, railPct, saasScalePct]
  );

  const visibleScenarios = useMemo(
    () =>
      selectedScenario === 'ALL'
        ? SCENARIO_ROWS
        : SCENARIO_ROWS.filter((r) => r.scenario === selectedScenario),
    [selectedScenario]
  );

  const visibleSensitivities = useMemo(
    () =>
      selectedLever === 'ALL'
        ? SENSITIVITY_ROWS
        : SENSITIVITY_ROWS.filter((r) => r.lever === selectedLever),
    [selectedLever]
  );

  const downloadSummaryCsv = () => {
    const blob = new Blob([buildScenarioSummaryCsv()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'auctum_36m_pnl_scenarios_summary.csv';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const resetSimulator = () => {
    setParcelReuse(4.2);
    setFeeBps(1000);
    setSurgeMult(1.35);
    setRailPct(1.8);
    setSaasScalePct(100);
  };

  // SVG chart bounds (honest shared scale including negative drawdown & zero baseline)
  const chartW = 720;
  const chartH = 220;
  const padL = 68;
  const padR = 20;
  const padT = 18;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const yVals = [
    0,
    ...sim.points.map((p) => p.monthlyRevenue * 12),
    ...sim.points.map((p) => p.cumulativeEbitda),
  ];
  const yMin = Math.min(...yVals);
  const yMax = Math.max(100_000, ...yVals);
  const ySpan = Math.max(1, yMax - yMin);
  const toX = (m: number) => padL + ((m - 1) / 35) * plotW;
  const toY = (v: number) => padT + ((yMax - v) / ySpan) * plotH;

  const arrPath = sim.points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(p.month).toFixed(1)} ${toY(p.monthlyRevenue * 12).toFixed(1)}`)
    .join(' ');
  const ebitdaPath = sim.points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(p.month).toFixed(1)} ${toY(p.cumulativeEbitda).toFixed(1)}`)
    .join(' ');
  const zeroY = toY(0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-text-tertiary uppercase">Simulated M36 ARR Run-Rate</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{fmtUsd(sim.m36Arr)}</p>
          <p className="text-xs text-text-secondary">
            {fmtUsd(sim.totalRevenue)} 36M cumulative revenue
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-tertiary uppercase">Simulated 36M EBITDA</p>
          <p className={`mt-1 text-2xl font-bold ${sim.totalEbitda >= 0 ? 'text-emerald' : 'text-red'}`}>
            {sim.totalEbitda >= 0 ? `+${fmtUsd(sim.totalEbitda)}` : fmtUsd(sim.totalEbitda)}
          </p>
          <p className="text-xs text-text-secondary">
            Blended GM {sim.blendedGmPct.toFixed(1)}% · Peak draw {fmtUsd(sim.peakCashDraw)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-tertiary uppercase">Operating Breakeven</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{sim.breakevenMonth}</p>
          <p className="text-xs text-text-secondary">Base Flywheel breakeven M16 · Surge M12</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-tertiary uppercase">Canonical EDA Audit</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">432 / 60</p>
          <p className="text-xs text-text-secondary">Verified monthly P&amp;L &amp; sensitivity rows</p>
        </Card>
      </div>

      {/* Interactive K-Dense Unit Economics Simulator & Trajectory Plot */}
      <Card
        title="Interactive Flywheel P&L & Unit-Economics Simulator"
        subtitle="Adjust operational levers below to stress-test M1–M36 ARR run-rate and cumulative EBITDA with shared zero-baseline scale"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                DePIN Reuse: {parcelReuse.toFixed(1)}x / yr
              </label>
              <input
                type="range"
                min="1.5"
                max="10.0"
                step="0.5"
                value={parcelReuse}
                onChange={(e) => setParcelReuse(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Buyer Escrow Fee: {feeBps} bps
              </label>
              <input
                type="range"
                min="300"
                max="1500"
                step="50"
                value={feeBps}
                onChange={(e) => setFeeBps(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Storm Surge Mult: {surgeMult.toFixed(2)}x
              </label>
              <input
                type="range"
                min="1.0"
                max="2.5"
                step="0.05"
                value={surgeMult}
                onChange={(e) => setSurgeMult(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Payment Rail COGS: {railPct.toFixed(1)}%
              </label>
              <input
                type="range"
                min="0.8"
                max="2.9"
                step="0.1"
                value={railPct}
                onChange={(e) => setRailPct(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                SaaS Seat Ramp: {saasScalePct}%
              </label>
              <input
                type="range"
                min="50"
                max="200"
                step="10"
                value={saasScalePct}
                onChange={(e) => setSaasScalePct(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <Sliders size={13} />
                <strong>Legend:</strong> Solid line = Annualized ARR Run-Rate (USD)
              </span>
              <span className="inline-flex items-center gap-1.5">
                Dashed line = Cumulative EBITDA (USD)
              </span>
              <span className="inline-flex items-center gap-1.5">Dotted line = $0 baseline</span>
            </div>
            <Button variant="ghost" size="sm" leftIcon={<RotateCcw size={13} />} onClick={resetSimulator}>
              Reset Base Defaults
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-3">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full max-w-4xl mx-auto h-52"
              role="img"
              aria-label={`Simulated 36-month trajectory reaching ${fmtUsd(sim.m36Arr)} ARR and ${fmtUsd(sim.totalEbitda)} cumulative EBITDA`}
            >
              {/* Zero horizontal baseline */}
              <line
                x1={padL}
                y1={zeroY}
                x2={chartW - padR}
                y2={zeroY}
                stroke="currentColor"
                strokeOpacity="0.35"
                strokeDasharray="3 3"
              />
              <text x={padL - 8} y={zeroY + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.7">
                $0
              </text>
              <text x={padL - 8} y={padT + 8} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.7">
                {fmtUsd(yMax)}
              </text>
              {yMin < 0 && (
                <text x={padL - 8} y={chartH - padB} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.7">
                  {fmtUsd(yMin)}
                </text>
              )}

              {/* X-axis month markers (M1, M12, M24, M36) */}
              {[1, 12, 24, 36].map((m) => (
                <text
                  key={m}
                  x={toX(m)}
                  y={chartH - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fill="currentColor"
                  opacity="0.7"
                >
                  M{m}
                </text>
              ))}

              {/* ARR curve (solid primary) */}
              <path d={arrPath} fill="none" stroke="#1d4ed8" strokeWidth="2.5" />
              {/* Cumulative EBITDA curve (dashed emerald/red) */}
              <path
                d={ebitdaPath}
                fill="none"
                stroke={sim.totalEbitda >= 0 ? '#059669' : '#dc2626'}
                strokeWidth="2.2"
                strokeDasharray="6 4"
              />
            </svg>
          </div>
        </div>
      </Card>

      <Card
        title="36-Month P&L Trajectories — Model A vs. B vs. C vs. Blended Flywheel"
        subtitle="Comparing Conservative, Base, and Storm-Surge P&L trajectories"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {(['Base', 'Conservative', 'Storm_Surge', 'ALL'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedScenario(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium border ${
                  selectedScenario === s
                    ? 'bg-accent text-white border-accent'
                    : 'bg-[hsl(var(--background-elevated))] text-text-secondary border-border hover:text-text-primary'
                }`}
              >
                {s === 'ALL' ? 'All Scenarios' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Download size={14} />}
            onClick={downloadSummaryCsv}
          >
            Scenario CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-text-tertiary">
              <tr>
                <th className="py-2 pr-4">Scenario</th>
                <th className="py-2 pr-4">Business Model</th>
                <th className="py-2 pr-4 text-right">M36 ARR Run-Rate</th>
                <th className="py-2 pr-4 text-right">36M Revenue</th>
                <th className="py-2 pr-4 text-right">Blended GM%</th>
                <th className="py-2 pr-4 text-right">36M EBITDA</th>
                <th className="py-2 pr-4 text-right">Peak Cash Draw</th>
                <th className="py-2 text-right">Breakeven</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleScenarios.map((row) => {
                const isBlended = row.model === 'Blended_Flywheel';
                return (
                  <tr
                    key={`${row.scenario}-${row.model}`}
                    className={isBlended ? 'bg-accent/5 font-semibold' : undefined}
                  >
                    <td className="py-2.5 pr-4">
                      <Badge size="sm">{row.scenario.replace('_', ' ')}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-text-primary">{MODEL_LABELS[row.model]}</td>
                    <td className="py-2.5 pr-4 text-right font-mono">{fmtUsd(row.m36ArrUsd)}</td>
                    <td className="py-2.5 pr-4 text-right font-mono">{fmtUsd(row.total36mRevenueUsd)}</td>
                    <td className="py-2.5 pr-4 text-right font-mono">{row.blendedGmPct.toFixed(1)}%</td>
                    <td
                      className={`py-2.5 pr-4 text-right font-mono ${
                        row.cumulativeEbitdaUsd >= 0 ? 'text-emerald' : 'text-red'
                      }`}
                    >
                      {row.cumulativeEbitdaUsd >= 0 ? `+${fmtUsd(row.cumulativeEbitdaUsd)}` : fmtUsd(row.cumulativeEbitdaUsd)}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono text-text-secondary">
                      {fmtUsd(row.peakCashDrawUsd)}
                    </td>
                    <td className="py-2.5 text-right font-mono">{row.breakevenMonth}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="One-At-a-Time Sensitivity Analysis (Base Blended Flywheel Baseline: +$862,087 EBITDA / M16)">
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {[
            'ALL',
            'DePIN_Annual_Query_Reuse',
            'Buyer_B2B_Fee_BPS',
            'Storm_Season_Surge',
            'Payment_Rail_Cost',
            'SaaS_Monthly_Churn',
          ].map((lever) => (
            <button
              key={lever}
              type="button"
              onClick={() => setSelectedLever(lever)}
              className={`rounded-md px-2 py-1 text-xs border ${
                selectedLever === lever
                  ? 'bg-accent text-white border-accent'
                  : 'bg-[hsl(var(--background-elevated))] text-text-secondary border-border hover:text-text-primary'
              }`}
            >
              {lever === 'ALL' ? 'All Levers' : lever.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-text-tertiary">
              <tr>
                <th className="py-2 pr-4">Sensitivity Lever</th>
                <th className="py-2 pr-4">Parameter Case</th>
                <th className="py-2 pr-4 text-right">M36 ARR</th>
                <th className="py-2 pr-4 text-right">36M Revenue</th>
                <th className="py-2 pr-4 text-right">M36 GM%</th>
                <th className="py-2 pr-4 text-right">36M EBITDA</th>
                <th className="py-2 text-right">Breakeven</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleSensitivities.map((row) => (
                <tr key={`${row.lever}-${row.parameterCase}`}>
                  <td className="py-2 pr-4 text-xs font-mono text-text-secondary">{row.lever}</td>
                  <td className="py-2 pr-4 text-text-primary">{row.parameterCase}</td>
                  <td className="py-2 pr-4 text-right font-mono">{fmtUsd(row.m36ArrUsd)}</td>
                  <td className="py-2 pr-4 text-right font-mono">{fmtUsd(row.total36mRevenueUsd)}</td>
                  <td className="py-2 pr-4 text-right font-mono">{row.m36GmPct.toFixed(2)}%</td>
                  <td className="py-2 pr-4 text-right font-mono text-emerald">
                    +{fmtUsd(row.cumulativeEbitdaUsd)}
                  </td>
                  <td className="py-2 text-right font-mono">{row.breakevenMonth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          Methodology grounded in Certificate Transparency (RFC 6962 / RFC 9162), DePIN Tokenomics
          (Frontiers in Blockchain 2025, 10.3389/fbloc.2025.1644115), Proof-of-Location
          (Scientific Reports 2025, 10.1038/s41598-025-04566-4), and Scientific Agent Skills
          (Kassis et al., arXiv:2609.00065). Full 432-row monthly model and Excel workbook live in{' '}
          <code>docs/financial/auctum_36m_revenue_model.xlsx</code>.
        </p>
      </Card>
    </div>
  );
};
