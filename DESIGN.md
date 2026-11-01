---
name: DisputeDefender
description: A PayPal-native resolution console for merchant disputes, light only.
colors:
  background: "hsl(216 33% 97%)"
  foreground: "hsl(220 65% 13%)"
  card: "hsl(0 0% 100%)"
  primary: "hsl(210 100% 44%)"
  primary-hover: "hsl(212 100% 36%)"
  primary-foreground: "hsl(0 0% 100%)"
  navy: "hsl(224 100% 20%)"
  navy-raised: "hsl(224 70% 27%)"
  navy-foreground: "hsl(214 60% 92%)"
  secondary: "hsl(214 40% 95%)"
  muted: "hsl(214 33% 95%)"
  muted-foreground: "hsl(218 19% 40%)"
  accent: "hsl(214 85% 96%)"
  accent-foreground: "hsl(212 100% 30%)"
  destructive: "hsl(5 75% 44%)"
  destructive-soft: "hsl(5 85% 96%)"
  success: "hsl(154 78% 26%)"
  success-soft: "hsl(150 60% 94%)"
  warning: "hsl(30 100% 32%)"
  warning-soft: "hsl(38 100% 93%)"
  border: "hsl(216 27% 89%)"
  input: "hsl(216 22% 80%)"
typography:
  page-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.025em"
  figure:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  section-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    fontFeature: "\"cv11\", \"ss01\""
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "20px"
  mono-id:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.muted}"
  badge-info:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  badge-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  badge-danger:
    backgroundColor: "{colors.destructive-soft}"
    textColor: "{colors.destructive}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  deadline-pill-urgent:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
    padding: "20px"
  next-step-panel:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
    padding: "20px"
  nav-item:
    textColor: "{colors.navy-foreground}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "44px"
  nav-item-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.navy}"
  filter-chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "40px"
  filter-chip-selected:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.card}"
  citation-chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.accent-foreground}"
    typography: "{typography.mono-id}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  citation-chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
---

# Design System: DisputeDefender

## Overview

**Creative North Star: "The PayPal Resolution Console"**

A merchant tool that looks like it ships inside PayPal: a deep navy rail, a cool grey-blue ground, white work surfaces drawn with 1px hairlines, and PayPal blue spent only where the merchant has to act. Every screen answers "what now?" before it explains anything; the case page leads with the plain-language reason, the amount, and the deadline, then the verdict and the money comparison, then the cited evidence.

Density is operational, not editorial. Inter at 14px carries almost everything, numbers are tabular, record IDs are monospace. Hierarchy comes from weight, placement, and one framed "Next step" panel, not from colour volume or decorative chrome. The system is light only by decision (globals.css): merchants work the queue in daylight and the demo is recorded as screen video.

**Key Characteristics:**
- Navy shell, white surfaces, cool neutral ground, 1px hairlines.
- Blue is an action colour, not a brand wash.
- State colours are soft-fill pills with dark text: green resolved, red critical/expired, amber deadline urgency.
- Plain-language labels everywhere; PayPal enums never reach the screen raw.
- Flat at rest; shadows only on things that float over content.
- One motion moment: the cite-flash.

## Colors

A cool, low-chroma neutral world with one saturated action blue and a navy shell; tokens are HSL custom properties in `src/app/globals.css`, consumed via `hsl(var(--token))`.

### Primary
- **PayPal Blue** (`--primary`, #0070E0): the primary button, text links, the current lifecycle step, the "Recommended" cost bar, the selected citation chip, and focus rings (`--ring`). Hover deepens to **Pressed Blue** (`--primary-hover`, #0056B8).
- **Blue Wash** (`--accent`, #ECF4FD) with **Link Ink** (`--accent-foreground`, #004799): info badges, row hover in lists and AG Grid, linked-paragraph and selected-fact fills, the recommendation header band.

### Secondary
- **PayPal Navy** (`--navy`, #001B66; browser `themeColor` #001C64): the sidebar rail and mobile top bar, completed lifecycle segments, the 2px frame of the Next-step panel, the selected filter chip, and modal scrims (navy at 50%). **Raised Navy** (`--navy-raised`, #152E75) is hover on the rail; **Rail Text** (`--navy-foreground`, #DEE9F7) is resting nav text.

### Tertiary (state)
- **Resolved Green** (`--success` #0F7649 on `--success-soft` #E7F9F0): approved, resolved, "all claims backed", criteria checks.
- **Critical Red** (`--destructive` #C42A1C on `--destructive-soft` #FDEEEC): expired, needs attention, critical deadlines, destructive buttons.
- **Deadline Amber** (`--warning` #A35200 on `--warning-soft` #FFF2DB): the deadline pill when a response is urgent.

### Neutral
- **Cool Ground** (`--background`, #F5F7FA): page background behind white cards.
- **Ink Navy** (`--foreground`, #0C1A37): all primary text.
- **Slate** (`--muted-foreground`, #536179): secondary text, descriptions, grid headers.
- **Mist** (`--muted` #EEF2F6, `--secondary` #EDF2F7): grid header band, paragraph wells, sandbox banner, neutral badges.
- **Hairline** (`--border`, #DBE1EB): every card, row divider, and grid border. **Field Edge** (`--input`, #C1CAD7): outline buttons, inputs, the non-recommended cost bar, scrollbar thumb.

### Named Rules
**The Action Blue Rule.** PayPal blue marks what the merchant can do next (primary action, links, current step, active citation) and nothing else. Selection in chrome (active nav item, selected filter) is navy or white-on-navy, never a blue fill.

**The Amber Means Time Rule.** Amber is reserved for deadline urgency. The sandbox banner is navy-tinted on purpose; other cautions use neutral or red.

## Typography

**Body Font:** Inter via `next/font` (`--font-sans`), with ui-sans-serif, system-ui fallback. Feature settings `cv11`, `ss01` on body.
**Mono Font:** ui-monospace stack, for dispute IDs, order IDs, fact IDs, tracking numbers, and the sandbox host.

**Character:** One neutral grotesque doing all the work, sharpened by tabular numerals and monospace record IDs so money and evidence read as data.

### Hierarchy
- **Page title** (600, 24px mobile / 28px from `sm`, 36px line, tight tracking): one per page; on case detail it is the plain-language reason.
- **Figure** (600, 30px, tabular, tight tracking): the disputed amount in the case header.
- **Section title** (600, 16px card titles; 18px for the Next-step panel and dialogs; 20px for the recommendation headline).
- **Body** (400, 14px; 15px for page descriptions from `sm`): everything else. Prose capped at 65–70ch.
- **Label** (600 or 500, 12px; 13px for banner, grid headers, small buttons): badges, pills, step labels, metadata.
- **Mono ID** (400–600, 12px).

### Named Rules
**The Tabular Money Rule.** Every amount, count, percentage, and countdown uses tabular numerals.

**The No Kicker Rule.** Headings stand alone: no uppercase eyebrow or tracked label above a title. The build ships none.

## Layout

Shell: a 240px sticky navy rail at `lg` and up; below `lg` a 56px sticky navy top bar with a slide-in drawer (min(18rem, 85vw)). The sandbox banner sits above content. Main content is centred, max 1320px, padded 16 / 24 / 32px (base / `sm` / `lg`), with 24px top padding (32px from `sm`).

Rhythm is a 4px grid: 8 and 12px inside components, 20px card padding, 24px between sections and grid gaps. Touch targets are at least 40px (nav items and menu buttons 44px).

Responsive steps (Tailwind defaults):
- **base (390):** single column; case detail keeps the desktop order and pins the primary action in a sticky bottom bar (card at 95% with blur); lifecycle shows "Step n of 6" text instead of per-step labels; dialogs are bottom sheets.
- **sm 640px:** page header goes row (title left, actions right); lifecycle labels appear; banner shows the API host; dialogs centre at max 512px.
- **md 768px:** queue cards go two-up; overview case list becomes a six-column row grid.
- **lg 1024px:** rail replaces top bar; case detail splits into main column + 22rem sticky aside (top 24px) holding the Next-step panel; bottom bar hides; simulator splits 3:2.
- **xl 1280px:** the queue switches from cards to the AG Grid table and shows CSV export; the cost comparison and the criteria list sit side by side.

### Named Rules
**The Same Order Rule.** Phones get the desktop story in the same order, one column, with the one primary action in thumb reach.

## Elevation & Depth

Flat by default. Depth comes from the navy shell against the cool ground, white cards on that ground, and 1px hairlines. Shadows exist only for surfaces that float over content, always navy-tinted.

### Shadow Vocabulary
- **Drawer** (`box-shadow: 8px 0 32px -8px hsl(var(--navy) / 0.5)`): mobile navigation drawer.
- **Dialog** (`box-shadow: 0 12px 40px -8px hsl(var(--navy) / 0.35)`): modal and bottom sheet.
- **Action bar** (`box-shadow: 0 -8px 24px -12px hsl(var(--navy) / 0.25)`): sticky mobile primary-action bar.

### Named Rules
**The Float-Only Shadow Rule.** Cards, panels, and grid never cast shadows; only drawer, dialog, and the bottom action bar do.

## Shapes

Base radius token is 8px (`--radius`). In practice: work surfaces (cards, queue cards, AG Grid wrapper) are 12px; list rows, fact records, nav items, and draft paragraphs 8px; badges, deadline pills, and citation chips 6px; dialogs 16px (top-only as a bottom sheet). Every button and filter chip is a full pill, as in PayPal's merchant tools. Progress and cost bars are full-round 6px and 8px tracks.

## Components

### Buttons
- **Shape:** full pill (9999px); heights 36 / 40 / 48px (sm / default / lg), 13 / 14 / 16px semibold text.
- **Primary:** PayPal blue fill, white text; hover and active to Pressed Blue. One per view.
- **Outline:** white fill, Field Edge border, ink text; hover darkens border and fills Mist. Used for secondary choices (Refund, Accept) and the mobile bar's non-approve action.
- **Secondary / Ghost / Link / Destructive / Success:** accent wash, transparent, underlined blue text, red fill, green fill.
- **Focus:** 2px ring in `--ring` with 2px offset; global `:focus-visible` outline uses the same blue. Disabled at 45% opacity.

### Badges and pills
- **Status badge:** 6px radius, soft fill + dark text of the tone, 12px semibold, optional leading dot for states that change over time. Tones come from `src/lib/case-labels.ts` (neutral, info, success, warning, danger).
- **Deadline pill:** clock icon + tabular countdown; neutral Mist when normal, amber when urgent ("Urgent · 34h left"), red when critical or expired.

### Cards / Containers
- **Corner Style:** 12px. **Background:** white on Cool Ground. **Border:** 1px Hairline. **Shadow:** none. **Padding:** 20px (header 20px with 12px bottom).
- **Next-step panel:** the single framed element: 2px navy border, 18px title "Next: …", one primary pill, then "Other options" as outline pills.

### Navigation
- **Rail:** navy, brand mark in a blue 32px tile, 44px items with 18px icons, 14px medium text. Resting Rail Text; hover Raised Navy; active is a white pill-rectangle with navy text. A "Sandbox tools" group label (12px, Rail Text at 70%) separates demo tools. Store footer at the bottom.
- **Mobile:** sticky top bar, 44px round menu button, drawer with Escape, scrim click, focus return, and scroll lock.

### Queue
- **Filter chips:** 40px pills with a count; selected is navy fill, white text.
- **AG Grid (xl+):** `themeQuartz.withParams` mapped to tokens: inherit font, 14px, accent = primary, card background, Hairline borders, Mist header with Slate 13px/600 text, accent row hover and selection, 12px wrapper radius, 60px rows, 44px header, 16px cell padding. Reason cell shows the plain label over the mono dispute ID.
- **Cards (below xl):** 12px cards, hover darkens border, active fills accent.

### Lifecycle track
Six equal 6px rounded segments (Received → Analyzed → Draft ready → Approved → Sent to PayPal → Resolved): done navy, current blue with blue semibold label, upcoming Hairline.

### Cost comparison
Two rows (If you fight / If you refund) with tabular amounts and an 8px track; the recommended bar is blue with a blue "Recommended" tag, the other Field Edge.

### Citation link (signature)
Each draft paragraph sits in a Mist well with mono fact chips (28px, 6px radius). Clicking a chip selects it (blue fill), outlines every paragraph citing that fact in blue on accent, and scrolls to the fact record, which plays the cite-flash: a single blue ring expanding 0 → 10px and fading (900ms, `cubic-bezier(0.16, 1, 0.3, 1)`). Fact records show their mono ID, label, value, source, and "Cited n×".

### Charts (AG Charts)
`ag-default` base, page font read from computed body style (canvas cannot read CSS variables), 13px, transparent background, ink category labels, slate value labels, solid hairline gridlines. Bars use the token hues as literal hex because canvas cannot resolve `hsl(var())`.

### Dialogs
Navy 50% scrim; bottom sheet on phones (16px top radius, safe-area padding), centred 512px card from `sm`; 40px round close button; footer buttons stack reversed on phones.

## Do's and Don'ts

### Do:
- **Do** route every PayPal enum through `src/lib/case-labels.ts` (`reasonLabel`, `caseStateMeta`, `recommendationMeta`, `humanizeEnum`) before display; show raw IDs only in mono.
- **Do** keep one primary blue pill per view; other choices are outline pills.
- **Do** use tabular numerals for every amount, count, and countdown.
- **Do** map AG Grid and AG Charts onto the token palette rather than their default themes.
- **Do** keep the cite-flash as the only expressive motion; other transitions are 150–200ms colour changes, and `prefers-reduced-motion` collapses all animation and transition to 0.01ms.
- **Do** show "Sandbox" context in navy/neutral, never amber.

### Don't:
- **Don't** use blue for decoration, selection in chrome, or brand washes.
- **Don't** use amber for anything except deadline urgency.
- **Don't** place uppercase kickers or eyebrows above headings.
- **Don't** add shadows to cards, panels, or the grid.
- **Don't** add a dark theme; the system is light only.
