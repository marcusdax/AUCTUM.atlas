---
surface: marketing
mode: Persuade
secondaryMode: Operate
routes:
  - /m/:code
  - /marketing
files:
  - frontend/src/pages/marketing/ScanLanding.tsx
  - frontend/src/pages/marketing/MarketingStudio.tsx
  - frontend/src/pages/marketing/PieceSvg.tsx
  - frontend/src/pages/marketing/templates.ts
---

# Surface Brief: QR Scan Landing & Marketing Studio

## Modes
- **QR Scan Landing (`/m/:code`):** **Persuade** — Mobile-first unauthenticated homeowner intake page reached by scanning a printed yard sign, door hanger, or storm mailer.
- **Marketing Studio (`/marketing`):** **Operate** — Contractor workspace for creating, previewing, printing, and tracking QR marketing pieces and scan-to-lead attribution.

## Purpose & User Goals
- **Homeowner (`/m/:code`):** Standing on their porch or driveway after a storm, confirm the contractor is real, tap to call immediately, or submit an inspection request in under 30 seconds.
- **Sales / Marketing Lead (`/marketing`):** Generate branded print pieces with unique tracking codes, download print-ready SVGs, and measure scans vs. leads created.

## Design Direction & Rules
- **Scan Landing (`/m/:code`):**
  - Preserve the contractor's custom brand `primary` and `accent` colors in the hero header, computing accessible foreground text via `textOn()`.
  - Set the headline in `font-display` (Fraunces) with tight editorial tracking, paired with AUCTUM parchment ground (`bg-parchment`), sharp `2px` (`rounded-sm`) inputs/buttons, and `min-h-[44px]` touch targets.
  - Keep the phone CTA prominent above the fold and the inspection request form effortless (name, property address, phone or email, explicit consent, hidden honeypot).
  - Include a subtle, trust-building "Verified intake · AUCTUM" hairline footer without competing with the contractor's own brand.
- **Marketing Studio (`/marketing`):**
  - Clean split between piece builder controls, live SVG print preview, and scan/lead attribution table using `.stat-mono` counts.

## Guardrails
- `/m/:code` must use plain `fetch()` to `/api/v1/public/m/:code` so staff auth tokens or redirects never interfere.
- Preserve honeypot anti-spam field and explicit homeowner contact consent checkbox.
