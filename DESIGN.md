---
name: AUCTUM × ATLAS Design System
version: "1.2.0"
platform: web
defaultTheme: light
themes:
  - light
  - dark
fonts:
  display: Fraunces
  sans: Archivo
  mono: IBM Plex Mono
colors:
  parchment: "#F1F2EA"
  parchmentDeep: "#D5DAC6"
  parchmentWarm: "#E9E2D6"
  ink: "#17231D"
  inkSoft: "#2A3A32"
  navy: "#1F2E33"
  oxblood: "#8C2F22"
  oxbloodDark: "#7A1F1F"
  sage: "#526055"
  slate: "#536056"
  gold: "#6D592D"
  goldBright: "#CB8622"
  verified: "#27693B"
  review: "#7E5415"
  flagged: "#8C2F22"
  teal: "#1A6666"
radii:
  none: "0"
  sm: "2px"
  default: "2px"
  md: "2px"
  lg: "3px"
  xl: "4px"
  full: "9999px"
fontSizes:
  xs: "0.6875rem"
  sm: "0.8125rem"
  md: "0.875rem"
  base: "1rem"
  lg: "1.125rem"
  xl: "1.25rem"
  2xl: "1.5rem"
  3xl: "1.875rem"
  4xl: "2.25rem"
---

# DESIGN.md — AUCTUM × ATLAS Visual System

> Authoritative design system record for `AUCTUM.atlas`. Grounded in `frontend/src/styles/index.css`, `frontend/tailwind.config.cjs`, and `frontend/src/ui/design/tokens.json`.
> Companion machine metadata: `.impeccable/design.json`.

## 1. Visual Philosophy

AUCTUM.atlas uses the **AUCTUM Estate** design language: archival precision meets field-ready durability. Structure comes from **hairline 1px rules**, **flat parchment surfaces**, **sharp 2px corners**, and **editorial serif + technical monospace typography** — never drop-shadow bloat, frosted-glass neon, or generic SaaS pill clutter.

- **Default theme:** Light ("Parchment", `#F1F2EA`) for outdoor sun legibility in the field and crisp print fidelity on Job Passports.
- **Opt-in dark theme:** Ink ground (`#17231D`, `[data-theme="dark"]`) toggled from the header for low-light truck/dispatch use.
- **Retired legacy tokens:** `frontend/src/design-tokens.json` ("ORBITAL INTELLIGENCE" dark cyan/violet/Space Grotesk) is deprecated and superseded by `frontend/src/styles/index.css`, `frontend/tailwind.config.cjs`, and `.impeccable/design.json`. Do not introduce `Space Grotesk`, `Inter`, neon cyan `#1976D2`/HSL-217 blues, or `12px–16px` card radii.

## 2. Color Palette & Semantic Tokens

### Core Brand Ground (Light — Default)
| Token | CSS Variable | Hex / HSL | Usage |
| --- | --- | --- | --- |
| Parchment | `--paper` / `--background` | `#F1F2EA` (`75 20% 93%`) | Primary page canvas & card ground |
| Raised Parchment | `--background-elevated` | `75 18% 90%` | Sidebar rail, secondary buttons, inputs, table headers |
| Parchment Deep | `--paper-deep` / `--background-accent` | `#D5DAC6` (`84 18% 81%`) | Hover wash, active chips, subtle wells |
| Parchment Warm | `--paper-warm` | `#E9E2D6` | Editorial callouts, print plates |
| Ink | `--ink` / `--text-primary` / `--primary` | `#17231D` (`153 21% 11%`) | Primary copy, display headings, primary action fill |
| Ink Soft | `--ink-soft` / `--primary-hover` | `#2A3A32` (`153 18% 19%`) | Primary button hover, dark accents |
| Sage | `--sage` / `--text-secondary` | `#526055` (`105 9% 34%`) | Secondary body text, metadata |
| Muted Sage | `--text-tertiary` | `110 7% 45%` | Eyebrows, uppercase table headers, timestamps |
| Hairline | `--hairline` / `--border` | `rgb(23 35 29 / 0.14)` (`150 8% 80%`) | Default 1px structural dividers |
| Hairline Strong | `--hairline-strong` / `--border-hover` | `rgb(23 35 29 / 0.28)` (`150 8% 68%`) | Interactive borders, seals, stamps |

### Semantic, Seal & Severity Signals
| Semantic Role | Token | Light Value | Dark Value | Usage |
| --- | --- | --- | --- | --- |
| Verified / Success | `--emerald` / `--seal-verified` | `#27693B` (`139 46% 28%`) | `139 46% 44%` | Passed QC, verified SHA-256 digest, active/won status |
| Review / Severe | `--amber` / `--seal-review` | `#7E5415` (`36 71% 32%`) | `36 62% 52%` | Severe storm alert, pending review, on-hold |
| Moderate / Patron | `--orange` / `--gold-bright` | `#CB8622` (`35 71% 46%`) | `38 78% 58%` | Moderate storm alert, degraded telemetry |
| Flagged / Extreme | `--red` / `--oxblood` | `#8C2F22` (`9 60% 34%`) | `9 72% 58%` | Extreme storm warning, failed QC, destructive actions |
| Info / Minor | `--teal` / `--roaster` | `#1A6666` (`180 59% 25%`) | `180 45% 52%` | Minor alert, live signal indicator |

### Dark Theme (`[data-theme="dark"]`)
- Canvas: `--background: 153 21% 11%` (Ink `#17231D`)
- Elevated / Card: `--background-elevated: 193 25% 16%` (Navy `#1F2E33`)
- Text Primary: `75 20% 93%` (Parchment `#F1F2EA`)
- Primary Action: `9 55% 47%` (Brightened Oxblood) with Parchment foreground (`--primary-foreground`)

> **Rule:** Never hardcode `text-white` on `bg-primary` or `bg-white` on parchment cards (except contractor-branded QR print surfaces where contrast is computed via `textOn()`). Always pair `bg-primary` with `text-[hsl(var(--primary-foreground))]`.

## 3. Typography

| Role | Family | Weights | Usage & Rules |
| --- | --- | --- | --- |
| **Display / Headings** | `Fraunces` (optical serif) | 400, 500, 600, 700 | `h1`, `h2`, `.wordmark`, card titles (`font-display`). Tight tracking `-0.015em`, line-height `1.2`. |
| **UI & Body** | `Archivo` (grotesque sans) | 300, 400, 500, 600, 700 | Body copy, buttons, form controls, navigation (`font-sans`). Line-height `1.5`. |
| **Data, Labels & Stamps** | `IBM Plex Mono` | 400, 500, 600 | `.eyebrow`, `.stat-mono` (`tabular-nums`), table `thead th`, `.stamp`, `.badge`, SHA-256 digests, coordinates. |

### Type Scale
- `xs`: `0.6875rem` (11px) — eyebrows, badges, mono table headers
- `sm`: `0.8125rem` (13px) — compact UI controls, nav items, secondary descriptions
- `md`: `0.875rem` (14px) — standard table cells, inputs
- `base`: `1rem` (16px) — primary reading copy & mobile form inputs (prevents iOS auto-zoom)
- `h1`: `clamp(1.9rem, 1.4rem + 1.6vw, 2.6rem)` — fluid Fraunces page title

## 4. Geometry, Spacing & Elevation

- **Border Radius:** Sharp `2px` (`rounded-sm` / `rounded-md`) for cards, buttons, inputs, badges, and map controls; `3px` (`rounded-lg`) max for large containers; `9999px` only for circular seals (`.brand-seal`), status dots (`StatusDot`), and user initials avatars.
- **Elevation:** Flat by default (`box-shadow: none` or hairline `0 1px 0 rgb(23 35 29 / 0.04)`). Reserve `shadow-lg` / `shadow-xl` strictly for floating overlays (modals, popovers, Leaflet popups).
- **Spacing:** 4px base grid (`--space-1` = 4px through `--space-16` = 64px).
- **Layout Shell:** Header `4rem` (64px), Sidebar `16rem` (256px) expanded / `4rem` (64px) collapsed, max content width `1600px`.
- **Touch Targets:** Minimum `44×44px` (`min-h-[44px] min-w-[44px]`) on mobile interactive controls (header buttons, filters, QR landing CTAs, QC toggles).

## 5. Core Components & Patterns

- **Buttons (`components/ui/Button.tsx`):** Use `variant="primary"` (ink fill, parchment text, flat hairline, no heavy drop shadow) for the single primary action per view; `secondary` (elevated parchment + hairline border) for supporting actions; `ghost` for toolbar icons; `danger` (oxblood) for destructive confirmations.
- **Cards (`components/ui/Card.tsx`):** Flat `bg-[hsl(var(--background-card))]` with `1px` `border-border` and sharp `rounded-sm` corners. Interactive cards transition border/background wash (`hover:border-[hsl(var(--border-hover))] hover:bg-[hsl(var(--background-elevated))]`) — **never** `hover:scale-[1.02]`.
- **Badges & Stamps (`Badge`, `.stamp`):** Monospace uppercase (`IBM Plex Mono`, `0.625rem`, `tracking-[0.08em]`), tinted semantic wash at 10–12% opacity, paired with `StatusDot` when indicating live state.
- **Data Readouts (`.stat-mono`):** Always apply `font-mono tabular-nums` to currency, square footage, storm counts, risk scores, and percentages so columns align cleanly.
- **Brand Signatures:** `AuctumSeal` (circular dashed compass star SVG), `.wordmark` (Fraunces 600), `.eyebrow` (mono uppercase overline), `.rule` (1px horizontal divider), `.auctum-cloth-board` (woven deep forest-ink `#143225` bookcloth fused with 32px technical blueprint grid), `.auctum-dossier` (tactile `#F7F6F0` archival parchment card resting on `.auctum-cloth-board`), and `.auctum-oxblood-trim` (`6px` oxblood heritage bottom bar). Print stylesheets automatically flatten `.auctum-cloth-board` to clean white.

## 6. Motion & Accessibility Rules

- **Timing:** `--duration-fast: 120ms`, `--duration-normal: 200ms`, `--duration-slow: 320ms`.
- **Reduced Motion:** All transitions and animations must respect `motion-reduce:transition-none motion-reduce:animate-none`.
- **Focus:** Global `:focus-visible` uses a `2px solid hsl(var(--primary))` outline with `2px` offset.
- **Forbidden Patterns:**
  - No pulsing "live" biscuit pills above page headlines.
  - No gradient text fills on headlines.
  - No purple-on-dark cyber aesthetics or glowing colored borders.
  - No nested cards deeper than 2 levels.
  - No hardcoded fake badge counts or placeholder telemetry.

## 7. Surface Modes

Each route's brief in `.impeccable/surfaces/` declares its Impeccable mode:
- **Operate** (`dashboard`, `storm-tracking`, `jobs-and-qc`, `estimates-and-leads`, `marketing-studio`): Task-completion speed, scannable tables/lists, clear primary CTA, minimal chrome.
- **Experience** (`public-passport`): Calm, verifiable, print-ready showcase of craftsmanship and cryptographic provenance.
- **Persuade** (`portal`, `scan-landing`): Outcome-first clarity, immediate trust cues, frictionless single-path conversion.
