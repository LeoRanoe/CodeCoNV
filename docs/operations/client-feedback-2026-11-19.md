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
