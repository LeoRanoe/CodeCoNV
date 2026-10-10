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
