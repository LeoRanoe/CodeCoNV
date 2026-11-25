# CODECO independent release-candidate audit

22 November 2026, Paramaribo. Audited commit `c255cc54ca8c61c3c0381a9fd7b1e575f6cca1a5` on `codex/codeco-launch-readiness`, draft PR 29. Treat this as an independent check alongside the existing UAT. App code, the shared UAT results, and release state were left untouched.

## Release findings

| Priority | Client requirement and current behavior | Acceptance evidence needed |
|---|---|---|
| High | **Workforce counts crew who are absent as on site.** Image 1 labels the total “On site today.” Excel Shared Dropdown Lists row 8 defines the attendance statuses. The form stores attendance, but its building totals add all counts and the party and trade summaries filter only by crew versus visitor. A direct check with 2 Present and 3 Absent returned 5 on site and 5 in the party summary. This also affects deviation comparisons. `XL-16-008` verified the dropdown options only. See `apps/web/app/workforce-register.tsx:60,199,387` and `apps/web/lib/forms/workforce.mjs:29`. | Save and reload mixed attendance across two buildings. Exclude Absent, On Leave, Off Shift and Demobilized from on-site totals, verify party and trade breakdowns and deviation calculations, and cover Late and historical rows with an empty status. Keep every crew row available in attendance history. |
| High | **Notifications open a section instead of the referenced item.** Word §14, `WD-193`, requires opening the relevant record after authentication. The staff click handler passes the source type without its record ID. The inspection case opens the Inspections page. The email and push fallbacks likewise point to the app or project without a record ID. The existing browser test explicitly asserts opening Inspections, which explains why it passed. See `apps/web/app/codeco-supervision-app.tsx:2337,3028,3080`, `apps/web/lib/notifications/email.ts:120` and `apps/web/lib/notifications/push.ts:39`. | Provide a permission-checked deep link and preserve it through sign-in. Test an inspection with two possible records and assert the exact record opens. Repeat for other supported event types and the enabled delivery channels. Test access using authorized fixture roles. |
| High | **Approved Photos formats are unavailable through normal upload entry points.** The workbook Photos sheet requires multi-upload and keeping originals. In `DECISIONS-PENDING.md`, Decision 3 explicitly accepts GIF, HEIC, HEIF and AVIF alongside JPEG, PNG and WebP. Photos and photo-evidence native inputs advertise only JPEG, PNG and WebP. A valid one-pixel GIF returned an empty result from `imageContentType`. HEIF normalization is conditional on browser decoding, so code inspection alone cannot confirm it works across devices. See `apps/web/app/media-library-workspace.tsx:810,816`, `apps/web/app/photo-evidence.tsx:405` and `apps/web/lib/images/content-type.mjs:2`. | Use real sample files to prove that the gallery and evidence picker accept each approved image format, preview or create the required JPEG derivative, save or retry without duplicates, preserve annotations and download the original with the same hash. Run iPhone and Android gallery/camera checks for the device-dependent paths. |

## Workspace coverage

The original workbook and Word file regenerated the same 1,079 source IDs as the existing register. Totals were 592 Excel, 368 Word and 119 mind-map IDs. The last group comes from the repository transcription, checked alongside image 15. The standard workbook audit found all 266 checked rows in order with matching labels and basic requiredness. It recognizes system fields from their specification, so those matches alone cannot prove generated metadata, persistence or role restrictions. Conditions, uploads, signatures, record transitions and read-back need behavioral evidence.

| Workspace destination | Independent evidence and limitations |
|---|---|
| Works Ongoing | 23 workbook rows matched. Previous UAT provides activity-prompt evidence. |
| Works Completed | 19 matched. Previous UAT provides completion and activity evidence. |
| Workforce | Shared lists and image 1 apply. Reproduced the attendance total gap above. Shift Other has a description input in the candidate. |
| Project Delay Report | 21 matched. Optional evidence follows the recorded 20 November workbook decision. |
| Issue | 22 matched. The recorded workbook decision keeps the longer responsible-party list. |
| HSE | 23 matched. Workbook workflow and role evidence remain in the existing UAT. |
| Materials Delivery | 21 matched. The candidate uses the 13 approved units, including `mm` and `cm`, and the focused sheet-and-save browser test passed. |
| Inspections | Word and mind-map criteria apply. Focused local tests passed planning, rescheduling, notification counting and permissions. The exact notification destination remains open. |
| Technical Instructions | 20 matched. The existing UAT traces revision pinning and contractor response. |
| Change Order | 23 matched. Reason for change remains required under the recorded workbook decision. |
| NCR | 26 matched. The recorded workbook decision keeps Type and Category ahead of Title and Description. The existing UAT traces contractor response through verification. |
| Lessons Learned | 20 matched. The candidate follows workbook field order under the recorded decision. |
| Agreements Made | 20 matched. Broader lifecycle verification is in the existing UAT. |
| HSE Incident Registration | 28 matched. Sensitive incident fields and restricted access need their workflow evidence alongside this comparison. |
| Photos | The separate worksheet has 11 rows. The candidate shows a project location and per-photo purpose workflow. The approved-format finding still needs closure. |

## Other menu areas and release evidence

The 10 areas in image 15 are Overview, Workspace, Actions, Rapid Verify, Project Documents, Records & Photos, Reports, Contractor Portal, Client Portal and Management. The existing UAT register covers all 10 with per-item evidence. This pass independently examined the Excel form definitions, Workforce math, upload paths, notification links and the focused release evidence. It did not rerun every menu, role and annotated image workflow. For the release itself, consult the detailed per-area and per-clause evidence in `UAT-SOURCE-RESULTS.csv` and the walkthrough evidence in the current CI run.

- Fresh targeted Node checks passed 51 of 51 across workbook rules, server validation, document signatures and portal/document logic. The release agent's focused browser log `tmp/codeco-release-confirm.log` passed 5 of 5 inspection and Materials Delivery checks. It verifies the legitimate A → B → A reschedule and unchanged-save behavior covered by `WD-192`.
- The existing UAT snapshot showed 960 Pass, 2 Fail and 117 Reference, with zero unrun rows and zero coverage errors. `XL-16-005` and `WD-192` are stale against the newer candidate evidence above. `WD-193` is marked Pass in that snapshot, but its exact-record behavior is contradicted by the code and browser assertion. A complete ID count does not resolve that discrepancy.
- At the audit snapshot, the PR's database and web checks and Vercel preview passed. The critical browser job was still running. The older combined local browser log contains failures and is not evidence for the newer commit. Recheck current results for the walkthrough and the previously intermittent tablet Rapid Verify layout shift.
- This pass did not establish production parity. The public release endpoint lookup failed to resolve from this shell. Verify the actual production commit and applied schema, then check authorized production roles, storage and notification delivery, camera workflows and backup/restore evidence against that deployment.

Clear and retest the three confirmed findings, update the affected acceptance rows, and check the deployed version before issuing a client statement that all documented workflows work.
