# UI audit: generic "AI-generated" look — findings and fix plan

Audited 26 October 2026 on `main` (5cc88f3). Covers the public site (`/`), sign-in, and the signed-in
supervision app as a supervisor with the local fixture data (`tests/e2e/seed-local-fixtures.mjs`,
`seed-ui-demo-data.mjs`), at 1440 px and 390 px. Screenshots are in [`ui-slop-audit/`](ui-slop-audit/).

This audit is about the visual system. Copy and per-screen usability were covered by
[`ui-consistency-matrix.md`](ui-consistency-matrix.md) and are only repeated here where they overlap.

## Summary

The app works and much of its copy has already been cleaned up. It still *looks* generated, for two reasons:

1. **There is no design system, only an accumulation of one-off styles.** `globals.css` is 15,850 lines.
   It defines 22 colour tokens but contains **718 distinct hex colours**, **73 font sizes**, **18 font
   weights**, **~20 corner radii**, **81 box-shadows** and **15 breakpoints**. Each screen was styled on its
   own, so each screen fell back to the same generic defaults.
2. **Those defaults are the stock SaaS-dashboard kit**: a KPI tile with an icon in a pastel square, an
   uppercase eyebrow above every heading, colour used as decoration, soft tinted gradients on cards,
   cards nested in cards, and placeholder content standing in for empty states.

The fix is not to swap one decoration for another, such as purple for teal. It is to write a short
design direction that fits this product, encode it in tokens and lint rules, and then remove whatever
those rules do not allow.

## Measured findings (app)

| # | Finding | Evidence | Severity |
|---|---|---|---|
| A1 | **Token drift.** 718 distinct hex values against 22 colour tokens. 12 custom properties are *used but never defined* (`--accent-soft`, `--accent-strong`, `--brand-700`, `--danger`, `--ink-025`, `--line`, `--surface`, …), so those rules silently fall back to defaults. | `app/globals.css` | High |
| A2 | **Font-weight bug.** Hind is loaded only at 400–700 (`app/layout.tsx:8-12`), but 140 declarations ask for 720–900 and 38 for 620–690. All of them render as 700, so the intended weight differences do not exist on screen. 18 different weights are declared in total. | `globals.css` | High (real bug) |
| A3 | **No type scale in practice.** 73 distinct `font-size` values, including 11.5, 12.5, 13.5 px and mixed rem. The `--text-*` tokens exist, but there are 300+ literal sizes beside them. | `globals.css` | High |
| A4 | **Radius and shadow sprawl.** About 20 radius values. The tokens are themselves a near-duplicate ladder (8/9/10/12/16/18/22 px), and literal 11, 13, 14, 15 and 20 px values sit beside them. 81 distinct shadows. | `globals.css:36-45` | Medium |
| A5 | **Colour as decoration.** Workspace tiles get arbitrary hues: Issues and NCR are orange, HSE is green, Change order is purple (`project-workspace-home.tsx:121-237`). Each tile also has a coloured top stripe (`globals.css:12870`). Overview metrics are teal, orange, blue and violet (`client-dashboard.tsx:198`). Purple is used 10+ times with no meaning. When every module has a colour, the red, amber and green that mean *status* lose their force. | screenshots `workspace.jpg`, `overview.jpg` | High |
| A6 | **Icon in a tinted square everywhere.** About 50 rules: every KPI (`Metric`, `codeco-supervision-app.tsx:3623`), every overview metric, every management panel header, every report tile and every project card. | `overview.jpg`, `management.jpg`, `reports.jpg` | High |
| A7 | **Eyebrow and title double headings.** 58 `text-transform: uppercase` rules and 27 `.eyebrow` uses: "TODAY ON SITE / Latest recorded work", "ATTENTION / Priority queue", "LIVE PROJECT CONTROL", "AUTOMATIC CLIENT OUTPUT / Choose what the client needs", plus two stacked eyebrows in two colours on sign-in. | `overview.jpg`, `sign-in.jpg` | Medium |
| A8 | **Soft gradients and glass.** 33 gradients and 8 `backdrop-filter` blurs in the app, mostly faint tinted washes on cards (`globals.css:1063`, `4993`, `6138`, `10198`, `11907`, `12083`, `12779`…) and gradient progress bars. They add no information. | `globals.css` | Medium |
| A9 | **Fake content in empty states.** With no photos, the overview shows four gradient placeholder tiles in four tones, each reading "No photo yet" (`client-dashboard.tsx:580`). The weather chip in the top bar shows "—". | `overview.jpg` | Medium |
| A10 | **Card soup.** Each project card holds a code chip, an icon square, two pills, six boxed stats, a progress bar and an arrow link (`projects.jpg`). Management nests "Company employees" inside "External parties" inside the page panel. The Workspace page has a full-width card that contains only a search box. Reports shows 7 navigation tiles that work like tabs, and two of them look selected at once. | `projects.jpg`, `management.jpg`, `workspace.jpg`, `reports.jpg` | High |
| A11 | **Button sprawl.** 35 `*button*` classes. Management puts three button styles side by side (outlined teal, outlined teal, solid orange). Primary actions alternate between a full-width orange bar ("New" on Issues), an orange pill with a drop shadow ("New configured project") and a teal outline ("Open workspace"). | `management.jpg`, `projects.jpg` | Medium |
| A12 | **Duplicated controls.** The language select appears in both the top bar and the Management header. The notification bell appears in both the top bar and the overview command card. "Open workspace" appears twice on the overview. | `overview.jpg`, `management.jpg` | Medium |
| A13 | **The floating Help button covers content** at 1440 px: the checkbox column on the Issues form, the row actions in Management and the Reports grid. | `management.jpg`, `reports.jpg` | Medium (defect) |
| A14 | **Phone overview header.** The icon buttons wrap unevenly: the calendar sits alone on a second row with a gap where the weather button was. | `overview-phone.jpg` | Medium (defect) |
| A15 | **Template sign-in.** A diagonal teal split background, a floating card with a large shadow, two eyebrows, "Welkom terug", an orange button with a glow shadow, and a shield-icon footnote. | `sign-in.jpg` | Low |
| A16 | **Landing CSS and fonts load on every app screen.** The root layout imports `landing.css` (1,903 lines) and Jost for the whole app. | `app/layout.tsx:2-5` | Low (performance) |
| A17 | **15 different breakpoints** (480, 520, 560, 620, 640, 700, 760, 860, 900, 980, 1100, 1180 px and others). | `globals.css` | Low |

## Findings (public site, `/`)

The real project photography, drawings, client names and address are the strongest part of the site.
Keep them. What reads as a template:

| # | Finding | Where |
|---|---|---|
| L1 | **The same heading formula, five times:** a thin Jost 200/300 line, then a bold line ("Ideas tested. / **Structures resolved.**", "One team for the thinking / **behind the build.**", "From early advice / **to on-site control.**", "Quality is the standard. / **Transparency is the process.**", "Have a plan in mind? / **Let's make it stand.**"). | `page.tsx:284, 334, 359, 384, 406` |
| L2 | **Invented stats.** "04 Integrated disciplines", "01 Accountable project partner", "∞ Built around client needs". Only "2015" is a fact. | `page.tsx:345-350` |
| L3 | **Decorative numbering with no meaning:** "01 / 06" on each project, "01 / 04" stamp, "CODECO / SR 01" hero index, 01–04 on services. | `page.tsx` |
| L4 | **Two infinite marquees** (disciplines and clients), "Scroll to explore", "Swipe to explore projects", and grid-line decoration. | `page.tsx:267-279, 391-398` |
| L5 | **Long intro choreography.** An aperture wipe, a Ken Burns zoom and dissolve, and hero text that appears 0.7–1.3 s after load. Reduced motion is respected, which is good. | `landing.css:221-565` |
| L6 | **A list of values as a section:** "Quality / Transparency / Customer satisfaction / Commitment". | `page.tsx:384-387` |
| L7 | **Three accent yellows:** the logo yellow, `--studio-yellow #ffd400` and the olive-gold hero text, while the app uses orange `#f07400` and teal. | `landing.css:10`, `globals.css:20` |

## Research: what "AI slop" in UI is and what actually fixes it

Published checklists converge on the same tells. This codebase shows most of them:

- **Colour:** decorative gradients, a brand colour on too many surfaces, and "off-white background, gray
  text, soft shadow on every card" ([ux-skill wiki][wiki]). Here: A5, A8.
- **Components:** "icon in a coloured circle top-left of feature cards", the same rounded radius on
  everything, and shadow, border and tint combined on one card ([ux-skill wiki][wiki]). Here: A6, A4, A10.
- **Layout:** cards nested inside cards, and every section with the same height, padding and heading
  ([uxplanet][uxplanet], [ux-skill wiki][wiki]). Here: A10.
- **Content:** invented round stats and filler ([ux-skill wiki][wiki]). Here: L2, L6.
- **Interaction:** motion that conveys no state ([ux-skill wiki][wiki]). Here: L4, L5.

What the sources say works:

1. **Write a design direction first, then derive every choice from it.** Swapping a purple gradient for
   a teal one is just new slop. Intent matters more than removing defaults ([DeSlop][deslop]). AI slop
   is mostly a context problem, not a capability problem ([uxdesign.cc][uxd]).
2. **Give explicit bans** such as no gradient text, no glassmorphism and no grid of identical icon
   cards. Bans force the generator out of its easiest solution ([Medium][prompts]).
3. **Enforce with tooling, not taste.** A detector that runs deterministic rules after each UI edit
   ([Impeccable][impeccable]). Stylelint's built-in `color-no-hex` and the
   `stylelint-declaration-strict-value` plugin force token use for colour, font size, weight, radius
   and shadow ([stylelint rules][stylelint], [Polaris stylelint][polaris]).
4. **Don't overcorrect.** Escaping one cliché with a new decorative idea produces another cliché
   ([stork.ai][stork]). The target is plainer, not differently decorated.

## Design direction for this product

Write this down as `docs/product/design-direction.md`. Every later change traces back to it.

- **Who and where:** site supervisors on phones and tablets, outdoors in Suriname daylight, often
  one-handed. Office staff on laptops. The output is formal records and signed reports.
- **Metaphor: a site document, not a SaaS dashboard.** The visual language of drawing title blocks,
  registers and inspection forms: ruled lines, tabular figures, record codes (`Q-2026-0002`) shown
  prominently, and dense lists. Structure comes from alignment and hairlines, not from boxes and shadows.
- **Colour has jobs, never decoration:**
  - *Ink:* near-black text and neutrals (one 9-step grey ramp).
  - *Paper:* white surfaces on a single light canvas.
  - *Action:* CODECO signal orange `#f07400`, used for the primary action and the current selection
    only. At most one primary button per view.
  - *Status:* red (critical/rejected), amber (open/attention), green (done/approved), blue
    (information). Used only to show the state of a record.
  - Modules have **no colour**. Their icon and name identify them.
- **Type:** Hind for everything in the app, at weights 400, 600 and 700 only. A 6-step scale (12, 14,
  16, 18, 22, 28 px), 16 px minimum on inputs for phones, and `font-variant-numeric: tabular-nums` for
  counts, dates and codes. Geist Mono only for record codes and tokens. Jost only on the public site.
- **Shape:** radius 6 px for controls, 10 px for surfaces, and a pill only for status badges. One
  shadow, for overlays only (dialogs, menus). Surfaces get a 1 px border *or* a shadow, never both, and
  never a tint on top.
- **Motion:** only to show a change of state (sheet open, saved, sync). 150–200 ms. No ambient loops.
- **Empty states:** one line of text and the action that fills the state. No fake tiles.

## Fix plan

Each phase is one PR, verified with `npm run lint`, `npm test`, the Playwright suite (`viewport-walk`,
`layout-hygiene`, `responsive-audit`, `dialogs`) and before/after screenshots at 1440 and 390 px.

### Phase 0: guardrails (½ day)

- Add `docs/product/design-direction.md` (the section above).
- Add stylelint with `color-no-hex` (allowed only in the token block) and
  `stylelint-declaration-strict-value` for `color`, `background-color`, `border-color`, `font-size`,
  `font-weight`, `border-radius` and `box-shadow`. Run it in `npm run lint` and in
  `.github/workflows/quality.yml`. Start it in warn mode with a baseline count that may only go down.
- Add `tests/design-guardrails.test.mjs`. It fails on new `linear-gradient` or `radial-gradient` outside
  an allow-list, on `backdrop-filter`, on font weights outside 400/600/700, on custom properties used
  but not defined, and on `style={{` colours in TSX.
- Add a short "UI rules" section to the repo `CLAUDE.md`, pointing at the design direction and the
  bans. Any AI agent editing the UI then gets the context before it writes CSS.

### Phase 1: tokens (1–2 days, mechanical)

- Rewrite `:root`: one grey ramp, paper/canvas, action (orange), four status pairs (strong and soft),
  the six type sizes, three weights, radii 6 and 10 plus pill, one overlay shadow, and three
  breakpoints (640 / 1024 / 1280).
- Define the 12 missing variables or point them at real tokens (A1).
- Use a script to map every literal colour to its nearest token (ΔE in OKLab, then review by eye), and
  every font size and radius to the nearest step. Remove 720–900 weights (A2), which visually changes
  nothing because they already render as 700.
- Delete the 33 decorative gradients and 8 blurs, except the photo scrim that keeps text on an image
  readable (A8).
- Move `landing.css` and Jost out of the root layout into the landing route (A16).

### Phase 2: components (2–3 days)

Replace the 35 button classes and 50 card variants with a small set, kept as CSS classes so no new
dependency is needed:

- `Button`: `primary` (orange, one per view), `secondary` (bordered), `quiet` (text), `danger`; sizes
  `sm`, `md` and `lg` (lg = 48 px touch target for field actions).
- `Panel`: white, 1 px border, radius 10, a heading row with plain text and optional actions. No eyebrow.
- `Stat`: a number and a label in tabular figures, with no icon square. Status colour only when the
  number *is* a status (for example overdue > 0).
- `List row`: code, title, meta and status badge. This replaces most tiles and cards.
- `PageHeader`: title, optional record or project code, and actions. Replaces eyebrow plus h1 (A7).
- `Tabs`: for Reports and Management, replacing navigation tiles (A10).

### Phase 3: screens (3–5 days, highest-traffic first)

1. **Overview** (`client-dashboard.tsx`): replace the four icon KPI tiles with a single ruled stat
   strip. Remove the photo placeholders (show "No photos yet · Take photo"). Remove the duplicate bell
   and the second "Open workspace". Turn the priority queue into list rows with status badges. Fix the
   phone header grid (A14).
2. **Workspace** (`project-workspace-home.tsx`): drop the per-module tones and stripes. Show modules as
   a compact list or grid of icon, name and count, with the count in status colour only when overdue or
   open-critical. Put the search box into the page header instead of its own card.
3. **Project selection**: each project is one row or plain card with the code, name, location, open
   actions and open issues. Remove the six boxed zeroes and the 0 % bar when there is no data.
4. **Management**: tabs plus flat sections. Un-nest Company employees. One primary button. Remove the
   second language select (A12).
5. **Reports**: tabs (Daily, Weekly, Monthly, Create, Review & sign, History). The report type becomes
   a segmented control. PDF and Word become a primary and a secondary button.
6. **Forms (Issues, NCR, …)**: keep the numbered sections, which are useful, and drop the per-section
   card chrome in favour of hairline-separated groups.
7. **Help button** (`field-guide.tsx:443`): move it into the top bar or the "More" menu so it no longer
   floats over content (A13).
8. **Sign-in**: plain canvas, logo, form and one orange button. Remove the diagonal background, the
   eyebrows and the glow shadow (A15).

### Phase 4: public site (1–2 days)

Keep the photography, project list, services text, clients and contact details. Then:

- Write headings that say something specific about CODECO's work, and drop the thin/bold formula (L1).
- Delete the invented fact row. Keep only facts: established 2015, the office and a project count
  that is true (L2).
- Remove the decorative counters, the hero index, grid lines, both marquees (show clients as a plain
  list) and the scroll cues (L3, L4).
- Cut the intro to a single fade of under 400 ms with no zoom loop (L5).
- Use one yellow: the logo's (L7).

### Phase 5: verify and lock in

- Update `ui-consistency-matrix.md` and keep before/after screenshots per screen.
- Switch the stylelint and guardrail rules from warn to error once the baseline reaches zero.
- Target end state: ≤ 40 colour values, 6 font sizes, 3 weights, 3 radii, 1 shadow and 3
  breakpoints, with `globals.css` split per area and substantially shorter.

## Can this be fixed "in one prompt"?

Not safely in one shot. Phase 3 alone touches a 5,083-line component and a 15,850-line stylesheet,
and one giant change cannot be reviewed or bisected. What works is **one reusable brief, run once per
phase**, with the guardrails from Phase 0 checking every run. Paste this to an agent and change only
the phase line each time:

```text
You are de-slopping the CODECO Supervisie UI. Read, in order:
docs/product/design-direction.md, docs/operations/ui-ai-slop-audit.md, apps/web/AGENTS.md.

Do PHASE <N> of the fix plan in ui-ai-slop-audit.md, and nothing outside it.

Hard rules:
- Use only tokens from :root in app/globals.css. No new hex, rgba, font-size, font-weight,
  radius or shadow literals.
- Banned: gradients (except image scrims), backdrop-filter, icons inside tinted squares,
  uppercase eyebrows above headings, colour used to tell modules apart, cards nested in cards,
  placeholder or fake content in empty states, invented numbers, ambient or looping animation,
  more than one primary button per view.
- Status colours (red/amber/green/blue) only express a record's state.
- Do not change behaviour, permissions, copy meaning or data flow. Visual and structural only.
- Keep every existing accessible name, role and test selector unless a test is updated with it.

Before finishing: run npm run lint, npm test and the Playwright specs viewport-walk,
layout-hygiene, responsive-audit and dialogs against the local fixture stack. Take before/after
screenshots at 1440x900 and 390x844 of every screen you changed, and list what you removed.
Stop and report if anything fails instead of working around it.
```

## After — 27 October 2026

The integrated `ui/deslop` branch has a shared token vocabulary, reusable CSS classes, a flatter
overview, workspace, project picker, Management, Reports, forms, media tools, and a simpler public
site. GitHub Actions run [40603265052](https://github.com/LeoRanoe/CodeCoNV/actions/runs/40603265052)
passed the web, database, and authenticated Playwright jobs. Its 56 after-screenshots cover sign-in,
project selection, six main modules, and 20 workspace destinations at 1440×900 and 390×844. The
screenshots were reviewed for the banned patterns, and the final images are in
[after/](ui-slop-audit/after/). Docker Desktop's Linux engine remains unavailable locally.

| Measure | Before | After | Target / note |
| --- | ---: | ---: | --- |
| Distinct app CSS hex values | 718 | 26 | ≤ 40; values now live in `tokens.css` |
| Defined app type sizes | 73 | 6 | 6; raw `font-size` declarations still have 18 syntax forms due to `clamp()` and `!important` |
| Defined app weights | 18 | 3 | 3: 400, 600, 700 |
| Defined app radii | ~20 | 3 | 3: 6 px, 10 px, pill; raw declarations have compound forms |
| Non-`none` app shadows | 81 | 1 | 1 overlay shadow |
| App media breakpoints | 15 | 3 | 640, 1024, 1280 px |
| `globals.css` lines | 15,850 | 30 | Split into imports |
| All app CSS lines, including imports | 15,850 | 14,544 | 1,306 lines shorter; ordered legacy fragments still need semantic consolidation |

**Phase 5 remains incomplete.** The token definitions meet the numeric targets, but the full CSS
has 18 distinct `font-size` declaration forms and 16 distinct radius forms after counting
`clamp()`, compound corners, and aliases. The CSS split still uses 12 ordered legacy fragments to
preserve declaration order; the named area files currently hold screen overrides. This does not
complete the planned semantic one-file-per-area cleanup. The four old button aliases have been
removed from app and test source. A conservative dead-rule pass removed 387 unused legacy rules;
the surviving selector/declaration stream was unchanged.

`stylelint` is error-level across app and landing CSS, with zero findings after the landing token
pass. The app guardrail checks are error-level and allow exactly one photo text scrim. The numeric
token targets pass (26 colours, 6 sizes, 3 weights, 3 radii, 1 shadow, 3 breakpoints).

Screenshots after the public-site changes: [desktop](ui-slop-audit/after/landing-strict-desktop-viewport.jpg)
and [phone](ui-slop-audit/after/landing-strict-phone-viewport.jpg). Authenticated examples:
[Overview phone](ui-slop-audit/after/overview-phone.jpg),
[Workspace desktop](ui-slop-audit/after/workspace-desktop.jpg),
[Issues desktop](ui-slop-audit/after/workspace-issues-desktop.jpg),
[Project Docs phone](ui-slop-audit/after/workspace-project-docs-phone.jpg), and
[Drawings phone](ui-slop-audit/after/workspace-drawings-pins-phone.jpg). The original screenshots
remain in [ui-slop-audit](ui-slop-audit/). These fixture screens do not show uploaded private media,
live share recipients, or a real phone's camera, keyboard, and GPS.

On this machine `docker info --format '{{.ServerVersion}}'` still returns: `failed to connect to the
docker API at npipe:////./pipe/dockerDesktopLinuxEngine ... The system cannot find the file
specified.` The CI fixture stack supplied authenticated browser verification instead.

A targeted cleanup removed decorative eyebrows from the main forms and captured workspace views,
made selection orange and record counts neutral, removed tinted empty-state icon boxes, and kept one
orange primary action while a form is open. Error/offline views and states outside the CI fixture
screens remain outside this visual sign-off.

## Readability and navigation pass � 27 October 2026

A review of the signed-in app on the local stack found regressions from the mechanical token pass,
and fixed them:

- **Invisible sidebar navigation.** The sidebar background had been mapped to white while its text
  stayed white, so every nav label was unreadable. It is now a light surface with dark ink; orange marks
  only the current page.
- **Text size.** The smallest type token went from 12 px to 14 px (the scale is now 14, 16, 18, 22,
  28 px). Most of the app was set at 12 px.
- **Tap targets.** Workspace modules are cards of at least 84 px (72 px on phones); sidebar items are
  48 px; action rows are at least 80 px; checkboxes and radios are 22 px with 48 px labels.
- **Header.** One row of equal controls. The connection chip is an icon and shows text only when saving,
  offline or in error. The weather chip is neutral. The settings gear is removed because Management is
  in the sidebar and the phone navigation.
- **Phone overview** counts form a two-by-two ruled block. Page headers align left. Tracked uppercase
  labels are removed from headings, legends and record facts; status badges keep them.
- **Project picker and sign-in** use the same light header and larger rows and fields as the workspace.

Verified on this commit: `npm run lint`, `npm test` (190 passing), `npm run test:design` (9 passing) and
the authenticated Playwright suite against the local Supabase stack (90 passed, 57 skipped by project
configuration, 0 failed). The 56 screenshots in [after/](ui-slop-audit/after/) were recaptured.

Still open: the 12 ordered legacy CSS fragments are not yet consolidated into per-area files, and
private-media, external-share and real-device states are unverified.

## Sources

- [How to detect AI slop in your design — ux-skill wiki][wiki]
- [DeSlop][deslop]
- [How to de-slopify your designs — uxdesign.cc][uxd]
- [I tried to make Claude Code stop producing AI slop — UX Planet][uxplanet]
- [The prompts that force AI to give you beautiful frontend design — Medium][prompts]
- [The free tool that fights AI design slop (Impeccable) — stork.ai][impeccable]
- [Stylelint rules (`color-no-hex`)][stylelint]
- [Polaris stylelint rules][polaris]

[wiki]: https://github.com/Laith0003/ux-skill/wiki/How-to-detect-AI-slop-in-your-design
[deslop]: https://github.com/nate-zz/DeSlop
[uxd]: https://uxdesign.cc/how-to-de-slopify-your-designs-4c40c57c1dc9
[uxplanet]: https://uxplanet.org/i-tried-to-make-claude-code-stop-producing-ai-slop-fa594f6b5981
[prompts]: https://medium.com/@okyerevansjohn/the-prompts-that-force-ai-to-give-you-beautiful-frontend-design-and-why-most-builders-skip-them-00f1348aeb63
[impeccable]: https://www.stork.ai/blog/the-free-tool-that-fights-ai-design-slop
[stork]: https://www.stork.ai/blog/the-free-tool-that-fights-ai-design-slop
[stylelint]: https://github.com/stylelint/stylelint/blob/56f9fca3fd451f0652ff10c44258da1271d0eebe/docs/user-guide/rules.md
[polaris]: https://polaris.shopify.com/tools/stylelint-polaris/rules
