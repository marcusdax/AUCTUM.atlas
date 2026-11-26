# Honest limits — RoofPro CRM v1.1

Written down on purpose. No product is finished; these are the edges a buyer or operator should
know before trusting the platform. Several are roadmap items with owners in
[`BLUEPRINT_COVERAGE.md`](BLUEPRINT_COVERAGE.md).

## AI gateway

- **Free tiers are not an SLA.** Latency, caps and model availability change hourly. Late in the
  day, the best free models hit daily caps; quality dips until the provider resets. The deterministic
  fallback means features keep working, but at reduced fluency.
- **The model never computes money or risk.** Risk score, severity, impact scores and distances are
  computed by our code. The LLM writes narrative and ordering only. Do not treat generated prose as
  engineering or insurance advice.
- **No vision/picture input yet.** Photos uploaded to a job are not analysed by the AI gateway.
  Damage detection ("Helios") is an earlier experimental module, not part of the v1.1 storm flow.
- **No streaming UI.** Responses are non-streaming; briefs appear when complete (usually < 3 s on a
  healthy provider). SSE/streaming is roadmap.
- **JSON is validated, not guaranteed.** A malformed model response is downgraded to the heuristic
  result rather than rendered. That is safe, but it can look like the AI "did nothing".
- **Prompt context is intentionally small.** We send storm summaries, area names, counts and status
  labels — not full customer PII or documents. That limits personalised advice.
- **No per-company provider keys yet.** Providers are configured globally by an owner/manager of the
  instance. Multi-tenant BYO-key is roadmap.

## Storm tracking & map intelligence

- **NOAA data is alert-scale, not parcel-scale.** Polygons cover counties/zones. "9 leads impacted"
  means the stored lat/lng of those leads falls inside the alert polygon (or within the decay radius),
  not that a specific roof was inspected.
- **Hail/wind sizes are estimates.** They are parsed from alert text/parameters when present;
  else derived from severity. Not a substitute for an aerial measurement or an adjuster.
- **No geocoding service.** A lead is map-scored only if `propertyLatLng` was captured (the lead form
  can accept coordinates). Address→lat/lng geocoding is roadmap.
- **Clustering is heuristic.** Alerts are grouped by event type + 0.25° cell + 6 h window. A large
  outbreak can merge into several events or one broad event; treat counts as operational, not forensic.
- **NOAA outages degrade to cached events.** Sync failures never 500, but "live" may be stale; the
  UI shows the generation timestamp.
- **Radar tiles are third-party (NWS).** Their availability and terms are outside our control.

## CRM & operations

- **In-app notifications only.** There is no email/SMS/push transport configured (no SMTP, Twilio or
  web-push provider in v1.1). Job Feed, mentions and schedule changes appear live over WebSocket while
  the app is open.
- **Integrations are credential-based, not full OAuth apps.** QuickBooks/Google Calendar calls go
  through `IntegrationService` using tokens stored per company. You must supply your own app
  credentials/tokens; the OAuth consent flow and token refresh are roadmap. No integration is
  exercised by the demo.
- **Materials/subcontractor/aerial-measurement integrations are workflows, not live supplier APIs.**
  No ABC Supply catalogue or EagleView/Hover API call ships enabled.
- **Billing is not enforced.** `subscriptionTier` exists on the company but there is no payment
  provider, seat metering or entitlement gate. Pricing in the product brief is strategy, not code.
- **No customer-facing portal.** Homeowner login/approval/photos is roadmap; estimates are PDFs.
- **PWA offline is read-oriented.** App shell + last-visited SPA navigation can load offline; writes
  (new lead, feed post) need connectivity. A background-sync mutation queue is roadmap.
- **No native apps.** PWA only; no App Store/Play Store wrappers.
- **Single-region, single-node compose.** No multi-AZ, active-active, or per-tenant sharding; scaling
  is a modular-monolith scale-up plus Redis/queue extraction (roadmap).
- **File storage is local disk** (`backend/uploads`, mounted volume). Production should use
  S3-compatible storage; the code path is not abstracted yet.
- **Permissions are role-level** (OWNER/MANAGER/SALES_REP/PROJECT_MANAGER/FIELD_CREW/OFFICE_ADMIN),
  not record-level ACLs or custom roles.
- **No migration importer from AccuLynx/JobNimbus.** Data export is free (CSV/PDF via reports), import
  is manual/API.

### Install QC & Job Passport

- **QC templates are fixed in code** for this sprint (five phase SOPs). Company-specific checklists,
  waiver text and per-market variations are a follow-up.
- **Photo evidence links existing job uploads.** The QC form picks from the job's PHOTO documents; there
  is no in-form camera capture or automatic geotag yet (the Field Hub camera flow is separate).
- **The passport is self-verified.** The digest proves the stored record has not changed since
  publication; it is not a third-party certification, insurance report, lab diagnosis or warranty.
- **Access control is the unguessable link.** Public passports are `noindex` and rate-limited but anyone
  holding the URL can view them — treat the link as a bearer credential and unpublish when sharing should stop.
- **Publishing is a snapshot.** Materials, photos and estimate totals appear only if they existed on the
  job at publish time; add data first, then publish/republish to include it.
- **No e-signature on the passport.** Homeowner approvals remain the separate estimate-approval flow.

## Quality & security

- **Tests are unit/integration level.** Backend tests cover the AI router, crypto, plan validation,
  heuristic briefs and storm geo/scoring; frontend tests cover new pure logic. There is **no** browser
  E2E suite (Cypress/Playwright) and **no** load test in v1.1 — both are roadmap. Run the smoke script
  against a live stack instead.
- **Defaults are development defaults.** `backend/.env` ships with known JWT secrets unless the
  launcher generates them; compose is HTTP-only; demo passwords are published. Harden before exposure
  (see the production checklist in the README and the runbook).
- **No SOC2/GDPR programme.** Data-minimisation is practiced, but audit logging, retention policy,
  DPA templates and pen-test evidence are not part of this release.
- **AI provider terms are yours to honour.** Using free tiers through RoofPro is still subject to each
  provider's ToS. Do not send regulated data.

## What "launch candidate" means here

The stack boots reproducibly, the AI works with and without keys, the CRM flows are demonstrable with
seeded data, and the smoke test validates the critical path end-to-end. It does **not** mean billing,
email delivery, OAuth apps, native apps or multi-region HA are done.
