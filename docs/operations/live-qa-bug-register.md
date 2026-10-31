# Live QA — bug register

Branch `qa/live-website-audit`, started from `main` at `1fe8f1c` (PR #3 merged, deployed to
production as `dpl_9eaBkJJDyoNP6XayFDquaBEkvr3u`). Evidence for every row was gathered in a
browser; "browser retest" says where. Production was only read (see
`live-website-feature-audit.md`, "What was and was not done on production"); every defect that
needed a write to reproduce was reproduced on the local fixture stack.

Severity: P0 data loss, cross-project access, unauthorised signature, production unusable ·
P1 failed save, wrong business state, broken lifecycle, repeated or incorrect records ·
P2 confusing workflow, inconsistent behaviour, wrong counts, poor error handling ·
P3 cosmetic or redundant copy.

Status values: **fixed** (committed, automated test, browser retest), **fixed – retest pending**,
**open**, **accepted** (decision recorded).

| ID | Sev | Feature | Status |
| --- | --- | --- | --- |
| LQA-001 | P2 | Overview counts | fixed |
| LQA-002 | P1 | Row caps in the project loader | fixed |
| LQA-003 | P1 | Contractor link overwrites signed corrective action | fixed – migration not yet on production |
| LQA-004 | P2 | Status step offered to a role that cannot take it; misleading refusal | fixed |
| LQA-005 | P2 | Disabled save buttons without a reason | fixed |
| LQA-006 | P2 | Two taps create two documents | fixed |
| LQA-007 | P3 | Materials-delivery line row wider than its card | fixed |
| LQA-008 | P3 | NCR card says "sent link" when none was sent | fixed |
| LQA-009 | P3 | Contractor page shows English enum names, calls an NCR "FINDING" | fixed |
| LQA-010 | P3 | "In progress" stage counts rejected findings | fixed |
| LQA-011 | P3 | Project Docs has two visible `h1` | fixed (2026-10-31) |
| LQA-012 | P3 | Deep link `nav=punchlist` without `tab` shows the Workspace grid | fixed (2026-10-31) |
| LQA-013 | P3 | Contractor page status badge stays stale after a submit | fixed |
| LQA-014 | P1 | A refused session keeps showing the cached workspace as live | fixed |
| LQA-015 | P3 | Several phone/tablet controls are 24–35 px high | accepted (design) |

## LQA-001 · P2 · Overview shows zero for things the project has

- **Reproduction (production, signed in as CODECO Administrator):** *First construction project*
  → Overview. Cards read Inspections **0**, Pictures **0**, Open follow-up **0**, "Under
  control", "No open actions". The Workspace tiles on the next screen read Inspections 7,
  Photos 20; Management reads "7 inspections recorded"; the Action Center lists 7 open and
  7 escalated issues (up to 82 days overdue); the project card says "0 open actions".
- **Expected:** one reading of the project on every screen.
- **Root cause:** `ClientDashboard` counted the day report's timeline entries for inspections
  and pictures, and only the `actions` table for follow-up and the health badge. The Action
  Center merges actions, findings/NCRs and registers with a deadline. Three screens had three
  definitions of "open"; the project card even counted `rejected` findings as open although the
  database treats `rejected` as terminal.
- **Fix:** `lib/actions/open-work.mjs` is the single reading (built on the Action Center's own
  predicates); the Overview and the project card use it; inspections and pictures are
  project-wide head counts; a card shows a dash until its count has loaded instead of a zero.
  Commit `6b48a68`.
- **Automated test:** `tests/open-work.test.mjs` (the live case: 7 overdue findings, no
  actions); `tests/e2e/overview-counts.spec.ts` asserts Overview = Workspace tile = Action
  Center and fails on the old code (Expected 0, received 1).
- **Browser retest:** local stack, Overview now reads Open follow-up 11 (5 high priority),
  "Action needed", Inspections 1 "In project". Not yet on production.

## LQA-002 · P1 · Records past the first 100 silently disappear

- **Reproduction (local fixture stack, 125 findings in one project):** Workspace tile **Issues
  100**, **NCR 0**, although one NCR is open. The NCR was older than the newest 100 rows and was
  missing from the Issues list, the Action Center and the offline copy.
- **Expected:** every record, and a count that matches.
- **Root cause:** `loadProjectOperations` read findings, inspections and HSE with
  `.limit(100)`, files with 500, visual captures 250; the API itself returns at most 1000 rows
  per request (`max_rows`), so the `.limit(5000)`/`.limit(20000)` reads of registers, links and
  record-building rows were cut at 1000 as well. The project list and the Overview had the same
  problem. Nothing on screen said rows were missing.
- **Fix:** `lib/supabase/page-all.mjs` reads page by page up to a high ceiling and reports when the
  ceiling is reached; used by the project loader (18 queries), the project list and the
  Overview. Commit `a07a7fb`.
- **Automated test:** `tests/page-all.test.mjs` (2450 rows across three pages, exact multiples,
  empty table, failing page, ceiling, and a source check that the loader has no fixed small
  `.limit`).
- **Browser retest:** local stack, Workspace now reads Issues 124, NCR 1.
- **Residual risk:** a project beyond the ceilings (20 000 findings, 50 000 file links) is read
  up to the ceiling; `pageAll` returns `truncated` but no screen shows it yet. Memory and load
  time for very large projects were not measured.

## LQA-003 · P1 · A contractor link can overwrite a signed corrective action

- **Reproduction (local, NCR `Q-2026-0003`):** contractor proposes a correction with name,
  position and a drawn signature; reports the work ready (status `ready_for_verification`); a
  further `proposed_correction` through the same link is accepted and replaces the text, the
  signer ("Late Contractor") and the signature on the NCR. The NCR card then read "Signed by
  Late Contractor" under the new text. The first signature image existed nowhere else
  (`external_share_responses` had no signature column), so it was lost.
- **Expected:** a record that is waiting for CODECO's verification, or finished, is not the
  contractor's to rewrite; every signed answer stays in the history.
- **Root cause:** `submit_external_share_response` updated `proposed_correction` and the
  `correction_*` signature keys whatever the finding's status; only the status change itself
  was conditional.
- **Fix:** migration `202610100005`: answers keep position and signature in their own row; a
  closed, cancelled, rejected or draft finding and a finished action accept no answer; a
  finding waiting for verification accepts a problem report and a repeated "ready" but not a new
  proposal (SQLSTATE 55000). The route answers 409 in Dutch; the contractor page stops offering
  the form. Commit `c4aea58`.
- **Automated test:** pgTAP `020_external_response_respects_record_status` (20 assertions).
- **Browser retest:** UI part retested locally; the database part needs the migration on the
  target database (see `live-qa-release-verification.md`).
- **Not covered:** an `action` share link for a finished action is refused by the same
  function but has no pgTAP assertion.

## LQA-004 · P2 · Status step offered to a role that cannot take it

- **Reproduction (local, role `supervisor`):** the NCR card offers "Quality control · resolve".
  After filling the whole verification form including a signature, "Confirm" ends with "This
  record no longer exists or you no longer have access to it." The role matrix gives the site
  supervisor neither `findings.verify` nor `findings.manage`; the database is right to refuse.
- **Root cause:** the step button had no permission check, and `P0002` ("not found or not
  accessible") was always worded as "no longer exists".
- **Fix:** the button mirrors the database rule (assignee, `findings.manage`, or
  `findings.verify` for close/reopen); the refusal reads "This record was removed, or your role
  cannot change it." Commit `c4aea58`.
- **Automated test:** none for the UI gate (needs a second fixture role in the NCR flow);
  `tests/e2e/role-views.spec.ts` covers the other role views.

## LQA-005 · P2 · Disabled save buttons without a reason

- **Reproduction:** Technical Instruction with title and description filled: "Create
  controlled document" stays disabled; the recipient and the deadline are required but
  nothing says so. The NCR "Confirm" button had the same behaviour.
- **Fix:** a "Still needed: …" line above the button for the register form and the NCR step.
  Commits `c4aea58` and the one after it.
- **Browser retest:** local, reads "Still needed: title · description · recipient · deadline"
  and disappears when complete.

## LQA-006 · P1 · Two taps create two documents

- **Reproduction (local):** fill a Technical Instruction and click "Create controlled
  document" twice in one task: `TI-…-002` and `TI-…-003` were created 0.6 ms apart with
  different keys. A real double-click is two tasks and usually hits the disabled button; the
  window is real on a slow phone.
- **Root cause:** `run()` used a render-based `busy` flag only.
- **Fix:** a synchronous in-flight ref in `run()`.
- **Automated test:** `tests/e2e/double-submit.spec.ts`.

## LQA-007 … LQA-013

| ID | What | Notes |
| --- | --- | --- |
| LQA-007 | At 1024 px the materials-delivery line row (370 px) sits in a 349 px column; the remove button leaves the card by 21 px | CSS minimums lowered, `min-width: 0` on the row; retested on a production build at 1024 px: overhang 0 px (was 21 px) |
| LQA-008 | NCR card read "Waiting for the contractor's answer through the sent link." before any link existed | now conditional on an active link; otherwise "No contractor answer yet." |
| LQA-009 | Dutch contractor page printed `FINDING · Q-2026-0003` for an NCR (raw enum) | "NCR", "Bevinding", "Actie", "Inspectie", "Foto" |
| LQA-010 | Workspace "In progress" stage counted `rejected` findings (terminal) | removed |
| LQA-011 | Project Docs renders two visible `h1` | fixed 2026-10-31: the document centre's heading is an `h2` under the workspace's `h1` |
| LQA-012 | `?nav=punchlist` without `tab` renders the Workspace grid while "Issues" is highlighted | fixed 2026-10-31: a bare `nav=punchlist` or `nav=projectdocs` opens its module (`screen-url.mjs`, node field-workflows) |
| LQA-013 | After a submit the contractor page keeps the old status badge until reload | fixed: `router.refresh()` after the reply; asserted in `media-and-sharing.spec.ts` (badge reads "Gereed voor verificatie" without a reload), passed 31-10-2026 on the production fake-Blob build |

## LQA-015 · P3 · Small touch targets (accepted)

Measured on a production build at 390 and 820 px: weather chip 65×35, storage icon 32×32, the
filter chips and supporting-tool buttons on the Workspace 34 high, the type tabs on the Action
Center 34 high, and three text links ("Open workspace", "All actions", "View all") 24 high at
820 px. All meet WCAG 2.5.8 (24 px) and are below the 44 px that is usual on a phone.
Preserving the approved design was part of the brief, so nothing was changed; raising the chips to
40 px is a one-line CSS decision for the product owner.

## LQA-014 · P1 · A refused session keeps showing the cached workspace as live

- **Reproduction (local):** sign in on a device, then remove the account behind the session
  (here: a database reset). Reload. `GET /auth/v1/user` answers **403 Forbidden**, yet the app
  opens on "My projects" with the account's cached projects (124 issues, 134 open actions) and the
  banner "Online · Live workspace · synchronized".
- **Expected:** a server that answers and refuses the session ends it; the offline copy is for a
  server that cannot be reached. A suspended or removed person must not keep reading project data
  on a device because it is cached.
- **Root cause:** `workspaceQuery` fell back to the cached workspace on *any* error.
- **Fix:** `lib/supabase/session-rejection.mjs` tells a refusal (`user_not_found`,
  `session_not_found`, `bad_jwt`, `PGRST301`, 401/403 with a token/session message) from silence
  (fetch failures, 5xx, row-level-security refusals). A refusal signs the device out locally and
  shows the sign-in screen. `fail()` now keeps the HTTP status so the distinction survives.
- **Automated test:** `tests/session-rejection.test.mjs`; `tests/e2e/session-revoked.spec.ts`
  (a 403 on `/auth/v1/user` returns to sign-in; an unreachable server still opens the cached
  workspace).
- **Browser retest:** local pane at 390 px: the same stale session now lands on the sign-in screen.
- **Residual risk:** the cached copy of that account stays on the device until it is removed
  ("remove offline copy") or the account signs in again; it is not readable without a session.

## QA sweep 2026-10-28 (LQA-016 and up)

Branch `fix/qa-sweep-2026-10-28`. One row per finding of `qa-full-sweep-2026-10-28.md`; the report ID is in the
second column. Status values as above, plus **owner step** (a hosted or production change only the owner can make). The evidence per row, the test output and what
was not done are in `qa-fix-verification-2026-10-28.md`.

| ID | Report | Sev | What | Status | Test | Commit |
| --- | --- | --- | --- | --- | --- | --- |
| LQA-016 | H1 | P1 | Contractor cannot submit anything, no message — ensure_day_report_for_record plus two patched functions | fixed | pgTAP 021 (19); e2e contractor-submission | 2f2d9e1 |
| LQA-017 | H2 | P1 | Action center tabs broken up to 1024 px | fixed | e2e action-center-tabs (8 widths, 320-1024); fails on the old CSS | 892f2b6 |
| LQA-018 | H3 | P1 | Share buttons unreadable — Secondary button style | fixed | e2e a11y-audit (contrast; run with demo data) | 1fb083e |
| LQA-019 | H4 | P1 | Formal day report wrong per building — Building filter, inspection result, no default 42, no borrowed progress, critical count from records | fixed | node daily-report-model (11); e2e day-report-lifecycle reads the PDF | cb0d0ec |
| LQA-020 | H5 | P1 | Photo stack hidden on desktop — Saving the photo itself needs a Blob store; not testable locally | fixed | e2e media-desktop-upload (fails on the old CSS) | 2bdae55 |
| LQA-021 | M1 | P2 | Help window under the sidebar — First-visit opening is remembered once it is closed (existing behaviour); a per-user server setting was not built | fixed | e2e help-layer | af5141a |
| LQA-022 | M2 | P2 | Contractor and client see admin screens and buttons — One name: Beheer / Management | fixed | e2e role-views (typed address, Management) | daf328a |
| LQA-023 | M3 | P2 | Project creation offered to contractor/client, prefilled, misleading error — The red chip clears after 8 s | fixed | e2e role-views; manual | daf328a |
| LQA-024 | M4 | P2 | 'New action' cannot be finished — Decision: the assignee is optional on creation (the action stays with its creator until it is assigned); creating a central action stays with actions.manage, so the contractor does not get the button | fixed | pgTAP 024 (8); e2e action-without-assignee (fails on the old form) | 2f2d9e1, c5fa4c5 |
| LQA-025 | M5 | P2 | Photo count differs — The tile counts photos and 360° images like the library; the tab and library leave drawings out | fixed | node field-workflows (isPhotoFile); no browser test | 2222abb |
| LQA-026 | M6 | P2 | Disabled submit buttons without a reason — Issue, NCR and HSE name what is missing; the odd placeholder is gone | fixed | source assertion in rendered-html (3 forms) | 2222abb |
| LQA-027 | M7 | P2 | Issue counters disagree — Tile and tab use one definition; the Action Center counts actions, not issues, and was not changed | fixed | node field-workflows (countOpenFindings) | 2222abb |
| LQA-028 | M8 | P2 | Drawing pin confirmation far away, record does not open — Run against the fake Blob store. Found on the way: a pin that was already selected did not bring its card into view again, a panel taller than the window never moved, and a link to one record still opened the module with its form | fixed | e2e media-and-sharing (confirm and open buttons in the viewport at 1280x720; the linked record opens without the empty form) | 2222abb, 4c962ef |
| LQA-029 | M9 | P2 | 360 dialog button overlaps the controls — aria-pressed on Auto turn; close button 48 px | fixed | CSS rule, no measurement test | 892f2b6 |
| LQA-030 | M10 | P2 | Fixed photo bar covers content | fixed | CSS reserve, no measurement test | 892f2b6 |
| LQA-031 | M11 | P2 | Contrast below 4.5:1 — --ink-600, --signal-dark | fixed | e2e a11y-audit (7 screens x 2 layouts; fails on the old tokens) | 1fb083e |
| LQA-032 | M12 | P2 | Period PDF shows raw values — PDF and Word | fixed | node period-report-text (6); e2e period-report reads the PDF | e2db9f5 |
| LQA-033 | M13 | P2 | Expected workforce 42 prefilled — Migration 202610280004 | fixed | node daily-report-model; e2e day-report-lifecycle | cb0d0ec |
| LQA-034 | M14 | P2 | Login errors not announced | fixed | e2e login-a11y | 3657afb |
| LQA-035 | M15 | P2 | Recovery mail English, redirect to production — Done and checked locally. The hosted project reads none of supabase/config.toml: steps 1-3 and 5 of auth-recovery-and-rate-limits.md are the owner’s | owner step | manual: local Mailpit after a stack restart (Dutch subject and body, redirect_to 127.0.0.1) | 3657afb |
| LQA-036 | M16 | P2 | Misleading message after an online HSE save | fixed | no dedicated test | 2bdae55 |
| LQA-037 | M17 | P2 | Day report lacks the client’s form — Sections 1-18 as tables plus KPI block; GPS, cloud cover, rain, HSE checklist, machines and measurements are 'Niet geregistreerd' because they are not captured | fixed | node daily-report-model; e2e day-report-lifecycle | cb0d0ec |
| LQA-038 | M18 | P2 | Expired recovery link not explained | fixed | e2e login-a11y | 3657afb |
| LQA-039 | M19 | P2 | 'Still needed' lines too vague (PDR, CO) — PDR and CO name the real fields; the photo on the original finish date is named | fixed | node missing-lists (2) | 2222abb |
| LQA-040 | M20 | P2 | PDR saved before its mandatory photos are confirmed — Decision: a delay report and a lesson learned need a connection; when the required photos are not confirmed the record is withdrawn, the queued photos are removed and the form keeps what was typed | fixed | e2e delay-report-evidence (saved with the photo; withdrawn again when the photo is refused, fails on the old logic) | 4c962ef |
| LQA-041 | M21 | P2 | Wrong message after an online 360 upload | fixed | no dedicated test | 2bdae55 |
| LQA-042 | M22 | P2 | Selects without a name — Six selects | fixed | e2e a11y-audit | 1fb083e |
| LQA-043 | M23 | P2 | Contrast: 62 nodes | fixed | e2e a11y-audit | 1fb083e |
| LQA-044 | M24 | P2 | Overflow at 400% zoom (Middelen, Management) | fixed | e2e reflow-320 (14 screens at 320 px; failed on Middelen and Management before) | 889d19f |
| LQA-045 | M25 | P2 | Landmarks and headings — aside became div/section, the sign-in screen is a main; heading-order passes on 8 screens | fixed | e2e a11y-audit (landmark rules, heading-order, NCR screen) | 1fb083e, 3657afb, 2222abb |
| LQA-046 | M26 | P2 | Drawing counted as photo; a folder per upload — The overview Pictures count still included drawings and unavailable files; it follows the library rule now | fixed | node field-workflows (isPhotoFile, overview query); e2e media-and-sharing (count unchanged after a drawing; one folder after two saves; fails on the old query) | 2222abb, 4c962ef |
| LQA-047 | M27 | P2 | 'Not saved' bar stays after saving — The bar listens to draft changes | fixed | no dedicated test | 892f2b6 |
| LQA-048 | L1 | P3 | 12-hour time in the draft notice — All twelve time inputs are an hour list and a minute list on a 24-hour clock | fixed | node field-workflows (split/join); e2e time-field under an en-US browser | 21f49f7, ac34b0c |
| LQA-049 | L2 | P3 | RFI form: English chip, preset function — English chip, preset function and the colon in 'Aan' are gone; the form has no chips any more | fixed | node rendered-html (labels) | 21f49f7, 889d19f |
| LQA-050 | L3 | P3 | window.confirm() for pin removal — Inline confirmation with role=alertdialog | fixed | source assertion in rendered-html | 2222abb |
| LQA-051 | L4 | P3 | Empty drawing panel, permanent green bar — Not started | fixed | visual (CSS and render condition), source assertion | 2222abb, 889d19f |
| LQA-052 | L5 | P3 | Sidebar project picker truncates — Two lines and a title before the name is cut | fixed | visual (CSS) | 889d19f |
| LQA-053 | L6 | P3 | Loose 'Open normal photo' buttons — The two buttons got a one-line label and only show with files.manage | fixed | visual | 2222abb |
| LQA-054 | L7 | P3 | 'Author' filter only has 'All authors' — The filter is hidden when no record has an author; filling it from created_by was not done | fixed | - | 2222abb |
| LQA-055 | L8 | P3 | Checkbox names, code label, skip link — The code input of 'Add building' sits in a label in the code; no unlabelled input was found. The skip link has no test of its own | fixed | e2e tap-targets (checkbox names); node rendered-html (building code label) | 892f2b6, 3657afb, e145229 |
| LQA-056 | L9 | P3 | NL/EN mix — Decision (docs/product/taalbeleid.md): what the app writes follows the language; the names of the client’s own forms and modules (Workforce, Issues, Project Docs, Change order (CO), NCR title) stay as the client writes them. The TI answers and a few labels were still English and are translated | fixed | node rendered-html (labels, TI answers, policy document) | 21f49f7, 86b692d |
| LQA-057 | L10 | P3 | Invalid ?project=<id> falls back silently — Not started | fixed | e2e role-views | 2222abb |
| LQA-058 | L11 | P3 | Share page: green primary, red eyebrow, labels, badge | fixed | manual; router.refresh after a reply | 1fb083e, 2972ae8 |
| LQA-059 | L12 | P3 | Test data on production — Nothing here writes to production. apps/web/scripts/find-test-records.mjs lists the records read-only and docs/operations/production-test-data.md says how to withdraw them; the withdrawal is the owner’s | owner step | finder run against the local stack (15 hits for a test pattern) | 9c3841e |
| LQA-060 | L13 | P3 | Touch targets under 44 px — Issue form tiles and the register steppers, remove buttons, shift inputs and sync chip reach 44 px up to 1024 px; ui-button--md (40 px) and the quick-pick chips (39 px) are the design system size and unchanged | fixed | e2e tap-targets (phone and tablet); e2e register-touch-targets (fails on the old CSS) | 892f2b6, 39dfcdb, 66290f3 |
| LQA-061 | L14 | P3 | Contractor reads colleagues' telephone numbers — Column closed to signed-in users | fixed | pgTAP 022 (4) | daf328a |
| LQA-062 | L15 | P3 | Old notices stay after a screen change — A confirmation belongs to its screen and fades after 8 s; no dedicated test | fixed | - | 889d19f |
| LQA-063 | L16 | P3 | Permission RPCs and duplicate day report call — 60 s cache for the two permission checks | fixed | e2e contractor-submission (one request per save) | 2f2d9e1 |
| LQA-064 | L17 | P3 | Silent 503 on notification dispatch — Answers 200 with pushActive:false and logs a warning | fixed | - | 2f2d9e1 |
| LQA-065 | L18 | P3 | 'Choose the planned work' error out of view — The reason shows next to the button and the page scrolls to it | fixed | source assertion in rendered-html | 889d19f |
| LQA-066 | L19 | P3 | No delay after repeated failed logins — The local limit (20 per 5 minutes) is set and asserted. The hosted project has its own value (Dashboard, Authentication, Rate limits): step 4 of auth-recovery-and-rate-limits.md is the owner’s | owner step | node rendered-html (config.toml limit) | 3657afb, e145229 |
| LQA-067 | L20 | P3 | PDF details; 'Add person' three times — Clicking 'Add person' for the same party and trade raises the count; the e2e adds 4 and 3 and expects 7 | fixed | e2e day-report-lifecycle (plural, no hyphenation; 4 clicks give 4 people) | cb0d0ec |
| LQA-068 | L21 | P3 | Overview says nothing happened — Both lines say 'today' | fixed | - | 2222abb |
| LQA-069 | L22 | P3 | 'Project locations 0' — 'Ruimtes en zones' | fixed | - | 2222abb |
| LQA-070 | L23 | P3 | Two terms for the same wait; '1/9' — One term for the verification wait; a tile counts within the chosen type, a tab within the chosen state | fixed | e2e action-center-tabs (fails on the old code: 11 versus 9) | 2222abb, e145229 |
| LQA-071 | L24 | P3 | Console warnings, load time, a 401 — Geist Mono is no longer preloaded, the unused Hind weight is gone and a failed daily backup check is retried after 10 minutes. The one slow load and the 401 on production were not reproducible; the spec holds the budget and the clean console | fixed | e2e first-load (no refused request, no console error, no unused preload, under 8 s) | e145229, 868b0d5, 9c3841e |
| LQA-072 | L25 | P3 | Inspection completion sends 16 requests — One save_inspection_responses call; migration 202610280006 | fixed | pgTAP 023 (6); e2e inspection-workflow counts the requests | 889d19f |
| LQA-073 | L26 | P3 | English content in seeded checklists and findings — Decision: the checklists are the client’s own English reference forms and a signed inspection keeps the text that was signed, so authored content is not translated; Dutch checklists would be new content with their own version | fixed | docs/product/taalbeleid.md; node rendered-html | 86b692d |
| LQA-074 | L27 | P3 | Bare file input on 'Visueel bewijs' — ::file-selector-button | fixed | CSS, no test | 2bdae55 |
| LQA-075 | L28 | P3 | pgTAP not isolated; no H1 test — pgTAP 021 covers H1; 14 files used to fail on a database with seed data | fixed | supabase test db on a seeded database (592 pass, data intact); node rendered-html (every file that creates an organization truncates first) | 2f2d9e1, 39dfcdb |
| LQA-076 | L29 | P3 | Admin text in the upload 503 | fixed | - | 2bdae55 |
| LQA-077 | L30 | P3 | No confirmation after a password change — 'Wachtwoord gewijzigd' on the project list | fixed | manual | 3657afb |
| LQA-078 | L31 | P3 | Recovery screen errors not announced | fixed | e2e login-a11y (sign-in); same markup on the recovery screen | 3657afb |
| LQA-079 | L32 | P3 | Records load twice, flicker, double-submit test fails — Flicker not investigated. double-submit.spec.ts passed on a production build in this pass (1 passed), so the failing test of the report did not reproduce | fixed | e2e records-no-flicker (shows loading-content-loading without the fix) | 074d82e |
| LQA-080 | walkthrough | P3 | Action center tab labels and counts painted red; a type menu showed "1/9" beside the count — A stale rule coloured every span in the tabs like a late record | fixed | e2e action-center-tabs (label colour, no position chip; fails on the old CSS) | 4e81ac6 |
| LQA-081 | walkthrough | P3 | Second row of the overview counts indented 16 px at 768 px | fixed | e2e overview-metrics-tablet (fails on the old CSS) | 4e81ac6, bac9083 |
| LQA-082 | walkthrough | P3 | Weather labels touch their values at 1440 px — Labels wrap above the value | fixed | visual (live weather needs the Open-Meteo service) | 4e81ac6 |
| LQA-083 | walkthrough | P3 | Register steppers, remove buttons, shift inputs and the sync chip 33-38 px on a tablet — Found by measuring every workspace destination at 768 px | fixed | e2e register-touch-targets (fails on the old CSS: stepper 35 px) | 66290f3 |
| LQA-084 | walkthrough | P3 | A client was told to assign a record nobody owns — Walkthrough finding: only someone with actions.manage is told to assign | fixed | e2e role-views (client sees the waiting wording, supervisor still the order) | 045de7f |

## Launch audit 2026-10-31 (LQA-085 and up)

Evidence, reproduction and verification per row: `LAUNCH-AUDIT-2026-10-31.md`.

| ID | Audit | Sev | What | Status |
| --- | --- | --- | --- | --- |
| LQA-085 | CAM-1 | P1 | A photo stack never saves (direct update on read-only `visual_captures`; production has no stacked capture at all) | fixed locally; production needs migration `202610310001` |
| LQA-086 | CAM-2 | P1 | Form photo buttons refuse an Android JPEG labelled `image/jpg` or untyped | fixed |
| LQA-087 | CAM-3 | P2 | A HEIC photo disappears without a word | fixed; iPad conversion awaits a device |
| LQA-088 | CAM-4 | P1 | On mobile data the library's Save keeps photos on the device | fixed (emulated); awaits an Android SIM device |
| LQA-089 | CAM-5 | P1 | Offline photo before the project was opened is lost; workspace loads for ever | fixed |
| LQA-090 | CAM-6 | P1 | Offline save in the library uploads the photo twice | fixed |
| LQA-091 | CAM-7 | P3 | "Upload is waiting" stays after a successful Send now | fixed |
| LQA-092 | CAM-8 | P3 | Screen readers hear "Back online." on every load | fixed |
| LQA-093 | UI-1..3 | P2 | White plate around the logo; tablet overview queue and workspace modules below the first screen | fixed |
