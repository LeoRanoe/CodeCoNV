# CODECO Supervision UAT run report, 2026-11-21

Local UAT run (http://127.0.0.1:3090/supervisie, project Paramaribo Field Readiness Demo, local fixture accounts, local Supabase and fake Blob store). The candidate was deployed to production on 2026-11-22; what was and was not verified there is under "Production release" at the end. No real notification was sent, no production record was written other than the migrations, and no credential appears in this report. Supersedes UAT-PARTIAL-REPORT-2026-11-21.md.

## Totals (1079 source IDs, saved in UAT-SOURCE-RESULTS.csv)

| Source | Pass | Fail | Blocked | Not run | Reference | Total |
|---|---:|---:|---:|---:|---:|---:|
| Mind map | 119 | 0 | 0 | 0 | 0 | 119 |
| Excel | 548 | 0 | 0 | 0 | 44 | 592 |
| Word | 295 | 0 | 0 | 0 | 73 | 368 |
| **All** | 962 | 0 | 0 | 0 | 117 | 1079 |

Next source ID to run: **none (all accounted for)**

## Failed rows (0)

| ID | Observed |
|---|---|

## UAT verdict

**Accepted for the local candidate and deployed; production sign-in verification still open.** Every one of the 1,079 source IDs has a result and the coverage checker reports 0 coverage errors. Totals: **Pass 962, Fail 0, Blocked 0, Not run 0, Reference 117**. The two rows that were open are closed with evidence: XL-16-005 (the shared unit list) passes because CODECO approved all 13 values (Decision 18), so the form sheets' 11 values are a client-approved variance, and WD-192 (inspection notification) passes after the move-back-to-a-previous-time case was fixed and re-tested. Nothing in this report is a production acceptance of the signed-in screens: every Pass row's evidence is from the local build (fixture accounts, fake Blob store). What was verified on production is listed under "Production release" below.

"0 coverage errors" only means every row has a status and evidence. A Pass here means the local build behaved as the original asks.

## Coverage checker output

```
Excel · Pass: 548 · Reference: 44
Mind map · Pass: 119
Word · Pass: 295 · Reference: 73
0 coverage errors. 0 rows report Fail, Blocked or Not run.
```

(Command: `python apps/web/scripts/uat-source-coverage.py --check-results docs/operations/client-spec-audit/UAT-SOURCE-RESULTS.csv`. No row is Fail, Blocked or Not run.)

## Defects found and fixed in this run

| # | Defect | Fix | Verified |
|---|---|---|---|
| 1 | Workforce row: choosing Shift = Other asked for no shift description (XL-16-003). | Required "Shift description for <trade>" input, stored as `spec.shift_other`, hidden again for another shift (`apps/web/app/workforce-register.tsx`). | Live on the rebuilt stack (`tmp/uat/fixes-live.mjs`: input present, required, hidden after switching back). |
| 2 | Project Documents register had no Revision filter (WD-066). | Revision filter next to Discipline, Status, Originator, Building and dates, included in the export filter text (`apps/web/app/document-register.tsx`). | Live (filter present, options from the register) and `tests/portal-and-documents.test.mjs` 13/13 with new revision assertions. |
| 3 | The new first-use Help dialog opened over the contractor and client portals and blocked 47 existing Playwright specs that sign in as those roles. | The specs now mark the portal guides as seen, as they already did for the supervisor guide. The first-use behaviour itself is intended. | `word-17-journeys` (16 passed after the change; it failed before). |
| 4 | `day-overview-export.spec.ts` could not save a Materials Delivery record: the fixture project has no storage locations configured (an administrator maintains that list), so an accepted, stored-on-site delivery cannot be saved. | The spec unchecks "Stored on site" as `sheet-forms.spec.ts` already does. Product behaviour unchanged: it follows the workbook (required only when stored on site). | Passed alone after the change. |
| 6 | WD-192: no notification when an inspection was planned or updated. | New migration `202611250002_inspection_notifications.sql` and pgTAP 041 (local database only; not applied to production). | pgTAP 041 2/2. |
| 7 | Status read as a dropdown in the workbook (7 rows). | Decision 16 records the workflow-derived status, accepted by the project owner on 2026-11-22. No code change. | pgTAP 030 #8, #9, #16, #17. |
| 8 | WD-181-02: no editable project information in Management (dates and currency were not stored at all). | `Management > Project information` (`project-information.tsx`) and migration `202611250003` (start and end dates, currency, checks, trimming, time zone check; local database only). Edits need `project.configure`. | pgTAP 042 11/11; `project-information-disciplines.spec.ts` (persistence after reload; field supervisor, contractor and client cannot edit; REST refusal). |
| 9 | WD-181-06 and WD-053-05: disciplines fixed at 17 and Project Documents took free text. | A per-project "Project disciplines" list in Management (the 17 are locked, additions are per project); Project Documents create and edit use it, keep older free-text values, and the filter and Excel export return the saved discipline. | `spec-forms.test.mjs`, `portal-and-documents.test.mjs` (43/43 with the server-rule tests); `project-information-disciplines.spec.ts` (create, edit, older value, filter, xlsx export, other project unchanged, 3 viewports, axe, Dutch). |
| 10 | WD-192: an inspection could not be planned for a colleague in the app, so the notification could not be tried through the screen. | "Plan it for a colleague or for later" in Workspace > Inspections, a Planned inspections list with Reschedule, and migration `202611250004` (`plan_project_inspection`, `reschedule_project_inspection`, `list_inspection_executors`; local database only). | `inspection-notification.spec.ts` 4/4; pgTAP 043 13/13; pgTAP 041 2/2 kept as separate trigger evidence. |
| 5 | Client and contractor portal on a phone: the grid let a wide table widen the page and hide the Help button. | `.portal-section` uses `minmax(0, 1fr)`; the Help button sits in the portal header. | `visual-walkthrough.spec.ts` checks no sideways overflow per section. |

## Open items

No source row is open. Items that need CODECO accounts, a real device or a production sign-in are listed under "Production release" below; they are not Pass rows.

Questions recorded for CODECO (none blocks the build; defaults are in `DECISIONS-PENDING.md`, Decision 17 and the list below it): whether a project's own disciplines should also appear in the 15 workbook forms (default: no, they keep the 17); which currency a new project starts with (default: none); whether the project time zone should be editable (default: no, America/Paramaribo).

Other observations that are not Fail rows:

- Workforce counts a person as on site for every attendance status (earlier finding 4, `workforce-flow.json`); not re-examined in this run.
- On Project Documents, "New controlled record" opens the formal register form (RFI, RFA, WIR, TI, CO, ER) with the type last used, so it can open on Materials Delivery.
- The photo file input lists JPEG, PNG and WebP; HEIC handling (Decision 3) needs a real-device check.
- The Management section tabs and a long Works Completed title were noted earlier (accessible name, overlap); the stability and axe audits did not flag them in this run.
- The workbook has no Workforce or Inspection sheet; those two sign-off profiles are verified through XL-17-016 and XL-17-021 only.

## Decisions used

The recorded decisions in `DECISIONS-PENDING.md` (1 to 17) were applied as the source of truth. They were taken from the client's own material, not confirmed by the client in conversation; WD-255 to WD-264 pass because each open question is answered by one of them and the answer is built. CODECO should still confirm Decisions 3, 10, 11 and 12 before go-live (file limit and retention, signature effect, roles, notification schedule). The "outside the application" list remains: e-mail sender configuration, real-device camera checks, a backup restore drill, a signed-in production walkthrough and leaked-password protection.

## In-app visual walkthrough

**Where:** the Help button. Supervisors have it floating at the bottom right as before; contractors and clients have it in the portal header. It opens automatically the first time a person signs in (once per role on that device, `codeco-field-guide-seen-v3` and `codeco-portal-guide-seen-v1-<role>`), focus starts on the dialog and returns to the Help button when it closes. The original quick help and the A-Z reference are kept under "Quick help and reference".

**Role coverage**

| Role | Tours |
|---|---|
| Supervisor | Start your day; Create a Workspace record; From record to archive; Record work and attendance; Record issues, delays and HSE; Register deliveries and decisions; Save and mark up photos; Assign and follow up; Inspect and verify work; Control a document revision; Find records and evidence; Create and export a report; The 15 Workspace forms (one button per form). "Set up a project" appears only for administrators. |
| Contractor | Respond to an assignment; Correct a returned response; Work through deadlines; Open a shared document. No administration and no Workspace forms. |
| Client | Review an assigned item; Follow project progress; Find project documents and risks; Find decisions and notifications. No administration and no Workspace forms. |

Every step has Find / Do / Check, a visual menu map, the real screen labels and an "Open in app" action that only navigates (to the screen, or for the 15 forms to the empty form). No guide step submits, assigns, signs, shares or changes a record.

**Browser verification** (local production build, fresh sessions per role)

- `visual-walkthrough.spec.ts` plus `help-layer.spec.ts` on mobile-field, tablet-field and desktop-office, run again on the rebuilt stack that includes the new Management and inspection screens: 19 passed, 2 skipped (help-layer on phone and tablet by design), 0 failed (`tmp/uat/pw-walk-final2.txt`). The management tour step now names project information and project disciplines. Help as supervisor, contractor and client, English and Dutch, phone and desktop; opening a guide step only navigates (no write request to `/rest/v1`). An earlier combined run with dialogs and role views gave 32 passed, 10 skipped (`tmp/uat/pw-walk6.txt`).
- Covered: first use per role, skip, close with Escape, focus trap (25 Tab presses never leave the dialog), focus return, reopen from Help, English and Dutch, the 15 forms each opening the correct form with no write request (watched on `/rest/v1`), every supervisor tour opening its screen, contractor and client navigation with no sideways overflow on a phone.
- Screens checked by eye: supervisor at 1280 px (English), client at 375 px (English), contractor at 390 px (Dutch).
- `ui-stability-audit.spec.ts`: 72 screens, 0 findings, worst layout shift 0.046 (limit 0.05). An earlier run in this session measured 0.053 and failed the limit; the cause is data-driven (the shift comes from the sign-in card and Overview panels, none in guide code) and it sits close to the limit, so it can recur as records accumulate. This was not tested against a baseline without the walkthrough.

## Evidence base for this run

- Playwright (local stack, fixture accounts): word-17-journeys, spec-registers, sheet-forms, two-party-signature, contractor-submission, controlled-document, role-views, period-report, rapid-verify-values, day-overview-export, overview-counts, action-center-tabs, media-and-sharing, form-autosave, a11y-audit, tap-targets, reflow-320, responsive-audit, media-desktop-upload, dialogs, visual-walkthrough, help-layer, ui-stability-audit. Result files are `tmp/uat/pw-*.txt`. All pass at the end; two failures found on the way (items 3 and 4 above) were fixed.
- pgTAP run live against the local database without a reset (each file rolls back): 002 (64), 008 (23), 013 (19), 014 (11), 015 (28), 016 (10), 019 (21), 020 (20), 025 (7), 027 (6), 028 (9), 029 (18), 030 (29), 031 (65), 032 (26), 033 (29), 034 (24), 035 (8), 036 (11), 037 (15), 038 (9), 039 (10), 040 (11), 010 (31). No failures. Outputs are `tmp/uat/pgtap-<n>.txt`.
- Unit tests: `spec-forms.test.mjs` 23/23, `portal-and-documents.test.mjs` 13/13, period, report and day-export tests 13/13.
- Live probes of the forms (Lessons Learned, Agreements Made, HSE Incident, Workforce, Documents, Records filters, Overview, Management) are scripts in `tmp/uat/`.
- Sign-off rows rest on the pgTAP suites, the profile definitions in `lib/forms/signoff.ts` and the passing word-17 and two-party journeys. A live panel-by-panel sweep of all 12 forms was attempted and abandoned because it did not finish; the panel is rendered by one shared component for every kind (`viewedRecordSignoff`).
- A few notification rows (WD-186 to WD-189) are source-level: the notify calls exist in the migrations but no test asserts each message.

## Environment notes

The fake Blob store is in memory and the stack was rebuilt and restarted during this run, so photos saved before the restart show "Image unavailable". That is an effect of the test environment, not a product defect. The database was not reset. Nothing was committed, deployed or sent; synthetic UAT records (including 147 Works Completed records from the earlier run) remain in the local database.

## Checkpoint

All source IDs are accounted for. Next source ID to run: none.

## Update after the Word 13 and 14 build (2026-11-22)

Evidence added in this batch (all local; fixture accounts; no e-mail, push, deploy or production change):

- pgTAP 042 (project information) 11/11 and 043 (planning an inspection) 13/13, run live without a reset (`tmp/uat/pgtap-042.txt`, `pgtap-043.txt`).
- `project-information-disciplines.spec.ts`: 8 passed, 10 skipped by design across the three viewports, plus the Dutch run (`pw-info-disc.txt`, `pw-info-disc-all.txt`, `pw-info-nl.txt`). The spec creates the local fixture user `field-supervisor-a@codeco.test` and restores the project information and discipline list afterwards.
- `inspection-notification.spec.ts` 4/4 (`pw-inspection-notify.txt`): executor 1, then 2, then 3 notifications across plan, reschedule and reassign back; the planner and the acting executor get none; an unchanged save sends nothing.
- Regression on the final build: `ui-stability-audit`, `a11y-audit`, `spec-registers`, `role-views`, `requirements-final` on mobile, tablet and desktop (`pw-regress-final.txt`: 38 passed, 36 skipped by design, 1 failed, the layout-shift limit described below); unit tests `spec-forms`, `portal-and-documents`, `spec-server-rules` 43/43.
- **Open observation, not a Fail row: `ui-stability-audit.spec.ts` is intermittent.** The overlap, clipping and target-size checks (the first assertion) passed on every run. The layout-shift limit (0.05) failed on 2 of 4 isolated runs and on the first run in the combined regression, each time at 0.115, and passed on the others (`pw-ui-stab-1.txt` to `pw-ui-stab-4.txt`, `pw-regress-final.txt`; the other 38 tests in that regression passed, 36 skipped by design). The shift is a Verification (Rapid Verify) list row moving down by 95 px on the tablet screen (0.098) when a row is inserted above it after the first paint, plus smaller Overview shifts (0.033 and 0.020). That list is filled when the portal-share query returns (`verification-queue.tsx`, unchanged in this work); planned inspections are not in that queue. This was not tested against a baseline build, so it is recorded as an existing timing-dependent shift near the limit (an earlier run in this session measured 0.053 and 0.046), not as proven unrelated. Reserving the height of that list until the query returns would remove it; that is left for a decision because it changes a screen outside this request.
Scope notes: project disciplines feed Project Documents and the Management list; the 15 workbook forms keep the 17 controlled disciplines, so the server form rules did not change. The project time zone is stored but the app uses America/Paramaribo everywhere (Decision 12).


## Production release (2026-11-22)

- **Pull request** · #29 `codex/codeco-launch-readiness`, all 5 checks green on `a83f820` (Web lint, test, build and audit; Database migrations, lint and pgTAP; Critical browser flows; Vercel; Vercel Preview Comments). Squash-merged as `592ae509b111`; Vercel Production deployment success at 12:32 UTC.
- **Production database** (`dljbeheogaeviokpcvca`) · history read first (head `202611250001`, 111 migrations). `202611250002`, `003` and `004` applied as written, `202611250005` as a patch to `delivery.options.unit` (the 13 approved units); the migration table now records the repository versions, 115 rows, head `202611250005`. Checks: the stored rules hash equals the local one (`bb1fa562f184e73559ad8b5b500c2e6e`, was `6c83314a134d4ec437f4736923dc1598`); the five new functions match the local database by md5; the three project columns, the date and currency constraints, both triggers and the notification type constraint exist; `anon` cannot execute the three planning functions; the two existing projects have empty new fields. Existing notification types (finding_critical, system, backup_failed) satisfy the new constraint. Applied before the merge, so the previous app kept working against the new schema.
- **Deployed build** · `/api/release` reports commit `592ae509b111`, environment production, expected schema `202611250005`. `uat-production.mjs --ref 592ae509b111` from a clean checkout: source parity `same-commit`, sign-in page 200 with the form visible at 1280 px and 390 px (`tmp/uat/production-parity-592ae50.json`). The live chunks contain the walkthrough, project information and planned-inspection code. A run from the shared working tree was refused by the script because that tree holds another agent's uncommitted edits, which is the check working as designed.
- **Recovery** · the four migrations are additive; each header carries its rollback. The previous rules definition is in migration `202611240006` and its hash is above.
- **Not verified on production** (blocked on a sign-in or on CODECO resources): signed-in role menus and the walkthrough as supervisor, contractor and client; representative existing workflows; real-device photo and drawing capture, Blob storage and original retrieval; configured e-mail and push delivery; a backup restore. No production data was written by this release other than the migrations; no test records were created on production.
- **Local final verification on the merged code** · regression on the final build 69 passed, 0 failed (`pw-release-6.txt`); inspection and project-information specs with the derived fixture password 13 passed (`pw-release-7.txt`); the stability audit passed three times, 72 screens, 0 findings, worst layout shift 0.048 against the 0.05 limit (`pw-release-stab-1..3.txt`). The earlier intermittent Rapid Verify shift (0.098 to 0.115) did not recur in the three final runs (the worst shift was 0.048, close to the limit, so it can still be called a narrow margin); `rapid-verify-delayed.spec.ts` measures 0.0000 under 0 ms and 3 s delay.
- **Follow-up PR** · #30 records the release in `COMPLETION-CHECKLIST.md` and updates Decision 17's evidence line; docs only.


## Release 7a558a63ff06 (22-11-2026): three-fix product release, PR 31

Deployed: production serves commit 7a558a63ff06 (`/api/release`, deployment dpl_4S9DyPgJ8trTZFwHPttNYztW6tYQ). Applied schema 202611250005 (matches expected; no migration in this release).

Production, verified: release identity and source parity at the merged commit, public sign-in at 1280 px and 390 px (`tmp/uat/production-parity-7a558a6.json`, report.json from `apps/web/scripts/uat-production.mjs`).

Local evidence on the combined candidate (not production): typecheck, lint, build, 300/300 node tests; Workforce two-building spec; two-inspection notification spec; notification destinations for supervisor, contractor, client portal and client; all seven photo formats through the photo library and the Issue form with SHA-256 of originals; 104 browser tests passed across mobile, tablet and desktop including the 72-screen stability audit. CI on PR 31 green (Workforce on-site spec skips in CI: its seed has no earlier workday).

Not run, with what is missing:
- Signed-in production smoke (supervisor, contractor, client), role menus, walkthrough, the three changed workflows, portal boundaries, record lifecycle: the browser pane is on the sign-in page; a person must sign in (passwords are never entered by Claude) and name the approved test project.
- Live email and push to approved test recipients: recipients and channel enablement not supplied.
- Native camera/gallery on an approved iPhone and Android: no device.
- Backup restore in a separate recovery environment: none provided.
- WD-193 stays Pass on local evidence only until the production notification-link check passes.

## Final release d31b5d428737 (22-11-2026): PR 32 "Send as email"

Scope decision (owner, 22-11-2026): server-side SMS, email and push delivery are out of scope. Sharing opens the device's own apps with the message ready and nothing is sent by CODECO: WhatsApp and SMS (existing) and now the mail app via `mailto:` (Gmail where it is the default). This removes the live email/push check from the outstanding list.

Deployed: production serves d31b5d428737 (dpl_FKnqmgrCrA9rJGPea2iahBBwTAQs); schema 202611250005, no migration. Production parity at that commit passes (release identity, sign-in at 1280 and 390 px). CI green on PR 31 and PR 32. Local evidence for PR 31 content as recorded above; PR 32: tsc, eslint, build, 300/300 node tests.

Not run: signed-in production smoke (no signed-in session in the browser pane; Claude does not enter passwords), the mail/SMS apps opening on a real iPhone/Android, native camera/gallery on a device, backup restore in a separate environment. Local evidence only for the three fixes and WD-193 until those are run by a signed-in person.

## Final release 32f4df25b8a3 (22-11-2026): PR 33 workbook dropdown pass

Pass of every dropdown of the 12 form sheets against the workbook FINAL v2: 266/266 form rows, 106/112 dropdown rows with a value list, 147 activities in 17 disciplines identical. One extra value removed: HSE Potential consequence "Not Applicable" (form and database rule; migration 202611250006 applied to production before the merge, no stored record used the value). Remaining deliberate difference: Units offer the 13 approved values (Decision 18).

Deployed: production serves 32f4df25b8a3, applied schema 202611250006 (116 migrations in repo and database), parity script PASS at that commit. Still not run: signed-in production smoke, mail/SMS apps on a real phone, native camera/gallery, backup restore, report exports opened as files on production.
