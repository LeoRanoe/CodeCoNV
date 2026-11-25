# Developer package v5 (25-11-2026): implementation register

Source: `CODECO_Developer_Package_v5.zip` (Excel v5.0, Word v2.0, mockups v6). Precedence: the Excel leads for form fields, the Word for menus, portals, Actions, Rapid Verify, Reports and permissions, the mockups for layout.
`v5/forms-v5-field-list.txt` lists every field of the 15 form sheets with its control, requirement, dependency and column I visibility.

Status: **Done** = built and covered by a passing unit or pgTAP test. **Open** = not built yet. The new screens (auto bar, Form Logs, Follow-up, View-as, checklist upload, two-column layout) have not been checked in a browser or by Playwright; see "Verification" at the end.

## Conflict settled

`docs/product/design-direction.md` (20-11-2026) said every form is one column with one field per row. The v5 mockups (25-11-2026) put two short fields side by side. The package says the mockups lead for layout, so the design direction is amended: two columns from a 760 px form container, one column below it (`final-pass.css`, test in `rendered-html.test.mjs`). The drawing/pin block beside a field column is not built. Not yet checked visually.

## Shared form behaviour (Excel START HERE, Word section 3)

| Item | Status |
|---|---|
| Auto bar (Record ID, event date/time, "... by", Status), read-only, project not repeated | Done on Issue, NCR, HSE, the register forms, Inspections and Workforce (`app/forms/form-auto-bar.tsx`). Open on Photos and on Works Ongoing / Works Completed quick forms outside the register |
| Title directly under the auto bar, auto-suggested from type/category + location + date | Done on Works Ongoing, Works Completed, Materials Delivery, Technical Instruction and Delay Report (title row first in the sheet, editable, suggestion from `suggestTitle`). Issue keeps `findingTitleSuggestion` |
| "Take a picture" + "Add a file" on every attachment field | Done on Issue and on the register forms (`app/forms/attachment-buttons.tsx`), with the 20 MB / file-type check (`fileProblem`). Open: the same two buttons on the other form families, and a stored attachment queue for PDF/DOCX/XLSX outside the register forms |
| Location block: drawing picker (latest For Construction revision) -> building and level filled from the drawing -> exact location from the pin | Partly: Works Ongoing and Works Completed have the row "Drawing location (PDF + pin)" (`app/drawing-location-picker.tsx`, stored in `details.drawing_location`). Not shown on the drawing view itself; other forms still use building picker + location picker + map |
| Link first, then fill (WC -> WO, Inspection -> work/material, NCR -> Inspection, PDR -> work, Materials -> PO) copying discipline, activity, location, pin, contractor, unit | Partly: choosing the linked record (related inspection, inspected work / related record, affected activity) copies its discipline, second discipline, activity and exact location into empty fields only (`lib/forms/link-prefill.mjs`, 5 unit tests; browser test `v5-link-first` for NCR -> Inspection, including that a value typed first is kept). Works Completed "Based on" lists only Works Ongoing records that no completion points at, the same activity first. Not copied: pin, contractor, unit; Materials -> PO is not linked |
| Short fixed lists as click buttons, long/dependent lists as dropdowns | Partly (choice tiles up to 6 options) |
| One continuous page, numbered sections General -> Location -> Work -> Progress -> Technical -> Blockers & photos -> Sign-off | Partly: Works Ongoing and Works Completed show seven numbered headings (`sheetSections` in `lib/forms/spec-forms.ts`, checked by `sheet-forms`). The headings group the rows in the workbook's order, so Work (discipline, activity) comes before Location, where the mockup list has Location first; the client has to say which order rules. The other forms have no section headings |
| Footer: "n of N required left - auto-saved", Cancel / Save draft / "Sign, submit & notify" | Done: `StillNeeded` text, and a signing popup (`app/forms/sign-submit.tsx`, `SignaturePad`) that opens on submit when the form has an unsigned signature field; an optional signature offers "Submit without signature" |
| Record ID `<PROJECT>-<FORM CODE>-<YYYY>-<NNNN>` (PH WO WC WF PDR ISS HSE MAT INS TI CO NCR LL AGR INC), sequential per project + form + year | Done: migration 202611250009 (trigger `assign_v5_record_id`, one sequence per project + form + year, never reused; old numbers keep their value), preview in the screens via `nextRecordId`, pgTAP 046 and updated 006 / 014 / 029. Numbers created before this release are not renumbered |
| Status model: lifecycle Status + Workflow status; Draft -> Submitted (final) -> Awaiting contractor response -> Response received -> Returned -> Closed; CO: Draft -> Pending PM Approval -> Approved / Rejected / Returned; no reviewer | Open |
| Close / Verify / Approve dialog holds closure note, NCR verification result and verifier, agreement closure note, CO approved amount / days (removed from the forms) | Done: migration 202611250008 (`record_signoff_events.details`, `signoff_outcome_fields`, `record_signoff_action(p_details)`, protect trigger), pgTAP 045, `tests/close-verify-approve.test.mjs`, e2e `close-verify-approve-dialog.spec.ts`. Caveat: the Issue card's own Verify / Return buttons (`transition_project_finding`) still take only a status note, not a closure note; the dialog in Record details is the path that records it |
| Defaults: target date from priority (Low +14, Medium +7, High +3, Critical +1), title suggestion, discipline from category | Done for target date and title; discipline from category stays open |
| Field validation: 250 / 4,000 characters, no future event dates, JPG PNG HEIC PDF DOCX XLSX up to 20 MB | Done in the form fields (`maxLength`, `max` on event dates, `fileProblem`) and in the sheet check for future event dates |

## Per form (Excel v5.0 change log: modified / added / removed)

Each line is the form's v5 field list in `v5/forms-v5-field-list.txt`; all are **Open** unless stated.

| Form | Modified | Added | Removed or moved | Notes |
|---|---|---|---|---|
| Photos | 11 | 2 | 0 | purpose as click buttons, location block, camera/file buttons |
| Works Ongoing | 20 | 2 | 0 | "what exactly" multi-select, no separate additional details, remarks required when Other |
| Works Completed | 19 | 3 | 0 | link to Works Ongoing required; discipline, activity, unit, crew read-only from the link |
| Workforce | 10 | 2 | 7 | per-row contractor + discipline + number; 72 disciplines + add other; total auto; attendance, competency, shift, hours removed |
| Project Delay Report | 16 | 3 | 0 | responsible party from the Company Register |
| Issue | 14 | 2 | 3 | responsible party from the Company Register, responsible person text, closure note moved |
| HSE | 15 | 2 | 1 | |
| Materials Delivery | 20 | 2 | 0 | purchase-order prefill of supplier, group, category, description, quantity, unit |
| Inspections | 15 | 3 | 1 | checklist from the Checklist Library with version; witness |
| Technical Instructions | 14 | 3 | 0 | action owner from the contacts of the Issued-to company |
| Change Order | 16 | 2 | 3 | approved amount / days moved to the approval dialog; no client signature |
| NCR | 19 | 3 | 5 | verification result and verifier moved |
| Lessons Learned | 9 | 2 | 1 | |
| Agreements Made | 9 | 2 | 3 | closure note moved |
| HSE Incident Registration | 21 | 2 | 1 | |
| Technical Prompts / Activity Detail Guide | 20 / - | 3 / - | - | |

## Application level (Word v2.0)

| Area | Status |
|---|---|
| Left menu with text labels, tab order 01 Photos ... 15 Agreements Made | Open |
| Actions: automatic list of every open form needing follow-up (table in section 9), views, filters, badges per form | Built as the "Follow-up per form" view of the action center (`lib/actions/auto-list.mjs`, `app/auto-action-list.tsx`): 13 of the 14 rules, 6 views, filters, counts per form. Unit tests pass. Open: the Rapid Verify spec-compliance rule, the badges in the left menu, contractor scoping, a browser/Playwright check. |
| Rapid Verify spec compliance check (submittal vs bestek, requirement table, signed result, NCR / Issue / return, superseded flag) | Done: migration 202611250011 (`spec_compliance_checks`, `record_spec_compliance_check`, immutable once stored, follow-up link), `app/spec-compliance-check.tsx`, `lib/verification/spec-compliance.mjs`, pgTAP 046, unit tests. Open: documents shown side by side in a viewer, the assistant proposal, and refusing delivery acceptance in the UI (the rule `deliveryMayBeAccepted` exists and is tested) |
| Records & Photos: Form Logs, one logbook per form type with columns, filters, totals, export | Built (`app/form-logs.tsx`, `lib/records/form-logs.mjs`, section "Form Logs" in Records & Photos). Unit tests pass; not yet checked in a browser or by Playwright. The "Open log" button on each form tab is still open. |
| Reports: report builder (period, type, forms, filters, content options, PDF / Excel, templates, schedules, publish to Client Portal) | Partly: quick periods, 11 report types that pre-select forms and sections, select all / clear, saved templates and schedules (migration 202611250010, `app/report-builder-tools.tsx`, `lib/reports/report-builder.mjs`, cron `/api/cron/reports` at 08:00 and 18:00). A schedule sends a "ready to make" notification; it does not build and send the PDF/Excel by itself. Open: photo option, group by, signatures option, open-from-before, contractor responses |
| Contractor Portal / Client Portal "View as" for Supervision, read-only | Done client-side: menu items Contractor Portal / Client Portal for Supervision, `app/view-as-portal.tsx`, `portal-app.tsx` with `viewAs` (no responding, no acknowledging). Not checked in a browser. Client-portal Change Order information-only is open. |
| Management: Checklist Library upload (xlsx / csv, versioned) | Done: `upload_project_checklist` (migration 202611250007, pgTAP 044), parser `lib/checklists/import-checklist.mjs` (CSV, XLSX; English and Dutch headers), upload form under Management > Quality standards. Version 2 retires version 1; started inspections keep their version. |
| Management: 72 workforce disciplines | Done: `workerDisciplines` in `lib/forms/disciplines.ts`, offered by the workforce register. The per-row contractor + discipline + number and the removal of attendance, competency, shift and hours are done (see below). |
| Management: Project Company Register (companies + contacts), report templates and schedules | Done: `party_contacts` (migration 202611250010, RLS with project.configure), `app/company-register.tsx` under Information, templates and schedules as above |
| Roles & Permissions sheet; no Supervision reviewer; PM approves Change Orders only | Sign-off done: profiles without review/accept (`lib/forms/signoff.ts`), migration 202611250006 (server profiles, guard that only a project manager approves a Change Order), pgTAP 029 updated; a node test keeps client and server profiles identical. pgTAP for the PM-only Change Order approval is open. |
| Notifications: CO awaiting PM approval, Send to app, reports | Done: `change_order_pending`, `signature_requested` (portal item that asks for a signature) and `report_scheduled` (migration 202611250010, pgTAP 046). Not checked in a browser |
| Contractor responds only (acknowledge, comment, evidence, witness); never creates or edits a form | Partly |

## Done in this pass

- Form Logs, the Follow-up list, View-as portals, sign-off without a reviewer, 72 disciplines, Checklist Library upload, two-column layout (see the rows above).
- Not done, in order of size: the closure note on the Issue card's quick Verify button; per-form field changes of the Excel (about 250 fields, server rules and pgTAP must be regenerated); record ID format and status wiring; title, footer and Location block on every form; link-first prefill; PDF/DOCX/XLSX attachments; report builder; Rapid Verify bestek compliance check; Project Company Register; notifications; left-menu badges.

- `app/forms/form-auto-bar.tsx`, `app/forms/attachment-buttons.tsx` and their styles in `app/styles/final-pass.css`.
- Auto bar on the Issue, NCR, HSE and register forms; the old eight-cell header strips are gone.
- Issue attachments use "Take a picture" / "Add a file".
- `tests/rendered-html.test.mjs` follows the new headers; the two e2e specs that look for the camera input use the new label.
## Verification (25-11-2026, local stack only)

- `npm test` (build + unit suite): 330 passed. `tsc`, eslint and stylelint clean.
- pgTAP after `supabase db reset`: 44 files, 930 tests, all passing (new: `044_checklist_library_upload`; `029` rewritten for the missing reviewer).
- Full Playwright run against the local stack with the fake Blob store: 225 passed, 13 failed, 217 skipped (other viewports), 7 did not run. After the follow-up below, every one of the 13 passes when its spec is run alone: five because the spec encoded a rule that v5 replaced (tab count 3 -> 4 and the menu now shows the two portals, one field per row -> two per row, the discipline names of the 72 list, Rapid Verify on a tablet is behind More), and four (day report lifecycle, online action, overview photo count, 320 px reflow) only on a freshly reset database. These four depend on the data earlier specs leave behind, so they were not reproduced after a code change but they were not re-run in one full pass either.
- Not re-run in one full pass after the spec fixes. Not checked by eye: Form Logs, Follow-up list, View-as portals, the checklist upload form, the auto bar and the two-column layout. `ui-stability-audit.spec.ts` was in the full run and did not fail.

- Close / Verify / Approve dialog (added later the same day): pgTAP 45 files, 951 tests passing after `supabase db reset`; `npm test` 335 passed; tsc, eslint, stylelint clean; Playwright `close-verify-approve-dialog`, `issue-return-for-correction`, `two-party-signature`, `controlled-document`, `spec-registers`, `sheet-forms`, `form-field-stacking` and `ui-stability-audit` (72 screens, 0 findings) pass on the desktop-office project. Not run: the Change Order approve and NCR verify paths in a browser (covered by pgTAP 045 and the unit test only); the other viewports; the full gate.

## Excel v5.0 field changes (26-11-2026)

The workbook v5.0 was loaded again with `scripts/generate-spec-catalogue.py` (`lib/forms/spec-catalogue.ts` is generated; only the intended v5 changes differ from before). Dutch labels for every new value: `lib/forms/spec-catalogue-nl-v5.ts`; a completion option "Heading: item" is translated per part (`specLabel`). Server rules were regenerated from `spec-forms.ts` into migration 202611250008.

| Area | Status |
|---|---|
| Lists: 18 disciplines (new Timber Structures & Carpentry) with 159 Activity Detail Guide rows and their completion options; weather values; photo categories per purpose; delivery discrepancy types; inspection types, categories, results and finding types; delay causes; units; HSE incident categories | Done (catalogue, Dutch labels, icons for the short lists) |
| Works Ongoing: weather, rainfall, hours lost to weather (prefilled from the day's weather) | Done |
| Works Completed: "Based on Works Ongoing record" (prefills discipline, activity, location, quantity) | Done. Not done: the candidate filter "same activity, not yet completed" |
| Workforce: rows are contractor + discipline + number with an automatic total; attendance, competency, shift and hours are gone | Done |
| Photos: category per purpose (required for a workbook photo) | Done on the capture screen, the photo review and the library |
| Materials Delivery: batch / lot / heat number for traceable groups, concrete ticket fields, certificate upload (required for traceable material), status and discrepancy lists, unit list of 16 | Done. The certificate is a separate upload slot, not a form field |
| Inspections: types, categories, results (Re-inspection Required, Not Ready for Inspection), finding types and the findings requirement | Done. Not done: filling `checklist_version` automatically from the Checklist Library |
| Lessons Learned: status Draft -> Submitted (shared) -> Archived, set by the workflow; a submitted lesson is shared at once (no review step) | Done: `record_signoff_action` submit sets the status, `list_shared_lessons` lists it; lessons approved for sharing before v5 stay shared (pgTAP 030, 045) |
| Change Order: approval statuses (Pending PM Approval, Returned, Withdrawn, On Hold) | Done in the list; the approval itself stays a Project Manager action |
| Auto bar "by" label: Issued by (Technical Instruction), Raised by (NCR), Reported by (PDR, HSE), Received by (delivery) | Done |

Decision for the client: the v5 Units list (16 values: bags, trips / loads, litre (L), sheets, rolls, days added; mm, cm, number removed) replaces the 13 units CODECO approved on 22-11-2026 (decision 18). Existing records keep the unit they were saved with.

Tests changed for v5: `spec-forms` (18 disciplines, 159 guide rows, units, material groups, Lessons Learned status), pgTAP 029 / 030 / 037 / 045, e2e `launch-units`, `sheet-forms`, photo specs (`tests/e2e/photo-purpose.ts`), `spec-fill.ts` (certificate).

Verification of the Excel field pass (local stack): `node --test tests/*.test.mjs` 344 passed; tsc, eslint and stylelint clean; pgTAP after `supabase db reset` 45 files, 953 tests passing; Playwright (desktop-office) 57 specs in a first run (45 passed, 11 failed on fixtures and one missing control, no skips of note), then the five affected files again: 26 passed. The missing control was real: the photo library's batch review asked for a category but had no list for it (`app/media-library-workspace.tsx`). Not checked by eye: the new weather / certificate / batch fields on a phone, and the Dutch labels on screen.

## Second gap check (25-11-2026, later the same day)

The gap check was redone against the v5 package. What was built and verified in this round:

| Area | Status |
|---|---|
| Actions badge in the left menu (number of open follow-ups, same cache as the workspace) | Done. The button keeps its name "Actions"; the count is its accessible description (`aria-describedby`). Checked in the browser and by Playwright (`v5-companies-templates-compliance`). |
| "Open log" button in the Workspace module header (opens Records & Photos > Form Logs on that form) | Done, checked in the browser and by Playwright. |
| Rule 14 of the Actions table: a signed spec compliance check that does not comply or complies with comments, owner = submitting contractor, is listed until a follow-up NCR exists or a later check of the same subject and requirement complies | Done: `complianceActionRows` in `lib/actions/auto-list.mjs`, `specComplianceChecks` in the operations snapshot, row opens Rapid Verify. Unit test in `tests/auto-actions.test.mjs`, browser check and Playwright. |
| Delivery "Accepted" blocked when its latest linked compliance check does not comply | Done in the database: migration 202611250012 (`guard_delivery_acceptance`), three pgTAP assertions in 046. The form does not pre-empt it: the database message is shown on save. Not built: refusing acceptance when no check exists at all (the helper `deliveryMayBeAccepted` supports it; no project setting says when a check is required). |
| Report types Contractor Performance Summary, Action Register / Overdue Actions, Document Register / Outstanding Submittals | Done in the builder (`lib/reports/report-builder.mjs`, new option "Document register"); they reuse the existing report sections. |
| Schedule recipients | Fixed: the people list was only loaded on Management, so "Send to" was empty on Reports. It now loads on Reports too (for users who may manage members). |
| Layout fix | The Templates and Schedules blocks on Create report collapsed into one narrow column and overlapped the Save button; both now span the full width. |
| React key warning in the overview "Quality" panel | Fixed. |
| Schema version | `expectedSchemaVersion` is 202611250012. |

Playwright: new spec `tests/e2e/v5-companies-templates-compliance.spec.ts` (company register contact, template and schedule lifecycle, Actions badge and compliance row, Open log).

Defects found by the full gate in this round and fixed: the Management overview was 346 px wide in a 320 px window (its grid track grew to its widest child); the overview "Pictures" count included preserved originals while the Workspace tile did not (33 against 29); the overview's priority queue appeared late and pushed the panels below it down (layout shift 0.06, limit 0.05; its room is now kept while it loads); the Actions badge query waited for nothing and was fetched twice (it now waits for the day). Tests brought up to date: `double-submit` and `controlled-document` (signing popup), `project-information-disciplines` (18 disciplines), `requirements-final` (the badge is not part of the menu name), `offline-create-and-sync` (the action goes to the signed-in supervisor, not to whoever is first in the list).

Verification of this round (local stack, 25-11-2026): `node --test tests/*.test.mjs` 351 passed; `tsc --noEmit`, eslint (max-warnings 0) and stylelint clean; pgTAP after `supabase db reset` 46 files, 979 tests passing; full Playwright gate on the production build 250 passed, 227 skipped (other viewports and the stacks that are not local), 0 failed. Two earlier full runs each had failures that were fixed as listed above; one spec (`first-load`) failed once on a 429 from the weather endpoint (30 lookups per user per 10 minutes) and passed in the next runs.


## Third pass (25-11-2026, evening)

| Area | Status |
|---|---|
| Discipline from category (Issue field 9) | Was already built in `setSpecValue` (`issueCategoryDisciplines`); now covered by a unit test in `tests/spec-forms.test.mjs`. |
| Link first, then fill; Works Completed candidate filter | See the rows above. Unit tests `tests/link-prefill.test.mjs`; Playwright `tests/e2e/v5-link-first.spec.ts` (2 specs, pass). |
| Report builder options (Word 11.1) | Built: Photos none / thumbnails / large (pictures are made small in the browser, at most 60 per report, the report says how many were left out; PDF and Word), Signatures on or off, Sign-off log (a page with the steps of every printed record), and "records still open from before the period" (`addOpenFromBefore` in `lib/reports/report-builder.mjs`, marked "Eerder geopend"). The options are saved in a template. Files: `lib/reports/report-photos.ts`, `period-report-pdf.tsx`, `period-report-docx.ts`, `app/operational-workspace.tsx`. Not built: group by, contractor responses, summary versus full; Excel does not get photos or the sign-off log. Tests: unit test for open-from-before, Playwright in `period-report.spec.ts`. |
| Numbered sections | Works Ongoing and Works Completed only; see above. |
| Not built | Photos auto bar (photos have no record number in the database, so a Record ID cannot be shown without a migration and a numbering decision); Issue-card dialog for Verify / Return (B8). |

Verification of the third pass (local stack, 25-11-2026): `node --test tests/*.test.mjs` 358 passed; `tsc --noEmit`, `npm run lint` (eslint max-warnings 0 and stylelint) clean; full Playwright gate on the production build after `supabase db reset`, desktop-office project only: 145 passed, 18 skipped, 0 failed. pgTAP was not rerun (no migration in this pass). Two defects found on the way and fixed in the tests: a report period longer than 367 days is refused by the database (the photo test used one), and the `sheet-forms` row reader counted the new section headings as rows. Not checked: the new report options on other viewports, the Dutch wording of the options on screen, and a visual check of the printed photo pages.
