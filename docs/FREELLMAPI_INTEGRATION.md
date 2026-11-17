# FreeLLMAPI integration — powering map & storm intelligence

RoofPro CRM uses the **architecture** of [FreeLLMAPI](https://github.com/marcusdax/freellmapi)
(an OpenAI-compatible router that stacks the free tiers of many LLM providers behind one `/v1`
endpoint) as an *embedded* AI gateway. We do not ship their dashboard, desktop app or provider
credentials; we implement the parts that matter for a roofing CRM and keep full control of data.

> Upstream project is MIT-licensed and explicitly "for personal experimentation, not production".
> Read the disclaimer at the bottom of this document before pointing it at real customer data.

---

## Why the gateway exists in a storm-tracking product

NOAA tells a contractor *where* a warning polygon is. It does not tell them:

- which of their 40 open leads sit inside the hail core,
- which flagged follow-ups matter most in the next 24 hours,
- how to explain the risk to a homeowner,
- what to look at on the map when a dispatcher says "show me the tornado warnings near McKinney".

Those are interpretation tasks — LLM territory — but a roofing CRM cannot hard-depend on a paid API.
FreeLLMAPI's model (free-tier aggregation, failover, per-key quota tracking) is the right shape:
**AI features work when a provider is configured, and degrade to a deterministic engine when not.**

## Three operating modes

| Mode | Setup | Behaviour | `source` in responses |
|---|---|---|---|
| **0. Offline (default)** | nothing | Deterministic engine writes the brief/plan/explanation from real computed data. No network. | `heuristic` |
| **1. Free provider keys** | add keys in Settings → AI Gateway, or `AI_BOOTSTRAP_KEYS` | Router tries providers in priority order, fails over on 429/5xx, writes the same structured shape. | `llm` |
| **2. External FreeLLMAPI** | run upstream FreeLLMAPI, point `AI_FREELMAPI_URL` at it, register provider `freellmapi` with its unified key | RoofPro uses the gateway exactly like any OpenAI-compatible endpoint; FreeLLMAPI does the stacking. | `llm` |

Mode 0 means the **demo always works**, in a truck with no signal, or in an air-gapped eval.
Mode 2 means an operator who already runs FreeLLMAPI gets all ~34 providers without pasting keys
into RoofPro.

---

## Mode 1 — direct free-tier provider keys

Open **Settings → AI Gateway → Add provider**. Supported catalogue (OpenAI-compatible endpoints):

| Provider id | Base URL | Get a free key | Notes |
|---|---|---|---|
| `groq` | `https://api.groq.com/openai/v1` | console.groq.com | Fast Llama models, generous free RPM |
| `google` | `https://generativelanguage.googleapis.com/v1beta/openai` | aistudio.google.com | Gemini Flash free tier |
| `cerebras` | `https://api.cerebras.ai/v1` | cloud.cerebras.ai | Very fast; low daily caps |
| `mistral` | `https://api.mistral.ai/v1` | console.mistral.ai | Free experimental tier |
| `openrouter` | `https://openrouter.ai/api/v1` | openrouter.ai/keys | `:free` model variants |
| `nvidia` | `https://integrate.api.nvidia.com/v1` | build.nvidia.com | NIM free credits |
| `custom` | your URL | — | Any OpenAI-compatible endpoint (llama.cpp, vLLM, LM Studio, Ollama) |

Recommended minimum for the storm/copilot features: **one of `groq` or `google` with a
Llama/Gemini Flash-class model**, plus a second provider so failover is real.

Alternatively seed keys at boot:

```dotenv
AI_BOOTSTRAP_KEYS={"groq":"gsk_...","google":"AIza..."}
```

Database-configured providers always take precedence over bootstrap env.

### Add a key over the API

```powershell
$token = (Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/v1/auth/login `
  -ContentType 'application/json' -Body '{"email":"demo@roofprocrm.com","password":"RoofPro!2026"}').accessToken

Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/v1/ai/providers `
  -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json' `
  -Body '{"providerId":"groq","apiKey":"gsk_example","priority":10}'
```

The response never contains the key — only `apiKeyMasked` (`••••abcd`). Test it:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/v1/ai/providers/<id>/test `
  -Headers @{ Authorization = "Bearer $token" }
# → { ok: true, latencyMs: 412, model: "llama-3.3-70b-versatile" }
```

---

## Mode 2 — external FreeLLMAPI gateway

RoofPro talks to it as a normal OpenAI-compatible provider, so you get FreeLLMAPI's full router,
catalog updates and quota tracking without any RoofPro code changes.

1. **Run FreeLLMAPI** (see its README; Docker example):

   ```bash
   docker run -d --name freellmapi -p 3001:3001 \
     -v freellmapi-data:/data ghcr.io/freellmapi/freellmapi:latest
   ```

   Open http://localhost:3001, add your provider keys on its **Keys** page, then copy the
   unified `freellmapi-…` key from the header.

2. **Allow the RoofPro API container to reach it.** On Docker Desktop the host is
   `host.docker.internal` (Compose already declares `extra_hosts` for the backend service):

   ```dotenv
   # backend/.env
   AI_FREELMAPI_URL=http://host.docker.internal:3001/v1
   ```

3. **Register the provider** at Settings → AI Gateway → provider `freellmapi` → paste the unified
   key (or `POST /ai/providers` with `{"providerId":"freellmapi","apiKey":"freellmapi-…","priority":1}`).

4. Hit **Test**, then generate a Storm Brief from the map page. `GET /api/v1/ai/status` should show
   the `freellmapi` provider as configured and healthy.

If RoofPro runs outside Docker, `AI_FREELMAPI_URL=http://localhost:3001/v1` works directly.

---

## How the router behaves

- **Chain** = enabled, configured, healthy providers ordered by `priority`; ties broken by strategy
  score (`balanced` default, or `speed`, `reliability`, `priority`).
- **Failover**: timeout (`AI_REQUEST_TIMEOUT_MS`, default 20 s), network error, 429 or 5xx puts that
  provider into exponential cooldown and tries the next one. The final fallback is the local engine.
- **Sticky sessions**: a `conversationId` keeps the same provider/model for ~30 minutes so multi-turn
  copilot conversations don't flip models mid-thread.
- **Metering**: every call records provider, model, purpose, tokens, latency and fallback flag in
  `AIUsage` (visible at `/api/v1/ai/usage` and in Settings → AI Gateway).
- **Structured output**: feature calls request JSON (`response_format`) and parse defensively. The
  storm brief's `riskScore`/`severity` are always computed by our engine; the model only refines
  wording and ordering. The copilot plan is whitelist-validated before it can touch the map.

## Security

- Provider keys are encrypted with **AES-256-GCM** (`AI_ENCRYPTION_KEY` or a derivation of
  `JWT_SECRET` in dev) and stored in `AIProvider.apiKeyCipher`. They are decrypted per request,
  never logged, never returned by any endpoint.
- Provider management requires `OWNER`/`MANAGER`; all AI endpoints are tenant-scoped by JWT.
- Storm/product prompts contain only the minimum company context needed (counts, area names,
  lead statuses). Configure a provider you trust; do not send regulated data through free tiers.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `source: "heuristic"` every time | No provider configured/healthy. Check `/ai/status` → `providers`, add a key. |
| Provider flapping every few calls | Free-tier quota. Add a second provider or lower priority of the flaky one. |
| 401 from provider in test | Wrong key type (some providers need a project-scoped key) or key not enabled for the model. |
| `freellmapi` unreachable in Docker | Use `host.docker.internal` (Windows/macOS) or the host's LAN IP (Linux). |
| Copilot returns `intent: "unknown"` | The question didn't map to a supported intent; suggestions in the response show what works. |

## Honest limits (inherited from free tiers)

Free tiers are rate-limited, variable-latency and not an SLA. Late in the day, the best models hit
their daily caps and quality drops until UTC reset. Do not build billing, legal, safety-critical or
regulated-data workflows on them. If you ship RoofPro commercially, configure a paid provider or your
own inference endpoint (Mode 1 supports any OpenAI-compatible `custom` base URL). Rotate keys, monitor
`/ai/usage`, and keep the offline engine enabled as the last line of defence.
