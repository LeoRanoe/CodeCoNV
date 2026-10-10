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
| LQA-007 | P3 | Materials-delivery line row wider than its card | fixed – retest pending |
| LQA-008 | P3 | NCR card says "sent link" when none was sent | fixed |
| LQA-009 | P3 | Contractor page shows English enum names, calls an NCR "FINDING" | fixed |
| LQA-010 | P3 | "In progress" stage counts rejected findings | fixed |
| LQA-011 | P3 | Project Docs has two visible `h1` | open |
| LQA-012 | P3 | Deep link `nav=punchlist` without `tab` shows the Workspace grid | open |
| LQA-013 | P3 | Contractor page status badge stays stale after a submit | open |

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
| LQA-007 | At 1024 px the materials-delivery line row (370 px) sits in a 349 px column; the remove button leaves the card by 21 px | CSS minimums lowered, `min-width: 0` on the row; the dev server served stale CSS during the audit, retest pending |
| LQA-008 | NCR card read "Waiting for the contractor's answer through the sent link." before any link existed | now conditional on an active link; otherwise "No contractor answer yet." |
| LQA-009 | Dutch contractor page printed `FINDING · Q-2026-0003` for an NCR (raw enum) | "NCR", "Bevinding", "Actie", "Inspectie", "Foto" |
| LQA-010 | Workspace "In progress" stage counted `rejected` findings (terminal) | removed |
| LQA-011 | Project Docs renders two visible `h1` | open |
| LQA-012 | `?nav=punchlist` without `tab` renders the Workspace grid while "Issues" is highlighted | open; the app itself never produces that URL |
| LQA-013 | After a submit the contractor page keeps the old status badge until reload | open |
