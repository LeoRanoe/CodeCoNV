# CODECO user acceptance test

Run the full workflows locally with synthetic data. After the local run, repeat the production parity check against the revision that passed UAT. A matching app revision and expected migration are release evidence. Signed-in production roles, applied database migrations, real media, push, email and backups need their own evidence.

## Start on Windows

1. Open Docker Desktop and wait for it to be ready. Run the following from the repository root in a dedicated PowerShell terminal. Node.js, npm and PowerShell 7 are required.

   ```powershell
   pwsh -NoProfile -File apps/web/scripts/uat-local.ps1 -Mode Browser
   ```

2. Keep that terminal open. When it says Ready, open `http://127.0.0.1:3090/supervisie` in Claude's built-in browser. Use **Paramaribo Field Readiness Demo**. The launcher verifies the local Supabase address, applies pending local migrations without resetting it, seeds synthetic fixtures and starts a production-mode Next.js build with a fake local file store. It prints the test accounts. Screenshot evidence and uploaded fixtures must stay synthetic.

3. Paste [CLAUDE-UAT-PROMPT.md](CLAUDE-UAT-PROMPT.md) into Claude and provide the [source register](UAT-SOURCE-REGISTER.csv). For a browser exposed from a remote machine, its loopback may differ. If the URL cannot be opened, run Claude with a browser on the machine running the launcher and retry. Use the local test accounts only at the local URL.

4. To run the separate automated check, stop the browser-mode launcher with Ctrl+C if you started it, then run the following. It starts its own app on the same ports. The script does not stop or reset Supabase afterward. The manual tests below are still required. Automated test artifacts are in `apps/web/test-results/uat-automated`.

   ```powershell
   pwsh -NoProfile -File apps/web/scripts/uat-local.ps1 -Mode Smoke
   ```

### Local fixtures

| Role | Sign-in | Password |
|---|---|---|
| Supervisor / fixture project administrator | `supervisor-a@codeco.test` | `Local-E2E-Supervisor-A-2026!` |
| Contractor | `contractor-a@codeco.test` | `Local-E2E-Contractor-A-2026!` |
| Client portal approver | `client-portal-a@codeco.test` | `Local-E2E-Client-Portal-A-2026!` |
| Legacy read-and-sign client | `client-a@codeco.test` | `Local-E2E-Client-A-2026!` |
| Supervisor of another organization | `supervisor-b@codeco.test` | `Local-E2E-Supervisor-B-2026!` |

Use the other organization's account only for the local isolation check. Use separate browser sessions or sign out completely when changing roles. Generated JPGs and a PNG drawing are in `apps/web/test-results/uat-fixtures`. Use a `UAT-YYYY-MM-DD-HHMM` prefix and unique case ID on new records so a retry can be distinguished from a duplicate submission. Treat reused demo records as read-only inputs unless a case explicitly calls for a new fixture.

## Acceptance baseline

Use the original Excel workbook, Word specification and images 1–15, plus the recorded [client decisions](DECISIONS-PENDING.md) and [completion checklist](COMPLETION-CHECKLIST.md). The sixth-pass decisions are the baseline. Record the local `/api/release` response, the Git revision, browser, viewport and test time in America/Paramaribo. Mark each case **Pass**, **Fail**, **Blocked**, or **Not run**. A pass requires an observed result. Record a screenshot, record number, export filename or exact UI message when appropriate.

## Required source-by-source results

Complete a copy of [UAT-SOURCE-REGISTER.csv](UAT-SOURCE-REGISTER.csv). The W, M and J tables below are browser journeys. The CSV is the acceptance record that proves what each journey covered. It contains **1,079 source entries**, including source headings and context:

| Source | Entries | What to verify |
|---|---:|---|
| Mind map (image 15) | 119 | All 10 named areas and 100 named items, including each of the 14 document folders. Test four roles and record evidence for each of the five workflow steps. A named item can be a working view or filter. Capture the path and result for every item. |
| Excel | 592 | All populated rows in all 17 sheets, including the 277 form rows, the 147 activity rows, shared dropdowns, workbook-wide guidance and each sign-off row. Check each relevant field's control, order, configured options, display and requiredness conditions, saved result and role restrictions. |
| Word | 368 | Every text-bearing body paragraph and table row across sections 1–20, both appendices and the front matter. For rows with several conditions, state the observation for each condition. Include go-live checks, operational requirements and approved client decisions. |

- Work in batches by mind-map area, worksheet or Word section. Keep the four source columns unchanged and update `status`, `observed` and `evidence` for every ID. Record every failed, blocked or unrun case. For alternative branches or several obligations in one row, name every branch in `observed` and link its evidence. The row cannot pass while a clause in it is untested.
- Reuse evidence across source IDs when the same observation actually proves each requirement. For the 147 activities, use deterministic catalogue comparison where applicable, and browser evidence of prompt display, responses, reset and reopen. Record exactly which rows have direct browser observations and which rely on automated evidence. A sample alone leaves the other rows unverified.
- Use `Reference` for headings, glossary definitions and front-matter context, with an explanation and a reference to any related test. Use an applicable decision with its exact source to explain an approved condition or exclusion, then test the resulting behavior. Checking a page exists is insufficient evidence for its features, permissions or workflow.
- Link verified backend, integration, production, device or operational evidence to the same source IDs. If a check cannot run in Claude's browser, record it as `Blocked` or `Not run` with its dependency. Keep images 1–14 in journey J06 and record an individual result per annotation.
- Name the finished copy `UAT-SOURCE-RESULTS.csv`. From the repository root, run the checker. It rejects missing, altered or duplicate source IDs, blank results, and Pass/Fail results without evidence. It exits unsuccessfully when any row is failed, blocked or unrun. Review the evidence itself before acceptance.

  ```powershell
  python apps/web/scripts/uat-source-coverage.py --check-results path/to/UAT-SOURCE-RESULTS.csv
  ```

The [register generator](../../../apps/web/scripts/uat-source-coverage.py) reads the two original Desktop files by default. To rebuild the blank register from another location, install `openpyxl` if needed and pass `--xlsx`, `--docx` and `--output`. Keep run results in a separate file. The original workbook SHA-256 is `837c27056afdbab29d44458bc73de7cff1abb5b324fbe772b82d66963532c19d`, and the Word SHA-256 is `71151ed5262b9c724433a94aa492c906530853370da2c61742056ab42b5fb33f`. Reconcile any client revisions against the new source before using results from an earlier version.

## Workspace forms

For every case, open the tile, confirm the saved record uses its own form name, exercise the relevant required-field error, save with valid data, and find the same record in the archive or its configured register. Compare labels, order, options and conditional visibility against that form's source. For applicable cases, verify attachments, sign-off, allowed changes and history after reopening.

| ID | Form | Acceptance check |
|---|---|---|
| W01 | Works Ongoing | Pick a discipline and activity. Answer its prompts, change discipline and confirm old activity/prompt values clear. Verify structured work location and quantity/unit rules. |
| W02 | Works Completed | Save completed work and retrieve it in Rapid Verify. Verify pass, fail and partial/further-action behavior on separate records. |
| W03 | Workforce | Record attendance for two buildings. Compare totals, check that visitors are excluded, and explain a deviation before confirming. Verify the saved result. |
| W04 | Project Delay Report | Save without optional evidence. Save another with evidence. Verify the conditional schedule fields, record history and upload result. |
| W05 | Issue | Check the ten responsible-party options and absence of the duplicate owner field. Verify severity/due date and evidence or follow-up where applicable. |
| W06 | HSE observation | Select an action owner from the project register. Verify corrective action, contractor acknowledgement and restrictions. |
| W07 | Materials Delivery | Check the three groups, dependent categories and named units. Change the group and verify category resets. Exercise scheduled delivery and accepted materials stored on site. |
| W08 | Inspections | Start and complete an inspection against a template. Record evidence and findings, then verify the result and follow-up from Rapid Verify. |
| W09 | Technical Instructions | Select a specific drawing revision, discipline/category and intended recipient. Verify acknowledgement, contractor response and dated history. |
| W10 | Change Order | Confirm Reason for change is required and scope is not asked twice. Check schedule and cost paths, linked revision and the authorized signing workflow. |
| W11 | NCR | Confirm Type and Category precede Title and Description. Use a pinned exact revision, contractor correction and verification. The NCR marking entry offers ordinary photos. |
| W12 | Lessons Learned | Check worksheet order, phase/category dependency and optional attachments, with a single attachment control. |
| W13 | Agreements Made | Test with and without an action. Confirm an action with the correct owner and due date is created once when required. |
| W14 | HSE Incident Registration | Exercise a case requiring injury details and a case that does not. Verify conditional fields, generated follow-up and restricted details using allowed and denied roles. |
| W15 | Photos | Require purpose and location, check the optional 17-discipline list for every purpose, and retain the discipline across a purpose change. Exercise batch capture, timestamps, captions, original versus marked file, and a link to an existing record. |

## Menu, role and workflow coverage

| ID | Area or journey | Acceptance check |
|---|---|---|
| M01 | Overview | Counts, activities, progress, due work and unread alerts reflect fixtures. A project without a baseline does not show invented planned figures. |
| M02 | Workspace | All 15 destinations appear for the authorized supervisor. Navigation, back, and archive reopen retain the right project and form context. |
| M03 | Actions | Open/overdue/mine and project filters, assignment, corrective records, completion and linked source history agree. |
| M04 | Rapid Verify | Exercise pass, fail, partial and further-action states. Failure creates one linked corrective action. Partial and further action remain awaiting inspection. |
| M05 | Project Documents | Compare approved revision A and pending B, transmittal details, review, release, precise revision links, withdrawn release and register exports. |
| M06 | Records & Photos | Search by the actual saved record number and filter by building or role. Verify original and annotated photo access, history and a reopened record. |
| M07 | Reports | Check visible totals against test records. Download available XLSX and PDF, including a period XLSX and register export. Check period, cut-off, filters, timestamp, contents and role visibility. |
| M08 | Contractor Portal | Show only records assigned or shared to that organization. Acknowledge, respond with evidence, handle a return and resubmit. No Workspace creation or unilateral close. |
| M09 | Client Portal | Show only released items for the entitled account. Exercise an assigned review and verify the result. Pending documents and internal records remain out of view. |
| M10 | Management | Check configured project parties, locations, templates, lists, roles and settings with the local administrator. Confirm a restricted role cannot make changes. |
| J01 | Word §17.1 · NCR | Submit an NCR for the fixture contractor. Verify automatic assignment once, respond with evidence, return and resubmit, verify and close. Check linked history, actor, time and final status. |
| J02 | Word §17.2 · revised drawing | Upload B while approved A stays current. Confirm B cannot be shared before approval. Approve and release B, use intended client review and verify visibility after withdrawal. |
| J03 | Word §17.3 · TI | Issue and acknowledge a TI linked to the exact earlier drawing revision. Upload and approve a later revision. Confirm the TI retains its original revision and the stale-reference indication is correct. |
| J04 | Role boundaries | Reopen a local project deep link as the other organization, legacy client, portal client and contractor. Verify the expected allowed and denied reads and actions using the role matrix. |
| J05 | Field resilience | Test save retry and double submit, reconnect after offline photo capture, original retrieval, invalid file and missing permissions. Verify no duplicates. Record capabilities the Claude browser cannot emulate. |
| J06 | Annotated feedback | Check images 1–14 individually, including form heads and crossed-out controls, attendance save, three-step drawing Undo/eraser, ordinary-photo-only NCR marking, and the photo canvas. Check image 15 against the 10 menu areas and roles. |
| J07 | Devices and accessibility | Check desktop, tablet and phone widths, keyboard focus and names, long content, save buttons and scrolling in markup. Use real phones/tablets for camera and touch acceptance. Simulated widths are layout evidence. |

## Production check after UAT

Use the exact local commit recorded in the result. Run from the repo root. Use `--ref HEAD` only when HEAD is still the accepted candidate. Fetch the deployed commit if it is absent locally.

```powershell
cd apps/web
npx playwright install chromium
node scripts/uat-production.mjs --ref HEAD
```

The script contacts only the public CODECO deployment as the navigation target. It compares the live commit to the candidate source and migration files, checks the sign-in page at 1280 px and 390 px, and saves `test-results/uat-production/report.json` and screenshots. It uses a fresh browser context without credentials, blocks non-read methods, and makes no record changes. Different commits can match after a squash merge. Audit documents and these UAT harness files are excluded from the source comparison. The report records local app/migration working-tree changes separately.

Setup verification on 21 November 2026, Paramaribo time. The local launcher built and started `9e9c92b`. The Materials Delivery browser spec saved a valid record after exercising its dependent category, and the contractor and client approver fixtures reached their portals. The live browser check passed both sign-in widths and matched the application and migration source at `0446de33285f`. The app expects migration `202611250001`. The linked database migration-history lookup returned HTTP 403, so current applied-migration evidence comes from the earlier authorized release record. The full Claude UAT and the signed-in production walkthrough still need results.

- [ ] Save the public browser report. Confirm commit or source parity and the expected schema.
- [ ] Obtain fresh applied-migration evidence from an authorized operator for the actual production project. Compare every expected version with the production migration history. `/api/release` reports an expectation. The prior authorized release record is in the completion checklist.
- [ ] With an approved production account, perform a signed-in observational check of the intended role menus and permitted existing records. Use local or authorized staging fixtures for create/submit/share/approve/withdraw tests. Any writes on a live production test project need explicit authorization and an agreed cleanup plan.
- [ ] Record real-device camera/media acceptance, configured notification delivery (including real email/push), storage and original retrieval, monitoring and a restore drill. A local fake provider is evidence for app handling only.
- [ ] Record the product owner's UAT acceptance, or list the cases still awaiting a result. Recheck parity if the live deployment moves during UAT.

## Result template

Save or return a Markdown report with the following fields. Do not include passwords or share tokens.

```text
Run ID and time (America/Paramaribo):
Local URL / release commit / expected migration:
Browser and device widths:
Original client sources available:
Source result CSV and checker output:
Counts by source and status:
Untested branches and evidence limitations:

| Case | Role | Status | Expected | Observed | Record ID or evidence | Severity |

Failures and reproduction steps:
Blocked or not-run cases and why:
Production parity report and deployed revision:
Actual production migration evidence:
Signed-in production and real-device checks:
Acceptance recommendation:
```
