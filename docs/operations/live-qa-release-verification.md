# Live QA — release verification

Branch `qa/live-website-audit` (from `main` at `1fe8f1c`). Status words follow
`final-release-verification.md`: **Verified** (operated or run, result recorded), **Source only**,
**Blocked** (cannot be run here; the missing thing is named), **Open**.

## Verdicts

| Verdict | Result | Why |
| --- | --- | --- |
| FUNCTIONALITY | **NOT READY** for a blanket "everything works" | Two P1 data defects found on `main` (row caps, contractor link overwriting a signed answer) are fixed on this branch but not yet on production; media, drawings and 360° markers could not be exercised end to end |
| USER EXPERIENCE | **READY with notes** | No overflow at 1440/1280/820/390/360 on 150 screens; small touch targets (P3) and a duplicate `h1` remain |
| SECURITY | **NOT READY until `202610100005` is on production** | A closed or waiting NCR can still have its signed corrective action rewritten through an unexpired link on the current production database |
| PRODUCTION | **NO-GO for certifying "verified"**; deploying the app code is safe on either side of the migration | Open: hosted migration, `www.codeconv.com` not attached, no Blob-backed end-to-end run, no real phone |

## Identity of what was tested

| Item | Value |
| --- | --- |
| Production URL | `https://code-co-nv.vercel.app/supervisie` (the only domain on the Vercel project) |
| Production release | `GET /api/release` → `commit 1fe8f1cb1110`, `branch main`, `environment production`, `deployment dpl_9eaBkJJDyoNP6XayFDquaBEkvr3u`, `expectedSchemaVersion 202610100004` |
| Production database | Supabase `dljbeheogaeviokpcvca`; `list_migrations` shows every migration through `202610100004`; 83 backups, daily and verified through 10 Oct 2026 04:10, monthly restore tests passed on 26 Jul, 24 Aug, 22 Sep |
| Staging database | `rtuaumbiviwgikthyfmr` (`codeco-staging`), same migration list as production |
| Role used on production | CODECO Administrator (the user's signed-in session), read only |
| Local stack | Supabase CLI 2.109.1, Postgres 17, migrations through `202610100005` |
| Code under test | branch `qa/live-website-audit`, commits `6b48a68`, `a07a7fb`, `c4aea58`, `f1a2a6c`, `aceece3`, plus the documentation commit that follows |

## Automated results on the final code (local)

| Check | Result |
| --- | --- |
| ESLint (`app lib tests next.config.ts`) | 0 problems |
| `tsc --noEmit` | clean |
| `next build` | succeeded |
| Node unit and source tests | 111 pass, 0 fail (new: `open-work`, `page-all`, `session-rejection`) |
| `supabase db lint --level error` | no schema errors |
| pgTAP, database built from zero | **20 files, 563 assertions, all pass** (new: `020_external_response_respects_record_status`, 20 assertions) |
| The new pgTAP file against the *old* function | fails 8 assertions (8, 10, 13, 14, 16, 17, 18, 20) — it does detect the defect |
| `overview-counts.spec.ts` against the *old* dashboard | fails (expected 0, received 1) — it does detect the defect |
| Playwright release gate, production build, accounts-only seed, `CODECO_E2E_REQUIRED=1` | **118 passed, 62 skipped, 0 failed** (6.9 min). The skips are viewport guards (a spec runs on the project it was written for) and `media-and-sharing`, which needs a Blob store and fixture images — **Blocked**, not passed |
| Audit sweep, production build | 150 screens reached; no overflow, no unnamed controls, no duplicate ids, no text under 11 px |
| `double-submit.spec.ts` against the *old* `run()` | not run (the failing behaviour was shown by hand: two records 0.6 ms apart); passes with the fix |
| `npm audit --omit=dev` | not re-run in this audit |

## Database

| Question | Answer |
| --- | --- |
| Required migration | `202610100005_external_response_respects_record_status.sql`: two nullable columns on `external_share_responses`, one `create or replace function`, no data rewrite, no RLS change, no grant change (grants stay with the function) |
| Applied locally | yes, and by `db reset` from zero |
| Applied to staging | **no** — the attempt through the Supabase tool was refused by the session's permission check |
| Applied to production | **no** |
| Compatibility | App after this branch + database before the migration: contractor submissions keep working; the new 409 branch simply never fires. App before + database after: the old route maps no 55000, so a refused answer reports a generic failure. Either order is safe; apply the database first so the new refusal is worded |
| Rollback | the function's previous body is the one in `202608090002`; the added columns can stay |
| RLS / permission verification | pgTAP 001–020 (isolation, role matrix, share boundaries) on a database from zero; production advisors were not re-run |

## Vercel

| Question | Answer |
| --- | --- |
| Production deployment | `dpl_9eaBkJJDyoNP6XayFDquaBEkvr3u`, state READY, target production, from `main@1fe8f1c` |
| Preview for this branch | not created. Earlier branch deployments are `BLOCKED` (Hobby plan, commit author is not the account owner) and previews would use the production Supabase project (`production-readiness.md` blockers 2 and 4), so a Preview was not used for state-changing tests |
| `www.codeconv.com` | browser error page; not attached to the project |
| Runtime errors | not inspected on Vercel; the signed-in pages produced no application console errors (only the Chrome extension's own) |

## Non-destructive production smoke to repeat after deployment

1. `GET /api/release` shows the merge commit and `expectedSchemaVersion 202610100005`.
2. Overview of *First construction project*: Inspections **7**, Open follow-up **not 0** (the 6 open issues and the
   NCR), health badge "Action needed", not "Under control".
3. Workspace tiles equal the Overview cards; project card says N open actions, not 0.
4. Management → Backup & continuity still lists a verified daily backup.
5. 360° viewer opens and rotates; nothing is created or signed.

## Performance and stability

Not measured with a profiler. Observed: the project loader now makes sequential pages of 1000 rows
per table when a table is larger than that, so a project with more than 1000 findings costs more
requests on load and in the offline snapshot; no timing was taken. Duplicate requests: the weather
endpoint is requested twice per load on production (one 200, one cancelled). Not changed.

## Open before the verdicts can change

1. Owner approval to apply `202610100005` (staging first, then production).
2. A Blob-backed run of `media-and-sharing.spec.ts` against a Preview with its own Supabase and Blob stores.
3. A real phone and a real screen reader.
4. `www.codeconv.com` attached to the Vercel project.
5. A restore rehearsal (the backups are verified and dry-run tested, a full restore into a scratch project is still not recorded).
