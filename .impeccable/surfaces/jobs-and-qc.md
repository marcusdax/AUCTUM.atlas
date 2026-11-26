---
surface: jobs-and-qc
mode: Operate
routes:
  - /jobs
  - /jobs/new
  - /jobs/:id
  - /jobs/:id/edit
  - /jobs/:id/feed/*
files:
  - frontend/src/pages/Jobs.tsx
  - frontend/src/pages/JobDetail.tsx
  - frontend/src/components/JobFeed.tsx
  - frontend/src/components/passport/QcPanel.tsx
  - frontend/src/components/passport/PassportPanel.tsx
---

# Surface Brief: Jobs, Job Detail & Install QC

## Mode
**Operate** — End-to-end production tracking, phase progression, Install QC checklists, Job Feed collaboration, and Job Passport publishing.

## Purpose & User Goals
- **Project Manager:** Scan all active jobs by phase (`Inspection → Estimate → Production → Invoicing → Completed`), monitor gross margin, and unblock stalled jobs.
- **Field Crew (mobile):** Open today's job, complete phase QC items with photo evidence, and post to the Job Feed with gloved hands.
- **Office Admin:** Publish or revoke a Job Passport and verify append-only Field Ledger receipts.

## Design Direction & Rules
- Keep phase progression and job status immediately scannable at the top of every Job card and Job Detail header.
- Financial figures (budget, actual cost, gross profit, margin %) use `.stat-mono` (`tabular-nums`) with semantic margin color thresholds (`≥ 20%` verified emerald, `0–19%` review amber, `< 0%` oxblood red).
- Interactive job cards use hairline border + elevated parchment wash on hover — no `hover:scale` jitter.
- Job Detail tabs (Overview, Estimates, Calendar, Documents, Job Feed, QC & Passport) must scroll cleanly on mobile viewports without clipping or cramped labels.

## Guardrails
- Preserve real-time Socket.IO invalidation for Job Feed and Job status updates.
- Never allow ambiguous QC sign-offs; required items and photo proof states must remain unmistakable.
