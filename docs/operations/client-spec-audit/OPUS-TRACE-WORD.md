<!-- Generated in the Opus audit of 26-11-2026 by a read-only comparison of the Word v2.0 with the code. Spot-checked by hand: the contractor 'New submission' (portal-app.tsx), the legacy contractor's records.create (role-permission-matrix.md), the Management gear (hidden by shell.css:110, so the 'repeated as a top-bar gear' line is not true on screen). -->
# Word requirements v2.0 vs app: gap table

Source: `tmp/audit-src/word.txt` (CODECO Functional Requirements v2.0, 25-11-2026).
Code read on branch `codex/forms-follow-mockups` (commit 12c56c0). Paths are relative to `apps/web/` unless they start with `supabase/` or `docs/`.
Result values: **matches**, **differs**, **missing**, **partial**, **n/v** (not verifiable from code), **extra** (app has it, Word does not ask).
Field-level form behaviour (Excel v5.0, column I) is out of scope here and only spot-checked.

## Change table and cover

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| Cover | Excel v5.0 is the field-level source of truth; mockups v6 | lib/forms/*, supabase/migrations/202611250007..15 | n/v | Many migrations cite "v5"; form fields not audited here. |
| Change table, "2 table" | Workspace Supervision only; Reports = builder; portals visible to Supervision; order 9/10 corrected | codeco-supervision-app.tsx:238-252, 690-697 | partial | Order and portals correct. Workspace and Management menus have no role gate (`navAllowed` returns true for `project` and `meer`). |
| Change table, "2 / 5.1 / 5.4" | Form Logs in Records & Photos | records-archive.tsx:307-312, form-logs.tsx, lib/records/form-logs.mjs:256-315 | matches | 15 logs present. |
| Change table, "Consistency" | Workflow states identical to Excel incl. "Pending PM Approval"; client never approves CO | lib/actions/auto-list.mjs:28; supabase/migrations/202611250007_signoff_without_reviewer.sql | partial | PM approval present. No server guard found that stops routing a CO to the client with requested action "approve" (see 21.3). |

## 1. Purpose and basic decisions

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 1 | One central record; same record shown in several views, never recreated | lib/portal/portal-data.ts:1-8 (shares point at records); lib/actions/auto-list.mjs:1-10 (Actions = live view) | matches | Portal shares and auto-actions reference the source record. |
| 1, decision 1 | All forms filled and submitted by Supervision only; contractor only responds | portal-app.tsx:229-240 ("New submission (RFI, RFA, WCR, inspection request)"); codeco-supervision-app.tsx:1776-1777 (contractor portal gets an `OperationalWorkspace` when `records.create`); docs/operations/role-permission-matrix.md:45,51 (legacy `contractor` role has `records.create`, `actions.create`) | differs | A contractor can still create RFI/RFA/WCR/inspection-request records in the portal; legacy contractor role holds create rights. |
| 1, decision 2 | No separate Supervision reviewer; signed submission is final | supabase/migrations/202611250007_signoff_without_reviewer.sql:1-20 | partial | Sign-off profiles have no review step. Residue: permission codes `inspections.review`, `reports.review`, `documents.review` (matrix:49,65,79); sign-off settings copy still says "one approval by any reviewer" (app/forms/spec-configuration-panel.tsx:142); daily report still has "Review & sign" (operational-workspace.tsx:6608, 6794). |
| 1, decision 3 | Only CO needs approval, by PM; client does not sign CO | 202611250007 (CHANGE-APPROVAL stage 3 approve/reject by project_manager) | partial | PM approval implemented. Matrix still says the contractor representative signs CO section 5 (role-permission-matrix.md:139). |
| 1, decision 4 | Supervision can view every portal of its projects | codeco-supervision-app.tsx:249-250, 696, 1992-2008; view-as-portal.tsx | matches | Both portals in the menu with "View as". |
| 1, decision 5 | Auto-fill, never typed twice | app/forms/form-auto-bar.tsx; lib/forms/link-prefill.mjs | n/v | Present; field coverage per Excel not verified here. |

## 2. Main navigation

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 2 row 1 | Overview: dashboard, progress, open items, KPIs, activity, alerts; Supervisor, PM | codeco-supervision-app.tsx:239, 2009-2048; client-dashboard.tsx; overview-panels.tsx | matches | Visible to every non-portal user. |
| 2 row 2 | Workspace: 15 forms; Supervision only (Site Supervisor, QA/QC, HSE Officer, PM) | codeco-supervision-app.tsx:240, 690-697 (no gate), project-workspace-home.tsx:107-225, 237-242 | partial | Menu always shown; tiles gated by read permission, not by create permission. Legacy `client` role (has `records.read`) lands in the supervisor app (lib/portal/portal-model.mjs:238-244) and sees Workspace. |
| 2 row 3 | Actions; Supervisor, PM; contractor sees assigned actions | codeco-supervision-app.tsx:241, 690; portal-app.tsx:183 (Pending actions) | matches | |
| 2 row 4 | Rapid Verify incl. spec compliance check; Supervisor, Inspector | codeco-supervision-app.tsx:242, 693 (`files.read`) | partial | Gated on `files.read`, which the legacy client role also has. |
| 2 row 5 | Project Documents; contractor by permission | codeco-supervision-app.tsx:245, 691 | matches | Contractor sees documents through portal "Shared documents". |
| 2 row 6 | Records & Photos incl. Form Log per form type | codeco-supervision-app.tsx:246, 692; records-archive.tsx:307-312 | matches | |
| 2 row 7 | Reports = report builder; Supervisor, PM | codeco-supervision-app.tsx:247, 695 | partial | Reports page title is "Client reports" (operational-workspace.tsx:6664) and opens on "Day overview", not on the builder. |
| 2 row 8 | Contractor Portal; Supervision "View as", read-only | codeco-supervision-app.tsx:249, 696, 1992-2008; view-as-portal.tsx:22-60 | matches | |
| 2 row 9 | Client Portal; "View as client", read-only | same as above, mode "client" | matches | |
| 2 row 10 | Management; Administrator, PM | codeco-supervision-app.tsx:251, 697 (always true), 1981 (gear in top bar) | differs | Every Supervision role (and legacy client) sees Management; content is partly gated per section only. Reached twice (sidebar + top-bar gear). |
| 2 order | Order 1-10 | codeco-supervision-app.tsx:238-252 | matches | Overview, Workspace, Actions, Rapid Verify, Project Documents, Records & Photos, Reports, Contractor Portal, Client Portal, Management. |
| 2.1 | Workspace is for creating, not archiving | project-workspace-home.tsx:289-336 | partial | Workspace home has a record code search with filters that duplicates archive search. |
| 2.1 | Contractor Portal is role-based, not a duplicate DB | lib/portal/portal-data.ts:1-8, 113-157 | matches | |
| 2.1 | Actions = operational follow-up register | project-action-center.tsx; lib/actions/auto-list.mjs | matches | |
| 2.1 | Reports aggregate existing data, no re-entry | lib/reports/report-builder.mjs | matches | |
| 2.1 | "View as: <organisation>" selector, same filters and field visibility | portal-app.tsx:159-164, 320-327; view-as-portal.tsx:28-37 | partial | Selector exists. Client mode is not filtered per client party (`mode === "client"` passes all client shares). |
| 2.1 / 8.1 | View as uses the same server-side scoping, read-only | portal-app.tsx:142-146, 162 | differs | View-as loads the whole project snapshot with the supervisor's session and filters in the browser; it is not the contractor's server-side scope. Read-only is enforced (portal-app.tsx:134, 164). |
| 2.1 | Supervision actions logged as Supervision | portal-app.tsx:164, 327 | matches | Rights forced to false in view-as. |
| 2.1 | Left menu with text labels | codeco-supervision-app.tsx:1885-1906 | matches | Note the nav group heading reads "Workspace" above all ten items (1886). |
| 2.1 | Clicking a form tab in Workspace opens the form directly | project-workspace-home.tsx:119-224 | differs | Tiles open the module list (e.g. `openTask("registers", false, ...)`), not a new form. |

## 3. Workspace

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 3 | 15 form types | project-workspace-home.tsx:107-225 | matches | All 15 present. |
| 3 | Tab order 01 Photos ... 15 Agreements Made | project-workspace-home.tsx:107-225 | matches | Same order. |
| 3 | Left menu with tabs (mockups v6) | project-workspace-home.tsx:338-350 | differs | Workspace home is a tile grid, not a left tab menu. Inside a module a tab bar may exist (not verified). |
| 3 | Drafts auto-saved, submit, unique record number | app/forms/draft-notice.tsx; supabase/migrations/202611250010_v5_record_ids.sql | n/v | Present; not exercised. |
| 3 layout | One continuous page, numbered sections | app/forms/record-form-shell.tsx | n/v | Commit cfd38ca "numbered cards, columns" may conflict with "no columns". |
| 3 | Auto bar (ID, date/time, by, status) | app/forms/form-auto-bar.tsx | matches | |
| 3 | Link first, then fill | lib/forms/link-prefill.mjs | n/v | |
| 3 | Location block from drawing (latest For Construction) | drawing-location-picker.tsx | n/v | |
| 3 | Camera and file buttons | app/forms/attachment-buttons.tsx:45-50 | matches | "Take a picture" / "Add a file". |
| 3 | Inspections use Checklist Library, Pass/Fail/N/A | operational-workspace.tsx:7036-7049 (library); inspection forms | partial | Library present; answer model not verified. |
| 3 | Registers maintained in Management | company-register.tsx; operational-workspace.tsx:6949, 7035 | partial | Company register exists twice (Project information + Project setup "Project parties"). |
| 3 | "Open log" button on each Workspace tab | operational-workspace.tsx:3653, 3796 | matches | |
| 3.1 | Persistent record, ID, timestamp, searchable, audit trail | supabase/migrations/202611240003_archive_search.sql; records-archive.tsx | matches | |
| 3.1 | Generate linked actions where follow-up is required | lib/actions/auto-list.mjs:34-65; supabase/migrations/202611240007_system_follow_up_actions.sql | matches | |
| 3.1 | Trigger contractor assignment on submission | supabase/migrations/202611240009_assign_on_submission.sql, 202611240011_supervisor_assigns.sql | matches | |
| 3.1 | Submission final; only CO to "Pending PM Approval" | 202611250007 | matches | |
| 3.1 | Close/verify/approve fields in dialog, stored in sign-off log | supabase/migrations/202611250009_close_verify_approve_dialog.sql; app/forms/issue-decision-dialog.tsx | matches | |

## 4. Project Documents

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 4 | Controlled library for drawings, specs, schedules, BOQ, contracts, method statements, submittals | document-register.tsx; project-documents-home.tsx | partial | Two parallel systems: the 00-13 Document register and a legacy "Project document center" with tabs All / Drawings / Renders / BOQ / Technical specs / Contracts and free folders (project-documents-home.tsx:140-148, 243-275). |
| 4.1 | Folders 00-13 with the Word names | lib/documents/document-register.mjs:9-22 | matches | Dutch name of 04 is "Bestek, BOQ & contract" (adds bestek). |
| 4.1 | Folder structure configurable per project | document-register.tsx:657-667 (Document settings); operational-workspace.tsx:6891 | matches | |
| 4.1 | Folder browsing + searchable register | document-register.tsx:175-223 | matches | |
| 4.1 | One canonical record tagged to multiple categories/buildings/packages | supabase/migrations/202611220001_portals_and_document_register.sql:271, 276-277 | partial | Multiple buildings yes; single `folder_code` and single `work_package`, no multi-category tags. |
| 4.2 | Document number unique within project | 202611220001:287-288 | matches | |
| 4.2 | Title required | 202611220001:270; document-register.tsx:326 | matches | |
| 4.2 | Category, discipline, type, originator, building, revision, status, issue date, uploaded date/by, transmittal | 202611220001:265-314; document-register.tsx:325-346 | matches | |
| 4.2 | Review/approval info (reviewer, date, comments, workflow ref) | 202611220001:305-307 | matches | |
| 4.2 | Related records | 202611220001:329 (`link`/`unlink` events); document-register.tsx:540 | matches | |
| 4.2 | Supersedes / superseded by | 202611220001:308-309 | matches | |
| 4.2 | Status list project-configured | 202611220001:298-299 (fixed check constraint) | differs | Status list is fixed in the database. |
| 4.3 | Suggested statuses | lib/documents/document-register.mjs:26-38 | matches | All 11. |
| 4.3 | Never overwrite a revision; new version linked | 202611220001:310 unique (document_id, revision) | matches | |
| 4.3 | Show current revision prominently; history | document-register.tsx:451, 552-560 | matches | |
| 4.3 | Only authorised roles change status / designate current | lib/documents/document-register.mjs:41-45; supabase/migrations/202611240008_current_revision_follows_approval.sql | matches | |
| 4.3 | Uploaded drawing not automatically approved | document-register.tsx:504 | matches | |
| 4.3 | Record who uploaded/reviewed/superseded with timestamps | 202611220001:322-334 (project_document_events) | matches | |
| 4.3 | Notify affected users on revision/status change | 202611220001:696-713, 845 | matches | Reviewers and shared parties. |
| 4.3 | Warn when a record or drawing pin links to a superseded revision | lib/documents/document-register.mjs:208-228; spec-compliance-check.tsx:292 | partial | Logic exists; drawing-picker warning not confirmed in drawing-location-picker.tsx. |
| 4.4 | Search number/title/keyword/file name | document-register.tsx:189-191 | matches | |
| 4.4 | Filters category, discipline, building, originator, status, revision, date | document-register.tsx:198-204 | matches | |
| 4.4 | Sort number/title/received/revision/status | document-register.tsx:205-214; lib/documents/document-register.mjs:123-131 | matches | |
| 4.4 | Export Excel/PDF | document-register.tsx:193 | matches | |
| 4.4 | Preview / secure download | document-register.tsx:459-460 | matches | |
| 4.4 | Overdue/missing submissions when a schedule is configured | register-reports.tsx:94 ("Days waiting") | partial | Only "days waiting" on reviews; no submission schedule. |

## 5. Records & Photos

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 5.1 | Submenus: Submitted Forms, Photo Library, Attachments, Record History, Form Logs | records-archive.tsx:307-312 | matches | Order differs slightly: app puts Form Logs before Record history. |
| 5.2 | Photo ID, file name, uploaded at/by, location, record, category, caption | photo-evidence.tsx; media-library-workspace.tsx | partial | Not field-checked. |
| 5.2 | Photo time from EXIF | lib/images/exif-direction.mjs:101-134 | missing | Only EXIF direction is read; no DateTimeOriginal found. |
| 5.2 | Preserve originals | supabase/migrations/202611250001_original_file_limit.sql | matches | |
| 5.3 | Filters: form type, number, date, building, discipline, contractor, responsible, status, linked action | records-archive.tsx:255-275, 305 | matches | |
| 5.3 | Contractor only sees assigned; Supervision sees all | lib/portal/portal-data.ts:1-8 | matches | |
| 5.4 | 15 logs | lib/records/form-logs.mjs:256-291 | matches | |
| 5.4 | Open via Records → Form Logs or "Open log" | records-archive.tsx:94, 311; operational-workspace.tsx:3796 | matches | |
| 5.4 | Columns show/hide/reorder/sort, saved per user | form-logs.tsx:48-104, 211-212 | partial | Saved in browser localStorage, not per user account. |
| 5.4 | Period presets, status, location, discipline, contractor, created by, form-specific filters, full-text | form-logs.tsx:36-43, 90, 179; lib/records/form-logs.mjs:293-310 | matches | |
| 5.4 | Totals per log | lib/records/form-logs.mjs:442-485 | matches | |
| 5.4 | Excel/CSV/PDF export of filtered view; drafts excluded | form-logs.tsx:189; lib/records/form-logs.mjs:324 | matches | |

## 6. Contractor Portal

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 6 | Dedicated secure area; no workspace, internal notes, other contractors | lib/portal/portal-data.ts:1-8; portal-share-panel.tsx:220 | matches | RLS per party. |
| 6 | Contractors never create or fill supervision forms | portal-app.tsx:229-240; codeco-supervision-app.tsx:1776 | differs | "New submission (RFI, RFA, WCR, inspection request)" opens an OperationalWorkspace for contractors with `records.create`. |
| 6.1 | Dashboard (awaiting, overdue, returned, upcoming) | portal-app.tsx:180, 214-225 | matches | |
| 6.1 | Assigned to Me | portal-app.tsx:181, 227-228 | matches | Label "Assigned to me". |
| 6.1 | Responses & Submissions | portal-app.tsx:182, 229-242, 537-570 | matches | Plus contractor-created submissions (see above). |
| 6.1 | Pending Actions | portal-app.tsx:183, 243-244 | matches | |
| 6.1 | History | portal-app.tsx:184, 245-246 | matches | |
| 6.1 | Shared Documents (optional) | portal-app.tsx:185, 461-466 | matches | |
| 6.2 CO | View CO, respond with proposal, cost/time; no contractor sign; PM approves | portal-app.tsx:670-672; supabase/migrations/202611230001_document_release_control.sql:417-419 | partial | Response fields present. Matrix still lists contractor signature on CO (role-permission-matrix.md:139). |
| 6.2 TI | View, acknowledge, ask, confirm/evidence; acknowledgement is not agreement | portal-app.tsx:761-768, 793 | matches | |
| 6.2 NCR | Cause analysis, corrective action, target date, evidence; cannot close | portal-app.tsx:665-667 | matches | |
| 6.2 Agreements | View, acknowledge/sign, comment | portal-model requestedActionLabels (sign) | partial | Sign action exists; agreement-specific flow not verified. |
| 6.2 PDR | Explanation, dates, mitigation | portal-app.tsx:675-676 | matches | |
| 6.2 Inspection request | Documents/evidence, attend | lib/portal/portal-model.mjs (`attend`) | matches | |
| 6.2 Issue/HSE | Acknowledge, comment, evidence; Supervision closes | portal-app.tsx:761-765 | matches | |
| 6.2 Inspections | Witness sign on tablet or "Send to app"; does not change result | 202611250007 (INSPECTION-WITNESS stage 2 witness) | partial | Witness step exists; "Send to app" is a portal share with requested action `sign` (202611250011:207), no button with that name. |
| 6.2 WO/WC/Workforce | No acknowledgement or signature; visible only if shared | 202611250007 (WO-DAILY, WC-COMPLETION, WF-ATTENDANCE submit only) | matches | |
| 6.3 | Assigned org from Project Company Register; responsible person; due; required action; priority; assigned by; status | portal-share-panel.tsx:188-238; company-register.tsx | matches | |
| 6.3 | Contractor-visible fields separate from internal | portal-share-panel.tsx:216-225 | matches | |
| 6.4 | Project Admin creates org in register and invites users | company-register.tsx; operational-workspace.tsx:6892 (Portals) | partial | No "Project Admin" role (see 8). |
| 6.4 | Roles Contractor Admin / Representative / Read-only | role-permission-matrix.md:24-25 | matches | |
| 6.4 | Contractor Admin manages own users if enabled | role-permission-matrix.md:89 (`portal.members` never default) | partial | No UI found for a contractor admin. |
| 6.4 | Access scoped; revocation keeps history | role-permission-matrix.md:107-108 | matches | |

## 7. Workflow and sign-off

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 7 | Multiple rounds supervisor ↔ contractor | lib/portal/portal-data.ts:33 (`round`); portal-app.tsx:883-890 | matches | |
| 7 | Contractor responses never change form fields/status/result | supabase/migrations/202611230003_signoff_identity_and_profile_stages.sql; 202611220003 | partial | `202611220003_share_response_after_spec_status_sync` syncs status after a response; needs review against "never change status". |
| 7.1 | Create → Submit/Assign → Notify → Respond → Review → Resubmit → Verify → Close | lib/portal/portal-model.mjs:7-60 | matches | |
| 7.2 | Append-only event log with sequence, round, action, actor, org, role, time, comment, files, version, prev/result status | lib/portal/portal-data.ts:40-57 | matches | Version = round only. |
| 7.3 | Acknowledgement ≠ acceptance | portal-app.tsx:793, 796 | matches | |
| 7.3 | Signed-document evidence for external reps | role-permission-matrix.md:141-160 (on_device / own_account) | partial | On-device signing yes; uploaded signed-document evidence flow not found. |
| 7.3 | Supervisor signs every form, auto name/role/org | app/forms/sign-submit.tsx; app/forms/signoff-panel.tsx | n/v | |
| 7.3 | Contractor signs per Sign-off sheet, never WO/WC | 202611250007 | matches | |
| 7.3 | Same tablet or "Send to app" | app/forms/contractor-signature.tsx; 202611250011:207 | partial | See 6.2. |
| 7.3 | CO: no client signature, PM approves with amount/days default | 202611250009_close_verify_approve_dialog.sql | matches | |

## 8. Roles and permissions

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 8 | Roles: Site Supervisor, QA/QC Inspector, HSE Officer, Project Manager, Project Admin, Contractor Rep, Client Rep | role-permission-matrix.md:14-27 | differs | App roles: organization_admin, project_manager, lead_supervisor, supervisor, quality_hse_manager, client, contractor, external_guest, contractor_*, client_*. No Project Admin, no separate QA/QC Inspector or HSE Officer; adds lead supervisor and org admin. |
| 8 | Create forms: Supervisor/PM yes; Project Admin no; Contractor never | role-permission-matrix.md:45 | differs | Legacy `contractor` holds `records.create`, `actions.create`. |
| 8 | View all project records: Supervision yes; contractor no | role-permission-matrix.md:44 | matches | |
| 8 | Approve CO: PM only, not own CO | 202611250007 header | matches | |
| 8 | View both portals: Supervision yes; contractor no | codeco-supervision-app.tsx:696 | partial | Legacy `client` role also has `records.read` and so gets View-as of the Contractor Portal. |
| 8 | Maintain registers and Checklist Library: Project Admin only | operational-workspace.tsx:6949, 7036 (`project.configure`) | differs | Checklist library edit gated by `templates.manage` (supervisors with lead/quality roles); no Project Admin role. |
| 8 | Manage users: Admin/PM | role-permission-matrix.md:73 (`members.manage` org admin only) | differs | PM cannot manage users by default. |
| 8.1 | Server-side access control | supabase/tests referenced in matrix | matches | |
| 8.1 | View-as uses same server-side scoping | portal-app.tsx:142-162 | differs | Client-side filter of a supervisor snapshot. |
| 8.1 | Internal vs contractor comments separated | portal-share-panel.tsx:220 | matches | |
| 8.1 | No private data in notification previews | lib/notifications/push.ts | n/v | |

## 9. Actions

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 9 | Automatic list of every submitted form needing follow-up, live view | lib/actions/auto-list.mjs:34-65; auto-action-list.tsx | matches | Rules for all 14 forms + compliance check. |
| 9 | Actions page is that list | project-action-center.tsx:216, 329-332 | differs | The automatic list is the 4th view "Follow-up per form"; default view is "My work"/"All project work" (manual actions). |
| 9 | Manual actions must link to a source record | codeco-supervision-app.tsx:3442-3531 | missing | "Create central action" has templates, owner, due, priority; no source-record field. |
| 9 table | Issue/HSE/NCR/TI/CO/AM/PDR/Inspection/WC/WO/MD/Incident/LL/Spec check rules | lib/actions/auto-list.mjs:34-65, 68-91 | matches | CO due date returns "" (Word: request date + set period); PDR uses `!isClosed` not "recovery action not closed". |
| 9 fields | Action ID, title, source, assigned to, owner, due, priority, status list, evidence, verification | lib/actions/action-center.mjs | partial | Status set uses open/accepted/in_progress/ready_for_verification/verified (codeco-supervision-app.tsx:270-275), not Word's list. |
| 9 | Contractor "completed" → waiting for verification, never Closed | lib/portal/portal-model.mjs:10-12 (`submitted_for_verification`) | matches | |
| 9 views | All open, Overdue, Due this week, Waiting for contractor, Waiting for Supervision, Pending PM | lib/actions/auto-list.mjs:150-165 | matches | |
| 9 filters | Form, contractor, location, discipline, priority | auto-action-list.tsx:63-93 | matches | |
| 9 | Counts per form as badges in the left menu | codeco-supervision-app.tsx:676-700 | partial | One total badge on "Actions"; per-form counts only inside the page. |
| 9 | Item leaves when source closes; never by deleting | lib/actions/auto-list.mjs:4 | matches | |

## 10. Rapid Verify

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 10 | Mobile quick verification of assigned item; result, photos, comments | verification-queue.tsx:146-153, 301-356 | matches | |
| 10.1 | Subject: submittal revision OR Materials Delivery / Inspection record | spec-compliance-check.tsx:214-215 | partial | Only documents can be chosen. |
| 10.1 | Requirement source down to clause; last clause per material group suggested | spec-compliance-check.tsx:96-100, 217-225 | matches | |
| 10.1 | Side-by-side, searchable, zoomable | spec-compliance-check.tsx:231-232; compliance-document-pane.tsx | matches | |
| 10.1 | Requirement table rows; save as reusable list per material group | spec-compliance-check.tsx:242-259 | partial | Rows yes; reusable requirement list not found. |
| 10.1 | Optional extraction, marked as proposed | spec-compliance-check.tsx:114-135, 237-239 | matches | |
| 10.1 | Overall result + signature, stored with both revisions | spec-compliance-check.tsx:263-274; supabase/migrations/202611250012_spec_compliance_checks.sql | matches | |
| 10.1 | Does not comply → NCR or Issue, or return to contractor | spec-compliance-check.tsx:280-294 | partial | Only "Create NCR". No Issue, no return via portal. |
| 10.1 | Complies with comments stays in Actions | lib/actions/auto-list.mjs:68-91 | matches | |
| 10.1 | MD "Accepted" only if compliance check complies | supabase/migrations/202611250013, 202611250015 | matches | |
| 10.1 | Flag "based on superseded revision" | spec-compliance-check.tsx:292 | matches | |
| 10 | Verify work, NCR action, evidence; result set; date/verifier/location; follow-up action on fail; history | verification-queue.tsx:146-153, 190-207, 346-356 | matches | |
| 10 | Same quick dialog for Close/Verify of Issue/HSE/NCR/AM and CO PM approval | 202611250009; app/forms/issue-decision-dialog.tsx | partial | Separate dialogs; not one shared dialog. |

## 11. Reports

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 11 | Report types listed (16) | lib/reports/report-builder.mjs:46-62 | partial | 14 present. Custom period handled by dates; "Single record PDF" not a builder type (record PDFs exist elsewhere: lib/reports/controlled-document-pdf.tsx, ncr-pdf.tsx). |
| 11 | Report types shown | operational-workspace.tsx:6430-6442 | extra | Builder also lists 4-5 older types: Configured client report, Complete project report, Management report, Quality and HSE, Visual progress report. |
| 11 | Show period, cut-off, filters, generated time | register-reports.tsx:106-115; period-report-pdf | matches | |
| 11.1 | Period presets Today…Last month; ISO week | lib/reports/report-builder.mjs:6-41 | matches | |
| 11.1 | Forms to include: 15 forms + Actions + Project Documents, Select all / Clear | operational-workspace.tsx:6464-6480, 6712-6718 | partial | Lessons Learned is missing from the checkbox list; Actions appears as "Deadlines". |
| 11.1 | Filters: building/area, level, discipline, contractor, status, priority | operational-workspace.tsx:6758 (SpecFacetFilterBar) | partial | Discipline/type/status/priority only; no building, level or contractor filter. |
| 11.1 | Content options (summary/full, photos none/thumb/large, signatures, sign-off log, open-from-before, responses, group by) | operational-workspace.tsx:6720-6743 | matches | Max photos per record not found. |
| 11.1 | Preview on screen | operational-workspace.tsx:6759-6766 | missing | Direct PDF/Word/Excel download; no on-screen preview. |
| 11.1 | PDF + Excel (one sheet per form) | operational-workspace.tsx:6763-6765; lib/reports/period-report-xlsx.mjs | matches | Word export also offered (extra). |
| 11.1 | Save as template; schedule with e-mail | operational-workspace.tsx:6767-6768; report-builder-tools.tsx; app/api/cron/reports/route.ts:32-55 | partial | Schedule only notifies that a report "is ready to be made"; it does not generate or attach the report. Cron runs twice a day (vercel.json). |
| 11.1 | Publish to Client Portal as frozen version; reissue keeps earlier | operational-workspace.tsx:6769; portal-app.tsx:421-454 | matches | |
| 11.2 | Default content per type | lib/reports/report-builder.mjs:46-72 | partial | Defaults are form lists, not the content specs (e.g. weather/time lost, histogram). |
| 11 submenu | Reports tab = builder | operational-workspace.tsx:6664-6673, 6606-6611 | differs | Reports submenus: Day overview, Daily report, Weekly report, Monthly report, Create report, Review & sign, Versions & history, Beyond this app. |

## 12. Overview dashboard

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 12 | Progress planned vs actual | overview-panels.tsx:103-108 | partial | Actual from BOQ; planned shows "No baseline schedule in the app". |
| 12 | Open actions by status, overdue | overview-panels.tsx:124-131 | matches | |
| 12 | Open NCRs by status/severity/contractor | overview-panels.tsx:110-117 | matches | |
| 12 | Pending COs and TIs | overview-panels.tsx:124-131 | matches | |
| 12 | Upcoming/overdue inspections | overview-panels.tsx:132-138 | matches | |
| 12 | HSE observations/incidents, follow-up | overview-panels.tsx:118-123 | matches | |
| 12 | Recent doc revisions, awaiting review | overview-panels.tsx:156-168 | matches | |
| 12 | Recent submissions and photos | client-dashboard.tsx:521, 583 | matches | |
| 12 | Contractor response items | overview-panels.tsx:147-155 | matches | |
| 12 | Activity feed linking to records | client-dashboard.tsx:541 | matches | |

## 13. Management

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 13 | Management sections | operational-workspace.tsx:6889 | differs | App sections: Overview, Project information, Team & rules, Workflows & lists, Portals, Document settings, Project setup, Quality standards, Backup & continuity. Names and grouping differ from the 13 Word areas. |
| 13 | Project Information | operational-workspace.tsx:6949; project-information.tsx | matches | |
| 13 | Buildings & Locations = Location Register; drawing linked to building/level | operational-workspace.tsx:7035 (Location tree); top bar "Manage buildings" codeco-supervision-app.tsx:1945-1952 | partial | Location tree present; drawing-to-level link not verified. |
| 13 | Contractors & Consultants = Project Company Register | company-register.tsx; operational-workspace.tsx:6949 | partial | Also a second "Project parties" list in Project setup (7035). |
| 13 | Users & Permissions | codeco-supervision-app.tsx (user_admin modal); operational-workspace.tsx:6953 | matches | |
| 13 | Work Packages & Disciplines | operational-workspace.tsx:6970, 7035 (`work_package` location type); app/forms/spec-configuration-panel.tsx:70 | partial | Scattered over three places. |
| 13 | Dropdown Lists | app/forms/spec-configuration-panel.tsx:66-101 | matches | |
| 13 | Approval & Sign-off Settings, no reviewer | app/forms/spec-configuration-panel.tsx:141-176 | partial | Copy still speaks of "reviewer" and "approvals needed". |
| 13 | Notifications: events, recipients, reminders, escalation | operational-workspace.tsx:7011, 7018-7020 | partial | Lead hours and push toggle only; saving sets `email_notifications_enabled: false`; quiet hours only via JSON (lib/notifications/quiet-hours.mjs:1-8). |
| 13 | Document Settings: numbering, taxonomy, status list, revision rules | document-register.tsx:657-667 | partial | Folder taxonomy only. |
| 13 | Retention & Archive | operational-workspace.tsx:6968 | partial | Retention days field only. |
| 13 | Checklist Library: upload xlsx/csv, versioned | operational-workspace.tsx:7036-7049 | matches | Columns differ from Word (Word: code, name, version, type, discipline, item no, item, mandatory, photo required). |
| 13 | Workforce disciplines: 72 predefined + additions | lib/forms/disciplines.ts:32; operational-workspace.tsx:6970 | partial | 72 list exists; Management edits a separate free-text discipline list. |
| 13 | Report templates & schedules | report-builder-tools.tsx (inside Reports) | differs | Lives in Reports, not Management. |

## 14. Notifications

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 14 | New record assigned to contractor | supabase/migrations/202611010001_assignment_notifications.sql | matches | |
| 14 | Response due soon/overdue | supabase/migrations/202611220002_rapid_verify_action_categories_reminders.sql:12, 298 | matches | Includes escalation. |
| 14 | Contractor submits response | notify_portal_party (202611220001) | matches | |
| 14 | Returned / approved / closed | notify_portal_party | matches | |
| 14 | New document revision; review pending/overdue | 202611220001:696-713, 845 | matches | |
| 14 | Action assigned/due/overdue/submitted for verification | notify_action_assignment; 202611220002 | matches | |
| 14 | Inspection scheduled/updated | supabase/migrations/202611250002_inspection_notifications.sql | matches | |
| 14 | CO awaiting PM approval/approved/rejected | notify_change_order_pending | partial | Pending found; approved/rejected not confirmed. |
| 14 | Signature requested via "Send to app" | 202611250011:207 | matches | |
| 14 | Scheduled report generated; report published | app/api/cron/reports/route.ts | partial | Schedule notice yes; publication notice via portal share. |
| 14 | Link to record after auth | codeco-supervision-app.tsx:1235-1257; lib/notifications/record-link.mjs | matches | |
| 14 | Reminder frequency, escalation recipients, quiet hours configurable per project | lib/notifications/quiet-hours.mjs:1-8; operational-workspace.tsx:7011 | partial | No UI for escalation recipients or quiet hours. |

## 15-16. Data model and non-functional

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 15 | Unique IDs, link by ID | migrations | matches | |
| 15 | NCR → Action → Response → Evidence → Verify → Close | portal + verification-queue | matches | |
| 15 | Global search within user scope | client-dashboard.tsx:83-161; 202611240003_archive_search.sql | matches | |
| 15 | Project-local time | many `America/Paramaribo` | matches | |
| 16 | Responsive; portal and Rapid Verify mobile | codeco-supervision-app.tsx:2115-2150 | matches | |
| 16 | States Draft → Submitted → Awaiting contractor → Response received → Returned → Closed; CO Pending PM | lib/portal/portal-model.mjs:7-22 | partial | Portal uses its own names (Awaiting response, Response submitted, Returned for correction…). |
| 16 | Offline drafts and photo queue | lib/offline/*; codeco-supervision-app.tsx:1980 | matches | |
| 16 | Pagination / server-side filtering | records-archive.tsx:277 (server/device) | matches | |

## 17-20. Journeys, phases, acceptance, decisions

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 17.1 | NCR journey | portal + verification-queue | matches | |
| 17.2 | Revised drawing journey | document-register.tsx:497-504 | matches | |
| 17.3 | TI response journey | portal-app.tsx:761-768 | matches | |
| 17.4 | Supervisor opens portal from left menu and picks "View as" | codeco-supervision-app.tsx:249-250; portal-app.tsx:320-327 | matches | Selector hidden note: in preview the read-only text line is suppressed (portal-app.tsx:327), a banner replaces it (330-335). |
| 17.5 | Reports → New report → Week → Weekly Progress → preview → PDF → publish/schedule | operational-workspace.tsx:6670-6672, 6759-6769 | partial | No on-screen preview; no "New report" entry, separate menu items per period. |
| 18 | Phases | — | n/v | |
| 19 | 20 acceptance checks | see rows above | partial | Failing items: contractors cannot create (19 #15), view-as scoping (#16), report preview, Rapid Verify Issue/return. |
| 20 | Decisions | — | n/v | |

## 21-24. Client Portal

| Word section | Requirement (short) | Where in app (file:line) | Result | Detail |
|---|---|---|---|---|
| 21 | Separate client portal; no automatic access to internal records | codeco-supervision-app.tsx:1754-1760; lib/portal/portal-model.mjs:238-244 | partial | Only for `client_*` roles. Legacy `client` role has `records.read` and gets the full supervisor app (read-only). |
| 21.1 | Client Dashboard | portal-app.tsx:188, 253-268 | matches | |
| 21.1 | Project Progress | portal-app.tsx:189, 271 | partial | List of shared "progress" items; no planned-vs-actual or building/package progress. |
| 21.1 | Reports & Publications | portal-app.tsx:190, 421-454 | matches | |
| 21.1 | Photos & Site Updates | portal-app.tsx:191, 275 | matches | |
| 21.1 | Shared Project Documents | portal-app.tsx:192, 461-466 | matches | |
| 21.1 | Items for Client Review | portal-app.tsx:193, 279 | matches | |
| 21.1 | Key Issues & Risks | portal-app.tsx:194, 281 | matches | |
| 21.1 | Milestones & Schedule | portal-app.tsx:195, 285 | partial | List of shared items only. |
| 21.1 | Correspondence & Decisions | portal-app.tsx:196, 583-612 | matches | |
| 21.1 | History & Notifications | portal-app.tsx:197, 627-656 | matches | |
| 21.2 | Published only; list with title, type, period, issue date, version, status, by | portal-app.tsx:437-447 | partial | "Published by" column not shown. |
| 21.2 | Filters by type, building, work package, period | portal-app.tsx:423-431 | partial | Type and month only. |
| 21.2 | Reissue keeps previous version, shows current | portal-app.tsx:447 | matches | |
| 21.3 | Route record to client with requested action and due | portal-share-panel.tsx:42, 188-238 | matches | |
| 21.3 / 21.4 | CO never approved by client | supabase/migrations/202611230001_document_release_control.sql:417-419 | missing | Server blocks `approve` for contractors only; no rule found against routing a CO to the client with `approve` (portal-share-panel.tsx:42 offers `approve` for every client share). |
| 21.4 | Client Viewer / Reviewer / Approver / Administrator | role-permission-matrix.md:26, 86-89 | partial | Roles exist; client admin user management not enabled (`portal.members` never default). |
| 21.5 | Confidentiality, configurable per record type/field | portal-share-panel.tsx:216-225 | partial | Per share (title, summary, files); not a per-record-type configuration. |
| 21.5 | Log client views/downloads | lib/portal/portal-data.ts:239-241 | matches | |
| 21.6 | Widgets: progress, building progress, milestones, latest report, open decisions, quality, HSE, photos, documents, notifications | portal-app.tsx:253-268 | partial | Present: open decisions, overdue reviews, open issues, published reports, latest report, waiting decisions, key issues, photos, documents. Missing: overall progress, building/package progress, milestones, HSE summary, upcoming review deadlines. |
| 22 | Three environments + Management; separate permission domains | role-permission-matrix.md:84-89 | matches | |
| 23 | Client acceptance criteria | portal rows above | partial | |
| 24 | Decisions to confirm | — | n/v | |
| Appendix A/B | Terminology, information flow | — | n/v | |

## Extras (app has, Word does not ask)

| Where | Extra | File:line |
|---|---|---|
| Sidebar | Group heading "Workspace" above all ten menu items (same word as menu item 2) | codeco-supervision-app.tsx:1886 |
| Sidebar | Project context card (project switcher) | codeco-supervision-app.tsx:1876-1884 |
| Sidebar | "Take photo" button | codeco-supervision-app.tsx:1909-1914 |
| Sidebar | User card = sign out | codeco-supervision-app.tsx:1915-1923 |
| Top bar | Breadcrumb My projects › project › building (opens Manage buildings) | codeco-supervision-app.tsx:1931-1953 |
| Top bar | Field guide (help) | codeco-supervision-app.tsx:1955-1975 |
| Top bar | Live weather chip | codeco-supervision-app.tsx:1976 |
| Top bar | Language switcher | codeco-supervision-app.tsx:1977 |
| Top bar | Storage/offline status chip | codeco-supervision-app.tsx:1980 |
| Top bar | Management gear (duplicates menu item 10) | codeco-supervision-app.tsx:1981 |
| Top bar | Notifications bell (supports 14) | codeco-supervision-app.tsx:1982-1985 |
| Mobile | Bottom nav Overview / Workspace / Photo / Actions / More | codeco-supervision-app.tsx:2115-2150 |
| Workspace | Code search with 9 filters | project-workspace-home.tsx:289-336 |
| Workspace "Supporting tools" | Rapid Verify (dup of menu), Project Docs (dup of menu), Assets & folders, Drawings & pins, Calculator & notes, Deadlines | project-workspace-home.tsx:354-366 |
| Overview | Start today / Day log / Check report buttons; "Conditions & location" weather panel; Priority queue; 4 metric cards; search | client-dashboard.tsx:489-491, 509-512, 559, 602 |
| Actions | Views "My work", "All project work", "Deadlines"; standard action templates | project-action-center.tsx:329-332; codeco-supervision-app.tsx:3484-3490 |
| Rapid Verify | "Ask project documents" Q&A and "Check against specs" text search; Verification dashboard and 8 queues | rapid-verify-workspace.tsx:255-258; verification-queue.tsx:146-154 |
| Reports | Day overview; daily report Review & sign & Distribution workflow; "Beyond this app" prompt library; Word export; 4-5 legacy report types | operational-workspace.tsx:6606-6611, 6664-6707, 6430-6439, 6764 |
| Project Documents | Legacy document center (All/Drawings/Renders/BOQ/Technical specs/Contracts), free folders, "New controlled record" | project-documents-home.tsx:140-148, 243-275 |
| Management | Overview (attention, external submissions), Backup & continuity, readiness checklist, HSE risk matrix | operational-workspace.tsx:6898-6947, 7053; spec-configuration-panel.tsx:106-140 |
| Portal | Contractor "New submission (RFI, RFA, WCR, inspection request)" | portal-app.tsx:229-240 |
| External | WhatsApp share link without account ("Send to external party") | operational-workspace.tsx:5785, 6010, 6187; role-permission-matrix.md:111-124 |
| Account | Two-step verification (MFA) | operational-workspace.tsx:7179-7200 |
