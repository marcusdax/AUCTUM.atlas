# RoofPro CRM — AI Gateway & Storm Intelligence Architecture

**Status:** approved for build · **Owner:** Lead · **Audience:** backend + frontend contributors

This document is the **single source of truth** for the FreeLLMAPI integration and the
storm/map intelligence features. Implement to this contract; if reality forces a deviation,
message the Lead *before* changing a shape that a teammate consumes.

---

## 1. Why this exists

RoofPro CRM already ships NOAA storm tracking, an interactive Leaflet map, a CRM
(leads → jobs → estimates), a Job Feed and reporting. What it lacks is **interpretation**:
a contractor sees alert polygons but not *what it means for their book of business*.

`FreeLLMAPI` (https://github.com/marcusdax/freellmapi) aggregates the free tiers of ~34
OpenAI-compatible providers behind one `/v1` endpoint with smart routing, automatic
failover and encrypted keys. We adopt that **architecture** (not its UI) as an embedded
AI gateway:

- **Storm Intelligence Brief** — turns live NOAA alerts + the company's leads/jobs into a
  prioritized damage/opportunity brief for the map page.
- **AI Map Copilot** — natural-language → validated map plan (filters, focus, overlays,
  lead highlights). Never executes free text; only a whitelisted plan object.
- **Lead storm-impact scoring** — deterministic geo scoring (point-in-polygon / distance)
  that the LLM only *explains*; numbers are never invented by the model.
- **Provider admin** — add/test/prioritize free provider keys, see health and usage.

### Non-negotiable guarantees

1. **No key → still works.** A deterministic local engine (`local` provider) produces the
   storm brief, map plan and lead explanation with zero network access. The API reports
   `source: "heuristic"`.
2. **No secrets out.** Provider keys are AES-256-GCM encrypted at rest, decrypted only in
   memory per request, and returned masked (`••••abcd`) or not at all.
3. **No prompt injection into plans.** LLM output for the copilot is parsed as JSON and
   validated field-by-field against a whitelist; unknown fields are dropped.
4. **Fail open, never hang.** Every provider call has a timeout (`AI_REQUEST_TIMEOUT_MS`,
   default 20 000). Router tries the chain, then local fallback.
5. **Never a paid API.** Only OpenAI-compatible endpoints configured by an admin; default
   registry contains free-tier providers plus an optional external FreeLLMAPI gateway.

---

## 2. Component map

```
┌──────────────────────────── Frontend (React 18 + Vite) ────────────────────────────┐
│ StormTracking page  ── StormBriefCard · MapCopilot · LeadImpactCard                 │
│ StormMap (Leaflet)  ── alerts / storm outlines / hail swath / highlighted leads     │
│ Settings › AI Gateway ── provider keys, priority chain, health, usage               │
└───────────────────────────────────────┬────────────────────────────────────────────┘
                                        │ axios /api/v1 (JWT)
┌───────────────────────────────────────▼────────────────────────────────────────────┐
│ Express API (/api/v1)                                                               │
│  /ai/status|chat|storm-brief|map-copilot|lead-insights|providers|usage              │
│  /storm-intel/overview|events.geojson|impact|sync|rescore-leads                     │
│                                                                                     │
│  services/ai/stormBrief.ts   ── builds brief (LLM draft → validated JSON → heuristic)│
│  services/ai/mapCopilot.ts   ── NL → MapPlan (validated)                            │
│  services/ai/leadInsights.ts ── explanation over deterministic score                │
│  services/storm/stormIntelligence.ts ── NOAA sync, clustering, geo scoring          │
│                                                                                     │
│  llm/router.ts ── priority chain · scoring · cooldown · key rotation · sticky       │
│  llm/gateway.ts ── OpenAI-compatible chat completions (fetch, timeout, usage)       │
│  llm/localFallback.ts ── deterministic engine (no network)                          │
└───────────────────────────────────────┬────────────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼────────────────────────────────┐
        ▼                               ▼                                ▼
  PostgreSQL (AIProvider,        FreeLLMAPI gateway               NOAA / NWS API
  AIUsage, AISetting,             (optional, external             (alerts, storm
  StormEvent, Lead)               http://localhost:3001/v1)       reports, radar)
```

---

## 3. File ownership (write scopes)

Do **not** edit files outside your scope. Shared files are owned by the Lead.

| Area | Files | Owner |
|---|---|---|
| AI gateway core | `backend/src/llm/**` | **backend-ai** |
| AI routes + services | `backend/src/routes/ai.routes.ts`, `backend/src/services/ai/**` | **backend-ai** |
| Storm intelligence | `backend/src/services/storm/**`, `backend/src/routes/stormIntel.routes.ts`, `backend/src/scripts/seedDemo.ts` | **backend-storm** |
| Storm/AI map UI | `frontend/src/pages/StormTracking.tsx`, `frontend/src/components/ai/**`, `frontend/src/components/StormMap.tsx` (additive props only), `frontend/src/pages/settings/AIGateway.tsx`, `frontend/src/services/ai.ts`, `frontend/src/types/ai.ts` | **frontend-ai** |
| PWA + onboarding | `frontend/public/**` (new files), `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/pwa/**`, `frontend/src/components/onboarding/**`, `frontend/src/pages/Dashboard.tsx` (quick-start block only) | **frontend-pwa** |
| Wiring / schema / launch | `backend/prisma/schema.prisma`, `backend/src/routes/index.ts`, `backend/src/server.ts`, `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/pages/Settings.tsx`, env files, Docker, docs, package scripts, `backend/jest.config.js` | **Lead** |
| QA + verification | test runs, builds, smoke scripts (`scripts/**` new), reports | **qa-launch** (spawned later) |

Rules:

- Add **no new npm dependencies** without Lead approval (air-gapped installs are risky).
  Backend uses global `fetch` (Node 20/24). Frontend uses what is already in
  `frontend/package.json`.
- Do not run `docker compose build/up` — the Lead owns the launch. Use a local dev server
  on a non-conflicting port for endpoint tests.
- Do not `git commit`; the Lead curates commits and reviews the diff.
- Do not modify the running containers.

---

## 4. Shared backend contract

### 4.1 LLM types — `backend/src/llm/types.ts` (owner: backend-ai)

```ts
export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatMessage { role: ChatRole; content: string }

export interface LLMRequest {
  messages: ChatMessage[];
  /** Routing purpose — used for chain selection, metering and prompt profiles. */
  purpose: 'storm_brief' | 'map_copilot' | 'lead_insights' | 'chat' | 'provider_test';
  /** Ask the router for JSON output; providers that support response_format get it. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Sticky-session key: same key tends to stick to the same model for 30 min. */
  conversationId?: string;
  /** Skip the local fallback (used by provider connectivity tests). */
  noFallback?: boolean;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResult {
  content: string;
  providerId: string;        // 'groq' | 'google' | ... | 'local'
  model: string;
  usage: LLMUsage;
  latencyMs: number;
  fallback: boolean;         // true when local engine answered
  attempts: Array<{ providerId: string; model?: string; ok: boolean; error?: string; latencyMs?: number }>;
}
```

### 4.2 Storm service contract — `backend/src/services/storm/stormIntelligence.ts`

Exported (owner: backend-storm; stub authored by Lead):

```ts
import type { BBox, StormContext, ImpactResult, StormEventSummary } from './types';

/** Company-scoped storm context used by both /storm-intel and /ai. */
export function getStormContext(
  companyId: string,
  opts?: { days?: number; bbox?: BBox; limit?: number }
): Promise<StormContext>;

/** Deterministic impact for a coordinate (NOAA alerts + cached events). */
export function getImpactForPoint(lat: number, lng: number): Promise<ImpactResult>;

/** Deterministic storm-impact score for one lead, persisted on Lead.stormImpactScore. */
export function scoreLeadAgainstStorms(
  companyId: string,
  leadId: string
): Promise<{ score: number; eventId?: string; drivers: Array<{ label: string; weight: number }> }>;

/** Fetch live NOAA alerts, cluster into StormEvent rows for the company (idempotent upsert). */
export function syncNoaaEvents(
  companyId: string,
  opts?: { limit?: number; bbox?: BBox }
): Promise<{ created: number; updated: number; events: StormEventSummary[] }>;
```

Types in `backend/src/services/storm/types.ts` (Lead-authored, extend only additively):

```ts
export interface BBox { north: number; south: number; east: number; west: number }
export interface GeoPoint { lat: number; lng: number }
export interface StormEventSummary {
  id: string;
  externalId?: string | null;
  name: string;
  eventType: string;
  severity: 'MINOR' | 'MODERATE' | 'SEVERE' | 'EXTREME';
  startDate: string;
  endDate: string;
  area?: string | null;
  source: 'NOAA' | 'MANUAL' | 'IMPORT';
  geometry?: unknown;              // GeoJSON Polygon/MultiPolygon when available
  leadCount: number;
  jobCount: number;
  aiBrief?: unknown;
}
export interface StormLeadRef {
  id: string; name: string; address: string;
  lat?: number; lng?: number; status: string;
  score?: number | null; stormEventId?: string | null;
}
export interface StormContext {
  generatedAt: string;
  bbox?: BBox;
  events: StormEventSummary[];
  leads: StormLeadRef[];
  stats: {
    activeEvents: number; extremeCount: number;
    leadsInImpact: number; jobsInImpact: number;
    bySeverity: Record<string, number>;
  };
}
export interface ImpactResult {
  score: number;                    // 0–100
  severity: 'NONE' | 'MINOR' | 'MODERATE' | 'SEVERE' | 'EXTREME';
  drivers: Array<{ label: string; weight: number }>;
  nearbyEvents: Array<{ id: string; name: string; severity: string; distanceKm: number }>;
  recommendations: string[];
}
```

### 4.3 Storm intelligence rules

- **Severity mapping:** NOAA `Extreme→EXTREME`, `Severe→SEVERE`, `Moderate→MODERATE`,
  `Minor→MINOR`. Event type: Tornado→`TORNADO`, Hurricane/Tropical→`HURRICANE`,
  Thunderstorm/Wind→`SEVERE_THUNDERSTORM`, Flood→`FLASH_FLOOD`, Winter/Blizzard→
  `WINTER_STORM`, Fire→`WILDFIRE`.
- **Clustering:** group alerts by event type + rounded centroid (≈0.25°) + 6 h window, so a
  multi-county warning becomes one `StormEvent` with a MultiPolygon geometry.
- **Upsert key:** `(companyId, externalId)` where `externalId = 'noaa:' + hash(sorted alert ids)`.
  Must be idempotent (running sync twice does not duplicate).
- **Impact score (0–100):** polygon containment = 100, else distance decay: `max(0, 100 - distanceKm * 2.2)`,
  weighted by severity (EXTREME 1.0, SEVERE 0.8, MODERATE 0.6, MINOR 0.4), cap at 100.
  Location: `Lead.propertyLatLng` (`{lat,lng}` or `{lat,lon}`).
- **No NOAA network → cached events.** `sync` failures must not 500; return
  `{created:0, updated:0, events:[...cached]}`.
- **Seed script** (`npm run seed:demo`) creates a demo company, 5 users (password
  `RoofPro!2026`), ~24 leads with coordinates, 8 jobs, estimates + items, calendar events,
  feed posts, 3 storm events (manual, with geometry), and 2 AI usage rows. Idempotent:
  reuse `demo@roofprocrm.com`; delete and recreate its company data only.

---

## 5. REST contracts

All routes are behind the existing JWT `authMiddleware` (mounted after `/auth`). Errors use
the existing `{ error: string }` shape with `400/401/403/404/429/500`. Provider mutations
require `requireRole('OWNER','MANAGER')`. Tenant scoping is always `req.user.companyId`.

### 5.1 `GET /api/v1/ai/status`

```json
{
  "enabled": true,
  "routing": { "strategy": "balanced", "stickyMinutes": 30, "fallbackChain": [{ "providerId": "groq", "model": "llama-3.3-70b-versatile" }] },
  "providers": [{
    "id": "3f1c…", "providerId": "groq", "name": "Groq", "kind": "remote",
    "configured": true, "enabled": true, "healthy": true, "priority": 10,
    "models": ["llama-3.3-70b-versatile"], "cooldownUntil": null, "lastCheckAt": "…", "baseUrl": "https://api.groq.com/openai/v1"
  }],
  "localFallback": { "available": true, "engine": "deterministic-v1" },
  "usage": { "today": { "requests": 4, "tokens": 1820, "fallbackRate": 0.25 }, "last7d": { "requests": 31, "tokens": 14002 } }
}
```

### 5.2 `POST /api/v1/ai/chat`

Request `{ messages: ChatMessage[], conversationId?, json?, temperature? }`.
Response `{ id, content, providerId, model, usage, latencyMs, fallback, createdAt }`.

### 5.3 `POST /api/v1/ai/storm-brief`

Request: `{ stormIds?: string[], bbox?: BBox, focus?: 'damage'|'leads'|'safety'|'operations', days?: number }`

```json
{
  "generatedAt": "2026-11-17T03:00:00.000Z",
  "source": "llm",
  "providerId": "groq",
  "model": "llama-3.3-70b-versatile",
  "latencyMs": 1840,
  "fallback": false,
  "brief": {
    "title": "Hail & wind corridor over Collin County",
    "summary": "Two severe thunderstorm warnings overlap 9 open leads…",
    "severity": "SEVERE",
    "riskScore": 78,
    "confidence": 0.82,
    "damageTypes": ["Hail", "Wind", "Water intrusion"],
    "affectedAreas": ["Collin County, TX", "McKinney, TX"],
    "recommendedActions": ["Call the 9 impacted leads within 24h", "Prioritize inspections on roofs older than 12 years"],
    "leadOpportunities": [{ "area": "McKinney, TX", "reason": "9 open leads inside the warning polygon", "priority": "HIGH" }],
    "safetyNotes": ["Avoid roof access during active lightning"]
  },
  "context": { "stormCount": 3, "leadCount": 9, "jobCount": 4, "impactedLeadCount": 9 }
}
```

`brief.riskScore` and `brief.severity` are **derived deterministically** from the storm
context; the LLM may only refine wording/ordering. If the LLM response fails validation,
serve the heuristic brief with `source:"heuristic"` and HTTP 200.

### 5.4 `POST /api/v1/ai/map-copilot`

Request `{ query: string, view?: { center: { lat, lng }, zoom: number } }`

```json
{
  "generatedAt": "…", "source": "llm", "providerId": "groq", "model": "…", "latencyMs": 900, "fallback": false,
  "plan": {
    "intent": "filter_severity",
    "explanation": "Showing severe and extreme alerts only, zoomed to North Texas.",
    "center": { "lat": 33.05, "lng": -96.75 },
    "zoom": 8,
    "bbox": { "north": 34.2, "south": 32.0, "east": -95.8, "west": -97.8 },
    "overlays": ["alerts", "stormEvents"],
    "filters": { "severity": ["SEVERE", "EXTREME"], "eventTypes": ["TORNADO"] },
    "highlightLeadIds": [],
    "matchedStormIds": ["…"]
  },
  "suggestions": ["Show leads inside the hail swath", "Which jobs are in the impact area?"]
}
```

Allowed `intent`: `focus_storm | filter_severity | show_leads | show_jobs | reset | explain | unknown`.
Allowed `overlays`: `alerts | stormEvents | hailSwath | leads | jobs | radar`. Validate and clamp
(`zoom 3–15`, lat/lng ranges, arrays ≤ 12). Empty plan is `intent:"unknown"` with an explanation.

### 5.5 `POST /api/v1/ai/lead-insights`

Request `{ leadId: string }` → `{ leadId, score, severity, drivers, explanation, nextBestAction,
recommendedStatus, talkTrack, riskFlags, source, providerId?, model?, latencyMs, generatedAt }`.
The score comes from `scoreLeadAgainstStorms`; the LLM explains it.

### 5.6 Provider admin

| Method & path | Body | Response |
|---|---|---|
| `GET /ai/providers` | — | `{ providers: ProviderView[], chain: string[] }` (masked keys) |
| `POST /ai/providers` | `{ providerId, apiKey, baseUrl?, models?, priority?, enabled? }` | `{ provider }` (201) |
| `PATCH /ai/providers/:id` | any subset of the above (`apiKey` rotates) | `{ provider }` |
| `DELETE /ai/providers/:id` | — | `{ ok: true }` (clears key + disables) |
| `POST /ai/providers/:id/test` | — | `{ ok, latencyMs?, model?, error? }` |
| `GET /ai/usage?days=7` | — | `{ totals, byDay[], byProvider[], byPurpose[] }` |
| `GET /ai/models` | — | `{ data: [{ id, providerId, model, configured }] }` |

`ProviderView`: `{ id, providerId, name, kind, baseUrl?, enabled, priority, models, configured,
apiKeyMasked?, health: { status, lastCheckAt?, latencyMs?, error? } }`. Never return `apiKeyCipher`.

`POST /ai/providers` with `providerId:"freellmapi"` registers an external FreeLLMAPI gateway
(base URL from `AI_FREELMAPI_URL` when omitted) — it is tried first when enabled.
`providerId:"custom"` requires `baseUrl`.

### 5.7 Storm intelligence endpoints

| Method & path | Request | Response |
|---|---|---|
| `GET /storm-intel/overview?days=7` | — | `{ generatedAt, events: StormEventSummary[], stats }` |
| `GET /storm-intel/events.geojson?days=7` | — | `FeatureCollection` with `properties:{ id, name, severity, eventType, leadCount, jobCount }` |
| `GET /storm-intel/impact?lat=&lng=` | — | `ImpactResult` |
| `POST /storm-intel/sync` | `{ limit?, bbox? }` | `{ created, updated, events }` |
| `POST /storm-intel/rescore-leads` | `{ eventId? }` | `{ scored, updated, leads: [{ id, score, eventId? }] }` |

GeoJSON features are only emitted when a storm has a usable geometry; events without one
(alert zones without polygons) appear in `overview` but not as geometry features.

---

## 6. Frontend contract

### 6.1 `frontend/src/types/ai.ts` mirrors §5 exactly

Include `AIStatus`, `StormBriefResponse`, `MapCopilotResponse`, `LeadInsightResponse`,
`ProviderView`, `AIUsageResponse`, `StormEventSummary`, `ImpactResult`.

### 6.2 `frontend/src/services/ai.ts`

```ts
export const aiApi = {
  status(): Promise<AIStatus>;
  chat(payload: { messages: { role: 'system'|'user'|'assistant'; content: string }[]; conversationId?: string; json?: boolean }): Promise<ChatResponse>;
  stormBrief(payload?: { stormIds?: string[]; bbox?: BBox; focus?: 'damage'|'leads'|'safety'|'operations' }): Promise<StormBriefResponse>;
  mapCopilot(payload: { query: string; view?: { center: { lat: number; lng: number }; zoom: number } }): Promise<MapCopilotResponse>;
  leadInsights(leadId: string): Promise<LeadInsightResponse>;
  providers(): Promise<{ providers: ProviderView[]; chain: string[] }>;
  addProvider(payload: AddProviderPayload): Promise<ProviderView>;
  updateProvider(id: string, payload: UpdateProviderPayload): Promise<ProviderView>;
  removeProvider(id: string): Promise<{ ok: true }>;
  testProvider(id: string): Promise<{ ok: boolean; latencyMs?: number; model?: string; error?: string }>;
  usage(days?: number): Promise<AIUsageResponse>;
  stormOverview(days?: number): Promise<{ events: StormEventSummary[]; stats: StormContextStats }>;
};
```

Errors surface as `AxiosError`; UI must render a fallback state, never an empty crash.
All AI panels accept `enabled=false` (status endpoint unreachable) and show "AI offline".

### 6.3 UI requirements (accessibility + design system)

- Use existing `components/ui` primitives (`Card`, `Button`, `Badge`, `Input`, `Select`, `Modal`),
  `lucide-react` icons, Tailwind tokens (never raw hex).
- Storm Brief card: loading skeleton, error retry, `source` badge (`AI · <provider>` vs
  `Offline engine`), risk gauge with **text label + number** (not color alone), damage chips,
  action checklist, lead-opportunity list linking to `/leads?status=...`.
- Map Copilot: input + apply; show `plan.explanation`; a "Plan" chip row (severity filters,
  overlays) the user can clear; keyboard submit; `aria-label`s.
- StormMap additive props (keep all existing behaviour and defaults):
  ```ts
  interface StormMapProps {
    // …existing…
    stormEvents?: StormEventSummary[];     // outlines/centroids from /storm-intel
    onStormEventClick?: (event: StormEventSummary) => void;
    highlightLeadIds?: string[];           // pulse markers for copilot highlights
    focus?: { center: { lat: number; lng: number }; zoom: number } | null;
    overlayVisibility?: { alertPolygons?: boolean; stormOutlines?: boolean; radar?: boolean };
  }
  ```
- Settings › AI Gateway: provider table (status dot + label), add-key modal, test button,
  enable/priority controls, usage summary, and a short "FreeLLMAPI" explainer. Admin-only
  actions hidden for `FIELD_CREW`/`SALES_REP` (403 handled).
- PWA: `manifest.webmanifest`, `sw.js` (network-first navigation with offline fallback,
  stale-while-revalidate for same-origin assets; never cache `/api/`), install prompt, offline
  banner. No new dependencies. Onboarding tour: first login, role-specific 4 steps, skip +
  replay, stored in `localStorage` key `roofpro.onboarding.v1`.

---

## 7. Configuration

Add to `backend/.env` (and `.env.example`; defaults shown). Never commit real keys.

```dotenv
DATABASE_URL=postgresql://postgres:roofpro123@localhost:5432/roofpro_crm?schema=public
REDIS_URL=redis://localhost:6379
NOAA_API_URL=https://api.weather.gov
NOAA_USER_AGENT=(RoofPro CRM, contact@roofprocrm.com)

# ── AI gateway (FreeLLMAPI-compatible) ─────────────────────────────
AI_ENABLED=true
AI_ENCRYPTION_KEY=            # 64 hex chars; falls back to SHA-256(JWT_SECRET) in dev
AI_DEFAULT_STRATEGY=balanced  # balanced | speed | reliability | priority
AI_REQUEST_TIMEOUT_MS=20000
AI_ALLOW_LOCAL_FALLBACK=true
AI_FREELMAPI_URL=             # e.g. http://localhost:3001/v1 — optional external gateway
AI_BOOTSTRAP_KEYS=            # optional JSON: {"groq":"gsk_…","google":"AIza…"}
```

`.env.example` documents each variable. `AIProvider` rows override bootstrap keys.

---

## 8. Definition of done (per workstream)

- [ ] `cd backend && npx tsc --noEmit` clean.
- [ ] `cd frontend && npx tsc --noEmit` clean.
- [ ] New behaviour covered by tests: backend Jest (`backend/src/**/__tests__`) or, for
      frontend, Vitest (`*.test.ts(x)`) — see existing examples before adding infrastructure.
- [ ] Endpoint smoke-tested against a locally-started API (port 5055/5174 to avoid the
      running containers) with a real JWT from `/auth/login` or `/auth/register`.
- [ ] No secrets in code, logs or responses; no new dependency.
- [ ] Report to Lead: files touched, commands run, evidence (HTTP status/JSON), open risks.

## 9. Local runbook for contributors

```bash
# backend (host, against the running docker Postgres/Redis)
cd backend
$env:DATABASE_URL="postgresql://postgres:roofpro123@localhost:5432/roofpro_crm?schema=public"
npx prisma generate
$env:PORT=5055; npx tsx src/server.ts

# frontend (vite dev, proxies :5000 by default — set VITE_API_URL or use the docker web)
cd frontend
npm run dev -- --port 5174
```

Auth for smoke tests: `POST /api/v1/auth/register` with a fresh email + `companyName`
(see `routes/auth.routes.ts` for the exact payload), then use `accessToken`.
