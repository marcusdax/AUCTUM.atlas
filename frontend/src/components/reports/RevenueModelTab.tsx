import React, { useMemo, useState } from 'react';
import Card, { Badge } from '../ui/Card';
import Button from '../ui/Button';
import { Download } from 'lucide-react';

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
  n < 0
    ? `-$${Math.abs(Math.round(n)).toLocaleString()}`
    : `$${Math.round(n).toLocaleString()}`;

export const RevenueModelTab: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId | 'ALL'>('Base');
  const [selectedLever, setSelectedLever] = useState<string>('ALL');

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
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'auctum_36m_pnl_scenarios_summary.csv';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const baseBlended = SCENARIO_ROWS.find(
    (r) => r.scenario === 'Base' && r.model === 'Blended_Flywheel'
  )!;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-text-tertiary uppercase">Base Blended M36 ARR</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{fmtUsd(baseBlended.m36ArrUsd)}</p>
          <p className="text-xs text-text-secondary">
            {fmtUsd(baseBlended.total36mRevenueUsd)} 36M cumulative revenue
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-tertiary uppercase">Base 36M EBITDA</p>
          <p className="mt-1 text-2xl font-bold text-emerald">{fmtUsd(baseBlended.cumulativeEbitdaUsd)}</p>
          <p className="text-xs text-text-secondary">
            Blended GM {baseBlended.blendedGmPct.toFixed(1)}% · Peak draw {fmtUsd(baseBlended.peakCashDrawUsd)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-tertiary uppercase">Breakeven Timing</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{baseBlended.breakevenMonth}</p>
          <p className="text-xs text-text-secondary">Storm-Surge compresses breakeven to M12</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-tertiary uppercase">EDA Audit Coverage</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">432 / 60</p>
          <p className="text-xs text-text-secondary">Monthly P&amp;L / sensitivity rows · 0 missing</p>
        </Card>
      </div>

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

      <Card
        title="One-At-a-Time Sensitivity Analysis (Base Blended Flywheel Baseline: +$862,087 EBITDA / M16)"
      >
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
          Methodology grounded in Certificate Transparency (RFC 6962), DePIN Tokenomics
          (Frontiers in Blockchain 2025, 10.3389/fbloc.2025.1644115), Proof-of-Location
          (Scientific Reports 2025, 10.1038/s41598-025-04566-4), and Scientific Agent Skills
          (Kassis et al., arXiv:2609.00065). Full 432-row monthly model and Excel workbook live in{' '}
          <code>docs/financial/auctum_36m_revenue_model.xlsx</code>.
        </p>
      </Card>
    </div>
  );
};
