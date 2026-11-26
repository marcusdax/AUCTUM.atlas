# PRODUCT.md — AUCTUM.atlas (Project ATLAS)

> Context record for product strategy, users, workflows, and non-negotiable design commitments.
> Synthesized from *ATLAS Master Blueprint v1.0*, *Project Atlas Value-Driven Architecture & Engagement Strategy*, *AUCTUM.atlas Product Brief*, and the live codebase.

## Product Overview

**AUCTUM.atlas** (Project ATLAS) is an AI-powered storm-intelligence and contractor operating system built for roofing, storm-restoration, and exterior home-improvement contractors. It unifies five previously siloed workflows — **NOAA storm intelligence, property damage & measurement analysis, line-item estimation, job/crew operations with Install QC, and homeowner-facing proof & marketing** — into one calm, verifiable platform.

**Core promise:** *Atlas does not sell software; Atlas sells certainty — and certainty wins contracts.* Turn a live storm event into prioritized inspections, carrier-ready estimates, verified installs, and tamper-evident Job Passports in minutes instead of days.

## Platform

web

- **Primary form factor:** Responsive web application + installable **PWA** (`/manifest.webmanifest`, offline service worker).
- **Two physical contexts:**
  1. **In the truck / on the roof (mobile web):** One-handed, sunlit screens, often with work gloves on, sometimes on 3G or intermittent cellular. Touch targets must be ≥ 44×44 px, primary actions thumb-reachable, and read views resilient offline.
  2. **In the office / dispatch desk (desktop web):** Dense multi-panel triage across live NOAA storm maps, lead/job pipelines, crew calendars, and estimate line-item builders.

## Audience & Jobs-to-Be-Done

### Primary Beachhead (Tier 1): Storm Restoration Contractors ($2M–$20M revenue, 3–50 crews)
- **Situation:** A hail or wind event hits a metro (e.g., DFW, Denver, Oklahoma City). Revenue depends on speed-to-lead within 24–48 hours, replacing a fragmented $3K–$15K/yr stack (HailTrace + EagleView + Xactimate + AccuLynx).
- **Design decision:** Open directly into live storm urgency and prioritized actions — never bury active warnings or affected properties behind generic CRM chrome.

### Core Internal Personas
| Persona | Context | Job to Be Done | Primary Surfaces |
| --- | --- | --- | --- |
| **Owner / GM** | Morning desk review & weekly P&L | Know which jobs are profitable, pipeline coverage, and storm revenue opportunities | Dashboard, Reporting, Jobs |
| **Dispatcher / Storm Manager** | Immediately after NWS alerts | Identify which 20 properties to call first inside a hail/wind swath | Storm Tracking & Map Copilot, Leads |
| **Sales Rep / Estimator** | In a truck or at a homeowner's kitchen table | Turn storm door-knocks into booked inspections and accurate, branded estimates in minutes | Leads, Estimates, Marketing Studio |
| **Project Manager** | Coordinating crews & suppliers | Keep phases (Inspection → Estimate → Production → Invoicing → Completed), QC sign-offs, and Job Feed aligned | Jobs, Job Detail, Calendar, Documents |
| **Field Crew / Operator** | On-site with gloves and bright sun | See today's assignment, capture geo/photo proof, complete phase QC checklists, mark done | Field Hub, Job Detail (QC), Spaces |

### External Personas (Unauthenticated Public Surfaces)
| Persona | Context | Job to Be Done | Primary Surfaces |
| --- | --- | --- | --- |
| **Homeowner (Post-Storm)** | Scans a door-hanger or yard-sign QR code on their phone | Verify the contractor is legitimate and request a free inspection in under 30 seconds | Scan Landing (`/m/:code`) |
| **Homeowner / Adjuster / Buyer** | Opens a shared verification link or prints a record | Inspect photos, materials, QC sign-offs, and cryptographic SHA-256 integrity of completed work | Public Job Passport (`/p/:slug`) |
| **Design Partner / Evaluator** | Reviews the live stack before committing | Understand Fieldwright + AUCTUM.atlas capabilities and launch a live demo in one click | Partner Portal (`/portal`) |

## Core Workflow & Engagement Loops

### Lead-to-Cash Pipeline
`Storm Event / QR Scan / Phone` → `Lead (scored, storm-linked)` → `Inspection Scheduled` → `Site Photos & Measurement` → `Estimate (line items + margin)` → `Proposal Approved` → `Job (Inspection → Estimate → Production → Invoicing → Completed)` → `Install QC & Field Ledger Receipt` → `Public Job Passport (/p/:slug)`.

### The Three Loops
1. **Core Action Loop ("The Inspection Cycle"):** Trigger (NWS alert or door-knock) → Action (drop pin / select property) → Reward (sub-60-second storm brief, risk score, or estimate) → Investment (save lead, publish passport, send proposal).
2. **Certainty-Value Data Flywheel:** Every verified inspection, QC checklist, and storm impact record compounds regional accuracy and creates defensible history.
3. **Social / Trust Loop ("Crew Effect"):** Branded QR print pieces (`/m/:code`) and public Job Passports (`/p/:slug`) turn every job site into verifiable proof and inbound referrals.

## Four-Tier Value Prioritization

- **Tier 1 (Core Value):** Live NOAA storm tracking, deterministic risk scoring, lead triage, roof/job management, line-item estimation, mobile-first PWA shell.
- **Tier 2 (Efficiency Multipliers):** AI Storm Briefs & Map Copilot (FreeLLMAPI-compatible with offline deterministic fallback), Job Feed real-time threads, Marketing Studio QR pieces, CRM/QuickBooks integration.
- **Tier 3 (Strategic Differentiators):** Install QC phase checklists, append-only Field Ledger receipts, tamper-evident Public Job Passports with SHA-256 verification.
- **Tier 4 (Ecosystem Lock-in):** Multi-tenant RBAC, Fieldwright Operator Hub & Vault, partner telemetry, white-label reporting.

## Brand Commitments (Non-Negotiable)

1. **AUCTUM Estate Aesthetic:** Warm archival parchment (`#F1F2EA`), deep forest ink (`#17231D`), oxblood (`#8C2F22`) for critical/extreme alerts, sharp `2px` geometry, and hairline `1px` rules. **Never** revert to neon-on-black sci-fi dashboards or glossy rounded SaaS cards.
2. **Verified, From Origin:** Every status, metric, and verification stamp must reflect real backend or deterministic state — never fabricate notification badges, fake telemetry, or ungrounded AI claims.
3. **AI-Offline Resilience:** Deterministic risk scores, NOAA overlays, and core CRM/QC flows must remain 100% usable when no AI provider key is configured.
4. **Transparent, Predictable UX:** No hidden paywall nags, no cluttered popups, and clear plain-language copy tailored to working contractors and homeowners.
5. **High-Contrast Field Legibility:** Light parchment is the default for outdoor glare readability; ink dark mode (`[data-theme="dark"]`) is opt-in and must maintain WCAG 2.2 AA contrast.

## Domain Terminology

- **Storm Brief:** Prioritized damage and opportunity summary for an active NWS weather event, combining deterministic risk scores with optional AI narrative.
- **Map Copilot:** Natural-language map query bar that compiles user intent into a validated map plan (filters, focus, overlays, highlighted leads).
- **Job Phase:** Strictly ordered five-stage lifecycle: `Inspection` → `Estimate` → `Production` → `Invoicing` → `Completed`.
- **Job Feed:** Real-time per-job communication and audit thread replacing legacy message boards.
- **Install QC:** Phase-gated SOP checklist with required photo evidence, pass/fail scoring, and immutable sign-off receipts.
- **Field Ledger:** Append-only audit log of verified operational milestones and QC receipts.
- **Job Passport (`/p/:slug`):** Frozen, sanitized, opt-in public proof record with SHA-256 content-digest verification and configurable address privacy (`exact`, `street-only`, `hidden`).
- **Scan Piece (`/m/:code`):** Printed yard sign, door hanger, or mailer carrying a tracked QR code that opens a contractor-branded homeowner intake page.

## Constraints & Performance Targets

- **Accessibility:** WCAG 2.2 AA contrast across light and dark themes; full keyboard navigation; `prefers-reduced-motion` respected; semantic landmarks and ARIA live regions for async states.
- **Performance:** Mobile cold load `< 3s` LCP on 3G; calendar/table interactions `< 100ms`; map overlays non-blocking.
- **Privacy:** Public Job Passports render `<meta name="robots" content="noindex">` and strip internal staff PII; unpublishing immediately revokes access.
