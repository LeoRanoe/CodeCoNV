# Role and permission matrix — CODECO Supervisie

The canonical defaults a new organization and project get. The database is the source of
truth: `app_private.default_operational_role_permissions(text)` and the organization
bootstrap in `supabase/migrations/`, enforced by row-level security on every table.
`supabase/tests/016_role_permission_matrix.pgtap.sql` fails when this table and the database
disagree; `supabase/tests/002_*` and `015_*` test the boundaries with real sessions.

An organization may change the permissions of its own roles under *Management → Team & rules*.
This document describes the defaults, not what a specific customer configured.

## Roles

| Role | Scope | Who |
| --- | --- | --- |
| `organization_admin` | organization | CODECO application administrators |
| `project_manager` | project | Project lead |
| `lead_supervisor` | project | Lead supervisor |
| `supervisor` | project | Site supervisor |
| `quality_hse_manager` | project | Quality / HSE manager |
| `client` | project | Client or owner representative (read and sign) |
| `contractor` | project | Contractor with an account |
| `external_guest` | project | No default rights; only what is shared explicitly |

A contractor **without** an account works through a share link (`/share/<token>`): one
record, a limited set of responses, no access to anything else. See "External share links".

## Default permissions

✓ = granted by default.

| Permission | org admin | project manager | lead supervisor | supervisor | quality/HSE | client | contractor |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `records.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `records.create` | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| `records.edit` | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| `attendance.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `attendance.manage` | ✓ | ✓ | ✓ | ✓ | | | |
| `actions.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `actions.create` | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| `actions.manage` | ✓ | ✓ | ✓ | | ✓ | | |
| `inspections.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `inspections.manage` | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| `inspections.review` | ✓ | ✓ | ✓ | | ✓ | | |
| `findings.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `findings.create` | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| `findings.manage` | ✓ | ✓ | ✓ | | ✓ | | |
| `findings.verify` | ✓ | ✓ | ✓ | | ✓ | | |
| `hse.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `hse.manage` | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| `files.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `files.manage` | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| `reports.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `reports.readapproved` | ✓ | | | | | ✓ | |
| `reports.create` / `reports.edit` | ✓ | ✓ | ✓ | ✓ | | | |
| `reports.review` | ✓ | ✓ | ✓ | | ✓ | | |
| `reports.freeze` | ✓ | ✓ | ✓ | | | | |
| `reports.sign` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `reports.distribute` | ✓ | ✓ | ✓ | | | | |
| `submissions.read` | ✓ | ✓ | ✓ | | ✓ | ✓ | ✓ |
| `submissions.review` | ✓ | ✓ | ✓ | | ✓ | ✓ | |
| `templates.manage` | ✓ | ✓ | ✓ | | ✓ | | |
| `audit.read` | ✓ | ✓ | ✓ | | ✓ | ✓ | |
| `notifications.manage` | ✓ | ✓ | | | | | |
| `project.configure` | ✓ | ✓ | | | | | |
| `projects.create` / `projects.manage` | ✓ | | | | | | |
| `members.manage` | ✓ | | | | | | |
| `organization.manage` | ✓ | | | | | | |
| `backup.manage` | ✓ | | | | | | |

Notes that follow from the rules behind the table, not from the table itself:

- A report can be signed only after it has been approved and frozen; `reports.sign` alone
  does not allow signing a draft. Signing goes through `public.sign_report_version(...)`,
  which checks membership, the frozen version and the role required by the project.
- The client reads the day report from the moment it exists (`reports.read`) and is the
  reviewer of contractor submissions (`submissions.review`); the client cannot change
  site records.
- A contractor sees its own controlled submissions (RFI, RFA, WCR, inspection request) and
  the files attached to them — not internal findings, HSE events or other parties' documents.
- Every permission is evaluated per project membership. Membership status `suspended` or
  `revoked` removes access immediately; there is no cached grant.
- Organizations are isolated by row-level security on `organization_id`; a user of one
  organization cannot read or address rows of another, also not by guessing ids.

## External share links (no account)

| The link can | The link cannot |
| --- | --- |
| Show the one finding, action, inspection or visual marker it was created for | List or open any other record, project or file |
| Record a proposed correction, "ready for verification" or a reported problem, with name, position and signature | Close, verify, reopen, reassign or edit the record |
| Upload evidence for that record (type and size limited, SHA-256 verified server-side) | Read files that are not attached to that record |

Creating a link is a write-level act, checked by the database (`create_external_share_link`,
migration `202610100003`), not only by the screen: a finding needs `findings.create`, an action
`actions.create`, an inspection `inspections.manage`, a photo marker `files.manage`. A read-only
member (the client) can see the record but cannot hand it to anyone outside. Tested in
`supabase/tests/018_external_share_creation_permission.pgtap.sql`.

Links are random tokens stored only as a SHA-256 hash, expire, and can be revoked. Responses
and uploads through a link are rate limited. The
contractor's response only fills the contractor's own fields; verification and closing stay
with a user who holds `findings.verify`. Tested in
`supabase/tests/015_external_ncr_contractor_boundaries.pgtap.sql`.

## Service role

Server routes that use the Supabase secret key (cron, notifications, share links, upload
completion) run as `service_role`. Migration `202610060005_service_role_explicit_grants.sql`
grants exactly the table privileges those routes use. See "Grant drift" in
`production-readiness.md`: the hosted project currently has broader default grants than the
migrations describe.

## Signatures on documents and records

Who signs what, and what the database guarantees (migration `202610100004`, tested in
`supabase/tests/019_controlled_document_signatures.pgtap.sql` and
`apps/web/tests/e2e/two-party-signature.spec.ts`, `inspection-workflow.spec.ts`).

| Document | Issuer / author | Recipient | Where the recipient signs |
| --- | --- | --- | --- |
| Technical instruction (TI) | CODECO user, own account name | Contractor representative: acknowledges in writing | Formal response (signature required to acknowledge) |
| Change order (CO) | Supervision approval = the issuer, own account name | Contractor representative (name, position, signature) | Section 5 of the form |
| Environmental report (ER) | CODECO user, own account name | None | – |
| RFI, RFA, WCR, WIR | The submitting person (name as on the received form) | CODECO / client responds | Formal response (signature optional, own account or captured on device) |
| NCR | Engineer signs; contractor signs the correction; quality control signs the verification | see NCR | NCR form / share link |
| Inspection, HSE report | The person who walked it, own account name | None | – |
| Agreements Made | Both parties sign | Both parties | Agreement form |

Rules the database enforces:

- A stored signature (columns and the copy inside `details`) cannot be replaced or removed by
  editing the record. The same holds for the change order's contractor and supervision signatures.
- The response log (`details.response`, `response_history`) changes only through
  `respond_to_controlled_project_document`, never by rewriting `details`.
- A document CODECO issues (TI, CO, ER), an inspection and an HSE report are signed under the
  signed-in account's own name; a typed name is replaced. A received contractor form keeps the
  submitting person's typed name.
- A recipient signature records who captured it (`responded_by_name`), the server's moment of
  signing and whether it was `own_account` or `on_device` (the recipient signed on the capturing
  user's device). The recipient cannot be the issuer and an unissued document cannot be
  countersigned.
- A signature moment is never in the future. Business times are Suriname time (America/Paramaribo).

A signature drawn in the app is a handwritten image with a name and a moment. It is not a
qualified electronic signature; the legal level of a document stays a decision for CODECO.
