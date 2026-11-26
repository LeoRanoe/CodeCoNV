# V5 overnight handover (25-11-2026)

Branch `codex/codeco-launch-readiness`. Details: `V5-QA-REPORT.md` (what was run), `V5-DECISION-REGISTER.md` (decisions, client-confirmed or inferred), `V5-REQUIREMENTS-TRACEABILITY.md` (requirement to evidence), `V5-IMPLEMENTATION-REGISTER.md` and `V5-GAP-REPORT.md`.

## Built in this run

Issue-card Verify / Return dialog; report builder group by, summary versus full, contractor responses, photos and logs in Excel; photo Record ID with auto bar (migration 202611250013); Actions contractor filter; "Pending verification" label; delivery acceptance for traceable material groups (migration 202611250014); side-by-side documents and a deterministic assistant in the compliance check; signing popups on inspections and field notes; numbered sections on all 12 sheet forms; a walk of the Client and Contractor Portal submenus, which found and fixed a broken "View as".

## Commits (oldest first)

`da246d5` baseline of the earlier rounds, `558496f` Verify / Return dialog, `d4ef6f7` report structure, `2eb4897` photo IDs, `3a07394` Actions filter, label, delivery rule, `d1b9026` compliance viewer and assistant, `ed596cc` inspection popup, `91afd21` field note popup, `64e94a0` View as fix and portal e2e, `48eca59` sections on all forms and schema version, and the last commit (h3 headings, test fixes, visual evidence spec, documentation). Pushed to `origin/codex/codeco-launch-readiness`; no pull request exists for the branch and none was created; nothing was merged or deployed.

## What I need from the client

1. Work before or after Location on the Works forms (D-11). I kept the workbook order.
2. Units: the 16 of the Excel replace the 13 approved on 22-11-2026 (D-20).
3. Word section 20 (document numbering, e-signature provider, file size, retention): provisional defaults (D-22).
4. The bestek clause lists per material group for Rapid Verify, and which material groups need a compliance check (I used the four the workbook marks traceable, D-09).

## Not built

A schedule that produces and sends the PDF / Excel itself (it only sends the "ready" notification, D-16); Materials to purchase order (there is no PO record, D-17); contractor scoping of Actions (A-03).

## Production readiness

Not declared. Local verification is complete and green except one rate-limit flake that passes alone. Before production: apply migrations 202611250006 to 202611250014 to a staging database and run the pgTAP and Playwright gates there; open the side-by-side viewer and the assistant with real documents; look at the screens on a tablet; get answers to the four questions above; then follow the release procedure in `codeconv-production-deploy` (pull request, CI, merge, Vercel).

## Recommended next action

Open a pull request from the branch, let CI run, and deploy the preview to a staging project with the nine new migrations; then give the client the decision register for the four open questions.
