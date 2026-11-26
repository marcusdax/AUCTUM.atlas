# Sprint 10 — Install QC + Job Passport (contract)

**Status:** approved for build · **Owner:** Lead · **Audience:** backend + frontend contributors
**Roadmap source:** `docs/EXPANSION_CONCEPT.md` §4 item 2 ("Install QC and the Job Passport — this is the differentiator").

## 1. Why this sprint

The CRM already tracks jobs, materials, photos, estimates and a Field Hub provenance chain.
What a contractor cannot yet do is **prove the work was done right**: phase checklists that close a
stage, and a shareable, tamper-evident record a homeowner, insurer or buyer can open without signing in.

This sprint adds:

1. **Install QC checklists** — five phase-specific SOP checklists (inspection → completed), required
   items, photo evidence, pass/fail scoring, sign-off, and an append-only ledger receipt.
2. **Job Passport** — an opt-in public page per job behind an unguessable slug, showing a frozen
   sanitized snapshot (photos, materials, QC sign-offs, ledger receipts) with a SHA-256 content digest
   and a server-side verification endpoint.
3. **Release engineering** — restore a green reproducible build (the merged Vite 8/Vitest 5 bump breaks
   Storybook's peer range and `npm ci`), add CI, and ship a tagged release.

## 2. Non-negotiable rules

- **Opt-in, privacy-first.** A passport is private until published. Default privacy `STREET_ONLY`.
  Never expose internal IDs, customer names, phone numbers, notes, staff identities, estimate line items,
  or the full address when privacy says otherwise.
- **Published snapshots are frozen.** Public reads come from `JobPassport.snapshot`, not live rows.
  Re-publishing creates a new snapshot/version. Unpublishing hides it immediately.
- **Every state change is auditable.** QC completion and passport publish write a `FieldLedgerEntry`
  (append-only convention) with deterministic idempotency keys, so retries never double-write.
- **No new npm dependencies.** Backend uses `node:crypto`; the QR renderer already exists in the
  frontend (`qrcode`). Frontend uses the existing design-system components and Auctum tokens.
- **No docker/git commands for teammates.** The Lead owns rebuilds, commits, release and push.

## 3. Write scopes

| Area | Files | Owner |
|---|---|---|
| Schema + wiring + CI + docs + smoke + release | `backend/prisma/schema.prisma`, `backend/src/routes/index.ts`, `frontend/src/App.tsx`, `.github/workflows/**`, `docs/**`, `scripts/smoke.ps1`, `package.json` versions | **Lead** |
| QC + passport backend | `backend/src/services/passport/**`, `backend/src/routes/passport.routes.ts`, `backend/src/routes/publicPassport.routes.ts`, `backend/src/scripts/seedDemo.ts` (additive) | **backend-qc** |
| QC + passport UI | `frontend/src/types/passport.ts`, `frontend/src/services/passport.ts`, `frontend/src/components/passport/**`, `frontend/src/pages/PublicPassport.tsx`, `frontend/src/pages/JobDetail.tsx` (additive tab) | **frontend-qc** |
| Verification | builds, tests, live smoke, screenshots | **Lead** |

Stubs already exist and are mounted by the Lead; replace their bodies, keep the route table.

## 4. Data model (already pushed to the local dev DB)

```prisma
enum QcStatus { DRAFT PASSED FAILED }
enum PassportPrivacy { EXACT STREET_ONLY HIDDEN }

model JobQcRun {
  id String @id @default(uuid())
  companyId String
  jobId String
  phase JobPhase
  status QcStatus @default(DRAFT)
  items Json @default("[]")      // [{key,label,required,requiresPhoto,passed,note,photoUrls[]}]
  score Int @default(0)          // 0-100, required items only
  notes String?
  completedByUserId String?
  completedAt DateTime?
  createdByUserId String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  job Job @relation(fields: [jobId], references: [id], onDelete: Cascade)
  @@index([companyId, jobId, createdAt])
  @@index([companyId, status])
}

model JobPassport {
  id String @id @default(uuid())
  companyId String
  jobId String @unique
  slug String @unique             // unguessable, e.g. 10-char Crockford base32
  enabled Boolean @default(false)
  privacy PassportPrivacy @default(STREET_ONLY)
  headline String?
  summary String?
  heroPhotoUrl String?
  snapshot Json?                  // frozen public payload (see §6)
  contentDigest String?           // sha256Hex(canonicalJson(snapshot))
  version Int @default(1)
  publishedAt DateTime?
  unpublishedAt DateTime?
  lastPublishedByUserId String?
  createdByUserId String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  job Job @relation(fields: [jobId], references: [id], onDelete: Cascade)
  @@index([companyId, enabled])
}
```

`Job` already has `qcRuns JobQcRun[]` and `passport JobPassport?`.

## 5. QC templates (backend owns the canonical list)

> **Flag semantics:** every item is **required** unless a template explicitly marks it optional in a later
> revision. The `(photo)` marker means `requiresPhoto: true` — that item cannot pass without at least one
> photo URL. This keeps scoring and completion meaningful for all five phases.

Required/photo flags are part of the contract; frontend renders whatever the API returns.

| Phase | Items (key · label · flags) |
|---|---|
| `INSPECTION` | `access_safety` Roof access and fall protection verified · `attic_ventilation` Attic and ventilation inspected · `damage_photos` Damage documented in dated photos (required, photo) · `measurements` Measurements taken or aerial report attached · `homeowner_consent` Homeowner consent captured |
| `ESTIMATE` | `scope_matches_damage` Scope matches documented damage (photo) · `line_items_priced` Every line item has cost and price · `exclusions_stated` Exclusions and assumptions stated · `supplement_path` Supplement/change-order path explained · `proposal_ready` Proposal ready for signature |
| `PRODUCTION` | `tear_off` Tear-off complete and deck inspected (photo) · `underlayment` Underlayment installed to spec · `flashing` Flashing and penetrations sealed · `ventilation` Ventilation balanced · `site_cleanup` Site cleaned and debris removed (photo) |
| `INVOICING` | `final_photos` Final photo set captured (photo) · `final_qc` Final QC run passed · `change_orders` Change orders signed · `invoice_matches_contract` Invoice matches contract · `lien_waiver` Lien waiver ready |
| `COMPLETED` | `warranty_issued` Warranty issued to homeowner (photo) · `walkthrough` Homeowner walkthrough completed · `maintenance_guide` Maintenance guide shared · `review_requested` Review requested |

Each item in a run snapshot also carries `passed: boolean`, optional `note`, and `photoUrls: string[]`.
`requiresPhoto` items must have ≥1 photo URL to pass.

## 6. API contract

All protected routes are behind the global JWT `authMiddleware` and tenant-scoped by `req.user.companyId`.
Errors use `{ error, code? }`; UUID params validated; 404 for cross-tenant resources. Public routes are
rate-limited.

### QC (mounted at `/api/v1/jobs`)

| Method & path | Body | Response |
|---|---|---|
| `GET /:jobId/qc` | — | `{ data: QcRun[], templates: QcTemplate[], summary: { passedRuns, totalRuns, percent } }` |
| `POST /:jobId/qc` | `{ phase: JobPhase }` | `201 { run: QcRun }` (creates a DRAFT from the template; 409 if a DRAFT for that phase already exists) |
| `PATCH /:jobId/qc/:runId` | `{ items?: Array<{key,passed,note?,photoUrls?}>, notes?: string }` | `{ run: QcRun }` (DRAFT only; unknown keys rejected/ignored) |
| `POST /:jobId/qc/:runId/complete` | `{ notes?: string }` | `{ run: QcRun, ledgerReceipt: { id, kind, description, createdAt } }` (PASSED when all required items pass and photos satisfy; otherwise FAILED) |

`QcRun`: `{ id, jobId, phase, status, items, score, notes, completedByUserId, completedAt, createdByUserId,
createdAt, updatedAt }`.
`QcTemplate`: `{ phase, label, items: Array<{ key, label, required, requiresPhoto }> }`.

### Passport (mounted at `/api/v1/jobs`)

| Method & path | Body | Response |
|---|---|---|
| `GET /:jobId/passport` | — | `{ passport: Passport | null, publicPath }` (`publicPath` is `/p/<slug>` when enabled) |
| `POST /:jobId/passport/publish` | `{ privacy?, headline?, summary?, heroPhotoUrl? }` | `{ passport, publicPath, contentDigest, ledgerReceipt }` (creates if absent; increments version; 400 if nothing publishable) |
| `PATCH /:jobId/passport` | `{ privacy?, headline?, summary?, heroPhotoUrl?, enabled? }` | `{ passport }` (`enabled:false` unpublishes: clears `publishedAt`, sets `unpublishedAt`) |
| `POST /:jobId/passport/unpublish` | — | `{ ok: true }` |

`Passport` (admin view): all model fields except `snapshot`; include `publicPath` when enabled.

### Public (mounted at `/api/v1/public/passport`, no auth)

| Method & path | Response |
|---|---|
| `GET /:slug` | `{ data: PublicPassport }` (404 if unknown/disabled; 60 req/min per IP) |
| `GET /:slug/verify` | `{ verified: boolean, contentDigest: string, algorithm: 'SHA-256', canonical: 'auctum.passport.v1', checkedAt, ledger: Array<{id,kind,description,createdAt}> }` |

`PublicPassport` (exact shape — frontend builds against this):

```ts
interface PublicPassport {
  slug: string;
  version: number;
  publishedAt: string;
  headline: string;
  summary: string | null;
  company: { name: string; phone: string | null; logoUrl: string | null };
  job: {
    name: string;
    phase: string;
    status: string;
    completedAt: string | null;
    propertyAddress: string | null;   // null when privacy = HIDDEN
    photoCount: number;
  };
  photos: Array<{ url: string; name: string }>;
  materials: Array<{ name: string; quantity: number; unit: string; supplierName: string; status: string }>;
  estimates: { count: number; approvedTotal: number };
  qc: Array<{
    phase: string; status: string; score: number; completedAt: string | null;
    items: Array<{ label: string; passed: boolean }>;
  }>;
  ledger: Array<{ kind: string; description: string; at: string }>;
  verify: { digest: string; algorithm: 'SHA-256'; canonical: 'auctum.passport.v1' };
}
```

**Privacy rules:** `EXACT` → full address; `STREET_ONLY` → address up to the first comma (e.g. `700 Heritage Pkwy`);
`HIDDEN` → `null`. Only `Document.fileType = PHOTO` rows are exposed (max 12, newest first). Estimate
line items, customer names, notes, staff users and internal IDs are never exposed.

**Digest:** `sha256Hex(canonicalJson(snapshot))` using the existing helpers in
`backend/src/services/field/evidence.ts`. Public verify recomputes it from the stored snapshot.

## 7. Frontend contract

- `services/passport.ts` wraps the endpoints with the existing axios `api` client and typed helpers;
  errors bubble as `AxiosError`; offline/404 states handled in components.
- `QcPanel` — phase sections with status chips, progress, checklist toggles, note field, photo-evidence
  picker fed by the job's PHOTO documents, Run/Complete actions, loading/error/empty states. Uses
  `Card`, `Button`, `Badge`, `Input`, Auctum tokens; 44px targets; keyboard operable.
- `PassportPanel` — publish/unpublish, privacy select (`EXACT` / `STREET_ONLY` / `HIDDEN`), headline,
  summary, hero photo select, version/digest, copy link, QR (client-side `QRCode.toDataURL`), link to
  the public page. Admin-only mutations (OWNER/MANAGER) with read-only view otherwise.
- `JobDetail.tsx` gains one tab: **QC & Passport** (`value="qc"`), without changing existing tabs.
- `PublicPassport` (`/p/:slug`, public route, no Layout) — Auctum branded, verified seal, digest +
  verify badge, photos grid, QC summary, materials, ledger receipts, privacy-respecting address, CTA
  (call company), print-friendly, `noindex` meta, 404 state.
- Tests: Vitest for pure helpers + component render states (mocked API). No new dependencies.

## 8. Seed data (backend-qc, additive to `seedDemo.ts`)

- 3 QC runs on demo jobs: one `PASSED` on a production job, one `FAILED` draft set, one `DRAFT`.
  Use existing demo photo document URLs for photo evidence where required.
- 1 published passport on a demo job (privacy `STREET_ONLY`, version 1, digest computed via the service)
  so the public URL works immediately after `npm run seed:demo`.
- Re-seeding must delete the demo company's `JobQcRun` / `JobPassport` rows before recreating, and the
  seed result should report `qcRuns` and `passports` counts.

## 9. Done criteria

- [ ] `cd backend && npx tsc --noEmit` clean; `npm test` green (new passport tests included).
- [ ] `cd frontend && npx tsc --noEmit` clean; `npx vitest run` green; `npx vite build` succeeds.
- [ ] Local API smoke: create QC run → patch items → complete (ledger entry written) → publish passport
      → public GET returns sanitized snapshot → verify returns `verified:true` → tamper check fails.
- [ ] No new npm dependencies; no schema changes outside the Lead-owned models; no secrets in responses.
- [ ] Report: files, commands, evidence (HTTP statuses/JSON), risks.

## 10. Environment notes

- Local dev API: `cd backend && npx tsx src/server.ts` (uses `backend/.env`, DB `localhost:5432`,
  Redis `localhost:6379`). The current live deployment is the portal stack (`fieldwright-atlas`
  project, web :3100, API :5100, DB :5435); the Lead rebuilds it after code lands.
- Prisma client is generated from the new schema; if you edit the schema (you must not), tell the Lead.
