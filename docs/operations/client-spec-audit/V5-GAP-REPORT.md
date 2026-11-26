# Gaps: client package v5 versus the current build (25-11-2026)

Sources compared: Excel v5.0 (forms, START HERE, Roles, Sign-off, Form Logs), Word v2.0 (sections 1-24) and mockups v6.
Method: Excel field rows diffed against the app's `sheetLayouts` (`tmp/gapdiff.mjs`), Word requirements checked by searching the code (`app/`, `lib/`, `supabase/migrations/`) and by reading the files named below, and the open rows of `V5-IMPLEMENTATION-REGISTER.md`.
Not done: a side-by-side look at all 16 mockups against live screens, and a phone check. Items marked "to verify" were not confirmed in a browser.

## Status after the implementation round (25-11-2026)

Built since this report was first written (unit tests and pgTAP pass; see the register for files):
A1 compliance check (without the side-by-side viewer and the assistant), A2 quick periods, report types and select all / clear, A3 templates and schedules (a schedule sends a notification; it does not build the PDF itself), A4 the report types, A5 company register with contacts, A6 signature-requested notification, A7 record IDs from the database, A8 file / date / length validation, A9 CO pending notification (the v5 workflow status labels are not shown in the lists), A10 footer text and the signing popup.
From section B: 1 (Inspections and Workforce), 2 (five register forms), 3 (register forms), 4 and 5 (Works Ongoing / Works Completed), 11 (target date and title).

Second round (later on 25-11-2026), built and checked in a browser or by Playwright: B9 "Open log" and the left-menu badge, B10 Actions badge, rule 14 of the Actions table (compliance checks), the delivery acceptance guard in the database, the report types Contractor Performance Summary, Action Register and Document Register, and two defects found while testing (empty schedule recipients on Reports, Templates / Schedules blocks overlapping on Create report).

Third round (evening of 25-11-2026), built and checked by unit tests and Playwright: B6 link-first prefill for related inspection, inspected work and affected activity (discipline, second discipline, activity, exact location; never over a filled field), B12 Works Completed candidate filter, B11 discipline from category (already built, now tested), B7 numbered sections on Works Ongoing and Works Completed, and the report builder options photos none / thumbnails / large, signatures on or off, sign-off log and records still open from before the period (saved in templates).

Fourth round (overnight run, 25-11-2026), built and checked by unit tests, pgTAP and Playwright: B8 Issue-card Verify / Return dialog, B1 photo Record ID and auto bar (migration 202611250014), report builder group by, summary versus full and contractor responses in PDF, Word and Excel, photos and sign-off log in Excel, Actions contractor filter, the "Pending verification" label, delivery acceptance for traceable material groups (migration 202611250015), side-by-side documents and a deterministic assistant in the compliance check, signing popups on inspections and field notes, numbered sections on all 12 sheet forms, and a browser walk of the ten Client Portal and six Contractor Portal submenus. That walk found that "View as" never worked (wrong column name); fixed.

Still open, with the reason (see `V5-DECISION-REGISTER.md` and `V5-REQUIREMENTS-TRACEABILITY.md`):
- A schedule produces the PDF or Excel itself (D-16): only the "ready to make" notification exists. Needs a server-side snapshot run as the schedule's creator, server rendering and e-mail attachments.
- Materials -> Purchase order link (D-17): the application has no purchase-order record.
- Requirement lists per material group in Rapid Verify: needs the client's bestek clause lists.
- Contractor scoping of Actions (A-03): Actions is a supervision screen; contractor data is scoped by RLS in the portal.
- Not opened in a browser with real documents: the side-by-side viewer and the assistant button of the compliance check.
- Not checked by eye: the Verify / Return dialog, the photo auto bar and the new report option controls on a phone; the Dutch wording on screen.
- Section D: decisions that need the client (Work before or after Location, units 16 versus 13, section 20 items). They are decided provisionally in the decision register and marked as inferred.

## A. Gaps confirmed in code (nothing builds them yet)

| # | Word / Excel source | Requirement | Finding |
|---|---|---|---|
| A1 | Word 10.1 | Rapid Verify spec compliance check: submittal against bestek clause, side by side, per-requirement table (Complies / Does not comply / Not stated / N/A), overall result, signature, NCR/Issue from a failed check, "superseded revision" flag, Delivery "Accepted" blocked without a passing check | Not built. `rapid-verify-workspace.tsx` searches and compares text in uploaded documents only. No table, no stored verification record, no link to a bestek clause. "Complies with comments" appears nowhere in the code. |
| A2 | Word 11.1 | Report builder: quick presets (Yesterday, Last week, Last month), group by date/form/location/contractor, photo option (none/thumbnails/large), signatures and sign-off log option, open-from-before option, contractor responses option, per-filter building/level/contractor/status/priority | Partly built (`operational-workspace.tsx` ~6254-6480). Present: Day/Week/Month/Custom, one checkbox per form, discipline/type/status/priority filter, PDF/Word/Excel, Publish to client. Missing: the options listed here. |
| A3 | Word 11.1 | Save report as template; schedule (daily 18:00, weekly Monday 08:00) with e-mail to selected users | Not built. No table or code for templates or schedules. |
| A4 | Word 11.2 | Report types: Workforce histogram, Materials Delivery report, Change Order register (SRD/USD totals), Photo report, Single-record PDF, Inspection Report, Delay Analysis, Quality/NCR Summary, HSE Report as separate types | Only "Complete / Management / Quality and HSE / Visual progress" plus the three register reports (contractor performance, actions, documents). The other types are not selectable as types. Single-record PDFs exist per form, not from the builder. |
| A5 | Word 13 | Project Company Register (contractors, suppliers, consultants, contacts) feeding Responsible party / Issued to / Supplier / Workforce contractor | No such screen or table name found. Dropdowns read from `parties`. Contacts and package associations are not managed. |
| A6 | Word 14 | Notification "Signature requested via Send to app" | No code found for it. |
| A7 | Excel START HERE / Word 3 | Record ID `<PROJECT>-<FORM CODE>-<YYYY>-<NNNN>` | `recordId` / `nextRecordId` exist in `lib/forms/record-defaults.mjs` and have unit tests, but nothing in `app/` or `lib/` calls them. Records are still numbered by the older scheme (to verify in the UI). |
| A8 | Excel START HERE | Validation: file types and 20 MB, no future event dates, 250 / 4000 character limits | `fileProblem` and `eventDateInFuture` are not called outside their tests. A 250-character limit exists in `operational-workspace.tsx` only. |
| A9 | Excel START HERE / Word 16 | Status model Draft → Submitted → Awaiting contractor response → Response received → Returned → Closed; CO Pending PM Approval | The stage lists and `canMoveWorkflow` exist in `record-defaults.mjs` but are not called by the UI. Whether the database enforces the same order was not checked. |
| A10 | Excel Form Steps | Footer "n of N required left - auto-saved" with Cancel / Save draft / Sign, submit & notify | The text "required left" and "Sign, submit" do not occur in the code. "Save draft" exists. |

## B. Gaps from the register that stay open

These come from `V5-IMPLEMENTATION-REGISTER.md` rows marked Open; each was re-checked only by search, not in a browser.
1. Auto bar (record ID, date/time, user, status) on Photos, Works Ongoing, Works Completed, Workforce, Inspections.
2. Title auto-suggest on all forms. It is wired for Issue only (`findingTitleSuggestion`).
3. Camera and file buttons on all forms (Issue only). Attachment queue for PDF/DOCX/XLSX.
4. Location block: drawing picker → building/level → pin on every form. The Excel row "Drawing location (PDF + pin)" (Works Ongoing 8.1, Works Completed 7.1) is not in the layouts of those two forms.
5. Works Completed row 8.1 "Activity-specific technical details" is not in its layout.
6. Link-first prefill: Inspection → work/material, NCR → Inspection, PDR → work, Materials → PO. Only WC → WO is partly done.
7. Numbered continuous sections on all forms.
8. Issue card quick Verify / Return buttons take a status note only (no dialog).
9. Left menu: text labels and tab order 01-15 for Form Logs; "Open log" button per tab does not occur in the code.
10. Actions: badges in the left menu, contractor scoping, Rapid Verify rule.
11. Defaults: discipline from category.
12. Works Completed candidate filter "same activity / not yet completed".
13. Inspection `checklist_version` auto-fill. Certificate (Delivery) as a separate upload slot is done; the same slot for other forms is not requested.

## C. Word sections that need a browser check, not a code fix

- Contractor Portal: submenus and responds-only behaviour, data isolation by URL (pgTAP covers the database side).
- Client Portal 21.1: the model has publications, progress, photos, documents, review, issues and correspondence (`lib/portal/portal-model.mjs`). Which of the ten submenus have their own screen was not confirmed; Milestones & Schedule and History & Notifications are the ones to look at first.
- View as: `view-as-portal.tsx` opens a party's portal. Read-only behaviour for every action needs a click-through.
- Client Approver: never for Change Orders (21.4). Needs a pgTAP assertion, listed as open in the register.
- Word 20: PM-only CO approval test, notifications "CO awaiting PM approval", report "published to Client Portal" notification.

## D. Decisions that need the client

1. Units: v5 lists 16, the 22-11-2026 decision lists 13 (it includes mm, cm, number). The build follows v5. Needs a yes from the client.
2. Lessons Learned: the "Approved for Sharing" review step was removed; submitting shares the lesson. Confirm this is meant.
3. Word section 20 items still open on the client side: document numbering and revision convention, e-signature provider, file size limits, retention.

## E. What is done and verified (for contrast)

Close/Verify/Approve dialog (migration 0008, pgTAP 045), the Excel v5 field changes for all forms (catalogue, Dutch labels, icons, server rules, pgTAP), checklist upload (migration 0007), 16-unit list, photo purpose and category with a batch control in the media library, form logs per form, actions auto-list rules, contractor and client portal shares with decision log.
Last full run (25-11-2026): unit tests 350 pass, pgTAP 46 files pass (new: 046), tsc / eslint / stylelint clean; Playwright in two passes on the desktop project (57 specs of the v5 list: 36 passed, 19 failed on the signing popup, the Title row and the new photo buttons; after updating the specs the failed ones were rerun and pass, the day-report lifecycle on a clean database). The new screens (report templates and schedules, company register, compliance check) are not covered by Playwright, and the phone width was not run.

## F. Suggested order

1. A8, A9, A7 and A10 (small, shared across all forms: helpers already exist).
2. B1-B5 (auto bar, title, location block, missing rows).
3. A2-A4 report builder completion with templates and schedules.
4. A1 Rapid Verify compliance check (largest; needs a data model).
5. A5 company register and A6 Send to app.
