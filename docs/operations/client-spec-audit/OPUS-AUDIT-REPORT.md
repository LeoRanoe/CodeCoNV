# Opus audit report (26 / 27-11-2026)

Independent audit of CODECO Supervision against the client's developer package v5 (Excel v5.0, Word v2.0, mockups v6), on the local stack only. Running log with every finding, its evidence and status: `OPUS-AUDIT-LOG.md`. Decisions: `V5-DECISION-REGISTER.md` D-31 and later.

## 1. What was wrong (short)

The owner's complaint was right, and the earlier "all tests pass" did not cover it: the tests measured overlap at 1440 x 900, 820 x 1024 and 390 x 844 and never at a laptop's 1366 x 768 or 1280 x 720, and never checked that the sidebar shows all its menus.

1. **The sidebar did not fit a laptop screen.** At 768 px height the tenth menu ("Management") was cut off behind the orange "Take photo" button; only the page list scrolled. (F01)
2. **Record lists were broken everywhere.** The shared record row put View / Edit / Withdraw in the icon column, so every title sat in the right half and the state pill lay over "Withdraw". (F04, F14) This was a blocker on every Workspace list.
3. **Wrong content.** Opening "Works ongoing" listed every register record of the project, including change orders and technical instructions, with a count of 21. (F02)
4. **Too many controls.** Issue and NCR cards had up to ten buttons each; controlled documents seven. Four filters filled a phone screen before the first record. (F07, F08)
5. **Duplicated and inconsistent navigation.** Rapid Verify and Project Docs were both main menus and "Supporting tools"; Project Documents opened with a "← Workspace" button and the name "Project Docs"; "Reports" opened a page called "Client reports", "Actions" a page called "Action center"; "Issues" counted 9 on the Workspace and 11 in Records & Photos. (F06, F10, F11, F13, F18)
6. **Phones.** Segmented controls broke words letter by letter at 390 px; portal rows squeezed their title into a 90 px column; pills were 40 px, under the 44 px thumb rule. (F19, F20, F27)
7. **Roles.** The legacy client account saw Rapid Verify and the "View as" portal previews, both Supervision's per Word 2. (F24)
8. **Popups under the bars.** Opened from a form, the signing popup (and five other popups) lived inside the sticky action bar, so on a phone the top and bottom bars lay over it and its "Sign & submit" button; the "More actions" menu was hidden under the next card. Found in pass 3, fixed in #40. (F30, F31)
9. **Wasted height.** The module header put "New" on its own row (60 px on every module page); on a phone on its side the two bars took a third of the screen. (F03, F12)

## 2. What was fixed

See the log for each ID. In short: the sidebar is the ten Word menus, the project and the account (the photo button moved to the top bar on desktop, the bottom bar on phone and tablet); shorter rows on short screens; record rows laid out in the shared rule; one list per form; secondary card actions behind one "More actions" / "Send or export" button; filters fold; tile counts per form; page names equal menu names; Project Documents is a main menu page with one orange action; compact bars on a phone on its side; a focused field scrolls clear of the sticky action bar.

## 3. Information architecture: the decision

Authority: Word section 2 (ten menus) and 2.1 (principles); mockups v6 for the sidebar look.

| Place | Before | After | Reason |
|---|---|---|---|
| Sidebar | logo, project, ten menus, "Take photo", account | logo, project, ten menus in Word order, account | Word 2 lists ten menus; the mockups show no photo button; the tenth menu was unreachable at 768 px |
| Top bar (desktop) | breadcrumb, Help, weather, language, connection, notifications (Management gear hidden by CSS) | "Take photo" first (orange on the Overview only, icon-only from 1024 to 1280 px), then the same | One photo button per screen size; the top bar has room, the sidebar has not |
| Phone / tablet bottom bar | Overview, Workspace, Photo, Actions, More | unchanged | The five frequent jobs, one tap |
| Workspace | 15 forms + Supporting tools (Rapid Verify, Project Docs, Assets & folders, Drawings & pins, Calculator & notes, Deadlines) | 15 forms + Drawings & pins, Calculator & notes, Deadlines | Rapid Verify and Project Documents are main menus; files are in Project Documents and Records & Photos |
| Records & Photos | the same 15-form grid as folders | unchanged | Word 5 asks for an archive per form; the grid is the folder list, not a second Workspace (it opens records, not forms) |
| Page names | "Client reports", "Action center", "Project Docs" | "Reports", "Actions", "Project Documents" | One thing, one name (Word 2 names) |
| Sidebar for a client account (legacy `client` role) | all ten menus | without Rapid Verify, Contractor Portal and Client Portal ("View as") | Word 2: Rapid Verify is for Supervisor / Inspector, "View as" is Supervision's (2.1) |
| Account card | name and "CODECO user"; a tap signs out | name and "Sign out" | A button says what it does |
| Record cards | up to ten buttons | View, next step (and Verify / Return); the rest behind "More actions" / "Send or export" | One or two primary actions per card |

A mock of the result is the set of screenshots in `docs/operations/ui-stability-audit/opus-2026-11-26/` (before / after per finding).

Recommended, not done tonight (see section 6): open Actions on the automatic follow-up list (Word 9; the sidebar badge counts that list, the page opens on "My work"); route the legacy `client` and `contractor` roles to their portals only (Word 8, 21).

## 4. Traceability

- Excel v5.0, every field row of the 15 forms: `OPUS-TRACE-EXCEL.md` (382 rows: 229 match, 128 differ, 3 missing, 22 extra; list values compared by script). Read-only comparison of the code before this run's fixes; none of tonight's fixes changes a form field.
- Word v2.0, every section: `OPUS-TRACE-WORD.md` (about 230 rows). Written against the code before tonight's fixes; rows on the sidebar, Supporting tools and page names are superseded by section 3 above.
- Mockups v6: section 5.

## 5. Mockups against the screens

Compared at 1366 x 768 and 1280 x 720 (the mockups are tablet landscape, one continuous page). Shared to all form mockups: the module header of the app is "← Workspace · project · title · count · Open log · New" and the form shell repeats the title with its pill; the mockups have one header (icon, title, "project › Workspace", Draft pill, "± 8-12 min").

| Mockup | Screen | Result | Differences |
|---|---|---|---|
| 00 Overview | index of the 15 form mockups | n/a | It is not a screen; the left menu in every mockup is the ten Word menus (matches the sidebar after F01) |
| 01 Photos | Workspace › Photos | differs | Mockup: a form (photo upload with two buttons, caption, classification pills, location card with drawing, sign-off). App: the photo library first (Take photo / Upload / 360°), the form after a photo is chosen; no per-photo Title or sign-off profile (Excel gap 8) |
| 02 Works ongoing | form | matches mostly | Numbered cards and order match (D-27); the drawing is in the Location card; differences: building is a multi-building picker, not "FROM DRAWING" locked fields; "What exactly is being worked on?" is free text, the mockup shows activity pills (Excel gap 2); primary button "Save register item" vs "Sign, submit & notify" |
| 03 Works completed | form | matches mostly | as 02; "Based on Works ongoing record" first |
| 04 Workforce | form | differs (major) | Mockup: one table (discipline, contractor, number, add row), total, remarks, sign-off card. App: party / trade picker with steppers per building tab, visitors, totals per organisation and trade, deviation, signature block; no Record ID (F17) |
| 05 Project Delay Report | form | matches mostly | cards match; Location card has no drawing |
| 06 Issues | form | matches mostly | cards, pills, segments and sign-off match; Location card has no drawing (needs a per-record pin store); Discipline is a dropdown, the mockup shows it AUTO and locked from Category |
| 07 HSE | form | matches mostly | Location without drawing; risk rating only computed with a project matrix (Excel gap 4) |
| 08 Materials delivery | form | matches mostly | no purchase-order record (D-17), so PO-filled fields are typed |
| 09 Inspections | form | differs (major) | Mockup: Inspection card (type, category, discipline, linked work / material), Location, Checklist with Pass / Fail / N/A per item, Result pills, sign-off. App: planner and a checklist run; type, category, discipline, linked work and result are not asked when an inspection starts (Excel gap 1) |
| 10 Technical instructions | form | matches mostly | Location without drawing |
| 11 Change order | form | matches mostly | Location without drawing; approval status is an editable select (Excel gap 3) |
| 12 NCR | form | matches mostly | Location without drawing; nothing is filled from the related inspection |
| 13 Lessons Learned | form | matches | |
| 14 HSE incident | form | matches mostly | Location without drawing; severity scale differs from the Excel (Excel gap 5, needs a migration of the server rules) |
| 15 Agreements Made | form | matches | |

## 6. What remains

Ordered by what a supervisor feels first. None of these is a layout defect; each is a gap against the client's documents that is larger than a safe overnight change, or needs a migration or a client answer.

| # | What | Source | Why not tonight | Size |
|---|---|---|---|---|
| R1 | Workforce form as mockup 04: one table (discipline, contractor, number), total, remarks, sign-off; Record ID `WF-` | Mockup 04, Excel Workforce rows 3-12 | A new form and a numbering branch in the database (migration); the current form also writes attendance used by reports | 1-2 days |
| R2 | Inspection start as mockup 09: type, category, discipline, linked work / material, result list (6 values), title | Mockup 09, Excel Inspections | Changes the inspection flow and its stored fields (migration for required server rules) | 1-2 days |
| R3 | Drawing and pin in the Location card of Issue, NCR, HSE, HSE incident, TI, CO, PDR; building and level filled from the drawing | Mockups 05-07, 10-12, 14; Excel "Location block" | A pin per record needs storage (migration) | 1 day |
| R4 | Event date only in the auto bar ("tap to correct"), not a second field in the body | Excel column I on 10 forms | Touches the save path of ten forms | ½ day |
| R5 | Actions opens on the automatic follow-up list (Word 9); the sidebar badge already counts that list | Word 9 | Decided not tonight: it changes the landing view of a screen that six release specs read, and the earlier decision "who has own work starts on it" was deliberate. Recommended | 1 hour + tests |
| R6 | Legacy `client` and `contractor` roles: route to their portals only (Word 8, 21); tonight only Rapid Verify and "View as" were taken from the client | Word 8, 21, 22 | Role routing is a permission change; the portal roles (`client_*`, `contractor_*`) already do this | ½ day |
| R7 | Lists that need a server-rule migration: Change Order time unit has "Hours" (Excel: Calendar / Working days); HSE incident severity scale (Excel: Level 1-5) | Excel CO row 17, HSE incident | The option lists are stored in `app_private.spec_form_rules()` (migration 202611250009 is checked by a unit test) | 2 hours + migration |
| R8 | Photos as a form (mockup 01): per-photo title, classification pills, related record, sign-off profile | Mockup 01, Excel Photos | Photo flow and its stored fields | 1 day |
| R9 | The tablet in landscape at exactly 1024 px gets the phone layout (bottom bar) instead of the sidebar | Word 16 ("tablet landscape") | The 1024 px breakpoint is shared by hundreds of rules | ½ day |
| R10 | Form header as the mockups (one header: icon, title, "project › Workspace", Draft, time estimate) instead of the module header plus the form's own title | Mockups 01-15 | Visual only, but on every form; worth one careful pass | ½ day |

## 7. Client questions

- Q-1 (F16): may a contractor create RFI, RFA, WCR and inspection requests in the Contractor Portal? Word v2.0 decision 1 says all forms are filled in by Supervision only; Word 6.2 lists no contractor RFI; an earlier written request (20-11-2026) asked for contractor submissions. Default kept: the button stays.

## 8. What was verified, and what was not

Verified on the local stack (never on production data):
- Every screen of the supervisor app (Overview, Workspace, the 15 forms with their lists, Actions, Rapid Verify, Project Documents, Records & Photos, Reports, both portal previews, Management, the phone "More" sheet, the project switcher and the notifications dialog) at all eight viewports, twice (pass 1 before the fixes at 1366x768, 1280x720, 1024x768, 390x844, 844x390; pass 2 after them at all eight), by screenshot and by the measurement in `audit-walk.spec.ts`. Screenshots: `tmp/audit/`, `tmp/audit-after*/`, `tmp/audit-pass2/` (local, not committed; the ones that matter are in `docs/operations/ui-stability-audit/opus-2026-11-26/`).
- The contractor (own login), the client-portal user (own login) and the legacy client at 1366x768 and 390x844; Dutch at 1280x720 and 390x844 for supervisor, contractor and client portal.
- `ui-stability-audit.spec.ts`: 189 screens (ten menus and 17 Workspace destinations at seven viewports), 0 findings.
- The full local gate (lint, design guardrails, tsc, unit 368, Playwright on three device profiles with the fake Blob store) on the merged head of #38.

- Pass 3: the record view, More actions, signing popup, drawing picker, project switcher, notifications and the phone "More" sheet at 1280x720, 1366x768, 820x1180, 390x844 and 844x390 (fit, internal scroll, reachable last button), which found F30 and F31.

Not verified:
- Close / Verify / Approve, photo capture and edit, and the external-party link by eye at every viewport: covered by their own specs (`dialogs`, `close-verify-approve-dialog`, `issue-card-decision-dialog`, `media-and-sharing`), not by the walk. They use the same `ModalLayer` now where they open inside a form.
- Empty, loading, error and offline states by eye: covered by `offline-*`, `session-revoked`, `first-load` specs, not by the walk.
- PDF and Word exports by eye (the specs check that they download and contain the record).
- A real tablet and a real phone in daylight; screen readers beyond the axe audit.
- Signed-in production (by rule: production was checked read-only through its public bundle).
