# V5 requirements traceability

Sources reviewed: the repository copies of the client material (`v5/forms-v5-field-list.txt`, the audit documents in this folder, the earlier gap reports). The original zip, the Word document and the mockups are **not in the repository**; where a row cites Word or mockups it relies on the statements recorded in `V5-GAP-REPORT.md`, `V5-IMPLEMENTATION-REGISTER.md` and the product owner's messages. That is a limit of this review.

Status words: **Implemented and verified** (a test or browser run that I executed passed), **Implemented, partly verified**, **Pending** (not built, reason given), **Not applicable** (reason given), **Blocked**.
Verification: U = unit test, P = pgTAP, E = Playwright (desktop-office unless stated), B = checked by eye in a browser, T = tsc / eslint / stylelint / production build.

## Shared form behaviour

| ID | Source | Module | Expected | Status | Verification | Result |
|---|---|---|---|---|---|---|
| F-01 | Excel START HERE | all forms | Auto bar: Record ID, date/time, "... by", Status | Implemented and verified (Photos added in this pass) | U, E | pass |
| F-02 | Excel START HERE | Photos | Record ID `<PROJECT>-PH-<YYYY>-<NNNN>` | Implemented and verified | P 047, E `period-report` | pass |
| F-03 | Excel START HERE | all forms | Record ID per project, form, year | Implemented and verified | P 046 | pass |
| F-04 | Excel START HERE | link-first | A linked record copies discipline, second discipline, activity, exact location into empty fields | Implemented and verified | U, E `v5-link-first` | pass |
| F-05 | Excel WC 3.1 | Works Completed | Based-on filter, copies unit, crew, buildings, location | Implemented and verified | U, E `sheet-forms` | pass |
| F-06 | Excel Delivery row 5 | Materials | Purchase-order link | Not applicable (D-17) | - | - |
| F-07 | Excel Location block | forms | Pin inherited from a linked record | Not applicable as a copy (D-18); building, node and exact-location text are inherited | U | pass |
| F-08 | mockups v6 | sheet forms | Numbered sections | Implemented and verified (12 forms) | U, E `sheet-forms` (all 12) | pass |
| F-09 | Excel vs mockups | Works forms | Work before or after Location | Decided (D-11); client confirmation missing | - | - |
| F-10 | Excel Form Steps | forms | Signing popup on submit | Implemented and verified on Issue, NCR, HSE, register, daily log, workforce, inspection, field note | E `inspection-workflow`, `field-note-signing`, earlier specs | pass |
| F-11 | Word 3.1 | Issue / NCR / Agreement / CO | Closure note, verification result, approved amount in the Close / Verify / Approve dialog | Implemented and verified | P 045, U, E `close-verify-approve-dialog` | pass |
| F-12 | Word 3.1 | Issue card | Verify / Return dialog with comment, next responsible, log entry, duplicate-submit guard, persists after reload | Implemented and verified | U, E `issue-card-decision-dialog`, `issue-return-for-correction` | pass |
| F-13 | Excel Issue field 9 | Issue | Discipline from category | Implemented and verified | U | pass |
| F-14 | Excel v5.0 | all forms | Field lists, catalogue, Dutch labels | Implemented and verified (earlier rounds) | U, P, E | pass |

## Application level

| ID | Source | Module | Expected | Status | Verification | Result |
|---|---|---|---|---|---|---|
| A-01 | Word 3 | Actions | Follow-up per form, views, filters, left-menu badge | Implemented and verified | U, E | pass |
| A-02 | Word 4 | Actions | Filter by contractor (project-specific options, counts, reset, empty state) | Implemented and verified | E `action-center-tabs` | pass |
| A-03 | Word 4 | Actions | Contractor users see only their own actions | Pending: Actions is a supervision screen; contractors work in the Contractor Portal, whose data is scoped by RLS (pgTAP). No separate contractor view of Actions exists to scope | - | - |
| A-04 | Word | status labels | v5 workflow words in lists | Implemented and verified for "Pending verification" (D-13); other states already match | U | pass |
| A-05 | Word 10.1 | Rapid Verify | Compliance check: requirement table, signed result, NCR from a fail, superseded flag | Implemented and verified | P 046, U, E | pass |
| A-06 | Word 10.1 | Rapid Verify | Documents side by side | Implemented, partly verified: built and type-checked, not opened in a browser with real PDFs | T | no run |
| A-07 | Word 10.1 | Rapid Verify | Assistant proposes rows | Implemented, partly verified: logic by unit tests (4); the button was not exercised against real documents | U | pass (logic) |
| A-08 | Word 10.1 | Delivery | Accepted only after a complying check | Implemented and verified for traceable groups (D-09) | P 048, U | pass |
| A-09 | Word 10.1 | Rapid Verify | Requirement lists per material group | Pending: needs client material (bestek clause lists) that is not in the repository | - | - |
| A-10 | Word 11.1 | Reports | Quick periods, report types, templates | Implemented and verified | U, E | pass |
| A-11 | Word 11.1 | Reports | Photos none / thumbnails / large (PDF, Word) | Implemented and verified | E `period-report` | pass |
| A-12 | Word 11.1 | Reports | Signatures on / off, sign-off log, open from before | Implemented and verified | U, E | pass |
| A-13 | Word 11.1 | Reports | Group by date / form / location / contractor | Implemented and verified in PDF, Word, Excel; the PDF pages were rendered and read | U, E `period-report`, B (PDF pages) | pass |
| A-14 | Word 11.1 | Reports | Summary versus full | Implemented and verified (PDF, Word, Excel) | E | pass |
| A-15 | Word 11.1 | Reports | Contractor responses | Implemented and verified (PDF, Word, Excel) | U, E | pass |
| A-16 | Word 11.1 | Reports | Photos and sign-off log in Excel | Implemented and verified: the workbook opens in openpyxl with the pictures at the right rows | U, openpyxl check | pass |
| A-17 | Word 11.1 | Reports | Scheduled report produces PDF / Excel | Pending (D-16): a schedule sends the notification only | - | - |
| A-18 | Word 11.1 | Reports | Templates keep the options | Implemented and verified | E | pass |
| A-19 | Word 21 | Client Portal | Ten submenus | Implemented and verified in a browser run (each opens, none blank, no internal menus) | E `portal-submenus` | pass |
| A-20 | Word 22 | Contractor Portal | Six submenus, responds only | Submenus verified; responds-only behaviour partly (RLS pgTAP) | E, P | pass |
| A-21 | Word 21 | View as | Supervision previews a portal, read-only | Defect found and fixed in this pass (the party query used a column that does not exist, so it always said "no contractor") | E `portal-submenus` | pass |
| A-22 | Word 6 | Management | Checklist Library upload, 72 disciplines, Company Register | Implemented and verified (earlier rounds) | P 044, 046, U, E | pass |
| A-23 | Roles sheet | permissions | No supervision reviewer; PM approves Change Orders | Implemented and verified for sign-off; PM-only Change Order approval has no pgTAP of its own | P 029, U | partly |
| A-24 | Word | Notifications | CO awaiting approval, signature requested, report scheduled | Implemented, partly verified (pgTAP; not seen in a browser) | P 046 | pass |
| A-25 | Word 20 | open items | Numbering convention, e-signature provider, file size, retention | Decided provisionally (D-22), not confirmed | - | - |
| A-26 | Excel v5.0 | units | 16 units | Applied; the client has not confirmed it replaces the 13 of 22-11-2026 (D-20) | U | - |
| A-27 | Word 10.1 | Rapid Verify side by side | Two real PDFs open next to each other (pdf.js) and the assistant proposes a row per figure with its unit, from the lines of the page | Verified in a browser run with two generated PDFs (`compliance-viewer.spec.ts`): both pages drawn, three rows proposed, Complies / Complies / Does not comply as the numbers say. Not verified with scanned PDFs (no text) or multi-page bestek | E, U | pass |
| A-28 | Mockups v6 | layout and popups | Screens reviewed by eye at three widths, see `V5-UX-REVIEW.md` | Layout defects found and fixed; open design questions listed there | E `ux-walk` (aid, not a gate) | part |
