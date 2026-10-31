# Functional audit (2026-10-31)

Scope: the CODECO Supervisie web app on branch `claude/amazing-tesla-xx8xc7` (PR #11), checked against a local Supabase stack with seeded fixture accounts. Production, the production Supabase project and the production Blob store were not touched. Headless Chromium at phone (390x844), tablet (820x1180) and desktop (1280x800).

Where a finding is fixed, the fix is in the working tree of this branch and the check that covers it is named. Where it is not, it says why.

## What was exercised

| Area | How | Result |
|---|---|---|
| Sign-in, project list, project switch | Playwright and manual walk, all fixture roles (supervisor A and B, client, contractor) | Works. |
| Day report: project start, works ongoing, completed, delays, close-out, submit for review | `day-report-lifecycle.spec.ts`, `works-ongoing-one-field.spec.ts`, manual | Works. Works ongoing changed, see F-01. |
| Issues, NCR, contractor response link, HSE, inspections, checklists | Manual walks per table A to D in `CLIENT-FEEDBACK-RECONCILIATION.md`, `inspection-workflow.spec.ts` | Works. Defects below. |
| Registers: materials delivery, TI, CO, agreements, PDR, lessons learned | Manual, `controlled-document.spec.ts`, `two-party-signature.spec.ts` | Works. Defects below. |
| Offline queue and account isolation | `offline-app`, `offline-create-and-sync`, `offline-records`, `offline-account-isolation` specs | See `PRODUCTION-READINESS-2026-10-31.md` for the run. |
| Tenant isolation in the database | pgTAP suites 001 to 025 (607 assertions, all pass) | Pass. |
| Layout at three widths | `ui-stability-audit.spec.ts`, `responsive-*`, `viewport-walk`, `layout-hygiene` | See `PRODUCTION-READINESS-2026-10-31.md`. |
| Photo, 360 and drawing upload | The plain local stack has no Blob token (`/api/storage/uploads` answers 503), so the whole suite was run again on the fake-Blob stack (`CODECO_E2E_FAKE_BLOB=1`): 149 passed, 1 failed (a weather rate limit, passes alone), 144 skipped by design. | Verified on the fake store; not on the real Vercel Blob. |

## Findings

Severity: High = blocks an instruction of the client or loses data. Medium = wrong or misleading output. Low = cosmetic or environment.

| ID | Severity | Finding | Status |
|---|---|---|---|
| F-01 | High | "Works ongoing" opened the whole ten-section day log and refused to save without project start, work completed and plan for tomorrow. The client asked on 30-10 for one input box plus the buildings. | Fixed: one section (box plus building ticks), save needs only the text and at least one building; migration `202610300001` relaxes the close-out column limits; pgTAP 025 (7 tests) and `works-ongoing-one-field.spec.ts`. |
| F-02 | High | A focused save (Works ongoing with several buildings ticked) rewrote every column of each building's close-out, overwriting answers saved earlier for the same day. | Fixed: `saveDailyCloseout` takes `onlyColumns` and updates only `day_summary` and `work_ongoing` for that form. |
| F-03 | High | Materials delivery lost its quantity lines when opened in View or Edit (`editRegister` never restored `registerLines`). | Fixed in `operational-workspace.tsx`. |
| F-04 | Medium | A photo staged in one register form showed as "1 photos ready" in the others and would be filed against the wrong record. | Fixed. |
| F-05 | Medium | Visual evidence said "Photo uploaded." although the upload returned 503. | Fixed: the message says the photo stayed on the device unless the upload succeeded. The photo flows pass on the fake-Blob stack. |
| F-06 | Medium | Change order record card showed only the description. | Fixed: type, reason, scope, schedule, cost and contractor signature status. |
| F-07 | Medium | Issue cards printed a stored type that the form no longer asks for; a completed agreement kept the badge OPEN. | Fixed. |
| F-08 | Medium | Adding a building with a duplicate code showed no error. | Fixed. |
| F-09 | Medium | "HSE incident" tile opened the plain HSE form without preselecting Incident. | Fixed. |
| F-10 | Medium | Photo thumbnails and the markup preview were blank in `next dev` because React's development double-mount revoked the memoised blob URL. Production builds do not double-mount. | Fixed in `photo-evidence.tsx` and `photo-markup.tsx` (URL created inside the effect). The photo flows pass on the fake-Blob stack (production build). |
| F-11 | Medium | Palette on PR #11 (warm with sage) contradicted the client's 30-10 13:05 decision to keep the first version. | Fixed: first-version palette restored, other PR #11 fixes kept. |
| F-12 | Medium | TI and CO "Send to contractor" opens WhatsApp with a text summary and no response link, unlike NCR. | Open. New behaviour, not a bug; needs a client decision. |
| F-13 | Medium | Rapid Verify compared by percentage of matching words with no verdict; it did not flag 12 mm against 13 mm. | Fixed: figures with units and colour words are compared one by one and listed as matches, differs or not found; the page still says a person decides. `lib/rapid-verify/compare-values.mjs`, unit test `rapid-verify-compare.test.mjs`, e2e `rapid-verify-values.spec.ts`. |
| F-14 | Medium | Punch list had no "return for correction" action. | Fixed: an issue that is ready for verification can be sent back with a reason (5+ characters) by anyone allowed to verify; it becomes Reopened. No migration (the database already allowed it). e2e `issue-return-for-correction.spec.ts`. |
| F-15 | Low | Inspection signature has no Position field. | Not done on purpose: the client only wrote "naam etc."; Position was an inference. Ask before adding a column. |
| F-16 | Medium | Drawing pins were not coloured per record type and the toolbar still had a free colour picker (client asked to remove it, 04-08). | Fixed: pins, the list dots and the legend take the record type's colour (tokens `--pin-*`); the picker is removed and markup is drawn in red. The drawing flows pass on the fake-Blob stack; the colours themselves were not inspected by eye. |
| F-17 | Medium | "Works completed" and "Delays" still open the full day log. | Open. The client decided only Works ongoing. |
| F-18 | Low | Count badges were missing on the PDR, TI, CO and Lessons Learned tiles. | Fixed. |
| F-19 | Low | Mixed languages in the English interface: auto-created finding titles and some notification titles are Dutch; the external share page is Dutch by design (`DocumentLanguage fixed="nl"`); building descriptions written by the project wizard ("Projectgebouw") are Dutch. | Open, accepted. The share page is intentional. The rest are stored defaults written by the database; changing them needs a data change and is not worth a migration. |
| F-20 | Low | The Responsible-person dropdown in the Issue form looked empty on the demo project. | No defect: with no assignable members the form shows a free-text name field instead, by design. The demo project simply has none. |
| F-21 | Low | Rapid Verify index is lost on refresh. | Open. |
| F-22 | Low | Activity chips in the daily log appended every tap, so repeated taps duplicated the words. | Fixed: a chip whose words are already in the box is not added again. |
| F-23 | Low | A Dutch toast ("Uploaden is nu niet beschikbaar...") appeared on the English interface when an upload failed. | Open, accepted. The text comes from the storage API, which does not know the language, and only appears when no Blob token exists (not in production). |
| F-24 | Low | PDF export logs a Content-Security-Policy console error for the `data:` download although the PDF is produced. | Open. Not user-visible. |
| F-25 | Info | Local stack only: 503 from `/api/backups/ensure-daily`, `/api/storage/uploads`, `/api/maps/static`; 429 from `/api/weather/current` when several sessions share one instance. Not product defects. | Not applicable in production, where the Blob token and map keys exist. Confirm after deployment. |
| F-26 | Info | Supervisor A sees "Other Organisation Project" in the list. That is the seed (supervisor A is also a member of the second organisation's project), not a leak. Supervisor B, client and contractor were confirmed unable to read project A in pgTAP and the isolation spec. | No action. |
| F-27 | Info | Workforce confirm asks for an explanation when the headcount differs from the expected number set at project start. | By design; the message is clear once reached. |
| F-29 | Info | In the 14-minute full run `first-load.spec.ts` once saw a 429 from `/api/weather/current` (the route's rate limit; all requests come from one local address). It passes alone. | Environment. If it shows up in CI, give the spec its own address or raise the limit for tests. |
| F-28 | Unconfirmed | Twice, while ticking checklist answers, the screen fell back to the Overview. Not reproduced in a third run; other sessions were writing to the same instance at the time. | Open; watch on a single-user run. |

## Not checked

- The real Vercel Blob store: photo, 360, drawing and PDF flows ran against the fake store only.
- WhatsApp hand-off beyond confirming the link opens with the intended text.
- Production data and production configuration. This pass never read or used the production environment file.
- Real devices. Headless Chromium with emulated viewports only.
