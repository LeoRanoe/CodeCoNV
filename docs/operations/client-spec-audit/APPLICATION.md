# Application menu and Word requirement trace

Menu item names follow image 15. Section numbers below refer to the supplied Word file, which defines the Contractor Portal and has 20 sections. Client Portal is assessed from the menu map and its role description.

## Menu coverage

| Menu | Requested pages and views | Implementation and missing acceptance evidence |
|---|---|---|
| 1. Overview | Project Summary, Progress Overview, Work Status, Quality Overview, HSE Overview, Pending Actions, Contractor Overview, Document Overview, Recent Activities, Notifications | Project command center and supplemental widgets. Shows stored BOQ actual progress, work/day log, quality/NCR, HSE, actions, inspections, revisions, contractor and activity data. Planned-versus-actual metrics need a baseline and matching quantities. Recent links and status/severity/party counts need a fixed reference dataset. Bell exists. F11/F12. [Overview](../../../apps/web/app/overview-panels.tsx) |
| 2. Workspace | Works Ongoing, Works Completed, Workforce, Project Delay Report, Issue, HSE, Materials Delivery, Inspections, Technical Instructions, Change Order, NCR, Lessons Learned, Agreements Made, HSE Incident Registration, Photos | All 15 destinations are present. See the [individual pages](WORKSPACE.md) and [field trace](WORKBOOK.md) for validation, source conflicts, submission and completeness. |
| 3. Actions | Action Dashboard, All Actions, My Actions, Contractor Actions, Corrective Actions, Preventive Actions, Overdue Actions, Pending Verification, Completed / Closed | Dashboard, status/owner filters and action categories provide the named views. Central action records support deadlines, ownership, evidence, verification and source links. The form/provenance gap applies to offline follow-ups and some Rapid Verify corrective actions. F02/F08. [Action center](../../../apps/web/app/project-action-center.tsx) |
| 4. Rapid Verify | Verification Dashboard, Work Verification, NCR Verification, Action Verification, Inspection Follow-up, Evidence Review, Pending Verification, Verification History | Mobile-oriented queues, four verification results, viewer history, evidence/photos/GPS/comments and optional corrective action. Original specs comparison still available. Limit and transition gaps are F02/F11. [Queue](../../../apps/web/app/verification-queue.tsx) |
| 5. Project Documents | 00 Document Register & Transmittals, 01 Drawings, 02 Technical Specifications, 03 Project Schedules, 04 BOQ & Contract Documents, 05 Method Statements & Procedures, 06 Material Submittals, 07 Shop Drawings, 08 Permits & Certificates, 09 Correspondence, 10 HSE & Environmental Documents, 11 Testing & Commissioning, 12 Handover & Close-out, 13 Other Project Documents | All 14 starter folders, configurable taxonomy and a main menu destination. Register metadata, history, status, links, preview/download, CSV/print and permissions present. Transmittal is a text reference. Revision authority, stale links, outstanding submittals and deliberate external release are partial (F09/F11/F15). [Taxonomy](../../../apps/web/lib/documents/document-register.mjs) · [Register](../../../apps/web/app/document-register.tsx) |
| 6. Records & Photos | Submitted Forms, Photo Library, Attachments, Record History | Four dedicated tabs. Evidence/file library reused. Submitted Forms covers broad record kinds without a Workforce index or fine-grained form facets, and history is capped. F04/F05. [Archive](../../../apps/web/app/records-archive.tsx) |
| 7. Reports | Daily Reports, Weekly Reports, Monthly Reports, Progress Reports, Quality Reports, Inspection Reports, HSE Reports, Delay Reports, Contractor Reports, Action Reports, Document Reports, Custom Reports | Daily supervision and day overview exports. Period sections serve weekly/monthly, progress, quality, inspections, HSE and delay. Contractor/action/documents have register reports. Custom reports use period section selection/filters. Confirm client-specific layouts, planned versus actual, confidentiality, export format and consistent period rules (F11/F12). [Register reports](../../../apps/web/app/register-reports.tsx) · [Report models](../../../apps/web/lib/reports) |
| 8. Contractor Portal | Contractor Dashboard, Assigned to Me, Responses & Submissions, Pending Actions, Shared Documents, History | All six sections. Dedicated role shell, shared records and files, deadline states, response forms for NCR/cost-time/delay and other requests, optional external submissions, and returned/resubmitted history. Verify invitation-to-organization onboarding, workflow continuity, response persistence, and optional contractor user administration. F01/F10. [Portal](../../../apps/web/app/portal-app.tsx) |
| 9. Client Portal | Client Dashboard, Project Progress, Reports & Publications, Photos & Site Updates, Shared Project Documents, Items for Client Review, Key Issues & Risks, Milestones & Schedule, Correspondence & Decisions, History & Notifications | All ten sections via the restricted role shell. Published reports and selectively shared photos, documents, issues and decisions. Milestones & Schedule is a list of shared schedule artifacts; Project Progress lists published updates. Confirm legacy migration and that client decisions appear on canonical record and report; verify permissions, file history and publication filters. F01/F10/F12. [Portal](../../../apps/web/app/portal-app.tsx#L163) |
| 10. Management | Project Setup, Buildings & Locations, Contractors & Consultants, Users & Permissions, Work Packages, Disciplines, Dropdown Lists, Workflow Management, Notifications, Document Settings, System Settings, Archive Management | Project, building/location tree, parties, users and project roles, work classification, configurable lists/workflows, reminders, document folder/numbering/review settings, readiness/backups/settings, archive and a Portals admin area. Confirm work-package-to-contract and portal restrictions, controlled list history, project timezone/currency, quiet hours, retention and restore. F10/F12. [Management views](../../../apps/web/app/operational-workspace.tsx) · [Lists/workflows](../../../apps/web/app/forms/spec-configuration-panel.tsx) |

## Word sections 1–18

| Section | Client requirement | Audit result |
|---|---|---|
| 1–2.1 | Controlled collaboration and distinct creation, documents, archive, portal, actions and reports. One canonical project record. | Dedicated areas and ID links exist. Workspace still includes saved record lists/search and some legacy alternate intake. The three workflow event streams need unified canonical status across modules. F01/F04. |
| 3–3.1 | Fifteen forms, approved field order/conditional controls/validation/sign-off, permitted drafts; persistent unique number and time, central attachments, archive, triggers, actions and trail. | All destinations and 277 workbook field rows traced. Conditional server validation, complete archive, workflow triggers and follow-up creation have gaps. F01/F03/F04/F08/F14. |
| 4.1 | Default 00–13 taxonomy, configurable, browse and search, one document/file with multiple tags/locations/packages. | Configurable folder list and searchable register. One folder code and one work-package field with multiple building IDs. Multi-category/package tagging and a distinct transmittal workflow need confirmation. F09/F11. |
| 4.2 | Unique number, title, category, discipline, location, originator, type, revision, status, issue/upload dates and actor, reviewer, links, original file and supersedes. | Document/revision/link schema covers these fields. Review document grouping, floor/zone versus buildings and version-specific linkage in field forms. F09/F11. |
| 4.3 | Preserve revisions, show current, role-restricted approval/IFC, append actor/time, notify affected users, warn on superseded links. | Permission checks and history exist. Upload changes current; status notification recipients differ from upload notification recipients. End-to-end superseded-link warning and IFC selection remain open. F09/F11. |
| 4.4 | Search number/title/keyword/file, filter category/discipline/location/originator/status/revision/date, sort number/title/date/revision/status, export, preview/download, configured outstanding submissions only. | Common fields and basic register export implemented with fixed query caps. Verify revision sorting/filtering, actual date cutoff in exports and configured planned submittals. No committed schedule model for outstanding requirements found in this path. F11. |
| 5.1–5.3 | Submitted Forms, Photo Library, Attachments and Record History. Original files and IDs, upload identity/time, location, source link/work package, evidence type, caption/taken date, visibility; permitted filters. | Four archive tabs and private links. Field order/metadata in workbook trace. Retention of original bytes, per-photo capture data, Workforce index, filtering and history depth are partial. F04/F05. |
| 6.1 | Contractor dashboard, own assignments, responses/submissions, actions, history, optional deliberately shared documents. | All sections exist. Local DB permission isolation passed. Browser proof of the complete contractor journey is still open. F01/F10. |
| 6.2 | CO justification/cost/time; TI acknowledge/questions/implementation; NCR cause/correction/target/evidence; agreements acknowledgement/sign/action; delay explanation/dates/mitigation; inspection request coordination/evidence. | Portal models expose generic and type-specific response controls with evidence. Confirm every form’s request type, attachments and downstream review requirements in UAT. F01. |
| 6.3 | Contractor organization/contact, assignment time/by, due date, purpose, priority, visibility, status and next action. | Explicit share form and RPC include organization, contact fields and visibility selection. Validate named contact versus organization-wide read and notification semantics. F01/F10. |
| 6.4 | Invite/associate external org and account, profile-specific permissions, optional own-org admin, scope and revocation with history. | CODECO admin user management plus party linking and roles. Optional external user-management UI is not implemented. F10. |
| 7.1–7.3 | Submit, assign, notify, acknowledge/respond, review/return, resubmit, verify/close. Immutable actor/version/round/event metadata and signature evidence. | Separate record, portal and verification workflows cover many stages and events. State, authority, prerequisites and timeline agreement need end-to-end proof. The server accepts stage and actor label inputs that need stronger provenance (F16). Legal/signatory decisions belong to CODECO (F01). |
| 8–8.1 | Server/API and file authorization, organization/project separation, internal notes, audit, sessions, deactivate, private notification previews. | Database RLS and storage gateway, scoped external share, portal-safe projection and account controls. Test coverage for local tenant separation is substantial. Verify production role migration, all offboarding paths and external previews with real configuration. F10. |
| 9 | Central action ID/title/source, owner/party/date/priority, status, evidence, verifier/time/result/closure reason. Contractor completion enters verification. | Action register and contractor “ready” path present. F02/F08 affect source linking and automatic creation. |
| 10 | Open linked items, inspect completion/evidence, result/comments/photos/location/time/verifier, failed-action follow-up and source history. | Queue and history exist. Work transition and selected source linking incomplete. F02. |
| 11 | Daily, weekly, monthly, quality, inspection, HSE, delay, contractor, actions and docs. Existing data, filters, period/cut-off/time and permitted PDF/Excel. | See Reports menu. F11 documents extraction and representation gaps. Confirm exact launch layouts and export type. |
| 12 | Planned/actual if available; actions; NCR/severity/contractor; pending CO/TI; inspections; HSE; revisions; recent submissions/photos; contractor responses; activity links. | Most widgets and links have source implementation. Baseline/schedule unavailable, and count completeness at scale needs validation. F11/F12. |
| 13 | Configure project metadata, locations, organizations and contacts, users/roles, work packages/discipline, lists/sign-off, reminders, document rules, retention/archive. | See Management. Project status and retention values are modeled. Verify operational enforcement and organizational scoping. F10/F12. |
| 14 | Assignment, due/overdue, new response, return, review decision, document revision/review, action and inspection alerts, authenticated links, configurable escalation/quiet hours. | In-app plus email/push dispatch implementations, reminders for portal work and document reviews. Common lead time and dedupe exist. Full event-by-event delivery, inspection schedule/update triggers, quiet hours and escalation recipient setup need validation. F12. |
| 15 | Unique IDs, links instead of duplication, NCR/Action/Response/Evidence/Verification, Document/Revision/Transmittal/Record, Agreement/Party/Action/Acknowledgement, scoped search, canonical timestamps and project-local display. | Main IDs and model links present. Specific gaps in F01/F04/F08/F09/F11/F12. |
| 16 | Responsive/mobile, clear states, accessibility, upload progress/errors, drafts, scale/pagination, previews, backups/DR/monitoring/storage. | Browser fixtures and lint cover selected behavior. See runtime checks in [audit](README.md). Real camera/storage and restore are open. Client decisions on file formats, limits and operations still apply. |
| 17.1 | Assign an NCR on submit, notify contractor, receive correction, review/return, verify and archive. | Form save and separate workflow controls exist. Default authenticated routing on submission and a unified timeline are partial (F01). |
| 17.2 | Revised drawing, transmittal, retained old revision, formal status review and notifications. | Revision UI and DB tests cover retention/history. Confirm current/approved semantics and formal transmittal (F09). |
| 17.3 | TI issue/assignment, linked docs, acknowledge/question/respond, verify/return and preserve history. | TI and signature tests establish local paths. Authenticated portal actions and canonical timeline agreement are still open (F01/F11). |
| 18 | Core → documents → portal → action/verification → reporting/dashboard → hardening. | Features exist at each phase. Hardening and acceptance require closure of open findings and completion of deployment validation. |

## Word section 19 go-live checklist

| Check | Current acceptance |
|---|---|
| Submit and retrieve every configured form | Forms exist. Browser save checks cover 12 worksheet forms directly. Archive does not index Workforce as its own form (F04). |
| Assign and display only in the right contractor portal | Explicit assignment implemented with local RLS coverage. Assignment triggered on submission still partial (F01). |
| Cross-contractor record, evidence, comments and actions isolation | Local pgTAP passed. Confirm actual role assignments and file visibility from deployed accounts (F10). |
| Contractor response, upload and resubmit | Source paths and local SQL tests exist. Full authenticated UI journey across requested response types is open. |
| Authorized review, return, approve/accept, verify, close | Source and SQL tests cover multiple events. Verify cross-module status and required stages (F01/F02). |
| Every round visible with actor and time | Event stores preserve history. Combined archive lacks complete unbounded access and some cross-stream identity (F01/F04). |
| Folder structure, register, revisions and superseded status | Locally implemented. Active revision semantics remain open (F09). |
| Every earlier revision retained | SQL and pgTAP verify earlier revision retention locally. Production original-file retrieval open. |
| Permission-scoped record and document search | RLS and archive/register search exist. Pagination/facets and production access parity remain open (F04/F11). |
| Actions linked from source through verification and closure | Partial due to F02/F08. |
| Stored figures, dates and filters in reports/dashboard | Implemented in common paths. Missing baseline and inconsistent register filtering affect full acceptance (F11/F12). |
| Internal notes/supervisor-only fields excluded from contractor access | Portal form shares use a summary and selected files. Shared document revisions have a distinct metadata and automatic file distribution gap, so this criterion is open (F15). Verify real shares, prior role grants and exports (F10). |
| Revocation blocks future access and preserves history | Local policy and tests exist. Verify deployed sessions, link revocation, cache behavior and prior downloads under approved policy. |

## Word section 20 decisions

1. Approve project role names and permission matrix, legacy client treatment and whether contractor administrators manage their organization’s accounts.
2. Decide which forms contractors can initiate versus respond to, including WO/WC/Workforce submitter roles.
3. Define document review statuses, construction issue authority and which revision remains active during review.
4. Approve numbering, revision conventions and the transmittal process.
5. Decide whether building, package and discipline also restrict contractor access.
6. Approve the signature provider, signatory evidence and contractual/legal meaning of each step.
7. Approve notification channels, reminders, escalation recipients and quiet hours.
8. Approve upload types and limits, storage and backup approach, retention and restore requirements.
9. Approve required launch reports, exact layouts, export formats and client publication rules.
10. Identify required storage, email, scheduling and other project integrations.

Appendices A/B supply definitions and the canonical information flow. Image 15 adds Client Portal and has the same create → assign/publish → respond → verify → archive lifecycle. The major open issue is agreement across each view of the same record (F01).

## Backend surfaces included in the review

| Surface | Evidence reviewed |
|---|---|
| Auth, users, project roles and session lifecycle | Auth/session clients, admin user/role routes, permissions model, role grants and membership SQL. Checked legacy versus new portal behavior against the Word roles and mind map. |
| Form and action data | Operational RPC wrappers, spec persistence and guarded fields, sign-off/version migrations, generated form schemas, offline replay, and role tests. |
| External links and portals | Account-free share token, response and upload endpoints, party-scoped portal shares/events and file permissions, protected gateway and internal versus external fields. |
| Documents and evidence | Private-file routes, upload completion/content checks, original/thumbnail flow, linking/mark-up, revision/read policies and audit tables. |
| Notifications and background tasks | In-app dispatch and portal reminders, email/push environment dependencies, daily cron and backups. Actual deployment and restore were outside the fixture run. |
| Exports, navigation and nonfunctional checks | Report data models and file exports, record routes, language, accessibility/design guardrails and selected Playwright paths. |

## Route inventory

| Entry point | Source purpose |
|---|---|
| `/` | Public landing, sign-in entry and marketing links. |
| `/supervisie` | Sign-in/recovery, project selection, role-aware supervisor/contractor/client shells. Supervisor screens are project navigation and module states in this route. [URL state](../../../apps/web/lib/navigation/screen-url.mjs) |
| `/share/[token]` | Account-free record/evidence response page with a separate scoped server path. This and the authenticated portal are distinct entry points for external responses. |
| `/api/admin/users`, `/api/admin/project-role` | User inventory, invitation/account lifecycle and project role mutation. |
| `/api/storage/uploads`, `/api/storage/uploads/complete`, `/api/storage/files/[fileId]` | Upload claim, completion and protected read/download for project evidence and documents. |
| `/api/external-share/[token]/response`, `/evidence`, `/upload`, `/upload/complete` | Scoped external response, evidence read and upload lifecycle under the same token path. |
| `/api/notifications/dispatch`, `/api/notifications/push-subscriptions`, `/api/cron/daily`, `/api/backups/ensure-daily` | Notification delivery/setup and background maintenance. Requires deployed service configuration and delivery/restore acceptance. |
| `/api/maps/static`, `/api/weather/current`, `/api/speech/transcribe`, `/api/release` | Maps, weather, dictation and deployment metadata, with normal UI fallbacks. |
| `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml` | Platform metadata endpoints. |
