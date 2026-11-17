# RoofPro CRM — Product & Business Brief

**One-page version:** RoofPro CRM is a storm-intelligence roofing CRM for contractors who are done
paying AccuLynx prices for a calendar they can't read. It turns NOAA warnings into prioritized
inspections, runs the lead→cash workflow, and keeps the job's communication history in one place.

Prepared by the product + engineering team. Pairs with
[`BLUEPRINT_COVERAGE.md`](BLUEPRINT_COVERAGE.md) (what is built) and
[`AI_STORM_ARCHITECTURE.md`](AI_STORM_ARCHITECTURE.md) (how the AI works).

---

## 1. Market problem & positioning

AccuLynx dominates roofing/restoration CRM but its user reviews cluster around five failures:
cost creep and add-on pricing, a degraded calendar after redesign, a slow/buggy mobile app,
the removed message board, and a steep learning curve. Those are **retention** problems, not
feature-count problems. A competitor wins by being *predictably priced, fast to learn, and
reliable in the field* — and by owning the one thing AccuLynx does not: **storm intelligence
that tells a contractor who to call next**.

Positioning statement:

> For roofing and restoration contractors with 3–50 crews, RoofPro CRM is the storm-intelligence
> CRM that turns weather events into booked inspections and keeps every job's history searchable.
> Unlike AccuLynx, it includes all core features in one transparent per-user price and works offline
> on a phone.

Differentiation hypotheses (to validate with contractors):

1. **Storm→pipeline automation** is the wedge. NOAA is free and public; the value is prioritization,
   not data.
2. **All-inclusive pricing** removes the #1 complaint; the margin comes from retention, not add-ons.
3. **Job Feed** restores what users lost (claim history + internal comms) as a modern real-time thread.
4. **PWA instead of a native app** gives one codebase, instant updates, installability and offline reads.

---

## 2. Personas & jobs-to-be-done

| Persona | Job to be done | Success signal |
|---|---|---|
| **Owner / GM** | "Know which jobs are profitable and where next month's revenue comes from." | Weekly profitability report reviewed; pipeline coverage ≥ 2× target |
| **Sales rep** | "Turn storm door-knocks into booked inspections without re-typing addresses." | Inspections booked per week; lead→estimate conversion |
| **Project manager** | "Keep crews, materials and change orders from colliding." | On-time phase transitions; margin vs budget |
| **Field crew** | "See today's job, capture photos, mark done — with gloves on." | Photos per job; time-to-mark-complete |
| **Office admin** | "Schedule, invoice, answer the phone without hunting for the thread." | Calendar conflict rate; response time |
| **Dispatcher / storm manager** | "After a hail event, tell me which 20 customers to call first." | Leads contacted within 24 h of event |

Anti-persona: national franchises needing deep ERP/BI customisation — not the first ICP.

## 3. Core workflow (lead → cash)

```
Storm event / web form / phone
  → Lead (scored, assigned, storm-linked)
  → Inspection scheduled on the crew calendar
  → Inspection + photos (mobile)
  → Estimate from price database + aerial measurements
  → Proposal sent (PDF, e-sign)
  → Won → Job (phases: Inspection → Estimate → Production → Invoicing → Completed)
  → Materials ordered · subcontractors assigned · Job Feed updates the customer/staff
  → Invoice + collect (QuickBooks sync) → Profit reported
```

Every transition is an event that can post to the Job Feed automatically — that is the audit trail
AccuLynx users lost when the message board was removed.

## 4. Pricing model (transparent, no per-feature add-ons)

| Plan | Price / user / month | Includes |
|---|---|---|
| **Starter** | $39 | Core CRM, calendar, leads, jobs, estimates, Job Feed, mobile PWA, 5 GB storage, storm tracking |
| **Professional** | $69 | Everything in Starter + AI storm briefs & map copilot, reporting suite, integrations (QuickBooks, Google), API access, 50 GB |
| **Enterprise** | Custom | SSO, audit exports, white-label, dedicated support, unlimited storage, custom data residency |

Principles: annual billing −10%; 14-day full-feature trial; free data export forever; no charge for
features that exist — add-ons only for pass-through costs (aerial measurement credits, SMS). The AI
gateway is included: operators may run it on free tiers or plug their own paid provider key, so AI
cost does not become a surprise line item.

> Pricing is a hypothesis to test; the product does not enforce plans yet beyond `subscriptionTier`
> on the company record. Billing/entitlement enforcement is roadmap (see coverage doc).

## 5. Go-to-market

**Beachhead:** DFW / North Texas hail belt, 5–25 crew roofing companies already on AccuLynx or
spreadsheets. Storm events create urgency windows.

Launch sequence:

1. **Design partners (weeks 1–4):** 3–5 contractors; migrate their last 90 days of jobs; instrument
   time-to-first-inspection and weekly active users.
2. **Storm-triggered outbound:** when NWS issues a severe warning over a metro, run the "free storm
   damage triage" offer — upload your customer list, get a prioritized call sheet in 10 minutes.
3. **Content wedge:** public storm briefs per metro (SEO), "AccuLynx alternative" comparison page,
   pricing-transparency calculator.
4. **Partner channel:** supplement/roofing suppliers and insurance adjusters as referral sources.

Messaging hierarchy: outcome (*book more inspections from the same storms*) → mechanism (*storm
intelligence + all-in-one CRM*) → proof (*X inspections booked per storm event*) → risk reversal
(*free migration, free export, 14-day trial*).

## 6. Success metrics & instrumentation

| KPI | Target | Instrumented by |
|---|---|---|
| Activation: first lead created ≤ 10 min after signup | > 60% | `Lead.createdAt − Company.createdAt` |
| Time to first job created | < 10 min | `Job.createdAt` |
| Storm→lead conversion within 7 days | +10% vs benchmark | `Lead.source = STORM_EVENT`, `stormImpactScore` |
| Job Feed engagement | > 5 posts / job / week | `FeedPost` counts |
| Calendar interaction latency | < 100 ms response | client perf metrics (`web-vitals`) |
| Mobile load (3G, cold) | < 3 s LCP | Lighthouse CI / `metrics.ts` |
| AI feature adoption | > 40% of storm-page sessions generate a brief | `AIUsage.purpose` |
| AI fallback rate | report-only (cost/quality signal) | `AIUsage.fallback` |
| NPS | > 50 | in-app survey (roadmap) |
| Monthly churn | < 2% | subscription ledger (roadmap) |

The AI usage table already records provider, purpose, tokens, latency and fallback per call, so the
AI adoption/fallback metrics work today; activation/churn need analytics events (roadmap).

## 7. Unit economics sketch (per 20-user Professional account)

| Line | Monthly |
|---|---|
| Revenue | 20 × $69 = **$1,380** |
| Infra (API+DB+Redis+storage, small HA) | ~$90–160 |
| AI inference (free-tier / self-hosted) | ~$0–40 |
| Support @ 0.5 h/account | ~$25 |
| Gross margin | **≈ 85%** |

Free-tier AI keeps gross margin stable at low volume; the gateway's provider-swap design means
pricing does not break if free tiers disappear — operators can attach a paid key without a code change.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Free AI tiers change/limit | Provider-agnostic registry, BYO paid endpoint, deterministic fallback |
| NOAA API outage | Cached storm events; briefs degrade to cached context |
| Storm-season ops load | Rate-limited sync, idempotent upserts, Redis queue for background fan-out (roadmap) |
| "Another CRM" objection | Migration tooling + free export + design-partner case studies |
| Data sensitivity (customer photos/PII) | Tenant isolation, JWT scopes, encrypted provider keys, no third-party telemetry |
| Feature breadth vs AccuLynx | Win on storm→inspection + UX speed; win on depth later via supplier/aerial integrations |

## 9. 90-day plan

1. **Weeks 1–2:** launch candidate (this repo), design-partner onboarding, seed demo, fix top 10 UX frictions.
2. **Weeks 3–6:** billing entitlements, email/SMS notifications, QuickBooks sandbox sync, analytics events.
3. **Weeks 7–10:** customer portal (view/approve estimates, upload photos), aerial measurement integration,
   mobile photo annotation offline queue.
4. **Weeks 11–13:** reliability pass (load test storm sync, rate limits, observability dashboards),
   security review, partner API docs, pricing experiment.
