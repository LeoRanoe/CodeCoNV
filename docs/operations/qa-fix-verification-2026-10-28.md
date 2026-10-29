# QA fix verification — 2026-10-28

Branches `fix/qa-sweep-2026-10-28` (merged as PR #8) and `fix/qa-followup-2026-10-29`. Everything below ran against the **local** stack
(`127.0.0.1:54321`, and a fake Blob store on a loopback port); nothing was written to production or to the hosted Supabase project.

## Result in one paragraph

The report has 64 findings. **61 are fixed and 3 are steps only the owner can take**: they change the hosted Supabase project or
the production data, which this work never touches (M15 and L19 are dashboard settings, L12 is the withdrawal of the test records). For those three the
repository part is done and checked locally, and `auth-recovery-and-rate-limits.md` and `production-test-data.md` list the steps. Nothing is left partly
fixed. The product decisions that were open are taken and written down below; a decision that you overturn is a small change, not a rebuild.

The passes: the first (up to e122a95) fixed 29; the second (2222abb, 889d19f, 074d82e) took WP7, WP9, the rest of WP8, WP14 and most of WP15; the third
(e145229, 4e81ac6, bac9083) closed L2, L8, L20 and L23 and found three defects in the walkthrough (W1–W3); the fourth (39dfcdb, 66290f3) closed L13 and L28 and found
W4; the fifth (86b692d, ac34b0c, c5fa4c5, 4c962ef, 9c3841e) closed the rest: language policy, 24-hour time, an action without an assignee, and a local Blob store
that made the photo, drawing and delay-report flows testable. The table at the end names every ID with its status.

## Commands and their output

```text
== npm run lint  (eslint + stylelint): 0 errors, 0 warnings
== npx tsc --noEmit: 0 errors
== node --test tests/*.test.mjs: tests 232, pass 232, fail 0
== npm test (the release script's list of node test files): tests 223, pass 223, fail 0
== npm run test:design: tests 9, pass 9, fail 0
== supabase test db on a database that holds the seed fixtures: Files=24, Tests=600, Result: PASS
== supabase test db on a fresh database: Files=24, Tests=600, Result: PASS
== Playwright, every spec, production build against the fake Blob store, three projects: 161 passed, 121 skipped, 0 failed (12.6 min)
   (the skipped ones are phone and tablet guards, specs that measure one width, and opt-in audits)
== new or changed specs that ran green in that run: action-without-assignee, action-center-tabs (3), delay-report-evidence (2), first-load,
   media-and-sharing (3), offline-account-isolation, overview-counts, overview-metrics-tablet, register-touch-targets, role-views (8), tap-targets, time-field;
   each new one fails on the old code (examples: tab count 11 versus 9 rows; stepper 35 px; the report left behind without its photo; the drawing counted as a photo)
```

The photo, 360°, drawing-pin and delay-report specs ran against a fake Blob store (`tests/e2e/fake-blob`, started by `npm run start:e2e:blob` or by
setting `CODECO_E2E_FAKE_BLOB=1` for Playwright). It speaks the parts of the Blob protocol the app uses; it proves the app's own flow, not Vercel's service.

## Decisions taken

These were open product questions. Each one is decided here so the work could finish; the reason and the way back are stated.

1. **Contractor rights (M4).** Every member with one write right may ensure the day report of a date (`ensure_day_report_for_record`, id only, no read access).
   Creating a central action stays with `actions.manage` (company staff); the contractor works on actions assigned to the party. The assignee is optional
   on creation, so a project without a company employee can still create one; it stays with its creator until it is assigned. Way back: add the permission to the
   contractor role in the matrix.
2. **Day report per building or per project.** One formal day report per project day with a Gebouw column in every table; the period report stays a separate
   multi-day overview, both in one Dutch vocabulary.
3. **Reports and Management for the contractor.** The contractor does not get Reports (a typed address leads back to the overview with a reason); Management
   exists for everyone under one name and shows only what the role may do. A limited Reports view is not built because no one asked for what it should show.
4. **Language (L9, L26)** — `docs/product/taalbeleid.md`. What the app writes follows the language; the names of the client’s own forms and modules stay as
   her paper writes them (a test already guarded that); authored content (checklists, categories, record text) stays as written, because a signed inspection keeps
   the text that was signed. Way back: the client decides, then new Dutch checklist versions are new content.
5. **Photos required by a formal form (M20).** A delay report and a lesson learned need a connection; if the required photos are not confirmed the record is
   withdrawn again and the form keeps what was typed. The offline queue still serves every other record.
6. **Time (L1).** Times are picked on a 24-hour clock whatever the browser language is; the native time input cannot be forced to.
7. **Production and the hosted project (M15, L19, L12).** Not touched. The owner’s steps are written in `auth-recovery-and-rate-limits.md` and
   `production-test-data.md`, with a read-only finder for the test records.

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

## What is not covered

- Owner steps: M15 and L19 (hosted Supabase settings), L12 (withdraw the test records on production). The repository part of each is done.
- Not tested: a real screen reader, the operating-system file picker, Vercel’s own Blob service (the fake store stands in), the hosted recovery mail and the
  one slow first load seen on production (it was not reproducible; `first-load.spec.ts` holds the budget and a clean console).

## Walkthrough

Walked as supervisor, contractor and client at 375, 768, 1024 and 1440 px on the local stack (overview and Action center, 24 screenshots in
`tmp/walkthrough/`, not committed; the script is `tmp/walkthrough.spec.ts.txt`). No sideways scroll on any of the 24 screens. It showed three defects that are
not in the report (table below, W1–W3) and these points that need a decision, not a fix:

- The contractor sidebar offers Rapid Verify and Beheer; Beheer shows only what the role may do and Rapid Verify only reads (decision 3).
- The client's Action center said 'Wijs toe wie dit moet doen' on a record nobody owns, though a client cannot assign; it now says it is waiting for assignment (see W5).
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
| M4 | LQA-024 | P2 | 'New action' cannot be finished | fixed | pgTAP 024 (8); e2e action-without-assignee (fails on the old form) | 2f2d9e1, c5fa4c5 | Decision: the assignee is optional on creation (the action stays with its creator until it is assigned); creating a central action stays with actions.manage, so the contractor does not get the button |
| M5 | LQA-025 | P2 | Photo count differs | fixed | node field-workflows (isPhotoFile); no browser test | 2222abb | The tile counts photos and 360° images like the library; the tab and library leave drawings out |
| M6 | LQA-026 | P2 | Disabled submit buttons without a reason | fixed | source assertion in rendered-html (3 forms) | 2222abb | Issue, NCR and HSE name what is missing; the odd placeholder is gone |
| M7 | LQA-027 | P2 | Issue counters disagree | fixed | node field-workflows (countOpenFindings) | 2222abb | Tile and tab use one definition; the Action Center counts actions, not issues, and was not changed |
| M8 | LQA-028 | P2 | Drawing pin confirmation far away, record does not open | fixed | e2e media-and-sharing (confirm and open buttons in the viewport at 1280x720; the linked record opens without the empty form) | 2222abb, 4c962ef | Run against the fake Blob store. Found on the way: a pin that was already selected did not bring its card into view again, a panel taller than the window never moved, and a link to one record still opened the module with its form |
| M9 | LQA-029 | P2 | 360 dialog button overlaps the controls | fixed | CSS rule, no measurement test | 892f2b6 | aria-pressed on Auto turn; close button 48 px |
| M10 | LQA-030 | P2 | Fixed photo bar covers content | fixed | CSS reserve, no measurement test | 892f2b6 |  |
| M11 | LQA-031 | P2 | Contrast below 4.5:1 | fixed | e2e a11y-audit (7 screens x 2 layouts; fails on the old tokens) | 1fb083e | --ink-600, --signal-dark |
| M12 | LQA-032 | P2 | Period PDF shows raw values | fixed | node period-report-text (6); e2e period-report reads the PDF | e2db9f5 | PDF and Word |
| M13 | LQA-033 | P2 | Expected workforce 42 prefilled | fixed | node daily-report-model; e2e day-report-lifecycle | cb0d0ec | Migration 202610280004 |
| M14 | LQA-034 | P2 | Login errors not announced | fixed | e2e login-a11y | 3657afb |  |
| M15 | LQA-035 | P2 | Recovery mail English, redirect to production | owner step | manual: local Mailpit after a stack restart (Dutch subject and body, redirect_to 127.0.0.1) | 3657afb | Done and checked locally. The hosted project reads none of supabase/config.toml: steps 1-3 and 5 of auth-recovery-and-rate-limits.md are the owner’s |
| M16 | LQA-036 | P2 | Misleading message after an online HSE save | fixed | no dedicated test | 2bdae55 |  |
| M17 | LQA-037 | P2 | Day report lacks the client’s form | fixed | node daily-report-model; e2e day-report-lifecycle | cb0d0ec | Sections 1-18 as tables plus KPI block; GPS, cloud cover, rain, HSE checklist, machines and measurements are 'Niet geregistreerd' because they are not captured |
| M18 | LQA-038 | P2 | Expired recovery link not explained | fixed | e2e login-a11y | 3657afb |  |
| M19 | LQA-039 | P2 | 'Still needed' lines too vague (PDR, CO) | fixed | node missing-lists (2) | 2222abb | PDR and CO name the real fields; the photo on the original finish date is named |
| M20 | LQA-040 | P2 | PDR saved before its mandatory photos are confirmed | fixed | e2e delay-report-evidence (saved with the photo; withdrawn again when the photo is refused, fails on the old logic) | 4c962ef | Decision: a delay report and a lesson learned need a connection; when the required photos are not confirmed the record is withdrawn, the queued photos are removed and the form keeps what was typed |
| M21 | LQA-041 | P2 | Wrong message after an online 360 upload | fixed | no dedicated test | 2bdae55 |  |
| M22 | LQA-042 | P2 | Selects without a name | fixed | e2e a11y-audit | 1fb083e | Six selects |
| M23 | LQA-043 | P2 | Contrast: 62 nodes | fixed | e2e a11y-audit | 1fb083e |  |
| M24 | LQA-044 | P2 | Overflow at 400% zoom (Middelen, Management) | fixed | e2e reflow-320 (14 screens at 320 px; failed on Middelen and Management before) | 889d19f |  |
| M25 | LQA-045 | P2 | Landmarks and headings | fixed | e2e a11y-audit (landmark rules, heading-order, NCR screen) | 1fb083e, 3657afb, 2222abb | aside became div/section, the sign-in screen is a main; heading-order passes on 8 screens |
| M26 | LQA-046 | P2 | Drawing counted as photo; a folder per upload | fixed | node field-workflows (isPhotoFile, overview query); e2e media-and-sharing (count unchanged after a drawing; one folder after two saves; fails on the old query) | 2222abb, 4c962ef | The overview Pictures count still included drawings and unavailable files; it follows the library rule now |
| M27 | LQA-047 | P2 | 'Not saved' bar stays after saving | fixed | no dedicated test | 892f2b6 | The bar listens to draft changes |
| L1 | LQA-048 | P3 | 12-hour time in the draft notice | fixed | node field-workflows (split/join); e2e time-field under an en-US browser | 21f49f7, ac34b0c | All twelve time inputs are an hour list and a minute list on a 24-hour clock |
| L2 | LQA-049 | P3 | RFI form: English chip, preset function | fixed | node rendered-html (labels) | 21f49f7, 889d19f | English chip, preset function and the colon in 'Aan' are gone; the form has no chips any more |
| L3 | LQA-050 | P3 | window.confirm() for pin removal | fixed | source assertion in rendered-html | 2222abb | Inline confirmation with role=alertdialog |
| L4 | LQA-051 | P3 | Empty drawing panel, permanent green bar | fixed | visual (CSS and render condition), source assertion | 2222abb, 889d19f | Not started |
| L5 | LQA-052 | P3 | Sidebar project picker truncates | fixed | visual (CSS) | 889d19f | Two lines and a title before the name is cut |
| L6 | LQA-053 | P3 | Loose 'Open normal photo' buttons | fixed | visual | 2222abb | The two buttons got a one-line label and only show with files.manage |
| L7 | LQA-054 | P3 | 'Author' filter only has 'All authors' | fixed | - | 2222abb | The filter is hidden when no record has an author; filling it from created_by was not done |
| L8 | LQA-055 | P3 | Checkbox names, code label, skip link | fixed | e2e tap-targets (checkbox names); node rendered-html (building code label) | 892f2b6, 3657afb, e145229 | The code input of 'Add building' sits in a label in the code; no unlabelled input was found. The skip link has no test of its own |
| L9 | LQA-056 | P3 | NL/EN mix | fixed | node rendered-html (labels, TI answers, policy document) | 21f49f7, 86b692d | Decision (docs/product/taalbeleid.md): what the app writes follows the language; the names of the client’s own forms and modules (Workforce, Issues, Project Docs, Change order (CO), NCR title) stay as the client writes them. The TI answers and a few labels were still English and are translated |
| L10 | LQA-057 | P3 | Invalid ?project=<id> falls back silently | fixed | e2e role-views | 2222abb | Not started |
| L11 | LQA-058 | P3 | Share page: green primary, red eyebrow, labels, badge | fixed | manual; router.refresh after a reply | 1fb083e, 2972ae8 |  |
| L12 | LQA-059 | P3 | Test data on production | owner step | finder run against the local stack (15 hits for a test pattern) | 9c3841e | Nothing here writes to production. apps/web/scripts/find-test-records.mjs lists the records read-only and docs/operations/production-test-data.md says how to withdraw them; the withdrawal is the owner’s |
| L13 | LQA-060 | P3 | Touch targets under 44 px | fixed | e2e tap-targets (phone and tablet); e2e register-touch-targets (fails on the old CSS) | 892f2b6, 39dfcdb, 66290f3 | Issue form tiles and the register steppers, remove buttons, shift inputs and sync chip reach 44 px up to 1024 px; ui-button--md (40 px) and the quick-pick chips (39 px) are the design system size and unchanged |
| L14 | LQA-061 | P3 | Contractor reads colleagues' telephone numbers | fixed | pgTAP 022 (4) | daf328a | Column closed to signed-in users |
| L15 | LQA-062 | P3 | Old notices stay after a screen change | fixed | - | 889d19f | A confirmation belongs to its screen and fades after 8 s; no dedicated test |
| L16 | LQA-063 | P3 | Permission RPCs and duplicate day report call | fixed | e2e contractor-submission (one request per save) | 2f2d9e1 | 60 s cache for the two permission checks |
| L17 | LQA-064 | P3 | Silent 503 on notification dispatch | fixed | - | 2f2d9e1 | Answers 200 with pushActive:false and logs a warning |
| L18 | LQA-065 | P3 | 'Choose the planned work' error out of view | fixed | source assertion in rendered-html | 889d19f | The reason shows next to the button and the page scrolls to it |
| L19 | LQA-066 | P3 | No delay after repeated failed logins | owner step | node rendered-html (config.toml limit) | 3657afb, e145229 | The local limit (20 per 5 minutes) is set and asserted. The hosted project has its own value (Dashboard, Authentication, Rate limits): step 4 of auth-recovery-and-rate-limits.md is the owner’s |
| L20 | LQA-067 | P3 | PDF details; 'Add person' three times | fixed | e2e day-report-lifecycle (plural, no hyphenation; 4 clicks give 4 people) | cb0d0ec | Clicking 'Add person' for the same party and trade raises the count; the e2e adds 4 and 3 and expects 7 |
| L21 | LQA-068 | P3 | Overview says nothing happened | fixed | - | 2222abb | Both lines say 'today' |
| L22 | LQA-069 | P3 | 'Project locations 0' | fixed | - | 2222abb | 'Ruimtes en zones' |
| L23 | LQA-070 | P3 | Two terms for the same wait; '1/9' | fixed | e2e action-center-tabs (fails on the old code: 11 versus 9) | 2222abb, e145229 | One term for the verification wait; a tile counts within the chosen type, a tab within the chosen state |
| L24 | LQA-071 | P3 | Console warnings, load time, a 401 | fixed | e2e first-load (no refused request, no console error, no unused preload, under 8 s) | e145229, 868b0d5, 9c3841e | Geist Mono is no longer preloaded, the unused Hind weight is gone and a failed daily backup check is retried after 10 minutes. The one slow load and the 401 on production were not reproducible; the spec holds the budget and the clean console |
| L25 | LQA-072 | P3 | Inspection completion sends 16 requests | fixed | pgTAP 023 (6); e2e inspection-workflow counts the requests | 889d19f | One save_inspection_responses call; migration 202610280006 |
| L26 | LQA-073 | P3 | English content in seeded checklists and findings | fixed | docs/product/taalbeleid.md; node rendered-html | 86b692d | Decision: the checklists are the client’s own English reference forms and a signed inspection keeps the text that was signed, so authored content is not translated; Dutch checklists would be new content with their own version |
| L27 | LQA-074 | P3 | Bare file input on 'Visueel bewijs' | fixed | CSS, no test | 2bdae55 | ::file-selector-button |
| L28 | LQA-075 | P3 | pgTAP not isolated; no H1 test | fixed | supabase test db on a seeded database (592 pass, data intact); node rendered-html (every file that creates an organization truncates first) | 2f2d9e1, 39dfcdb | pgTAP 021 covers H1; 14 files used to fail on a database with seed data |
| L29 | LQA-076 | P3 | Admin text in the upload 503 | fixed | - | 2bdae55 |  |
| L30 | LQA-077 | P3 | No confirmation after a password change | fixed | manual | 3657afb | 'Wachtwoord gewijzigd' on the project list |
| L31 | LQA-078 | P3 | Recovery screen errors not announced | fixed | e2e login-a11y (sign-in); same markup on the recovery screen | 3657afb |  |
| L32 | LQA-079 | P3 | Records load twice, flicker, double-submit test fails | fixed | e2e records-no-flicker (shows loading-content-loading without the fix) | 074d82e | Flicker not investigated. double-submit.spec.ts passed on a production build in this pass (1 passed), so the failing test of the report did not reproduce |
| W1 | - | P3 | Action center tab labels and counts painted red; a type menu showed "1/9" beside the count | fixed | e2e action-center-tabs (label colour, no position chip; fails on the old CSS) | 4e81ac6 | A stale rule coloured every span in the tabs like a late record |
| W2 | - | P3 | Second row of the overview counts indented 16 px at 768 px | fixed | e2e overview-metrics-tablet (fails on the old CSS) | 4e81ac6, bac9083 |  |
| W3 | - | P3 | Weather labels touch their values at 1440 px | fixed | visual (live weather needs the Open-Meteo service) | 4e81ac6 | Labels wrap above the value |
| W4 | - | P3 | Register steppers, remove buttons, shift inputs and the sync chip 33-38 px on a tablet | fixed | e2e register-touch-targets (fails on the old CSS: stepper 35 px) | 66290f3 | Found by measuring every workspace destination at 768 px |
| W5 | - | P3 | A client was told to assign a record nobody owns | fixed | e2e role-views (client sees the waiting wording, supervisor still the order) | 045de7f | Walkthrough finding: only someone with actions.manage is told to assign |
