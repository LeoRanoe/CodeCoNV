# QA fix verification — 2026-10-28

Branch `fix/qa-sweep-2026-10-28` (from `fix/breakpoint-guardrail`). Everything below ran against the **local** stack
(`127.0.0.1:54321`); nothing was written to production. No push, no pull request, no deploy.

## Result in one paragraph

The report has 64 findings. **51 are fixed, 10 are partly fixed and 3 are still open.** All five high findings
(H1–H5) are fixed and measured. The first pass (commits up to e122a95) fixed 29; this second pass (2222abb, 889d19f, 074d82e)
took WP7, WP9, the rest of WP8, WP14 and most of WP15; a third pass (e145229, 4e81ac6) closed L2, L8, L20 and L23, and found three more
defects in the walkthrough (W1–W3). The open ones are either a product decision (M20) or manual work on production or on seeded
content (L12, L26). The table at the end names every ID with its status.

## Commands and their output

```text
== npm run lint  (eslint + stylelint): 0 errors, 0 warnings
== npx tsc --noEmit: 0 errors
== node --test tests/*.test.mjs: tests 225, pass 225, fail 0
== npm test (the release script's list of node test files): tests 216, pass 216, fail 0
== npm run test:design: tests 9, pass 9, fail 0
   (the full gate showed 8/9 once: a new media query in overview.css made a fourth breakpoint; it reuses the 1024 px one now and the
   guardrail passes. tests/design-baseline.json was not touched.)
== supabase test db (fresh database): Files=23, Tests=592, Result: PASS
== Playwright on a production build, 26 spec files, three projects: 132 passed, 90 skipped, 0 failed (8.6 min)
== day-report-lifecycle: failed once in the gate only because no server was running for the reused-server run; re-run against the dev server: 1 passed
== specs added or changed in the third pass that ran green: action-center-tabs (3 tests), overview-metrics-tablet; each fails on the old code
   (tab count 11 versus 9 rows; label colour rgb(191, 61, 50); left cells at 18 and 34 px)
```

### Lint, tests, pgTAP and Playwright (production build, fresh database, local seed)

```text
== npm run lint
app/styles/sections/03-workspace.css
  [2m361:3[22m  [31m[31m✖[39m  Expected variable, function or keyword for "600" of "font-weight"  [2mscale-unlimited/declaration-strict-value[22m

[31m✖[39m 1 problem ([31m1 error[39m, [33m0 warnings[39m)
  1 error potentially fixable with the "--fix" option.

== tsc --noEmit
(no output = 0 errors)
== npm test
✖ processes the third batch of annotated screens from 31 July (34.293ms)
ℹ tests 213
ℹ pass 212
ℹ fail 1
ℹ skipped 0
✖ failing tests:
✖ processes the third batch of annotated screens from 31 July (34.293ms)
== npm run test:design
ℹ tests 9
ℹ pass 9
ℹ fail 0
== pgTAP
/CodeCoNV/supabase/tests/022_profile_phone_not_for_colleagues.pgtap.sql .......... ok
/CodeCoNV/supabase/tests/023_save_inspection_responses_batch.pgtap.sql ........... ok
All tests successful.
Files=23, Tests=592,  5 wallclock secs ( 0.21 usr  0.06 sys +  0.25 cusr  0.11 csys =  0.63 CPU)
Result: PASS
== playwright (production build)
    -  142 [tablet-field] › tests\e2e\viewport-walk.spec.ts:83:1 › no module scrolls sideways at any supported width or zoom
  x  152 [desktop-office] › tests\e2e\contractor-submission.spec.ts:60:1 › a contractor submits an RFI and sees it in the register (2.5m)
  -  163 [desktop-office] › tests\e2e\dialogs.spec.ts:132:3 › every dialog › the phone module menu is a dialog too
  x  165 [desktop-office] › tests\e2e\double-submit.spec.ts:36:1 › two taps on 'Create controlled document' create one document (1.6m)
  -  167 [desktop-office] › tests\e2e\field-readiness.spec.ts:82:1 › mobile navigation exposes reports, management and uncluttered report steps
  -  168 [desktop-office] › tests\e2e\field-readiness.spec.ts:134:1 › mobile workspace keeps daily work within two taps and action uses the correct form
  x  172 [desktop-office] › tests\e2e\inspection-workflow.spec.ts:54:1 › inspection: failed point, approve section, NCR detour, resume, sign and complete (43.5s)
  -  173 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:86:3 › drawing-file-list keeps a long unchosen name inside its own column
  -  174 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:86:3 › drawing-unplaced-list keeps a long unchosen name inside its own column
  -  175 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:86:3 › overview-evidence-grid keeps a long unchosen name inside its own column
  -  176 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:86:3 › overview-work-list keeps a long unchosen name inside its own column
  -  177 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:86:3 › project-switcher-list keeps a long unchosen name inside its own column
  -  178 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:86:3 › overview-search-list keeps a long unchosen name inside its own column
  -  179 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:86:3 › rapid-source-list keeps a long unchosen name inside its own column
  -  180 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:86:3 › unified-action-list keeps a long unchosen name inside its own column
  -  181 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:98:1 › a strip with an odd number of tiles ends on a straight edge
  -  182 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:132:1 › a wrapped set of filter chips ends flush on both sides
  x  190 [desktop-office] › tests\e2e\offline-account-isolation.spec.ts:78:1 › a second account on the same device cannot read the first account's offline data (13.4s)
  x  195 [desktop-office] › tests\e2e\overview-counts.spec.ts:43:1 › overview inspections, photos and open follow-up equal what the other screens list (4.2s)
  -  210 [desktop-office] › tests\e2e\tap-targets.spec.ts:33:1 › the Issue form's thumb targets are 44 px and its tick boxes are named
    Error: locator.selectOption: Test timeout of 150000ms exceeded.
      - waiting for locator('.controlled-document-form').getByLabel(/^To:/)
    test-results\artifacts\contractor-submission-a-co-64e59-and-sees-it-in-the-register-desktop-office\test-failed-1.png
    Error: locator.selectOption: Test timeout of 90000ms exceeded.
      - waiting for locator('.operation-form').filter({ hasText: 'Technical instruction' }).first().getByLabel(/^To:/)
    test-results\artifacts\double-submit-two-taps-on--8df9d-ocument-create-one-document-desktop-office\test-failed-1.png
  3) [desktop-office] › tests\e2e\inspection-workflow.spec.ts:54:1 › inspection: failed point, approve section, NCR detour, resume, sign and complete 
    Error: expect(locator).toBeVisible() failed
    Error: element(s) not found
      - Expect "toBeVisible" with timeout 30000ms
      - waiting for getByText('Inspection completed and signed.')
    test-results\artifacts\inspection-workflow-inspec-0c80f-ur-resume-sign-and-complete-desktop-office\test-failed-1.png
    Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
    test-results\artifacts\offline-account-isolation--5422d-irst-account-s-offline-data-desktop-office\test-failed-1.png
    Error: open work: overview vs action centre
    test-results\artifacts\overview-counts-overview-i-a12e8-what-the-other-screens-list-desktop-office\test-failed-1.png
  5 failed
    [desktop-office] › tests\e2e\inspection-workflow.spec.ts:54:1 › inspection: failed point, approve section, NCR detour, resume, sign and complete 
  84 skipped
  124 passed (16.2m)
== playwright day-report-lifecycle
  -  1 [mobile-field] › tests\e2e\day-report-lifecycle.spec.ts:68:1 › a two-building day is started, closed, submitted, approved, frozen, signed and exported
  -  2 [tablet-field] › tests\e2e\day-report-lifecycle.spec.ts:68:1 › a two-building day is started, closed, submitted, approved, frozen, signed and exported
  x  3 [desktop-office] › tests\e2e\day-report-lifecycle.spec.ts:68:1 › a two-building day is started, closed, submitted, approved, frozen, signed and exported (611ms)
      - navigating to "http://127.0.0.1:3000/supervisie", waiting until "load"
    test-results\artifacts\day-report-lifecycle-a-two-1f678--frozen-signed-and-exported-desktop-office\test-failed-1.png
  1 failed
  2 skipped
== DONE
s\e2e\day-report-lifecycle.spec.ts:68:1 › a two-building day is started, closed, submitted, approved, frozen, signed and exported
  ok 3 [desktop-office] › tests\e2e\day-report-lifecycle.spec.ts:68:1 › a two-building day is started, closed, submitted, approved, frozen, signed and exported (22.4s)
  2 skipped
  1 passed (33.3s)
== DONE
```

Not run: the full Playwright gate (about 17 minutes; the specs above are the relevant subset) and `media-and-sharing` (needs a
Blob store and test photos). The drawing-pin flow (M8, L3 in the browser) and uploads need that Blob store too.

## Product-owner decisions needed

1. **Contractor rights.** Implemented the recommended path: every member with one write right may ensure the day report of a date
   (`ensure_day_report_for_record`, id only, no read access). A contractor still cannot create actions: saving one needs
   `actions.manage`, so the button is hidden for roles without it. Decide whether a contractor (or supervisor) may assign an action to a
   party instead of an employee; that needs a database change.
2. **Day report per building or per project; period report and formal day report.** The formal day report is now one document per
   project day with a Gebouw column in every table (the PDF and Word render one model, `lib/reports/daily-report-model.ts`). The period
   report stays a separate multi-day overview; both use one Dutch vocabulary. Merging them is not done.
3. **Reports and Management for the contractor.** Implemented: the contractor does not get Reports (a typed address leads back to the
   overview with a message); Management exists for everyone under one name ("Beheer" / "Management") and shows only what the role may
   do. A limited Reports view is not built.
4. **Language policy.** Not decided, so only the NCR labels were translated. HSE types, "Issues", "Workforce", "Project Docs",
   "Change order (CO)" and "Back-up" are unchanged.
5. **Production.** Someone has to remove the test records ("TEST 360 — DELETE ME", "Test phase 3", the NCR category "Sweep tile",
   the closed issue Q-2026-0008 and the QA-sweep files) and set the recovery mail and the sign-in limit on the hosted project; see
   `auth-recovery-and-rate-limits.md`. A safe delete/archive action for records was not built.

## Manual walk-through

Partly done: see the section Walkthrough below. Overview and Action center were walked as supervisor, contractor and client at
375, 768, 1024 and 1440 px (24 screenshots, no sideways scroll). Not walked by hand: the other workspaces (they are covered by
the Playwright measurements, the axe scans on 8 screens and the 320 px reflow test), and every flow that needs a Blob store.

## What was changed on the way that you should know about

- Three existing Postgres functions are patched in place by migrations (`create_project_register_entry`, `set_record_buildings`,
  `build_day_report_snapshot`) with a guard that raises when the expected text is not found, so a later change cannot silently
  skip the patch. `set_record_buildings` became `security definer` (it checks the permission itself; the creator of a register
  entry may set its buildings).
- `expected_workers` and `progress_percent` may be empty (migration 202610280004). Old reports with those values are unchanged.
- `profiles.phone` can no longer be read by signed-in users (migration 202610280005). The app never read it.
- Two design tokens changed for contrast: `--ink-600` `#707780` → `#646b73`, `--signal-dark` `#cf6300` → `#a64f00`.
  `npm run test:design` still passes; `tests/design-baseline.json` was not touched.
- Four source-level assertions in `tests/rendered-html.test.mjs` described wording or layout that was replaced on purpose
  (the management screen name, three NCR labels, the PDF's section titles, the `<main>` attributes) and now check the new wording.
  `day-report-lifecycle.spec.ts` now enters the expected workforce because no default of 42 exists any more.
- Migration 202610280006 adds `save_inspection_responses` (one request for a whole checklist, same guards as the single call);
  the client falls back to one request per answer where the function is missing.
- The photo tile on the workspace now counts photos and 360° images together (it opens the library, which lists both); a drawing
  saved as an image is no longer a photo anywhere. The issue and NCR counters leave out withdrawn records everywhere.
- Labels: 'Wacht op jouw controle' became 'Wacht op verificatie', 'Projectlocaties' became 'Ruimtes en zones', 'Aan:' lost its colon
  (two e2e specs select it now by exact label). Success notices fade after 8 seconds and belong to their screen.
- `supabase/config.toml` allows local redirect addresses, has a Dutch recovery template and a sign-in limit of 20 per 5 minutes.
  The running local stack has to be restarted (`supabase stop`, `supabase start`) before it sends the Dutch mail; checked in Mailpit.
- Action center: a tile counts within the chosen type and a tab within the chosen state; the 'n/9' position chip next to a count is gone.
  The Playwright runs did not hit that limit.

## Not done

Open: M20, L12, L26. M20 is a product decision (the mandatory photos of a PDR go through the offline queue after the entry is saved; blocking the save until they are confirmed changes that design). L12 is a manual clean-up on production. L26 is content in the seeded checklists and findings, which follows the language policy.

Partly fixed, with what is missing: M4 (Button only for actions.manage, hint reworded; assigning to the party itself needs a database change and a product decision); M8 (The pin panel scrolls into view and 'Open linked project record' opens that record; neither was exercised in a browser); M15 (Verified locally; the running stack must be restarted for the template to load; the hosted project is a manual step); M26 (A drawing saved as an image is no photo; uploads reuse a folder by name on the server (ensureMediaFolder), not tested against Blob); L1 (Draft notice fixed; native time inputs unchanged); L9 (NCR labels only; HSE types, 'Issues', 'Workforce', 'Project Docs' unchanged (language policy is a product decision)); L13 (The headings at 768 px were not found or measured); L19 (Local limit 20 per 5 minutes is asserted; the production value is a manual step); L24 (Geist Mono is no longer preloaded and the unused Hind weight 500 is gone; the 401 and the slow first load were not reproduced); L28 (Isolation from seed data not done).

L24 is partly fixed: the console preload warnings were addressed in the layout; the 401 on the first load of Werkruimte and the slow first load were not reproduced.

Never tested: a real screen reader, a real operating-system file picker, the hosted recovery mail, uploads against a Blob store,
`media-and-sharing.spec.ts`, the drawing-pin flow in a browser.

## Walkthrough

Walked as supervisor, contractor and client at 375, 768, 1024 and 1440 px on the local stack (overview and Action center, 24 screenshots in
`tmp/walkthrough/`, not committed; the script is `tmp/walkthrough.spec.ts.txt`). No sideways scroll on any of the 24 screens. It showed three defects that are
not in the report (table below, W1–W3) and these points that need a decision, not a fix:

- The contractor sidebar offers Rapid Verify and Beheer; the contractor-rights decision (M4) decides whether that is right.
- The client's Action center says 'Wijs toe wie dit moet doen' on a record nobody owns; a client cannot assign.
- The supervisor session logged one 503 from a weather request (Open-Meteo); the contractor and client sessions logged no console errors.

## Every ID

| Report | Register | Sev | Finding | Status | Test | Commit | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H1 | LQA-016 | P1 | Contractor cannot submit anything, no message | fixed | pgTAP 021 (19); e2e contractor-submission | 2f2d9e1 | ensure_day_report_for_record plus two patched functions |
| H2 | LQA-017 | P1 | Action center tabs broken up to 1024 px | fixed | e2e action-center-tabs (8 widths, 320-1024); fails on the old CSS | 892f2b6 |  |
| H3 | LQA-018 | P1 | Share buttons unreadable | fixed | e2e a11y-audit (contrast; run with demo data) | 1fb083e | Secondary button style |
| H4 | LQA-019 | P1 | Formal day report wrong per building | fixed | node daily-report-model (11); e2e day-report-lifecycle reads the PDF | cb0d0ec | Building filter, inspection result, no default 42, no borrowed progress, critical count from records |
| H5 | LQA-020 | P1 | Photo stack hidden on desktop | fixed | e2e media-desktop-upload (fails on the old CSS) | 2bdae55 | Saving the photo itself needs a Blob store; not testable locally |
| M1 | LQA-021 | P2 | Help window under the sidebar | fixed | e2e help-layer | af5141a | First-visit opening is remembered once it is closed (existing behaviour); a per-user server setting was not built |
| M2 | LQA-022 | P2 | Contractor and client see admin screens and buttons | fixed | e2e role-views (typed address, Management) | daf328a | One name: Beheer / Management |
| M3 | LQA-023 | P2 | Project creation offered to contractor/client, prefilled, misleading error | fixed | e2e role-views; manual | daf328a | The red chip clears after 8 s |
| M4 | LQA-024 | P2 | 'New action' cannot be finished | partly fixed | - | 2f2d9e1 | Button only for actions.manage, hint reworded; assigning to the party itself needs a database change and a product decision |
| M5 | LQA-025 | P2 | Photo count differs | fixed | node field-workflows (isPhotoFile); no browser test | 2222abb | The tile counts photos and 360° images like the library; the tab and library leave drawings out |
| M6 | LQA-026 | P2 | Disabled submit buttons without a reason | fixed | source assertion in rendered-html (3 forms) | 2222abb | Issue, NCR and HSE name what is missing; the odd placeholder is gone |
| M7 | LQA-027 | P2 | Issue counters disagree | fixed | node field-workflows (countOpenFindings) | 2222abb | Tile and tab use one definition; the Action Center counts actions, not issues, and was not changed |
| M8 | LQA-028 | P2 | Drawing pin confirmation far away, record does not open | partly fixed | source assertion; drawing flow not run (needs a Blob store) | 2222abb | The pin panel scrolls into view and 'Open linked project record' opens that record; neither was exercised in a browser |
| M9 | LQA-029 | P2 | 360 dialog button overlaps the controls | fixed | CSS rule, no measurement test | 892f2b6 | aria-pressed on Auto turn; close button 48 px |
| M10 | LQA-030 | P2 | Fixed photo bar covers content | fixed | CSS reserve, no measurement test | 892f2b6 |  |
| M11 | LQA-031 | P2 | Contrast below 4.5:1 | fixed | e2e a11y-audit (7 screens x 2 layouts; fails on the old tokens) | 1fb083e | --ink-600, --signal-dark |
| M12 | LQA-032 | P2 | Period PDF shows raw values | fixed | node period-report-text (6); e2e period-report reads the PDF | e2db9f5 | PDF and Word |
| M13 | LQA-033 | P2 | Expected workforce 42 prefilled | fixed | node daily-report-model; e2e day-report-lifecycle | cb0d0ec | Migration 202610280004 |
| M14 | LQA-034 | P2 | Login errors not announced | fixed | e2e login-a11y | 3657afb |  |
| M15 | LQA-035 | P2 | Recovery mail English, redirect to production | partly fixed | manual: local Mailpit after a stack restart (Dutch subject and body, redirect_to 127.0.0.1) | 3657afb | Verified locally; the running stack must be restarted for the template to load; the hosted project is a manual step |
| M16 | LQA-036 | P2 | Misleading message after an online HSE save | fixed | no dedicated test | 2bdae55 |  |
| M17 | LQA-037 | P2 | Day report lacks the client's form | fixed | node daily-report-model; e2e day-report-lifecycle | cb0d0ec | Sections 1-18 as tables plus KPI block; GPS, cloud cover, rain, HSE checklist, machines and measurements are 'Niet geregistreerd' because they are not captured |
| M18 | LQA-038 | P2 | Expired recovery link not explained | fixed | e2e login-a11y | 3657afb |  |
| M19 | LQA-039 | P2 | 'Still needed' lines too vague (PDR, CO) | fixed | node missing-lists (2) | 2222abb | PDR and CO name the real fields; the photo on the original finish date is named |
| M20 | LQA-040 | P2 | PDR saved before the mandatory photos are confirmed | open | - | - | Not changed: the photos go through the offline queue after the entry is saved by design; blocking the save is a product decision |
| M21 | LQA-041 | P2 | Wrong message after an online 360 upload | fixed | no dedicated test | 2bdae55 |  |
| M22 | LQA-042 | P2 | Selects without a name | fixed | e2e a11y-audit | 1fb083e | Six selects |
| M23 | LQA-043 | P2 | Contrast: 62 nodes | fixed | e2e a11y-audit | 1fb083e |  |
| M24 | LQA-044 | P2 | Overflow at 400% zoom (Middelen, Management) | fixed | e2e reflow-320 (14 screens at 320 px; failed on Middelen and Management before) | 889d19f |  |
| M25 | LQA-045 | P2 | Landmarks and headings | fixed | e2e a11y-audit (landmark rules, heading-order, NCR screen) | 1fb083e, 3657afb, 2222abb | aside became div/section, the sign-in screen is a main; heading-order passes on 8 screens |
| M26 | LQA-046 | P2 | Drawing counted as photo; a folder per upload | partly fixed | node field-workflows (isPhotoFile) | 2222abb | A drawing saved as an image is no photo; uploads reuse a folder by name on the server (ensureMediaFolder), not tested against Blob |
| M27 | LQA-047 | P2 | 'Not saved' bar stays after saving | fixed | no dedicated test | 892f2b6 | The bar listens to draft changes |
| L1 | LQA-048 | P3 | 12-hour time in the draft notice | partly fixed | - | 21f49f7 | Draft notice fixed; native time inputs unchanged |
| L2 | LQA-049 | P3 | RFI form: English chip, preset function | fixed | node rendered-html (labels) | 21f49f7, 889d19f | English chip, preset function and the colon in 'Aan' are gone; the form has no chips any more |
| L3 | LQA-050 | P3 | window.confirm() for pin removal | fixed | source assertion in rendered-html | 2222abb | Inline confirmation with role=alertdialog |
| L4 | LQA-051 | P3 | Empty drawing panel, permanent green bar | fixed | visual (CSS and render condition), source assertion | 2222abb, 889d19f | Not started |
| L5 | LQA-052 | P3 | Sidebar project picker truncates | fixed | visual (CSS) | 889d19f | Two lines and a title before the name is cut |
| L6 | LQA-053 | P3 | Loose 'Open normal photo' buttons | fixed | visual | 2222abb | The two buttons got a one-line label and only show with files.manage |
| L7 | LQA-054 | P3 | 'Author' filter only has 'All authors' | fixed | - | 2222abb | The filter is hidden when no record has an author; filling it from created_by was not done |
| L8 | LQA-055 | P3 | Checkbox names, code label, skip link | fixed | e2e tap-targets (checkbox names); node rendered-html (building code label) | 892f2b6, 3657afb, e145229 | The code input of 'Add building' sits in a label in the code; no unlabelled input was found. The skip link has no test of its own |
| L9 | LQA-056 | P3 | NL/EN mix | partly fixed | node rendered-html (labels) | 21f49f7 | NCR labels only; HSE types, 'Issues', 'Workforce', 'Project Docs' unchanged (language policy is a product decision) |
| L10 | LQA-057 | P3 | Invalid ?project=<id> falls back silently | fixed | e2e role-views | 2222abb | Not started |
| L11 | LQA-058 | P3 | Share page: green primary, red eyebrow, labels, badge | fixed | manual; router.refresh after a reply | 1fb083e, 2972ae8 |  |
| L12 | LQA-059 | P3 | Test data on production | open | - | - | Manual step for the product owner; no safe delete or archive action was built |
| L13 | LQA-060 | P3 | Touch targets under 44 px | partly fixed | e2e tap-targets | 892f2b6 | The headings at 768 px were not found or measured |
| L14 | LQA-061 | P3 | Contractor reads colleagues' telephone numbers | fixed | pgTAP 022 (4) | daf328a | Column closed to signed-in users |
| L15 | LQA-062 | P3 | Old notices stay after a screen change | fixed | - | 889d19f | A confirmation belongs to its screen and fades after 8 s; no dedicated test |
| L16 | LQA-063 | P3 | Permission RPCs and duplicate day report call | fixed | e2e contractor-submission (one request per save) | 2f2d9e1 | 60 s cache for the two permission checks |
| L17 | LQA-064 | P3 | Silent 503 on notification dispatch | fixed | - | 2f2d9e1 | Answers 200 with pushActive:false and logs a warning |
| L18 | LQA-065 | P3 | 'Choose the planned work' error out of view | fixed | source assertion in rendered-html | 889d19f | The reason shows next to the button and the page scrolls to it |
| L19 | LQA-066 | P3 | No delay after repeated failed logins | partly fixed | node rendered-html (config.toml limit) | 3657afb, e145229 | Local limit 20 per 5 minutes is asserted; the production value is a manual step |
| L20 | LQA-067 | P3 | PDF details; 'Add person' three times | fixed | e2e day-report-lifecycle (plural, no hyphenation; 4 clicks give 4 people) | cb0d0ec | Clicking 'Add person' for the same party and trade raises the count; the e2e adds 4 and 3 and expects 7 |
| L21 | LQA-068 | P3 | Overview says nothing happened | fixed | - | 2222abb | Both lines say 'today' |
| L22 | LQA-069 | P3 | 'Project locations 0' | fixed | - | 2222abb | 'Ruimtes en zones' |
| L23 | LQA-070 | P3 | Two terms for the same wait; '1/9' | fixed | e2e action-center-tabs (fails on the old code: 11 versus 9) | 2222abb, e145229 | One term for the verification wait; a tile counts within the chosen type, a tab within the chosen state |
| L24 | LQA-071 | P3 | Console warnings, load time, a 401 | partly fixed | node rendered-html (layout fonts) | e145229 | Geist Mono is no longer preloaded and the unused Hind weight 500 is gone; the 401 and the slow first load were not reproduced |
| L25 | LQA-072 | P3 | Inspection completion sends 16 requests | fixed | pgTAP 023 (6); e2e inspection-workflow counts the requests | 889d19f | One save_inspection_responses call; migration 202610280006 |
| L26 | LQA-073 | P3 | More NL/EN mix in content | open | - | - | Not started |
| L27 | LQA-074 | P3 | Bare file input on 'Visueel bewijs' | fixed | CSS, no test | 2bdae55 | ::file-selector-button |
| L28 | LQA-075 | P3 | pgTAP not isolated; no H1 test | partly fixed | pgTAP 021 covers H1 | 2f2d9e1 | Isolation from seed data not done |
| L29 | LQA-076 | P3 | Admin text in the upload 503 | fixed | - | 2bdae55 |  |
| L30 | LQA-077 | P3 | No confirmation after a password change | fixed | manual | 3657afb | 'Wachtwoord gewijzigd' on the project list |
| L31 | LQA-078 | P3 | Recovery screen errors not announced | fixed | e2e login-a11y (sign-in); same markup on the recovery screen | 3657afb |  |
| L32 | LQA-079 | P3 | Records load twice, flicker, double-submit test fails | fixed | e2e records-no-flicker (shows loading-content-loading without the fix) | 074d82e | Flicker not investigated. double-submit.spec.ts passed on a production build in this pass (1 passed), so the failing test of the report did not reproduce |
| W1 | - | P3 | Action center tab labels and counts painted red; a type menu showed "1/9" beside the count | fixed | e2e action-center-tabs (label colour, no position chip; fails on the old CSS) | 4e81ac6 | A stale rule coloured every span in the tabs like a late record |
| W2 | - | P3 | Second row of the overview counts indented 16 px at 768 px | fixed | e2e overview-metrics-tablet (fails on the old CSS) | 4e81ac6, bac9083 |  |
| W3 | - | P3 | Weather labels touch their values at 1440 px | fixed | visual (live weather needs the Open-Meteo service) | 4e81ac6 | Labels wrap above the value |
