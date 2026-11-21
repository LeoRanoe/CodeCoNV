# CODECO specification completion checklist

**Audit baseline** · `150e3ae45444ec369b300054dcc3559ec8fbc883` · 21 November 2026  
**Release status** · Open. Implementation pass recorded under [Implementation status](#implementation-status). This document is the implementation handoff for all 17 audit findings and the remaining acceptance work. It includes all 15 Workspace forms, 10 menu areas, 15 supplied images, 277 workbook form rows and 147 activity rows.

Close a checkbox only when the change is merged and its acceptance evidence can be reproduced. For behavior that depends on a client decision, record the approved rule and the acceptance evidence. The evidence required depends on the item: an isolated fixture, a schema check, a browser scenario, an export, an access review, or a production-config verification. Keep legacy records and attachments readable through any schema or workflow change.

## Contents

- [Implementation status](#implementation-status)
- [Second implementation pass and fresh audit](#second-implementation-pass-and-fresh-audit--21-november-2026)
- [Implementation order](#implementation-order)
- [Implementation checklist](#implementation-checklist)
- [Client decisions and source conflicts](#client-decisions-and-source-conflicts)
- [Release gates](#release-gates)
- [Audit findings and verification evidence](#audit-findings-and-verification-evidence)
- [Workspace page breakdown and all 15 images](#workspace-page-breakdown)
- [Application menu and Word requirements](#application-menu-and-word-requirement-trace)
- [Workbook field and activity trace](#workbook-requirement-trace)

## Implementation status

**Implementation branch** · `claude/portals-document-register` · commits after the audit baseline `150e3ae`, 21 November 2026. Not merged and not deployed: production migration, deployment, data and role changes wait for explicit authorization.

Status words: **Implemented and verified** means the change is on the branch and its acceptance evidence below reproduces locally; the box stays open until the change is merged, as this document requires. **Partial** means part of the item shipped and the rest is listed. **Blocked** names the decision or authorization that is missing. **Open** means not started in this pass.

| Item | Status | What changed | Evidence | Remaining dependency |
|---|---|---|---|---|
| F13 | Implemented and verified | Next.js and eslint-config-next 16.4.3 → 16.4.6, lockfile updated. | `npm audit --omit=dev`: 0 vulnerabilities. `next build` completes (the 16.4.3 standalone build stopped at the advisory). `npm run lint` and `npm run test:design` (9/9) pass. Node tests 287/287. | Merge. |
| F15 | Implemented and verified (database, portal UI, register UI) | Uploading a revision no longer distributes it. `release_document_revision` releases one approved revision (Approved, Approved with comments, Issued for construction) to one share; `withdraw_document_release` withdraws it with a reason. Releases are kept (no delete, no edit) and logged in the portal and document histories. A guard trigger blocks any other path (share, add-files, revision upload) from attaching an unreleased document file. Portal users read revisions only through `portal_document_revisions()` (no notes, review comment or reviewer); the base revision table is internal. The share panel lists released revisions with Release and Withdraw controls. | pgTAP `033_document_release_control` (28 assertions): draft/submitted/rejected privacy, unrelated contractor, no-permission release, A → B submitted → B rejected → C issued and released, withdrawal stops file reads and keeps history, legacy auto-distributed file unreadable and listed. `031` updated to the release rule. Node test for the releasable-status rule. Browser: `requirements-final` document journey (see browser evidence). | (1) Whether *For information* revisions may also be released, and whether a client may be asked to review a revision before CODECO approves it — Word section 20 item 3. Today both are refused. (2) Production review of past sharing: run section 5 of [F10-role-inventory.sql](F10-role-inventory.sql) with authorized staff before deploying; on deployment, legacy auto-distributed files of unapproved revisions stop being readable externally (no rows are deleted). |
| F02 | Implemented and verified | The work queue reads `spec.inspection_status` (`completion_status` still read for older records). `record_verification` moves Works Completed to *Inspected – Accepted* on Pass and *Inspected – Rejected* on Fail through the spec guard (reviewer authority, server-stamped inspector and date); Partially complete and Further action required keep it awaiting inspection; decided work keeps its decision. Every optional follow-up action is linked to its exact source (finding, inspection, HSE, register entry, action, or the record behind contractor evidence). | pgTAP `034` (Works Completed: no-authority refusal, Pass, Fail with linked corrective action, Partial, Further action, legacy decision). Node test on the queue. Browser `rapid-verify-values` passed. | Confirm the result mapping (Partial and Further action keep *Completed – Awaiting Inspection*). |
| F08 | Implemented and verified | Incident corrective rows and agreement actions are created by the database in the same transaction as the record save, so an offline replay or retried save creates them once. Each row keeps a `row_id` from first entry; the action key is source + field + row id, and the action id is written back to the row. Rows saved before row ids reuse their existing action. The browser no longer creates follow-ups after saving. | pgTAP `034` (three rows incl. identical wording with different owners and dates → three actions; repeated save → none extra; added row → one; legacy row → linked, not duplicated; agreement → one action, stored id; user without `actions.create` → none). | A user without `actions.create` saves the record but its actions wait for a permitted save: confirm who may create follow-ups (Word section 20 item 1). |
| F16 | Partial | Account sign-offs store the server's project role(s) and membership organisation; the role chosen on screen is kept as `stage_role`. External representatives keep their stated name/organisation as an attestation entered by the signed-in user. The workflow profile must be the record's own, and the stage must offer the action (table generated from the approved profiles; a node test keeps both identical). | pgTAP `035` (8 assertions); full pgTAP still green; node sync test. | Strict stage ordering, required approval chains beyond the project configuration, and the meaning of each signature — Word section 20 item 6. The profiles deliberately keep later stages reachable for parallel review, so ordering was not invented. |
| F17 | Implemented; device screenshot comparison open | The page heading is the client's Workspace name for Works ongoing, Works completed, PDR, Materials delivery, Technical instructions, Change order (CO), Lessons Learned (LL), Agreements Made and HSE incident registration. | `sheet-forms` e2e asserts the heading for all 12 ordered forms. | D08 (page titles) acceptance; screenshot comparison per device and the remaining layout points (metadata/signature order, markup canvas, eraser/Undo scope) — D05/D08. |
| F04 | Partial | Submitted Forms indexes Workforce per day report and building, offers each register subtype and HSE observation/incident separately, adds discipline, contractor/party, responsible person and linked-action filters, and pages through every match (no 200/500 cap). Record History shows the record number for sign-offs and loads older history on request (no 500-row display cap). | Node test `records-archive.test.mjs`. Browser `records-no-flicker`. | The archive still reads the cached project snapshot, whose register query is capped at 5,000 rows; a server-side paginated archive query is part of F11. Realistic-volume browser check open. |
| F05 | Partial | Each photo in a library batch keeps its own capture time (no longer the first file's), and its purpose, category and discipline travel through the offline queue to the stored capture. | Typecheck/lint; queue replay already persists `spec`. | Original-byte retention: data saver resizes photos over 900 KB before queueing, so the original is not kept. Keeping it needs a derivative-file storage model and more mobile data and storage — Word section 20 item 8. Required photo fields in the capture path — D05. Hash check of originals after a mixed online/offline batch open. |
| F11 | Partial | Document register, overview, document report and portal history reads page through every row instead of requesting more than the API's 1,000-row cap. | Typecheck/lint; browser `overview-counts`. | Exact revision links for TI/CO (currently text references), stale-revision warnings across screens, XLSX/direct PDF exports and report period/cut-off rules — Word section 20 item 9 and F09. Server-side paginated archive. |
| F07 | Partial | The catalogue generator keeps the stored *Other – specify* value (17 TI options) instead of emitting a hyphen. | Generator parses. | Regeneration check needs the workbook file (not in the repository). Per-activity prompt persistence (147 rows, columns F/G) not started. |
| F10 | Blocked | Read-only inventory query for authorized staff: [F10-role-inventory.sql](F10-role-inventory.sql) (external roles per project, unlinked portal users, revoked contacts with open items, live account-free links, legacy unreleased document files, current releases). | Runs cleanly on the local database inside a read-only transaction. | Production run by authorized staff; approval of the legacy `client` role treatment and the role matrix — Word section 20 items 1 and 5. No role was changed. |
| F01 | Blocked in part | The workbook's Issue responsibility list is the implementation rule. | See D02. | Contact selection and assignment routing are separate decisions. Word section 20 items 2 and 6 still govern initiator roles and the legal meaning of steps. Automatic contractor assignment on NCR/TI submission needs the approved assignee rule. |
| F03 | Implemented and verified (unconditional rules) | `app_private.spec_form_rules()` generated from `lib/forms/spec-forms.ts`: always-required fields and fixed lists per workbook form, including the six workbook decisions. Checked on every signed-in save for changed fixed-list values, on saves from the current form (`_rules` marker) for required fields, and in full at formal submission/resubmission. Older offline payloads and unchanged legacy values stay saveable. | pgTAP 036 (11); 029/035 fixtures completed; node sync and decision tests; 36 browser tests save all 12 forms with the rules active. | Conditional rules stay client-side; Photos and Workforce have no server table; D04 and D05. |
| F06 | Partial — six conflicts implemented and verified | D01–D03 and D06–D08 follow the workbook in the UI (sheet path), the server rules (F03) and saved records; the legacy PDR and Lessons Learned screens with the 19-11 photo rules are unreachable (sheet path), so alternate intake follows the same rules; compatible handwritten edits kept (see the second pass). | Workbook trace 269/277; pgTAP 036; browser saves of all 12 forms; PDR evidence spec. | D04 and D05; the separate questions in the decision table. |
| F09 | Blocked | Release of a revision now requires approval (F15). | — | Which revision is operationally active while a newer one is under review, transmittal process and outstanding-submittal schedule — Word section 20 items 3 and 4. |
| F12 | Blocked | — | — | Baseline/milestone model, timezones, quiet hours, escalation, retention — Word section 20 items 7, 8 and 9. |
| F14 | Partial | `sheet-forms` asserts each page heading; `sheet-forms`, `spec-registers`, `works-completed-focus` and `rapid-verify-values` join the CI browser set; the PDR evidence test finds the record by a stored form value. | Browser runs in the second pass. | Photos and Workforce form cases; one combined browser journey per Word section 17 scenario. |

### Verification run · 21 November 2026

| Check | Result |
|---|---|
| Supabase pgTAP (clean reset, all migrations through 202611230003) | **818 passed across 35 files** (baseline 760/32). New suites 033 (F15), 034 (F02/F08), 035 (F16). |
| Supabase schema lint | No schema errors. |
| Web lint (ESLint + Stylelint), design guardrails | Pass; 9/9. |
| Node tests | 287/287, including the release-rule, verification-queue, archive-index and sign-off-profile sync tests. |
| Production build (Next.js 16.4.6) | Completes. |
| npm production audit | 0 vulnerabilities. |
| Playwright, desktop, local Supabase (production build) | Batch 1: 29 passed, 2 failed, 3 skipped — `sheet-forms` (all 12 ordered forms save, with the F17 heading assertion), `controlled-document`, `rapid-verify-values`, `requirements-final` (Blob cases skipped), `spec-registers`, `works-completed-focus`, `two-party-signature`. The 2 failures were `role-views` cases that need a record with no owner; the fresh fixture had none. Batch 2 ran `inspection-workflow` first and `role-views` then passed: 19 passed, 0 failed. |
| Playwright with the fake Blob store | 10 passed: the document journey (register A, upload B, routing refused while B is under review, approve B, route to client, released revision shown), client approver approves in the client portal, contractor photo evidence closed in Rapid Verify, camera capture and photo stacks, desktop upload. |
| UI stability audit (CLAUDE.md) | 72 screens, 0 findings, worst layout shift 0.017. |
| Not run in this pass | Phone/tablet variants of the changed screens beyond the stability audit, offline replay in the browser for F08 (covered at database level), the Word section 17 NCR and TI journeys end to end, production-sized registers, real camera/storage/notification delivery, backup restore. |

## Second implementation pass and fresh audit · 21 November 2026

**Instruction** · [IMPLEMENTATION-PROMPT.md](IMPLEMENTATION-PROMPT.md). The six recorded conflicts follow the client's 20 November instruction to build the forms exactly as the Excel workbook; compatible 19 November handwritten edits are kept. D04 (Materials Delivery taxonomy) and D05 (Photos classification) stay open. The six decisions do not change assignment routing, sign-off authority, production roles or any other open policy.

**Branch** · `claude/portals-document-register`, commits after `3222403`. Not merged, not deployed; no production data or roles touched.

### Source material used

| Source | Location | Used for |
|---|---|---|
| Excel workbook `Construction_Project_App_Developer_Specification_FINAL_v2.xlsx` (17 sheets) | User desktop, not in the repository | Row-by-row comparison of all 13 form sheets (277 rows) with the app; the server rule table |
| Word file `CODECO_Supervision_App_Developer_Requirements_Menu_and_Contractor_Portal.docx` (sections 1–20, appendices) | User desktop | Menu, portal, workflow, security and section 17/19 checks |
| Images 1–14 (WhatsApp, 19-11-2026 14:03) | User desktop | Annotated change requests, each checked below |
| **Image 15 (mind map: full menu, roles, lifecycle, Client Portal)** | **Not found in this session** | Traced only through its transcription in this checklist's menu table and `requirements-final-client-portal-2026-11-20.md`. The original image should be re-attached for sign-off. |

### The six recorded conflicts (workbook decision)

| ID | Workbook rule applied | UI (sheet path) | Server | Saved record / alternate intake / export |
|---|---|---|---|---|
| D01 Change Order | "Reason for change" required, row 8 | Present, required | Required on save from the form and on submission (pgTAP 036) | Stored in `details.spec`; the legacy controlled-document path is replaced by the sheet for CO; printed in the controlled-document PDF/Word through the spec facts |
| D02 Issue | Ten responsible parties (Client … Undetermined) | The sheet list; name of person/company in the same row; duplicate owner control absent | A value outside the ten is refused when entered or changed (pgTAP 036); older stored values stay editable | Stored in `issue_management.spec` |
| D03 HSE observation | Register-backed Action owner (row 16), no root cause, contractor signs | Present | Action owner required (pgTAP 036) | Incident keeps its own investigation/root cause (HSE Incident Registration) |
| D06 Lessons Learned | Sheet order rows 3–18, one optional Attachments row | Present; drawing selector and duplicate photo control absent | Always-required rows enforced | The four-question legacy screen is unreachable for new and edited lessons (sheet path) |
| D07 PDR | Evidence optional (row 20) | Optional; a chosen photo must upload before the report is kept (rollback) | Not required | The legacy PDR screen with the required original-finish photo is unreachable (sheet path) |
| D08 NCR | NCR type and category before title and description | Present | — (order is a screen rule) | NCR PDF/Word unchanged |

The remaining D08 points follow image 11/14 where compatible: photo-only marking, signatures at the end, Issue type and free-text Impact removed. Page titles follow the Workspace names (F17).

### Workbook trace (all 13 form sheets, 277 rows)

`python scripts/export-workbook-forms.py <workbook> <json>` then `node scripts/audit-workbook-forms.mjs <json>`: **269 of 277 rows pass** (label on screen, sheet order, required where the sheet says Yes; system rows in the form head). The 8 others are the open decisions: Photos rows 4, 6–11 (D05 — the library capture has no sheet layout and the workbook's rows 4–5 contradict each other) and Materials Delivery row 10 "Material category" (D04).

### Workspace pages and menu areas

**15 Workspace pages.** The 12 workbook-sheet pages (Works Ongoing, Works Completed, PDR, Issue, HSE, Materials Delivery, Technical Instructions, Change Order, NCR, Lessons Learned, Agreements Made, HSE Incident Registration) each opened from their tile, carried their own heading, were filled and saved with the server rules active (`sheet-forms`, 12/12). Inspections passed its workflow spec; Workforce passed its lifecycle and form-stacking checks; Photos passed camera capture, stacks and media sharing with the fake Blob store. Photos and Workforce have no row-by-row sheet spec (D05; F14).

**10 menu areas.** Overview, Workspace, Actions, Rapid Verify, Project Documents, Records & Photos, Reports, Contractor Portal, Client Portal and Management opened in the menu-order, role-view and requirements specs; the stability audit covered 24 screens at three widths with no findings. Role views confirm the contractor and client see only their portal sections. Production data volumes, report layouts and real accounts were not part of this run.

### Images 1–14

| Image | Annotation | Result |
|---:|---|---|
| 1 | Workforce "Ik kan niet opslaan" with a deviation | Pass: deviation explanation optional; confirm keeps its time/data checks (earlier browser check). |
| 2 | Drawing eraser and Undo | Pass for presence: eraser and last-markup Undo exist. Multi-step Undo is an open D08 point. |
| 3 | PDR: register count tiles "kan weg" | Pass: no count tiles on the PDR page. |
| 4 | Works Completed: "Plan for tomorrow" and the lower works list crossed out | Pass: the Works Completed tile opens the sheet; saved records fold into one closed "Saved records" bar while the form is open, and stay reachable there and in Records & Photos. |
| 5 | HSE: typed name, root cause crossed, contractor signs | Root cause absent, contractor signature present. Owner picker kept by the workbook decision (D03). |
| 6 | Materials: Unit dropdown, BOQ and totals crossed out | Pass: unit dropdown (workbook list); BOQ/count tiles absent on intake. mm/cm stay a D04 point. |
| 7 | TI: same head as other forms, contractor signs | Pass: shared metadata head and contractor signature. |
| 8 | CO: title on top, metadata on top, reason and duplicate scope crossed | Title (F17) and metadata on top pass; duplicate scope absent; reason kept by the workbook decision (D01). |
| 9 | CO lower part: schedule/cost, two signatures, count tiles crossed | Pass: cost/time rows and both signatures; no count tiles. |
| 10 | Issue: Client/Contractor/Supervision, duplicate owner crossed | Duplicate owner control absent; party list kept by the workbook decision (D02). |
| 11 | NCR: contractor signs too, signatures at the end, correction in the app, photo only (no 360°), lower list/actions crossed | Pass: two-party sign-off at the end; contractor correction through the portal/share link; marking card and record action offer a photo only and open on a photo (this pass); saved list folds while the form is open. |
| 12 | LL: title on top, no drawing selector, four numbered questions, duplicate photo crossed | Title, no drawing selector, no duplicate photo pass; numbered questions replaced by the sheet order (D06). |
| 13 | Photo marking window larger | Desktop: up to 1,240 px wide, photo up to 72 % of the window. Phone: the window is the whole screen and the photo up to 64 % of its height (this pass). Measured result in the browser evidence below. |
| 14 | NCR title/description higher, static Issue type and free-text Impact crossed | Issue type and Impact removed; title/description follow type and category (D08 workbook decision). |

### Word document sections 1–20

| Section | Result after this pass | Still open or not verified |
|---|---|---|
| 1–2.1 Navigation, canonical record | Ten menu areas present; page headings name the form (F17). | One canonical status across sign-off, portal and verification (F01). |
| 3–3.1 Fifteen forms, validation, after submission | 13 workbook form sheets on screen (269/277 rows); server enforces always-required fields and fixed lists on save and on submission (F03); follow-ups created with the record (F08). | Conditional rules stay client-side; Photos and Workforce have no server rule table; automatic assignment on submission (F01, routing decision). |
| 4.1–4.4 Project Documents | Release of approved revisions only (F15); register reads page past the API cap (F11). | Active revision during review, transmittal, outstanding submittals (Word §20 items 3–4); exact revision links in TI/CO; XLSX/direct PDF. |
| 5.1–5.3 Records & Photos | Workforce indexed, form/subtype/facet filters, paging, record numbers in history (F04); per-photo capture time and classification through the queue (F05). | Original-byte retention (Word §20 item 8); Photos rows (D05). |
| 6.1–6.4 Contractor Portal | Sections, responses and document release verified in the browser. | Contractor self-administration of users (not built); onboarding with real accounts. |
| 7.1–7.3 Workflow, event log, signatures | Server-derived signer role/organisation; profile and stage/action checked (F16); submission completeness (F03). | Stage ordering and legal meaning of steps (Word §20 item 6). |
| 8–8.1 Security | Local RLS and file-level tests (pgTAP 031, 033); read-only production inventory prepared (F10). | Production role assignments and legacy `client` treatment (authorization needed). |
| 9–10 Actions, Rapid Verify | Works Completed decided by verification; corrective actions linked to their exact source (F02). | Partial/further-action mapping confirmation. |
| 11–12 Reports, dashboard | Complete counts past the row cap (F11). | Report layouts, period/cut-off rules, XLSX/PDF (Word §20 item 9); baseline schedule (F12). |
| 13–14 Management, notifications | Unchanged in this pass. | Timezone, quiet hours, escalation, retention (Word §20 items 7–8). |
| 15–16 Data model, non-functional | Unique numbers, links; UI stability audit 0 findings. | Real devices, storage, notification delivery, backup restore. |
| 17.1 NCR assign/correct/verify | Form, portal share, contractor response and Rapid Verify each verified separately. | Automatic assignment on submission (routing decision, F01); one combined browser journey. |
| 17.2 Revised drawing | Browser: revision A → B under review refused for release → B approved → released to client → client approves. | Formal transmittal (Word §20 item 4). |
| 17.3 TI response | Two-party TI signature browser test; portal response tests. | Combined issue → acknowledge → respond → verify journey in one browser run. |
| 18 Phases | Hardening continues; see release gates. | — |
| 19 Go-live checklist | See release gates; production checks not run. | Deployment acceptance needs authorization. |
| 20 Decisions | Six form conflicts decided (workbook). | Items 1–10 otherwise open as listed above. |


### Verification evidence · second pass

| Check | Result |
|---|---|
| Supabase pgTAP, clean reset through `202611230004` | **829 passed across 36 files**. New suite 036 (F03 and the six workbook decisions); 029 and 035 fixtures now carry complete forms, because a formal submission must be complete. |
| Schema lint | No schema errors. |
| Node tests | **289/289**, including the server-rule sync test and the six-decision rule test. |
| Workbook trace script | 269/277 rows pass; 8 open rows are D04/D05. |
| Production build | Built by each Playwright run (`start:e2e`) on Next.js 16.4.6. |
| Playwright, desktop, production build, server rules active | **36 passed**: all 12 workbook forms save from the UI (with their page headings), inspection workflow, offline create-and-sync, offline records, two-party signatures, contractor submission, spec registers, role views, controlled documents, autosave, return for correction, double submit, Works Completed and Works Ongoing. |
| Playwright with the fake Blob store | **12 passed** (document release journey, client approval, contractor photo evidence closed in Rapid Verify, camera capture, media and sharing). PDR evidence: **2 passed** after the test was corrected (see below). |
| Layout on phone, tablet and desktop | Form-field stacking, mobile forms and responsive workspace: 16 passed, 4 skipped (viewport-scoped). UI stability audit: 72 screens, **0 findings, worst layout shift 0.017**. One earlier run of the same build measured a single 0.128 shift of the workspace launcher on the phone HSE incident screen; it did not reproduce on rerun and is recorded as intermittent. |
| Test corrections | `delay-report-evidence` now finds the saved PDR by its stored *Detailed cause* (the baseline audit's PDR-0005 finding: the title is generated) and names the page heading level; its tests and the app's messages speak of *attached* photos, since PDR evidence is optional. `requirements-final` follows the F15 release rule. |

### Still open after this pass

| Item | What remains | Needed from |
|---|---|---|
| D04 Materials Delivery | Material category taxonomy and mm/cm units | Client / materials reviewer |
| D05 Photos | Purpose/category/discipline dependency, required capture fields, location semantics; original-byte retention | Client / site team; Word §20 item 8 |
| F01 | Automatic contractor assignment on NCR/TI submission; one canonical status across sign-off, portal and verification | Assignment-routing decision (Word §20 items 2 and 6) |
| F07 | Per-activity prompt answers (147 rows, columns F/G) | Implementation; no decision needed |
| F09 | Active revision during review, transmittal, outstanding submittals | Word §20 items 3–4 |
| F10 | Production role inventory and legacy `client` role | Authorized production access; role-matrix approval |
| F11 | TI/CO exact revision links, stale warnings, XLSX/direct PDF, report period rules | Implementation and Word §20 item 9 |
| F12 | Baseline schedule, timezone, quiet hours, escalation, retention | Word §20 items 7–8 |
| F16 | Stage ordering and legal meaning of steps | Word §20 item 6 |
| Not verified in this session | Image 15 original; real devices and camera; production storage, notifications, backups and restore; production role assignments; markup-window size measured on a real phone and tablet with a photo | Missing source / production authorization |

## Implementation order

1. Address **F15, F10 and F13** first. Control external revision release, verify external role grants and patch the framework.
2. Resolve the client decisions below in parallel. Use them to implement **F01, F03, F16, F09 and F12** for record state, server validation, signature authority, document status and project settings.
3. Complete operational behavior and evidence handling in **F02, F04, F05, F07, F08 and F11**. Apply the approved form and page changes in **F06 and F17**.
4. Run **F14** and the [release gates](#release-gates) across the integrated application.

## Implementation checklist

### F01 Canonical record workflow · High

- [ ] Write down the authoritative state and transition for each relevant record type. Connect form sign-offs, authenticated portal events, permitted account-free responses, Actions, verification, archive and reports by canonical record ID. Preserve existing event/round histories when adapting the read models.
- [ ] Trigger the authorized contractor assignment, response request and recipient notification when submitting an assigned NCR or TI. For each applicable CO, agreement, PDR and inspection, verify that assignment and form-specific response controls lead back to the same record. Keep intake, assignment, acknowledgement, acceptance, publication, verification and closure distinct.
- [ ] Exercise assign → acknowledge → respond with evidence → return → resubmit → verify → close. Check acceptance prerequisites, immutable versions, visible next action, report parity, and all actor/date entries. Verify approved WO/WC/Workforce originators and multiple agreement signatories.

> **Status · blocked in part.** D02 settles the Issue party list. Contact and assignment routing, initiator roles and workflow step meaning still need the decisions listed in D02 and Word section 20 items 2 and 6.

### F02 Rapid Verify and corrective action · High

- [ ] Align the work queue with Works Completed's stored `inspection_status` and review legacy completion data. Give `register_entry` its authorized verification transition. Ensure applicable fail/partial/further-action results preserve the pending or rejected state and link selected follow-up actions to their exact source.
- [ ] Exercise work, NCR, action, inspection and contractor evidence queues. Verify Pass, Fail, Partially complete and Further action required as applicable. Confirm outcome, source status, source history, evidence/photos, location, time, verifier and linked-action behavior. Already accepted work must stay out of pending.

> **Status · implemented and verified on branch.** `202611230002_verification_and_follow_up_integrity.sql`, `lib/verification/verification-model.mjs`. Evidence: pgTAP 034, node queue test, `rapid-verify-values`. Boxes close on merge.

### F03 Submission validation · High

- [ ] Define server-enforced rules by form, mutation and lifecycle state. Use the embedded workbook trace for required/conditional fields, valid controlled values, type/category dependencies, location and record references, and attachment requirements. Review future and legacy payload handling, online saves and offline replay.
- [ ] Verify incomplete drafts are recoverable. Reject invalid final values, unauthorized references and missing required evidence with actionable messages. Test valid and invalid outcomes from every supported submission path, including form edits and retries.

> **Status · implemented and verified for unconditional rules.** `202611230004_spec_server_validation.sql`, `scripts/generate-spec-server-rules.mjs`, `tests/spec-server-rules.test.mjs`. Evidence: pgTAP 036, browser saves of all 12 forms. Open: conditional rules on the server, D04/D05.

### F04 Submitted Forms and Record History · High

- [ ] Index Workforce in Submitted Forms and expose individual register subtypes and distinct HSE observation/incident views. Include permitted filters for discipline, contractor, responsible person and linked action, plus number/title, building, date and state. Keep Photos linked through its library and relevant record associations.
- [ ] Display record numbers and links for sign-off events and retrieve all permitted history through pagination. Verify filters and deep links at realistic volume, including oldest records, retained versions and all accessible form types.

> **Status · partial.** `lib/records/record-directory.mjs`, `app/records-archive.tsx`. Workforce index, subtype/HSE split, discipline/contractor/responsible/linked-action filters, paging, record numbers and deeper history. Open: server-side paginated archive (F11), realistic-volume check.

### F05 Photo originals and capture metadata · High

- [ ] Preserve each original file and store display derivatives separately. Carry metadata through both online and offline queues, including each photo's capture timestamp, purpose, category or discipline, location, caption, related record and visibility. Preserve the upload actor and timestamp. Verify progress, failure recovery and idempotent retry.
- [ ] Verify original bytes by hash after an online and offline mixed-date batch. Reopen through the photo library and each source record, confirm per-photo values and role-scoped downloads, and verify that saving markup preserves the original. Enforce approved required photo fields in the capture path as well as the detail form.

> **Status · partial.** `app/media-library-workspace.tsx`: per-photo capture time and classification through the queue. Blocked: original-byte retention (Word section 20 item 8), required capture fields (D05).

### F06 Conflicting form requirements · High

- [ ] Implement the recorded workbook decisions and resolve the remaining questions in **D01–D08**. Apply the result to field order and labels, visibility and requiredness, controlled values, server validation, stored/printed values and existing records. Check both worksheet and alternate intake paths.
- [ ] Confirm each correction against its matching screenshot and the workbook row. Exercise PDR with no photo, with original-finish evidence, with actual completion evidence and with an upload failure under the approved rules.

> **Status · partial.** The six recorded conflicts are implemented and verified (workbook rule); see the second pass. D04, D05 and the separate questions in the decision table remain open.

### F07 Activity Detail Guide · Medium

- [ ] Map all 147 activity rows, including worksheet columns F/G, to their prompts, options and persistence rules. Apply the relevant prompts to both Works Ongoing and Works Completed as specified. Preserve known concrete details, honor special values and conditional questions, and make generation reproducible.
- [ ] Check all activity keys and options against the workbook. Record representative structured and free-text answers, then reopen and export them. Change the activity and discipline to confirm rules and dependent values reset or revalidate. Fix the generator's 17 Technical Instructions punctuation differences while preserving stable stored values.

> **Status · partial.** Generator keeps the stored *Other – specify* value. Open: regeneration against the workbook (file not in the repository), per-activity prompt persistence.

### F08 Agreement and HSE follow-up consistency · High

- [ ] Use stable follow-up row IDs and persist each intended action with its parent record. Ensure creation is atomic or durably retried. Replay the same submission safely and preserve independent rows with identical descriptions and different owners or dates.
- [ ] Exercise new and edited agreements/incidents, loss of connectivity, interrupted writes, multiple actions, duplicate wording and repeated sync. Confirm owner, due date, source record and closeout link in Actions.

> **Status · implemented and verified on branch.** Database trigger `sync_spec_follow_up_actions`, stable `row_id`, client-side creation removed (`app/operational-workspace.tsx`, `app/forms/spec-fields.tsx`). Evidence: pgTAP 034. Open: who may create follow-ups (Word section 20 item 1).

### F09 Controlled document lifecycle · High

- [ ] Implement the approved operational/current/approved/issued definitions, with authorization and audit history. Preserve originals and links to earlier revisions. Define transmittal data, review/status notifications and planned or outstanding submittals under the approved project procedure.
- [ ] Run approved A → submitted B → rejected B → approved and issued C, including a record pinned to A and export of the document register. Verify status, actor, timestamps, supersedes links, active/issued behavior, notified recipients and stale-reference warnings. Apply F15 to the same scenario.

> **Status · blocked** on Word section 20 items 3–4 (active revision during review, transmittal, submittal schedule). Release now requires approval (F15).

### F10 External roles and tenant isolation · High

- [ ] Inventory real legacy and new external role assignments. Approve each migration or exception. Verify organization, project and approved building/package/discipline scope for contractor and client roles, including invitation, account linking, deactivation and historical shares.
- [ ] Verify contractor, client viewer/reviewer/approver, unlinked, revoked and unrelated organization cases across direct record and attachment access, search, notifications and downloads. Confirm internal notes and unauthorized draft records remain private. Review approved legacy client access and behavior for existing account-free links.

> **Status · blocked** on production access and role-matrix approval. Read-only inventory: [F10-role-inventory.sql](F10-role-inventory.sql). No role changed.

### F11 Canonical links, scale and exports · Medium

- [ ] Link TI, CO and associated supervision records to exact document revisions wherever the client requires a reference. Show stale revision warnings while preserving the original reference. Confirm controlled multi-tagging, locations and document-to-work-package relationships.
- [ ] Add permission-scoped server queries with pagination for document and other capped registers, with stable sort/search/filter behavior. Test with enough evidence and records to exceed the API row limit. Align rows, totals and dates across register UI, dashboard, reports and exports.
- [ ] Define consistent report period, cutoff, timezone and filter semantics. Generate the approved output formats and validate real rows/columns and permitted evidence across daily, weekly, monthly, progress, quality, inspection, HSE, delay, contractor, action, document and custom reports.

> **Status · partial.** Register, overview, report and portal-history reads page past the 1,000-row API cap. Open: TI/CO revision links, stale warnings, XLSX/PDF, report period rules.

### F12 Project settings, schedule and operations · Medium

- [ ] Implement the approved baseline, milestone and planned-versus-actual behavior and show the correct empty state for projects without a schedule. Verify approved client-facing progress and milestone visibility.
- [ ] Complete applicable project configuration for timezones, work-package scoping, workflow stage order, versioned lists, review lead times, notifications, quiet hours, escalation and retention. Apply retention and permissions in backend operations.
- [ ] Exercise two project configurations, including a non-default timezone and date boundaries, event delivery and deduplication, and history after a configuration or list revision. Verify monitoring, storage limits, backup and restore under the agreed operational policy.

> **Status · blocked** on Word section 20 items 7–9.

### F13 Next.js dependency · Medium

- [ ] Upgrade to a supported patched release after checking advisories applicable to the implementation. Update the lockfile and confirm production build, lint, application checks and dependency audit. The original audit flagged 16.4.3. Its proposed update reflected advisory data at the time.

> **Status · implemented and verified on branch.** 16.4.6; audit 0 vulnerabilities; build, lint and tests pass. Box closes on merge.

### F14 Acceptance automation · Medium

- [ ] Make all 15 forms and the Word section 17 journeys mandatory in CI. Assert the complete applicable form, including labels, order, dependencies, required and invalid states, stored fields, evidence, archive retrieval, reports and role-authorized transitions. Add explicit Photos, Workforce and Inspections cases.
- [ ] Use isolated fixtures and record IDs for the positive PDR lookup. Cover both assignment branches, two-building day and attendance, clean and reused data, meaningful offline retry, production-like storage failure and older records. Exercise phone, tablet and desktop, along with keyboard and accessible labels. Capture browser and database evidence for failures.

> **Status · partial.** Heading assertion in `sheet-forms`; four form/verification specs added to CI. Open: Photos and Workforce cases, combined section 17 journeys.

### F15 External release of document revisions · High

- [ ] Separate revision upload/review from external release. Require approved status and authorized release to the chosen recipient scopes. Restrict portal readers to approved metadata and the exact allowed files. Review past sharing and withdrawal behavior in production with authorized staff.
- [ ] Verify privacy of drafts, submitted and rejected revisions, confidential review comments and pending files for both portals. Explicitly release an approved revision and confirm that only the intended recipients can read it. Withdraw it and verify the agreed retained-history and file-access behavior.

> **Status · implemented and verified on branch.** `202611230001_document_release_control.sql`, `app/portal-share-panel.tsx`, `app/portal-app.tsx`, `lib/portal/*`. Evidence: pgTAP 033 and 031, fake-Blob document journey. Open: production review of past sharing (inventory section 5) and the *For information* / pre-approval client review decision.

### F16 Sign-off stage and identity enforcement · High

- [ ] Resolve profile, allowed action, stage and prerequisites on the server. Apply approval authority, reviewer restrictions, allowed delegation and required approval counts using trusted configuration. Derive identity, role, organization and event time from authenticated membership and server context. Record verified external representative attestations distinctly.
- [ ] Exercise approval limits, parallel approvals, return and resubmit, final verification, allowed overrides, expired delegation, out-of-sequence and inconsistent actor inputs. Verify immutable earlier versions and evidence integrity. Match stored trail, viewer and export across role changes.

> **Status · partial.** `202611230003_signoff_identity_and_profile_stages.sql`: server-derived role/organisation, profile and stage-action checks. Evidence: pgTAP 035, node sync test. Blocked: stage ordering and signature meaning (Word section 20 item 6).

### F17 Page headings and annotated layout · Medium

- [ ] Apply approved page-specific titles to Works Ongoing, Works Completed, PDR, Materials Delivery, TI, CO, Lessons Learned, Agreements Made and HSE Incident Registration. Check headings, browser/back navigation and saved-record views. Review the remaining six Workspace titles under the same acceptance rule.
- [ ] Compare mobile, tablet and desktop to all marked screenshots. Confirm metadata placement and signature order, the approved saved-list placement, PDR and delivery grid removal, NCR photo-only marker entry, and the effective photo markup canvas. Verify the drawing eraser and the expected scope of Undo.

> **Status · implemented; device screenshot comparison open.** Headings per form (`sheet-forms`); full-screen photo marking on phones (`final-pass.css`); NCR photo-only marking. Open: markup size measured on real devices, multi-step Undo (D08).

## Client decisions and source conflicts

Apply the client's 20 November instruction to follow the Excel workbook for the six conflicts below. Apply the 19 November handwritten changes wherever they are compatible with the workbook. The precedence decision covers the fields listed here. The separate questions in the final column and the Word section 20 decisions remain open.

| ID | Implementation rule | Remaining work or decision |
|---|---|---|
| D01 | **Workbook.** Keep Change Order “Reason for change” required. | Verify cost/time fields, baseline and revised dates, duplicate scope removal and signatures shown in images 8–9 against both sources. F06/F17. Implemented: required in UI and server (pgTAP 036). |
| D02 | **Workbook.** Use the full 10-option Issue Responsible Party list. | Keep the duplicate owner control removed. Confirm how contact selection maps to actual assignment and notifications. F01/F06. Implemented: ten values in UI and server; duplicate owner control absent. |
| D03 | **Workbook.** Use a project-register Action owner on HSE observations. | Keep the crossed-out root-cause control off the observation form. Verify contractor sign-off and preserve incident investigation in HSE Incident Registration. F06/F16. Implemented: Action owner required in UI and server; root cause absent; contractor signature present. |
| D04 | **Open.** Material group/category taxonomy and dependent rules. | Confirm mm/cm, delivery units and handling of legacy typed units. Keep the crossed-out BOQ strip out of intake. F03/F06/F07. |
| D05 | **Open.** Reconcile Photos workbook rows 4–5 for purpose, category, discipline, requiredness and location. | Keep the larger markup canvas change and verify it on smaller devices. F05/F06/F17. |
| D06 | **Workbook.** Use the Lessons Learned field order and workbook attachment requirements. | Verify the layout and preserve compatible removals, including the drawing control and duplicate photo picker. F06/F17. Implemented: sheet order; drawing selector and duplicate photo picker absent; attachments optional. |
| D07 | **Workbook.** Project Delay Report evidence is optional. | Apply the same optionality to alternate intake. Verify that supplied evidence is linked and upload failures are handled. F03/F06. Implemented: optional on the sheet path; legacy required-photo path unreachable; attached photos must upload (browser 2/2). |
| D08 | **Workbook for NCR field order.** Type and Category come before Title and Description. | Apply photo-only marking within NCR, page-specific headings and removal of explicitly crossed-out lists. Verify record retrieval and responsive layout. Confirm whether Drawing Undo needs broader history than the existing last-markup behavior. F01/F06/F17. Implemented: workbook order; NCR marked on a photo only (card and record action); headings per form; saved lists folded while a form is open. |

## Release gates

- [ ] **Forms and attachments** · Run the 15 Workspace pages and annotated screenshot checks, including alternate intake, historical records, evidence upload, re-open, amend, review and archive. Record the expected and observed result for each form from the workbook trace.
- [ ] **Cross-role journeys** · Demonstrate all three Word section 17 scenarios. Verify allowed and denied roles, exact shared files, provenance, actor/date stamps and immutable histories. Include revocation and legacy access.
- [ ] **Database and upgrades** · Run migrations, schema lint and pgTAP from a clean database and against representative legacy fixtures. Reconcile migration parity for the candidate environment. Run production build, lint, Node tests and all required browser checks with isolated fixtures.
- [ ] **Usability and reporting** · Compare desktop, tablet and phone for authorized roles, including assistive navigation, long content, archive paging, filters, exports and the client-approved report layout. Confirm that no fabricated progress figures appear where inputs are unavailable.
- [ ] **Deployment acceptance** · Verify real device camera/upload behavior and original-file retrieval, notification delivery, production role assignments, audit monitoring and a documented backup restore drill in the authorized environment.
- [ ] **Sign-off** · Record the client decisions and required approvals, test evidence and deployed revision. Resolve or obtain explicit acceptance of any outstanding issue before marking the related requirement complete.

## Audit findings and verification evidence

**Audited revision** · `150e3ae45444ec369b300054dcc3559ec8fbc883` · 21 November 2026  
**Acceptance decision** · **Open.** All 15 Workspace destinations and all 10 menu areas have identifiable source implementations. The audit records **17 findings**, including **11 high-priority** items. Several requirements go beyond the presence of a page or a save button. The findings below prevent acceptance against the supplied specification.

- [Workspace pages and all 15 attachments](#workspace-page-breakdown)
- [Workbook field, workflow and activity trace](#workbook-requirement-trace)
- [Word requirements and full menu coverage](#application-menu-and-word-requirement-trace)

The workbook is the field and workflow reference, the Word file defines product behavior and acceptance, and images 1–14 are annotated change requests and bug reports. Image 15 supplies the full menu, role model and end-to-end workflow, including Client Portal. The attached Word file contains sections 1–20 and ends after its appendices. A similarly named “FINAL with Client Portal” document referenced in repository notes was not part of this review. Conflicting instructions remain visible as acceptance decisions. This is an audit of the checked-out source and local fixtures. No application code or production data was changed.

### Findings

| ID | Priority | Finding and evidence | Acceptance condition |
|---|---|---|---|
| F01 | High | **The supervision, portal and verification workflows can diverge.** The record viewer uses `record_signoff_events`, the portal uses `portal_events`, and Rapid Verify uses `verifications`. Submission exposes a separate share action, including after NCR creation. The standard submission journey does not automatically create an authenticated contractor assignment. The portal writes selected source states, while the form sign-off panel reads its own events. Combined archive history is a separate read model with its own limits. [Form workflow](../../../apps/web/app/forms/signoff-panel.tsx#L116) · [NCR completion](../../../apps/web/app/operational-workspace.tsx#L2941) · [Portal events](../../../supabase/migrations/202611220001_portals_and_document_register.sql#L1129) | Submit an assigned NCR and TI, confirm role-scoped delivery, return and resubmit with evidence, then verify and close. The source viewer, contractor history, action and report should agree on latest status, status prerequisites and every round. Validate WO/WC/WF contractor or foreman submissions and the agreement signatories specified in the workbook. |
| F02 | High | **Rapid Verify does not advance verified work.** The work queue reads `spec.completion_status`, but the Works Completed form writes `spec.inspection_status`. A local model check left a record tagged Inspected – Accepted in the pending queue. The SQL routine reads `register_entry` status and logs a verification, but its transition branches omit `register_entry`. The optional new corrective action only receives a direct source link for finding, inspection and HSE. [Queue](../../../apps/web/lib/verification/verification-model.mjs#L19) · [Form](../../../apps/web/lib/forms/spec-forms.ts#L550) · [SQL](../../../supabase/migrations/202611220002_rapid_verify_action_categories_reminders.sql#L173) | Verify a Works Completed record. Pass must apply the authorized decision and remove it from pending. Fail/partial must preserve the right inspection state and produce a corrective action linked to the source when selected. |
| F03 | High | **Workbook constraints are only partly enforced on the server.** Field requirements, dependent lists and most conditionals run through frontend `specMissing` and `cleanSpecValues`. The SQL spec guard focuses on sensitive data, status and selected review decisions. It does not independently enforce the full required field, controlled-value, project-reference and conditional rule set for submitted payloads. [Client validation](../../../apps/web/app/operational-workspace.tsx#L2174) · [Server guard](../../../supabase/migrations/202611210001_spec_registers_and_signoff_truth.sql#L195) | For every supported mutation and offline replay, preserve drafts and reject incomplete submissions, invalid parent/child pairs, unauthorized references and missing conditional evidence. |
| F04 | High | **Submitted Forms and Record History are incomplete archives.** Workforce is absent from the form-kind filter and from the directory’s dedicated entries. Register subtypes and HSE observation/incident share broad filters. The archive lacks discipline, contractor, responsible person and linked-action filters, and its default and filtered listings are capped. History displays sign-off record kind rather than its record number and caps each source at 300 before a global 500-row display cap. [Directory](../../../apps/web/lib/records/record-directory.mjs#L90) · [Archive](../../../apps/web/app/records-archive.tsx#L18) | Submit each Workspace type, find it under the right archive destination by record number and offered facets, open the exact record, and retrieve early and late history with realistic data volume. |
| F05 | High | **Photo capture can lose evidence fidelity and metadata.** The photo library queues a prepared image blob in place of original bytes and passes the first file’s `lastModified` timestamp for the whole upload batch. The library’s save callback returns photo classification, but the queuing payload omits `spec`; replay only persists it when supplied. Classification is available later in the photo detail. [Capture](../../../apps/web/app/media-library-workspace.tsx#L382) · [Save mapping](../../../apps/web/app/media-library-workspace.tsx#L461) · [Replay](../../../apps/web/lib/offline/upload-queue.ts#L271) | Save a mixed-date multi-photo batch online and offline. Confirm original bytes remain retrievable, previews are separate, and each photo retains its own timestamp, purpose, location and links. Enforce required metadata without losing drafts. |
| F06 | High | **Some workbook fields and annotated requests conflict.** The current Change Order requires the reason crossed out in image 8. Issue uses the workbook’s 10 responsible-party values, while image 10 calls for three. HSE uses a register-backed action owner, while image 5 says the typed name suffices. The workbook describes a dependent Material Category without defining per-group subdivisions, and Photos rows 4–5 conflict on lists and requiredness. The current Lessons Learned worksheet displaces the four numbered narratives and explicit result photo in image 12. The PDR workbook makes evidence optional, while image 3 shows mandatory original-finish evidence and conditional completion evidence. The main sheet path bypasses the legacy named-photo requirement. [Field layouts](../../../apps/web/lib/forms/spec-forms.ts#L590) · [Attachment trace](#annotated-attachments) | Obtain a per-field source decision, then verify the chosen label, position, visibility, requirement, persistence and print behavior. Preserve the discarded source in the acceptance record. |
| F07 | Medium | **Activity guide is only partly interactive.** The 147 activity keys, descriptions, choices and prompt text are in the generator. Works Ongoing uses a general details text area plus structured concrete fields. Works Completed uses completion choices, without a prompt response model. Guide columns F/G are outside the generated payload. [Generator](../../../apps/web/scripts/generate-spec-catalogue.py) · [Work forms](../../../apps/web/lib/forms/spec-forms.ts#L514) | Audit each guide row’s dependency and input rules. Record and reopen the relevant answers per activity. Changing activity or discipline must clear or revalidate dependent answers. |
| F08 | High | **Agreement and incident follow-up creation is conditional on connectivity and separate from saving the source.** The UI saves the record before calling a separate action RPC for each follow-up and skips action creation for pending/offline records. The idempotency key uses normalized action text, so duplicate text on the same source and field can collapse independent rows. [Follow-up helper](../../../apps/web/app/operational-workspace.tsx#L2950) · [Follow-up RPC](../../../supabase/migrations/202611210001_spec_registers_and_signoff_truth.sql#L927) | Use stable row identities and ensure exactly one linked action per required row after sync, retry or partial failure, including two identical descriptions with different owners or dates. |
| F09 | High | **Project document revision status is separate on screen, but the current pointer changes on upload.** A newly submitted revision supersedes the previous revision and becomes current even while it awaits review. Earlier files are retained. The workflow needs a project decision on which revision is operationally active when a newer version is under review. Transmittal is a text reference. The missing-submission schedule is open. [Revision RPC](../../../supabase/migrations/202611220001_portals_and_document_register.sql#L786) · [Document register](../../../apps/web/app/document-register.tsx#L344) | Run approved revision A → submitted B → rejected B → approved C. Verify active and construction-approved designations, original files, formal issue/transmittal, correct notifications and warnings on pinned records. |
| F10 | High | **Legacy client access differs from the mind map’s restricted Client Portal model.** New client portal roles use explicit sharing. The previous `client` role was granted internal daily work access and is preserved. Contractor portal tests cover organization isolation under local roles. The production role assignments and historical files were outside this audit. [Legacy grant](../../../supabase/migrations/202607300006_owner_read_access_to_daily_work.sql) · [Portal role policies](../../../supabase/migrations/202611220001_portals_and_document_register.sql#L193) · [RLS tests](../../../supabase/tests/031_portals_and_document_register.pgtap.sql) | Compare production role assignments with approvals. Migrate or authorize legacy users, verify unlinked and revoked users, and confirm that contractor/client access follows sharing down to file level. |
| F11 | Medium | **Document linking, register scale and report exports are partial.** TI and CO use short text for drawing/revision references. The document register has reverse links and superseded history, leaving cross-screen stale revision warnings unverified. Several new register queries request fixed maximums before filtering locally. The local API caps responses at 1,000 rows, below some requested limits. Register exports are CSV and browser print, and report date filters do not consistently affect all states. [Register query/export](../../../apps/web/app/document-register.tsx#L65) · [Register reports](../../../apps/web/app/register-reports.tsx#L60) | Run server-side paginated search and exports with enough fixtures to exceed API row caps. Validate reproducible period/cut-off and applied filters. Confirm XLSX/direct PDF expectations and exact document revision links. |
| F12 | Medium | **Some configuration and schedule features are partial.** Planned progress displays an explicit no-baseline state. Client milestones expose shared schedule documents and publications, with no structured milestone tracking. Document folder/numbering settings and project reminder lead time are present. Full workflow stage ordering, configurable quiet hours, escalation recipients, per-project timezone behavior and retention enforcement need completion or formal acceptance. [Overview](../../../apps/web/app/overview-panels.tsx#L104) · [Portal schedule](../../../apps/web/app/portal-app.tsx#L257) · [Workflow settings](../../../apps/web/app/forms/spec-configuration-panel.tsx) · [Project settings](../../../apps/web/app/operational-workspace.tsx#L6531) | Configure a project with a baseline, milestones, regional timezone, role/stage rules, reminders and retention policy. Verify figures, policy enforcement and role-specific views against fixtures. |
| F13 | Medium | **The audit found known advisories for the installed Next.js version.** Standalone build commands reported the advisory and exited after compilation, and npm audit identified Next.js 16.4.3 as the sole affected production dependency package. Its suggested update was 16.4.6. The local audit reported zero high/critical packages and did not establish app-specific exposure. [Dependency pin](../../../apps/web/package.json) · [Maintainer security advisory](https://github.com/vercel/next.js/security/advisories/GHSA-pc58-hwjq-p385) | Apply a verified patched release in a separate change and rerun the quality gates. |
| F14 | Medium | **The browser case named “every form” exercises 12 forms and checks a leading slice of their labels.** Photos, Workforce and Inspections are outside that spec. The normal CI browser subset does not include it. Passing the case is evidence of normal-path saves for those 12, with limited rule and workflow coverage. [Browser spec](../../../apps/web/tests/e2e/sheet-forms.spec.ts#L36) · [CI selection](../../../.github/workflows/quality.yml) | Make 15-form acceptance and the Word journeys mandatory. Include missing/invalid inputs, conditional branches, attachments, reopened records, role boundaries, offline, exports and desktop/tablet/phone. |
| F15 | High | **Sharing a document can release a draft or unreviewed revision.** Adding a revision automatically attaches the new file to each active document share without checking its review status. Shared-document RLS also allows authenticated portal recipients to read revision rows containing notes and review comments, while the portal UI selects fewer fields. Review required field/file visibility independently of the UI. [Revision columns](../../../supabase/migrations/202611220001_portals_and_document_register.sql#L291) · [Read policy](../../../supabase/migrations/202611220001_portals_and_document_register.sql#L484) · [Auto distribution](../../../supabase/migrations/202611220001_portals_and_document_register.sql#L845) | Require deliberate release of each approved revision to the permitted audience. Restrict external reads to explicitly visible revision metadata and confirmed files. Test draft, review, approval, withdrawal and stale access for contractor and client users. |
| F16 | High | **Sign-off stage and actor metadata are partly supplied by the UI.** The shared RPC checks authorization for sensitive actions and names/limits for the requested stage. It does not resolve the next permitted stage and action from the canonical record profile before recording the client-selected stage. Organization and role labels are provided by caller inputs. [Workflow RPC](../../../supabase/migrations/202611210001_spec_registers_and_signoff_truth.sql#L626) · [Persisted event fields](../../../supabase/migrations/202611210001_spec_registers_and_signoff_truth.sql#L771) | Enforce configured stage order and prior decisions server-side. Derive authenticated actor role and organization from membership and store external representative claims as separate verified attestation data. |
| F17 | Medium | **Several Workspace page headings still show the generic register name.** Desktop captures show Formal documents & registers above Works Ongoing, Works Completed, PDR, Materials Delivery, TI, Change Order, Lessons Learned and Agreements Made. HSE Incident Registration uses the HSE heading. The inner form text identifies the type. Image 8 and image 12 point the individual form name toward the page heading. [Workspace breakdown](#workspace-page-breakdown) | Confirm the required heading per page and check it in the title, navigation state and saved-record view. |

### Acceptance evidence and limits

The database tests ran against the existing local Supabase stack. Its migration history included the latest migration in the checkout, 202611220003. These are fixture tests, independent of production data, infrastructure and email delivery. Source inspection established the findings above. Acceptance remains open for production schema parity, live deployment styling, device camera behavior, large production-sized registers, real storage and notification delivery, and backup restore. Historical repository QA notes were used for orientation only.

| Check | Result |
|---|---|
| Supabase pgTAP | **760 passed across 32 files** on the running local database. Includes form boundaries, portals/documents, signatures, and verification. |
| Supabase schema lint | **Passed** at error level. |
| Web lint | **Passed** for ESLint and Stylelint. |
| Node tests | **282 passed**, including rendered HTML and nine design guardrails. Ran test files directly because the standalone npm test build stopped at the Next.js advisory. The Playwright production build proceeded with a warning on its retry. |
| Playwright desktop with local Supabase/Fake Blob | **25 passed, 1 failed** across three targeted batches. Passed the 12 ordered-form saves, Works Completed focus, inspection workflow, TI/CO signatures, day PDF/Word exports, navigation, spec comparison, photo/drawing/account-free sharing and the PDR upload-failure rollback. |
| PDR positive evidence test | The test expected to find the submitted narrative in the persisted title. It returned zero as the generated title used the linked work number and cause classification. A local database cross-check found the submitted narrative in the open report PDR-0005 and one linked file. The assertion needs to identify the record by its ID or controlled form values. The positive save and evidence link were independently verified. Both PDR evidence cases passed when rerun on a fresh project. |
| Workforce and formal day lifecycle | **Passed** on a fresh two-building project. On the reused project the same lifecycle test timed out when the Start today button disappeared during loading. It passed on a fresh project, which matches the test’s initial-state requirement. A separate local browser check confirmed that Workforce can submit a two-building count with the deviation explanation left blank, as in image 1. |
| Phone, tablet and desktop checks | Phone navigation and Workspace interactions passed. The selected register row and responsive layout checks passed at 390, 820 and 1,280 px. These tests do not establish layout compliance for every page and state. |
| Desktop screenshots | Reviewed the leading view of each of the 12 ordered forms. The heading mismatch is recorded in F17. The browser fixture used desktop Chrome. |
| npm production dependency audit | No high or critical package findings. Next.js 16.4.3 was flagged as moderate. See F13. |

## Workspace page breakdown

The 15 destinations below come from the attached Word document and image 15. The [field trace](#workbook-requirement-trace) covers the individual worksheet fields. A form’s basic save test establishes that its normal UI path can persist a record in the local fixture. Conditional branches, alternate roles and attached evidence have separate acceptance conditions.

| # | Workspace page | Frontend implementation | Backend and acceptance gaps |
|---:|---|---|---|
| 01 | Works Ongoing | The tile opens the ordered WO form. Report date, shift, discipline/activity, structured area, exact location, description, quantity/unit, progress, crew, start/end time, concrete details, evidence, blocker and remarks. Separate quick day-log path exists. | Numbered register record, activity data in spec and WO-DAILY sign-off. Basic save passed. Exercise midnight, changing activities and backlog/draft replay. Guide prompts and contractor/foreman originator workflow are partial (F01, F07). |
| 02 | Works Completed | The ordered WC form has completion date, activity-based multi-select, quantity/unit, acceptance status, inspection/NCR links, evidence and defects. “Plan for tomorrow” has been removed from the completed form. Saved records are available behind the form/list flow. | Numbered register record and WC-COMPLETION sign-off. Basic save and focused copy check passed. Verify that a rejected completion links the NCR and that contractor evidence moves to inspection, with physical completion and acceptance kept distinct. Rapid Verify status and guide gaps (F01, F02, F07). |
| 03 | Workforce | Building tabs, party/trade/crew rows, times and headcount, copy previous workday, visitors outside headcount, totals, deviation note, draft recovery and signature. Shift, attendance and competency are captured per crew row. | Attendance is day/building scoped. The deviation note is optional and a local browser check confirmed submission with a blank note and a two-building discrepancy. Workforce verification is associated with the day report; dedicated indexed archive retrieval is missing (F01, F04). Check multi-building submission, zero crew count, cross-midnight times, inactive statuses, signer and copied values. |
| 04 | Project Delay Report | Ordered delay dates, affected activity, building/location, cause type/category, cause, responsible party, duration/unit/basis, critical path/milestone, recovery action and owner, date, evidence and status. Legacy form also exposes original and actual completion evidence. Register summary grid is absent from active form. | Register plus PDR-REVIEW profile. Basic save passed. Verify the sheet and alternate input paths use the same evidence rules, duration conversion and contractor response. Client owns the optional-versus-required evidence decision (F06). |
| 05 | Issue | Metadata header, identification time, Type → Category, title, observation, location/GPS, discipline, severity/priority, impact, actions, responsible party/name, target, links and evidence. The legacy duplicate correction-owner selector is gone from the sheet layout. | Finding plus ISSUE-CLOSEOUT workflow. Basic save passed. Full workbook party list differs from the three options annotated in image 10. Confirm party-to-user and contractor routing, due-date rules, and closure note/evidence (F01, F03, F06). |
| 06 | HSE | Observation form with Type → Category, location, consequence, likelihood/severity/rating, immediate and corrective actions, register-linked owner and due date, evidence, incident link and signature. The crossed-out root cause is absent from the observation sheet. | HSE event, optional restricted handling and HSE-OBSERVATION profile. Basic save passed. Owner UI differs from image 5. Validate contractor acknowledgement, sign-off order, approved matrix and critical escalation (F01, F06, F12). |
| 07 | Materials Delivery | Time, supplier, PO/note, material group, description, ordered/received quantity, unit dropdown plus Other, delivery/arrival/inspection status, storage, discrepancy and attachments. BOQ/register grid removed from active intake. | Delivery register, quantities and MAT-RECEIPT sign-off. Basic save passed. Separate material-category row missing due to conflicting workbook taxonomy. Confirm receiving and QA identities, validation for differing quantities, reinspection, units and supplier acknowledgment (F03, F06). |
| 08 | Inspections | Checklist selection, scheduled/started/completed view, per-item outcomes, evidence, classification, linked work, witness and signature. The project retains its checklist surface. No dedicated worksheet was provided. | Inspections and checklist responses, INSPECTION-WITNESS profile and Rapid Verify follow-up. Desktop checklist failure, NCR detour, completion and inspector signature passed. Evidence recheck, permission boundaries and independent witness acknowledgment remain open. |
| 09 | Technical Instructions | Metadata first, then date, independent type, Discipline → Category, location/element, drawing revision reference, instructions, reason, recipient/owner, response date, evidence and sign-off. Contractor signature has a source implementation. | Numbered controlled register and TECH-INSTRUCTION. Basic save passed. Print contractor signature and test issue/acknowledge/ask/respond/verify: portal and source timelines must agree. Drawing reference is currently text, so version-linked use is partial (F01, F11). |
| 10 | Change Order | Metadata first, followed by request/type/category/title, formal change description, reason, originator/location, document reference, quantities, cost/time, assessment, approved amounts/days, proceed, attachments and signatures. Older duplicate scope narrative and register count grid are out of the active sheet form. | Numbered controlled record plus CHANGE-APPROVAL. Basic save passed. Current mandatory reason conflicts with image 8. Confirm independent technical/commercial stages and approval limits, controlled issuance, correct source/portal state and exports (F01, F06). |
| 11 | NCR | Metadata, classification, title/description, discipline/location, requirement, detection context, related inspection, severity, containment, disposition, root cause and corrective action, owner, target, verification, evidence and two-party signature. Legacy fixed Issue type and free-text impact were removed. Marker entry uses photos. | Numbered finding, NCR-CORRECTIVE, account-free response route or explicit contractor portal share, and follow-up verification. Basic save passed. Workbook puts classification before title and description, unlike image 14. Validate routing on submission and review/archive state continuity (F01, F06). |
| 12 | Lessons Learned | Metadata and ordered workbook sequence, phase/category, situation, what happened, impact, cause, lesson, recommendation, applicability, discipline, owner, evidence and reviewer. Drawing location and generic duplicate photo control are absent in the sheet path. | Numbered register plus LESSON-REVIEW and approved lessons visibility. Basic save passed. Confirm screenshot’s four numbered narratives and issue/result photo pair versus replacement sheet evidence slot, and sharing across projects (F06). |
| 13 | Agreements Made | Date/source, type/category, description, agreeing parties, action required, conditional owner and due date, location/discipline, related record, state, minutes/evidence and closure note. | Numbered agreement, AGREEMENT-ACK sign-off and separate action creation. Basic save passed. Multi-party signatory workflow and consistency of generated actions, including offline, remain open (F01, F08). |
| 14 | HSE Incident Registration | Dedicated incident form, near-miss path, injury/health/environment/damage conditionals, response, repeated notification and witness data, investigation, corrective rows, evidence, related observation and reviewer. | HSE event plus restricted sensitive table and HSE-INCIDENT workflow. Basic save passed. Verify all sensitive fields by role through report/share/cache, and deterministic action creation for repeatable rows (F03, F08). |
| 15 | Photos | Take or upload multiple photos, per-item caption, stack, date grouping, location, gallery, photo detail and mark-up. 360° has a distinct capture path. The annotation dialog has wider desktop CSS overrides. | Private file, capture, link and offline queue models. Classification requiredness, separate original bytes and per-photo timestamps are incomplete on the library path. Desktop photo stacks, pins, 360° and account-free sharing passed. Confirm required metadata and original-file fidelity, file and record ID search and selective authenticated sharing (F04, F05, F06). |

Primary implementation surfaces · [Workspace routes and tile handlers](../../../apps/web/app/project-workspace-home.tsx) · [Sheet layouts](../../../apps/web/lib/forms/spec-forms.ts#L590) · [Operational forms and saves](../../../apps/web/app/operational-workspace.tsx) · [Workforce](../../../apps/web/app/workforce-register.tsx) · [Photos](../../../apps/web/app/media-library-workspace.tsx) · [Supabase mutation clients](../../../apps/web/lib/supabase/operations.ts)

### Additional Workspace surfaces

The 15 client destinations coexist with legacy and supporting views. Their role in the workflow should be explicit because several can create records outside a worksheet layout.

| Surface | Purpose and remaining audit concern |
|---|---|
| Workspace search and saved-record viewers | Cross-form code and facet search, recent records, deep links, sign-off and sharing. An independent Records & Photos nav exists. Individual form lists remain accessible and Workspace still surfaces record search. Agree where archive interactions belong. |
| Drawings and pins | Drawing/PDF page viewer, pan, zoom, revision cloud, arrow, text, eraser and undo. Pins can open exact project records and create issues. Check position persistence per page, removal history and behavior after a drawing revision changes (F09, F11). |
| Daily work and quick day log | General ongoing/completed/delay entries supplement activity-level worksheets. For each alternative intake, trace how fields, numbering, permission and reports compare to the sheet path. |
| Formal registers and controlled submissions | Generic and legacy record types, document intake, environmental report, BOQ/progress, RFI/RFA/WCR and inspection requests use shared infrastructure. Validate those permitted for each organization. Core client pages should keep their own headings and form rules. |
| Assets, legacy document folders and photo detail | Stored evidence, folder search, links, renames and withdrawals. The controlled Project Documents register and its legacy folder/browser path both exist. One canonical record and revision identity need cross-surface acceptance. |
| Field aids | Calculator, sketches, global capture, dictation and camera launch, including offline/permission states. Validate supported devices, document language and preserved evidence. |
| Deadlines and verification shortcuts | Actions and Rapid Verify links route to operational follow-up. Canonical form and portal status alignment remains open (F01, F02). |

### Annotated attachments

Numbers follow the attachments in the request. “Present” is source evidence unless a runtime check is stated.

| Image | Client annotation | Audit result |
|---:|---|---|
| 1 | Workforce “Ik kan niet opslaan”, pointing at confirm after a deviation. | Deviation explanation is now optional. Confirm retains its normal time/data gates. A local browser check confirmed a two-building count with an unexplained deviation. The exact screenshot combination with a restored signed draft remains untested. |
| 2 | Drawings “Veger & undo button”. | Eraser and last-markup undo are present. Undo removes the most recent markup on the page. It is not a multi-operation edit-history undo. Hit-testing source exists. |
| 3 | PDR “Kan weg bij PDR”, across the register statistics grid. | Shared count grid is absent from the active PDR flow. Completion evidence in the screenshot conflicts with the optional workbook row. |
| 4 | Works Completed “Plan for tomorrow” crossed out, plus lower works tabs/list. | Tomorrow section removed and focused browser check passed. Saved records remain available. If the cross means total removal from Workspace, that interpretation is still open. |
| 5 | HSE typed name sufficient, responsible-person dropdown and root cause crossed out, contractor also signs. | Root cause absent in HSE observation, contractor sign supported. Current worksheet uses Action owner register picker/Other, differing from the single-name annotation. |
| 6 | Materials Delivery Unit dropdown, BOQ and totals below form crossed out. | Unit dropdown present. BOQ remains elsewhere and count grid is absent on active intake. Check whether mm/cm are required here. |
| 7 | TI same metadata as HSE/other forms at top, add contractor sign. | Shared metadata head and contractor signature source present. Confirm immutable saved identity, document output and cross-role receipt. |
| 8 | Change Order title at top, always put metadata at top, remove reason and redundant scope details. | Metadata appears at the top of the form and duplicate scope text is absent. The page heading still says Formal documents & registers (F17). Current required reason conflicts. |
| 9 | Change Order lower form shows schedule/cost and two signatures. Crossed-out register tiles. | Cost/time and separate signers present, no count tiles in active flow. Compare older baseline/revised-date and approval layout with the current ordered worksheet. |
| 10 | Issue responsible person options Client / Contractor / Supervision, remove contractor owner duplicate. | Duplicate control absent in current layout. Workbook party taxonomy takes precedence in current source. |
| 11 | NCR contractor sign too, sign at end, contractor correction in app, photos only in marker task, lower list/actions crossed. | Two-party sign-off and response surfaces exist. Photo-only marker entry present in NCR. Some actions and saved records remain available through record detail/history. Confirm whether crossed actions should move or be removed. Automatic authenticated assignment gap is F01. |
| 12 | Lessons Learned title at top, no drawing selector, number and stack four questions, remove duplicate photo. | The form title is present and the sheet layout omits drawing and the redundant general picker. The page heading still says Formal documents & registers (F17). Workbook narratives no longer match the exact numbered four-panel version. Confirm distinct issue/result evidence requirement. |
| 13 | Enlarge photo markup modal. | Desktop width and viewport-relative image limits increased in [CSS](../../../apps/web/app/styles/final-pass.css#L501). Confirm the effective drawing canvas on a phone and a tablet with representative portrait and landscape images. |
| 14 | NCR title/description higher, remove static Issue type and free-text Impact. | Static Issue type and legacy free-text Impact gone. Ordered workbook now places NCR Type/Category before title and description. Source precedence needs approval. |
| 15 | Complete navigation, role model and record lifecycle. | All ten areas identifiable. [Full menu trace](#application-menu-and-word-requirement-trace) and F01–F17 track acceptance issues. |

Image 5 applies to HSE observations. It does not remove the distinct investigation or root-cause requirements of HSE Incident Registration. Image 11 asks to remove 360° from the NCR marker flow. Photos retains a 360° feature for its separate project-evidence workflow.

## Application menu and Word requirement trace

Menu item names follow image 15. Section numbers below refer to the supplied Word file, which defines the Contractor Portal and has 20 sections. Client Portal is assessed from the menu map and its role description.

### Menu coverage

| Menu | Requested pages and views | Implementation and missing acceptance evidence |
|---|---|---|
| 1. Overview | Project Summary, Progress Overview, Work Status, Quality Overview, HSE Overview, Pending Actions, Contractor Overview, Document Overview, Recent Activities, Notifications | Project command center and supplemental widgets. Shows stored BOQ actual progress, work/day log, quality/NCR, HSE, actions, inspections, revisions, contractor and activity data. Planned-versus-actual metrics need a baseline and matching quantities. Recent links and status/severity/party counts need a fixed reference dataset. Bell exists. F11/F12. [Overview](../../../apps/web/app/overview-panels.tsx) |
| 2. Workspace | Works Ongoing, Works Completed, Workforce, Project Delay Report, Issue, HSE, Materials Delivery, Inspections, Technical Instructions, Change Order, NCR, Lessons Learned, Agreements Made, HSE Incident Registration, Photos | All 15 destinations are present. See the [individual pages](#workspace-page-breakdown) and [field trace](#workbook-requirement-trace) for validation, source conflicts, submission and completeness. |
| 3. Actions | Action Dashboard, All Actions, My Actions, Contractor Actions, Corrective Actions, Preventive Actions, Overdue Actions, Pending Verification, Completed / Closed | Dashboard, status/owner filters and action categories provide the named views. Central action records support deadlines, ownership, evidence, verification and source links. The form/provenance gap applies to offline follow-ups and some Rapid Verify corrective actions. F02/F08. [Action center](../../../apps/web/app/project-action-center.tsx) |
| 4. Rapid Verify | Verification Dashboard, Work Verification, NCR Verification, Action Verification, Inspection Follow-up, Evidence Review, Pending Verification, Verification History | Mobile-oriented queues, four verification results, viewer history, evidence/photos/GPS/comments and optional corrective action. Original specs comparison still available. Limit and transition gaps are F02/F11. [Queue](../../../apps/web/app/verification-queue.tsx) |
| 5. Project Documents | 00 Document Register & Transmittals, 01 Drawings, 02 Technical Specifications, 03 Project Schedules, 04 BOQ & Contract Documents, 05 Method Statements & Procedures, 06 Material Submittals, 07 Shop Drawings, 08 Permits & Certificates, 09 Correspondence, 10 HSE & Environmental Documents, 11 Testing & Commissioning, 12 Handover & Close-out, 13 Other Project Documents | All 14 starter folders, configurable taxonomy and a main menu destination. Register metadata, history, status, links, preview/download, CSV/print and permissions present. Transmittal is a text reference. Revision authority, stale links, outstanding submittals and deliberate external release are partial (F09/F11/F15). [Taxonomy](../../../apps/web/lib/documents/document-register.mjs) · [Register](../../../apps/web/app/document-register.tsx) |
| 6. Records & Photos | Submitted Forms, Photo Library, Attachments, Record History | Four dedicated tabs. Evidence/file library reused. Submitted Forms covers broad record kinds without a Workforce index or fine-grained form facets, and history is capped. F04/F05. [Archive](../../../apps/web/app/records-archive.tsx) |
| 7. Reports | Daily Reports, Weekly Reports, Monthly Reports, Progress Reports, Quality Reports, Inspection Reports, HSE Reports, Delay Reports, Contractor Reports, Action Reports, Document Reports, Custom Reports | Daily supervision and day overview exports. Period sections serve weekly/monthly, progress, quality, inspections, HSE and delay. Contractor/action/documents have register reports. Custom reports use period section selection/filters. Confirm client-specific layouts, planned versus actual, confidentiality, export format and consistent period rules (F11/F12). [Register reports](../../../apps/web/app/register-reports.tsx) · [Report models](../../../apps/web/lib/reports) |
| 8. Contractor Portal | Contractor Dashboard, Assigned to Me, Responses & Submissions, Pending Actions, Shared Documents, History | All six sections. Dedicated role shell, shared records and files, deadline states, response forms for NCR/cost-time/delay and other requests, optional external submissions, and returned/resubmitted history. Verify invitation-to-organization onboarding, workflow continuity, response persistence, and optional contractor user administration. F01/F10. [Portal](../../../apps/web/app/portal-app.tsx) |
| 9. Client Portal | Client Dashboard, Project Progress, Reports & Publications, Photos & Site Updates, Shared Project Documents, Items for Client Review, Key Issues & Risks, Milestones & Schedule, Correspondence & Decisions, History & Notifications | All ten sections via the restricted role shell. Published reports and selectively shared photos, documents, issues and decisions. Milestones & Schedule is a list of shared schedule artifacts; Project Progress lists published updates. Confirm legacy migration and that client decisions appear on canonical record and report; verify permissions, file history and publication filters. F01/F10/F12. [Portal](../../../apps/web/app/portal-app.tsx#L163) |
| 10. Management | Project Setup, Buildings & Locations, Contractors & Consultants, Users & Permissions, Work Packages, Disciplines, Dropdown Lists, Workflow Management, Notifications, Document Settings, System Settings, Archive Management | Project, building/location tree, parties, users and project roles, work classification, configurable lists/workflows, reminders, document folder/numbering/review settings, readiness/backups/settings, archive and a Portals admin area. Confirm work-package-to-contract and portal restrictions, controlled list history, project timezone/currency, quiet hours, retention and restore. F10/F12. [Management views](../../../apps/web/app/operational-workspace.tsx) · [Lists/workflows](../../../apps/web/app/forms/spec-configuration-panel.tsx) |

### Word sections 1–18

| Section | Client requirement | Audit result |
|---|---|---|
| 1–2.1 | Controlled collaboration and distinct creation, documents, archive, portal, actions and reports. One canonical project record. | Dedicated areas and ID links exist. Workspace still includes saved record lists/search and some legacy alternate intake. The three workflow event streams need unified canonical status across modules. F01/F04. |
| 3–3.1 | Fifteen forms, approved field order/conditional controls/validation/sign-off, permitted drafts; persistent unique number and time, central attachments, archive, triggers, actions and trail. | All destinations and 277 workbook field rows traced. Conditional server validation, complete archive, workflow triggers and follow-up creation have gaps. F01/F03/F04/F08/F14. |
| 4.1 | Default 00–13 taxonomy, configurable, browse and search, one document/file with multiple tags/locations/packages. | Configurable folder list and searchable register. One folder code and one work-package field with multiple building IDs. Multi-category/package tagging and a distinct transmittal workflow need confirmation. F09/F11. |
| 4.2 | Unique number, title, category, discipline, location, originator, type, revision, status, issue/upload dates and actor, reviewer, links, original file and supersedes. | Document/revision/link schema covers these fields. Review document grouping, floor/zone versus buildings and version-specific linkage in field forms. F09/F11. |
| 4.3 | Preserve revisions, show current, role-restricted approval/IFC, append actor/time, notify affected users, warn on superseded links. | Permission checks and history exist. Upload changes current; status notification recipients differ from upload notification recipients. End-to-end superseded-link warning and IFC selection remain open. F09/F11. |
| 4.4 | Search number/title/keyword/file, filter category/discipline/location/originator/status/revision/date, sort number/title/date/revision/status, export, preview/download, configured outstanding submissions only. | Common fields and basic register export implemented with fixed query caps. Verify revision sorting/filtering, actual date cutoff in exports and configured planned submittals. No committed schedule model for outstanding requirements found in this path. F11. |
| 5.1–5.3 | Submitted Forms, Photo Library, Attachments and Record History. Original files and IDs, upload identity/time, location, source link/work package, evidence type, caption/taken date, visibility; permitted filters. | Four archive tabs and private links. Field order/metadata in workbook trace. Retention of original bytes, per-photo capture data, Workforce index, filtering and history depth are partial. F04/F05. |
| 6.1 | Contractor dashboard, own assignments, responses/submissions, actions, history, optional deliberately shared documents. | All sections exist. Local DB permission isolation passed. Browser proof of the complete contractor journey is still open. F01/F10. |
| 6.2 | CO justification/cost/time; TI acknowledge/questions/implementation; NCR cause/correction/target/evidence; agreements acknowledgement/sign/action; delay explanation/dates/mitigation; inspection request coordination/evidence. | Portal models expose generic and type-specific response controls with evidence. Confirm every form’s request type, attachments and downstream review requirements in UAT. F01. |
| 6.3 | Contractor organization/contact, assignment time/by, due date, purpose, priority, visibility, status and next action. | Explicit share form and RPC include organization, contact fields and visibility selection. Validate named contact versus organization-wide read and notification semantics. F01/F10. |
| 6.4 | Invite/associate external org and account, profile-specific permissions, optional own-org admin, scope and revocation with history. | CODECO admin user management plus party linking and roles. Optional external user-management UI is not implemented. F10. |
| 7.1–7.3 | Submit, assign, notify, acknowledge/respond, review/return, resubmit, verify/close. Immutable actor/version/round/event metadata and signature evidence. | Separate record, portal and verification workflows cover many stages and events. State, authority, prerequisites and timeline agreement need end-to-end proof. The server accepts stage and actor label inputs that need stronger provenance (F16). Legal/signatory decisions belong to CODECO (F01). |
| 8–8.1 | Server/API and file authorization, organization/project separation, internal notes, audit, sessions, deactivate, private notification previews. | Database RLS and storage gateway, scoped external share, portal-safe projection and account controls. Test coverage for local tenant separation is substantial. Verify production role migration, all offboarding paths and external previews with real configuration. F10. |
| 9 | Central action ID/title/source, owner/party/date/priority, status, evidence, verifier/time/result/closure reason. Contractor completion enters verification. | Action register and contractor “ready” path present. F02/F08 affect source linking and automatic creation. |
| 10 | Open linked items, inspect completion/evidence, result/comments/photos/location/time/verifier, failed-action follow-up and source history. | Queue and history exist. Work transition and selected source linking incomplete. F02. |
| 11 | Daily, weekly, monthly, quality, inspection, HSE, delay, contractor, actions and docs. Existing data, filters, period/cut-off/time and permitted PDF/Excel. | See Reports menu. F11 documents extraction and representation gaps. Confirm exact launch layouts and export type. |
| 12 | Planned/actual if available; actions; NCR/severity/contractor; pending CO/TI; inspections; HSE; revisions; recent submissions/photos; contractor responses; activity links. | Most widgets and links have source implementation. Baseline/schedule unavailable, and count completeness at scale needs validation. F11/F12. |
| 13 | Configure project metadata, locations, organizations and contacts, users/roles, work packages/discipline, lists/sign-off, reminders, document rules, retention/archive. | See Management. Project status and retention values are modeled. Verify operational enforcement and organizational scoping. F10/F12. |
| 14 | Assignment, due/overdue, new response, return, review decision, document revision/review, action and inspection alerts, authenticated links, configurable escalation/quiet hours. | In-app plus email/push dispatch implementations, reminders for portal work and document reviews. Common lead time and dedupe exist. Full event-by-event delivery, inspection schedule/update triggers, quiet hours and escalation recipient setup need validation. F12. |
| 15 | Unique IDs, links instead of duplication, NCR/Action/Response/Evidence/Verification, Document/Revision/Transmittal/Record, Agreement/Party/Action/Acknowledgement, scoped search, canonical timestamps and project-local display. | Main IDs and model links present. Specific gaps in F01/F04/F08/F09/F11/F12. |
| 16 | Responsive/mobile, clear states, accessibility, upload progress/errors, drafts, scale/pagination, previews, backups/DR/monitoring/storage. | Browser fixtures and lint cover selected behavior. See runtime checks in [audit](#audit-findings-and-verification-evidence). Real camera/storage and restore are open. Client decisions on file formats, limits and operations still apply. |
| 17.1 | Assign an NCR on submit, notify contractor, receive correction, review/return, verify and archive. | Form save and separate workflow controls exist. Default authenticated routing on submission and a unified timeline are partial (F01). |
| 17.2 | Revised drawing, transmittal, retained old revision, formal status review and notifications. | Revision UI and DB tests cover retention/history. Confirm current/approved semantics and formal transmittal (F09). |
| 17.3 | TI issue/assignment, linked docs, acknowledge/question/respond, verify/return and preserve history. | TI and signature tests establish local paths. Authenticated portal actions and canonical timeline agreement are still open (F01/F11). |
| 18 | Core → documents → portal → action/verification → reporting/dashboard → hardening. | Features exist at each phase. Hardening and acceptance require closure of open findings and completion of deployment validation. |

### Word section 19 go-live checklist

| Check | Current acceptance |
|---|---|
| Submit and retrieve every configured form | Forms exist. Browser save checks cover 12 worksheet forms directly. Archive does not index Workforce as its own form (F04). |
| Assign and display only in the right contractor portal | Explicit assignment implemented with local RLS coverage. Assignment triggered on submission still partial (F01). |
| Cross-contractor record, evidence, comments and actions isolation | Local pgTAP passed. Confirm actual role assignments and file visibility from deployed accounts (F10). |
| Contractor response, upload and resubmit | Source paths and local SQL tests exist. Full authenticated UI journey across requested response types is open. |
| Authorized review, return, approve/accept, verify, close | Source and SQL tests cover multiple events. Verify cross-module status and required stages (F01/F02). |
| Every round visible with actor and time | Event stores preserve history. Combined archive lacks complete unbounded access and some cross-stream identity (F01/F04). |
| Folder structure, register, revisions and superseded status | Locally implemented. Active revision semantics remain open (F09). |
| Every earlier revision retained | SQL and pgTAP verify earlier revision retention locally. Production original-file retrieval open. |
| Permission-scoped record and document search | RLS and archive/register search exist. Pagination/facets and production access parity remain open (F04/F11). |
| Actions linked from source through verification and closure | Partial due to F02/F08. |
| Stored figures, dates and filters in reports/dashboard | Implemented in common paths. Missing baseline and inconsistent register filtering affect full acceptance (F11/F12). |
| Internal notes/supervisor-only fields excluded from contractor access | Portal form shares use a summary and selected files. Shared document revisions have a distinct metadata and automatic file distribution gap, so this criterion is open (F15). Verify real shares, prior role grants and exports (F10). |
| Revocation blocks future access and preserves history | Local policy and tests exist. Verify deployed sessions, link revocation, cache behavior and prior downloads under approved policy. |

### Word section 20 decisions

1. Approve project role names and permission matrix, legacy client treatment and whether contractor administrators manage their organization’s accounts.
2. Decide which forms contractors can initiate versus respond to, including WO/WC/Workforce submitter roles.
3. Define document review statuses, construction issue authority and which revision remains active during review.
4. Approve numbering, revision conventions and the transmittal process.
5. Decide whether building, package and discipline also restrict contractor access.
6. Approve the signature provider, signatory evidence and contractual/legal meaning of each step.
7. Approve notification channels, reminders, escalation recipients and quiet hours.
8. Approve upload types and limits, storage and backup approach, retention and restore requirements.
9. Approve required launch reports, exact layouts, export formats and client publication rules.
10. Identify required storage, email, scheduling and other project integrations.

Appendices A/B supply definitions and the canonical information flow. Image 15 adds Client Portal and has the same create → assign/publish → respond → verify → archive lifecycle. The major open issue is agreement across each view of the same record (F01).

### Backend surfaces included in the review

| Surface | Evidence reviewed |
|---|---|
| Auth, users, project roles and session lifecycle | Auth/session clients, admin user/role routes, permissions model, role grants and membership SQL. Checked legacy versus new portal behavior against the Word roles and mind map. |
| Form and action data | Operational RPC wrappers, spec persistence and guarded fields, sign-off/version migrations, generated form schemas, offline replay, and role tests. |
| External links and portals | Account-free share token, response and upload endpoints, party-scoped portal shares/events and file permissions, protected gateway and internal versus external fields. |
| Documents and evidence | Private-file routes, upload completion/content checks, original/thumbnail flow, linking/mark-up, revision/read policies and audit tables. |
| Notifications and background tasks | In-app dispatch and portal reminders, email/push environment dependencies, daily cron and backups. Actual deployment and restore were outside the fixture run. |
| Exports, navigation and nonfunctional checks | Report data models and file exports, record routes, language, accessibility/design guardrails and selected Playwright paths. |

### Route inventory

| Entry point | Source purpose |
|---|---|
| `/` | Public landing, sign-in entry and marketing links. |
| `/supervisie` | Sign-in/recovery, project selection, role-aware supervisor/contractor/client shells. Supervisor screens are project navigation and module states in this route. [URL state](../../../apps/web/lib/navigation/screen-url.mjs) |
| `/share/[token]` | Account-free record/evidence response page with a separate scoped server path. This and the authenticated portal are distinct entry points for external responses. |
| `/api/admin/users`, `/api/admin/project-role` | User inventory, invitation/account lifecycle and project role mutation. |
| `/api/storage/uploads`, `/api/storage/uploads/complete`, `/api/storage/files/[fileId]` | Upload claim, completion and protected read/download for project evidence and documents. |
| `/api/external-share/[token]/response`, `/evidence`, `/upload`, `/upload/complete` | Scoped external response, evidence read and upload lifecycle under the same token path. |
| `/api/notifications/dispatch`, `/api/notifications/push-subscriptions`, `/api/cron/daily`, `/api/backups/ensure-daily` | Notification delivery/setup and background maintenance. Requires deployed service configuration and delivery/restore acceptance. |
| `/api/maps/static`, `/api/weather/current`, `/api/speech/transcribe`, `/api/release` | Maps, weather, dictation and deployment metadata, with normal UI fallbacks. |
| `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml` | Platform metadata endpoints. |

## Workbook requirement trace

Each table uses the physical Excel row so the original field, required flag, control and conditions can be found precisely. “Mapped” means that a source control or system field could be identified. It does not certify all dependencies, persistence, permissions, or runtime behavior. Findings are indexed in the [audit](#audit-findings-and-verification-evidence).

Workbook source — Construction_Project_App_Developer_Specification_FINAL_v2.xlsx. The app schema and workbook use different field identifiers. Numbering below follows the sheet’s displayed order values.
Coverage inventory — **277 form rows** and **147 activity rows**. Regeneration matched the stored catalogue except for 17 Technical Instructions “Other – specify” entries. The generator emits a hyphen where the workbook and checked-in catalogue use an en dash. Keep stable stored values when fixing the generator.

### Photos

[Media library](../../../apps/web/app/media-library-workspace.tsx) and [photo detail](../../../apps/web/app/stored-photo-detail.tsx)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Record ID | System-generated | Yes | Always | File document code / visual capture identity |
| 4 | 2 | Project | Auto-filled / dropdown | Yes | Always | Current authorized project context |
| 5 | 3 | Photo purpose | Dropdown | Yes | Always | Capture picker and detail classification. Save is possible without a purpose in the library. Classification does not transfer through the offline queue (F05). |
| 6 | 4 | Photo category | Dependent dropdown | Yes | After Photo purpose | Combined with work discipline and optional for two purposes. Ambiguous source (F06). |
| 7 | 5 | Work discipline | Dropdown | No | If photo relates to construction work | See row 4. Workbook list and instructions disagree (F06). |
| 8 | 6 | Work location | Structured dropdown + short text | Yes | Always | Library location/building and detail fields. Required structured location needs enforcement. |
| 9 | 7 | Photo date/time | Date/time default | Yes | Always | Capture metadata. Library applies first file last-modified timestamp to the whole batch (F05). |
| 10 | 8 | Photo upload | File upload / multiple files | Yes | Always | Batch upload exists. Library queues derived bytes as the saved file (F05). |
| 11 | 9 | Caption / observation | Short text | No | Always | Per-photo and shared caption on capture. |
| 12 | 10 | Related record | Linked-record selector | No | When applicable | Optional in saved photo classification; separate file links are available. Confirm canonical link behavior (F11). |
| 13 | 11 | Taken by | Auto-filled user | Yes | Always | Authenticated uploaded-by identity. Capture/display metadata requires runtime verification. |

### Works Ongoing

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L679)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Record ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Report date | Date default | Yes | Always | Mapped — Report date. |
| 6 | 4 | Shift | Dropdown | No | Always | Mapped — Shift. |
| 7 | 5 | Work discipline | Dropdown | Yes | Always | Mapped — discipline (Work discipline, Secondary discipline). |
| 8 | 6 | Activity | Dependent dropdown | Yes | After Work discipline is selected | Mapped — Activity. |
| 9 | 7 | Building / area | Dropdown + optional text | Yes | Always | Mapped — Building / area. |
| 10 | 8 | Exact location / grid / level | Short text or location selector | Yes | Always | Mapped — Exact location / grid / level. |
| 11 | 9 | What exactly is being worked on? | Activity-specific dropdown / short text | Yes | After Activity | Mapped — What exactly is being worked on?. |
| 12 | 10 | Quantity completed | Number | Yes where measurable | Always; mark N/A only where the activity cannot reasonably be quantified | Mapped — quantity (Quantity completed, Quantity not measurable (N/A)). |
| 13 | 11 | Unit | Dropdown | Yes where quantity entered | When Quantity completed is entered | Mapped — Unit. |
| 14 | 12 | Progress status | Dropdown | Yes | Always | Mapped — Progress status. |
| 15 | 13 | Progress percentage | Number / slider | No | When useful for the activity | Mapped — Progress percentage. |
| 16 | 14 | Crew / contractor | Linked register dropdown | Yes | Always | Mapped — Crew / contractor. |
| 17 | 15 | Start / finish time | Time fields | No | If relevant to activity | Mapped — Start / finish time (Start time, Finish time, Work crosses midnight). |
| 18 | 16 | Activity-specific technical details | Conditional fields | No; required fields depend on activity | Show only the fields relevant to the selected activity | Mapped — Activity-specific technical details (Element, Element ID, Concrete grade / mix, Volume (mÂ³), Delivery ticket / batch references, Slump and cube sample references, Details for this activity). Concrete fields, one activity details text area for others. Guide prompts are hints, with no separate persisted value per prompt (F07). |
| 19 | 17 | Inspection / test reference | Linked record / short text | No | When inspection applies | Mapped — Inspection / test reference. |
| 20 | 18 | Photos | Multiple image upload | No | Always | Mapped — Photos. |
| 21 | 19 | Blocker / issue | Conditional dropdown + short text | No | If On Hold or blocker = Yes | Mapped — blocker (Blocker / issue, Linked issue or delay report). |
| 22 | 20 | Remarks | Short text | No | Always | Mapped — Remarks. |
| 23 | 21 | Reported by | Auto-filled user | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 28 | 22 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 29 | 23 | Workflow status | System-generated / read-only | System | When a workflow profile is active | Mapped — Workflow status. |

### Works Completed

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L700)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Record ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Completion date | Date default | Yes | Always | Mapped — Completion date. |
| 6 | 4 | Work discipline | Dropdown | Yes | Always | Mapped — discipline (Work discipline, Secondary discipline). |
| 7 | 5 | Activity | Dependent dropdown | Yes | After Work discipline | Mapped — Activity. |
| 8 | 6 | Building / area | Dropdown + optional text | Yes | Always | Mapped — Building / area. |
| 9 | 7 | Exact location / grid / level | Location selector / short text | Yes | Always | Mapped — Exact location / grid / level. |
| 10 | 8 | What was completed? | Activity-dependent multi-select dropdown + conditional text | Yes | After Activity | Mapped — What was completed?. Guide completion options present. START HERE also calls for activity prompts (F07). |
| 11 | 9 | Quantity completed | Number | Yes where measurable | Always; allow N/A only where not measurable | Mapped — quantity (Quantity completed, Quantity not measurable (N/A)). |
| 12 | 10 | Unit | Dropdown | Yes where quantity entered | When Quantity completed is entered | Mapped — Unit. |
| 13 | 11 | Completion / inspection status | Dropdown | Yes | Always | Mapped — inspection (Completion / inspection status, Inspected by). Inspection decision in form. Rapid Verify does not advance this field (F02). |
| 14 | 12 | Inspection reference | Linked record selector | No | If inspected | Mapped — reference (Inspection reference, Linked NCR / issue). |
| 15 | 13 | Contractor / crew | Linked register dropdown | Yes | Always | Mapped — Contractor / crew. |
| 16 | 14 | Photo evidence | Multiple image upload | Recommended | Always | Mapped — Photo evidence. |
| 17 | 15 | Outstanding work / defects | Conditional short text + linked record | No | If not accepted or outstanding work exists | Mapped — Outstanding work / defects. |
| 18 | 16 | Remarks | Short text | No | Always | Mapped — Remarks. |
| 19 | 17 | Reported by | Auto-filled user | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 29 | 18 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 30 | 19 | Workflow status | System-generated / read-only | System | When a workflow profile is active | Mapped — Workflow status. |

### Project Delay Report

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L774)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | PDR number | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Delay start date/time | Date/time | Yes | Always | Mapped — Delay start date/time. |
| 6 | 4 | Reported date/time | Auto-filled date/time | Yes | Always | Server creation metadata distinct from the observed delay start. Display/runtime verification open. |
| 7 | 5 | Affected activity | Dropdown / linked work record | Yes | Always | Mapped — activity (Affected activity, Affected activity (not in the list)). |
| 8 | 6 | Location | Location dropdown | Yes | Always | Mapped — Location. |
| 9 | 7 | Delay cause type | Dropdown | Yes | Always | Mapped — Delay cause type. |
| 10 | 8 | Delay cause category | Dependent dropdown | Yes | After Delay cause type | Mapped — Delay cause category. |
| 11 | 9 | Detailed cause | Short text | Yes | Always | Mapped — Detailed cause. |
| 12 | 10 | Responsible party | Dropdown | No | Always | Mapped — Responsible party. |
| 13 | 11 | Delay duration | Number | Yes | Always | Mapped — duration (Delay duration, Duration is). |
| 14 | 12 | Duration unit | Dropdown | Yes | Always | Mapped — Duration unit. |
| 15 | 13 | Critical path impact | Dropdown | Yes | Always | Mapped — Critical path impact. |
| 16 | 14 | Schedule / milestone impact | Short text + linked milestone | No | If impact exists | Mapped — Schedule / milestone impact. |
| 17 | 15 | Mitigation / recovery action | Short text | Yes | Always | Mapped — Mitigation / recovery action. |
| 18 | 16 | Action owner | User / contractor dropdown | Yes | Always | Mapped — Action owner. |
| 19 | 17 | Target recovery date | Date | No | If recovery action is required | Mapped — Target recovery date. |
| 20 | 18 | Evidence | File upload | No | Always | Mapped — Evidence. Workbook optional. Annotated version requires original-date evidence and conditionally completion evidence. Current sheet path must be tested against both (F06). |
| 21 | 19 | Status | Dropdown | Yes | Always | Mapped — status (Status, Closure note and reviewer). |
| 26 | 20 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 27 | 21 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

### Issue

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L591)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Issue ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Date/time identified | Date/time default | Yes | Always | Mapped — Date/time identified. |
| 6 | 4 | Issue type | Dropdown | Yes | Always | Mapped — Issue type. |
| 7 | 5 | Category | Dependent dropdown | Yes | After Issue type | Mapped — Category. |
| 8 | 6 | Title | Short text | Yes | Always | Mapped — Title. |
| 9 | 7 | Description | Long text | Yes | Always | Mapped — Description. |
| 10 | 8 | Location | Location dropdown + detail | Yes | Always | Mapped — Location. |
| 11 | 9 | Discipline / work package | Dropdown | No | If relevant | Mapped — Discipline / work package. |
| 12 | 10 | Priority | Dropdown | Yes | Always | Mapped — Priority. |
| 13 | 11 | Impact type | Multi-select dropdown | No | Always | Mapped — Impact type. |
| 14 | 12 | Immediate action taken | Short text | No | If action taken | Mapped — Immediate action taken. |
| 15 | 13 | Responsible party | Contractor / user dropdown | Yes | Always | Mapped — responsible (Responsible party, Responsible person / company). Full workbook party list and name. Three-role screenshot conflicts (F06). |
| 16 | 14 | Corrective action required | Long text | Yes | Always | Mapped — Corrective action required. |
| 17 | 15 | Target completion date | Date | Yes | Always | Mapped — Target completion date. |
| 18 | 16 | Related record | Linked-record selector | No | If applicable | Mapped — Related record. |
| 19 | 17 | Attachments | File upload | No | Always | Mapped — Attachments. |
| 20 | 18 | Status | Dropdown | Yes | Always | Mapped — Status. |
| 21 | 19 | Resolution / closure note | Long text | Conditional | When status = Closed | Mapped — Resolution / closure note. |
| 22 | 20 | Reported by | Auto-filled user | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 27 | 21 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 28 | 22 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

### HSE

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L634)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | HSE report ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Date/time observed | Date/time default | Yes | Always | Mapped — Date/time observed. |
| 6 | 4 | Issue type | Dropdown | Yes | Always | Mapped — Issue type. |
| 7 | 5 | Category | Dependent dropdown | Yes | After Issue type | Mapped — Category. |
| 8 | 6 | Title | Short text | Yes | Always | Mapped — Title. |
| 9 | 7 | Observation / hazard description | Long text | Yes | Always | Mapped — Observation / hazard description. |
| 10 | 8 | Location | Location dropdown + detail | Yes | Always | Mapped — Location. |
| 11 | 9 | Person / contractor involved | Linked register dropdown | No | If applicable | Mapped — Person / contractor involved. |
| 12 | 10 | Potential consequence | Multi-select dropdown | Yes | Always | Mapped — Potential consequence. |
| 13 | 11 | Risk likelihood | Dropdown | Yes | Always | Mapped — Risk likelihood. |
| 14 | 12 | Potential severity | Dropdown | Yes | Always | Mapped — Potential severity. |
| 15 | 13 | Risk rating | System-calculated or dropdown | Yes | After likelihood and severity | Mapped — Risk rating. Approved matrix when configured, controlled manual rating otherwise. Approval of project matrix required. |
| 16 | 14 | Immediate action taken | Long text | No | If action taken | Mapped — Immediate action taken. |
| 17 | 15 | Corrective / preventive action | Long text | Yes | Always | Mapped — Corrective / preventive action. |
| 18 | 16 | Action owner | User / contractor dropdown | Yes | Always | Mapped — Action owner. Workbook register-linked action owner replaces the crossed-out legacy selector and single text box (F06). |
| 19 | 17 | Due date | Date | Yes | Always | Mapped — Due date. |
| 20 | 18 | Photo evidence | Multiple image upload | Recommended | Always | Mapped — Photo evidence. |
| 21 | 19 | Related incident | Linked record | No | If applicable | Mapped — Related incident. |
| 22 | 20 | Status | Dropdown | Yes | Always | Mapped — status (Status, Verification / closure note). |
| 23 | 21 | Reported by | Auto-filled user | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 28 | 22 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 29 | 23 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

### Materials Delivery

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L717)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Delivery record ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Delivery date/time | Date/time | Yes | Always | Mapped — Delivery date/time. |
| 6 | 4 | Supplier | Linked register dropdown | Yes | Always | Mapped — Supplier. |
| 7 | 5 | Purchase order / requisition | Linked record / short text | Yes | Always | Mapped — Purchase order / requisition. |
| 8 | 6 | Delivery note number | Short text | No | If provided | Mapped — Delivery note number. |
| 9 | 7 | Material group | Dropdown | Yes | Always | Mapped — Material group. Cement and other material choices come from the Material Group family. |
| 10 | 8 | Material category | Dependent dropdown | Yes | After Material group | No standalone dependent row. Workbook taxonomy presents three families instead of group-specific categories (F06). |
| 11 | 9 | Material description / specification | Short text | Yes | Always | Mapped — Material description / specification. |
| 12 | 10 | Ordered quantity | Number | Yes | Always | Mapped — Ordered quantity. |
| 13 | 11 | Delivered quantity | Number | Yes | Always | Mapped — Delivered quantity. |
| 14 | 12 | Unit | Dropdown | Yes | Always | Mapped — Unit. Controlled dropdown. Shared and form-specific options differ (F06). |
| 15 | 13 | Delivery status | Dropdown | Yes | Always | Mapped — delivery_status (Delivery status, Revised delivery date). |
| 16 | 14 | Condition on arrival | Dropdown | Yes | Always | Mapped — Condition on arrival. |
| 17 | 15 | Inspection result | Dropdown | Yes | Always | Mapped — inspection (Inspection result, Inspection decided by). |
| 18 | 16 | Storage location | Location dropdown | No | If accepted and stored | Mapped — Storage location. |
| 19 | 17 | Discrepancy / remarks | Short text | Conditional | If exception exists | Mapped — discrepancy (Discrepancy / remarks, Discrepancy). |
| 20 | 18 | Photos / documents | File upload | No | Always | Mapped — Photos / documents. |
| 21 | 19 | Received by | Auto-filled user | Yes | Always | Mapped — Received by. |
| 26 | 20 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 27 | 21 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

### Technical Instructions

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L735)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Instruction ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Instruction date | Date default | Yes | Always | Mapped — Instruction date. |
| 6 | 4 | Instruction type | Dropdown | Yes | Always | Mapped — Instruction type. |
| 7 | 5 | Discipline | Dropdown | Yes | Always | Mapped — Discipline. |
| 8 | 6 | Category / subject | Dependent dropdown | Yes | After Discipline is selected | Mapped — Category / subject. |
| 9 | 7 | Location / element | Location selector + short text | Yes | Always | Mapped — Location / element. |
| 10 | 8 | Drawing / document reference | Short text / linked document | No | If applicable | Mapped — Drawing / document reference. Short text with revision hint. No canonical project-document revision link in the sheet slot (F11). |
| 11 | 9 | Instruction description | Long text | Yes | Always | Mapped — Instruction description. |
| 12 | 10 | Reason / background | Dropdown + short text | No | Always | Mapped — reason (Reason / background, Supporting explanation). |
| 13 | 11 | Issued to | Contractor / company dropdown | Yes | Always | Mapped — Issued to. |
| 14 | 12 | Action owner | User dropdown | Yes | Always | Mapped — Action owner. |
| 15 | 13 | Response required by | Date | No | If response is required | Mapped — Response required by. |
| 16 | 14 | Status | Dropdown | Yes | Always | Mapped — Status. |
| 17 | 15 | Attachments | File upload | No | Always | Mapped — Attachments. |
| 18 | 16 | Related record | Linked record selector | No | If applicable | Mapped — Related record. |
| 19 | 17 | Acknowledged by / date | User + date | Conditional | After status = Acknowledged or later | Mapped — Acknowledged by / date. Conditional auto field plus sign-off log. Check portal-to-record acknowledgement mapping (F01). |
| 20 | 18 | Closed / verified by | User dropdown | No | When completed | Mapped — Closed / verified by. |
| 25 | 19 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 26 | 20 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

### Change Order

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L753)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Change Order ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Request date | Date default | Yes | Always | Mapped — Request date. |
| 6 | 4 | Change type | Dropdown | Yes | Always | Mapped — Change type. |
| 7 | 5 | Change category | Dependent dropdown | Yes | After Change type is selected | Mapped — Change category. |
| 8 | 6 | Change title | Short text | Yes | Always | Mapped — Change title. |
| 9 | 7 | Change description | Long text | Yes | Always | Mapped — Change description. |
| 10 | 8 | Reason for change | Dropdown | Yes | Always | Mapped — Reason for change. Required workbook dropdown restored after client crossed out the older equivalent (F06). |
| 11 | 9 | Originator / requester | User or company dropdown | Yes | Always | Mapped — Originator / requester. |
| 12 | 10 | Location / work package | Location dropdown + short text | Yes | Always | Mapped — Location / work package. |
| 13 | 11 | Drawing / specification reference | Linked document / short text | No | If applicable | Mapped — Drawing / specification reference. Short text with revision hint. Canonical revision-link workflow incomplete (F11). |
| 14 | 12 | Quantity / unit | Number + unit dropdown | No | If applicable | Mapped — Quantity / unit (Added quantity, Omitted quantity, Unit). |
| 15 | 13 | Cost impact | Currency amount | Yes | Always | Mapped — cost (Cost impact, Currency). |
| 16 | 14 | Time impact | Number + unit | Yes | Always | Mapped — time (Time impact, Time unit). |
| 17 | 15 | Cost / schedule assessment | Long text / attachment | No | If impact exists | Mapped — Cost / schedule assessment. |
| 18 | 16 | Approval status | Dropdown | Yes | Always | Mapped — Approval status. |
| 19 | 17 | Approved amount / days | Numeric fields | Conditional | When approved | Mapped — Approved amount / days (Approved amount, Approved days). |
| 20 | 18 | Instruction to proceed | Dropdown | Yes | Always | Mapped — Instruction to proceed. Separate field from approval. Server enforcement of prerequisites needs end-to-end evidence (F01). |
| 21 | 19 | Related records | Linked-record selector | No | If applicable | Mapped — Related records. |
| 22 | 20 | Attachments | File upload | No | Always | Mapped — Attachments. |
| 23 | 21 | Prepared / reviewed / approved by | User dropdowns | Yes according to workflow | Always | Mapped — Prepared / reviewed / approved by (Approved by, Approval date). |
| 30 | 22 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 31 | 23 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

### NCR

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L610)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | NCR number | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Date raised | Date/time default | Yes | Always | Mapped — Date raised. |
| 6 | 4 | NCR type | Dropdown | Yes | Always | Mapped — NCR type. Workbook NCR taxonomy. Legacy single-value Issue type removed. |
| 7 | 5 | Category | Dependent dropdown | Yes | After NCR type | Mapped — Category. |
| 8 | 6 | Title | Short text | Yes | Always | Mapped — Title. |
| 9 | 7 | Non-conformance description | Long text | Yes | Always | Mapped — Non-conformance description. |
| 10 | 8 | Discipline / work package | Dropdown | Yes | Always | Mapped — Discipline / work package. |
| 11 | 9 | Location / element | Location selector + short text | Yes | Always | Mapped — Location / element. |
| 12 | 10 | Requirement reference | Short text / linked document | Yes | Always | Mapped — Requirement reference. |
| 13 | 11 | Detected during | Dropdown | Yes | Always | Mapped — Detected during. |
| 14 | 12 | Related inspection | Linked record | No | If applicable | Mapped — Related inspection. |
| 15 | 13 | Severity / classification | Dropdown | Yes | Always | Mapped — Severity / classification. |
| 16 | 1 | Immediate containment | Multi-select dropdown | Yes | Always, when an NCR is registered | Mapped — containment (Immediate containment, Why no containment applies, Containment carried out). Workbook order cell says 1 between 13 and 15. Physical row is the containment row. |
| 17 | 15 | Disposition | Dropdown | Yes | Always | Mapped — Disposition. |
| 18 | 16 | Root cause category | Dropdown | No | After investigation | Mapped — Root cause category. |
| 19 | 17 | Root cause analysis | Long text | No | During investigation | Mapped — Root cause analysis. |
| 20 | 18 | Corrective action | Long text | Yes | Always | Mapped — Corrective action. |
| 21 | 19 | Action owner | User / contractor dropdown | Yes | Always | Mapped — Action owner. |
| 22 | 20 | Target completion date | Date | Yes | Always | Mapped — Target completion date. |
| 23 | 21 | Verification result | Dropdown | Conditional | Before closure | Mapped — Verification result. Reviewer result in form and separate verification workflow (F01). |
| 24 | 22 | Verified by / date | User + date | Conditional | Before closure | Mapped — Verified by / date (Verified by, Verified on). |
| 25 | 23 | Attachments | File upload | No | Always | Mapped — Attachments. |
| 26 | 24 | Status | Dropdown | Yes | Always | Mapped — Status. |
| 39 | 25 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 40 | 26 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

### Lessons Learned

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L792)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Lesson ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Date recorded | Date default | Yes | Always | Mapped — Date recorded. |
| 6 | 4 | Project phase | Dropdown | Yes | Always | Mapped — Project phase. |
| 7 | 5 | Lesson category | Dependent dropdown | Yes | After Project phase is selected | Mapped — Lesson category. |
| 8 | 6 | Title | Short text | Yes | Always | Mapped — Title. |
| 9 | 7 | Situation / context | Long text | Yes | Always | Mapped — Situation / context. |
| 10 | 8 | What happened? | Long text | Yes | Always | Mapped — What happened?. Workbook now uses its longer sequence. Screenshot requested four numbered stacked narratives (F06). |
| 11 | 9 | Impact / consequence | Multi-select + short text | Yes | Always | Mapped — impact (Impact / consequence, Actual consequence). |
| 12 | 10 | Root cause / contributing factors | Long text | No | If known | Mapped — Root cause / contributing factors. |
| 13 | 11 | Lesson learned | Long text | Yes | Always | Mapped — Lesson learned. |
| 14 | 12 | Recommendation / preventive action | Long text | Yes | Always | Mapped — Recommendation / preventive action. |
| 15 | 13 | Applicability | Dropdown | Yes | Always | Mapped — Applicability. |
| 16 | 14 | Discipline | Dropdown | No | If applicable | Mapped — Discipline. |
| 17 | 15 | Action owner | User / department dropdown | No | If action required | Mapped — Action owner. |
| 18 | 16 | Attachments | File upload | No | Always | Mapped — Attachments. Current sheet evidence slot. Verify behavior of earlier distinct issue/result photos (F06). |
| 19 | 17 | Review status | Dropdown | Yes | Always | Mapped — Review status. |
| 20 | 18 | Recorded by / reviewed by | Auto-filled + user dropdown | Yes / conditional | Always / on review | Mapped — Recorded by / reviewed by (Reviewed by). |
| 25 | 19 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 26 | 20 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

### Agreements Made

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L810)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Agreement ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Meeting / agreement date | Date/time | Yes | Always | Mapped — Meeting / agreement date. |
| 6 | 4 | Meeting / source | Dropdown + short text | No | Always | Mapped — source (Meeting / source, Meeting number / reference). |
| 7 | 5 | Agreement type | Dropdown | Yes | Always | Mapped — Agreement type. |
| 8 | 6 | Agreement category | Dependent dropdown | Yes | After Agreement type is selected | Mapped — Agreement category. |
| 9 | 7 | Agreement / decision title | Short text | Yes | Always | Mapped — Agreement / decision title. |
| 10 | 8 | Agreement details | Long text | Yes | Always | Mapped — Agreement details. |
| 11 | 9 | Agreed by | Multi-select user / company dropdown | Yes | Always | Mapped — Agreed by. |
| 12 | 10 | Action required | Dropdown | Yes | Always | Mapped — Action required. |
| 13 | 11 | Action owner | User / contractor dropdown | Conditional | If Action required = Yes | Mapped — Action owner. Conditional UI and separate action. Offline and follow-up consistency gap (F08). |
| 14 | 12 | Due date | Date | Conditional | If Action required = Yes | Mapped — Due date. Conditional due date. Same follow-up consistency gap (F08). |
| 15 | 13 | Related discipline / location | Dropdown + location selector | No | If applicable | Mapped — Related discipline / location (Related discipline, Related location). |
| 16 | 14 | Related record | Linked record selector | No | If applicable | Mapped — Related record. |
| 17 | 15 | Status | Dropdown | Yes | Always | Mapped — Status. |
| 18 | 16 | Evidence / minutes | File upload | No | Always | Mapped — Evidence / minutes. |
| 19 | 17 | Confirmation / closure note | Short text | No | When status changes | Mapped — Confirmation / closure note. |
| 20 | 18 | Recorded by | Auto-filled user | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 25 | 19 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 26 | 20 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

### HSE Incident Registration

[Form layout](../../../apps/web/lib/forms/spec-forms.ts#L654)

| Excel row | Order | Workbook field | Control | Required | Workbook visibility | Application evidence |
|---:|---:|---|---|---|---|---|
| 3 | 1 | Incident ID | System-generated | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 4 | 2 | Project | Auto-filled | Yes | Always | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |
| 5 | 3 | Incident date/time | Date/time | Yes | Always | Mapped — Incident date/time. |
| 6 | 4 | Reported date/time | Auto-filled date/time | Yes | Always | Server creation metadata distinct from incident time. Display/runtime verification open. |
| 7 | 5 | Incident type | Dropdown | Yes | Always | Mapped — Incident type. |
| 8 | 6 | Incident category | Dependent dropdown | Yes | After Incident type | Mapped — Incident category. |
| 9 | 7 | Incident title | Short text | Yes | Always | Mapped — Incident title. |
| 10 | 8 | Detailed event description | Long text | Yes | Always | Mapped — Detailed event description. |
| 11 | 9 | Exact location | Location dropdown + detail | Yes | Always | Mapped — Exact location. |
| 12 | 10 | People involved / affected | Linked user / contractor register | Conditional | If people involved | Mapped — People involved / affected. |
| 13 | 11 | Injury classification | Dropdown | Conditional | If injury/illness | Mapped — Injury classification. |
| 14 | 12 | Nature of injury / illness | Dropdown + short text | Conditional | If injury/illness | Mapped — Nature of injury / illness. |
| 15 | 13 | Body part affected | Dropdown | Conditional | If injury/illness | Mapped — Body part affected. |
| 16 | 14 | Environmental impact | Dropdown | Conditional | If environmental event | Mapped — Environmental impact. |
| 17 | 15 | Property / equipment damage | Dropdown + short text | Conditional | If damage occurred | Mapped — damage (Property / equipment damage, Affected asset and estimated impact). |
| 18 | 16 | Immediate response | Long text | Yes | Always | Mapped — Immediate response. |
| 19 | 17 | Authorities / client notified | Dropdown + date/time | No | If notification required | Mapped — notified (Authorities / client notified, Notification log). |
| 20 | 18 | Witnesses | Linked user / contact register | No | If witnesses | Mapped — Witnesses. |
| 21 | 19 | Potential / actual severity | Dropdown | Yes | Always | Mapped — Potential / actual severity. |
| 22 | 20 | Investigation required | Dropdown | Yes | Always | Mapped — Investigation required. |
| 23 | 21 | Investigation findings / root cause | Long text | Conditional | If investigation required | Mapped — Investigation findings / root cause. |
| 24 | 22 | Corrective / preventive actions | Action list | Yes | Always | Mapped — Corrective / preventive actions. Repeatable rows. Saving the incident and creating actions are separate operations (F08). |
| 25 | 23 | Photo / document evidence | Multiple file upload | No | Always | Mapped — Photo / document evidence. |
| 26 | 24 | Related HSE observation | Linked record | No | If applicable | Mapped — Related HSE observation. |
| 27 | 25 | Status | Dropdown | Yes | Always | Mapped — status (Status, Closure note). |
| 28 | 26 | Reported by / HSE reviewer | Auto-filled + user dropdown | Yes | Always | Mapped — Reported by / HSE reviewer (HSE reviewer). Reporter and HSE reviewer. Sensitive incident data has its own access rules. |
| 33 | 27 | Sign-off / review workflow | Linked workflow panel / repeatable sign-off log | Conditional | When this form is submitted or requires review/acknowledgement | Mapped to saved-record sign-off panel. Compare [workflow controls](#sign-off-workflow) and F01. |
| 34 | 28 | Workflow status | System-generated / read-only | System | When a workflow profile is active | System record/header and saved viewer. Check identifier allocation, timestamp and actor with real roles. |

### Shared Dropdown Lists

Lists occupy Excel rows 2–18. Local source is [the catalogue and project defaults](../../../apps/web/lib/forms/spec-forms.ts#L72).

| Excel row | List | Source use and audit result |
|---:|---|---|
| 2 | Priority | Issue and escalation. Code derives urgency for Critical. Project policy still needs acceptance. |
| 3 | Shift | Workforce and Works Ongoing. Other asks for a label. |
| 4 | Progress status | Works Ongoing progress differs from review status. |
| 5 | Unit | Work forms and delivery expose configurable units. Form sheets omit mm/cm while this shared sheet includes them (F06). |
| 6 | Risk likelihood | HSE uses likelihood and configurable definitions. |
| 7 | Potential severity | HSE uses severity and configurable definitions. |
| 8 | Attendance status | Workforce crew lines. Compare headcount and hours for every non-present status. |
| 9 | Competency / authorization status | Workforce crew lines. Test expired/noncompliant values through export. |
| 10 | Duration unit | Delay and change-order timing use controlled units. |
| 11 | Impact type | Issue uses a multi-select. |
| 12 | Responsible party | Issue and PDR share the workbook catalogue. Issue screenshot requests three terms (F06). |
| 13 | Completion / inspection status | Works Completed options exist. Rapid Verify persistence gap (F02). |
| 14 | Photo purpose | Photos purpose/detail paths. Capture and offline persistence gaps (F05, F06). |
| 15 | NCR Type / Category | NCR local dependent catalogue. |
| 16 | Change Order Type / Category | CO local dependent catalogue. |
| 17 | Agreements Type / Category | Agreements local dependent catalogue. |
| 18 | Lessons Learned Project Phase / Category | Lessons Learned local dependent catalogue. |

### Activity Detail Guide

Every activity key and the location of its source row are listed below. The generated catalogue includes description, completion list and prompt text. The worksheet also carries notes in columns F/G. The generator reads only A–E. The forms do not persist one answer per guide prompt (F07).

| Excel row | Discipline | Activity | Completion choices | Prompts |
|---:|---|---|---:|---:|
| 2 | Preliminaries & Site Establishment | Site Clearing & Preparation | 4 | 5 |
| 3 | Preliminaries & Site Establishment | Demolition & Removal | 4 | 5 |
| 4 | Preliminaries & Site Establishment | Temporary Facilities | 8 | 5 |
| 5 | Preliminaries & Site Establishment | Temporary Utilities | 8 | 5 |
| 6 | Preliminaries & Site Establishment | Site Fencing & Hoarding | 7 | 5 |
| 7 | Preliminaries & Site Establishment | Mobilization | 8 | 5 |
| 8 | Preliminaries & Site Establishment | Site Logistics & Access | 8 | 5 |
| 9 | Surveying & Setting Out | Topographic Survey | 6 | 5 |
| 10 | Surveying & Setting Out | Building / Grid Setting Out | 6 | 5 |
| 11 | Surveying & Setting Out | Level & Benchmark Transfer | 6 | 5 |
| 12 | Surveying & Setting Out | Utility / Services Survey | 6 | 5 |
| 13 | Surveying & Setting Out | As-Built Survey | 6 | 5 |
| 14 | Earthworks & Ground Improvement | Topsoil Stripping | 7 | 6 |
| 15 | Earthworks & Ground Improvement | Bulk Excavation | 7 | 6 |
| 16 | Earthworks & Ground Improvement | Trench Excavation | 7 | 6 |
| 17 | Earthworks & Ground Improvement | Foundation Excavation | 7 | 6 |
| 18 | Earthworks & Ground Improvement | Rock Excavation | 7 | 6 |
| 19 | Earthworks & Ground Improvement | Dewatering | 7 | 6 |
| 20 | Earthworks & Ground Improvement | Filling & Backfilling | 7 | 6 |
| 21 | Earthworks & Ground Improvement | Subgrade Preparation | 7 | 6 |
| 22 | Earthworks & Ground Improvement | Soil Stabilization | 7 | 6 |
| 23 | Earthworks & Ground Improvement | Ground Improvement | 7 | 5 |
| 24 | Earthworks & Ground Improvement | Compaction & Testing | 7 | 6 |
| 25 | Foundations & Substructure | Piling | 5 | 5 |
| 26 | Foundations & Substructure | Pile Testing | 4 | 5 |
| 27 | Foundations & Substructure | Pile Caps & Ground Beams | 4 | 6 |
| 28 | Foundations & Substructure | Pad / Strip Footings | 4 | 6 |
| 29 | Foundations & Substructure | Raft / Mat Foundation | 4 | 6 |
| 30 | Foundations & Substructure | Basement Construction | 4 | 5 |
| 31 | Foundations & Substructure | Foundation Waterproofing | 7 | 6 |
| 32 | Foundations & Substructure | Underground Retaining Structures | 4 | 5 |
| 33 | Concrete & Reinforced Concrete | Blinding / Lean Concrete | 9 | 6 |
| 34 | Concrete & Reinforced Concrete | Formwork & Falsework | 7 | 5 |
| 35 | Concrete & Reinforced Concrete | Reinforcement Fixing | 7 | 6 |
| 36 | Concrete & Reinforced Concrete | Embedded Items & Cast-In Components | 4 | 5 |
| 37 | Concrete & Reinforced Concrete | Concrete Pouring | 9 | 6 |
| 38 | Concrete & Reinforced Concrete | Concrete Finishing | 9 | 6 |
| 39 | Concrete & Reinforced Concrete | Concrete Curing & Protection | 4 | 6 |
| 40 | Concrete & Reinforced Concrete | Precast Concrete Installation | 9 | 6 |
| 41 | Concrete & Reinforced Concrete | Concrete Repair | 9 | 6 |
| 42 | Concrete & Reinforced Concrete | Concrete Cutting / Coring | 9 | 6 |
| 43 | Concrete & Reinforced Concrete | Concrete Testing | 9 | 6 |
| 44 | Structural Steel & Metal Works | Steel Fabrication | 4 | 6 |
| 45 | Structural Steel & Metal Works | Steel Erection | 4 | 6 |
| 46 | Structural Steel & Metal Works | Bolting & Connections | 4 | 6 |
| 47 | Structural Steel & Metal Works | Welding | 4 | 6 |
| 48 | Structural Steel & Metal Works | Metal Decking | 4 | 5 |
| 49 | Structural Steel & Metal Works | Metal Stairs, Platforms & Handrails | 4 | 5 |
| 50 | Structural Steel & Metal Works | Protective Coating / Fireproofing | 7 | 6 |
| 51 | Structural Steel & Metal Works | Steel Inspection | 4 | 6 |
| 52 | Masonry & Wall Construction | Concrete Blockwork | 7 | 6 |
| 53 | Masonry & Wall Construction | Brickwork | 7 | 5 |
| 54 | Masonry & Wall Construction | Reinforced Masonry | 7 | 5 |
| 55 | Masonry & Wall Construction | AAC / Lightweight Blockwork | 7 | 5 |
| 56 | Masonry & Wall Construction | Lintels & Wall Openings | 7 | 5 |
| 57 | Masonry & Wall Construction | Wall Chasing & Making Good | 4 | 5 |
| 58 | Architectural & Interior Finishes | Plastering / Rendering | 4 | 6 |
| 59 | Architectural & Interior Finishes | Screeding | 5 | 5 |
| 60 | Architectural & Interior Finishes | Floor Tiling | 5 | 6 |
| 61 | Architectural & Interior Finishes | Wall Tiling | 5 | 6 |
| 62 | Architectural & Interior Finishes | Stone / Terrazzo Finishes | 5 | 5 |
| 63 | Architectural & Interior Finishes | Resilient / Carpet Flooring | 5 | 6 |
| 64 | Architectural & Interior Finishes | Ceiling Installation | 4 | 6 |
| 65 | Architectural & Interior Finishes | Drywall & Partitions | 4 | 6 |
| 66 | Architectural & Interior Finishes | Doors & Frames | 6 | 6 |
| 67 | Architectural & Interior Finishes | Windows & Glazing | 6 | 6 |
| 68 | Architectural & Interior Finishes | Painting & Decorating | 7 | 6 |
| 69 | Architectural & Interior Finishes | Joinery & Cabinetry | 6 | 5 |
| 70 | Architectural & Interior Finishes | Cladding & Facade Finishes | 7 | 6 |
| 71 | Architectural & Interior Finishes | Acoustic / Thermal Insulation | 7 | 5 |
| 72 | Architectural & Interior Finishes | Sealants & Movement Joints | 7 | 6 |
| 73 | Waterproofing & Roofing | Roof Structure | 7 | 6 |
| 74 | Waterproofing & Roofing | Roof Sheets & Coverings | 7 | 6 |
| 75 | Waterproofing & Roofing | Roof Membrane | 7 | 6 |
| 76 | Waterproofing & Roofing | Roof Insulation & Vapour Barrier | 7 | 6 |
| 77 | Waterproofing & Roofing | Roof Flashings & Rainwater Goods | 7 | 6 |
| 78 | Waterproofing & Roofing | Wet Area Waterproofing | 7 | 6 |
| 79 | Waterproofing & Roofing | Below-Ground Waterproofing | 7 | 6 |
| 80 | Waterproofing & Roofing | Waterproofing Testing | 7 | 6 |
| 81 | Mechanical & HVAC Services | HVAC Ductwork | 7 | 6 |
| 82 | Mechanical & HVAC Services | Air-Conditioning Equipment | 7 | 5 |
| 83 | Mechanical & HVAC Services | Ventilation & Exhaust | 7 | 5 |
| 84 | Mechanical & HVAC Services | Refrigerant Piping | 7 | 5 |
| 85 | Mechanical & HVAC Services | Mechanical Piping | 7 | 6 |
| 86 | Mechanical & HVAC Services | Pumps & Mechanical Equipment | 7 | 6 |
| 87 | Mechanical & HVAC Services | Insulation & Cladding | 7 | 6 |
| 88 | Mechanical & HVAC Services | HVAC Testing & Balancing | 7 | 6 |
| 89 | Plumbing, Sanitary & Drainage Services | Domestic Water Supply | 8 | 6 |
| 90 | Plumbing, Sanitary & Drainage Services | Sanitary Plumbing | 8 | 6 |
| 91 | Plumbing, Sanitary & Drainage Services | Stormwater Pipework | 8 | 6 |
| 92 | Plumbing, Sanitary & Drainage Services | Sanitary Fixtures | 8 | 5 |
| 93 | Plumbing, Sanitary & Drainage Services | Water Heaters & Storage Tanks | 8 | 6 |
| 94 | Plumbing, Sanitary & Drainage Services | Pumps & Booster Sets | 7 | 5 |
| 95 | Plumbing, Sanitary & Drainage Services | Pipe Pressure / Leakage Testing | 8 | 6 |
| 96 | Plumbing, Sanitary & Drainage Services | External Sewer / Water Connections | 8 | 6 |
| 97 | Electrical & ELV Services | Electrical Conduits & Containment | 9 | 6 |
| 98 | Electrical & ELV Services | Cable Pulling & Termination | 9 | 6 |
| 99 | Electrical & ELV Services | Distribution Boards & Panels | 4 | 5 |
| 100 | Electrical & ELV Services | Lighting Installation | 9 | 5 |
| 101 | Electrical & ELV Services | Small Power & Socket Outlets | 9 | 5 |
| 102 | Electrical & ELV Services | Earthing & Bonding | 9 | 5 |
| 103 | Electrical & ELV Services | Generator / UPS Installation | 9 | 5 |
| 104 | Electrical & ELV Services | Lightning Protection | 9 | 5 |
| 105 | Electrical & ELV Services | Data & Telecommunications | 9 | 5 |
| 106 | Electrical & ELV Services | CCTV / Access Control / Security | 9 | 5 |
| 107 | Electrical & ELV Services | Electrical Testing & Certification | 9 | 6 |
| 108 | Fire Protection & Life Safety | Fire Alarm System | 8 | 6 |
| 109 | Fire Protection & Life Safety | Fire Sprinkler Pipework | 8 | 6 |
| 110 | Fire Protection & Life Safety | Fire Hose Reel / Hydrant System | 8 | 6 |
| 111 | Fire Protection & Life Safety | Fire Pumps & Tanks | 7 | 6 |
| 112 | Fire Protection & Life Safety | Fire Extinguishers & Signage | 8 | 6 |
| 113 | Fire Protection & Life Safety | Smoke Control / Pressurization | 8 | 5 |
| 114 | Fire Protection & Life Safety | Fire Stopping | 8 | 6 |
| 115 | Fire Protection & Life Safety | Fire System Testing | 8 | 6 |
| 116 | External Civil Works & Infrastructure | Road Formation & Subbase | 8 | 5 |
| 117 | External Civil Works & Infrastructure | Road Base & Asphalt | 8 | 5 |
| 118 | External Civil Works & Infrastructure | Concrete Roads / Pavements | 8 | 6 |
| 119 | External Civil Works & Infrastructure | Kerbs & Channels | 8 | 5 |
| 120 | External Civil Works & Infrastructure | Paving & Interlocking Blocks | 8 | 5 |
| 121 | External Civil Works & Infrastructure | Stormwater Channels & Culverts | 8 | 6 |
| 122 | External Civil Works & Infrastructure | Retaining Walls | 8 | 5 |
| 123 | External Civil Works & Infrastructure | Bridges / Access Structures | 8 | 5 |
| 124 | External Civil Works & Infrastructure | Road Markings & Signage | 8 | 5 |
| 125 | External Civil Works & Infrastructure | External Concrete Works | 4 | 6 |
| 126 | Utilities & External Services | External Water Mains | 4 | 6 |
| 127 | Utilities & External Services | External Sewer Networks | 8 | 6 |
| 128 | Utilities & External Services | External Electrical Ducts & Cables | 7 | 6 |
| 129 | Utilities & External Services | Telecommunications Ducts | 7 | 6 |
| 130 | Utilities & External Services | Gas / Fuel Services | 4 | 5 |
| 131 | Utilities & External Services | Utility Diversion / Protection | 6 | 5 |
| 132 | Utilities & External Services | Utility Testing & Connection | 6 | 5 |
| 133 | Landscaping & External Works | Topsoil Placement | 7 | 6 |
| 134 | Landscaping & External Works | Planting & Turfing | 7 | 5 |
| 135 | Landscaping & External Works | Irrigation Systems | 7 | 5 |
| 136 | Landscaping & External Works | Landscape Structures | 7 | 5 |
| 137 | Landscaping & External Works | External Furniture & Fixtures | 7 | 5 |
| 138 | Landscaping & External Works | Landscape Maintenance | 7 | 5 |
| 139 | Testing, Commissioning & Handover | Pre-Commissioning Checks | 8 | 5 |
| 140 | Testing, Commissioning & Handover | Functional Testing | 8 | 5 |
| 141 | Testing, Commissioning & Handover | Integrated Systems Testing | 8 | 5 |
| 142 | Testing, Commissioning & Handover | Balancing & Performance Testing | 8 | 5 |
| 143 | Testing, Commissioning & Handover | Defect Rectification / Snagging | 8 | 5 |
| 144 | Testing, Commissioning & Handover | Cleaning & Final Preparation | 8 | 5 |
| 145 | Testing, Commissioning & Handover | Training & Demonstration | 8 | 5 |
| 146 | Testing, Commissioning & Handover | As-Built / O&M Documentation | 8 | 5 |
| 147 | Testing, Commissioning & Handover | Final Handover | 8 | 5 |
| 148 | Testing, Commissioning & Handover | Demobilization | 8 | 5 |

### Sign-off Workflow

[Profile definitions](../../../apps/web/lib/forms/signoff.ts#L54) and [database workflow](../../../supabase/migrations/202611210001_spec_registers_and_signoff_truth.sql#L550).

| Excel rows | Scope | Evidence and remaining checks |
|---|---|---|
| 2–5 | Append-only event log, fields and actions | Implemented with separate form, portal and verification event stores. Unified state and journey acceptance remain open (F01). |
| 6–7 | Acknowledgement and identity | Attestation methods, server timestamps and uploaded evidence exist. Validate identity metadata and project signatory/legal rules. |
| 8–9 | Return, resubmit and frozen versions | Versions and rounds in sign-off RPC. Compare portal round transitions and updates after approval. |
| 10–11 | Authority, limits and notifications | Permission checks, parallel approval thresholds, delegations, reminders. Verify each configured restriction end to end. |
| 12 | Record presentation and export | Sign-off panel, per-form export paths, day export. Searchable global history and unified event coverage are partial (F01, F04). |
| 14 | Works Ongoing / WO-DAILY | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 15 | Works Completed / WC-COMPLETION | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 16 | Workforce / WF-ATTENDANCE | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 17 | Project Delay Report / PDR-REVIEW | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 18 | Issue / ISSUE-CLOSEOUT | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 19 | HSE / HSE-OBSERVATION | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 20 | Materials Delivery / MAT-RECEIPT | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 21 | Inspections / INSPECTION-WITNESS | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 22 | Technical Instructions / TECH-INSTRUCTION | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 23 | Change Order / CHANGE-APPROVAL | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 24 | NCR / NCR-CORRECTIVE | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 25 | Agreements Made / AGREEMENT-ACK | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 26 | Lessons Learned / LESSON-REVIEW | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 27 | HSE Incident Registration / HSE-INCIDENT | Profile present. Verify actors, sequencing, evidence and completion criteria through the saved record and, where applicable, contractor account. |
| 30–31 | Mandatory comments and immutability | Common comment rules cover return, reject, withdraw and reopen. Other responsibility/approval changes need rule-by-rule review (F01). |
| 32–35 | Multiple signatures, parallel review, external evidence and configuration | Thresholds, role captions, named approvers, due days, delegation and an approval limit. Full stage order and action model are defined in code (F01/F12). |
| 36 | Legal effect | Requires CODECO’s project procedure. Acknowledgement is described independently from approval. |

### START HERE

| Excel rows | Trace |
|---|---|
| 2–5 | Form sheets govern screen order and form-specific classification. Generated catalogue and field trace above. Photos and delivery ambiguities in F06. |
| 6–9 | Shared Works lists, activity guide, dependency resets and Other. Key/reset implementation exists. Prompt persistence and full conditional coverage in F07. |
| 10–12 | Live registers, required/conditional fields, multi-select exclusivity. UI helpers exist. Database parity incomplete (F03). |
| 13–15 | Authority and audit events, configuration and retention of historical labels. Review F01 and F12. |
| 16–20 | Go-live UAT, consolidated source, multiple signature rounds and CODECO decisions. See audit acceptance and decision lists. |
| 21 | TI instruction type independent of discipline and category filtered by discipline. Three fields mapped in TI rows 4–6. |
