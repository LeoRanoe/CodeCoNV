# Production readiness: client feedback pass (2026-10-31)

Branch `claude/amazing-tesla-xx8xc7` (PRs #12 and #13; #12 was merged by the owner on 2026-10-31, #13 holds the later commits). Every test below ran against a local Supabase stack and local fixture accounts. The production environment file was never read and no test or seed ran against production. Two read-only lookups were made on hosted services: the list of applied migrations on the production Supabase project, and the names, targets and deployment history of the Vercel project (no values decrypted). Nothing on production was changed.

This file is the evidence for one pass. The standing checklist is `production-readiness-checklist.md`.

## Release decision

Code gates passed. `main` is already deployed to production (PR #12), but production's database is nine migrations behind the repository (see "Production database state"). What only the owner can do:

1. Approval to apply the nine pending migrations (`202610100005` to `202610300001`) to the production Supabase project, in file order, with a backup first. `lib/release.ts` expects schema version `202610300001`. This also covers `202610300001_day_closeout_one_field.sql`, whose rollback is in its header.
2. Approval to merge PR #13 (pin colours, return for correction, Rapid Verify comparison; no migration).
3. A check of photo, 360 and drawing flows against the real Vercel Blob store on a preview (they pass on the fake store).
4. Answers to the client questions in `CLIENT-FEEDBACK-RECONCILIATION.md` ("Still open").

## Gates

| Gate | Result | Evidence |
|---|---|---|
| Type check (`tsc --noEmit`) | Pass | Run after the last code change. |
| Lint (eslint and stylelint) | Pass | Run after the last code change. |
| Unit and static tests (`npm test`) | Pass, 223 of 223 | Includes release identifier, design guardrails and the updated Works ongoing assertions. |
| Database tests (`supabase test db`, after `db reset`) | Pass, 25 files, 607 assertions | Includes 025 (day close-out one field, 7 tests) and the isolation, permission and share suites 001 to 024. |
| Browser tests against a production build | Pass: 93 passed, 0 failed, 78 skipped, 171 total | 57 tests at each of three viewports (phone 390, tablet 820, desktop 1280). The skips are by design: some specs run at one viewport only (for example the mobile-only and desktop-only cases in `field-readiness`, and the address checks in `role-views`). |
| UI stability audit | Pass: 72 screens, 0 findings, worst layout shift 0.004 | Part of the run above. |
| Offline | Pass | `offline-app`, `offline-create-and-sync`, `offline-records`, `offline-account-isolation` in the run above. |
| Tenant isolation | Pass | pgTAP suites; `offline-account-isolation` (second account on one device cannot read the first's data); `role-views` (client and contractor see only what the role allows; a link to an unreachable project says so). |

Second run, after the drawing pin colours, return for correction, Rapid Verify comparison and photo preview fix, on the fake-Blob stack (`CODECO_E2E_FAKE_BLOB=1`, whole suite, production build): 149 passed, 1 failed, 144 skipped by design (14 minutes). The one failure, `first-load.spec.ts`, saw a 429 from the local `/api/weather/current` rate limiter during the long run; it passes on its own. `npm test` ran 223 of 223 before the new Rapid Verify unit file was added to the script; its 5 tests pass separately.

Specs in the first browser run: controlled-document, two-party-signature, inspection-workflow, day-report-lifecycle, works-ongoing-one-field, dialogs, role-views, mobile-forms, field-readiness, layout-hygiene, offline x4, responsive-audit, responsive-workspace, viewport-walk, double-submit, ui-stability-audit.

What this does not cover: the real Vercel Blob store (the fake store replaces it), the colours of the drawing pins by eye, and anything on real devices.

## Database change

`supabase/migrations/202610300001_day_closeout_one_field.sql` replaces four check constraints on `day_closeouts` so a close-out saved from Works ongoing can hold just a short `day_summary`:

| Column | Old minimum | New range |
|---|---|---|
| `day_summary` | longer minimum | 3 to 700 characters |
| `weather_summary` | longer minimum | up to 180 |
| `work_performed` | longer minimum | up to 1200 |
| `tomorrow_plan` | longer minimum | up to 1000 |

It only loosens limits: no data is changed, no column or policy is added or removed, and existing rows still satisfy the new checks. Row-level security is untouched. Rollback: re-add the old constraints (the header of the migration has the statements); this fails if a row shorter than the old minimum has been saved since, in which case those rows must be edited first.

`submit_day_report_for_review` keeps its own gates (project start confirmed, a close-out per building), so a day made only of Works ongoing entries still cannot be submitted for review until the full day is filled in. That is intended.

## Security notes

- The WhatsApp export contains the client's login for the live app. It was not used, and it is not copied into any document in this repository. Consider asking the client to change that password, since it sits in a chat export.
- No service-role key, token or password was written to any file in the repository. The local fixture credentials in `tmp/` and the scratchpad are for the throw-away local stack only.
- The new save path updates only the columns the form owns, which also removes a way to overwrite another form's answers.
- Not performed: a dependency vulnerability audit, penetration testing, and a review of the production Vercel and Supabase configuration. Those need the owner's access.

## Residual risks

| Risk | Mitigation |
|---|---|
| Schema and app drift: the app expects `202610300001` | Apply the migration first. `/api` release info reports the expected version, so a mismatch is visible. |
| Photo, drawing and 360 flows unverified after this pass | Run the fake-Blob e2e stack (`npm run dev:blob`, `CODECO_E2E_FAKE_BLOB=1`) or test on a Blob-enabled preview before release. |
| Restored palette not re-measured for contrast | It is the palette that passed the earlier audit; measure it on the preview. |
| Open client decisions (see reconciliation) | Ask before building; none of them is a regression. |

## Production database state (read-only check, 2026-10-31)

PR #12 was merged on 2026-10-31 at 10:18 UTC and Vercel deployed `main` to production (deployment of commit `29c85ea`). Nothing in the CI workflow applies migrations. The list of applied migrations on the production Supabase project (metadata only; no data was read or changed) ends at **`202610100004`**. The repository is nine migrations ahead:

| Migration | What it does | Why it matters in production |
|---|---|---|
| `202610100005_external_response_respects_record_status` | A contractor link can no longer overwrite a corrective action or signature on an NCR that is ready for verification or closed. | Security and data integrity: without it a signed statement can be overwritten by whoever holds the link. |
| `202610280001_ensure_day_report_for_record` | A role without report rights (the contractor) can still save a record that hangs on a day report. | The app calls `ensure_day_report_for_record`; contractor saves fail without it. |
| `202610280002_register_entry_accepts_ensured_day_report` | Register entries accept that day report. | Same contractor save path. |
| `202610280003_creator_sets_record_buildings` | The creator of an RFI, RFA, WCR or WIR may set its buildings. | Contractor saves end in a 403 without it. |
| `202610280004_day_report_honest_blanks_and_snapshot` | Expected workforce and building progress may stay empty; frozen report carries parties. | Day report forms and the formal report. |
| `202610280005_profile_phone_not_for_colleagues` | Colleagues can no longer read each other's phone number. | Privacy. |
| `202610280006_save_inspection_responses_batch` | Finishing an inspection stores all checklist answers in one transaction. | The app calls `save_inspection_responses_batch`. |
| `202610290001_action_without_assignee` | An action can be created before an employee is chosen. | Action creation in a project with no company employee. |
| `202610300001_day_closeout_one_field` | Loosens four `day_closeouts` check constraints. | Works ongoing as one field cannot be saved without it. |

None of the nine contains `drop table`, `drop column`, `delete from` or `truncate`. They have all been applied from scratch on the local stack, the pgTAP suite (25 files, 607 assertions) passes after them, and CI runs the same on every push. They have **not** been applied on a copy of production, so how they behave on production's existing rows is untested. Each one only adds or replaces functions, policies and constraints; `202610300001` and `202610280004` change constraints and are the ones to look at against real rows first.

Where some of the code has a fallback for a missing function (`schemaFeatureMissing` in `lib/supabase/operations.ts`) it keeps working, but this pass did not test the production build against the old schema. Treat production as unverified until the migrations are applied and the smoke checks (sign in as supervisor and contractor, save Works ongoing, save an RFI as a contractor, finish an inspection) pass.

Applying them needs the owner's go-ahead: they change the production database. Suggested order: take a backup (the project has daily Blob backups), apply in file order with `supabase db push` against the linked production project from a clean checkout of `main`, run the smoke checks, and record the result here. Rollback for `202610300001` is in its header; the others are additive, and a function can be restored by re-applying the previous migration that defined it.

### Applying the nine migrations (runbook)

The production project is `dljbeheogaeviokpcvca` (Supabase ref). The migration history there uses the repository's own version numbers, so apply them with the Supabase CLI (which records the same versions) and not by pasting SQL into the dashboard or an MCP tool, which would record a different version and make the next `db push` try them again.

Run from a clean checkout of `main` (or of the PR #13 branch; PR #13 adds no migration):

```bash
npx supabase@2.109.1 login
npx supabase@2.109.1 link --project-ref dljbeheogaeviokpcvca
npx supabase@2.109.1 db push --dry-run
npx supabase@2.109.1 db push
```

`db push` asks for the database password; type it yourself, it is not needed anywhere else. The dry run must list exactly the nine files from `202610100005` to `202610300001` and nothing else. At the time of the check production held 2 projects, 1 day close-out, 3 profiles and 56 findings, so the loosening changes (`202610280004` drops two NOT NULL constraints, `202610300001` widens four check constraints) cannot reject an existing row. `202610280004` also rewrites `build_day_report_snapshot` in place by text replacement and raises an error, rolling the file back, if production's version of that function does not contain the text it expects; if that happens, send me the error and I will adapt the file.

Check afterwards, in the SQL editor:

```sql
select max(version) from supabase_migrations.schema_migrations;  -- 202610300001
select proname from pg_proc join pg_namespace n on n.oid = pronamespace
 where n.nspname = 'public' and proname in ('ensure_day_report_for_record', 'save_inspection_responses_batch');  -- 2 rows
select conname from pg_constraint where conrelid = 'public.day_closeouts'::regclass and conname like 'day_closeouts_%_check';
```

Then the smoke checks: sign in as a supervisor and a contractor; save Works ongoing with only the text box and a building; save an RFI as the contractor; finish an inspection; open `/api/release` and confirm `expectedSchemaVersion` is `202610300001`.

If a migration fails, `db push` stops at that file and the earlier ones stay applied; fix forward from the message. Rollback for `202610300001` is in its header.

## Vercel preview check (names and targets only)

PR #12's checks are green on GitHub: browser flows, database migrations with lint and pgTAP, web lint/test/build/audit, and the Vercel preview deployment. The Vercel project has separate **preview** entries for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` and `BLOB_READ_WRITE_TOKEN`, next to the production ones. They are stored encrypted or sensitive and were not decrypted, so this pass cannot say whether the preview points at a different Supabase project and Blob store than production. Confirm that before anyone signs in to the preview with real client data. The migration is not applied to whichever database the preview uses.

## Deployment

Not done. Order when the owner approves: apply the migration to a Supabase preview or branch and run `supabase test db` there, deploy the branch to a Vercel preview, run the smoke checks (sign-in, Works ongoing save, one issue with a photo, one share link), then promote. Roll back by promoting the previous deployment; the migration is compatible with the previous app version because it only loosens limits.
