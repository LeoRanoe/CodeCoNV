# QA fix verification — 2026-10-28

Branch `fix/qa-sweep-2026-10-28` (from `fix/breakpoint-guardrail`). Everything below ran against the **local** stack
(`127.0.0.1:54321`); nothing was written to production. No push, no pull request, no deploy.

## Result in one paragraph

The report has 64 findings. **29 are fixed, 11 are partly fixed and 24 are still open.** All five high findings
(H1–H5) are fixed and measured. The work was done in the order of the brief and stopped before WP7 (dialogs and the drawing
flow), most of WP8 (forms), WP9 (counters), WP11 (miscellaneous), WP13's remaining items and WP15. They were not started, not
tried and failed. The table at the end names every ID with its status; the list under "Not done" says what is left.

## Commands and their output

```text
== npm run lint
> codeco-supervisie-web@0.1.0 lint:styles
> stylelint "app/**/*.css" --quiet

== tsc --noEmit
(no output = 0 errors)
== node tests (tests/*.test.mjs)
ℹ tests 216
ℹ pass 216
ℹ fail 0
ℹ skipped 0
== npm run test:design
ℹ tests 9
ℹ pass 9
ℹ fail 0
== dialogs.spec.ts on a fresh database, all 3 projects: 28 passed, 2 skipped
(In the combined run one dialogs test failed on mobile because the lifecycle spec had already started the day in that database: 'Check report' button absent. Not a regression; passes on a fresh database.)
```

### pgTAP and Playwright (production build, fresh database, local seed)

```text
== pgTAP
/CodeCoNV/supabase/tests/022_profile_phone_not_for_colleagues.pgtap.sql .......... ok
All tests successful.
Files=22, Tests=586,  4 wallclock secs ( 0.17 usr  0.06 sys +  0.14 cusr  0.18 csys =  0.55 CPU)
Result: PASS
== playwright
  -  172 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:86:3 › overview-search-list keeps a long unchosen name inside its own column
  -  173 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:86:3 › rapid-source-list keeps a long unchosen name inside its own column
  -  174 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:86:3 › unified-action-list keeps a long unchosen name inside its own column
  -  175 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:98:1 › a strip with an odd number of tiles ends on a straight edge
  -  176 [desktop-office] › tests\e2e\layout-hygiene.spec.ts:132:1 › a wrapped set of filter chips ends flush on both sides
  ok 177 [desktop-office] › tests\e2e\login-a11y.spec.ts:20:1 › a refused sign-in field is announced and linked to its message (1.0s)
  ok 178 [desktop-office] › tests\e2e\login-a11y.spec.ts:40:1 › an expired recovery link is explained and a new one can be asked for (904ms)
  ok 179 [desktop-office] › tests\e2e\media-desktop-upload.spec.ts:41:1 › on a desktop a chosen photo shows its stack and the save button (2.7s)
  ok 180 [desktop-office] › tests\e2e\mobile-forms.spec.ts:148:5 › record form stays usable with a thumb on a small phone (320px) (1.2s)
  ok 181 [desktop-office] › tests\e2e\mobile-forms.spec.ts:148:5 › checklist run stays usable with a thumb on a small phone (320px) (1.4s)
  ok 182 [desktop-office] › tests\e2e\mobile-forms.spec.ts:148:5 › record form stays usable with a thumb on a phone (390px) (1.3s)
  ok 183 [desktop-office] › tests\e2e\mobile-forms.spec.ts:148:5 › checklist run stays usable with a thumb on a phone (390px) (1.2s)
  ok 184 [desktop-office] › tests\e2e\offline-account-isolation.spec.ts:78:1 › a second account on the same device cannot read the first account's offline data (7.5s)
  ok 185 [desktop-office] › tests\e2e\offline-app.spec.ts:11:3 › offline field app › boots, hydrates and reacts with the network switched off (1.7s)
  ok 186 [desktop-office] › tests\e2e\offline-app.spec.ts:54:3 › offline field app › keeps the landing page reachable offline as well (3.1s)
[WebServer] [notifications] Push is niet actief: de pushsleutels zijn niet geconfigureerd.
  ok 187 [desktop-office] › tests\e2e\offline-create-and-sync.spec.ts:76:1 › an action is saved online, and one written offline is sent when the connection returns (5.9s)
  ok 188 [desktop-office] › tests\e2e\offline-records.spec.ts:60:3 › field records written without a connection › are kept on the device and survive reopening the app offline (4.2s)
  ok 189 [desktop-office] › tests\e2e\overview-counts.spec.ts:43:1 › overview inspections, photos and open follow-up equal what the other screens list (2.2s)
[WebServer] [notifications] Push is niet actief: de pushsleutels zijn niet geconfigureerd.
  ok 190 [desktop-office] › tests\e2e\period-report.spec.ts:48:1 › the period report PDF is Dutch, has a project head and a signature block (2.5s)
  ok 191 [desktop-office] › tests\e2e\responsive-audit.spec.ts:143:3 › layout holds at small phone (320px) (1.1s)
  ok 192 [desktop-office] › tests\e2e\responsive-audit.spec.ts:143:3 › layout holds at phone (390px) (1.1s)
  ok 193 [desktop-office] › tests\e2e\responsive-audit.spec.ts:143:3 › layout holds at tablet (820px) (1.3s)
  ok 194 [desktop-office] › tests\e2e\responsive-audit.spec.ts:143:3 › layout holds at desktop (1280px) (1.3s)
  ok 195 [desktop-office] › tests\e2e\responsive-workspace.spec.ts:9:1 › workspace register rows stay readable at phone, tablet and desktop widths (1.3s)
  ok 196 [desktop-office] › tests\e2e\role-views.spec.ts:64:1 › a client reads and signs; nothing offers to write (4.2s)
  ok 197 [desktop-office] › tests\e2e\role-views.spec.ts:90:1 › a contractor only gets the modules it can read (2.8s)
  ok 198 [desktop-office] › tests\e2e\role-views.spec.ts:103:1 › a supervisor keeps every control a supervisor needs (4.5s)
  ok 199 [desktop-office] › tests\e2e\role-views.spec.ts:120:1 › a contractor who types the Reports address lands back on the overview, with the reason (3.3s)
  ok 200 [desktop-office] › tests\e2e\role-views.spec.ts:129:1 › Management offers a contractor and a client only what their role may do (5.9s)
  -  201 [desktop-office] › tests\e2e\tap-targets.spec.ts:33:1 › the Issue form's thumb targets are 44 px and its tick boxes are named
[WebServer] [notifications] Push is niet actief: de pushsleutels zijn niet geconfigureerd.
  ok 202 [desktop-office] › tests\e2e\two-party-signature.spec.ts:50:1 › technical instruction: the issuer signs as themself, the recipient signs the response (7.5s)
[WebServer] [notifications] Push is niet actief: de pushsleutels zijn niet geconfigureerd.
  ok 203 [desktop-office] › tests\e2e\two-party-signature.spec.ts:124:1 › change order: title and description once, one issuer signature, contractor acknowledgement kept (6.9s)
  ok 204 [desktop-office] › tests\e2e\viewport-walk.spec.ts:83:1 › no module scrolls sideways at any supported width or zoom (51.8s)


  1) [mobile-field] › tests\e2e\dialogs.spec.ts:90:5 › every dialog › report check: named modal, focus trap, inert background, Escape, focus return, fits the screen 

    Test timeout of 90000ms exceeded.

    Error: locator.click: Test timeout of 90000ms exceeded.
    Call log:
      - waiting for getByRole('button', { name: 'Check report' })


      73 |     const locator = result as Locator;
      74 |     // The mobile "More" fallback for the building list is a menu, not the dialog itself.
    > 75 |     await locator.click();
         |                   ^
      76 |     if (opener.name === "manage buildings" && !(await page.locator(dialogSelector).count())) {
      77 |       await page.locator(".mobile-module-sheet").getByRole("button", { name: /Buildings/ }).click();
      78 |     }
        at activate (D:\CodeCoNV\apps\web\tests\e2e\dialogs.spec.ts:75:19)
        at D:\CodeCoNV\apps\web\tests\e2e\dialogs.spec.ts:91:13

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\artifacts\dialogs-every-dialog-repor-c4747-ocus-return-fits-the-screen-mobile-field\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\artifacts\dialogs-every-dialog-repor-c4747-ocus-return-fits-the-screen-mobile-field\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\artifacts\dialogs-every-dialog-repor-c4747-ocus-return-fits-the-screen-mobile-field\error-context.md

    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results\artifacts\dialogs-every-dialog-repor-c4747-ocus-return-fits-the-screen-mobile-field\trace.zip
    Usage:

        npx playwright show-trace test-results\artifacts\dialogs-every-dialog-repor-c4747-ocus-return-fits-the-screen-mobile-field\trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  1 failed
    [mobile-field] › tests\e2e\dialogs.spec.ts:90:5 › every dialog › report check: named modal, focus trap, inert background, Escape, focus return, fits the screen 
  79 skipped
  124 passed (9.0m)
== DONE
```

Not run: the full Playwright gate (about 17 minutes; the specs above are the relevant subset), `media-and-sharing` (needs a
Blob store and test photos), the 320 px reflow audit (not written, see M24).

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

Not done. The brief asked for a manual walk-through as contractor, client and supervisor at 375, 768, 1024 and 1440 px with
screenshots. What exists instead: Playwright measurements and axe scans on 7 screens at desktop and phone width, the PDF text
read back in two tests, and the typed-address and Management checks for contractor and client. No screenshots were made.

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
- `supabase/config.toml` allows local redirect addresses, has a Dutch recovery template and a sign-in limit of 20 per 5 minutes.
  The Playwright runs did not hit that limit.

## Not done

Open (not started): M5, M6, M7, M8, M19, M20, M24, M26, L3, L4, L5, L6, L7, L10, L12, L15, L18, L21, L22, L23, L24, L25, L26, L32.

Partly fixed, with what is missing: M4 (Button only for actions.manage, hint reworded; assigning to the party itself needs a database change and a product decision); M15 (Local redirects and Dutch template done; Mailpit end-to-end not run; the hosted project is a manual step); M25 (aside became div/section, the sign-in screen is a main; heading order unchanged); L1 (Draft notice fixed; native time inputs unchanged); L2 (The 'Aan:' colon and the chip spacing are not done); L8 (Skip link exists but has no test; the code input of 'Add building' still has no label); L9 (NCR labels only; HSE types, 'Issues', 'Workforce', 'Project Docs' unchanged (language policy is a product decision)); L13 (The headings at 768 px were not found or measured); L19 (Local limit 20 per 5 minutes, no test; the production value is a manual step); L20 (PDF done; the 'Add person' behaviour is unchanged); L28 (Isolation from seed data not done).

Never tested: a real screen reader, a real operating-system file picker, the hosted recovery mail, uploads against a Blob store,
`media-and-sharing.spec.ts`, 320 px reflow.

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
| M5 | LQA-025 | P2 | Photo count differs | open | - | - | Not started |
| M6 | LQA-026 | P2 | Disabled submit buttons without a reason | open | - | - | Not started for Issue, HSE, NCR |
| M7 | LQA-027 | P2 | Issue counters disagree | open | - | - | Not started |
| M8 | LQA-028 | P2 | Drawing pin confirmation far away, record does not open | open | - | - | Not started |
| M9 | LQA-029 | P2 | 360 dialog button overlaps the controls | fixed | CSS rule, no measurement test | 892f2b6 | aria-pressed on Auto turn; close button 48 px |
| M10 | LQA-030 | P2 | Fixed photo bar covers content | fixed | CSS reserve, no measurement test | 892f2b6 |  |
| M11 | LQA-031 | P2 | Contrast below 4.5:1 | fixed | e2e a11y-audit (7 screens x 2 layouts; fails on the old tokens) | 1fb083e | --ink-600, --signal-dark |
| M12 | LQA-032 | P2 | Period PDF shows raw values | fixed | node period-report-text (6); e2e period-report reads the PDF | e2db9f5 | PDF and Word |
| M13 | LQA-033 | P2 | Expected workforce 42 prefilled | fixed | node daily-report-model; e2e day-report-lifecycle | cb0d0ec | Migration 202610280004 |
| M14 | LQA-034 | P2 | Login errors not announced | fixed | e2e login-a11y | 3657afb |  |
| M15 | LQA-035 | P2 | Recovery mail English, redirect to production | partly fixed | - | 3657afb | Local redirects and Dutch template done; Mailpit end-to-end not run; the hosted project is a manual step |
| M16 | LQA-036 | P2 | Misleading message after an online HSE save | fixed | no dedicated test | 2bdae55 |  |
| M17 | LQA-037 | P2 | Day report lacks the client's form | fixed | node daily-report-model; e2e day-report-lifecycle | cb0d0ec | Sections 1-18 as tables plus KPI block; GPS, cloud cover, rain, HSE checklist, machines and measurements are 'Niet geregistreerd' because they are not captured |
| M18 | LQA-038 | P2 | Expired recovery link not explained | fixed | e2e login-a11y | 3657afb |  |
| M19 | LQA-039 | P2 | 'Still needed' lines too vague (PDR, CO) | open | - | - | Not started |
| M20 | LQA-040 | P2 | PDR saved before the mandatory photos are confirmed | open | - | - | Not started |
| M21 | LQA-041 | P2 | Wrong message after an online 360 upload | fixed | no dedicated test | 2bdae55 |  |
| M22 | LQA-042 | P2 | Selects without a name | fixed | e2e a11y-audit | 1fb083e | Six selects |
| M23 | LQA-043 | P2 | Contrast: 62 nodes | fixed | e2e a11y-audit | 1fb083e |  |
| M24 | LQA-044 | P2 | Overflow at 400% zoom (Middelen, Management) | open | - | - | Not started; 320 px is not in responsive-audit yet |
| M25 | LQA-045 | P2 | Landmarks and headings | partly fixed | e2e a11y-audit (landmark rules) | 1fb083e, 3657afb | aside became div/section, the sign-in screen is a main; heading order unchanged |
| M26 | LQA-046 | P2 | Drawing counted as photo; a folder per upload | open | - | - | Not started |
| M27 | LQA-047 | P2 | 'Not saved' bar stays after saving | fixed | no dedicated test | 892f2b6 | The bar listens to draft changes |
| L1 | LQA-048 | P3 | 12-hour time in the draft notice | partly fixed | - | 21f49f7 | Draft notice fixed; native time inputs unchanged |
| L2 | LQA-049 | P3 | RFI form: English chip, preset function | partly fixed | - | 21f49f7 | The 'Aan:' colon and the chip spacing are not done |
| L3 | LQA-050 | P3 | window.confirm() for pin removal | open | - | - | Not started |
| L4 | LQA-051 | P3 | Empty drawing panel, permanent green bar | open | - | - | Not started |
| L5 | LQA-052 | P3 | Sidebar project picker truncates | open | - | - | Not started |
| L6 | LQA-053 | P3 | Loose 'Open normal photo' buttons | open | - | - | Not started |
| L7 | LQA-054 | P3 | 'Author' filter only has 'All authors' | open | - | - | Not started |
| L8 | LQA-055 | P3 | Checkbox names, code label, skip link | partly fixed | e2e tap-targets (checkbox names) | 892f2b6, 3657afb | Skip link exists but has no test; the code input of 'Add building' still has no label |
| L9 | LQA-056 | P3 | NL/EN mix | partly fixed | node rendered-html (labels) | 21f49f7 | NCR labels only; HSE types, 'Issues', 'Workforce', 'Project Docs' unchanged (language policy is a product decision) |
| L10 | LQA-057 | P3 | Invalid ?project=<id> falls back silently | open | - | - | Not started |
| L11 | LQA-058 | P3 | Share page: green primary, red eyebrow, labels, badge | fixed | manual; router.refresh after a reply | 1fb083e, 2972ae8 |  |
| L12 | LQA-059 | P3 | Test data on production | open | - | - | Manual step for the product owner; no safe delete or archive action was built |
| L13 | LQA-060 | P3 | Touch targets under 44 px | partly fixed | e2e tap-targets | 892f2b6 | The headings at 768 px were not found or measured |
| L14 | LQA-061 | P3 | Contractor reads colleagues' telephone numbers | fixed | pgTAP 022 (4) | daf328a | Column closed to signed-in users |
| L15 | LQA-062 | P3 | Old notices stay after a screen change | open | - | - | Not started |
| L16 | LQA-063 | P3 | Permission RPCs and duplicate day report call | fixed | e2e contractor-submission (one request per save) | 2f2d9e1 | 60 s cache for the two permission checks |
| L17 | LQA-064 | P3 | Silent 503 on notification dispatch | fixed | - | 2f2d9e1 | Answers 200 with pushActive:false and logs a warning |
| L18 | LQA-065 | P3 | 'Choose the planned work' error out of view | open | - | - | Not started |
| L19 | LQA-066 | P3 | No delay after repeated failed logins | partly fixed | - | 3657afb | Local limit 20 per 5 minutes, no test; the production value is a manual step |
| L20 | LQA-067 | P3 | PDF details; 'Add person' three times | partly fixed | e2e day-report-lifecycle (plural, no hyphenation) | cb0d0ec | PDF done; the 'Add person' behaviour is unchanged |
| L21 | LQA-068 | P3 | Overview says nothing happened | open | - | - | Not started |
| L22 | LQA-069 | P3 | 'Project locations 0' | open | - | - | Not started |
| L23 | LQA-070 | P3 | Two terms for the same wait; '1/9' | open | - | - | Not started |
| L24 | LQA-071 | P3 | Console warnings, load time, a 401 | open | - | - | Not started |
| L25 | LQA-072 | P3 | Inspection completion sends 16 requests | open | - | - | Not started |
| L26 | LQA-073 | P3 | More NL/EN mix in content | open | - | - | Not started |
| L27 | LQA-074 | P3 | Bare file input on 'Visueel bewijs' | fixed | CSS, no test | 2bdae55 | ::file-selector-button |
| L28 | LQA-075 | P3 | pgTAP not isolated; no H1 test | partly fixed | pgTAP 021 covers H1 | 2f2d9e1 | Isolation from seed data not done |
| L29 | LQA-076 | P3 | Admin text in the upload 503 | fixed | - | 2bdae55 |  |
| L30 | LQA-077 | P3 | No confirmation after a password change | fixed | manual | 3657afb | 'Wachtwoord gewijzigd' on the project list |
| L31 | LQA-078 | P3 | Recovery screen errors not announced | fixed | e2e login-a11y (sign-in); same markup on the recovery screen | 3657afb |  |
| L32 | LQA-079 | P3 | Records load twice, flicker, double-submit test fails | open | - | - | Flicker not investigated. double-submit.spec.ts passed on a production build in this pass (1 passed), so the failing test of the report did not reproduce |
