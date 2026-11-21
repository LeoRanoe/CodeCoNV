# Prompt: close every remaining gap against the client's specification

Paste everything below the line into a new Claude Code session in `D:\CodeCoNV`.

---

You are finishing the implementation of the client's developer specification for the CODECO supervision app (Next.js app in `apps/web`, Supabase in `supabase/`). Read `CLAUDE.md`, `apps/web/AGENTS.md`, `docs/product/design-direction.md` and `docs/operations/client-feedback-2026-11-19.md` first.

**Sources of truth**
- Workbook: `C:\Users\lrano\Desktop\Construction_Project_App_Developer_Specification_FINAL_v2.xlsx` (sheets: START HERE, every form sheet, Activity Detail Guide, Shared Dropdown Lists, Sign-off Workflow).
- The client's handwritten notes of 19-11-2026 (already built; listed in the checklist doc). **Where a note and the workbook disagree, the note wins** — do not bring back CO "Reason for change", HSE "Root cause", the old responsible-party list, or remove the client's quick one-box Works day log.

**What already exists (do not rebuild)**
- `apps/web/scripts/generate-spec-catalogue.py` → `lib/forms/spec-catalogue.ts` (all workbook lists).
- `lib/forms/spec-forms.ts` (fields per form, `specMissing`, `cleanSpecValues`, `specFacts`, `setSpecValue`, `withInitial`, `workflowProfiles`), `app/forms/spec-fields.tsx` (renderer).
- `lib/forms/signoff.ts` + `app/forms/signoff-panel.tsx` + DB `record_signoff_events` / `record_signoff_action()` (migrations `202611200001`, `202611200002`).
- Spec values are stored in `findings.issue_management.spec`, `project_register_entries.details.spec`, and `spec` jsonb on `hse_events`, `visual_captures`, `attendance_entries`, `inspections`.

**Gaps to close — verified missing in the merged code (`main` at 05957b1)**

1. **Register-linked fields are free text.** START HERE: "Project, location, user, contractor, supplier, crew and linked-record selections must come from live app registers." Replace text inputs with pickers fed by live data: `action_owner` (project users + parties), `issued_to`, `crew`, `supplier`, `originator`, `agreed_by` (multi-select users/parties), `person_involved`, `people_involved`, `witnesses`, `hse_reviewer`, `verified_by`, `reviewed_by`, `approved_by`. Keep "Other / not in the list" with a short text box. Add a supplier list per project if none exists (parties of type supplier).
2. **Linked-record selectors.** `related_record`, `related_inspection`, `inspection_reference`, `ncr_reference`, `related_observation`, the Works blocker ("link to an Issue or PDR"), and HSE "Related incident" must be a searchable selector over the project's own records (reuse `filterRecordDirectory` / the workspace record search), storing the record id + number, with "add the link later" possible. Show linked records as tappable chips in the record viewer.
3. **Sign-off notifications never fire.** The panel sends only a typed `next_actor`; `p_next_actor_user_id` is always null, so `record_signoff_action` never inserts a notification. Add a project-user picker for "who acts next" and send its id. Add overdue reminders/escalation for sign-off due dates (extend `refresh_project_notifications` or a cron route) — Sign-off sheet: "Notify the next responsible person/role after submission, return, response, approval, rejection or overdue action."
4. **Signed-document attestation.** The DB accepts `evidence_file_id` and `attestation_method = 'signed_document'`; the panel only offers drawing a signature. Add "Upload a signed document/photo" (upload via the existing project file upload, pass the file id).
5. **Sign-off history in exports.** "Allow authorized users to export the history with the form record." Add the chronological sign-off history (action, actor, organisation, role, round, time, comments, status change, signature) to the NCR PDF/Word (`lib/reports/ncr-*.ts*`), the controlled-document PDF/Word (`lib/reports/controlled-document-*`), and per record in the day export (`lib/reports/day-overview-*`). Load events in bulk per project/day.
6. **Two statuses that can disagree.** The workbook Status (`spec.workflow_status`: Open/Assigned/In Progress/Pending Verification/Closed/Cancelled) lives apart from each record's own DB status. Make one the truth: map the workbook status onto the record status where the table has one (findings, hse_events, register entries) and drive it from sign-off actions (verify/close → Closed, return → In Progress …), or remove the separate select and derive it. "Update only from workflow actions; retain prior states in the event log."
7. **Role-restricted status choices.** Any user can pick Approved/Rejected (CO `approval_status`), Closed (`workflow_status`), Approved for Sharing (LL `review_status`), Inspected - Accepted/Rejected (WC), Accepted (delivery inspection result), Verification result. Restrict these options to users with `findings.verify` / `reports.review` (HSE: `hse.manage`, inspections: `inspections.manage`) in the UI and enforce in the DB (trigger on the spec objects, or route those changes through a definer function). Approval needs approver + date recorded automatically.
8. **Works Ongoing time bug.** `specMissing("works_ongoing")` blocks a finish earlier than the start unless `crosses_midnight === "yes"`, but no control sets it. Add a "Crosses midnight" checkbox shown when finish < start.
9. **Missing workbook fields.**
   - HSE: **Risk rating** (required; computed from likelihood × severity when a project risk matrix is configured, otherwise a controlled rating list — never an invented number). Add a project setting for the matrix.
   - Materials delivery: **Material category** dependent on the group (workbook sheet gives groups and categories; current form only has the group), **Received by** confirmation by a supervisor.
   - Works Ongoing/Completed: **Quantity "N/A where not measurable"** toggle, **secondary discipline** option, Works Completed **photo evidence "recommended"** hint, structured **Building / area** + **exact location** use the Project Location Register (`location_nodes`) rather than text.
   - Photos: the **photo purpose** is asked only in the photo detail view; ask it at capture/upload time too (`visual-evidence-workspace.tsx`, `photo-evidence.tsx`), and support the dependent photo category.
   - NCR containment: per containment action record **responsible person, date/time implemented and evidence**. NCR verification "Not Effective / Rework Required" must **reopen** the corrective action.
   - HSE incident: **multiple corrective actions each with owner and due date** (create linked actions via `createProjectAction` instead of one textarea); notification log with timestamp per authority.
   - Agreements: when several actions exist, **create separate linked action records** (owner + due date each).
   - Lessons learned: "Approved for Sharing" lessons available **across projects** (an organisation-wide lessons list).
10. **Sensitive incident data.** `people_involved`, `witnesses`, `injury_*`, `body_part` are in `hse_events.spec`, readable by every project reader and printed by `specFacts` in the day export and the record viewer. Restrict: hide these keys unless the user has `hse.manage`, never print them in exports, and keep them out of the frozen sign-off snapshot (extend the confidential stripping in `record_signoff_action`).
11. **Version control on material change.** "If material fields are changed after submission, create a new version and require the relevant approvals again." When a submitted record is edited, record a `resubmit`-required state (or auto-append a "Reopened — edited after submission" event) and show it in the panel.
12. **Parallel review / multiple signatories / approval limits / delegation.** Make workflow profiles, stage roles, required signatories, due dates and approval limits project-configurable (Management → project settings), and enforce "all designated approvals before proceeding" for parallel stages. Ask the user for the client's actual roles and limits before inventing values.
13. **Reporting filters.** "Test … reporting filters across all forms." Add filters by discipline, type/category, status and priority to the record lists, the workspace search and the period report, reading the `spec` objects.
14. **Configuration governance.** Lists marked project-configurable (shifts, units, crews, storage locations, severity definitions) need an admin UI; controlled classifications versioned so historical records keep their stored value (they already store the label — keep that).
15. **Dutch.** The workbook lists show in English only; add Dutch labels (store the English value, display the translation), or confirm with the client that English is intended.
16. **Inspections form.** The Sign-off sheet defines INSPECTION-WITNESS (done via the viewer), but there is no Inspections form sheet; confirm with the user whether inspections need extra fields beyond the existing checklist.

**How to work**
- Work from a checklist (update `docs/operations/client-feedback-2026-11-19.md` per item: done / interpreted / open).
- Additive migrations only, patch functions in place like `202610280002` and `202611200001`, keep fallbacks for missing columns, bump `lib/release.ts` `expectedSchemaVersion`, add pgTAP tests (`supabase/tests/030_…`), unit tests (`tests/spec-forms.test.mjs`), and e2e coverage (`tests/e2e/spec-fill.ts` already fills spec fields).
- Never run seeders or e2e against production (`apps/web/.env` is production). Local gate: `bash tmp/full-gate.sh` with the fake-Blob stack (`node tests/e2e/fake-blob/run-stack.mjs start`); `npm test` runs a build, so don't run it while the e2e server is up.
- Follow the design rules in `CLAUDE.md`, run the UI stability audit, keep copy quiet and factual.
- Open a PR, get CI green, apply migrations to production (`dljbeheogaeviokpcvca`) only after CI's database job passes, then merge.
- Items 12, 14, 15 and 16 need the client's input: ask the user before building them.
