# CODECO UAT: partial run (not a completed UAT)

Run ID: UAT-2026-11-21 (America/Paramaribo, evening). Status: **started, not complete**. `UAT-SOURCE-RESULTS.csv` was **not** produced, and no source ID has a Pass or Fail recorded from this run. The checker was not run.

Local URL / release: http://127.0.0.1:3090, `/api/release` = commit `9e9c92bbbc9f`, branch `claude/sixth-pass-release-record`, environment local, deployment `local-uat`, expected schema `202611250001`.
Browser: Claude built-in browser, viewport about 997x845 (the layout rendered in its phone/mobile arrangement).
Sources: runbook, `DECISIONS-PENDING.md`, source register (1,079 rows) read. `COMPLETION-CHECKLIST.md` (200 KB), the original workbook, Word spec and images 1-15 were not opened. They are on the Desktop.

## Observed so far (role: supervisor-a)

| Case | Status | Observed |
|---|---|---|
| Sign-in (local fixture) | Pass | Signed in at `/supervisie`; project list shows E2E-001 Paramaribo Field Readiness Demo and E2E-OTHER Other Organisation Project. |
| M01 Overview | Partial | Dashboard renders; "Planned: No baseline schedule in the app" (no invented figures), matches decision 12. Open follow-up tile shows 20 while report context shows Open actions 5 and Action completion "1 completed · 5 open". Needs a check whether these are different measures or a mismatch. |
| M02 Workspace | Pass | All 15 destinations listed: Photos, Works ongoing, Works completed, Workforce, PDR, Issues, HSE, Materials delivery, Inspections, TI, CO, NCR, LL, HSE incident, Agreements Made. |
| W01 Works Ongoing | Partial | Form opens as a draft with project, location, date, prepared-by header and Report date, Shift and Work discipline (required). Discipline list has 17 values. Required-error, dependent clear, save and reopen not exercised. |
| Observation | To confirm | The Works ongoing register shows TI and CO records under "Formal client documents" (3 controlled records). Check against the intended register scope. |
| Observation | To confirm | supervisor-a sees the Other Organisation Project in its project list. Check against the J04 isolation expectation (may be the fixture administrator role). |

## Not run

Everything else: W02-W15 (beyond the W01 open), M03-M10, J01-J07, the production check, and all 1,079 register rows. The register contains no results.

## Why this stopped

A full run needs roughly a thousand per-row observations with evidence plus file-based checks (uploads, exports, images 1-15, Excel/Word comparison). A single interactive session would produce unreliable or invented rows if pushed through. I did not fill any.

## Acceptance recommendation

Not ready to accept on the basis of this run. Continue in batches (see the proposal in the session).
