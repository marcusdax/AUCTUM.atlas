# RoofPro CRM

**Storm-intelligence roofing CRM — the AccuLynx alternative that fixes what contractors complain about.**

RoofPro CRM turns live NOAA storm data into booked inspections, sends branded estimates, runs the crew calendar,
and keeps every job's history in a real-time Job Feed. This release adds an embedded
**FreeLLMAPI-compatible AI gateway** that powers storm briefs and a natural-language map copilot — with a
deterministic offline engine so the product still works with zero AI keys.

> Status: **v1.1 — launch candidate.** Runs locally in one command. See [`docs/BLUEPRINT_COVERAGE.md`](docs/BLUEPRINT_COVERAGE.md)
> for exactly what is implemented versus roadmap, and [`docs/LIMITS.md`](docs/LIMITS.md) for honest limits.

---

## Quick start (one command)

**Requirements:** Docker Desktop (with Compose v2) and PowerShell 7. Node.js 20+ is only needed for host-side
development commands.

```powershell
# Windows: double-click START.bat, or:
pwsh -File scripts\launch.ps1
```

The launcher will:

1. generate `backend/.env` with real random JWT + AI-encryption secrets,
2. build and start PostgreSQL, Redis, the API and the web app,
3. wait for health, and
4. seed a demo workspace (skip with `-NoSeed`).

Then open **http://localhost:3000**

| | |
|---|---|
| Demo sign-in | `demo@roofprocrm.com` / `RoofPro!2026` |
| Create account | http://localhost:3000/register |
| API health | http://localhost:5000/api/v1/health |
| AI gateway status | http://localhost:5000/api/v1/ai/status |
| AI provider settings | http://localhost:3000/settings/ai |

Verify the whole stack after launching:

```powershell
npm run smoke        # writes runs/smoke-<timestamp>.json
npm run stack:logs   # tail container logs
npm run stop         # stop (data preserved); -Volumes to wipe
npm run seed:demo    # re-seed demo data (host-side)
```

### Development mode

```powershell
# API on :5000 (host, against the docker Postgres/Redis)
cd backend
npx prisma generate
npx tsx src/server.ts

# Web on :3000 with proxy to the API
cd frontend
npm run dev
```

---

## What's inside

### Storm tracking & map intelligence (the reason this platform exists)

- **Live NOAA/NWS integration** — active alerts, polygons, radar stations, storm reports, forecasts.
- **Storm intelligence engine** — alerts are clustered into de-duplicated storm events, severity-mapped and
  stored with geometry; leads and jobs are scored against each event with point-in-polygon / distance decay.
- **AI Storm Brief** — a prioritized damage + opportunity brief for the selected area, generated from the
  company's own leads/jobs. Risk score and severity are computed deterministically; the model only writes the narrative.
- **AI Map Copilot** — "show extreme tornado warnings", "find leads inside the hail swath", "reset view" →
  a *validated* map plan (filters, focus, overlays, highlighted leads). Free text is never executed directly.
- **Impact overlays** — storm outlines, affected properties, radar layer, hail-swath estimates, highlighted leads.

### CRM core

- Leads with pipeline stages, source attribution, storm-event linking and assignment.
- Jobs with phases (Inspection → Estimate → Production → Invoicing → Completed), budgets, costs, gross profit.
- Line-item estimates from a price database, margin analysis and PDF proposals.
- Multi-resource calendar (inspectors, crews, sales) with conflict detection and reminders.
- **Job Feed** — per-job threaded conversation (the AccuLynx "message board" replacement), mentions,
  attachments, and automatic system posts for status changes. Real-time over WebSockets.
- Documents, photo capture/annotations, materials, subcontractors, change orders.
- Reports: pipeline, job profitability, production efficiency.
- Integrations: QuickBooks, Google/Outlook Calendar, aerial measurement providers, webhooks.

### AI gateway (FreeLLMAPI-compatible)

An OpenAI-compatible multi-provider router embedded in the API, modelled on
[FreeLLMAPI](https://github.com/marcusdax/freellmapi):

- Provider registry for free tiers (Groq, Google AI Studio, Cerebras, Mistral, OpenRouter, NVIDIA) + any custom
  OpenAI-compatible endpoint + an optional external FreeLLMAPI instance.
- Smart fallback chain, per-provider cooldowns, key rotation, sticky sessions, request metering.
- **AES-256-GCM encrypted provider keys** — decrypted in memory per request, only ever returned masked.
- **Deterministic local fallback** — storm brief, copilot and lead insights work with no keys at all
  (`source: "heuristic"` in every response, shown in the UI as "Offline engine").
- Provider admin UI at **Settings → AI Gateway**: add/test/prioritize keys, health, usage.

See [`docs/FREELLMAPI_INTEGRATION.md`](docs/FREELLMAPI_INTEGRATION.md) and
[`docs/AI_STORM_ARCHITECTURE.md`](docs/AI_STORM_ARCHITECTURE.md).

### UX for adoption (AccuLynx's steep learning curve is the target)

- Role-based onboarding tour on first login, replayable from the header.
- Quick Start row on the dashboard: Add lead · Schedule inspection · Create estimate · Storm Intelligence.
- WCAG-minded design tokens, number+text severity labels (never color alone), keyboard paths.
- PWA: installable, offline shell with an offline banner, service-worker caching that never caches API responses.

---

## Architecture

```
React 18 + TypeScript + Vite + Tailwind + Radix  ──  PWA shell (manifest + service worker)
        │  /api/v1 (JWT, Socket.IO real-time)
Express 4 + TypeScript ── modular monolith
        ├── CRM: leads · jobs · estimates · calendar · feed · documents · reports
        ├── AI gateway: llm/* (crypto · registry · rateLimit · router · gateway · localFallback)
        ├── AI features: services/ai/* (stormBrief · mapCopilot · leadInsights)
        └── Storm intel: services/storm/* (geo · clustering · impact scoring)
PostgreSQL 16 (Prisma)  ·  Redis 7 (cache, queues, pub/sub)  ·  NOAA/NWS public API
```

| Path | Purpose |
|---|---|
| `backend/src/routes/` | REST API (`/api/v1/*`), auth middleware, validation |
| `backend/src/services/` | Domain services (auth, estimates, PDF, integrations, AI, storms) |
| `backend/src/llm/` | FreeLLMAPI-compatible gateway internals |
| `backend/prisma/schema.prisma` | Data model (multi-tenant by `companyId`) |
| `frontend/src/pages/` | Dashboard, Leads, Jobs, Estimates, Calendar, Storm Intelligence, Reports, Settings |
| `frontend/src/components/` | Design system primitives, StormMap, AI panels, Job Feed |
| `scripts/` | `launch.ps1`, `smoke.ps1`, `stop.ps1` |
| `docs/` | Architecture, product brief, blueprint coverage, runbook |

### API surface (v1)

`/auth` · `/companies` · `/leads` · `/jobs` · `/estimates` · `/calendar` · `/feed` · `/documents` ·
`/notifications` · `/integrations` · `/storms` · `/weather` · `/maps` · `/materials` · `/subcontractors` ·
`/reports` · **`/storm-intel`** · **`/ai`**

---

## Configuration

All configuration is environment-based; see [`backend/.env.example`](backend/.env.example). Important groups:

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `REDIS_URL` | Infrastructure (compose overrides for container networking) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Auth signing — **change in production** |
| `NOAA_API_URL`, `NOAA_USER_AGENT` | Storm data source |
| `AI_ENABLED`, `AI_ALLOW_LOCAL_FALLBACK` | AI gateway switches (offline engine by default) |
| `AI_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM provider-key encryption |
| `AI_DEFAULT_STRATEGY` | `balanced` / `speed` / `reliability` / `priority` |
| `AI_FREELMAPI_URL` | Optional external FreeLLMAPI gateway base URL |
| `AI_BOOTSTRAP_KEYS` | Optional JSON seed of provider keys (DB config wins) |

Provider keys can also be added at runtime from **Settings → AI Gateway** (stored encrypted).

---

## Testing & verification

```powershell
# Backend: Node's built-in test runner via tsx (no Jest config required)
cd backend; npm test

# Frontend: Vitest + Testing Library
cd frontend; npx vitest run

# Typecheck everything
cd backend; npx tsc --noEmit
cd frontend; npx tsc --noEmit

# Build the production web bundle
cd frontend; npm run build:dev

# End-to-end smoke test against the running stack
npm run smoke
```

---

## Production checklist

- [ ] Replace `JWT_SECRET` / `JWT_REFRESH_SECRET` with 48+ random chars and rotate `AI_ENCRYPTION_KEY` once.
- [ ] Put the stack behind TLS (reverse proxy or cloud load balancer) — the compose file is HTTP-only by design.
- [ ] Use managed PostgreSQL/Redis with backups (point-in-time recovery), not the local volumes.
- [ ] Move uploads to S3-compatible object storage and serve via CDN.
- [ ] Set `NODE_ENV=production`, disable `prisma db push` seeding, run reviewed migrations.
- [ ] Configure Sentry/monitoring; scrape `/api/v1/health` and alert on failures.
- [ ] Review the data-retention + consent policy for customer photos/documents.
- [ ] Only configure AI providers whose terms permit your use case; free tiers are not an SLA.

---

## Docs

- [AI & Storm Architecture](docs/AI_STORM_ARCHITECTURE.md)
- [FreeLLMAPI Integration](docs/FREELLMAPI_INTEGRATION.md)
- [Product & Business Brief](docs/PRODUCT_BRIEF.md)
- [AccuLynx Blueprint Coverage](docs/BLUEPRINT_COVERAGE.md)
- [Launch Runbook](docs/LAUNCH_RUNBOOK.md)
- [Changelog](docs/CHANGELOG.md)

---

© 2026 ODASI Technologies, Inc. All rights reserved. RoofPro CRM is proprietary software.
