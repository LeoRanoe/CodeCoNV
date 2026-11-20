# Client feedback 19-11-2026 — checklist

Source: 14 annotated screenshots and `Construction_Project_App_Developer_Specification_FINAL_v2.xlsx`.
Status per item: **done** (built and covered by a test), **interpreted** (built, the note was ambiguous — the reading is stated), or **open** (not built in this round).

## Annotated screenshots

| # | Screen | Client note | Status | What changed |
|---|--------|-------------|--------|--------------|
| 1 | NCR | Subject "on top" (arrow to above Category) | done | Subject and Description now sit one below the other, directly above Category/Type, under the quick choices that fill them. |
| 2 | NCR | "Issue type · Quality" crossed out | done | Removed from the NCR form (in this module it can only say NCR). |
| 3 | NCR | "Description of non-conformance" circled | done | Moved up with Subject, full width. |
| 4 | NCR | "Impact in your own words" crossed out | done | Text box removed; the three impact choices stay. |
| 5 | NCR | "Contractor sign ook" | done | Contractor representative + position + handwritten signature at the end of the form; printed on the NCR PDF/Word as "Received / contractor". |
| 6 | NCR | "Overal aan het eind plaatsen" (signature) | done | Signatures close every form, supervision first and the contractor beside it (one shared block). |
| 7 | NCR | "Gaat dit in de app gebeuren?" | done | Yes. The note now says so: after submitting, the contractor gets the NCR link (no account) and writes the corrective action in the app; CODECO verifies and closes. |
| 8 | NCR | "Alleen maar foto's kunnen plaatsen, geen 360°" | done | "Open 360° image" removed from "Mark an issue on an image". |
| 9 | NCR / Works completed | Record list under the form crossed out | interpreted | Forms open by default, so the list is not deleted (records would be unreachable). While a form is open the list folds shut under a "Saved records (n)" bar; it opens normally when the form is closed. Same rule in Issues, NCR, HSE, registers and Works. |
| 10 | Attendance | "Ik kan niet opslaan!" | done | The deviation explanation no longer blocks "Confirm attendance"; it is marked optional. |
| 11 | Drawings | "Veger & undo button" | done | Eraser tool (tap a markup to remove it) and Undo (removes the last markup on the page). Removal is recorded server-side, the drawing history keeps it. |
| 12 | Delay report (PDR) | Register count tiles: "kan weg bij PDR" | done | The grid of counts per register type is removed (also crossed out on Materials delivery and Change order). |
| 13 | Works completed | "Plan for tomorrow" crossed out | done | Removed from the Works completed form; no longer required there. |
| 14 | HSE | Responsible person dropdown: "dit is al voorhanden" | done | One choice of party (Client / Contractor / Supervision) and one name box. A name that matches a colleague still assigns the record to them. |
| 15 | HSE | "Root cause (optional)" crossed out | done | Removed from HSE; sections renumbered 1–11. |
| 16 | HSE | "Contractor ook tekenen!" | done | Contractor signature at the end (new nullable columns on `hse_events`, migration `202611190001`). |
| 17 | Materials delivery | Unit → "dropdown" | done | Unit is a list (m, m², m³, mm, cm, kg, tonne, pcs, number, lot, hours, set — from the Shared Dropdown Lists sheet) plus "Other" with a short box. Older typed units stay as "Other". |
| 18 | Materials delivery | BOQ panel and tiles crossed out | done | The BOQ import no longer sits under the delivery form; it is offered once the form is folded away, so the feature is kept. |
| 19 | Technical instruction | "Zelfde info als HSE en anderen" (header on top) | done | Every register form opens with the same head (form no, project, location, date/time, author) before any field. |
| 20 | Technical instruction | "Add contractor sign" | done | Contractor signature at the end; printed on the TI PDF/Word ("Signed on site · contractor"). Also on ER and plain registers (delivery, equipment, test …). |
| 21 | Change order | Header "on top altijd" | done | Same head first, then the draft notice, then title/request. |
| 22 | Change order | "Reason for change" crossed out | done | Removed and no longer required. |
| 23 | Change order | "Details / what will change?" — "dit doe ik al bij formal request" | done | Removed and no longer required; the formal request at the top says it. |
| 24 | Lessons learned | "Location on drawing" crossed out | done | Removed from Lessons learned. |
| 25 | Lessons learned | "Nummeren & onder elkaar" | done | Issue / Cause / Solution / Expected results are numbered 1–4 and stacked. |
| 26 | Lessons learned | Extra photo box "is dubbel" | done | The general photo box is gone; the two named photos stay. |
| 27 | Photo marker | "Kan dit groter worden" | done | The marking dialog uses most of the screen (up to 1240 px wide, photo up to 72 % of the height). |
| 28 | Issues | Responsible person: "Client / Contractor / Supervision" | done | As item 14, same component. |
| 29 | Issues | "Contractor · owner of the correction" — "weg" | done | Removed. |

## Requests in the message

| Request | Status | What changed |
|---------|--------|--------------|
| One central report in Reports with everything from Workspace for the day | done | Reports opens on **Day overview**: pick a day (or one of the recent days with records) and see workforce, works ongoing/completed, delays, issues, NCR, HSE, inspections, deliveries, TI, CO, PDR, lessons, agreements, other registers and photos, each under its form icon, every row opening its record. Forms with nothing that day are named once at the end. The same day downloads as PDF/Word with all sections. |
| The user exports their own report of everything filled in that day | done | Day overview → PDF / Word builds the file from exactly the records on screen: a contents table with every Workspace form and its count, then one section per form (also when empty) with every record's boxes, its signatures (supervisor, engineer, contractor, verification, agreement parties) and the day's photos. Confidential HSE incidents are listed but not spelled out. File name `Day-report-<project>-<date>`. |
| Icons to identify forms | done | One icon per form (`app/forms/form-icons.ts`) on the Workspace tile, the form heading, list rows and the day overview. NCR and HSE incident no longer share an icon. |
| Header always on top | done | Issue, NCR, HSE, every register form. |
| Fields beside vs below each other | done | One rule for every form: long text (text areas) always full width and stacked; short choices (lists, dates, names) may stand in pairs. |
| Signatures at the end | done | Shared `RecordSignatures` block at the end of every form. |

## Specification workbook (FINAL_v2) — built in the second round (20-11-2026)

Every dropdown value comes from the workbook itself: `apps/web/scripts/generate-spec-catalogue.py` writes `apps/web/lib/forms/spec-catalogue.ts` (17 disciplines, 147 activities with their "What was completed?" options and prompts, every Type → Category list with descriptions, every shared list). The fields per form are in `apps/web/lib/forms/spec-forms.ts`, in the workbook's order, with its required, conditional and "Other → explain" rules.

| Workbook item | Status | Where |
|---|---|---|
| Dependent Type → Category lists (Issue, HSE, HSE incident, NCR, CO, Agreements, LL, PDR, Materials, TI by discipline) | done | Category only offers the chosen type's values, shows the description as helper text, clears when the type changes. |
| Works Ongoing / Works Completed per activity | done | "Add an activity record (WO / WC)" on the Works page: discipline → activity, Activity Detail Guide prompts, completion items, quantity + unit, progress / inspection status, Concrete Pouring fields. Numbered WO-0001 / WC-0001, in the day overview and the day export. The client's quick one-box day log stays (their note of 01-11). |
| Issue: discipline, impact type, related record, status, closure note | done | Issue form, "Follow-up and classification". |
| HSE: person involved, potential consequence, likelihood × severity, status | done | HSE form, "Risk and follow-up". No numeric risk score is invented (no approved matrix). |
| HSE incident registration (injury, body part, environment, damage, notification, investigation, reviewer) | done | HSE incident tile and Near miss tile. |
| Materials delivery: supplier, PO, delivery note, material group, ordered vs delivered, status, condition, inspection result, storage, discrepancy | done | Delivery form; a differing quantity, damage or rejection asks for a discrepancy note. |
| TI: instruction type, discipline → subject, drawing revision, reason, issued to, action owner, response date, status | done | TI form. |
| CO: type → category, quantities, currency, approval status, approved amount/days/approver/date, instruction to proceed | done | CO form. "Reason for change" stays removed (client's note); originator, cost and time impact use the client's own boxes. |
| NCR: type → category, discipline, requirement reference, detected during, severity, containment, disposition, root cause, action owner, verification | done | NCR form. |
| PDR: delay start, cause type → category, responsible party, actual/estimated, milestone, action owner, recovery date, status | done | PDR form; the client's own boxes keep activity, duration, critical path and recovery plan. |
| LL: phase → category (workbook phases), situation, impact, applicability, discipline, review status | done | LL form; the client's four numbered questions stay. |
| Agreements: date/time, source, type → category, agreed by, action required → owner + due date, status | done | Agreements form. |
| Photos: purpose, discipline, related record | done | Photo detail → "Photo classification". |
| Workforce: shift, attendance status, competency status | done | Per line on the workforce register. |
| Sign-off Workflow sheet: append-only event log, rounds, return with mandatory comment and next actor, frozen submitted version, role-restricted approval, no self-approval, notification of the next actor, external representative signature | done | `record_signoff_events` + `record_signoff_action()` (migration `202611200001`); "Sign-off and review" panel on every opened record, attendance verification on Reports · Day overview. |
| Project-configurable workflow profiles, approval limits, parallel review rules | open | Profiles are fixed to the sheet's stages; limits and legal effect need the project owner's decision (the workbook says so itself). |
| Dutch translations of the workbook's lists | open | The lists are shown in the workbook's English; field labels are bilingual. |

## Verification

- Unit and guard tests: `node --test tests/*.test.mjs` (incl. new `day-overview.test.mjs`, `day-overview-export.test.mjs`, eraser hit-test in `drawing-viewport.test.mjs`).
- E2E new: `day-overview-export.spec.ts` downloads the day PDF and Word and checks every form section is in it.
- E2E updated: works-completed-focus, two-party-signature, field-readiness, period-report.
- UI stability audit: `npx playwright test tests/e2e/ui-stability-audit.spec.ts`.

## Specification workbook (FINAL v2) — third round (21-11-2026): the remaining gaps

The client's choices of 20-11-2026 for the open points: workflow settings project-configurable with the workbook's defaults (no invented roles or limits), an admin screen for the project lists, Dutch labels for the workbook lists, and inspections keep their checklist (no Inspections sheet). Database: migration `202611210001` (pgTAP `030_spec_registers_and_signoff_truth`).

| # | Gap | Status | What changed |
|---|-----|--------|--------------|
| 1 | Register-linked fields were free text | done | Action owner, issued to, supplier (parties of type supplier, Management · Structure and parties), crew (contractor/subcontractor parties plus the project's crew list, several allowed), originator, agreed by (several), person involved, people involved, witnesses, HSE reviewer, received by, closed/verified by are pickers fed by `list_project_people()` (members and company staff by name) and the project parties. "Other / not in the list" keeps a short typed name. The name is stored in the field and the reference beside it (`<key>_ref`, `<key>_refs`), so lists, exports and older records keep reading a plain name. |
| 2 | Linked-record selectors | done | Related record, related inspection, inspection/test reference, linked NCR/issue, related observation, related incident and the Works blocker link are a searchable selector over the project's own records (number or title), storing the number and `<kind>:<id>`; empty is allowed ("add the link later"). The record viewer shows them as chips that open the record. |
| 3 | Sign-off notifications never fired | done | "Who acts next" is a picker of the project's people; its id is sent, so the next person is notified. After an approval, rejection, return, verification or reopening without a named next person, the record's author is notified. `refresh_project_notifications()` adds an overdue reminder to the next person and, one day later, an escalation to the project's reviewers. |
| 4 | Signed-document attestation | done | "A representative, with an uploaded signed document or photo": the file is uploaded as project evidence and its id is stored with the event; the database checks it is a file of this project. |
| 5 | Sign-off history in exports | done | The chronological history (time, action, actor and organisation, role, round, status change, attestation, comments, on-device signature) is printed with the NCR PDF/Word, the controlled-document PDF/Word and with every record of the day export (loaded in bulk for the day). A confidential incident prints none. |
| 6 | Two statuses that could disagree | done | The workbook Status is shown read-only ("set by the sign-off actions"). The database keeps it equal to the record's own status and moves both from the sign-off actions (respond/resubmit → Pending Verification, return → In Progress, verify/close → Closed, withdraw → Cancelled …); a typed status is put back. Earlier states stay in the event log. |
| 7 | Role-restricted status choices | done | Approved/Rejected (CO), Approved for Sharing (LL), Inspected - Accepted/Rejected (WC), Accepted/Accepted with Comments/Rejected (delivery inspection), the NCR verification result and Closed: only for `findings.verify` / `reports.review` (HSE: `hse.manage`, inspections: `inspections.manage`). The screen disables them for others; a database trigger refuses them and records who decided and when (approved by/on, reviewed by, verified by/on, inspected by, accepted by). A CO approval above the project's limit needs a named approver above the limit. |
| 8 | Works Ongoing finish before start | done | "Work crosses midnight" tick box appears when the finish time is earlier than the start. |
| 9 | Missing workbook fields | done / interpreted | HSE **risk rating** (required): calculated from likelihood × severity only when the project has an approved matrix (Management · Workflows & lists), otherwise chosen from a controlled list (default: the workbook's priority scale). Delivery: **received by** (filled with the signed-in user, changeable; the supervisor confirms receipt in the MAT-RECEIPT sign-off); **material category** *interpreted*: the workbook's dependent list has three families (Delivery Status, Material Group, Delivery Discrepancy), each used for its own field with its descriptions — there are no sub-categories per material group to add. Works: **quantity N/A** where not measurable, **secondary discipline**, **building / area** from the Project Location Register plus the exact location text, a **photo evidence recommended** hint on Works Completed. Photos: **purpose** (and the discipline as photo category for progress and technical photos) asked at capture/upload and in the photo detail. NCR: per containment step the **responsible person, date/time implemented and evidence**; a verification **Not Effective / Rework Required reopens** the corrective action. HSE incident: **corrective actions as rows** (owner + due date each), each becoming its own action record linked to the incident (`create_record_follow_up_action`); a **notification log** row per authority with its timestamp. Agreements: **one action record per action**. Lessons: **Approved for Sharing** lessons of every project of the organisation are listed under Lessons Learned (`list_shared_lessons`). |
| 10 | Sensitive incident data | done | People involved, witnesses, injury classification/nature and body part move to `hse_event_sensitive` (readable with `hse.manage` only; existing records moved once). They are never printed in exports, shown in the viewer only to HSE managers, and kept out of the frozen sign-off copy. |
| 11 | Version control on material change | done | Editing a submitted record's material fields appends a "Reopened — edited after submission" event; the panel says the approvals are required again and offers Resubmit (new round). |
| 12 | Parallel review, signatories, limits, delegation | done (configurable) | Management · Workflows & lists: per profile and stage the role names, approvals needed before the record moves on, named approvers and due days; delegations with an end date; the change-order approval limit and the approvers above it. The database enforces them (a stage needing two approvals shows "Partially Approved (1/2)"). Nothing is set until the project sets it. |
| 13 | Reporting filters | done | Discipline, type / category, status and priority on the record lists (Issues/NCR, HSE, registers, inspections), the workspace search and the period report (the downloaded report keeps only the matching records). |
| 14 | Configuration governance | done | Management · Workflows & lists edits shifts, units, crews, storage locations, likelihood and severity definitions and authorities to notify: add values, retire values, project definitions beside likelihood/severity. A retired value is no longer offered; records keep the label they stored, and each record stores the list version it was saved with. |
| 15 | Dutch | done | All 1,084 workbook dropdown values have a Dutch label (`lib/forms/spec-catalogue-nl.ts`); the English value is stored. Helper descriptions and activity prompts stay in the workbook's English. |
| 16 | Inspections | interpreted (client) | No extra form fields: the checklist stays. Inspections carry discipline, the inspected work / related record and the contractor witness in their spec and use INSPECTION-WITNESS in the viewer. |

### Verification (third round)

- pgTAP `030_spec_registers_and_signoff_truth.pgtap.sql` (29 tests): people directory, reviewer-only decisions with recorded approver, approval limit, typed status put back, sign-off moving the status, next actor must be on the project, signed document is a project file, notification, parallel approvals, edit-after-submission reopening, overdue reminder and escalation, restricted incident data, linked follow-up action, shared lessons.
- Unit: `tests/spec-forms.test.mjs` (pickers, decisions, works fields, risk rating, lists, rows/actions, restricted data, filters, Dutch labels, history lines), `tests/day-overview-export.test.mjs` (history per record).
- E2E helper `tests/e2e/spec-fill.ts` fills the new pickers and rows.

## Feedback of 20-11-2026 — fields under each other

| Note | Status | What changed |
|------|--------|--------------|
| "The forms are inconsistent: fields beside each other must be under each other" | done | Every form is one column at every width: one field per row, including the specification details, the numbered sections of the Issue / HSE / NCR forms (no second column on a wide screen any more; they read 1 to 12), the delivery and workforce lines, the Delay Report and Agreement sections, and the signature blocks (supervisor, then contractor representative, position and signature). Choice tiles, tick boxes and the two named photos of a lesson keep their grid. Guarded by `tests/e2e/form-field-stacking.spec.ts` on all 14 Workspace forms at tablet and desktop width. |

## Feedback of 20-11-2026 — dictation and pictured choices

| Request | Status | What changed |
|---------|--------|--------------|
| Every field that is typed freely can be dictated, understanding Dutch and English at the same time | done | Every free-text box (one-line text and writing areas) has a microphone. Boxes that already carried one keep it; every other box gets one at its right edge while it has the focus (`app/dictation-layer.tsx`), and the words are written in as if typed. Sign-in, e-mail, codes and coordinates are not dictated. With `TRANSCRIPTION_API_KEY` (or `OPENAI_API_KEY`) set on the server, the recording is transcribed by `app/api/speech/transcribe` without a fixed language, so Dutch, English and both mixed in one sentence are understood; signed-in users only, 60 recordings per 10 minutes, at most 2 minutes each. Without a key the browser's own recognition listens in the app language (it can do one language at a time). Guarded by `tests/e2e/dictation.spec.ts`. |
| A custom icon / SVG per choice, so choices are told apart easily | done | Every short list of the specification fields (up to 6 choices: status, priority, severity, likelihood, shift, disposition, currency, yes/no …) is a row of tiles, each with its own picture (`lib/forms/choice-icons.tsx`). Scales (priority, likelihood, severity, risk rating, damage, injury) show a step gauge — the number of filled bars is the step — so the order reads at a glance. Tick-box lists carry the same pictures. Longer lists stay a dropdown. The chosen tile is orange; reviewer-only decisions stay locked for others. The Workspace forms' own quick choices already had icons. |
