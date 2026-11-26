# AccuLynx competitor blueprint — coverage matrix

Status of the **RoofPro CRM** blueprint as of v1.1 (launch candidate). Legend:

- ✅ **Shipped** — implemented and reachable in the running product.
- 🟡 **Partial** — core works; a named gap remains (see note).
- ⬜ **Roadmap** — planned, not implemented.
- 📄 **Doc/strategy only** — written down, no enforcement in code.

Every status refers to code in this repository; no unverifiable claims.

---

## 1. Pain points → solutions

| AccuLynx pain point | RoofPro solution | Status | Where |
|---|---|---|---|
| High/rising cost, per-feature add-ons | Flat per-user pricing, all core features included, free data export | 📄 | `docs/PRODUCT_BRIEF.md` §4; `Company.subscriptionTier` only |
| Calendar UI degraded after redesign | Day/week/month + resource lanes, drag-reschedule, conflict detection, filters, color+label encoding | ✅ (conflict + assignee APIs; UI keyboard paths) | `frontend/src/pages/Calendar.tsx`, `backend/src/routes/calendar.routes.ts` |
| Mobile app slow/buggy | PWA: installable, offline shell, responsive layouts, 44px touch targets | ✅ | `frontend/public/{manifest.webmanifest,sw.js,offline.html}`, `frontend/src/pwa/*` |
| Message board removed | **Job Feed** — threaded real-time posts, mentions, attachments, system audit posts | ✅ | `frontend/src/pages/JobFeed.tsx`, `backend/src/routes/feed.routes.ts`, `FeedPost` model |
| Steep learning curve | Role-based onboarding tour, Quick Start row, contextual empty states | ✅ | `frontend/src/components/onboarding/*`, `frontend/src/pages/Dashboard.tsx` |

## 2. Core feature set (blueprint §3)

### 3.1 Lead & opportunity management

| Requirement | Status | Notes |
|---|---|---|
| Capture from web/phone/manual | ✅ | `Lead.source` enum (`WEBSITE/PHONE/REFERRAL/STORM_EVENT/MANUAL/IMPORT`), lead form |
| Lead scoring from storm proximity + property data | ✅ | `Lead.stormImpactScore` + `/storm-intel/impact` + `/ai/lead-insights` (points/decay, not parcel data) |
| Pipeline stages New→Won/Lost | ✅ | `/leads/pipeline`, kanban UI, status enum |
| Assignment / round-robin routing | 🟡 | Assignment shipped (`assignedToUserId`); round-robin auto-routing roadmap |

### 3.2 Job & project management

| Requirement | Status | Notes |
|---|---|---|
| Job from lead or directly | ✅ | `/jobs`, convert flow, `Lead.jobId` |
| Phases Inspection→Completed | ✅ | `JobPhase` enum, job detail |
| Materials, work orders, subcontractors | 🟡 | Materials + subcontractors + assignments shipped; formal "work order" document type not a first-class entity |
| Change orders & supplements | ✅ | `ChangeOrder` model + routes |
| Profit tracking per job | ✅ | budget/estimated/actual/grossProfit + profitability report |

### 3.3 Estimating & proposals

| Requirement | Status | Notes |
|---|---|---|
| Line-item builder + price database | ✅ | `EstimateItem`, `PriceDatabaseEntry`, `/materials/price-database` |
| Aerial measurement integration | 🟡 | Provider registry (HOVER/EAGLEVIEW) + credential-based service; no live vendor API credentials shipped |
| Branded PDF proposals | ✅ | `EstimatePdfService` + `POST /estimates/:id/pdf`, `/uploads` serving |
| Digital signature | ⬜ | Approve/reject audit exists; e-sign provider not integrated |
| Cost/margin analysis | ✅ | totalCost/totalPrice + reports |

### 3.4 Scheduling & calendar

| Requirement | Status | Notes |
|---|---|---|
| Multi-resource calendar | ✅ | `CalendarEventAssignee`, `/calendar/users`, assignee chips |
| Drag-and-drop scheduling | ✅ | Calendar page drag/resize → PATCH `/calendar/:id` |
| Recurring appointments + reminders | 🟡 | `EventReminder` + reminder UI; recurrence rule engine roadmap |
| Availability heatmap | 🟡 | `/calendar/availability` busy slots shipped; heatmap visualisation roadmap |
| Search/filter by job type/status/assignee | ✅ | Calendar filters (client) + query params |
| Conflict detection | ✅ | `detectConflicts()` server-side, 409 with conflict list |

### 3.5 Communication & collaboration

| Requirement | Status | Notes |
|---|---|---|
| Job Feed threads/mentions/attachments/system posts | ✅ | Feed routes + Socket.IO + `isSystem` posts |
| Email/SMS/push notifications | 🟡 | In-app + WebSocket shipped (`Notification`); SMTP/Twilio/web-push transport not configured |
| Customer portal | ⬜ | Estimates are PDFs; portal is roadmap |

### 3.6 Photo & document management

| Requirement | Status | Notes |
|---|---|---|
| Mobile photo capture + job tagging | ✅ | `POST /documents` multipart, document types, job link (camera input on mobile) |
| Annotations | 🟡 | `Document.metadata` + annotation editor in documents page; server-side render not implemented |
| Storage, versioning, audit | 🟡 | Upload + company/job scoping + audit via feed; S3 and object versioning roadmap |

### 3.7 Reporting & analytics

| Requirement | Status | Notes |
|---|---|---|
| Sales pipeline dashboard | ✅ | `/reports/pipeline` + Reporting page |
| Job profitability reports | ✅ | `/reports/profitability` |
| Production efficiency | ✅ | `/reports/production-efficiency` |
| Custom report builder | ⬜ | Fixed report catalogue + CSV/PDF export now |
| Export CSV/PDF | ✅ | `/reports/export?format=csv\|pdf` |

### 3.8 Integrations

| Requirement | Status | Notes |
|---|---|---|
| QuickBooks Online/Desktop | 🟡 | `IntegrationService` with real API calls using stored tokens; OAuth app + token refresh roadmap |
| Google Calendar / Outlook | 🟡 | Same credential-based service; no OAuth consent flow shipped |
| Zapier / webhooks | 🟡 | WEBHOOK integration type + generic dispatch; no Zapier app/directory listing |
| Aerial measurement APIs | 🟡 | Provider hooks only; no vendor keys |
| Supplier catalogues (ABC Supply…) | ⬜ | Material orders are manual |

## 3. Storm tracking & AI (the differentiator — v1.1)

| Requirement | Status | Where |
|---|---|---|
| Live NOAA alerts, radar, storm reports, forecast | ✅ | `NOAAWeatherService`, `/storms/*`, `/weather/*`, `/maps/*` |
| Alert → storm-event clustering + persistence | ✅ | `services/storm/clustering.ts`, `StormEvent.externalId/geometry` |
| Deterministic impact scoring for leads/jobs/points | ✅ | `/storm-intel/impact`, `/storm-intel/rescore-leads`, `Lead.stormImpactScore` |
| AI Storm Brief (damage + opportunity + actions) | ✅ | `POST /ai/storm-brief`, `StormBriefCard` |
| AI Map Copilot (validated NL → map plan) | ✅ | `POST /ai/map-copilot`, `MapCopilot` |
| AI lead explanation / next best action | ✅ | `POST /ai/lead-insights`, `LeadImpactCard` |
| FreeLLMAPI-compatible multi-provider routing | ✅ | `backend/src/llm/*` (registry, router, fallback, cooldowns, metering) |
| Encrypted provider keys + admin UI | ✅ | AES-256-GCM `AIProvider.apiKeyCipher`, `/settings/ai` |
| Works with zero AI keys (offline engine) | ✅ | `llm/localFallback` + `services/ai/pure.ts` → `source:"heuristic"` |
| External FreeLLMAPI gateway support | ✅ | `AI_FREELMAPI_URL` + `freellmapi` provider, `docs/FREELLMAPI_INTEGRATION.md` |

## 4. Architecture blueprint (§5–§6)

| Requirement | Status | Notes |
|---|---|---|
| Modular monolith with bounded contexts | ✅ | routes/services split; AI + storm isolated modules |
| REST `/api/v1` | ✅ | 19 route groups |
| JWT access + refresh (Redis-backed) | ✅ | `authMiddleware`, `/auth/refresh`, token blacklist |
| Idempotency keys for financial POST/PUT | ⬜ | Not implemented (estimate creation could double-submit) |
| WebSocket real-time | ✅ | Socket.IO + Redis adapter, job rooms, user rooms |
| PostgreSQL + JSONB + indexes | ✅ | Prisma schema; JSON settings/metadata/geometry; leads/jobs/posts/indexes |
| Full-text search (tsvector) | 🟡 | `search` filters use `contains` (case-insensitive) — no tsvector index yet |
| Redis cache/queues/pub-sub | 🟡 | Cache + pub/sub shipped; BullMQ background jobs not used (in-process work only) |
| S3-compatible file storage | 🟡 | Local disk mounted volume; S3 abstraction roadmap |
| OpenAPI 3.0 docs | ⬜ | Route metadata at `/api/v1/` only |
| Rate limiting, Helmet, CORS | ✅ | express-rate-limit + helmet + origin allow-list |

## 5. Frontend design system (§7)

| Requirement | Status | Notes |
|---|---|---|
| WCAG-minded palette + number/text severity (not color only) | ✅ | design tokens + Storm Brief/Impact cards + badges |
| Typography/fluid scale, dark+light mode | ✅ | tailwind tokens, theme toggle |
| Calendar UX improvements (search, filters, conflict indicators) | ✅ | Calendar page |
| Guided onboarding + contextual help + Quick Start | ✅ | v1.1 onboarding tour + dashboard Quick Start |
| Mobile-first PWA, offline shell, install prompt | 🟡 | Shell + banner + install prompt shipped; **offline writes / background sync** roadmap |
| Performance budgets / code splitting | ✅ | route lazy-loading, vendor/maps/ui manual chunks, `web-vitals` metrics |

## 6. Testing & QA blueprint (§12)

| Requirement | Status | Notes |
|---|---|---|
| Backend unit/integration tests | ✅ | Node test runner: crypto, router failover, rate limits, gateway, copilot validation, brief determinism, geo/impact/clustering |
| Frontend component/unit tests | ✅ | Vitest: AI panels/utils, PWA, onboarding, storm-map helpers, existing suites |
| E2E (Cypress/Playwright) | ⬜ | Not shipped; `scripts/ui-shots.mjs` + `scripts/smoke.ps1` cover manual/deploy verification |
| Performance/load tests (k6) | ⬜ | Roadmap |
| Accessibility automated audit (axe) | 🟡 | `jest-axe` + Storybook a11y addon configured; CI gate roadmap |

## 7. Deployment blueprint (§13)

| Requirement | Status | Notes |
|---|---|---|
| Docker / Compose, health checks, volumes | ✅ | `docker-compose.yml`, portal compose, launcher |
| CI/CD (GitHub Actions) | ✅ | `.github/workflows/ci.yml`: backend typecheck + tests, frontend typecheck + tests + build, Docker image builds |
| Managed DB + backups + PITR | 🟡 | Runbook covers pg_dump/restore; managed service is a deployment choice |
| Monitoring (Prometheus/Grafana/Sentry) | 🟡 | Winston JSON logs + health endpoints; no dashboards/Sentry wiring |
| Feature flags | ⬜ | `AISetting.features` storage exists; no flag evaluation service |

## 8. Blueprint roadmap phases

| Phase (blueprint) | Blueprint scope | Actual status |
|---|---|---|
| Phase 1 MVP | auth, leads, jobs, calendar, estimates, responsive web, email notifications | ✅ except email transport |
| Phase 2 Core | multi-resource calendar + DnD, Job Feed realtime, photos/docs, reporting, QuickBooks/Google | ✅ except real OAuth apps (credential-based instead) |
| Phase 3 Advanced | aerial measurement, materials, subcontractors, custom reports, push, advanced permissions | 🟡 materials/subcontractors shipped; aerial/custom reports/push/permissions roadmap |
| Phase 4 Scale | load testing, a11y audit, tenant isolation hardening, customer portal, API docs | 🟡 tenant isolation via `companyId` scoping is consistent; rest roadmap |
| **v1.1 addition** | FreeLLMAPI-compatible AI gateway + storm/map intelligence + PWA + onboarding | ✅ this release |

## 9. Deliberate deviations from the blueprint

1. **No separate microservice for Job Feed / notifications.** The blueprint drew them as services; the
   modular monolith keeps them as bounded modules with WebSocket events, extractable later. Fewer moving
   parts at this scale, same contracts.
2. **AI provider config is instance-global, not per-tenant.** A single operator manages keys (matching
   FreeLLMAPI's single-user model); per-company BYO-key is roadmap.
3. **FreeLLMAPI is embedded rather than vendored.** We reuse the architecture and provider catalogue;
   their dashboard/desktop app is out of scope. Optional external gateway is supported.
4. **Images remain illustrative/storybook assets from the baseline.** No new stock imagery was added.
5. **Pricing is documented, not enforced.** Billing/entitlements were explicitly deferred (see limits).

## 10. Sprint 10 additions — Install QC + Job Passport

| Requirement | Status | Notes |
|---|---|---|
| Phase SOP checklists with required items and photo evidence | ✅ | `JobQcRun` + templates in `backend/src/services/passport`; pass/fail scoring |
| Immutable QC sign-off receipts | ✅ | `FieldLedgerEntry` append-only rows with deterministic idempotency keys |
| Public verified job record | ✅ | `JobPassport` + `/p/:slug`, frozen snapshot, SHA-256 content digest |
| Independent verification | ✅ | `GET /api/v1/public/passport/:slug/verify` recomputes the digest |
| Privacy controls | ✅ | `EXACT` / `STREET_ONLY` / `HIDDEN`; address, photos and company contact only |
| QR share + print | ✅ | Client-side QR on the passport panel; print styles on the public page |
| Custom per-company QC templates | ⬜ | Templates fixed in code this sprint; company-defined SOPs are the follow-up |
| Third-party attestation on the passport | 🟡 | Field Hub provenance can anchor to Rekor; the passport itself is self-verified by digest |

## 11. Verification checklist for this release

```powershell
cd backend;  npx tsc --noEmit; npm test
cd ..\frontend; npx tsc --noEmit; npx vitest run; npm run build:dev
cd ..; npm run smoke          # after `npm run launch`
node scripts/ui-shots.mjs     # optional screenshots into runs/shots
```

**Executed results** (96 backend tests, 175 frontend tests, 23/23 smoke checks, screenshots) and the
defects fixed during verification are recorded in [`RELEASE_VERIFICATION.md`](RELEASE_VERIFICATION.md).
Evidence for the release is also listed in [`CHANGELOG.md`](CHANGELOG.md) and the runbook's
"Verification" section.
