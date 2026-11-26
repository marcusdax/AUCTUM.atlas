---
surface: dashboard
mode: Operate
routes:
  - /
  - /dashboard
files:
  - frontend/src/pages/Dashboard.tsx
  - frontend/src/components/Layout.tsx
  - frontend/src/components/intelligence/DashboardCommandCenter.tsx
---

# Surface Brief: Dashboard & Navigation Shell

## Mode
**Operate** — Morning triage and rapid routing across active storms, leads, jobs, crew schedule, and Job Feed activity.

## Purpose & User Goals
- **Owner / GM:** Assess active storm exposure, pipeline volume, and recent team activity in under 15 seconds.
- **Dispatcher / PM:** Jump directly into severe weather alerts, today's inspections, or urgent job threads without hunting through menus.
- **Field Operator (mobile):** Reach active jobs, storm map, or search with one thumb and legible contrast in daylight.

## Design Direction & Rules
- Lead with live, real data from `/storms/active`, `/leads`, `/jobs`, `/calendar`, and `/feed`. Never display hardcoded counts (e.g., static notification badges) when live query data is available.
- Keep KPI readouts in `.stat-mono` (`IBM Plex Mono`, `tabular-nums`) with hairline card divisions and clear trend context.
- Navigation rail (`Layout.tsx`) separates **Operations** (Storm Map, Field Hub, Spaces, Leads, Jobs, Marketing) from **Office & Ledger** (Dashboard, Estimates, Calendar, Documents, Reports, Portal, Settings).
- Mobile shell must show the AUCTUM wordmark/current route context in the top bar, provide ≥ 44×44px touch targets for menu/theme/alert controls, and keep search accessible on small screens.

## Guardrails
- No decorative dashboard bloat or pulsing pills above the greeting.
- Preserve parchment default and `[data-theme="dark"]` ink parity across sidebar, header, cards, and footer.
