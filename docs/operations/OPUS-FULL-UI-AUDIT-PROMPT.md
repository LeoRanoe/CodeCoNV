# Prompt: overnight audit of UI, gaps against the client documents, and usability (for Claude Opus)

How to use: open a new Claude Code session on Opus in `D:\CodeCoNV`, set the permission mode so it can run for hours without asking (edit, run, browser), attach `CODECO_Developer_Package_v5.zip` (Excel v5.0, Word v2.0, mockups v6) if the session cannot read it from disk, and paste everything below the line. The prompt is written to run for a whole evening by itself and to survive a context reset.

---

You are the independent auditor and fixer for **CODECO Supervision** (`D:\CodeCoNV`, Next.js 16 in `apps/web`, local Supabase). The owner is away until tomorrow. A previous model (Sonnet) rebuilt the app from the client's v5 package and the owner now sees **layout defects across the whole website, including the sidebar, and too much stuff in the sidebar**. Earlier reports said "all tests pass", and the tests did not catch these defects. Trust nothing: look at the real screens, compare with the client's documents line by line, and judge whether what we built is logical and easy to use. You have the whole evening. Use it. Do not stop at the first findings, do not ask questions, do not hand back early.

## 0. The mission in one paragraph

Find and fix (1) every visual or layout defect, (2) every gap or difference between the client's documents and our implementation, and (3) everything that is not user-friendly or not logical, in particular the **information architecture**: what is in the sidebar and top bar, what is duplicated, what is in the wrong place, how many taps a job takes. Fix what is clearly wrong. For judgement calls, decide, record the decision with its evidence, and make it easy to reverse. At the end, prove it with screenshots, tests and a report.

## 1. Rules that cannot be broken

- Read first, completely: `CLAUDE.md`, `apps/web/AGENTS.md` (this Next.js has breaking changes: read `apps/web/node_modules/next/dist/docs/` before touching routing or config), `docs/product/design-direction.md`, `docs/operations/ui-ai-slop-audit.md`, `apps/web/app/styles/tokens.css`, `brand.css`, `final-pass.css` (loaded last), and every file in `docs/operations/client-spec-audit/` whose name starts with `V5-` (decision register, traceability, gap report, UX review, QA report, handover).
- UI rules: tokens only for colour, type, radius and shadow. Status colour only for record state; orange only for the current selection and one primary action per view. No gradients, glass, tinted icon squares, uppercase eyebrows, coloured modules, nested cards, invented figures, fake empty-state content or looping motion. Keep behaviour, permissions, accessible names, roles and test selectors. If you must change a selector, change the tests in the same commit and say so in the log.
- **Never touch production.** `apps/web/.env` points at the production Supabase and Blob store. Use only the local stack (`apps/web/.env.development.local`; the dev server is the `codeco-web-dev` entry in `.claude/launch.json`, port 3000). Never run seeders or tests against anything but `127.0.0.1`.
- **Do not merge, do not push to `main`, do not deploy, do not apply migrations to any hosted project.** Merging to `main` deploys to production. Work on one new branch from `main`, open one pull request at the end (draft early is fine), leave it unmerged.
- Local stack on Windows: `export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"`, then `npx --yes supabase@2.109.1 start`. Seed: `node apps/web/tests/e2e/seed-local-fixtures.mjs` (prints the test login), `node apps/web/tests/e2e/seed-ui-demo-data.mjs` (client and contractor users and demo records). The Docker recovery steps are in the memory file `codeconv-local-stack.md`. Never run two `supabase test db` at once.
- Windows editing: many files are CRLF. Use the Edit tool, or Python with `newline=''` that keeps each file's line endings. Write patch scripts to `tmp/`, not shell heredocs that contain quotes.
- Never ask the owner an open-ended question. Decide and continue. A real conflict between two client sources goes into the decision register as a **client question** with your chosen default, and work goes on.

## 2. Work loop that survives a context reset

1. Create the branch `audit/opus-overnight` from `main` and a log file `docs/operations/client-spec-audit/OPUS-AUDIT-LOG.md`. Keep in it: the phase you are in, the findings table (ID, screen, viewport, role, what is wrong, severity blocker/major/minor, evidence path, status open/fixed/won't-fix with reason), decisions, and "next step".
2. **Update the log and commit after every finding batch (at least every 45 minutes), and push the branch.** If your context is reset, re-read this prompt, the log and `git log`, then continue from "next step". Never start over.
3. Work through the phases in section 3 in order, but keep looping: after Phase 6, start again at Phase 2 with fresh eyes on the screens you fixed, until a full pass finds no new blocker or major. Run at least two full passes.
4. You may use subagents (the Agent tool) for read-only reading and comparison of the client documents (for example one per Excel sheet group and one for the Word) so the main session keeps its context. Only one agent writes code at a time. Verify what an agent reports before you rely on it.
5. Run long commands (the full Playwright gate takes about 17 minutes) in the background and keep working on something else.

## 3. Phases

### Phase 1: Baseline and tools (about 30 minutes)

Start the local stack, seed, run `npm test`, `npx tsc --noEmit`, `npx stylelint "app/**/*.css"`, lint, and `tests/e2e/ui-stability-audit.spec.ts`. Record the result. Check that you can drive the app in the browser pane (`mcp__Claude_Browser__*`) at an exact viewport (`resize_window` with width and height), sign in with the local test login, and take and **read** screenshots. Set up an automated walk (extend `apps/web/tests/e2e/ux-walk.spec.ts`, opt-in with `UX_WALK=1`) that screenshots every screen of section 4 in every viewport and role of section 5 into `tmp/audit/<viewport>/<role>/`, so you can re-run it after fixes.

### Phase 2: Look at every screen (the visual audit)

For every screen in section 4, in every viewport and role in section 5, with empty data, normal data (`seed-ui-demo-data.mjs`) and stress data (`CODECO_E2E_STRESS=1`: long names), in English and Dutch: read the screenshot and write down every defect. Also measure in the DOM with a script: overlapping boxes, clipped or off-screen controls, `scrollWidth > clientWidth`, a footer or action bar that is not reachable, controls under 44 px, text under 12 px, missing focus ring, illogical tab order, double scrollbars, empty grid areas, hints that describe controls that are not there, sticky bars that cover the field being typed in, anything that moves when data loads. **Short screens matter as much as narrow ones**: 1366×768 and 1280×720 laptops are normal users.

Defects the previous pass already found and fixed (verify they hold, then hunt for the same classes elsewhere): the sidebar project picker overlapping the "Workspace" label and the user card falling off the bottom at 800 px height (now only the page list scrolls); the Location card with no drawing leaving its left half empty; rows with several controls not aligned; a CSS custom property used but not defined.

### Phase 3: The client documents against our implementation (the gap audit)

Authority: **Excel v5.0 for form fields** (labels, order, dropdown values, dependencies, requiredness, defaults, record IDs, workflow/sign-off rows), **Word v2.0 for menus, portals, Actions, Rapid Verify, Reports, Management and permissions**, **mockups v6 (`mockups/00-15`) for layout**. A later written client decision beats an older one (see `V5-DECISION-REGISTER.md`). Do not copy the earlier traceability table: re-derive it.

- Forms: for each of the 15 workspace modules, list every Excel row and compare with the screen field by field (label text, order, control type, list values, which fields are required, conditional show and hide, defaults, auto fields, units, record ID format, sign-off roles and steps) and with what is stored and exported (PDF, Word, Excel export, report builder). A script that reads the Excel and the form spec (`apps/web/lib/forms/spec-forms.ts`, `forms-v5-field-list.txt`) is welcome, but also open every form in the browser.
- Word: every numbered section, every menu, submenu, portal view, permission and rule. For each, find where it lives in the app and test it as the right role, including the denied path.
- Mockups: put each of the 16 mockup images next to the real screen at the mockup's width and list every difference (layout, grouping, labels, controls, empty and conditional states). Known open differences: drawing and pin in the Location card for seven forms (needs a per-record pin store), the form header (icon, breadcrumb, Draft pill, time estimate), AUTO / DEFAULT / FROM DRAWING tags, dashed "Shown because…" panels, and mockups 00 Overview, 01 Photos, 04 Workforce, 09 Inspections that were never compared. Decide which to build tonight; build the ones that are layout or small and do not need a migration. Anything that needs a database migration: design it, write it as a new numbered file in `supabase/migrations/`, run it on the local database with pgTAP, and **do not apply it anywhere else**; list it in the report.
- Output: a complete, new traceability table in the report: source (Excel sheet and row, Word section, mockup number), requirement, where in the app, result (matches, differs, missing, extra), evidence. "Extra" means we show something the client never asked for: judge it in Phase 4.

### Phase 4: Logic and information architecture (the "too much in the sidebar" audit)

The sidebar today: Overview, Workspace, Actions (with badge), Rapid Verify, Project Documents, Records & Photos, Reports, Contractor Portal, Client Portal, Management, a "Take photo" button, the project picker and the user card. The top bar adds breadcrumb, Help, weather, language, day-start and notifications. The Workspace screen is a grid of 15 modules plus a "Supporting tools" row (Rapid Verify, Project Docs, Assets & folders, Drawings & pins, Calculator & notes, Deadlines) and Records & Photos shows the same 15-module grid again. On a phone there is a bottom bar plus a floating "Photo" button besides the sidebar's "Take photo". Judge, with the Word's menu list as the authority:

- Does every sidebar item match a Word menu? What is extra, what is missing, what is in the wrong group? Which items belong to a role (supervisor, contractor, client) and should not appear for others?
- What is duplicated (same destination reachable from two or three places, two "take photo" entry points, two copies of the module grid, Rapid Verify and Project Docs both in the sidebar and in Supporting tools)? Which duplicate is the right one to keep?
- Is the order the order of a working day (look, capture, record, follow up, report, manage)? Are frequent jobs (new record, photo, find a record, what is still open) one or two taps away?
- Is the vocabulary consistent (the same thing never has two names; Dutch and English match)? Are counts and badges meaningful and correct?
- Proposal and decision: write the target structure (what is in the sidebar, what moves into Workspace, what moves into the top bar or a "More" group, what disappears), with the Word clause or the usability reason for each move. Implement it if it is a small, safe change that keeps routes, permissions, deep links (`nav=` and `tab=` parameters) and accessible names; update the tests in the same commit. If a change is large or contradicts the Word, do not do it: put it in the report as a recommendation with a mock of the result. Either way, record it in the decision register.

### Phase 5: User-friendliness walk-throughs

Judge as a site supervisor on a phone in the sun, wearing gloves, with bad signal. For each job, count taps and screens, find what is slow or unclear, and fix it: take a photo and attach it to a record; open a form, fill it, sign, submit; see what is still missing before submit; find an old record; answer an action as a contractor; review and sign off as a client; build a report; check a document against the specs in Rapid Verify; switch project or building; work offline and come back online; recover from an error. Check: one clear primary action per view; button labels say what happens; destructive actions confirmed; touch targets; text size and contrast (WCAG AA); error messages that say what to do; no dead ends or blank states; no duplicated controls (the Issues list shows about ten buttons per card: group the secondary ones into one menu and keep one or two primary actions); popups only where context must stay visible (drawings, signing) and inline elsewhere; long forms show progress and keep the action bar reachable; the keyboard on a phone never hides the field or the bar; Dutch strings complete and natural. Copy follows the memory note `feedback-quiet-operational-copy`: facts, not prose; keep offline, error and legal text.

### Phase 6: Fix, test, prove

Fix blockers and majors first, then minors. Fix the cause in the shared rule (shell, tokens, form grid, shared components) rather than patching screen by screen, and keep each commit small with a message that names the finding IDs. Add tests that fail on what you found: overlap and clipping at short heights (extend `ui-stability-audit.spec.ts` to 1366×768, 1280×720, 1024×768, 820×1180, 390×844 and 844×390 for every screen of section 4), the sidebar always showing its footer, no empty grid area in a card, the menu structure of the decision, and field-by-field form checks generated from the Excel. Run the full gate in the background (`tmp/full-gate-v5.sh` or `tmp/ci-like-gate.sh`) after each major batch and before the final push. A red gate is not finished.

## 4. Screens in scope (all of them)

Sign-in and password recovery; project list; new configured project; Overview; Workspace launcher and its supporting tools; the 15 modules: Photos, Works ongoing, Works completed, Workforce, Project Delay Report, Issues, HSE, Materials delivery, Inspections, Technical instructions, Change order, NCR, Lessons Learned, HSE incident, Agreements Made (each: list, filters, empty state, create form, saved record, edit, withdraw, sign-off, PDF and Word export); Actions (all views and filters); Rapid Verify (sources, spec search, spec compliance check, queue); Project Documents; Records & Photos (every tab); Reports and the report builder; Contractor Portal and Client Portal (own login **and** the supervisor's "view as" preview), every submenu; Management (every section); notifications, Help, language switch, weather and day-start controls; every dialog and popup (Sign now, drawing and pin picker, Issue dialog, close/verify/approve, photo capture and edit, external-party link, project switcher); the phone bottom bar and its "More" sheet.

## 5. Viewports and roles

Viewports: 1920×1080, 1440×900, **1366×768**, **1280×720**, 1024×768, 820×1180, 390×844 and 844×390 (phone landscape). Roles: supervisor, contractor, client, and a limited or read-only user (see `docs/operations/role-permission-matrix.md`). States: empty, normal, long names, English, Dutch, loading, error, offline.

## 6. Definition of done (do not stop before all are true, or before you have worked about eight hours)

- Every screen in section 4 was looked at in every viewport and role in section 5, at least twice (two passes), and the log says so with screenshot paths.
- Zero open blockers and majors in the log; every minor is fixed or has a reason.
- A new traceability table covers every Excel row, every Word section and every mockup; no row says "done" without evidence; anything you could not verify says "not verified" with the reason.
- The information-architecture decision is written, implemented or recommended with a mock.
- New tests fail without the fixes and pass with them; unit, tsc, stylelint, lint, build, pgTAP and the full Playwright gate are green on the final commit.
- The branch is pushed, one pull request is open and **not merged**, and CI is green or its failures are explained.

## 7. Deliverables and the final report

Files: `docs/operations/client-spec-audit/OPUS-AUDIT-REPORT.md` (findings, fixes, the traceability table, the menu decision, what remains, what was not verified, client questions, any migration file and why it is not applied), the updated `V5-DECISION-REGISTER.md`, the log, and before/after screenshots in `docs/operations/ui-stability-audit/opus-<date>/`. Final message to the owner, in Dutch and short: what was wrong, what you fixed, what is still open, the pull request link, and the single decision you need from them.
