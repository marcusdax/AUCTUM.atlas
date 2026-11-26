---
surface: estimates-and-leads
mode: Operate
routes:
  - /leads
  - /leads/new
  - /leads/:id
  - /estimates
  - /estimates/:jobId/new
  - /estimates/:id
files:
  - frontend/src/pages/Leads.tsx
  - frontend/src/pages/LeadForm.tsx
  - frontend/src/pages/leads/LeadDetail.tsx
  - frontend/src/pages/estimates/EstimateBuilder.tsx
---

# Surface Brief: Estimates & Lead Intake

## Mode
**Operate** — Rapid storm-lead qualification, line-item estimate assembly, margin verification, and proposal delivery.

## Purpose & User Goals
- **Sales Rep / Estimator:** Capture a storm lead in seconds, build an accurate line-item estimate from the price database, verify profit margin, and generate/send a branded PDF proposal.
- **Dispatcher:** Filter leads by storm impact score, status, and source (Storm Event, QR Scan, Web, Referral) to prioritize callbacks.

## Design Direction & Rules
- Line-item tables and numeric inputs (quantity, unit cost, unit price, line total, subtotal, tax, margin) must align cleanly with `font-mono tabular-nums`.
- Keep the primary workflow action ("Save", "Generate PDF", "Send Estimate", "Convert to Job") visually distinct (`Button variant="primary"`) and reachable without scrolling past long line-item lists on mobile.
- Price database lookup and status filters should feel instantaneous with crisp hairline borders and clear empty/loading states.
- Preserve real-time Socket.IO sync on estimates so collaborative edits stay fresh.

## Guardrails
- Never truncate currency values or hide margin warnings when cost exceeds price.
- Form labels follow `.auctum-form` uppercase mono conventions with clear validation feedback.
