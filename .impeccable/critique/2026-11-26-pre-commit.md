---
target: AUCTUM.atlas (All Priority Surfaces)
date: 2026-11-26
mode: Mixed (Operate / Experience / Persuade)
status: pre-commit
---

# Impeccable Critique Report — AUCTUM.atlas (Pre-Commit)

> Combined assessment following Impeccable's two-lens critique methodology: **Design Review** (task flow, hierarchy, craft, product fit) + **Automated Pattern Checks** (tokens, contrast, touch targets, geometry).
> *Limitation note:* Automated checks were run via static source inspection, `tsc --noEmit`, `vitest`, and `vite build` rather than a live headless browser extension scan.

## Usability Scores (0–4 Scale)

| Check | Score | Max | Notes |
| --- | --- | --- | --- |
| Task Clarity & Reading Order | 3.0 | 4 | Core workflows are clear, but `Portal.tsx` and `StormTracking.tsx` still read as flat utility boxes rather than signature domain instruments. |
| Visual Hierarchy & Contrast | 3.5 | 4 | Parchment/ink contrast passes WCAG AA; `JobDetail` `ProfitMetrics` and `Button`/`Badge` tokens are now aligned. |
| Mobile Ergonomics & Touch Targets | 3.5 | 4 | Header controls, `PhaseProgression`, `Portal` CTAs, and `ScanLanding` inputs now enforce `44–48px` targets; `EstimateBuilder` line-item editing still needs a mobile card pass. |
| Brand Distinctiveness & Craft | 2.5 | 4 | Clean hairline foundation, but lacks the tactile depth (woven ink ground + parchment dossier cards) and technical blueprint authority (numbered drafting ruler, title block, causal storm-to-cash trace) seen in top-tier reference work. |
| **Total** | **12.5** | **16** | Strong functional baseline; biggest upside is elevating visual signature on Hero/Portal/Command and Public Passport surfaces. |

## Strengths to Preserve

1. **Authentic AUCTUM Palette:** Parchment (`#F1F2EA`), Forest Ink (`#17231D`), Oxblood (`#8C2F22`), and Brass/Gold (`#CB8622`) are cohesive and distinct from generic SaaS templates.
2. **Honest Telemetry:** Hardcoded notification badge (`3`) removed from `Layout.tsx`; storm count now reflects live `/storms/active` state.
3. **Zero-AI-Key Resilience:** Deterministic risk scores, NOAA overlays, and SHA-256 Job Passports work without external AI credentials.
4. **Sharp 2px Geometry:** Flat hairline borders across `Button`, `Card`, `Dashboard`, `StormTracking`, `Jobs`, and `EstimateBuilder` eliminate generic rounded-pill bloat.

## Priority Findings

### Finding 1 — Design Review: Portal & Command Hero Lack Signature Domain Craft
- **Location:** `frontend/src/pages/Portal.tsx`, `frontend/src/pages/StormTracking.tsx`
- **Issue:** Both surfaces present high-value geospatial & operational intelligence inside plain rectangular boxes without architectural framing or visual proof of how storm data flows to revenue.
- **Suggested Direction (Tortuga-inspired Blueprint):** Frame the Command / Portal hero with a deep forest-ink technical drafting board (`#132C20`), numbered coordinate ruler (`1–8`), engineering title block (`TITLE | DWG NO. | REV`), and an interactive lit amber/oxblood causal trace (`NOAA Swath → Flagged Leads → Roof Measure → Estimate → Job Passport`).

### Finding 2 — Design Review: Public Passport & Marketing Surfaces Need Tactile Paper Contrast
- **Location:** `frontend/src/pages/PublicPassport.tsx`, `frontend/src/pages/marketing/ScanLanding.tsx`
- **Issue:** Parchment-on-parchment feels flat on unauthenticated homeowner surfaces where immediate trust and tangibility drive conversion.
- **Suggested Direction (Otterly-inspired Tactile Dossier):** Place crisp archival parchment record cards and stamped QC index slips on a subtly textured deep forest-ink backdrop with a warm brass/gold primary CTA and oxblood hairline footer rule.

### Finding 3 — Automated Check: Legacy Token File Still Present in Repo
- **Location:** `frontend/src/design-tokens.json`
- **Issue:** Outdated `ORBITAL INTELLIGENCE` dark-neon tokens (`Space Grotesk`, `Inter`, HSL-217 cyan, `16px` radii) remain on disk and could confuse future contributors or automated detectors.
- **Suggested Fix:** Replace or remove `frontend/src/design-tokens.json` once confirmed unused by Storybook/Loki, keeping `.impeccable/design.json` + `src/styles/index.css` as the sole source of truth.

### Finding 4 — Mobile Audit: EstimateBuilder Line-Item Table on Narrow Viewports
- **Location:** `frontend/src/pages/estimates/EstimateBuilder.tsx`
- **Issue:** Wide multi-column line-item inputs require horizontal scrolling on phones (`< 640px`).
- **Suggested Fix:** Add stacked mobile line-item cards below `sm:` while keeping the compact `stat-mono` table on desktop.
