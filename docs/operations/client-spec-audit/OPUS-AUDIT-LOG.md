# Opus overnight audit log (26-11-2026)

Prompt: `docs/operations/client-spec-audit/OPUS-AUDIT-PROMPT` (the owner's message of 26-11-2026). Client package: `CODECO_Developer_Package_v5.zip` (Excel v5.0, Word v2.0, mockups v6), unpacked locally in `tmp/pkg-v5/` (not committed).

## State

- Phase: 2 and 6 (visual audit and fixes), first pass. Phase 3 (Excel and Word gap audit) runs in parallel.
- Branch: `audit/opus-overnight-1`, based on `codex/forms-follow-mockups` (PR #37, not merged yet: its Playwright check was still running when this run started). This branch goes in after #37.
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
| F16 | Contractor Portal | all | contractor | "New submission (RFI, RFA, WCR, inspection request)" lets a contractor create records; Word decision 1 says forms are filled in by Supervision only, Word 6.2 lists no contractor RFI | client question | `portal-app.tsx` | open: client question Q-1 (RFI/RFA are not one of the 15 forms; an earlier written request asked for contractor submissions) |
| F17 | Workforce form | all | supervisor | Mockup 04 is one table (discipline, contractor, number), total, remarks, sign-off; ours is a party / trade picker with steppers, visitors, totals per organisation and trade, deviation, signature; no Record ID (Excel gap) | major (gap) | mockup 04 vs `03-04-workforce-form-full.png` | open: recommendation, larger than tonight |

## Decisions

See `V5-DECISION-REGISTER.md` D-31 and later.

## Next step

Phone, tablet and landscape walk after the fixes; then the Issue / controlled-document card buttons, the form header, the Overview counts, the rest of the viewports and the client and contractor roles.
