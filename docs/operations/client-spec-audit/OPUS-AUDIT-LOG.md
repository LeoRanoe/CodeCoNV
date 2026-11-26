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

## Decisions

See `V5-DECISION-REGISTER.md` D-31 and later.

## Next step

Phone, tablet and landscape walk after the fixes; then the Issue / controlled-document card buttons, the form header, the Overview counts, the rest of the viewports and the client and contractor roles.
