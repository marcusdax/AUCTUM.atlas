# Changelog

All notable changes to RoofPro CRM. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
the project aims at semantic versioning once public.

## [1.2.0] — Sprint 10: Install QC + Job Passport

### Added
- **Install QC checklists** — five phase-specific SOP checklists (inspection, estimate, production,
  invoicing, completed) with required items, photo evidence, pass/fail scoring and sign-off. Completion
  writes an append-only `FieldLedgerEntry` receipt with a deterministic idempotency key, so retries never
  double-write.
- **Job Passport** — an opt-in public job record at `/p/<slug>`: frozen sanitized snapshot, SHA-256
  content digest, verification endpoint, privacy levels (`EXACT` / `STREET_ONLY` / `HIDDEN`), versioned
  re-publish and immediate unpublish. Shows photos, materials, QC sign-offs and ledger receipts; never
  customer PII, notes, staff data or estimate line items.
- **QC & Passport tab** on the job page (checklists, photo-evidence picker from job photos, publish
  controls, QR code, digest) and a branded public Job Passport page with verification badge, print
  styles and a 404 state for revoked links.
- **CI** — GitHub Actions workflow: backend `npm ci` + Prisma generate + typecheck + 139 tests, frontend
  `npm ci` + typecheck + Vitest + production build, and Docker image builds on push/PR to `main`.
- **Docs & operations** — `docs/JOB_PASSPORT.md` (operator/privacy guide), `docs/SPRINT_10_QC_PASSPORT.md`
  (contract), extended `scripts/smoke.ps1` QC/passport checks, and demo seed data with QC runs and a
  published passport.

### Fixed
- **Restored reproducible builds**: reverted the dependabot Vite 8 / Vitest 5 bump that violated
  Storybook 8's peer range (`vite ^4 || ^5 || ^6`) and broke `npm ci` and the Docker frontend build.
  Vite stays on 5.4.x and Vitest on 2.1.x until Storybook supports newer Vite.
- Regenerated the Prisma client for the new QC/passport models so backend typecheck and container builds
  are clean.

### Fixed (deployment hardening)
- Portal stack now uses a dedicated `auctum_atlas` database instead of a DB polluted with foreign
  experiment tables (`VanguardTask`, `AuditLedgerEntry`, …) that made `prisma db push` abort and
  crash-loop the API. The previous `roofpro_crm` database is preserved untouched.
- API no longer crashes when Redis is unavailable: the Socket.IO subscriber sets
  `maxRetriesPerRequest: null` and attaches an error handler, so the process stays up and retries.
- Production startup now requires real JWT secrets (the merged `config/secrets.ts` guard); deployment
  secrets were rotated to 96-hex-char values in the git-ignored `backend/.env`.
- Seeded QC/passport photos are now deterministic PNG placeholders (previously SVG, blocked by the
  upload security whitelist) and the portal `seed` service mounts `backend/uploads`, so demo photos
  and passport grids render.

### Changed
- Portal deployment (`docker-compose.portal.yml`) pinned to database `auctum_atlas`, with the seeder's
  uploads volume mounted; README documents the full ecosystem stack (:3100 / :5100 / :5435 / :6385).
- Version bumped to **1.2.0** across the workspace.

## [Unreleased] — launch hardening

### Added
- **FreeLLMAPI-compatible AI gateway** (`backend/src/llm/`): provider registry for free tiers
  (Groq, Google AI Studio, Cerebras, Mistral, OpenRouter, NVIDIA) + custom OpenAI-compatible
  endpoints + optional external FreeLLMAPI instance; priority fallback chain, per-provider
  cooldowns, key rotation, sticky sessions, usage metering, AES-256-GCM encrypted keys.
- **Deterministic offline AI engine** — storm briefs, map plans and lead explanations work with zero
  provider keys and are labelled `heuristic` / "Offline engine" in the UI.
- **Storm intelligence engine** (`backend/src/services/storm/`): NOAA alert → storm-event clustering,
  idempotent upserts, point-in-polygon + distance-decay impact scoring, persisted
  `Lead.stormImpactScore`.
- **AI endpoints**: `/api/v1/ai/status|chat|storm-brief|map-copilot|lead-insights|providers|usage|models`
  and provider admin (`POST/PATCH/DELETE /ai/providers`, `/test`).
- **Storm intelligence endpoints**: `/api/v1/storm-intel/overview|events.geojson|impact|sync|rescore-leads`.
- **Storm Intelligence UI**: AI storm brief card, map copilot, lead impact card, storm-event overlays,
  highlighted leads, AI status.
- **AI Gateway settings** at `/settings/ai` — add/test/prioritize/remove providers, health, usage.
- **PWA**: web manifest + icons, hand-written service worker (offline shell, no API caching),
  install prompt, offline banner.
- **Guided onboarding** (role-specific tour, replayable) and a **Quick Start** row on the dashboard.
- **Demo workspace seeder** (`npm run seed:demo`, `docker compose run --rm seed`).
- **Launch tooling**: `scripts/launch.ps1` (one command), `scripts/smoke.ps1` (end-to-end checks with
  JSON report), `scripts/stop.ps1`, rewritten `START.bat`, health-checked compose stack.
- **Testing**: dependency-free backend test runner (`backend/scripts/run-tests.mjs`); AI/storm unit
  tests; frontend Vitest coverage for new logic.
- **Docs**: AI/storm architecture contract, FreeLLMAPI integration guide, product & business brief,
  blueprint coverage matrix, launch runbook, honest limits, changelog, rewritten README.

### Changed
- **UI rebranded to the AUCTUM estate design system** (appearance-only change): parchment/ink/oxblood
  palette, 2px geometry with hairline rules, Fraunces + Archivo + IBM Plex Mono typography, circular
  seal logo and AUCTUM wordmark; login/registration, navigation chrome, cards, tables, metric tiles,
  maps, reports and the PWA shell (manifest, icons, offline page, install prompt) all rethemed.
  Product logic, routes, API contracts, storage keys and tests are unchanged.
- Prisma schema: AIProvider, AIUsage, AISetting; StormEvent gains `AIProvider`, `AIUsage`, `AISetting`; `StormEvent` gains
  `externalId/source/geometry/metadata/aiBrief` + indexes; `Lead` gains
  `stormImpactScore/stormScoredAt` + indexes.
- Docker: removed obsolete compose `version`, added backend/frontend health checks, uploads + logs
  volumes, `host.docker.internal` mapping, one-shot `seed` tool service.
- nginx: gzip, immutable asset caching, `sw.js` no-cache, `/uploads` proxy, security headers.
- Frontend routing/design: AI Gateway settings route, Storm Intelligence page, cached-file URL
  resolution retained.

### Fixed
- **Session restore**: `GET /auth/me` was mounted without the auth middleware and always returned
  401, so every page reload logged users out. Now protected and covered by the smoke test.
- `/storms/events` was shadowed by `GET /storms/:id`; the static collection route now resolves.
- Malformed JSON bodies returned 500 from the global handler; now 400 `INVALID_JSON`
  (and 413 `PAYLOAD_TOO_LARGE` for oversized bodies).
- **Reports page no longer crashes**: the reporting APIs now return the field contract the UI reads
  (`leadsByStatus`, `jobs[]`, `phaseDistribution`, `crewProductivity[]`, …) while keeping the export shape.
- Added missing `GET /intelligence/dashboard`, `GET /maps/property-intelligence` and
  `GET /maps/storm-trajectories` that the dashboard and map already expected (were 404).
- Dashboard requested a non-existent `/storm-events`; corrected to `/storms/events`.
- NOAA sync persisted every national alert; it now keeps only clusters over the company's
  geocoded footprint (250 km margin) or the 12 worst while no footprint exists — the contractor's
  own storm events stay visible and the map GeoJSON is meaningful.
- Login page no longer auto-fills/displays `admin@roofpro.com / admin@123`; a deliberate
  "Try the demo workspace" action replaces it.
- `/api/analytics/vitals` web-vitals beacon returned 404 on every page; now a 204 ingest.
- AI status badge no longer claims "7 providers" when none are configured (shows "offline engine").
- Local host access to the compose Postgres (documented credentials via `.env`);
  `docker-entrypoint` keeps applying schema on boot.

### Security
- Provider keys encrypted at rest and masked in every response; provider mutations require an
  owner/manager JWT; AI inputs limited to the minimum tenant scoped context.

## [1.0.0] — RoofPro CRM baseline

- Lead → job → estimate → calendar → Job Feed CRM on PostgreSQL/Prisma.
- NOAA storm alerts, radar stations, weather lookup, Leaflet storm map.
- Reports (pipeline, profitability, production efficiency), documents, materials, subcontractors,
  change orders, integrations scaffolding.
- React 18 + Vite frontend, Express API, JWT auth, Socket.IO real-time, Docker Compose stack.


