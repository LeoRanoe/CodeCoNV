# Opus overnight audit log (26-11-2026)

Prompt: `docs/operations/client-spec-audit/OPUS-AUDIT-PROMPT` (the owner's message of 26-11-2026). Client package: `CODECO_Developer_Package_v5.zip` (Excel v5.0, Word v2.0, mockups v6), unpacked locally in `tmp/pkg-v5/` (not committed).

## State

- Phase: done (three passes, three PRs merged and live).
- Branches: `audit/opus-overnight-1` (#38, included #37), `-2` (#39), `-3` (#40), `-4` (this log).
- Tools: `apps/web/tests/e2e/audit-walk.spec.ts` (opt-in, `UX_WALK=1`): every screen in every viewport and role, a screenshot and a measurement (sideways scroll, covered or clipped controls, small targets, small text, sidebar footer) into `tmp/audit/<lang>/<viewport>/<role>/`.
- Next step: see the bottom of this file.

## Findings

Severity: blocker (cannot work), major (wrong or very hard), minor. Evidence paths are local screenshots under `tmp/audit/` (before) and `tmp/audit-after/` (after); the ones that matter are copied into `docs/operations/ui-stability-audit/opus-2026-11-26/`.

| ID | Screen | Viewport | Role | What is wrong | Severity | Evidence | Status |
|---|---|---|---|---|---|---|---|
| F01 | Shell, sidebar | 1366x768, 1280x720 | supervisor | The sidebar does not fit: "Management" is cut off behind "Take photo", only the page list scrolls (so the tenth menu is hidden). Logo 64 px, rows 48 px, a 52 px photo button and a 60 px user card under ten menus. | major | `en/1366x768/supervisor/01-overview.png` | fixed: photo button to the top bar (one per viewport: top bar on desktop, bottom bar on phone/tablet), shorter rows and logo on short screens; all ten menus and the account fit at 1280x720 |
| F02 | Workspace module lists (Works ongoing, Works completed, PDR, Delivery, TI, CO, Lessons Learned, Agreements) | all | supervisor | A form tile opened a list of every register record of the project: Works ongoing showed change orders and technical instructions under "Formal client documents", with a count of 21 (all registers). | major | `en/1366x768/supervisor/03-02-works-ongoing-form.png` | fixed: the list and its count show the form's own records; the Management "contractor submissions" view keeps all |
| F03 | Every Workspace module | desktop, tablet | supervisor | The module header put "New" on a second row under "Workspace", 60 px of empty band above every list and form. | major | `03-06-issues-list.png` | fixed: one row (back, name and count, Open log, New) |
| F04 | Every record list (Agreements, Lessons, Delivery, HSE, ...) | all | supervisor | Record rows broken: the View / Edit / Withdraw group fell into the icon column, pushing every title to the right half; the state pill lay over "Withdraw" (measured: Withdraw covered by OPEN). | blocker | `03-15-agreements-made-form-full.png` | fixed in the shared row rule |
| F05 | Every form | all | supervisor | A field that gets focus can end under the sticky action bar at the foot of the form. | minor | measure.json "under div.record-form-actions" | fixed: `scroll-padding-bottom` |
| F06 | Workspace, "Supporting tools" | all | supervisor | Rapid Verify and Project Docs repeat two main menus; "Assets & folders" repeats Project Documents / Records & Photos. | major (IA) | `02-workspace.png` | fixed: removed; Drawings & pins, Calculator & notes, Deadlines stay. Tests that clicked "Project Docs" there now use the main menu |
| F07 | Issue / NCR cards, controlled-document cards | all | supervisor | Up to ten buttons per card (View, Edit, Withdraw, photo, drawing, external link, PDF, Word, progress, next status, return); seven on a TI / CO card | major | `03-02-works-ongoing-form.png` (CO card) | fixed: View, next step and Verify / Return stay; the rest behind "More actions" / "Send or export" (D-34) |
| F08 | Record lists (Issues, NCR, registers) | 390x844 | supervisor | Four filter dropdowns (Discipline, Type, Status, Priority) fill the phone screen before the first record | major | `en/390x844/supervisor/03-06-issues-form.png` | fixed: folded behind "Filters" until used |
| F09 | Workspace tiles | all | supervisor | Works ongoing, Works completed, Workforce and HSE incident had no count; HSE counted incidents too | minor | `02-workspace.png` | fixed |
| F10 | Reports | all | supervisor | Page heading "Client reports" while the menu says "Reports" | minor | `08-reports.png` | fixed (D-35) |
| F11 | Workspace vs Records & Photos | all | supervisor | "Issues 9" on the Workspace and "Issues 11" in Records & Photos (open vs all) | minor | `02-workspace.png`, `07-records.png` | fixed: every tile counts the form's records; the open ones are counted on the page |
| F12 | Shell on a phone on its side | 844x390 | supervisor | Top bar 60 px plus bottom bar 70 px leave 260 px for the work | major | `en/844x390/supervisor/01-overview.png` | fixed: 48 + 52 px |
| F13 | Project Documents | desktop | supervisor | Titled "Project Docs" with a "← Workspace" button although it is a main menu; two orange buttons; the register's rows spread over the folder-list height (100 px gaps) | major | `tmp/audit-after2/.../06-project-documents.png` | fixed |
| F14 | Workforce day list | desktop | supervisor | Rows without actions: title pushed right, state pill stretched under it | major | `03-04-workforce-form-full.png` | fixed in the shared row rule (to verify on screen) |
| F15 | Actions | 1366x768 | supervisor | Fifth state tile alone on a second row; two pickers each a full row | minor | `04-actions.png` | fixed (to verify on screen) |
| F16 | Contractor Portal | all | contractor | "New submission (RFI, RFA, WCR, inspection request)" lets a contractor create records; Word decision 1 says forms are filled in by Supervision only, Word 6.2 lists no contractor RFI | client question | `portal-app.tsx` | fixed 27-11-2026: the client answered Q-1 "follow the new document"; the button is gone (D-36) |
| F17 | Workforce form | all | supervisor | Mockup 04 is one table (discipline, contractor, number), total, remarks, sign-off; ours is a party / trade picker with steppers, visitors, totals per organisation and trade, deviation, signature; no Record ID (Excel gap) | major (gap) | mockup 04 vs `03-04-workforce-form-full.png` | open: recommendation, larger than tonight |
| F19 | Issue / HSE pills and segments | 390x844, 820x1180 | supervisor | Pills 40 px high: under the 44 px thumb rule (tap-targets spec failed on #37) | major | tap-targets error-context | fixed |
| F20 | Works ongoing / any sheet form with segments | 390x844 | supervisor | Segmented controls broke words letter by letter ("Da y", "Ev eni ng", "W ee ke nd") | major | `tmp/audit-dr/en/390x844/supervisor/03-02-works-ongoing-form-full.png` | fixed: on a narrow card the segments wrap as whole words |
| F21 | Auto bar | 390x844 | supervisor | Record ID and date cut to "E2E-001-WO-2…" | minor | same | fixed |
| F22 | Module header | 390x844 | supervisor | "Works o…": the name cut by Open log | minor | same | fixed: Open log is an icon on a phone |
| F23 | Sticky action bar | 390x844 | supervisor | The "required left" list took five lines (170 px) | minor | same | fixed: two lines |
| F24 | Sidebar for the legacy client role | all | client | A client account sees Rapid Verify and "View as" Contractor / Client Portal (Supervision's per Word 2 / 2.1) | major | `tmp/audit-roles/en/1366x768/client/01-portal-home.png` | fixed: those three need records.create; Workspace, Actions, Documents, Records, Reports, Management stay (role-views covers them) |
| F25 | Account card | all | all | The card signs out on a tap but says "CODECO user" (also for a client) | minor | same | fixed: it says "Sign out" |
| F26 | Portal header | 390x844 | contractor, client portal | 290 px header (large logo, stacked controls) | minor | `tmp/audit-roles/en/390x844/clientportal/01-portal-home.png` | fixed: about 220 px |
| F27 | Portal rows | 390x844 | contractor, client portal, supervisor preview | Title squeezed into a 90 px column beside the states, one word per line | major | `tmp/audit-roles2/en/390x844/contractor/01-portal-home.png` | fixed: states under the title |
| F28 | Register lists (Delivery, TI, CO, ...) | all | supervisor | Every row repeats the form name ("Materials delivery") in a list of that form | minor | `tmp/audit-pass2/en/1920x1080/supervisor/03-08-materials-delivery-list.png` | fixed |
| F29 | Project Documents folders | all | supervisor | Folder numbers 11.2 px (under the 12 px minimum) | minor | measure.json pass 2 | fixed |
| F21b | Auto bar | 820x1180 | supervisor | Record ID still cut ("E2E-001-INS-2026-…") on a tablet | minor | `tmp/audit-pass2/en/820x1180/supervisor/03-09-inspections-form.png` | fixed: values wrap at every width |
| F30 | Issue card "More actions" menu | 1280x720 | supervisor | The open menu was clipped by its card and drawn under the next card: only a sliver showed | major | `tmp/audit-pass3/en/1280x720/supervisor/16-more-actions-open.png` | fixed; `popup-stacking.spec.ts` fails without it |
| F31 | Signing popup (and the drawing picker, photo markup, sketch, photo detail, Verify / Return dialog) | 390x844, 844x390 | supervisor | Opened from inside a form, the popup lived in the sticky action bar's stacking layer and the form's container-query box: the top bar and the phone's bottom bar lay over it and over "Sign & submit" | blocker (phone) | `tmp/audit-pass3/en/844x390/supervisor/17-dialog-sign.png` | fixed: popups are drawn at the root of the page (`ModalLayer`); `popup-stacking.spec.ts` fails without it |

## Pass 2 (27-11-2026, after #38 was live)

All eight viewports for the supervisor in English (`tmp/audit-pass2/en/`), and 1280x720 / 390x844 in Dutch for the supervisor, the contractor and the client portal (`tmp/audit-pass2/nl/`), with the demo and long-name (stress) data. Result: no sideways scroll, no sidebar item cut off, no small target on a touch width, no covered control except two false positives (content of a closed `<details>`, now skipped by the walk as it already was by the stability test). Found and fixed: F21b, F28, F29. No new blocker or major.

## Pass 3 (dialogs)

The popups and menus at 1280x720, 1366x768, 820x1180, 390x844 and 844x390 (record view, More actions, signing, drawing picker, project switcher, notifications, the phone "More" sheet), measured for fit, internal scroll and reachable last button (`tmp/audit-pass3/`). All fit or scroll inside; two defects found by eye: F30, F31.

## Pass 4 (27-11-2026, the client: "the app is used on a desktop, follow the desktop layout we sent")

The forms at 1440x900, 1366x768 and 1024x768 against mockups 01-15 (`tmp/desk-before/`, `tmp/desk-after/`).

| # | Place | Before | After |
|---|---|---|---|
| D01 | Form header | Two headers: "← Workspace · project · title · count · Open log · New", then the form's own title with a Draft pill | One row as the mockups: the title, then "project › Workspace" (the way back); the second title is for screen readers only; number, date, author and status stay in the auto bar |
| D02 | Segmented controls | Equal parts: a long option broke inside its word ("Weeken d") | As wide as their words, wrapping as a whole |
| D03 | Location card | A list of every drawing of the building (about 500 px) | A "Drawing" dropdown with the drawing under it; the popup keeps the searchable list |
| D04 | Action bar | "7 required left" with the full list on two lines and one button; no Cancel or Save draft on the register forms | One row: what is still needed (one line), Cancel, Save draft, and "Sign, submit & notify" (Excel Form Steps) on the sheet forms |
| D05 | "Day log for the whole day" | A row of its own above the form | In the header beside "Open log" (an icon on a phone) |
| D06 | Sign-off of Works ongoing / completed | A "Contractor representative" and a contractor signature under the supervisor's | Removed: "There is no contractor signature on Works Ongoing or Works Completed" (package key decision 2; mockups 02-03) |
| D07 | Contractor Portal | "New submission (RFI, RFA, WCR, inspection request)" | Removed (Q-1 answered, D-36) |

Not changed tonight (need a migration or a new form, `OPUS-AUDIT-REPORT.md` section 6): R1 Workforce table, R2 Inspection start, R3 drawing pin on the other forms, R8 Photos as a form.

## Shipped

| PR | Content | Local gate on the merged head | CI | Merged | Production |
|---|---|---|---|---|---|
| #40 | F30, F31 (popups at the root, More actions menu) and `popup-stacking.spec.ts` in CI | 071332f: lint, design, tsc, unit 368/368, Playwright 275 passed, 0 failed | 5/5 green (the pgTAP job was re-run once: runner Docker port conflict while starting Supabase) | squash 899a349 | Vercel production 899a349 deployed; live CSS has the F30 rule |
| #39 | pass 2 fixes and the report | 876b44c: lint, design, tsc, unit 368/368, Playwright 271 passed, 0 failed | 5/5 green | squash def9df6 | Vercel production def9df6 deployed; live CSS has `.document-folders small` |
| #38 (includes #37) | F01-F27 | e1881b4: lint, design, tsc, unit 368/368; Playwright 270 passed, 1 failed (spec-registers incident: passes 9/9 alone and in both earlier full runs; a data-order flake) | 5/5 green | 27-11-2026, squash 5f50668; #37 closed as included | Vercel production 5f50668 deployed; live bundle contains "Send or export", `workspace-open-log-label`, `.more-actions-menu`; /supervisie 200 (no sign-in) |

Gate history of #38: run 1 (8 failures: 4 mine, fixed; 3 from #37's pills, fixed; 1 weather rate limit), run 2 targeted 16/16, run 3 (2: weather 429, ui-stability drawing list, fixed in the test), run 4 (1: a11y Rapid Verify timing after F24, fixed), run 5 (1 flake above).

## Decisions

See `V5-DECISION-REGISTER.md` D-31 and later.

## Next step

Run finished (27-11-2026). Three passes done (1: before the fixes; 2: every viewport and Dutch after #38; 3: popups). No open blocker or major in the visual audit; F16 is a client question, F17 and the gaps R1-R10 of `OPUS-AUDIT-REPORT.md` section 6 are recommendations. A next run starts from section 6 of the report.
