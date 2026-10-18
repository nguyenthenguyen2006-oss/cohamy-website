# Design System Master File — Cohamy CRM (UI/UX Pro Max)

> **LOGIC:** When building or reviewing a specific page in `/crm`, first check `design-system/cohamy-crm/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Cohamy CRM (`/crm`)
**Generated via:** `nextlevelbuilder/ui-ux-pro-max-skill` (`scripts/search.py --design-system --density 8`)
**Category:** B2B Enterprise SaaS / Commercial & Warehouse ERP
**Style Combination:** `data-dense-dashboard` + `bento-box-grid` + `accessible-and-ethical`
**Design Dials:** Variance `5/10` · Motion `4/10` · Density `8/10` (Dense / Dashboard)

---

## 1. Global Color Palette (Warm Golden-Amber & Cacao Enterprise)

Synthesized from `ui-ux-pro-max` (`colors.csv` Warm Amber + Enterprise SaaS tokens) with strict WCAG AA (`>= 4.5:1`) contrast compliance across all surfaces:

| Role | Hex | CSS Variable | Contrast / Notes |
|------|-----|--------------|------------------|
| **Primary (Golden Amber-Orange)** | `#B45309` | `--crm-primary` | `5.02:1` with `#FFFFFF` (passes AA normal text) |
| **Primary Gradient** | `linear-gradient(135deg, #D97706 0%, #B45309 55%, #9A3412 100%)` | `--crm-gradient-primary` | Paired with `background-color: #B45309` for guaranteed AA contrast |
| **Secondary (Warm Gold)** | `#F59E0B` | `--crm-amber-500` | Top accent bars, active indicators, focus rings |
| **Accent / CTA Hover** | `#9A3412` | `--crm-orange-700` | `6.78:1` with `#FFFFFF` |
| **Canvas Background** | `#FFFBF5` | `--crm-bg-canvas` | Warm ivory ledger paper reduces eye strain |
| **Sidebar Surface** | `#FFF6E6` | `--crm-bg-sidebar` | Warm amber-cream navigation rail (`260px`) |
| **Card / Table Surface** | `#FFFFFF` | `--crm-bg-surface` | Crisp white operational cards & tables |
| **Elevated / Muted Surface** | `#FEF9EF` | `--crm-bg-elevated` | Table headers, filter bars, secondary panels |
| **Foreground Primary** | `#1C1917` | `--crm-ink` | Deep cacao-charcoal (`16.8:1` on white) |
| **Foreground Secondary** | `#44403C` | `--crm-ink-secondary` | `9.7:1` on white |
| **Foreground Muted** | `#57534E` | `--crm-ink-muted` | `7.1:1` on white, `6.4:1` on `#FFF6E6` (passes AA everywhere) |
| **Border Default** | `#F3E3C3` | `--crm-border` | Warm parchment hairline border |
| **Border Strong / Active** | `#F59E0B` | `--crm-border-strong` | Active card / input highlight |
| **Semantic Success** | `#15803D` on `#ECFDF5` | `--crm-success` | `5.1:1` contrast |
| **Semantic Warning** | `#B45309` on `#FFFBEB` | `--crm-warning` | `4.8:1` contrast |
| **Semantic Danger** | `#B91C1C` on `#FEF2F2` | `--crm-danger` | `5.9:1` contrast |
| **Semantic Info** | `#9A3412` on `#FFF7ED` | `--crm-info` | `6.4:1` contrast |
| **Focus Ring** | `#D97706` | `--crm-ring` | `2px solid #D97706` + `0 0 0 3px rgba(245, 158, 11, 0.24)` |

---

## 2. Typography & Numeric Discipline

- **Primary UI Font:** `Be Vietnam Pro`, `"Plus Jakarta Sans"`, system-ui, sans-serif (full Vietnamese diacritic legibility)
- **Monospace / Voucher Codes:** `JetBrains Mono`, `ui-monospace`, monospace
- **Numeric Alignment:** `font-variant-numeric: tabular-nums` mandatory on all KPI counters, VND currency columns, unit conversion ratios (`1 Thùng = 24/1 Hộp`), and document timestamps.
- **Line Height & Measure:** `1.5`–`1.6` for body copy; `60ch–72ch` max measure for prose descriptions.

---

## 3. Density & Spacing Scale (`--density 8`: Dense / Dashboard)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Inline badge/icon gaps |
| `--space-sm` | `8px` | Compact cell & pill spacing |
| `--space-md` | `12px` | Card internal gaps, compact padding |
| `--space-lg` | `16px` | Standard panel padding & grid gap |
| `--space-xl` | `20px` | Section padding |
| `--space-2xl` | `24px` | Workspace container padding |
| `--space-3xl` | `32px` | Page-level vertical rhythm |

---

## 4. Iconography (`@phosphor-icons/react`)

- **Standard Library:** Phosphor Icons (`@phosphor-icons/react`), consistent outline (`regular` / `bold`) weight.
- **No Emoji Icons:** Never use emojis as structural or navigation icons.
- **Contextual Semantics:**
  - Decorative icons beside visible text MUST set `aria-hidden="true"`.
  - Icon-only controls MUST provide an explicit `aria-label` and expose state (`aria-expanded`, `aria-current`).

---

## 5. Quality Floor & Pre-Delivery Checklist (`design-audit.mjs`)

- [x] **Responsive across 6 tiers:** `360×800`, `390×844`, `768×1024`, `1024×768`, `1440×900`, `1920×1080` with `0px` horizontal overflow.
- [x] **Mobile Touch Targets:** Every interactive element (`a`, `button`, `input`, `select`) `>= 44×44px` on mobile (`<= 480px`).
- [x] **Focus Visibility:** Every focusable control displays a visible `2px` outline + `3px` glow ring on `:focus` and `:focus-visible`.
- [x] **WCAG AA Contrast:** `>= 4.5:1` for normal text and `>= 3:1` for large text across all cards, badges, buttons, and story panels.
- [x] **Single `<h1>` Landmark:** Every screen has exactly one semantic `<h1>`.
- [x] **Reduced Motion:** `prefers-reduced-motion: reduce` disables transitions and animations cleanly.
