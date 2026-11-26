---
surface: public-passport-and-portal
mode: Experience
secondaryMode: Persuade
routes:
  - /p/:slug
  - /portal
files:
  - frontend/src/pages/PublicPassport.tsx
  - frontend/src/pages/Portal.tsx
---

# Surface Brief: Public Job Passport & Partner Portal

## Modes
- **Public Job Passport (`/p/:slug`):** **Experience** — An authoritative, print-ready, unauthenticated verification record showcasing completed craftsmanship, Install QC sign-offs, materials, and SHA-256 tamper-evident proof.
- **Partner Portal (`/portal`):** **Persuade** — A calm, transparent public entry point explaining Fieldwright Field Hub + AUCTUM.atlas, showing live stack telemetry, and offering one-click demo launch or registration.

## Purpose & User Goals
- **Homeowner / Adjuster / Property Buyer (`/p/:slug`):** Immediately verify that the record is authentic (SHA-256 match), browse install photos and QC sign-offs, and print/save a clean PDF copy.
- **Design Partner / Evaluator (`/portal`):** Understand the two connected surfaces, confirm the stack is live, and enter either surface in one click.

## Design Direction & Rules
- **Public Passport:** Always renders in archival parchment (`bg-parchment text-ink`) with crisp print fidelity (`print:bg-white`), Fraunces display typography, circular `brand-seal`, hairline dividers, and monospace SHA-256 verification stamp. No app sidebar, no login nags, and `<meta name="robots" content="noindex">` while mounted.
- **Partner Portal:** Lead with outcome-first Fraunces headline, live stack health telemetry in a compact hairline panel, side-by-side comparison cards for Fieldwright Hub and AUCTUM.atlas, and unambiguous primary CTAs (`rounded-sm`, ink fill, parchment text).

## Guardrails
- Never leak staff PII or internal notes on `/p/:slug`; respect address privacy (`exact`, `street-only`, `hidden`).
- Keep print button, retry states, and demo buttons ≥ 44px tall for mobile ergonomics.
