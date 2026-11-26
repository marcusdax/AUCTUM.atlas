# Job Passport & Install QC — operator guide

**What this is.** A Job Passport is an opt-in, public, tamper-evident record of one completed (or
in-progress) roofing job: the QC sign-offs, photos, materials, and the ledger receipts that prove the
record has not been altered. Contractors send the link to a homeowner, insurer, realtor or buyer.

It answers the question an AccuLynx-style CRM cannot: *"prove this roof was installed correctly."*

---

## 1. The workflow

```
Inspection QC ─▶ Estimate QC ─▶ Production QC ─▶ Invoicing QC ─▶ Completed QC
      │               │               │               │               │
      └───────────────┴───────┬───────┴───────────────┴───────────────┘
                              ▼
                 Ledger receipt per completed run
                              ▼
              Publish Job Passport (opt-in, frozen snapshot)
                              ▼
             /p/<slug>  +  QR code on the invoice / leave-behind
```

1. **Run QC per phase.** On the job page open **QC & Passport**. Each phase has a checklist derived from
   the install SOP (tear-off, decking, underlayment, flashing, final, etc.). Required items must be
   ticked; items marked *photo evidence* need at least one job photo attached.
2. **Complete the run.** If every required item passes (and photos are attached where required) the run
   is `PASSED`; otherwise it is `FAILED` and the outstanding items are visible. Either way an append-only
   ledger receipt is written with a deterministic key so a retry never duplicates it.
3. **Publish the Passport.** Publishing freezes a sanitized snapshot of the job and gives it an
   unguessable slug. Re-publishing later creates a new version; the shared link keeps working.
4. **Share.** Copy the link or print the QR from the passport panel. The public page needs no login.

## 2. Privacy model

Publishing is a deliberate action per job. Default privacy is **street only** — enough to recognise the
property, not enough to expose the household.

| Privacy setting | Address shown publicly |
|---|---|
| `EXACT` | Full property address |
| `STREET_ONLY` (default) | Street line only, e.g. `700 Heritage Pkwy` |
| `HIDDEN` | No address; "Location shared on request" |

**Always exposed:** job name, phase/status, completed date, company name/phone/logo, QC sign-off summaries,
photos, materials, estimate count + approved total, ledger receipt summaries, content digest.

**Never exposed:** customer name, email, phone, internal IDs, job notes, staff identities, estimate line
items, change-order text, documents other than photos, unpublished jobs.

If a passport is published and later unpublished, the public URL returns 404 immediately; the frozen
snapshot and ledger history remain in the database for audit.

## 3. Verification (why it is trustworthy)

- The public payload is a **frozen JSON snapshot** stored in `JobPassport.snapshot`; public reads never
  query live rows, so a shared link cannot silently change.
- The snapshot digest is `SHA-256(canonical JSON)` using the platform's canonical-JSON helper.
- `GET /api/v1/public/passport/<slug>/verify` recomputes the digest from the stored snapshot and returns
  `verified: true|false`, the digest, and the ledger entries for the job. If anyone edits the snapshot in
  the database, verification fails.
- Each QC completion and each publication writes a `FieldLedgerEntry` (append-only convention, unique
  idempotency key) with actor, timestamp and description.

> This is **tamper-evident, not magic**: it proves the record stored by AUCTUM.atlas has not changed since
> publication. Third-party transparency anchoring (e.g. Rekor) is available in the Field Hub provenance
> chain; the passport itself makes no external attestation claim.

## 4. For operators

- **Prerequisites:** job photos uploaded to the job (`PHOTO` documents); materials and estimates recorded
  if you want them on the passport.
- **Permissions:** publishing/unpublishing is restricted to `OWNER` and `MANAGER` in the UI; the API
  accepts any authenticated company member for QC runs, and the passport mutation endpoints require the
  same role gate as the rest of the job admin surface.
- **Re-publishing:** use *Publish update* after adding photos or completing another QC phase. Version
  increments; the digest changes; the old link still resolves to the latest published version.
- **Unpublishing:** use *Unpublish*; the public route 404s. The row is retained so you can re-publish
  without losing the slug.
- **Deleting a job** cascades to its QC runs and passport (database-level cascade).

### API quick reference

```powershell
$t = (Invoke-RestMethod -Method Post -Uri http://localhost:5100/api/v1/auth/login `
  -ContentType 'application/json' -Body '{"email":"demo@roofprocrm.com","password":"RoofPro!2026"}').accessToken
$h = @{ Authorization = "Bearer $t" }

# QC
Invoke-RestMethod -Uri "http://localhost:5100/api/v1/jobs/$jobId/qc" -Headers $h          # templates + runs
Invoke-RestMethod -Method Post -Uri "http://localhost:5100/api/v1/jobs/$jobId/qc" -Headers $h `
  -ContentType 'application/json' -Body '{"phase":"PRODUCTION"}'
Invoke-RestMethod -Method Post -Uri "http://localhost:5100/api/v1/jobs/$jobId/qc/$runId/complete" -Headers $h

# Passport
Invoke-RestMethod -Method Post -Uri "http://localhost:5100/api/v1/jobs/$jobId/passport/publish" -Headers $h `
  -ContentType 'application/json' -Body '{"privacy":"STREET_ONLY"}'
Invoke-RestMethod -Uri "http://localhost:5100/api/v1/public/passport/$slug"               # no auth
Invoke-RestMethod -Uri "http://localhost:5100/api/v1/public/passport/$slug/verify"        # no auth
```

## 5. Known limits

- QC templates are fixed in code for this sprint; per-company custom checklists are a follow-up.
- Photo evidence references existing job uploads; there is no client-side camera capture inside the QC
  form yet (the Field Hub camera flow remains separate).
- Passport photos are file URLs served by the API; production deployments should move uploads to
  S3-compatible storage + CDN (see `docs/LIMITS.md`).
- The passport is not an insurance report, inspection certification or legal warranty; it is a verifiable
  record of the contractor's own QC process.
