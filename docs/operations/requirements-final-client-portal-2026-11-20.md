# Functional requirements FINAL (with Client Portal), coverage per section

Source: `CODECO_Supervision_App_Developer_Requirements_FINAL_with_Client_Portal.docx` (received 20-11-2026).
Status per item: **existing** (the app already did this before this round), **built** (added in this round, migration `202611220001`), **interpreted** (built; the requirement was open to more than one reading, ours is stated), **CODECO decides** (a decision listed in sections 20 and 24; the app has a setting or a safe default, the choice is CODECO's).

## What this round adds

1. **Project Documents register** (section 4): one record per document number, revisions that are never overwritten, review status set only by a reviewer, superseded revisions marked and linked, related records, document history, folder taxonomy 00–13, search/filter/sort and export to Excel (CSV) and PDF (print).
2. **Contractor Portal** (section 6): a screen of its own for contractor accounts with Dashboard, Assigned to me, Responses & submissions, Pending actions, History and Shared documents. It never shows the supervisor workspace.
3. **Client Portal** (section 21): Client dashboard, Project progress, Reports & publications, Photos & site updates, Shared project documents, Items for client review, Key issues & risks, Milestones & schedule, Correspondence & decisions, History & notifications.
4. **One workflow for both portals** (sections 7 and 21.3): CODECO assigns or routes an existing record (NCR, action, HSE, inspection, register record, document, photo, report). The record is never copied. Every step (assign, acknowledge, respond, return, resubmit, accept, verify, approve, reject, clarification, close, withdraw, reopen, view, download) is an append-only event with actor, organisation, role, round, previous and resulting status.
5. **Data separation in the database** (sections 8.1, 19, 23): every portal read is limited by row-level security to the user's own organisation (party). Contractor A cannot read contractor B's items, responses or files, also not by id. A client never reads contractor items, and a contractor never reads client items.

## Section by section

| § | Requirement | Status | Where |
|---|---|---|---|
| 2 | Main navigation: Overview, Workspace, Actions, Rapid Verify, Project Documents, Records & Photos, Reports, Contractor Portal, Client Portal, Management | existing + built | Supervisor nav unchanged. Project Documents and Records & Photos are workspace modules, as agreed earlier (the client asked not to show the same screen twice). The portals are separate shells for portal accounts, not menu items for CODECO staff. |
| 3 | Workspace: 15 form types, drafts, record number, workflow, audit | existing | Workbook rounds 1–3 (PR #19–#22). |
| 4.1 | Folder taxonomy 00–13, configurable per project | built | `lib/documents/document-register.mjs`. A project list can replace it (`project_settings.spec_configuration.document_folders`); there is no editing screen for it yet. |
| 4.2 | Register fields (number, title, category, discipline, buildings, originator, type, revision, status, dates, uploaded by, review, related records, file, supersedes) | built | `project_documents`, `project_document_revisions`, `project_document_links`. |
| 4.3 | Never overwrite; current revision prominent; only authorised roles change status; uploaded ≠ issued for construction; who/when per step; notify; warn on superseded | built | `add_project_document_revision`, `set_project_document_revision_status` (`documents.review`). An uploader without review rights can only choose Draft, Submitted or For Information. Reviewers are notified of Submitted revisions, the uploader of status changes, and portal parties of new revisions. |
| 4.4 | Search, filters, sort, export Excel/PDF, preview, overdue submittals | built / CODECO decides | Overdue or missing submittals need a document schedule that CODECO has not defined yet. Nothing is shown until it exists. |
| 5 | Records & Photos archive | existing | Workspace record lists, photo library, attachments, sign-off history. |
| 6.1 | Contractor portal submenus | built | `app/portal-app.tsx`. |
| 6.2 | Contractor capabilities per record type | built | NCR: cause, corrective action, target date and evidence. Change order: proposal, cost and time impact. Delay: explanation and mitigation. Acknowledgement text states it is not agreement on liability, cost or time. A contractor cannot approve or close. |
| 6.3 | Assignment fields (organisation, contact, dates, due, requested action, priority, assigned by, contractor-visible text, status) | built | `share_to_portal`. The visible summary and the chosen files are all the contractor sees; internal fields of the record stay out. |
| 6.4 | Onboarding, one organisation per user, roles Contractor Admin / Representative / Read-only, revocation keeps history | built | New roles, `set_project_member_portal_party`, Management → Portals. Managing own-organisation users (`portal.members`) exists as a permission but is not granted by default, and there is no screen for it yet. |
| 7 | Multi-round workflow and append-only event log | built | `portal_events`. Returning creates a new round and keeps the earlier round. Closing a proposal or evidence item requires Accept or Verify first. |
| 7.3 | Signatures and acknowledgement | existing + CODECO decides | Drawn signatures and signed-document evidence (round 3). Their legal effect is CODECO's decision. |
| 8 / 8.1 | Roles, server-side enforcement, cross-contractor isolation, file-level permissions, internal notes never visible | built | RLS on `portal_shares`, `portal_events`, `portal_share_files`, `files`, `project_register_entries`, `external_share_*`. Tested in `supabase/tests/031_*`. |
| 9 | Actions register; contractor "complete" → Submitted for verification | existing + built | Reporting complete in the portal moves the action to `ready_for_verification`, never to verified. |
| 10 | Rapid Verify | existing | Portal items can also be verified from their record. |
| 11 | Reports | existing + built | Period report → "Publish to client portal" (PDF, versioned per type and period). |
| 12 | Overview dashboard | existing | |
| 13 | Management | existing + built | New Management → Portals: portal register (open, waiting on CODECO, overdue at the organisation) and the user-to-organisation link. |
| 14 | Notifications | existing + built | Portal notifications carry no record content in the preview (8.1), only a code. Email/push follow the existing dispatch. Configurable reminder intervals for portal items are open. |
| 15 | IDs, links, no copies | built | A share points at its record by id. |
| 16 | Responsive / mobile | built | Portals work at 390 px wide without horizontal scrolling (checked). |
| 21.2 | Client reports: published only, versions, superseded, filters, download, no editing | built | `record_type = 'publication'`. Building and work-package filters for reports are open (publications are per project). |
| 21.3 | Client review and approval routing | built | Requested action "Approve or reject". Only Client Approver can approve or reject; reject and clarification need a comment; the decision is stored with user, role and timestamp. |
| 21.4 | Client roles Viewer / Reviewer / Approver / Administrator | built | Client Administrator has Reviewer rights; managing client users is the same open item as in 6.4. |
| 21.5 | Client confidentiality, logging of views and downloads | built | A view is logged once per person per day; every download is logged. |
| 21.6 | Client dashboard widgets | built / interpreted | Planned-vs-actual progress and milestones need schedule data the app does not hold. The client sees published progress and schedule updates and shared schedule documents (folder 03). The app does not compute or invent figures. |
| 22 | Separate permission domains | built | Contractor and client rights are separate permissions. A share is visible only to its own audience. |


## Second pass (21-11-2026): audit against the document and the client's menu mind map

Every menu item of the mind map, with where it is:

| Menu | Item | Status | Where |
|---|---|---|---|
| 1 Overview | Project summary, progress (planned vs actual), work status, quality, HSE, pending actions, contractor overview, document overview, recent activity, notifications | existing + built | `app/overview-panels.tsx` under the existing overview. "Planned" says there is no baseline schedule in the app; actual progress comes from BOQ progress. Notifications: the bell. |
| 2 Workspace | 15 forms | existing | |
| 3 Actions | Dashboard, all, my, contractor, corrective, preventive, overdue, pending verification, completed/closed | existing + built | Action centre: "Show actions" (contractor / corrective / preventive) and the "Completed / closed" tile. The action category is new (migration `202611220002`) and is set by an action manager in the action screen. Default: corrective for actions from an NCR, inspection or HSE record, follow-up otherwise. |
| 4 Rapid Verify | Verification dashboard, work, NCR, action, inspection follow-up, evidence review, pending, history | built | `app/verification-queue.tsx`, `record_verification()`. Results are pass, partially complete, further action required and fail, recorded with comment, photos, GPS and location. A pass closes an NCR, verifies an action, verifies a contractor portal item or passes a re-inspection. Any other result reopens the item or returns it, and can create a linked corrective action. The result shows in the record's own screen. The earlier document check is now the "Check against specs" view. |
| 5 Project Documents | Folders 00–13 | built (first pass) | Now a main menu item. |
| 6 Records & Photos | Submitted forms, photo library, attachments, record history | built | `app/records-archive.tsx`, a main menu item. Record history combines sign-offs, portal rounds, document revisions and verifications. |
| 7 Reports | Daily, weekly, monthly, progress, quality, inspection, HSE, delay | existing | Period report. |
| 7 Reports | Contractor reports, action reports, document reports | built | `app/register-reports.tsx`. Each shows period, data cut-off, filters and generation time, and exports to Excel (CSV) and PDF. |
| 7 Reports | Custom reports | existing | Period report with chosen sections and filters. |
| 8/9 Portals | | built (first pass) | |
| 10 Management | Project setup, buildings & locations, contractors & consultants, users & permissions, work packages, disciplines, dropdown lists, workflow, notifications, system settings, archive | existing | |
| 10 Management | Document settings (numbering, folders, review period) | built | Management → Document settings. The numbering pattern is checked when a document is registered. |
| Section 14 | Portal item due soon or overdue, escalation, answers waiting for CODECO, document review overdue | built | Added to `refresh_project_notifications()`. |


### Bugs found and fixed while testing (21-11-2026)

The full end-to-end run (all 378 specs, including those not in CI) found these, all fixed and covered by tests:

- **Share-link responses on issues/NCRs were refused** ("Only a finding manager may change the original observation") since the workbook-status sync of 202611210001: a contractor without an account could not propose a correction or report work ready. Fixed in `202611220003`, pgTAP in `032`.
- **A delay report was saved without its required photo** when the upload failed, because the check only counted the old named photo boxes. Fixed in `operational-workspace.tsx` (QA M20 behaviour restored).
- **Dictation stayed on "Stop dictation" after an error** and a session that was still starting when the user left the screen kept listening. Fixed in `lib/speech/dictation.ts` and `app/dictate-button.tsx`.
- **The overview jumped 25 px on a phone** when "Day not started" changed to "Day started". The day status now has its own line.
- **"Open follow-up" on the overview briefly left out the actions** while they were still loading. It now appears only when both have loaded.
- **After registering a document its detail closed again by itself** (browser history race). The new document now appears in the register.
- Specs `media-and-sharing`, `delay-report-evidence`, `tap-targets`, `register-touch-targets`, `niche-hardening` and `rapid-verify-values` still described the forms from before PR #21/#22 and were updated. They are not in the CI subset, which is why this went unnoticed.

Result: pgTAP 32 files / 760 checks, unit tests, lint and the full Playwright run (201 passed, 0 failed; 177 skipped by design because they run on another viewport) on 21-11-2026.

## What changed for existing accounts

- **Legacy contractor role** (`contractor`): it now opens the contractor portal and has lost `files.read` and `files.manage`. Before, it could read and edit every file of the project. It reads only its own and its organisation's controlled submissions. It can still file RFI / RFA / WCR / inspection requests from Portal → Responses & submissions. **An existing contractor account sees nothing in the portal until it is linked to its organisation under Management → Portals.**
- **Legacy client role** (`client`, Opdrachtgever): unchanged. It still reads internal records, as decided on 30-07-2026 (`202607300006`). For the client access this document asks for, give client users one of the new client roles and link them to the client organisation. CODECO decides when to switch.
- External share-link responses (names, signatures, notes) are no longer readable by every project member, only by roles that read records.

## Open: CODECO decides (sections 20 and 24)

1. Which client users get which client role, and whether existing Opdrachtgever accounts move to the client portal.
2. Which forms contractors may start themselves. Today that is the controlled submissions, for roles with `records.create`.
3. Status meanings and who may issue for construction (today `documents.review`: lead supervisor, project manager, quality/HSE manager).
4. Document numbering and the transmittal process (free text today; uniqueness of the number is enforced).
5. Whether portal access is also limited by building, package or discipline (today: by organisation and by explicit share).
6. Whether contractor or client admins may manage their own users (`portal.members`).
7. Reminder intervals and escalation for overdue portal items.
8. Which report types are published automatically (today: always a manual CODECO release).
