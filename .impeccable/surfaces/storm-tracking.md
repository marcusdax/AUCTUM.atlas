---
surface: storm-tracking
mode: Operate
routes:
  - /storm-tracking
  - /command
files:
  - frontend/src/pages/StormTracking.tsx
  - frontend/src/components/StormMap.tsx
  - frontend/src/components/ai/StormBriefCard.tsx
  - frontend/src/components/ai/MapCopilot.tsx
  - frontend/src/components/ai/LeadImpactCard.tsx
---

# Surface Brief: Storm Tracking & Map Copilot

## Mode
**Operate** — Real-time spatial triage during and after NOAA/NWS weather events.

## Purpose & User Goals
- **Dispatcher / Storm Manager:** Filter extreme/severe hail and wind warnings, inspect affected polygons, and identify which leads or properties to call first.
- **Sales Rep:** Ask the Map Copilot natural-language questions ("show extreme tornado warnings", "find leads inside the hail swath") and immediately act on highlighted leads.

## Design Direction & Rules
- Map canvas is the primary focal point; overlay controls, severity legends, and AI cards must frame the map cleanly without obscuring active polygons.
- Severity hierarchy uses the AUCTUM seal palette exclusively: `Extreme` (oxblood `#8C2F22`), `Severe` (review gold `#7E5415`), `Moderate` (amber `#CB8622`), `Minor` (teal `#1A6666`).
- Deterministic storm overview and NOAA overlays always render first; AI Storm Brief and Map Copilot degrade gracefully with an explicit "AI offline" state when no provider key is configured.
- Deep-linked leads (`?leadId=`) and clicked coordinates surface the Lead Impact Card immediately with clear dismiss/reset controls.

## Guardrails
- Never execute raw LLM text on the map; only validated `MapCopilotPlan` objects mutate filters, focus, and overlays.
- Leaflet controls and popups inherit parchment/ink hairline styling (`styles/index.css`) with sharp `2px` corners.
