---
name: RoomSplit
colors:
  surface: '#fbf8ff'
  surface-dim: '#dad9e3'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f2fd'
  surface-container: '#eeedf7'
  surface-container-high: '#e8e7f1'
  surface-container-highest: '#e3e1ec'
  on-surface: '#1a1b22'
  on-surface-variant: '#464555'
  inverse-surface: '#2f3038'
  inverse-on-surface: '#f1effa'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#95002b'
  on-tertiary: '#ffffff'
  tertiary-container: '#bf0f3c'
  on-tertiary-container: '#ffd0d2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#fbf8ff'
  on-background: '#1a1b22'
  surface-variant: '#e3e1ec'
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  amount-display:
    fontFamily: Inter
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  amount-card:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.06em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.005em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes an Apple-caliber, native-feeling mobile web application engineered for dorm mates, roommates, and students managing shared living costs and micro-loans. 

### Brand Personality & Demeanor
- **Frictionless & Precise:** Financial tracking among peers can introduce tension; the interface counters this with absolute clarity, frictionless micro-interactions, and neutral elegance.
- **Understated Elegance:** Drawing directly from modern iOS paradigms, the experience relies on generous negative space, crisp hairline dividers, soft ambient lighting, and rich frosted glass surfaces.
- **Calm Authority:** Eliminates messy spreadsheets and chaotic group chats in favor of quiet, systematic financial confidence.

### Visual Style
- **Pure Modern iOS / Glassmorphism:** Translucent blurs (`backdrop-blur-md` to `backdrop-blur-xl`), ultra-fine 1px border lines, tactile pill indicators, dynamic sheets, and fluid kinetic feedback.
- **Tactile Content-First Containers:** Pure white elevated cards floating above a cool, whisper-quiet zinc foundation to make balance summaries and settlement actions instantly legible.

## Colors

The palette embraces quintessential Cupertino clarity: a luminous, ultra-subtle cool gray canvas, sharp paper-white cards, and high-contrast typographic hierarchy. Vibrancy is strictly functional, reserved for actionable primary flows, debt vs. credit signals, and state alerts.

### Primary, Secondary & Status Accents
- **Primary Accent (`#4F46E5` - Electric Indigo):** Anchors primary actions, active navigation icons, active segment controls, and key financial interactions.
- **Positive / Settled (`#10B981` - Emerald Green):** Denotes "Lent", "You are owed", completed peer-to-peer repayments, and balanced states.
- **Negative / Owing (`#F43F5E` - Coral Rose):** Denotes "You owe", overdue splits, and expense obligations.
- **Warning / Pending (`#F59E0B` - Amber Gold):** Applied to pending transfer verifications and uneven splits.

### Surface & Background Tokens
- **Background Canvas:** Light mode: `#F4F4F6` | Dark mode: `#09090B`
- **Surface Elevation 1 (Cards/Sheets):** Light mode: `#FFFFFF` | Dark mode: `#18181B`
- **Surface Elevation 2 (Sub-cards/Inputs):** Light mode: `#F8FAFC` | Dark mode: `#27272A`
- **Translucent Overlays:** Light mode: `rgba(255, 255, 255, 0.82)` | Dark mode: `rgba(24, 24, 27, 0.82)`

### Neutral & Typographic Ramp
- **Text Primary:** Light mode: `#09090B` | Dark mode: `#F4F4F5`
- **Text Secondary:** Light mode: `#52525B` | Dark mode: `#A1A1AA`
- **Text Tertiary / Muted:** Light mode: `#71717A` | Dark mode: `#71717A`
- **Hairline Borders:** Light mode: `rgba(0, 0, 0, 0.06)` | Dark mode: `rgba(255, 255, 255, 0.08)`

## Typography

The typography leverages Inter configured to mirror Apple's SF Pro aesthetic: tight tracking across headlines, balanced open counters for micro-copy, and tabular numbers for financial columns.

### Numerical & Tabular Data
- All balance metrics, split tallies, and debt summaries must be rendered using `font-feature-settings: 'tnum' 1, 'cv05' 1` (tabular numbers with high-legibility glyph variants). This prevents digit jitter during live balance recalculations.

### Hierarchy & Treatment
- **Large Titles (`display-hero`, `headline-lg`):** Rendered with negative letter spacing for a compact, editorial look characteristic of iOS navigation bars.
- **Section Eyebrows (`label-caps`):** Formatted in all-caps with generous `0.06em` tracking, paired with muted neutral colors to ground card clusters.
- **Body & Captions:** Standard proportional spacing ensuring high legibility for line items, split breakdowns, and timestamp receipts.

## Layout & Spacing

The layout model is strictly mobile-first with a fixed-viewport paradigm for larger screens (`max-w-md` centered on desktop) to retain an authentic native iOS feel across all platforms.

### Viewport & Grid Architecture
- **Mobile Handheld (360px - 480px):** Single-column fluid view with `1rem` outer canvas padding (`margin`). Internal component layouts use a 4-column sub-grid or flex-row arrangement with `0.5rem` to `1rem` gaps.
- **Tablet / Desktop Web (481px+):** Centered app frame pinned at `max-width: 440px` with a subtle outer browser shadow, simulating an iPhone Pro viewport while avoiding stretched layouts.
- **Sticky Glass Frame:**
  - **Top Navigation Bar:** Sticky at `top: 0`, 56px height, `backdrop-filter: blur(20px)`, integrating dorm/room selector dropdown and profile initials.
  - **Bottom Dock:** Sticky at `bottom: 0`, 68px height plus device safe-area inset (`env(safe-area-inset-bottom)`), housing tab navigation and a central elevated floating quick-add trigger.

### Vertical Rhythm
- Vertical spacing adheres to an 8pt grid (`space-xs` = 4px, `space-sm` = 8px, `space-md` = 16px, `space-lg` = 24px, `space-xl` = 32px).
- Stack lists and history items use `space-xs` (4px) inner borders or `space-sm` (8px) gaps.
- Distinct card groups (e.g., "Active Room Splits" vs. "1-on-1 Micro-Loans") separate with `space-lg` (24px).

## Elevation & Depth

Visual hierarchy uses stacked, ambient tonal surfaces instead of harsh drop shadows, referencing iOS 17 and macOS glass physics.

### Tonal Tiers & Surfaces
- **Tier 0 (Backdrop Canvas):** Soft, muted matte neutral (`#F4F4F6` light / `#09090B` dark).
- **Tier 1 (Base Cards & Content Modules):** Crisp opaque white (`#FFFFFF`) with a hairline outline `border: 1px solid rgba(0, 0, 0, 0.06)` and subtle ambient shadow: `box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.03), 0 1px 2px -1px rgba(0, 0, 0, 0.03)`.
- **Tier 2 (Sticky Nav Bars & Glass Badges):** `rgba(255, 255, 255, 0.82)` with `backdrop-filter: blur(20px) saturate(180%)` and a bottom hairline divider `rgba(0, 0, 0, 0.05)`.
- **Tier 3 (Floating Add Button / Modals / Action Sheets):** Solid indigo or high-contrast white card floating over a darkened scrim (`rgba(0, 0, 0, 0.4)` with 4px backdrop blur). Elevated shadow: `box-shadow: 0 12px 28px -4px rgba(79, 70, 229, 0.28), 0 6px 12px -4px rgba(0, 0, 0, 0.08)`.

### Depth Principles
- No hard, dense, or purely black shadows. Shadows must carry a slight diffusion radius (>12px) and extremely low alpha (<0.08) for neutrals.
- Colored glows are limited exclusively to primary interactive elements (e.g., Quick Add FAB and Settlement buttons).

## Shapes

The system implements iOS continuous corner curvature ("squircle" feel) using smooth, friendly radii.

### Shape Classifications
- **Base Components (Inputs, List Items, Standard Buttons):** `rounded-md` (`0.5rem` / 8px).
- **Cards, Modules & Sheets:** `rounded-lg` (`1rem` / 16px) for interior split cards and `rounded-xl` (`1.5rem` / 24px) for parent sheets and primary dashboard containers.
- **Pills & Badges:** Full circular curvature (`rounded-full` / `9999px`) applied to status pills, split member avatars, category chips, and segment controllers.
- **Modals & Drawers:** Top sheet edges utilize `1.75rem` (28px) smooth radii to simulate native mobile slide-up sheets.

## Components

### 1. Buttons & Triggers
- **Primary Action (e.g., "Add Expense", "Settle Up"):** Background `#4F46E5`, foreground `#FFFFFF`, height 48px, rounded 12px (`rounded-md`), semi-bold text. Smooth active scaling (`active:scale-[0.98]`).
- **Secondary / Ghost:** Subtle surface `#F4F4F6`, border hairline, foreground `#09090B`. Active state shifts to `#E4E4E7`.
- **Destructive / Debt Settlement:** Coral Rose light tint background (`rgba(244, 63, 94, 0.1)`), coral foreground (`#F4F4F6`), subtle border `rgba(244, 63, 94, 0.2)`.

### 2. Floating Action Button (FAB)
- Placed dead-center in the bottom floating dock or bottom right edge. 54px circular pill (`rounded-full`), indigo fill with ambient shadow (`0 8px 20px rgba(79, 70, 229, 0.35)`). Contains a clean plus icon that rotates 45 degrees upon modal sheet activation.

### 3. Cards & Transaction Rows
- **Summary Balance Card:** Gradient mesh tint or crisp white container with large tabular figures (`amount-display`). Shows "Total Room Spend", "You are owed" (emerald), and "You owe" (coral) stacked in three clear pill sub-sections.
- **Transaction List Item:** Inset row format with 44px round category icon (e.g., groceries, Wi-Fi, cleaning supplies), primary title, secondary date + "Paid by [Name]", and right-aligned amount with color-coded ownership balance (`+ $14.50` or `- $28.00`). Divided by a 1px hairline inset with 56px left margin.

### 4. Chips, Badges & Segmented Controls
- **Segmented Control:** Apple-style pill container (`#E4E4E7` / 36px height) enclosing equal-width toggle buttons ("Shared Expenses" vs. "Personal Loans"). Active segment slides a crisp white pill with subtle `0 1px 3px rgba(0,0,0,0.1)` shadow.
- **Status Badges:** `rounded-full`, height 24px, padding 4px 10px. Positive (`#ECFDF5` bg, `#059669` text), Negative (`#FFF1F2` bg, `#E11D48` text), Neutral (`#F4F4F6` bg, `#71717A` text).

### 5. Input Fields & Currency Selector
- **Currency Input:** Massive center-aligned or prominent tabular input (`fontSize: 34px`) with fixed currency symbol prefix. No borders; clean underline or bare container with soft gray background.
- **Form Inputs:** 46px height, background `#F8FAFC`, border 1px solid `rgba(0, 0, 0, 0.08)`, rounded 10px, clear focus ring with electric indigo (`0 0 0 2px rgba(79, 70, 229, 0.2)`).

### 6. Modal Sheets & Drawers
- Bottom drawer slide-up with a subtle 36px wide x 4px tall gray drag indicator pill at the top. Semi-transparent backdrop blur scrim. Fast dismiss swipe physics with spring curve timing (`cubic-bezier(0.32, 0.72, 0, 1)`).