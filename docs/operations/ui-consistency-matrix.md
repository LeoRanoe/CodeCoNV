# UI consistency matrix — CODECO Supervisie

What was looked at in the running application, module by module, and what it showed. Updated
10 October 2026 on branch `fix/supervisie-production-readiness`.

How to read it. A cell is only marked when the thing was opened in a real browser (Chrome, the
local stack with fixture data). Nothing is marked from reading source.

## UI cleanup verification — 27 October 2026

The UI cleanup branch changed the public landing, sign-in, app shell, overview, workspace, project
selection, Management, Reports, record forms, media tools, and external-share controls. The code was
integrated with the newer daily report and photo-draft fixes. `npm run lint`, `npm test` (190 tests),
and the design guardrails passed at integration; the final verification branch reruns them after
strictening the app guardrails.

The matrix below records the earlier browser audit. Its marks are **not** a browser verification of
the new styling. The local Docker Linux engine is unavailable, so fixture seeding, the three-project
Playwright suite, and authenticated 1440/390 screenshots could not run in this pass. The public site
was captured at [1440](ui-slop-audit/after/landing-desktop-viewport.jpg) and
[390](ui-slop-audit/after/landing-phone-viewport.jpg). See the
[After audit](ui-ai-slop-audit.md#after--27-october-2026) for measured design-token counts and the
remaining CSS consolidation work.

| Mark | Meaning |
| --- | --- |
| ✔ | Opened and looked at (screenshot read, DOM audited); no defect left |
| ✔* | Looked at; a defect was found and fixed in this pass (see *Fixed*) |
| T | Exercised by an automated browser test, not looked at by eye in this pass |
| ◐ | Looked at in part (state or width named in the last columns) |
| ⛔ | Not looked at; reason given (needs a private Blob store, a real device, or data the fixture does not have) |
| – | The state does not exist for this module, or was not reachable |

Widths. Desktop 1440, tablet 820, phone 390 (the phone also walked at 360 and 430). Zoom 125 % and
150 % are the 1024 and 853 px layouts, walked by `viewport-walk.spec.ts`. Roles: supervisor (organization
administrator), client (read-only owner representative) and contractor (account) were all signed in and
their screens compared against the permission matrix.

Method. Interactive tours drove every module at the three widths, clicking the real controls
(tile → list → *New* → form, tabs, every dialog), and ran a DOM audit on each screen: unnamed controls,
raw stored codes, mixed-language text, click-target sizes, heading order, horizontal overflow, text
size, focus indicator. About 60 screenshots were read by eye; the rest were audited by script only,
which is why many tablet and phone cells say ◐. Each tour ran in Dutch and in English. The automated
parts are regression tests (§ *Regression*).

## Matrix

| Module | Desktop | Tablet | Mobile | Empty | Loading | Error | Success | Form | Detail | Modal | Permissions | Offline | Issues found | Fixed | Verified |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Authentication | ✔ | ◐ | ◐ | – | ✔ | ◐ | – | ✔ | – | – | – | T | Helper sentence under the title | ✔ | sign-in at 3 widths; wrong-password message from the previous pass; throttled load shows the step list |
| Main application shell | ✔* | ✔ | ✔* | – | ✔ | – | T | – | – | ✔* | ✔* | ✔* | 5 buttons whose name did not contain their visible text; connection changes not announced; connection chip hidden on phones (offline manager unreachable); photo button shown to read-only roles | ✔ | `dialogs.spec`, `role-views.spec`, tours |
| Workspace / home | ✔* | ✔ | ✔ | ✔ | – | – | – | – | – | – | ✔* | – | Two stacked headers with a marketing sentence; a description under every tile; tiles for modules a role cannot read | ✔ | tours, `role-views.spec` |
| Project selection | ◐ | ✔ | ◐ | – | ✔ | – | – | – | – | – | – | – | Conversational headline; "1 gebouwen"; a banner that said "online" twice | ✔ | tour; 820 px read |
| Project overview | ✔* | ◐ | ✔ | ✔ | ✔ | – | – | – | – | – | ✔* | – | Quality count ignored real findings and NCRs; decorative fake plan with "Open linked drawing"; three detail lines that said nothing | ✔ | tours, with and without demo data |
| Building selection | ◐ | ◐ | ◐ | – | – | – | – | – | – | T | – | – | Dialog opened and measured only | – | `dialogs.spec` |
| Project configuration (Management → Team & rules, Project setup) | ✔* | ◐ | ✔ | – | – | – | – | ◐ | – | – | ✔ | – | Project setup tab was hard-coded Dutch with raw codes (`zone`, `contractor`) | ✔ | tours EN + NL |
| Team / member management | ◐ | ◐ | ◐ | – | – | – | – | – | – | T | ✔ | – | Dialog opened, trapped and closed; no invitation was sent | – | `dialogs.spec` |
| Role / access management | – | – | – | – | – | – | – | – | – | – | – | – | Not opened beyond the team dialog | – | – |
| Management | ✔* | ◐ | ✔* | ✔ | – | – | – | – | – | – | ✔ | – | Card descriptions; three KPI sub-lines; tab bar clipped on a phone (scrolls inside itself, the page does not overflow) | ✔ | tours, walk |
| Day start (project start) | ✔* | ◐ | ◐ | – | – | – | – | ✔ | – | ✔ | ✔ | – | "Visible automation" panel (always-on rules, rule IDs); only offered until the day is started | ✔ | opened on a fresh day at 1440; the panel now lists only real warnings |
| Workforce | ✔* | ✔ | ◐ | ✔ | – | – | – | ✔ | – | ✔ | ✔* | – | English default disciplines in a Dutch screen; edit controls shown to roles that cannot count | ✔ | `dialogs.spec`, `role-views.spec`, `day-report-lifecycle.spec`; migration for the default |
| Attendance (visitors, headcount, deviation note) | ✔ | ◐ | ◐ | ✔ | – | – | T | ✔ | – | ✔ | ✔ | – | – | – | tours, `day-report-lifecycle.spec` |
| Works ongoing / completed | ◐ | ◐ | ◐ | ✔ | – | – | – | – | – | – | – | – | Empty state only | – | tours |
| Delay / Delay report (PDR) | ✔* | ◐ | ◐ | ✔ | – | – | – | ✔* | – | – | ✔ | – | Section descriptions on every block | ✔ | tours |
| Daily closeout (daily questions) | ✔* | ◐ | ◐ | – | – | – | T | ✔* | – | ✔ | ✔* | – | Helper under each label; "client sections · reused across modules" subtitle | ✔ | `dialogs.spec`, `day-report-lifecycle.spec` |
| Inspections | ✔ | ◐ | ◐ | ✔ | – | – | – | ✔ | – | – | ✔ | – | – | – | tours |
| Checklists (library, install) | ✔* | ◐ | ◐ | ✔ | – | – | – | – | – | – | ✔ | – | Raw module code on each card; the same "CODECO basiscontrole…" sentence under every card | ✔ | tours |
| Findings / Issues | ✔* | ◐ | ✔ | ✔ | – | – | – | ✔* | ✔ | – | ✔* | – | Heading hierarchy; unlabeled textareas; helper paragraph; write buttons shown to read-only roles | ✔ | tours (populated), `role-views.spec` |
| NCR | ✔* | ◐ | ◐ | ✔ | – | – | – | ✔ | ✔ | – | ✔* | – | As Issues | ✔ | tours (populated) |
| HSE / HSE incident | ✔ | ◐ | ◐ | ✔ | – | – | – | ✔ | – | – | ✔ | – | – | – | tours |
| Actions | ✔* | ◐ | ◐ | ✔ | – | – | – | ✔ | ✔ | ✔ | ✔* | – | Row kicker was the raw code `ACTION`; a subtitle per view | ✔ | tours (populated) |
| Action center | ✔* | ◐ | ◐ | ✔ | – | – | – | – | – | – | ✔* | – | "New action" for roles without `actions.create` | ✔ | `role-views.spec` |
| Registers (materials delivery, agreements, lessons learned, TI, CO) | ✔* | ◐ | ◐ | ✔ | – | – | – | ✔* | – | – | ✔ | – | Bill-of-quantities import and a "not created here" banner on every register page | ✔ | tours |
| RFI / RFA / WCR / WIR | ◐ | ◐ | ◐ | ✔ | – | – | – | – | – | – | ✔ | – | Entry through *Record external submission* fixed in the previous pass; no submission recorded in this one | – | tours; `controlled-document.spec` |
| Technical instruction | ✔ | ◐ | ◐ | ✔ | – | – | – | ✔ | – | – | ✔ | – | – | – | tours |
| Controlled document response | T | T | T | – | – | – | T | T | T | – | ✔ | – | Driven end to end by `controlled-document.spec`; not looked at by eye | – | e2e |
| Drawings | ✔ | ◐ | ◐ | ✔ | – | – | – | – | ⛔ | – | ✔ | – | Empty state only; a drawing needs a private Blob store | – | tours |
| Drawing locations / pins | ⛔ | ⛔ | ⛔ | – | – | – | – | ⛔ | ⛔ | ⛔ | – | ⛔ | Need an uploaded drawing | – | – |
| Photos, photo stack, photo detail, markup, 360° viewer, visual annotations | ⛔ | ⛔ | ⛔ | ✔ | – | – | – | ⛔ | ⛔ | ⛔ | ✔ | ⛔ | The library opens and shows its empty state and upload choices; anything with an image needs a private Blob store | – | – |
| Files / Documents (Project Docs) | ✔* | ◐ | ◐ | ✔ | – | – | – | ✔ | ⛔ | ⛔ | ✔* | – | Heading hierarchy (h1 → h3); filter fields in three sizes; folder-name field collapsed to 22 px at 820; upload shown to read-only roles | ✔ | tours, `role-views.spec` |
| External share creation | ◐ | ◐ | ◐ | – | – | – | – | – | – | – | ✔* | – | Button shown to read-only roles (the database also allows it — raised as a follow-up) | UI ✔ | `role-views.spec` |
| External share recipient UI | ◐ | – | ◐ | – | – | ✔ | – | ◐ | ◐ | – | – | – | Unavailable-link page inspected; filler block removed. A live link was not opened in this pass | ✔ | invalid link |
| Notifications | ✔* | ◐ | ✔ | ✔ | – | – | – | – | – | ✔ | ✔ | – | Titles written in Dutch by the database in an English screen | ✔ | `dialogs.spec`, tours |
| Reports | ✔* | ◐ | ✔ | ✔ | – | – | T | ✔ | ✔ | – | ✔ | – | Card subtitles, a paragraph, an explanatory paragraph per step | ✔ | tours, `day-report-lifecycle.spec` |
| Report review / Signatures | ✔ | ◐ | ◐ | – | – | – | T | ✔ | ✔ | ✔ | ✔ | – | Signature dialog opened and measured at 3 widths | – | `dialogs.spec`, `day-report-lifecycle.spec`; signature pad read at 1440 |
| PDF / DOCX actions | ◐ | ◐ | ◐ | – | – | – | T | – | – | – | ✔ | – | Buttons present on every report; output downloaded and checked by the lifecycle test and in the previous pass | – | e2e |
| Offline manager | ✔ | ✔ | ✔* | ✔ | – | – | – | – | – | ✔ | ✔ | ✔* | Unreachable on phones; "Sync now" vs "Send now" vs "waiting" | ✔ | `dialogs.spec`, offline specs |
| Offline outbox | T | T | T | ✔ | – | T | T | – | – | – | – | T | One vocabulary: *waiting to be sent / Send now / sent* | ✔ | offline specs |
| Settings / configuration screens | ✔ | ◐ | ◐ | – | – | – | – | ◐ | – | – | ✔ | – | – | – | tours |
| Every modal / sheet | ✔* | ✔* | ✔* | – | – | – | – | – | – | T | – | – | Only the app-level dialogs had a focus trap; the field guide and the phone menu used their own radius, title size and close size | ✔ | `dialogs.spec` (33 tests) |

### Not inspected, and why

- **Anything that displays an uploaded image or drawing** — photo detail, stack, markup, 360° viewer, drawing
  pins, marker persistence. The local stack has no private Blob store; see *Flow C* in
  `production-readiness.md`. The screens around them (library, upload choices, empty states, permissions,
  dialogs) were inspected.
- **A real phone.** Everything phone-sized was done in Chrome with a 390 px touch viewport. The on-screen keyboard,
  camera and GPS were not exercised.
- **The recipient page of a live share link**, a submitted RFI/RFA/WCR, and email delivery.

## Shared patterns (what the product now agrees on)

| Concept | Rule |
| --- | --- |
| Type scale | Floor of 11 px (`--text-xs`), then 12 / 13 / 15 / 18 / 24 / 28 (`--text-sm … --text-3xl` in `globals.css`). There were 430 rules between 7 and 10 px. Inputs are 16 px on touch screens so a phone does not zoom. |
| Controls | Height 40 px for buttons and filter fields (`--control-h-md`), 43–44 px for form fields, radius 9–10 px, 12 px bold labels. Primary orange, secondary teal outline, ghost grey outline, danger red outline. |
| Dialogs | One mechanism (`app/dialog-manager.tsx`): named modal, focus in, Tab trap, inert background, Escape through the dialog's own close control, scroll lock, focus returns to the opener. Radius 22 px, 21 px title, 36 px close, secondary-then-primary footer, bottom sheet on phones. |
| Lists | There are no data tables. Records are rows (`RecordList`, action list, workforce rows) that wrap or shorten long names; verified with the layout fixtures and the viewport walk. |
| Tabs | Segmented bars scroll inside themselves on a phone; the page never scrolls sideways. |
| Status, type, priority | `lib/status-labels.ts` is the only source; no stored code reaches the screen (audited on every screen, both languages). |
| Local queue | *Waiting to be sent* → *Send now* → *Sent* / *Sending failed*. The same words in the record rows, the outbox, the photo queue and the offline manager. |
| Copy | Title, then the interface. No subtitle under a heading or a card unless the user loses information without it; no placeholder that repeats a label; messages state the fact (*Saved on this device. Sent when you're online.*). Offline, permission, signature and destructive wording is kept. |
| Permissions | `public.my_project_permissions` → `useProjectPermissions()`. A role does not get buttons it can only be refused. Fails open when unknown; the database stays the authority. |

## Fixed in this pass (summary)

Dialogs: one shared focus/keyboard contract; two shapes of dialog that ignored it.
Readability: 430 font-size rules raised to the 11 px floor.
Accessibility: shell buttons named by their visible text; unlabeled fields named; one `h1` per module; 24 px targets; focus ring on framed search fields; connection changes announced.
Features: connection chip / offline manager reachable on phones; overview quality count; fake overview plan removed; BOQ import only where deliveries live; Management → Project setup bilingual; notifications titled in the interface language.
Roles: client and contractor no longer see create, edit, upload or share controls they cannot use.
Copy: ≈ 330 explanatory sentences, card descriptions and repeated placeholders removed or reduced to the fact, in both languages.
Vocabulary: one queue vocabulary; Dutch default workforce disciplines.

## Regression

Run on the final commit of this pass, local stack from an empty database:

| Suite | Result |
| --- | --- |
| `supabase db reset`, `db lint --level error` | clean |
| pgTAP (`supabase test db`) | 17 files, 513 assertions, pass |
| Unit and source tests (`node --test tests/*.test.mjs`) | 129 / 129 |
| `eslint`, `tsc --noEmit` | 0 errors |
| Playwright on the production build (`CODECO_E2E_REQUIRED=1`, release-gate list incl. `dialogs` and `role-views`) | 89 passed, 40 skipped by project (each spec targets one viewport), 0 failed |
| Manual browser tours (Dutch and English; 1440, 820, 390) | as recorded in the matrix |

This pass added `tests/e2e/dialogs.spec.ts` (every dialog × 3 widths, nested dialogs, phone menu),
`tests/e2e/role-views.spec.ts` (client, contractor, supervisor) and
`supabase/tests/017_my_project_permissions.pgtap.sql`. Commands: `production-readiness.md` § 3.

## Historical client feedback — 10 October 2026 reconciliation

The eight red-annotated screenshots refer to an **older deployed build**, not the current
feature branch. Statuses below distinguish repository edits from runtime proof. The previous
browser-matrix results above describe the earlier UI-consistency pass, **not a new manual
browser check of this historical-feedback patch**.

| Screenshot | Client feedback (interpreted) | Current branch treatment | Verification still required |
| --- | --- | --- | --- |
| 1 — Workspace | Remove the redundant *Delays* shortcut | Removed only the workspace tile; daily delay records and the separate formal PDR remain accessible | Manual entry/navigation at desktop and phone, no loss of delay records |
| 2 — Controlled document lower section | Remove excessive impact fields and automatic-metadata helper text; clarify signing | TI schedule/cost impact is now collapsed as optional, and existing copy cleanup is retained. CO's contractual impact fields are still required by its workflow | Manual TI/CO comparison; formal report and signature UAT |
| 3 — Change Order upper section | Place title at top; do not repeat timestamps, revision, author or in-form type switching | Primary title/description moved before context; read-only timestamp inputs removed; initial revision hidden; author edit is inside its existing header; internal type switch hidden | CO create/edit, signing and PDF rendering |
| 4 — Active inspection | Signature absent, NCR choice and checklist controls unclear | Existing current-branch signature, draw-pin and NCR-from-inspection actions were verified **in source only** during this reconciliation; none duplicated | Full signed checklist → pinned drawing → linked NCR browser walkthrough |
| 5 — Technical Instruction | Title at top, remove duplicated author/revision and reduce unnecessary impact input | Title/description first, duplicate author moved into an optional header edit, initial revision hidden, TI impact collapsed; existing field values retained | TI draft/edit/export |
| 6 — Technical Instruction upper section | Automatic date/time, uniform building/location, no generic switch inside form | Header date retained once, deadline remains editable; existing RecordBuildingsField/LocationPicker reused; type switch hidden for internal controlled docs | Mobile layout and correct date on existing edited documents |
| 7 — Inspection start and filters | Uniform controls, exact location and automatically derived inspection dates | Existing BuildingPicker/LocationPicker and date-derived filter logic retained; earlier visual fixes unchanged | Interactive UI test with multiple buildings and inspection dates |
| 8 — Controlled document lower section | Distinguish issuer and recipient signatures; remove automatic-numbering helper | The existing CO has contractor and supervision signature fields; other document types have different authorized signing models. No speculative schema change made | Explicit document-type signature matrix and two-party recipient acknowledgement UAT |

### Changes in this follow-up

- Removed the redundant workspace delay tile; **did not remove** any delay-writing, PDR or reporting functionality.
- Reordered main controlled-document title and description ahead of context fields while preserving all state bindings.
- Replaced duplicated read-only date/time controls with a deadline control; system timestamp remains in the compact header.
- Kept revision at its canonical initial value on new documents; existing documents may still be edited.
- Moved optional internal author selection into the already displayed author header; received external submissions keep their genuine separate author field.
- Kept the type selector for general registers and third-party submissions, where it provides access to other formats; removed it from internal controlled-document editing.
- Preserved TI schedule/cost data behind an optional disclosure rather than discarding it.
- Added Playwright/source assertions for the field order, compact date layout and retained route access.

### Outstanding acceptance before declaring the feedback fully incorporated

1. Browser-test TI and CO creation and editing using realistic project data, including keyboard and phone-width behavior.
2. Verify the document's original timestamp remains unchanged when editing an older record. The stored report metadata path must be checked; do not assume the visible header alone proves this.
3. Confirm author attribution when editing an already signed document and prohibit changes that could invalidate existing signatures.
4. Reconcile which controlled document types require recipient acknowledgement, preserving contractor/supervision roles and avoiding impersonation.
5. Drive the active-inspection signature, drawing pin and NCR-link end to end with a private test Blob store.
6. Visually inspect PDF/Word exports for required fields and signatures.
7. Run CI on the final patch commit and update this section with concrete results.

**Status: code updates applied to the draft PR, historical feedback NOT YET fully browser-verified.**
