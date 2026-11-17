# Release verification — RoofPro CRM v1.1 (launch candidate)

Evidence that the launch candidate actually runs, as executed on **2026-11-16/17** against
`F:\Atlas Helios\atlas-helios-platform` with Docker Desktop + PowerShell 7.

> Re-run everything with:
> ```powershell
> npm run launch          # build + up + seed
> npm run smoke           # 23 end-to-end checks
> cd backend; npm test    # 96 unit/integration tests
> cd ..\frontend; npx tsc --noEmit; npx vitest run; npx vite build
> node scripts/ui-shots.mjs
> ```

---

## 1. Build & type-safety

| Check | Command | Result |
|---|---|---|
| Backend typecheck | `cd backend; npx tsc --noEmit` | ✅ exit 0 |
| Frontend typecheck | `cd frontend; npx tsc --noEmit` | ✅ exit 0 |
| Backend image build | `docker compose build backend` | ✅ built (~3 min cold, layer-cached after) |
| Frontend image build | `docker compose build frontend` | ✅ built |
| Frontend production bundle | `npx vite build` | ✅ 10.3 s, code-split (vendor 315 kB / maps 157 kB / ui 160 kB raw; gzip 103/45/47 kB) |

## 2. Automated tests

| Suite | Command | Result |
|---|---|---|
| Backend (AI gateway, copilot validation, brief determinism, crypto, rate limits, geo/impact/clustering) | `cd backend; npm test` | ✅ **96 passed / 0 failed** |
| Frontend (AI panels/utils, PWA, onboarding, map helpers, existing suites) | `cd frontend; npx vitest run` | ✅ **175 passed / 0 failed** (11 files) |

## 3. Runtime stack (production compose)

```
roofpro-postgres   healthy   :5432
roofpro-redis      healthy   :6379
roofpro-backend    healthy   :5000
roofpro-frontend   healthy   :3000
```

Demo workspace seeded in-container: **6 users, 24 geocoded leads, 8 jobs, 10 estimates (30 items),
12 calendar events, 8 feed posts (2 system), 3 storm events, 12 price entries, 2 subcontractors,
2 material orders, 2 AI usage rows**; 24/24 leads storm-scored.

Sign in: `demo@roofprocrm.com` / `RoofPro!2026`.

## 4. End-to-end smoke (`npm run smoke`) — 23/23 PASS

```
PASS backend health            HTTP 200 / RoofPro CRM API
PASS web app                   HTTP 200
PASS auth login (demo)         role=OWNER
PASS auth session restore      user=demo@roofprocrm.com company=RoofPro Demo Roofing
PASS leads list                5 lead(s) returned
PASS jobs list                 5 job(s) returned
PASS calendar events           12 event(s) returned
PASS intelligence dashboard    leads=24 jobs=8 risk=81
PASS map property nodes        32 node(s)
PASS map trajectories          3 trajectory(ies)
PASS NOAA active storms        95 alert(s), source NOAA
PASS storm events collection   3 event(s)
PASS storm-intel overview      3 event(s)
PASS storm-intel sync          created=0 updated=0   (no storms over the demo footprint → no noise)
PASS storm events GeoJSON      3 feature(s)
PASS point impact score        score=100 severity=EXTREME
PASS rescore leads             scored=24 updated=0
PASS AI status                 enabled=True providers=7 localFallback=True
PASS AI storm brief            source=heuristic severity=EXTREME risk=92 actions=4
PASS AI map copilot            intent=filter_severity source=heuristic overlays=2
PASS AI lead insights          score=71 source=heuristic
PASS AI usage metering         requests=10 tokens=9948
PASS AI provider admin         7 provider config(s)
```

Reports saved under `runs/smoke-<timestamp>.json` (git-ignored).

Representative payloads observed:

- **Storm brief** — `{source:"heuristic", severity:"EXTREME", riskScore:92, confidence:0.79,
  context:{stormCount:3, leadCount:24, jobCount:18, impactedLeadCount:23}, recommendedActions:4,
  leadOpportunities:3}` — every number computed deterministically from seeded leads/jobs/storm geometry.
- **Map copilot** — `"show extreme tornado warnings"` →
  `{intent:"filter_severity", filters:{severity:["EXTREME"], eventTypes:["TORNADO"]},
  overlays:["alerts","stormEvents"], matchedStormIds:[…]}` (whitelist-validated).
- **Provider lifecycle** — add fake Groq key → `201 {apiKeyMasked:"••••abcd"}`; test → `{ok:false}`
  with the provider error only; disable; delete → cipher cleared, `configured:false`. No plaintext
  key appears in any response or log.
- **Malformed JSON** → `400 {error:"Invalid JSON body", code:"INVALID_JSON"}` (was a 500).
- **NOAA outage simulation** (separate run, `NOAA_API_URL=http://127.0.0.1:9`) → sync returned
  cached events, `degraded:true`, no throw.

## 5. UI verification (headless Chrome, real backend)

`node scripts/ui-shots.mjs` signs in through the real API, injects the persisted session, and captures:

| Screen | Result |
|---|---|
| Login | renders, demo CTA present, **no hardcoded admin credentials** |
| Dashboard | Quick Start row, command center metrics (AST 3, AI findings 6, risk 44/100), no error banners |
| Storm Intelligence | AI brief with risk gauge 92/100 + "Offline engine" badge, damage chips, affected areas, recommended actions checklist, lead opportunities, Active Storms, Map Copilot, Leaflet map with storm overlays |
| Leads / Jobs / Calendar / Estimates | data renders (seeded rows) |
| Reports | pipeline/profitability/production tabs render (previously blank — fixed) |
| AI Gateway | gateway status, routing, usage bars, per-provider breakdown, local-fallback explainer |

Screenshots: [`docs/screenshots/`](screenshots) and the full set in `runs/shots/` (git-ignored).

## 6. Defects found and fixed during verification

| # | Defect | Impact | Fix |
|---|---|---|---|
| 1 | `/api/v1/auth/me` route was mounted without `authMiddleware` → always 401 | Every page reload silently logged the user out | Added the middleware (regression covered by smoke "auth session restore") |
| 2 | `/api/v1/storms/events` shadowed by `GET /storms/:id` | Company storm-event collection 404 | Guard in `/:id` so static route wins |
| 3 | Malformed JSON bodies returned 500 | Client error looked like a server crash | Global handler maps `entity.parse.failed` → 400, `entity.too.large` → 413 |
| 4 | Reports page crashed (`Cannot read properties of undefined (reading 'NEW')`) | Blank page | Reporting APIs now emit the UI contract (`leadsByStatus`, `jobs`, `phaseDistribution`, …) alongside export fields |
| 5 | Missing `/intelligence/dashboard`, `/maps/property-intelligence`, `/maps/storm-trajectories` | Dashboard 404 banner, empty map layers | Implemented tenant-scoped aggregates derived from real rows |
| 6 | Dashboard requested `/storm-events` (no such route) | Storm events never appeared on dashboard | Corrected to `/storms/events` with response adaptation |
| 7 | NOAA sync persisted all national alerts (87–93 rows) | Drowned the contractor's own storms, blank GeoJSON | Sync now persists only clusters over the company footprint (geocoded leads/jobs + 250 km), or worst 12 while no footprint exists |
| 8 | Login page auto-filled/displayed `admin@roofpro.com / admin@123` | Security smell + confusing demo | Removed; replaced with an explicit "Try the demo workspace" button |
| 9 | `/api/analytics/vitals` 404 on every page (web-vitals beacon) | Console noise | Lightweight 204 ingest endpoint with debug logging |
| 10 | AI badge said "7 providers" with zero configured | Misleading capability claim | Badge now counts configured providers and says "offline engine" when none |

## 7. Honest residual risks

See [`LIMITS.md`](LIMITS.md). Notably: free AI tiers have no SLA, no email/SMS transport yet,
reporting/exports tested via API not a browser E2E suite, no billing enforcement, local-disk uploads,
single-node compose. These are documented, not hidden.
