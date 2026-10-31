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
| Photo, 360 and drawing upload | Not possible on the plain local stack (no Blob token, `/api/storage/uploads` answers 503). Code read only; fake-Blob stack exists (`npm run dev:blob`). | CODE_ONLY. |

## Findings

Severity: High = blocks an instruction of the client or loses data. Medium = wrong or misleading output. Low = cosmetic or environment.

| ID | Severity | Finding | Status |
|---|---|---|---|
| F-01 | High | "Works ongoing" opened the whole ten-section day log and refused to save without project start, work completed and plan for tomorrow. The client asked on 30-10 for one input box plus the buildings. | Fixed: one section (box plus building ticks), save needs only the text and at least one building; migration `202610300001` relaxes the close-out column limits; pgTAP 025 (7 tests) and `works-ongoing-one-field.spec.ts`. |
| F-02 | High | A focused save (Works ongoing with several buildings ticked) rewrote every column of each building's close-out, overwriting answers saved earlier for the same day. | Fixed: `saveDailyCloseout` takes `onlyColumns` and updates only `day_summary` and `work_ongoing` for that form. |
| F-03 | High | Materials delivery lost its quantity lines when opened in View or Edit (`editRegister` never restored `registerLines`). | Fixed in `operational-workspace.tsx`. |
| F-04 | Medium | A photo staged in one register form showed as "1 photos ready" in the others and would be filed against the wrong record. | Fixed. |
| F-05 | Medium | Visual evidence said "Photo uploaded." although the upload returned 503. | Fixed: the message says the photo stayed on the device unless the upload succeeded. Code and type check only; needs the fake-Blob stack to see. |
| F-06 | Medium | Change order record card showed only the description. | Fixed: type, reason, scope, schedule, cost and contractor signature status. |
| F-07 | Medium | Issue cards printed a stored type that the form no longer asks for; a completed agreement kept the badge OPEN. | Fixed. |
| F-08 | Medium | Adding a building with a duplicate code showed no error. | Fixed. |
| F-09 | Medium | "HSE incident" tile opened the plain HSE form without preselecting Incident. | Fixed. |
| F-10 | Medium | Photo thumbnails and the markup preview were blank in `next dev` because React's development double-mount revoked the memoised blob URL. Production builds do not double-mount. | Fixed in `photo-evidence.tsx` and `photo-markup.tsx` (URL created inside the effect). Not exercised in a browser; tsc and eslint clean. |
| F-11 | Medium | Palette on PR #11 (warm with sage) contradicted the client's 30-10 13:05 decision to keep the first version. | Fixed: first-version palette restored, other PR #11 fixes kept. |
| F-12 | Medium | TI and CO "Send to contractor" opens WhatsApp with a text summary and no response link, unlike NCR. | Open. New behaviour, not a bug; needs a client decision. |
| F-13 | Medium | Rapid Verify compares by percentage of matching words with no verdict; it does not flag 12 mm against 13 mm. | Open. New feature; needs a client decision. |
| F-14 | Medium | Punch list has no "return for correction" action. | Open. Client decision. |
| F-15 | Medium | Inspection signature has no Position field; the inspections table has no column for it. | Open. Needs a migration. |
| F-16 | Medium | Drawing pins are not coloured per record type and the toolbar still has a free colour picker (client asked to remove it, 04-08). | Open. Needs the fake-Blob stack to verify. |
| F-17 | Medium | "Works completed" and "Delays" still open the full day log. | Open. The client decided only Works ongoing. |
| F-18 | Low | Count badges were missing on the PDR, TI, CO and Lessons Learned tiles. | Fixed. |
| F-19 | Low | Mixed languages in the English interface: auto-created finding titles and some notification titles are Dutch; the external share page is Dutch by design (`DocumentLanguage fixed="nl"`); project wizard building descriptions are Dutch. | Open. The share page is intentional; the rest is minor. |
| F-20 | Low | Responsible-person dropdown in the Issue form is empty for the seeded project (only free text works). | Open. Probably seed data (no members with a person record); not confirmed. |
| F-21 | Low | Rapid Verify index is lost on refresh. | Open. |
| F-22 | Low | Activity chips in Works ongoing append every tap (no toggle). | Open. Moot where Works ongoing is now one box; remains in the full log. |
| F-23 | Low | A Dutch toast appeared on the English interface when an upload failed. | Open. |
| F-24 | Low | PDF export logs a Content-Security-Policy console error for the `data:` download although the PDF is produced. | Open. Not user-visible. |
| F-25 | Info | Local stack only: 503 from `/api/backups/ensure-daily`, `/api/storage/uploads`, `/api/maps/static`; 429 from `/api/weather/current` when several sessions share one instance. Not product defects. | Not applicable in production, where the Blob token and map keys exist. Confirm after deployment. |
| F-26 | Info | Supervisor A sees "Other Organisation Project" in the list. That is the seed (supervisor A is also a member of the second organisation's project), not a leak. Supervisor B, client and contractor were confirmed unable to read project A in pgTAP and the isolation spec. | No action. |
| F-27 | Info | Workforce confirm asks for an explanation when the headcount differs from the expected number set at project start. | By design; the message is clear once reached. |
| F-28 | Unconfirmed | Twice, while ticking checklist answers, the screen fell back to the Overview. Not reproduced in a third run; other sessions were writing to the same instance at the time. | Open; watch on a single-user run. |

## Not checked

- Anything that needs a real Blob store: photo capture and upload, 360 viewer images, drawings, PDF attachments, daily backups.
- WhatsApp hand-off beyond confirming the link opens with the intended text.
- Production data and production configuration. This pass never read or used the production environment file.
- Real devices. Headless Chromium with emulated viewports only.
