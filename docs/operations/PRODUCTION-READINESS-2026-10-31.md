# Production readiness: client feedback pass (2026-10-31)

Branch `claude/amazing-tesla-xx8xc7` (PR #11). Everything below ran against a local Supabase stack and local fixture accounts. The production environment file, the production Supabase project and the production Blob store were not read or used. Nothing was merged or deployed in this pass.

This file is the evidence for one pass. The standing checklist is `production-readiness-checklist.md`.

## Release decision

Not released. The code gates below passed. The release itself is blocked on things only the owner can do:

1. Approval to merge PR #11.
2. Applying migration `202610300001_day_closeout_one_field.sql` to the Supabase project before (or with) the deployment, because `lib/release.ts` now expects schema version `202610300001`. Rollback is in the migration header.
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

## Deployment

Not done. Order when the owner approves: apply the migration to a Supabase preview or branch and run `supabase test db` there, deploy the branch to a Vercel preview, run the smoke checks (sign-in, Works ongoing save, one issue with a photo, one share link), then promote. Roll back by promoting the previous deployment; the migration is compatible with the previous app version because it only loosens limits.
