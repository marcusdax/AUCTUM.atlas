/**
 * Reporting API Routes — RoofPro CRM
 * Sales pipeline, job profitability, and production efficiency analytics,
 * all scoped to the authenticated company. Supports CSV/PDF export.
 */
import { Router } from 'express';
import { PassThrough } from 'node:stream';
import { AuthRequest } from '../middleware/auth';
import { companyScope } from '../middleware/company';
import { cacheGet, cacheSet } from '../config/redis';
import { prisma } from '../prisma';
import { LeadStatus, JobStatus } from '@prisma/client';

const router = Router();
router.use(companyScope);

// ─── Types ───────────────────────────────────────────────
interface DateRange {
  gte?: Date;
  lte?: Date;
}

interface ExportTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

interface ExportDocument {
  title: string;
  tables: ExportTable[];
}

const REPORT_CACHE_TTL = 90; // seconds

// ─── Metadata ────────────────────────────────────────────
const REPORT_TYPES = [
  {
    type: 'pipeline',
    name: 'Sales Pipeline',
    description:
      'Lead funnel by status with lead count, total deal value, and conversion rates.',
    metrics: ['leads_by_status', 'total_value', 'conversion_rate', 'win_rate'],
  },
  {
    type: 'profitability',
    name: 'Job Profitability',
    description:
      'Per-job profit analysis including budget, actual cost, gross profit, and margin percentage.',
    metrics: ['per_job_profit', 'total_revenue', 'total_cost', 'total_profit', 'avg_margin'],
  },
  {
    type: 'production-efficiency',
    name: 'Production Efficiency',
    description:
      'Completed jobs per period, average phase durations, and crew productivity.',
    metrics: [
      'jobs_completed_per_period',
      'avg_days_to_complete',
      'avg_time_per_phase',
      'crew_productivity',
      'jobs_by_phase',
      'jobs_by_status',
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────
function round(value: number, decimals = 2): number {
  const v = Number(value) || 0;
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

function fmtCurrency(n: number): string {
  const v = Number(n) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(v);
}

/** Build a date range from ?start=&end= query params, validating format. */
function getDateRange(req: AuthRequest): { ok: boolean; value: DateRange; error?: string } {
  const { start, end } = req.query as Record<string, string>;
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;

  if (start && Number.isNaN(s!.getTime())) {
    return { ok: false, value: {}, error: 'Invalid "start" date (use YYYY-MM-DD or ISO 8601).' };
  }
  if (end && Number.isNaN(e!.getTime())) {
    return { ok: false, value: {}, error: 'Invalid "end" date (use YYYY-MM-DD or ISO 8601).' };
  }
  if (s && e && s.getTime() > e.getTime()) {
    return { ok: false, value: {}, error: '"start" must be before or equal to "end".' };
  }

  const value: DateRange = {};
  if (s) value.gte = s;
  if (e) value.lte = e;
  return { ok: true, value };
}

function hasRange(range: DateRange): boolean {
  return Boolean(range.gte || range.lte);
}

function dateFilter(field: string, range: DateRange): Record<string, unknown> {
  if (!hasRange(range)) return {};
  return { [field]: range };
}

/** Month bucket key from a date (YYYY-MM). */
function formatMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Generic result cache keyed by report + company + params. */
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = await cacheGet(key);
  if (hit) {
    try {
      return JSON.parse(hit) as T;
    } catch {
      // fall through and recompute
    }
  }
  const value = await fn();
  await cacheSet(key, value, REPORT_CACHE_TTL);
  return value;
}

// ─── GET / — list available reports ──────────────────────
/**
 * GET /reports
 * List available report types, their metadata, and export options.
 */
router.get('/', async (_req: AuthRequest, res, next) => {
  try {
    res.json({
      reports: REPORT_TYPES,
      export: {
        endpoint: '/api/v1/reports/export',
        formats: ['csv', 'pdf'],
        types: REPORT_TYPES.map((r) => r.type),
        typeQuery: '?type=pipeline|profitability|production-efficiency',
        formatQuery: '&format=csv|pdf',
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /pipeline ───────────────────────────────────────
/**
 * GET /reports/pipeline?start=&end=
 * Sales pipeline stats by lead status: count, total value, conversion rates.
 */
router.get('/pipeline', async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.companyId!;
    const parsed = getDateRange(req);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error, code: 'REPORT_INVALID_DATE_RANGE' });
    }
    const range = parsed.value;
    const cacheKey = `report:pipeline:${companyId}:${JSON.stringify(range)}`;

    const result = await cached(cacheKey, () => computePipeline(companyId, range));
    res.json({
      type: 'pipeline',
      companyId,
      filters: { start: req.query.start ?? null, end: req.query.end ?? null },
      ...result,
      cached: true,
    });
  } catch (err) {
    next(err);
  }
});

async function computePipeline(companyId: string, range: DateRange) {
  const where = { companyId, ...dateFilter('createdAt', range) };

  // Lead count per status (aggregation via groupBy)
  const grouped = await prisma.lead.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
    orderBy: { status: 'asc' },
  });

  // Deal value per status: associated job budget (findMany + in-memory aggregation)
  const leadsWithJobs = await prisma.lead.findMany({
    where,
    select: { status: true, job: { select: { budget: true } } },
  });

  const buckets: Record<string, { count: number; totalValue: number }> = {};
  for (const s of Object.values(LeadStatus)) buckets[s] = { count: 0, totalValue: 0 };

  for (const g of grouped) {
    if (buckets[g.status]) buckets[g.status].count = g._count._all;
  }
  for (const l of leadsWithJobs) {
    const budget = l.job?.budget ?? 0;
    if (buckets[l.status]) buckets[l.status].totalValue += budget;
  }

  const data = Object.values(LeadStatus).map((status) => ({
    status,
    count: buckets[status].count,
    totalValue: round(buckets[status].totalValue, 2),
  }));

  const totalLeads = data.reduce((sum, d) => sum + d.count, 0);
  const totalValue = data.reduce((sum, d) => sum + d.totalValue, 0);
  const wonCount = buckets[LeadStatus.WON].count;
  const lostCount = buckets[LeadStatus.LOST].count;
  const conversionRate = totalLeads > 0 ? round((wonCount / totalLeads) * 100, 2) : 0;
  const winRate = wonCount + lostCount > 0 ? round((wonCount / (wonCount + lostCount)) * 100, 2) : 0;

  return {
    type: 'pipeline',
    data,
    summary: {
      totalLeads,
      totalValue: round(totalValue, 2),
      wonCount,
      lostCount,
      conversionRate,
      winRate,
    },
  };
}

// ─── GET /profitability ──────────────────────────────────
/**
 * GET /reports/profitability?start=&end=
 * Job profit analysis: per-job budget, actual cost, gross profit, margin %.
 */
router.get('/profitability', async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.companyId!;
    const parsed = getDateRange(req);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error, code: 'REPORT_INVALID_DATE_RANGE' });
    }
    const range = parsed.value;
    const cacheKey = `report:profitability:${companyId}:${JSON.stringify(range)}`;

    const result = await cached(cacheKey, () => computeProfitability(companyId, range));
    res.json({
      type: 'profitability',
      companyId,
      filters: { start: req.query.start ?? null, end: req.query.end ?? null },
      ...result,
      cached: true,
    });
  } catch (err) {
    next(err);
  }
});

async function computeProfitability(companyId: string, range: DateRange) {
  const where = { companyId, ...dateFilter('createdAt', range) };

  const jobs = await prisma.job.findMany({
    where,
    select: {
      id: true,
      name: true,
      status: true,
      phase: true,
      budget: true,
      actualCost: true,
      grossProfit: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const data = jobs.map((j) => {
    const budget = j.budget ?? 0;
    const actualCost = j.actualCost ?? 0;
    const grossProfit = j.grossProfit ?? round(budget - actualCost, 2);
    const margin = budget > 0 ? round((grossProfit / budget) * 100, 2) : 0;
    return {
      jobId: j.id,
      jobName: j.name,
      status: j.status,
      phase: j.phase,
      budget: round(budget, 2),
      actualCost: round(actualCost, 2),
      grossProfit: round(grossProfit, 2),
      margin,
    };
  });

  // Company-wide totals via aggregate
  const totals = await prisma.job.aggregate({
    where,
    _count: { _all: true },
    _sum: { budget: true, actualCost: true, grossProfit: true },
    _avg: { grossProfit: true },
  });

  const totalBudget = totals._sum.budget ?? 0;
  const totalActualCost = totals._sum.actualCost ?? 0;
  const totalGrossProfit = totals._sum.grossProfit ?? 0;
  const avgMarginPercent =
    totalBudget > 0 ? round((totalGrossProfit / totalBudget) * 100, 2) : 0;

  return {
    type: 'profitability',
    data,
    summary: {
      totalJobs: totals._count._all,
      totalBudget: round(totalBudget, 2),
      totalActualCost: round(totalActualCost, 2),
      totalGrossProfit: round(totalGrossProfit, 2),
      avgMarginPercent,
    },
  };
}

// ─── GET /production-efficiency ──────────────────────────
/**
 * GET /reports/production-efficiency?start=&end=
 * Jobs completed per period, avg time per phase, crew productivity.
 */
router.get('/production-efficiency', async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.companyId!;
    const parsed = getDateRange(req);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error, code: 'REPORT_INVALID_DATE_RANGE' });
    }
    const range = parsed.value;
    const cacheKey = `report:production-efficiency:${companyId}:${JSON.stringify(range)}`;

    const result = await cached(cacheKey, () => computeProductionEfficiency(companyId, range));
    res.json({
      type: 'production-efficiency',
      companyId,
      filters: { start: req.query.start ?? null, end: req.query.end ?? null },
      ...result,
      cached: true,
    });
  } catch (err) {
    next(err);
  }
});

async function computeProductionEfficiency(companyId: string, range: DateRange) {
  // Completed jobs (optionally within date range on endDate)
  const completedWhere = {
    companyId,
    status: JobStatus.COMPLETED,
    ...dateFilter('endDate', range),
  };

  const completed = await prisma.job.findMany({
    where: completedWhere,
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      phase: true,
    },
    orderBy: { endDate: 'desc' },
  });

  // Jobs completed per period (month bucket derived in-memory; groupBy cannot truncate dates)
  const jobsCompletedPerPeriodMap: Record<string, number> = {};
  const durations: number[] = [];
  for (const j of completed) {
    const end = j.endDate ? new Date(j.endDate) : null;
    const start = j.startDate ? new Date(j.startDate) : j.createdAt ? new Date(j.createdAt) : null;
    if (end) {
      const key = formatMonth(end);
      jobsCompletedPerPeriodMap[key] = (jobsCompletedPerPeriodMap[key] || 0) + 1;
    }
    if (end && start && end.getTime() >= start.getTime()) {
      durations.push((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
  }
  const jobsCompletedPerPeriod = Object.entries(jobsCompletedPerPeriodMap)
    .map(([period, completed]) => ({ period, completed }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const avgDaysToComplete = durations.length
    ? round(durations.reduce((sum, d) => sum + d, 0) / durations.length, 2)
    : 0;

  // Average time per phase — proxied by scheduled CalendarEvent durations per event type
  const events = await prisma.calendarEvent.findMany({
    where: { companyId, ...dateFilter('startTime', range) },
    select: { eventType: true, startTime: true, endTime: true },
  });
  const phaseDurations: Record<string, number[]> = {};
  for (const e of events) {
    const s = new Date(e.startTime);
    const en = new Date(e.endTime);
    const hours = (en.getTime() - s.getTime()) / (1000 * 60 * 60);
    if (!Number.isNaN(hours) && hours >= 0) {
      (phaseDurations[e.eventType] = phaseDurations[e.eventType] || []).push(hours);
    }
  }
  const avgTimePerPhase = Object.entries(phaseDurations)
    .map(([phase, arr]) => ({
      phase,
      avgDurationHours: round(arr.reduce((sum, h) => sum + h, 0) / arr.length, 2),
      eventCount: arr.length,
    }))
    .sort((a, b) => b.avgDurationHours - a.avgDurationHours);

  // Crew productivity — jobs per assigned worker on completed jobs
  const completedIds = completed.map((j) => j.id);
  const assignees = completedIds.length
    ? await prisma.jobAssignee.findMany({
        where: { jobId: { in: completedIds } },
        select: { userId: true, role: true, jobId: true },
      })
    : [];

  const jobsPerUser = new Map<string, Set<string>>();
  const roleWorkerSets: Record<string, Set<string>> = {};
  for (const a of assignees) {
    const set = jobsPerUser.get(a.userId) || new Set();
    set.add(a.jobId);
    jobsPerUser.set(a.userId, set);
    if (!roleWorkerSets[a.role]) roleWorkerSets[a.role] = new Set();
    roleWorkerSets[a.role].add(a.userId);
  }
  const jobsPerWorker = Array.from(jobsPerUser.values()).map((s) => s.size);
  const uniqueWorkers = jobsPerWorker.length;
  const avgJobsPerWorker = uniqueWorkers
    ? round(jobsPerWorker.reduce((sum, n) => sum + n, 0) / uniqueWorkers, 2)
    : 0;
  const workersByRole = Object.fromEntries(
    Object.entries(roleWorkerSets).map(([role, set]) => [role, set.size])
  );

  // Distributions via groupBy (aggregation)
  const jobsByPhase = await prisma.job.groupBy({
    by: ['phase'],
    where: { companyId, ...dateFilter('createdAt', range) },
    _count: { _all: true },
    orderBy: { phase: 'asc' },
  });

  const jobsByStatus = await prisma.job.groupBy({
    by: ['status'],
    where: { companyId, ...dateFilter('createdAt', range) },
    _count: { _all: true },
    orderBy: { status: 'asc' },
  });

  return {
    type: 'production-efficiency',
    jobsCompletedPerPeriod,
    avgDaysToComplete,
    avgTimePerPhase,
    crewProductivity: {
      totalCompletedJobs: completed.length,
      totalAssignments: assignees.length,
      uniqueWorkers,
      avgJobsPerWorker,
      workersByRole,
    },
    jobsByPhase: jobsByPhase.map((b) => ({ phase: b.phase, count: b._count._all })),
    jobsByStatus: jobsByStatus.map((b) => ({ status: b.status, count: b._count._all })),
  };
}

// ─── GET /export ─────────────────────────────────────────
/**
 * GET /reports/export?type=pipeline|profitability|production-efficiency&format=csv|pdf
 * Export a report's data in CSV or PDF format.
 */
router.get('/export', async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.companyId!;
    const { type, format } = req.query as Record<string, string>;

    if (!type || !REPORT_TYPES.some((r) => r.type === type)) {
      return res.status(400).json({
        error: `Invalid or missing "type". Allowed: ${REPORT_TYPES.map((r) => r.type).join(', ')}`,
        code: 'REPORT_INVALID_TYPE',
      });
    }
    if (!format || !['csv', 'pdf'].includes(format)) {
      return res.status(400).json({
        error: 'Invalid or missing "format". Allowed: csv, pdf',
        code: 'REPORT_INVALID_FORMAT',
      });
    }

    const parsed = getDateRange(req);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error, code: 'REPORT_INVALID_DATE_RANGE' });
    }
    const range = parsed.value;

    let report;
    if (type === 'pipeline') report = await computePipeline(companyId, range);
    else if (type === 'profitability') report = await computeProfitability(companyId, range);
    else report = await computeProductionEfficiency(companyId, range);

    const doc = buildExportDocument(type, report);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `roofpro-${type}-${timestamp}`;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(toCsv(doc));
    }

    // PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    const buffer = await toPdfBuffer(doc);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// ─── Export formatting (pure helpers) ────────────────────
function getReportFields(type: string, report: any): ExportTable[] {
  if (type === 'pipeline') {
    const headers = ['Lead Status', 'Count', 'Total Value'];
    const rows: (string | number)[][] = report.data.map((d: any) => [
      d.status,
      d.count,
      fmtCurrency(d.totalValue),
    ]);
    const s = report.summary;
    rows.push(['TOTAL', s.totalLeads, fmtCurrency(s.totalValue)]);
    rows.push([
      'Conversion Rate',
      `${s.conversionRate}%`,
      `Win Rate: ${s.winRate}%`,
    ]);
    return [{ title: 'Leads by Status', headers, rows }];
  }

  if (type === 'profitability') {
    const headers = ['Job', 'Status', 'Budget', 'Actual Cost', 'Gross Profit', 'Margin %'];
    const rows: (string | number)[][] = report.data.map((d: any) => [
      d.jobName,
      d.status,
      fmtCurrency(d.budget),
      fmtCurrency(d.actualCost),
      fmtCurrency(d.grossProfit),
      `${d.margin}%`,
    ]);
    const s = report.summary;
    rows.push([
      'ALL JOBS',
      '',
      fmtCurrency(s.totalBudget),
      fmtCurrency(s.totalActualCost),
      fmtCurrency(s.totalGrossProfit),
      `${s.avgMarginPercent}%`,
    ]);
    return [{ title: 'Per-Job Profit', headers, rows }];
  }

  // production-efficiency
  const tables: ExportTable[] = [];
  tables.push({
    title: 'Jobs Completed Per Period',
    headers: ['Period', 'Jobs Completed'],
    rows: report.jobsCompletedPerPeriod.map((p: any) => [p.period, p.completed]),
  });
  tables.push({
    title: 'Average Time Per Phase (hours)',
    headers: ['Phase', 'Avg Duration', 'Events'],
    rows: report.avgTimePerPhase.map((p: any) => [
      p.phase,
      p.avgDurationHours,
      p.eventCount,
    ]),
  });
  tables.push({
    title: 'Crew Productivity',
    headers: ['Metric', 'Value'],
    rows: [
      ['Total Completed Jobs', report.crewProductivity.totalCompletedJobs],
      ['Total Assignments', report.crewProductivity.totalAssignments],
      ['Unique Workers', report.crewProductivity.uniqueWorkers],
      ['Avg Jobs Per Worker', report.crewProductivity.avgJobsPerWorker],
      ['Avg Days To Complete', report.avgDaysToComplete],
    ],
  });
  if (report.jobsByPhase?.length) {
    tables.push({
      title: 'Jobs by Phase',
      headers: ['Phase', 'Count'],
      rows: report.jobsByPhase.map((b: any) => [b.phase, b.count]),
    });
  }
  tables.push({
    title: 'Jobs by Status',
    headers: ['Status', 'Count'],
    rows: report.jobsByStatus.map((b: any) => [b.status, b.count]),
  });
  return tables;
}

function buildExportDocument(type: string, report: any): ExportDocument {
  return {
    title: REPORT_TYPES.find((r) => r.type === type)?.name ?? type,
    tables: getReportFields(type, report),
  };
}

function csvEscape(value: string | number): string {
  const v = String(value ?? '');
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function toCsv(doc: ExportDocument): string {
  const lines: string[] = [`"${doc.title}"`];
  for (const table of doc.tables) {
    lines.push('');
    lines.push(`"${table.title}"`);
    lines.push(table.headers.map(csvEscape).join(','));
    for (const row of table.rows) {
      lines.push(row.map(csvEscape).join(','));
    }
  }
  return lines.join('\r\n');
}

/** Render an ExportDocument to a PDF Buffer (exercises pdfkit end-to-end). */
async function toPdfBuffer(report: ExportDocument): Promise<Buffer> {
  const mod = await import('pdfkit');
  const PDFDocument = (mod as { default: any }).default;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36 });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    doc.pipe(stream);
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    try {
      renderPdf(doc, report);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function renderPdf(doc: any, report: ExportDocument): void {
  const margin = 36;
  const pageWidth = doc.page.width;
  const bottomMargin = 50;

  doc.fontSize(20).text(report.title);
  doc.fontSize(9).fillColor('#6b7280').text(`Generated: ${new Date().toISOString()}`, { align: 'right' });
  doc.moveDown(0.8);

  for (const table of report.tables) {
    // section heading
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#111827').text(table.title);
    doc.moveDown(0.25);

    const colCount = table.headers.length;
    const colWidth = (pageWidth - margin * 2) / colCount;
    const headerHeight = 20;
    const rowHeight = 18;

    // Move to a new page if the header won't fit
    if (doc.y + headerHeight > doc.page.height - bottomMargin) {
      doc.addPage();
    }

    doc.save();
    doc
      .rect(margin, doc.y, colWidth * colCount, headerHeight)
      .fill('#e5e7eb');
    doc.restore();

    doc.fill('#111827');
    table.headers.forEach((h, i) => {
      doc.text(String(h), margin + i * colWidth + 4, doc.y + 6, {
        width: colWidth - 8,
        height: headerHeight - 8,
        ellipsis: true,
      });
    });
    doc.y += headerHeight;

    for (const row of table.rows) {
      if (doc.y + rowHeight > doc.page.height - bottomMargin) {
        doc.addPage();
      }
      doc.save();
      doc
        .rect(margin, doc.y, colWidth * colCount, rowHeight)
        .fill('#f9fafb');
      doc.restore();
      doc.fill('#111827');
      row.forEach((cell, i) => {
        doc.text(String(cell ?? ''), margin + i * colWidth + 4, doc.y + 5, {
          width: colWidth - 8,
          height: rowHeight - 8,
          ellipsis: true,
        });
      });
      doc.y += rowHeight;
    }

    doc.font('Helvetica').fillColor('#000000');
    doc.moveDown(0.6);
  }
}

// Make pure helpers available for testing / programmatic use
export {
  computePipeline,
  computeProfitability,
  computeProductionEfficiency,
  buildExportDocument,
  toCsv,
  renderPdf,
  toPdfBuffer,
};

export default router;
