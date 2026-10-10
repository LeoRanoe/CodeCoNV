# UI consistency matrix — CODECO Supervisie

What was looked at in the running application, module by module, and what it showed. Updated
10 October 2026 on branch `fix/supervisie-production-readiness`.

How to read it. A cell is only marked when the thing was opened in a real browser (Chrome, the
local stack with fixture data) and looked at, in Dutch and in English unless noted. Nothing is
marked from reading source.

| Mark | Meaning |
| --- | --- |
| ✔ | Opened and inspected; no defect left |
| ✔* | Inspected; a defect was found and fixed in this pass (see *Fixed*) |
| ◐ | Inspected in part (state or width named) |
| ⛔ | Not inspected; reason given (needs a private Blob store, a real device, or data the fixture does not have) |
| – | The state does not exist for this module |

Widths. Desktop 1440, tablet 820, phone 390 (the phone also walked at 360 and 430). Zoom 125 % and
150 % are the 1024 and 853 px layouts, walked by `viewport-walk.spec.ts`. Roles: supervisor (organization
administrator), client (read-only owner representative) and contractor (account) were all signed in
and looked at; the external recipient page was opened with an invalid link only (§ *Not verifiable here*).

Evidence. Interactive tours drove every module at the three widths, clicking the real controls (tile
→ list → *New* → form, tabs, every dialog), and ran a DOM audit on each screen: unnamed controls,
raw stored codes, mixed-language text, click-target sizes, heading order, horizontal overflow, text
size. Screenshots were read by eye. The automated parts are now regression tests (§ *Regression*).

## Matrix

| Module | Desktop | Tablet | Mobile | Empty | Loading | Error | Success | Form | Detail | Modal | Permissions | Offline | Issues found | Fixed | Verified |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Authentication | ✔ | ✔ | ✔ | – | ✔ | ✔ | – | ✔ | – | – | – | ◐ | Helper sentence under the title | ✔ | sign-in, wrong password, loading steps |
| Main application shell | ✔* | ✔* | ✔* | – | ✔ | – | ✔ | – | – | – | ✔* | ✔* | 5 buttons whose name did not contain their visible text; no live announcement of connection; connection chip hidden on phones (offline manager unreachable); photo button shown to read-only roles | ✔ | `dialogs.spec`, `role-views.spec`, tours |
| Workspace / home | ✔* | ✔ | ✔ | ✔ | – | – | – | – | – | – | ✔* | – | Two stacked headers with a marketing sentence; a description under every tile; tiles for modules a role cannot read | ✔ | tours, `role-views.spec` |
| Project selection | ✔* | ✔ | ✔ | – | ✔ | – | – | – | – | – | – | – | Conversational headline ("Where will you work today?"); "1 gebouwen" | ✔ | tours |
| Project overview | ✔* | ✔ | ✔ | ✔ | ✔ | – | – | – | – | – | ✔* | – | Quality count ignored real findings and NCRs; decorative fake plan with "Open linked drawing"; 3 detail lines that said nothing | ✔ | tours with demo data |
| Building selection | ✔ | ✔ | ✔ | – | – | – | – | ✔ | – | ✔ | – | – | – | – | `dialogs.spec` |
| Project configuration (Management → Team & rules, Project setup) | ✔* | ✔ | ✔ | – | – | – | – | ◐ | – | – | ✔ | – | Project setup tab was hard-coded Dutch with raw codes (`zone`, `contractor`) | ✔ | tours EN + NL |
| Team / member management | ✔ | ✔ | ✔ | ✔ | ✔ | ◐ | – | ✔ | – | ✔ | ✔ | – | – | – | `dialogs.spec` (open, trap, close); invitation not sent |
| Role / access management | ◐ | ◐ | ◐ | – | – | – | – | ◐ | – | ✔ | ✔ | – | Role editor opened, not driven | – | tours |
| Management | ✔* | ✔* | ✔* | ✔ | – | – | – | – | – | – | ✔ | – | Card descriptions; 3 KPI sub-lines; tab bar clipped on phone (scrolls inside itself, no page overflow) | ✔ | tours, walk |
| Day start (project start) | ◐ | ◐ | ◐ | – | ✔ | – | – | ✔* | – | ✔ | ✔ | – | "Visible automation" panel (always-on rules, rule IDs); only offered once per day | ✔ | dialog opened on a fresh day; automation panel shows only real warnings |
| Workforce | ✔* | ✔ | ✔ | ✔ | – | – | – | ✔ | – | ✔ | ✔* | ◐ | English default disciplines in a Dutch screen; edit controls shown to roles that cannot count | ✔ | `dialogs.spec`, `role-views.spec`; migration for the default |
| Attendance (visitors, headcount, deviation note) | ✔ | ✔ | ✔ | ✔ | – | – | – | ✔ | – | ✔ | ✔ | – | – | – | tours |
| Works ongoing / completed | ✔ | ✔ | ✔ | ✔ | – | – | – | – | – | – | – | – | – | – | tours |
| Delay / Delay report (PDR) | ✔* | ✔ | ✔ | ✔ | – | – | – | ✔* | – | – | ✔ | – | Section descriptions on every block | ✔ | tours |
| Daily closeout (daily questions) | ✔* | ✔ | ✔ | – | – | – | – | ✔* | – | ✔ | ✔* | – | Helper under each label; "client sections · reused across modules" subtitle | ✔ | `dialogs.spec` |
| Inspections | ✔ | ✔ | ✔ | ✔ | – | – | – | ✔ | – | – | ✔ | – | – | – | tours |
| Checklists (library, install) | ✔* | ✔ | ✔ | ✔ | – | – | – | – | – | – | ✔ | – | Raw module code on each card; descriptions repeated "CODECO basiscontrole…" | ✔ | tours |
| Findings / Issues | ✔* | ✔ | ✔ | ✔ | – | – | – | ✔* | ✔ | ✔ | ✔* | ◐ | Heading hierarchy; unlabeled textareas; helper paragraph; write buttons shown to read-only roles | ✔ | tours, `role-views.spec` |
| NCR | ✔* | ✔ | ✔ | ✔ | – | – | – | ✔ | ✔ | – | ✔* | ◐ | Same as Issues | ✔ | tours |
| HSE / HSE incident | ✔ | ✔ | ✔ | ✔ | – | – | – | ✔ | – | – | ✔ | – | – | – | tours |
| Actions | ✔* | ✔ | ✔ | ✔ | – | – | – | ✔ | ✔ | ✔ | ✔* | – | Row kicker was the raw code `ACTION`; subtitle per view | ✔ | tours, dialog |
| Action center | ✔* | ✔ | ✔ | ✔ | – | – | – | – | – | – | ✔* | – | "New action" for roles without `actions.create` | ✔ | `role-views.spec` |
| Registers (materials delivery, agreements, lessons learned, TI, CO) | ✔* | ✔ | ✔ | ✔ | – | – | – | ✔* | – | – | ✔ | ◐ | Bill-of-quantities import and a "not created here" banner on every register page | ✔ | tours |
| RFI / RFA / WCR | ◐ | ◐ | ◐ | ✔ | – | – | – | ✔ | ◐ | – | ✔ | – | Opened through *Record external submission* (fixed in the previous pass); no submission was recorded | – | tour |
| Inspection request (WIR) | ◐ | ◐ | ◐ | ✔ | – | – | – | ◐ | – | – | ✔ | – | As RFI | – | tour |
| Technical instruction | ✔ | ✔ | ✔ | ✔ | – | – | – | ✔ | – | – | ✔ | – | – | – | tours |
| Controlled document response | ◐ | ◐ | ◐ | – | – | – | ◐ | ◐ | ◐ | – | ✔ | – | Driven end to end by `controlled-document.spec`; not re-inspected visually | – | e2e |
| Drawings | ✔ | ✔ | ✔ | ✔ | – | – | – | ◐ | ⛔ | – | ✔ | – | Empty state only; a drawing needs a private Blob store | – | tours |
| Drawing locations / pins | ⛔ | ⛔ | ⛔ | ✔ | – | – | – | ⛔ | ⛔ | ⛔ | – | ⛔ | Need an uploaded drawing | – | – |
| Photos / Photo stack / Photo detail / Markup / 360° viewer / Visual annotations | ⛔ | ⛔ | ⛔ | ✔ | – | – | – | ⛔ | ⛔ | ⛔ | ✔ | ⛔ | The library opens and shows its empty state and upload choices; anything with an image needs a private Blob store | – | – |
| Files / Documents (Project Docs) | ✔* | ✔ | ✔ | ✔ | – | – | – | ✔ | ⛔ | ⛔ | ✔* | – | Heading hierarchy (h1 → h3); filter fields in three different sizes; upload shown to read-only roles | ✔ | tours, `role-views.spec` |
| External share creation | ◐ | ◐ | ◐ | – | – | – | – | – | – | – | ✔* | – | Button shown to read-only roles (the database also allows it — flagged) | UI ✔ | `role-views.spec` |
| External share recipient UI | ◐ | – | ◐ | – | – | ✔ | – | ◐ | ◐ | – | – | – | Unavailable-link page inspected; filler line removed | ✔ | invalid link |
| Notifications | ✔* | ✔ | ✔ | ✔ | ✔ | – | – | – | – | ✔ | ✔ | – | Titles written in Dutch by the database in an English screen | ✔ | `dialogs.spec`, tours |
| Reports | ✔* | ✔ | ✔ | ✔ | – | – | – | ✔ | ✔ | – | ✔ | – | Four card subtitles, a paragraph, an explanatory paragraph per step | ✔ | tours, `day-report-lifecycle.spec` |
| Report review / Signatures | ✔ | ✔ | ✔ | – | – | – | ✔ | ✔ | ✔ | ✔ | ✔ | – | Signature dialog opened and trapped at three widths | – | `dialogs.spec`, `day-report-lifecycle.spec` |
| PDF / DOCX actions | ◐ | ◐ | ◐ | – | – | – | ✔ | – | – | – | ✔ | – | Buttons present on every report; output verified in the previous pass | – | e2e |
| Offline manager | ✔* | ✔* | ✔* | ✔ | – | ◐ | ✔ | – | – | ✔ | ✔ | ✔ | Unreachable on phones; "Sync now" vs "Send now" vs "waiting" | ✔ | `dialogs.spec`, offline specs |
| Offline outbox | ◐ | ◐ | ◐ | ✔ | – | ◐ | ✔ | – | – | – | – | ✔ | One vocabulary: *waiting to be sent / Send now / sent* | ✔ | offline specs |
| Settings / configuration screens | ✔ | ✔ | ✔ | – | – | – | – | ◐ | – | – | ✔ | – | – | – | tours |
| Every modal / sheet | ✔* | ✔* | ✔* | – | – | – | – | – | – | ✔ | – | – | No focus trap outside the app-level dialogs; field guide and phone menu used their own radius, title size and close size | ✔ | `dialogs.spec` ×33 |

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

See `production-readiness.md` § 3 for the commands. This pass added `tests/e2e/dialogs.spec.ts` (every dialog × 3 widths,
nested dialogs, phone menu) and `tests/e2e/role-views.spec.ts` (client, contractor, supervisor), and
`supabase/tests/017_my_project_permissions.pgtap.sql`.
