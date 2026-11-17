# RoofPro CRM — expansion concept: AUCTUM tools + open-source building blocks

Status: concept for discussion (2026-11-17). Nothing here is built yet. Each idea names the RoofPro code
it extends, what it borrows from auctum.coffee, and any GitHub project that could shorten the work.
Repo facts (stars, license, last push) were read from the GitHub API on 2026-11-17.

## 1. What carries over from AUCTUM, and what does not

AUCTUM.coffee organises coffee tools by "door": farm, roastery, café and cup. Each box opens onto the next and
connects to a public, verifiable record. RoofPro has the same chain with different names:

| AUCTUM | RoofPro equivalent |
|---|---|
| Farm logs the lot | Canvasser or inspector logs the lead and the damage |
| Roastery verifies and versions | Office builds and versions the estimate and change orders |
| Café buys verified and prints a table QR | Crew installs, closes QC, and leaves a QR on the job |
| Cup scans the QR and sees the story, no sign-in | Homeowner, insurer or buyer scans and sees the verified job record |

**Principles to keep.** These are what make AUCTUM credible, not decoration:

- No paid rank and no boosts. Badges are earned and never change a price.
- Every tool states who it is for, what it costs and its limits ("advisory, not a lab diagnosis").
- Claims go to an append-only record anyone can check.

## 2. Feature map — AUCTUM tool → RoofPro feature

| # | AUCTUM tool | RoofPro feature | Builds on (existing code) | Value |
|---|---|---|---|---|
| 1 | **Marketing Studio** (posters and signs with your logo, colors and a scannable link, made on the device) | **Marketing Studio**: yard signs, door hangers, storm-response flyers, truck magnets and leave-behinds. Uses company branding, and every printed piece has its own QR code | `Company` settings, `StormEvent`, `PdfService` (pdfkit) | Every piece is tracked: a scan creates a lead tagged with that campaign and piece |
| 2 | **Sales Funnel** (attract, capture, nurture, convert, retain, refer) | **Funnel board** across the whole loop, with QR landing capture, email/SMS nurture sequences and attribution | `Lead.source`, `/leads/pipeline`, `Notification` | Closes the gap where SMTP, Twilio and web-push are "not configured" |
| 3 | **Trust ledger** + Cup QR | **Job Passport**: a public page per job (photos, materials, QC sign-offs, permit, warranty) in an append-only ledger. No sign-in to view | `FieldLedgerEntry`, `FieldEvidencePacket`, `Document`, Fieldwright's RFC 6962 Merkle code | A home-sale and insurance asset; a selling point no AccuLynx-style CRM has |
| 4 | **QC SOP forms** | **Install QC checklists**. Each phase (tear-off, decking, underlayment, flashing, final) closes with a form plus photos, written to the Passport | `JobPhase`, `Document` | QC becomes a procedure, not a promise; fewer callbacks |
| 5 | **Partner program** + affiliate links | **Referral program** for homeowners, realtors and insurance agents. Qualified referrals earn a credit or a bounty, and every link says who earns | `Lead.source = REFERRAL` | Lowest-cost lead source; fully attributable |
| 6 | **Opportunity board** + **credential ladder** | **Sub and crew board**: post open jobs, qualified subs apply, the contractor picks. The Listed → Qualified → Proven → Partner ladder is earned from completed jobs and QC passes, never bought | `Subcontractor`, `SubcontractorAssignment` | Fills crews after a storm without ranking games |
| 7 | **Fermentation capacity calendar** | **Crew capacity calendar**: weekly slots in squares per day per crew. The office sees free capacity and holds or books it | `/calendar/availability`, `CalendarEventAssignee` | Fills the "availability heatmap" gap on the roadmap |
| 8 | **Crop Health** (photo → same-minute read with severity) | **Roof photo triage**: hail and wind indicators with severity, labelled advisory | `Document` uploads, `services/ai` | Faster inspections; flags photos worth a closer look |
| 9 | **Field Intelligence** | Already strong (NOAA, impact scoring). Add **hail-swath history** and **canvass routing** | `services/storm/*`, `/maps/*` | Plans door-knocks by route, not by guesswork |
| 10 | **Export Readiness** | **Claim packet readiness**: a checklist of what an adjuster needs, then download the packet | `Estimate`, `ChangeOrder`, `Document` | Fewer supplement round-trips |
| 11 | **Circles** + **House box** | **Maintenance club**: annual inspection subscriptions, with members redeeming visits by QR | `CalendarEvent`, `Company` | Recurring revenue between storms (billing is still deferred, see §4) |
| 12 | **Pickup scanner** | **Delivery and dumpster check-in**: crew scans the material-order QR on site | `MaterialOrder` | Proof of delivery; fewer disputes with suppliers |
| 13 | **Learn** + cupper credential | **Crew training tracks** with completions that feed the credential ladder | new | Onboarding for storm-season hires |
| 14 | **Feed camera** | Camera straight into a Job Feed post, plus scan a job QR to attach | `JobFeed`, PWA | Fewer taps in the field |

## 3. GitHub building blocks

How licenses are treated:

- **MIT, Apache, BSD and MPL** can be embedded in the product.
- **AGPL** can be run as a separate, unmodified service behind an API. If modified and offered over a network, the source must be published.
- **Source-available** licenses (n8n's Sustainable Use License, Sentry's FSL, BSL, "EE" directories) are not embedded in the product. Check each one before using it.

### 3a. For the AUCTUM features

| Need | Project | ★ | License | Use it for |
|---|---|---|---|---|
| Design canvas for Marketing Studio | [fabricjs/fabric.js](https://github.com/fabricjs/fabric.js) | 31.6k | MIT | In-browser editor for signs and door hangers (on-device, like AUCTUM) |
| Alternative canvas | [konvajs/konva](https://github.com/konvajs/konva) | 15.0k | MIT | Same purpose; react-konva fits the React frontend |
| Ready-made editor to fork or learn from | [salgum1114/react-design-editor](https://github.com/salgum1114/react-design-editor) | 1.7k | MIT | Reference implementation on top of fabric.js |
| Branded QR codes | [kozakdenys/qr-code-styling](https://github.com/kozakdenys/qr-code-styling) | 3.0k | MIT | Logo-in-QR in the company's colors |
| Print-ready PDF templates | [pdfme/pdfme](https://github.com/pdfme/pdfme) | 5.1k | MIT | Template designer plus generator for door-hanger and flyer batches |
| Server-side image render | [vercel/satori](https://github.com/vercel/satori) | 14.2k | MPL-2.0 | Social and share images of a Job Passport |
| Email templates | [resend/react-email](https://github.com/resend/react-email) | 20.0k | MIT | Nurture-sequence emails as React components |
| Email editor for staff | [arikchakma/maily.to](https://github.com/arikchakma/maily.to) | 4.0k | MIT | Non-developers edit nurture emails |
| Multi-channel notifications | [novuhq/novu](https://github.com/novuhq/novu) | 40.3k | MIT core, enterprise dir commercial | Email, SMS, push and in-app from one workflow; fills the transport gap |
| Newsletter (optional) | [knadh/listmonk](https://github.com/knadh/listmonk) | 24.4k | AGPL-3.0 | Separate service for the storm-season newsletter list |
| Referral short links | [dubinc/dub.link](https://github.com/dubinc/dub.link) | 25.2k | AGPL, plus commercial dirs | Probably build in-house instead: referral codes are a small feature |
| Photo detection tooling | [roboflow/supervision](https://github.com/roboflow/supervision) | 51.7k | MIT | Pipeline utilities for the photo-triage model |
| Detection model | [ultralytics/ultralytics](https://github.com/ultralytics/ultralytics) | 63.5k | **AGPL-3.0** | Only via its commercial license, or run as a separate service; do not embed |
| Photo markup | [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | 135.9k | MIT | Annotate damage photos (fills the server-side annotation gap) |
| Canvass route optimisation | [VROOM-Project/vroom](https://github.com/VROOM-Project/vroom) | 1.9k | BSD-2 | Order door-knocks and inspections by drive time |
| Geo maths | [Turfjs/turf](https://github.com/Turfjs/turf) | 10.6k | MIT | Swath intersects, buffers, canvass polygons |
| Swath and heat layers | [visgl/deck.gl](https://github.com/visgl/deck.gl) | 14.8k | MIT | Hail-swath heatmaps over the storm map |
| Offline-first writes | [pubkey/rxdb](https://github.com/pubkey/rxdb) | 23.4k | Apache-2.0 | QC forms and photos captured with no signal (fills the PWA "offline writes" gap) |
| Verifiable log, if outside verification is needed later | [google/trillian](https://github.com/google/trillian) | 3.8k | Apache-2.0 | Start with the in-house RFC 6962 Merkle code; Trillian only at scale |

**Roofing-specific repos are not worth adopting.** Searches for roof damage, hail damage, roof segmentation
and roofing estimates found no project above about 15 stars; most have no license and are school projects.
The one interesting dataset, [jrbell1/hwds_db](https://github.com/jrbell1/hwds_db) (a 21-year hail and wind
damage swath climatology), has **no license**. Ask the author before using it. The photo-triage model has to
be trained on RoofPro's own labelled photos.

### 3b. For the blueprint gaps already listed in `BLUEPRINT_COVERAGE.md`

| Gap (status today) | Project | ★ | License | Note |
|---|---|---|---|---|
| Digital signature ⬜ | [docusealco/docuseal](https://github.com/docusealco/docuseal) or [documenso/documenso](https://github.com/documenso/documenso) | 19.1k / 15.8k | AGPL-3.0 | Run as a separate service via its API, or use their hosted API |
| Background jobs 🟡 (in-process only) | [taskforcesh/bullmq](https://github.com/taskforcesh/bullmq) | 9.6k | MIT | Redis is already running; this is the natural fit |
| Zapier / webhooks 🟡 | [activepieces/activepieces](https://github.com/activepieces/activepieces) | 25.6k | MIT, `packages/ee` commercial | Embeddable automation; avoid n8n (Sustainable Use License, not open source) |
| Feature flags ⬜ | [growthbook/growthbook](https://github.com/growthbook/growthbook) | 8.6k | MIT outside enterprise dirs | Or Unleash (AGPL) as a service |
| Full-text search 🟡 | Postgres `tsvector` first; [meilisearch/meilisearch](https://github.com/meilisearch/meilisearch) later | 59.9k | MIT community, enterprise BSL | Do the cheap thing first |
| Custom report builder ⬜ | [cube-js/cube](https://github.com/cube-js/cube) | 21.2k | Apache-2.0 / MIT | Semantic layer; Metabase is AGPL, so only as a separate service |
| E2E tests ⬜ | [microsoft/playwright](https://github.com/microsoft/playwright) | 100.4k | Apache-2.0 | |
| Load tests ⬜ | [grafana/k6](https://github.com/grafana/k6) | 32.3k | AGPL-3.0 | Fine as a tool you run; not shipped in the product |
| Customer portal scheduling ⬜ | [calcom/cal.diy](https://github.com/calcom/cal.diy) | 50.1k | MIT | `calcom/cal.com` now redirects here; confirm what this repo is before relying on it |
| Billing for the Maintenance club | [getlago/lago](https://github.com/getlago/lago) | 10.9k | AGPL-3.0 | Separate service, or Stripe Billing |

## 4. Suggested order

1. **Marketing Studio and funnel capture.** Fabric or Konva editor, branded QR, pdfme batches, QR landing → lead with campaign attribution. This gives the quickest visible win and generates leads directly.
2. **Install QC and the Job Passport.** QC forms per phase, an append-only ledger (reusing `FieldLedgerEntry` and the Fieldwright Merkle code), and a public QR page. This is the differentiator.
3. **Notifications and nurture.** Novu plus react-email, sequences on the funnel board, and BullMQ for scheduling.
4. **Referrals, the sub board and the credential ladder.** These are in-house: small, policy-heavy features where the "no paid rank" rules matter.
5. **Crew capacity, canvass routing and swath layers.** VROOM, Turf and deck.gl.
6. **Claim packet, Maintenance club and photo triage.** These need billing (§3b) and a labelled photo set.

## 5. Open decisions

- **Is the Job Passport public by default, or opt-in per homeowner?** It shows an address and photos of a home. Recommendation: opt-in, with the address shown only to someone holding the QR.
- **Referral payouts: bill credit or cash?** Cash makes it a payments feature, with tax forms. AUCTUM started with bill credit only.
- **Photo triage: build in-house or license?** Ultralytics is AGPL. A commercial license or a hosted vision API avoids AGPL obligations.
- **Do Marketing Studio pieces stay on the device, as on AUCTUM?** Or are templates shared across a company's users? The second needs storage plus permissions.
