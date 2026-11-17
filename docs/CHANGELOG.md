# Changelog

All notable changes to RoofPro CRM. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
the project aims at semantic versioning once public.

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
- Prisma schema: `AIProvider`, `AIUsage`, `AISetting`; `StormEvent` gains
  `externalId/source/geometry/metadata/aiBrief` + indexes; `Lead` gains
  `stormImpactScore/stormScoredAt` + indexes.
- Docker: removed obsolete compose `version`, added backend/frontend health checks, uploads + logs
  volumes, `host.docker.internal` mapping, one-shot `seed` tool service.
- nginx: gzip, immutable asset caching, `sw.js` no-cache, `/uploads` proxy, security headers.
- Frontend routing/design: AI Gateway settings route, Storm Intelligence page, cached-file URL
  resolution retained.

### Fixed
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
