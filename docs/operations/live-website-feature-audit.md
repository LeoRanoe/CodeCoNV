# Live website feature audit

Companion to `live-qa-bug-register.md`. Every cell says what was actually done; "—" means not
done, and a blank claim is never implied. Source for the inventory: the signed-in application
(sidebar, workspace tiles, Management tabs, header controls) compared with
`apps/web/app/*.tsx`.

## Environments and evidence classes

| Tag | Meaning |
| --- | --- |
| **PROD-read** | Operated in the user's own signed-in Chrome on `https://code-co-nv.vercel.app` (commit `1fe8f1c`, role *CODECO Administrator*), reading only. No record was created, edited, signed, sent or deleted. |
| **LOCAL-ui** | Operated by hand in a browser against the local Supabase stack (fixture and audit accounts). State-changing steps were done here only. |
| **SWEEP** | `tests/e2e/audit-sweep.spec.ts`: 8 modules + 22 workspace tiles at 1440, 1280, 820, 390 and 360 px on a production build; records runtime errors, failed requests, sideways scroll, unnamed controls, controls < 24 px, images without alt, duplicate ids, text < 11 px, `h1` count; one screenshot per screen. 150 screens reached. |
| **SPEC** | An automated Playwright or pgTAP test that drives or asserts the behaviour (see the traceability list at the end). |
| **SRC** | Source read only. Not evidence that it works. |

## What was and was not done on production

The signed-in project is *First construction project* (`COD-2026-001`). It contains photos named
`TEST 360 — DELETE ME`, `Test phase 3` and a placeholder inspection titled "Yes", so it is test or
demo data, but nothing was written to it. Production writes were not made because the audit
brief protects customer records and because the previews/branches of this repository are blocked
or share the production database (`production-readiness.md`, blockers 2 and 4).

## Inventory and status

Legend for status: **verified** (operated, result as expected), **defect** (a defect was found,
see register), **partial**, **not tested**.

### Shell and navigation

| Feature | Entry | Role | PROD-read | LOCAL-ui / SPEC | SWEEP 5 widths | Notes | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Session restore, reload | `/supervisie` | any | restored; project list loads | session-revoked SPEC (2 tests) | – | LQA-014 found and fixed | defect → fixed |
| Project list / card counts | My projects | any | 6 issues, 1 NCR, 7 inspections, "0 open actions" | LOCAL "134 open actions" after fix | – | LQA-001 | defect → fixed |
| Project switching, Back/Forward | breadcrumb, browser | any | deep link `?project=…&nav=…&tab=…` restores the screen | `viewport-walk` SPEC uses the same links | modules reachable at all widths | `nav=punchlist` without `tab` shows the grid (LQA-012) | partial |
| Language switch | header | any | – | e2e specs set `en` | – | – | not tested by hand |
| Offline manager / storage state | header icon | any | opens | `offline-*` SPECs | 32×32 target | – | partial |
| Notifications bell | header | any | – | – | – | – | not tested |
| Help guide | floating button | any | – | – | – | – | not tested |
| Take photo | sidebar / bottom bar | writer | – | needs camera | – | – | not tested |
| Sign-out | header | any | not used (would end the session) | sign-in SPECs | – | – | not tested on prod |
| Mobile bottom navigation | ≤ 820 px | any | window cannot be narrower than ~500 px; not tested on prod | LOCAL 390/820 | 5 items + More drawer | – | verified locally |

### Overview

| Feature | Entry | PROD-read | LOCAL / SPEC | SWEEP | Status |
| --- | --- | --- | --- | --- | --- |
| KPI cards (follow-up, quality, inspections, pictures) | Overview | read: 0 / 7 / **0** / **0** while records exist | LQA-001 fix; `overview-counts.spec.ts` | no overflow | defect → fixed |
| Priority queue / "Under control" | Overview | "Under control" with 7 overdue issues | fixed | – | defect → fixed |
| Today on site, weather register | Overview | "No work recorded", weather 28 °C | – | – | partial |
| Search today | Overview | – | – | – | not tested |
| Visual evidence strip | Overview | 4 thumbnails render | – | – | verified (read) |

### Workspace tiles

| Tile | PROD-read | LOCAL-ui / SPEC | Notes | Status |
| --- | --- | --- | --- | --- |
| Photos (20) | count only | – | upload/markup need Blob | not tested |
| Works ongoing / completed / Workforce | – | `day-report-lifecycle` SPEC | totals: SRC only (sums per building and per day) | partial |
| Project Delay Report | – | `day-report-lifecycle` SPEC (two-building day) | – | partial |
| Issues (6) | form opens, nothing saved | LOCAL: 124 issues listed after LQA-002 fix | LQA-002 | defect → fixed |
| HSE (1), HSE incident | – | `role-views`, SWEEP only | – | not operated |
| Materials delivery (0) | – | LOCAL: layout defect found (LQA-007) | save not driven | defect → fixed (retest pending) |
| Inspections (7) | list of 7 read; "Withdraw", "Fill in checklist" not used | `inspection-workflow.spec.ts` | placeholder titles in the data | verified (read) |
| Technical instructions | – | LOCAL: created, deadline end-of-day Suriname; LQA-005/006 | `two-party-signature` SPEC | defect → fixed |
| Change order (CO) | – | `two-party-signature` SPEC | – | partial |
| NCR (1) | – | LOCAL: full lifecycle except PDF; LQA-003/004 | pgTAP 013, 015, 020 | defect → fixed |
| Lessons Learned, Agreements Made (0) | – | SWEEP only | – | not operated |
| Supporting tools: Rapid Verify, Project Docs, Assets & folders, Drawings & pins, Deadlines (7), Reports, Submissions & management | Rapid Verify, Project Docs, Reports open | SWEEP: all reachable | upload / drawing pins / search not operated | partial |

### Issues → NCR → contractor → verification (Phase 7, local)

| Step | Result | Evidence |
| --- | --- | --- |
| Create / assign | seeded NCR `Q-2026-0003`, status assigned | LOCAL |
| Send link, contractor opens it | Dutch page, three tabs | LOCAL |
| Contractor proposes correction with name, position, drawn signature | stored, status in progress | LOCAL; first submit sends one request for two clicks |
| Contractor reports ready | status ready for verification | LOCAL |
| Contractor attempts `closed` / `verified` through the API | 400, refused | LOCAL |
| Invalid / short token | 404 | LOCAL |
| Contractor rewrites signed proposal after "ready" | **accepted, signature lost** | LQA-003 → fixed, pgTAP 020 |
| Role without `findings.verify` offered the close form | **offered, refusal misworded** | LQA-004 → fixed |
| CODECO verify and close with signature | not completed with a verifier account (the audit user had no right); covered by `inspection`/pgTAP 013, 015 | SPEC |
| NCR PDF content, signer attribution | not opened | SRC + pgTAP only |
| Expired link, revoked link | revoked: pgTAP 015; expired: SRC | SPEC |
| Wrong project / wrong building | pgTAP isolation suites | SPEC |

### Reports, Project Docs, Rapid Verify, Management

| Feature | PROD-read | Other | Status |
| --- | --- | --- | --- |
| Reports landing (Daily/Weekly/Monthly, Create, Review & sign, Versions, Beyond this app) | opens, section checklist visible | `day-report-lifecycle` SPEC downloads PDF + Word | partial |
| Project Docs (24 items, folders, filters, upload box) | opens, list renders | two visible `h1` (LQA-011) | partial |
| Rapid Verify | opens; "0 indexed pages"; PDF indexing and Q&A not run | – | not tested |
| Management overview (7 inspections recorded, 3 high-risk findings) | reads consistent with the workspace | – | verified (read) |
| Management → Backup & continuity | **83 backups, daily and verified through 10 Oct 04:10, monthly restore tests passed (22 Sep, 24 Aug, 26 Jul)** | – | verified (read) |
| Management → Team & rules, Project setup, Quality standards | not opened | `role-views` SPEC | not tested |
| User administration, invitations, project configuration | not opened (would touch real access) | – | not tested |

### Media, drawings, niche tools

| Feature | PROD-read | Notes | Status |
| --- | --- | --- | --- |
| 360° viewer | opens a CC0 equirectangular test image; drag rotates (0° → 334°), compass and zoom label follow | marker placement, upload, fullscreen not exercised | verified (read) |
| Photo library, markup, drawings and pins | – | need a Blob store; the local stack has none | **blocked** |
| Rapid Verify search, field calculator, GPS, sketch pad, prompt library, dictation, CSV/BOQ import, push, PWA | – | not operated | not tested |

### Responsive, accessibility, performance (SWEEP + LOCAL)

| Check | Result |
| --- | --- |
| Horizontal overflow, 8 modules + 22 tiles × 5 widths | **none** (150 screens). One module-level overflow found by hand at 1024 px (delivery line, LQA-007) was outside the sweep widths |
| Unnamed buttons, links, inputs | none (hidden file inputs excluded) |
| Images without `alt` | none |
| Duplicate ids | none |
| Text under 11 px | none |
| Controls under 24 px | none |
| Controls 24–35 px high at ≤ 820 px | yes: weather chip 35, storage icon 32, filter chips and supporting-tool buttons 34, tab chips on Actions 34, three text links 24 (tablet) — LQA-015, left as the approved design |
| `h1` count | Project Docs renders two (LQA-011) |
| API errors | `/api/maps/static` and `/api/backups/ensure-daily` answer 503 locally (no map key, no backup store); on production `ensure-daily` answers 200 (resource timing) |
| Initial load | not measured with a tool; see the performance note in the release verification file |
| Keyboard, focus trap, screen reader | dialogs: `dialogs.spec.ts`; **no real screen reader was used** |

## Not tested, and why

- Anything that writes on production (by design).
- Photo upload and markup, 360° markers, drawing upload, pins, DWG: need a private Blob store.
- Real phone, real touch, real signature on glass; pinch zoom; device offline on a site connection.
- Screen readers; reduced-motion; high-contrast.
- Mutating admin flows (users, roles, invitations) even locally.
- Rapid Verify indexing, field calculator, GPS, dictation, BOQ/CSV import, push, PWA install.
- Expired-session timing (only the refused-session path was driven).

## Automated tests that cover rows above

`overview-counts`, `double-submit`, `session-revoked` (new, this audit); `day-report-lifecycle`,
`inspection-workflow`, `controlled-document`, `two-party-signature`, `role-views`, `dialogs`,
`viewport-walk`, `offline-*`, `field-readiness`, `layout-hygiene` (existing release gate);
pgTAP 001–020.
