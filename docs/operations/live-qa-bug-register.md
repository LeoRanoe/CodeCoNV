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
| LQA-011 | P3 | Project Docs has two visible `h1` | open |
| LQA-012 | P3 | Deep link `nav=punchlist` without `tab` shows the Workspace grid | open |
| LQA-013 | P3 | Contractor page status badge stays stale after a submit | open |
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
| LQA-011 | Project Docs renders two visible `h1` | open |
| LQA-012 | `?nav=punchlist` without `tab` renders the Workspace grid while "Issues" is highlighted | open; the app itself never produces that URL |
| LQA-013 | After a submit the contractor page keeps the old status badge until reload | open |

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
second column. Status values as above, plus **partly fixed**. The evidence per row, the test output and what
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
| LQA-024 | M4 | P2 | 'New action' cannot be finished — Button only for actions.manage, hint reworded; assigning to the party itself needs a database change and a product decision | partly fixed | - | 2f2d9e1 |
| LQA-025 | M5 | P2 | Photo count differs — Not started | open | - | - |
| LQA-026 | M6 | P2 | Disabled submit buttons without a reason — Not started for Issue, HSE, NCR | open | - | - |
| LQA-027 | M7 | P2 | Issue counters disagree — Not started | open | - | - |
| LQA-028 | M8 | P2 | Drawing pin confirmation far away, record does not open — Not started | open | - | - |
| LQA-029 | M9 | P2 | 360 dialog button overlaps the controls — aria-pressed on Auto turn; close button 48 px | fixed | CSS rule, no measurement test | 892f2b6 |
| LQA-030 | M10 | P2 | Fixed photo bar covers content | fixed | CSS reserve, no measurement test | 892f2b6 |
| LQA-031 | M11 | P2 | Contrast below 4.5:1 — --ink-600, --signal-dark | fixed | e2e a11y-audit (7 screens x 2 layouts; fails on the old tokens) | 1fb083e |
| LQA-032 | M12 | P2 | Period PDF shows raw values — PDF and Word | fixed | node period-report-text (6); e2e period-report reads the PDF | e2db9f5 |
| LQA-033 | M13 | P2 | Expected workforce 42 prefilled — Migration 202610280004 | fixed | node daily-report-model; e2e day-report-lifecycle | cb0d0ec |
| LQA-034 | M14 | P2 | Login errors not announced | fixed | e2e login-a11y | 3657afb |
| LQA-035 | M15 | P2 | Recovery mail English, redirect to production — Local redirects and Dutch template done; Mailpit end-to-end not run; the hosted project is a manual step | partly fixed | - | 3657afb |
| LQA-036 | M16 | P2 | Misleading message after an online HSE save | fixed | no dedicated test | 2bdae55 |
| LQA-037 | M17 | P2 | Day report lacks the client's form — Sections 1-18 as tables plus KPI block; GPS, cloud cover, rain, HSE checklist, machines and measurements are 'Niet geregistreerd' because they are not captured | fixed | node daily-report-model; e2e day-report-lifecycle | cb0d0ec |
| LQA-038 | M18 | P2 | Expired recovery link not explained | fixed | e2e login-a11y | 3657afb |
| LQA-039 | M19 | P2 | 'Still needed' lines too vague (PDR, CO) — Not started | open | - | - |
| LQA-040 | M20 | P2 | PDR saved before the mandatory photos are confirmed — Not started | open | - | - |
| LQA-041 | M21 | P2 | Wrong message after an online 360 upload | fixed | no dedicated test | 2bdae55 |
| LQA-042 | M22 | P2 | Selects without a name — Six selects | fixed | e2e a11y-audit | 1fb083e |
| LQA-043 | M23 | P2 | Contrast: 62 nodes | fixed | e2e a11y-audit | 1fb083e |
| LQA-044 | M24 | P2 | Overflow at 400% zoom (Middelen, Management) — Not started; 320 px is not in responsive-audit yet | open | - | - |
| LQA-045 | M25 | P2 | Landmarks and headings — aside became div/section, the sign-in screen is a main; heading order unchanged | partly fixed | e2e a11y-audit (landmark rules) | 1fb083e, 3657afb |
| LQA-046 | M26 | P2 | Drawing counted as photo; a folder per upload — Not started | open | - | - |
| LQA-047 | M27 | P2 | 'Not saved' bar stays after saving — The bar listens to draft changes | fixed | no dedicated test | 892f2b6 |
| LQA-048 | L1 | P3 | 12-hour time in the draft notice — Draft notice fixed; native time inputs unchanged | partly fixed | - | 21f49f7 |
| LQA-049 | L2 | P3 | RFI form: English chip, preset function — The 'Aan:' colon and the chip spacing are not done | partly fixed | - | 21f49f7 |
| LQA-050 | L3 | P3 | window.confirm() for pin removal — Not started | open | - | - |
| LQA-051 | L4 | P3 | Empty drawing panel, permanent green bar — Not started | open | - | - |
| LQA-052 | L5 | P3 | Sidebar project picker truncates — Not started | open | - | - |
| LQA-053 | L6 | P3 | Loose 'Open normal photo' buttons — Not started | open | - | - |
| LQA-054 | L7 | P3 | 'Author' filter only has 'All authors' — Not started | open | - | - |
| LQA-055 | L8 | P3 | Checkbox names, code label, skip link — Skip link exists but has no test; the code input of 'Add building' still has no label | partly fixed | e2e tap-targets (checkbox names) | 892f2b6, 3657afb |
| LQA-056 | L9 | P3 | NL/EN mix — NCR labels only; HSE types, 'Issues', 'Workforce', 'Project Docs' unchanged (language policy is a product decision) | partly fixed | node rendered-html (labels) | 21f49f7 |
| LQA-057 | L10 | P3 | Invalid ?project=<id> falls back silently — Not started | open | - | - |
| LQA-058 | L11 | P3 | Share page: green primary, red eyebrow, labels, badge | fixed | manual; router.refresh after a reply | 1fb083e, 2972ae8 |
| LQA-059 | L12 | P3 | Test data on production — Manual step for the product owner; no safe delete or archive action was built | open | - | - |
| LQA-060 | L13 | P3 | Touch targets under 44 px — The headings at 768 px were not found or measured | partly fixed | e2e tap-targets | 892f2b6 |
| LQA-061 | L14 | P3 | Contractor reads colleagues' telephone numbers — Column closed to signed-in users | fixed | pgTAP 022 (4) | daf328a |
| LQA-062 | L15 | P3 | Old notices stay after a screen change — Not started | open | - | - |
| LQA-063 | L16 | P3 | Permission RPCs and duplicate day report call — 60 s cache for the two permission checks | fixed | e2e contractor-submission (one request per save) | 2f2d9e1 |
| LQA-064 | L17 | P3 | Silent 503 on notification dispatch — Answers 200 with pushActive:false and logs a warning | fixed | - | 2f2d9e1 |
| LQA-065 | L18 | P3 | 'Choose the planned work' error out of view — Not started | open | - | - |
| LQA-066 | L19 | P3 | No delay after repeated failed logins — Local limit 20 per 5 minutes, no test; the production value is a manual step | partly fixed | - | 3657afb |
| LQA-067 | L20 | P3 | PDF details; 'Add person' three times — PDF done; the 'Add person' behaviour is unchanged | partly fixed | e2e day-report-lifecycle (plural, no hyphenation) | cb0d0ec |
| LQA-068 | L21 | P3 | Overview says nothing happened — Not started | open | - | - |
| LQA-069 | L22 | P3 | 'Project locations 0' — Not started | open | - | - |
| LQA-070 | L23 | P3 | Two terms for the same wait; '1/9' — Not started | open | - | - |
| LQA-071 | L24 | P3 | Console warnings, load time, a 401 — Not started | open | - | - |
| LQA-072 | L25 | P3 | Inspection completion sends 16 requests — Not started | open | - | - |
| LQA-073 | L26 | P3 | More NL/EN mix in content — Not started | open | - | - |
| LQA-074 | L27 | P3 | Bare file input on 'Visueel bewijs' — ::file-selector-button | fixed | CSS, no test | 2bdae55 |
| LQA-075 | L28 | P3 | pgTAP not isolated; no H1 test — Isolation from seed data not done | partly fixed | pgTAP 021 covers H1 | 2f2d9e1 |
| LQA-076 | L29 | P3 | Admin text in the upload 503 | fixed | - | 2bdae55 |
| LQA-077 | L30 | P3 | No confirmation after a password change — 'Wachtwoord gewijzigd' on the project list | fixed | manual | 3657afb |
| LQA-078 | L31 | P3 | Recovery screen errors not announced | fixed | e2e login-a11y (sign-in); same markup on the recovery screen | 3657afb |
| LQA-079 | L32 | P3 | Records load twice, flicker, double-submit test fails — Flicker not investigated. double-submit.spec.ts passed on a production build in this pass (1 passed), so the failing test of the report did not reproduce | open | - | - |

