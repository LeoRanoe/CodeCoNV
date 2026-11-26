# Prompt: full UI, gap and usability audit (for Claude Opus)

Copy everything below the line into a new Claude Code session on Opus, opened in `D:\CodeCoNV`. Attach `CODECO_Developer_Package_v5.zip` (Excel v5.0, Word v2.0, mockups v6) if the session cannot read it from disk.

---

You are the independent auditor and fixer for **CODECO Supervision** (`D:\CodeCoNV`, Next.js 16 in `apps/web`, local Supabase). A previous model (Sonnet) rebuilt the forms and layout from the client's v5 package, and the owner reports **layout defects across the whole website, including the sidebar**. Do not trust earlier claims that "it passed". The existing Playwright and unit tests did not catch these defects, so your job is to look at the real screens, find what is wrong, fix it, and add checks that would have caught it.

## 0. Rules that cannot be broken

- Read first: `CLAUDE.md`, `apps/web/AGENTS.md` (this is a newer Next.js than you know: read `apps/web/node_modules/next/dist/docs/` before touching routing or config), `docs/product/design-direction.md`, `docs/operations/ui-ai-slop-audit.md`, `apps/web/app/styles/tokens.css`, `brand.css`, `final-pass.css` (loaded last).
- UI rules: tokens only for colour, type, radius and shadow. Status colour only for record state; orange only for the current selection and one primary action per view. No gradients, glass, tinted icon squares, uppercase eyebrows, coloured modules, nested cards, invented figures, or looping motion. Keep behaviour, permissions, accessible names, roles and test selectors.
- **Never touch production.** `apps/web/.env` points at the production Supabase and Blob store. Use only the local stack (`apps/web/.env.development.local`). Local login for the UI: `supervisor-a@codeco.test` with the password printed by `node tests/e2e/seed-local-fixtures.mjs` (see `apps/web/tests/e2e/seed-local-fixtures.mjs`, `fixtures`). Role accounts: `node tests/e2e/seed-ui-demo-data.mjs` adds client and contractor users.
- Local stack on Windows: `export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"`, then `npx --yes supabase@2.109.1 start`. Start the app with the `codeco-web-dev` entry in `.claude/launch.json` (port 3000). If Docker fails after sleep, see the recovery note in the memory file `codeconv-local-stack.md`.
- Windows editing: many files are CRLF. Edit with the Edit tool, or read and write with `newline=''` in Python and keep the file's line endings. Write patch scripts to `tmp/`, not shell heredocs with quotes.
- **Do not merge, push to `main`, deploy, or apply production migrations without the owner's explicit yes in chat.** Work on one branch and one pull request. Merging to `main` deploys to production.
- Do not ask open-ended "what next" questions. Decide, do it, and report. Ask only for a decision that is the owner's (a conflict between client sources).

## 1. Method: look at the real screens, not only at tests

For every screen listed in section 3, in **each** viewport and **each** role:

- Viewports: 1920×1080, 1440×900, **1366×768**, **1280×720**, 1024×768 (tablet landscape), 820×1180 (tablet portrait), 390×844 (phone), and a phone in landscape (844×390). Many users have short laptop screens, so **viewport height matters as much as width**.
- Roles: supervisor, contractor, client, and a read-only or limited user (see `docs/operations/role-permission-matrix.md`).
- States: empty, one record, many records, long names (`CODECO_E2E_STRESS=1`), Dutch and English, loading, error, offline.

Take a screenshot of each, **read it**, and write down every defect. Use the browser pane (`mcp__Claude_Browser__*`) or Playwright (`apps/web/tests/e2e/ux-walk.spec.ts`, opt-in with `UX_WALK=1`, writes `tmp/ux-walk/<width>/`). Also measure in the DOM: for every interactive element check bounding boxes for overlap, clipping, `scrollWidth > clientWidth`, controls under 44 px, text under 12 px, focus ring visible, tab order logical. Extend `tests/e2e/ui-stability-audit.spec.ts` so it runs at the short heights above and covers every screen in section 3.

## 2. Defects already found (fixed in the working tree, verify they hold, then look for the same class elsewhere)

1. **Sidebar** (`.sidebar` in `app/styles/shell.css`, `brand.css`, `final-pass.css`): at 800 px height the project picker overlapped the "Workspace" label and the user card fell off the bottom, because the flex column shrank its children and nothing scrolled. Now only the page list scrolls and the rest keeps its size. Check every height from 600 to 1200, the collapsed and tablet widths (220 px), the badge counts, the active marker, long project names, and the phone bottom navigation (`--mobile-nav-height`).
2. **Location card** with no drawing (Issue, NCR, HSE, Technical instruction, Change order, Delay report, HSE incident): the place in words was pushed into the right half and the left half was empty, under the hint "Pick the drawing and tap the spot". Fixed: full width and the hint "Where is it?".
3. **Rows with several controls** (for example "Responsible party" and "Name of the responsible person"): the first control has no caption, so it sat higher than its neighbours. Fixed with bottom alignment.
4. A CSS custom property used in TSX without being defined (`--span`) failed the design-guardrails test in CI.

Look for the same classes everywhere: flex or grid children that shrink or overlap on short screens, empty grid areas, hints that describe controls that are not there, sticky bars that cover content or inputs (the form action bar is `position: sticky` at the bottom: check it never hides the field being typed in, on phone with the keyboard open, and when the form is shorter than the screen), double scrollbars, nested cards, and layouts that only work at one width.

## 3. Screens to audit (all of them)

Sign-in, project list, new configured project; Overview; Workspace launcher and the supporting tools; **all 15 workspace modules**: Photos, Works ongoing, Works completed, Workforce, Project Delay Report, Issues, HSE, Materials delivery, Inspections, Technical instructions, Change order, NCR, Lessons Learned, HSE incident, Agreements Made (each: list, filters, empty state, create form, saved record, edit, sign-off, PDF/Word export); Actions; Rapid Verify (sources, spec search, spec compliance check, queue); Project Documents; Records & Photos (all tabs); Reports and the report builder; Contractor Portal and Client Portal (own login **and** supervisor "view as" preview); Management (all sections); notifications, Help, language switch, weather and day-start controls; every dialog and popup (Sign now, drawing and pin picker, Issue dialog, close/verify/approve, photo capture and edit, external-party link); the phone bottom navigation and the "More" sheet.

## 4. Gaps against what the client asked

Sources, in this order of authority: Excel v5.0 for form fields (labels, order, dropdowns, dependencies, requiredness, defaults, record IDs); Word v2.0 for menus, portals, Actions, Rapid Verify, Reports, permissions; mockups v6 (`mockups/00-15`) for layout. Later written decisions win; see `docs/operations/client-spec-audit/V5-DECISION-REGISTER.md`, `V5-REQUIREMENTS-TRACEABILITY.md`, `V5-GAP-REPORT.md`, `V5-UX-REVIEW.md`. Known open differences from the mockups (list them in your report and decide which to build): drawing and pin in the Location card for seven forms (needs a per-record pin store), the form header (icon, breadcrumb, Draft pill, time estimate), AUTO/DEFAULT/FROM DRAWING tags, dashed "Shown because…" panels, and the unchecked mockups 00 Overview, 01 Photos, 04 Workforce, 09 Inspections. Compare every form field by field with `forms-v5-field-list.txt` and the Excel, and check each conditional field shows and hides as the Excel says. Anything you cannot verify, mark "not verified" with the reason: do not write "done".

## 5. User-friendliness (judge as a site supervisor on a phone in the sun, wearing gloves)

For each flow, count taps and screens, and fix what is slow or unclear: record a photo → attach to a record; open a form → fill → sign → submit; find a record; see what is still needed before submit; recover from an error and from being offline; switch project or building. Check: one clear primary action per view; labels that say what happens; dangerous actions confirmed; touch targets; text size and contrast (WCAG AA); error messages that say what to do; no dead ends; no duplicated controls (for example the Issues list shows about ten buttons per card: group them); popups used where context matters (drawings, signing) and inline where it does not; Dutch strings complete and natural; copy follows `feedback-quiet-operational-copy` (facts, not prose; keep offline, error and legal text).

## 6. Work plan and deliverables

1. Run the baseline: `npm test`, `npx tsc --noEmit`, `npx stylelint "app/**/*.css"`, lint, build, and Playwright `tests/e2e/ui-stability-audit.spec.ts`. Record the result.
2. Walk every screen, role and viewport of sections 1 and 3. Keep a findings table: ID, screen, viewport, role, what is wrong, severity (blocker, major, minor), screenshot path, fix.
3. Fix blockers and majors in the CSS and components. Prefer fixing the cause in the shared rule (shell, tokens, form grid) over per-screen patches. Keep the changes small and reviewable.
4. Add tests that fail on the defects you found (overlap, clipping, off-screen footer, empty grid area, short viewport), and run the full gate: `tmp/full-gate-v5.sh` or `tmp/ci-like-gate.sh` (about 17 minutes, run it in the background).
5. Write `docs/operations/client-spec-audit/OPUS-AUDIT-REPORT.md`: findings table, what you fixed, what remains and why, what you could not verify, and client questions. Update the decision register where a choice was made.
6. Open one pull request from a new branch, wait for CI, and report. Do not merge.

Report in Dutch, briefly: what was wrong, what you fixed, what is still open, and the one decision you need from the owner.
