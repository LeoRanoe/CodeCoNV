# Redundancy and flow audit

Date: 2026-10-26 · Branch: `fix/daily-report-dedupe` (from `ui/deslop` at `3e8e58b`)

## The rule

The workspace tiles are the lifeline of the app and are not changed:
Photos, Works ongoing, Works completed, Workforce, Project Delay Report (PDR), Issues, HSE,
Materials delivery, Inspections, Technical instructions, Change order (CO), NCR,
Lessons Learned, HSE incident, Agreements Made.

Each tile owns its record. Any other screen may **show** that record or **link** to it, but it
must not ask for it a second time. Every tile opens the same kind of page: back to Workspace,
the module title, one "New" button, the form (`RecordFormShell`, numbered sections, save bar)
and the records list below it. No tile opens a pop-up.

## What changed

### 1. Works ongoing, Works completed and Workforce are pages, not pop-ups

| Before | After |
|---|---|
| Works ongoing / completed opened a list with its own "Record" button, which opened the day log as a pop-up. | A workspace page like PDR, HSE or Materials delivery: the day log form opens on the block the tile asked for (numbered 1), and the recorded days are listed below. The list uses the shared record list; "View" opens the shared record viewer, "Edit in form" opens the day log. |
| Workforce opened a pop-up straight from the tile. | A workspace page: today's count is the form, and every counted day (per building, with visitors and signature) is listed below. |
| The overview's "Daily questions" button opened a different form. | It is called "Day log" and opens the same day log page. |

### 2. Day report: one form, nothing asked twice

| Before | After |
|---|---|
| Two forms wrote the same day closeout: the day log and a four-step "daily questions" wizard. | The day log is the only form. The wizard and its route are gone. |
| The wizard asked again for materials delivered, agreements, variation work and a typed photo count. | Not asked. They belong to Materials delivery, Agreements Made, Change order and Photos. |
| The day log asked for QC and HSE in its own fields. | Those sections list what was recorded **today** in Inspections, Issues/NCR and HSE, with a link to that module. The report fields are filled from those records. |
| The day log counted the workforce again, and saving it **overwrote** the crew, notes and signature from the Workforce register (and copied one building's headcount to every building). | The day log shows the headcount and links to the Workforce page. It no longer writes attendance. |
| Without a confirmed project start the weather was empty and the database refused the day: "Save failed". | The form says "Confirm the project start first" before saving, with the button next to it. After confirming, the app returns to the day log instead of jumping to the Overview. |
| "Work completed today" could be required while folded away. | A required field is never folded. The list of missing items scrolls into view when Save is pressed. |
| The sketch pad only existed in a hidden field-record form. | It is in the day log's photo block. |

### 3. Draft (fail-safe) on every form that loses work

New device store `drafts` (IndexedDB v5, owned per account like unsent uploads). Drafts start
only after a real change, are put back when the form opens again ("Unsaved draft restored ·
Discard draft"), and are removed after a successful save or a discard.

| Form | Kept on the device |
|---|---|
| Day log | All fields, buildings, both signatures, photos and sketches |
| Workforce | Crew per building, visitors, explanation, signature |
| Photos (library) | Every photo waiting to be saved |
| Photo screen | The staged photo |

Checked in the browser: back button, reload, browser back/forward and leaving the page all
restore the draft. After saving, no draft remains.

### 4. Photos not being saved: causes and fixes

| Cause | Fix |
|---|---|
| **Camera hand-off dropped the photo.** The photo screen marked a camera photo as handled before a 0 ms timer staged it. Any re-render in between (the "Photo ready" message caused one) cancelled the timer, and the photo was gone. A second photo while that screen was open was ignored. | Marked as handled only once it is staged. Every new photo is staged. |
| **A second photo replaced the first.** The camera button sent each photo to a single-photo form. | The camera button and the Photos tile are now one flow: photos land in the photo library and wait side by side. |
| **"Unsupported" photos.** Some Android cameras report a JPEG as `image/jpg` or with no type. The Photos tile refused them, the photo screen called them "not a readable image", and the camera button dropped untyped files. | The bytes decide (`lib/images/normalize-image.ts`). A real JPEG, PNG or WebP is relabelled and saved. |
| **Cleared after a failed save.** The Photos tile cleared its pending photos even when storing them failed. | Photos stay on the form, with the reason, until they are stored. |
| **Only in memory.** Back, a reload or the phone dropping the tab behind the camera lost the photo. | Kept on the device (see 3). On opening the project: "2 photos you took are not saved yet · Back to the photos". |
| **Failed send made a saved photo look unsaved**, and a retry queued it twice. | Once queued, the save succeeds. Day-log photos already queued are skipped on retry. |

Checked in the browser: photos from a simulated camera with an empty type and with `image/jpg`
are queued as `image/jpeg`, survive a reload and are saved as one stack. The send to storage
cannot be checked locally: there is no Blob store on the local stack (see
`production-readiness.md`).

### 5. Duplicate ways in, removed

| Removed | Still reached through |
|---|---|
| Sidebar "Project Docs" | Workspace → Project Docs |
| Sidebar "Issues" | Workspace → Issues tile |
| Support strip "Reports" and "Submissions & management" | Sidebar / More: Reports, Management |
| Hidden quick-add sheet behind Action create → Back, and its "field record" form that filed works and delays as a loose registration never shown in the Works lists | Works pages, the day log, and each module's tile. Action create now has Cancel. |
| Report check: three rows for the same day log, two rows that were always green, an editable summary that was never saved | One "Day log" row and one per-building row, each with a button to fix it |
| Unreachable screens: the legacy overview and `SecondaryView` | n/a |

`codeco-supervision-app.tsx`: 5,063 → about 3,550 lines.

### 6. Consistency

- The selected building tab (Workforce) and the selected Works view use orange, the selection colour. Green is kept for record state.
- The focused day-log block no longer gets a green outline. It is simply section 1.
- No pop-up styling remains on the day log or the Workforce page.

## Tests

- `npm run lint`, `npm run test:design` (6/6), `npm run build` and the 13 source test files: green.
- Every source test that pinned a removed duplicate or pop-up now asserts the replacement. None was skipped.
- End-to-end specs were updated for the page forms and the removed nav entries: `day-report-lifecycle`, `dialogs`, `role-views`, `audit-sweep`, `viewport-walk`, `field-readiness`.
- Browser walk on the local stack at 1440, 820 and 390 px: day log, Works ongoing/completed, Workforce, drafts, overview "Day log", report check, camera, Photos library. No horizontal overflow.

## Still open

| # | Where | What | Owner |
|---|---|---|---|
| 1 | HSE and Issue forms | Use an older section markup (`record-section`) beside the shared `RecordFormSection`, so their section headings look slightly different. | Codex forms task (S4) |
| 2 | Project start | Still a dialog. It is not a workspace tile, so it was left as is. | Decide |
| 3 | Dead CSS | Styles of removed screens (`.questionnaire-*`, `.todo-*`, `.secondary-grid`, `.module-card*`, `.day-hero`, `.report-card`, `.progress-ring`, `.settings-row`, `.action-overview`, `.question-*`, `.quick-tile`, `.entry-*` except `.entry-resume-bar`). | CSS pass |
| 4 | Storage upload | Not testable locally without a Blob store; needs the preview environment. | Release check |

## Coordination with the UI de-slop (Codex)

`ui/deslop` was merged into `main` with this work. The Codex worktrees `D:\CodeCoNV-forms` and
`D:\CodeCoNV-media` still have uncommitted changes that overlap these files:
`daily-log-modal.tsx` (rewritten as a page form), `daily-work-register.tsx` (rewritten on
the shared list), `workforce-register.tsx`, `media-library-workspace.tsx` and
`visual-evidence-workspace.tsx`. Codex's changes there are button classes. Rebase them onto
the new `main` and re-apply the class changes by hand where a file was rewritten. In
`D:\CodeCoNV-forms` the working copy of `daily-log-modal.tsx` also has different line
endings: normalise them first.
