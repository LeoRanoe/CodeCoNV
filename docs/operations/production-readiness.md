# Production readiness — CODECO Supervisie

Single source of truth for whether the application may go to production, what was verified,
and what still has to be done by whom. Last updated: 10 October 2026, branch
`integrate/codeco-final-release` (PR #3: PR #1 + PR #2 + signature integrity; starting point `54e5d14`).
Evidence for this candidate: `final-release-verification.md`.

**Status: NO-GO.** The code on the branch is ready for review (UI pass: see
`ui-consistency-matrix.md`); production itself is not
ready, for the reasons under "Blockers". Nothing in production was changed by this work.

Related documents: `role-permission-matrix.md`, `offline-security-model.md`,
`vercel-deployment-checklist.md`, `production-readiness-checklist.md` (CODECO's own
go-live checklist, Dutch), `production-fresh-start.md`.

## 1. Blockers

| # | Severity | What | Why it blocks | Action | Who |
| --- | --- | --- | --- | --- | --- |
| 1 | Critical | Migrations `202610060001`–`202610060007` and `202610100001`–`202610100004` are not applied to the hosted Supabase project (`dljbeheogaeviokpcvca`, 65 migrations, last `202608090003`) | Without them, in production: a contractor cannot complete an NCR through the share link (42501), report signing is refused, new organizations get roles without submission rights, visual-marker findings lose their source photo, uploads are not hash-verified; the screens cannot tell a client from a supervisor (they show every button, as before) and new projects keep English workforce disciplines | Apply the eleven migrations in order after staging passed and a restore rehearsal was done (`supabase db push`), then run the advisors again. `202610100003` and `…0004` add triggers and a stricter share-link check; an older app keeps working with them, a rollback of the app does not need a schema rollback | CODECO owner of Supabase, with the developer |
| 2 | Critical | Every Git deployment on Vercel since 3 September 2026 is `BLOCKED`; production still serves commit `d793c6a` (25 August) | Nothing that was fixed can reach users. Cause: Hobby plan, the commit author is not the Vercel account owner | Move the project to a CODECO-owned Pro team, or connect the Git author to the owning account, then redeploy | CODECO (Vercel owner) |
| 3 | Critical | `www.codeconv.com` points at the old host (107.180.3.102) with a certificate that expired in March 2024; no custom domain is attached to the Vercel project | The canonical address does not serve this application and shows a certificate error | Attach the domain in Vercel, switch DNS, verify the redirects in `next.config.ts` | CODECO (DNS owner) |
| 4 | High | Preview deployments use the production Supabase project and Blob store | A preview build can write to production data | A separate empty Supabase project exists since 10 October 2026 (`codeco-staging`, `rtuaumbiviwgikthyfmr`, us-east-1). Still to do by the Vercel owner: set the Preview variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) to that project and attach a separate Blob store. The service key is not available to the tooling used for this release | CODECO + developer |
| 5 | High | No restore rehearsal has been performed | A backup that has never been restored is not a backup (see §7) | Run the rehearsal into a scratch project and record the evidence | CODECO + developer |
| 6 | High | `BACKUP_BLOB_READ_WRITE_TOKEN` is set, but it is not confirmed that it belongs to a different store than `BLOB_READ_WRITE_TOKEN` | The app refuses to run backups in production when both are the same; the cron would then report failure every day | Confirm in Vercel → Storage; create a second private store if needed | CODECO (Vercel owner) |
| 7 | Medium | Leaked-password protection is disabled in Supabase Auth | Known-breached passwords are accepted | Enable under Auth → Providers → Email (needs a paid Supabase plan) | CODECO owner of Supabase |
| 8 | Medium | `RESEND_API_KEY` / `NOTIFICATION_FROM_EMAIL` are not set in production | E-mail notifications are skipped (recorded as `skipped`, not lost); push and in-app still work | Create the sender, verify SPF/DKIM/DMARC, set both variables | CODECO IT |
| 9 | Medium | `main` has no branch protection, and cannot have it: the repository is private on a GitHub Free plan (the API answers "Upgrade to GitHub Pro") | The release gate runs on every push but nothing forces a merge to wait for it | Upgrade the plan (or move the repository to a CODECO organization) and require the three `Quality gates` jobs plus one review on `main`; until then, merge only when the checks are green | Repository owner |
| 10 | Medium | Evidence upload, photo markup, 360° and drawing pins were not exercised end to end in this round | They need a private Blob store; the local stack has none (§4) | Run `media-and-sharing.spec.ts` against a preview with its own store (blocker 4) | Developer |

## 2. What changed on the branch

Per area:

- **Database** — contractor NCR completion through the share link repaired and bounded;
  report signing repaired; role defaults restored (submission rights) and pinned by a test;
  source photo linked to findings made from visual markers; explicit `service_role` grants;
  `files.content_verified_at`; rate-limit actions for the proxies. pgTAP re-baselined on the
  multi-building contract: 17 files, 513 assertions (adds `017_my_project_permissions`).
- **Security** — Next.js 16.3.8 and sharp 0.35.5 (advisories); billable proxies (maps,
  weather) authenticated and rate limited; push subscription hardening; server-side SHA-256
  verification of every uploaded object (mismatch → rejected); backups refuse to share a
  store with primary data in production; two definer functions no longer callable by `anon`;
  structured server logs with redaction and user-safe error responses.
- **Offline** — per-account isolation of device storage; truthful "remove offline copy";
  the "encrypted at rest" claim is gone; service worker only in production builds; a queued
  record is visible immediately and the header counts what waits on the device.
- **Workflows that were broken** — day report could not be started, checked or submitted
  from the current screens; closing the day for all buildings never closed its dialog;
  priority was always saved as "normal"; closing a dialog could reopen an older one; a
  reload lost the open screen; inputs were 102px tall after `54e5d14`.
- **Consistency** — one vocabulary for statuses, types, priorities and severities in both
  languages; no stored codes or PostgREST errors on screen; Dutch document language on the
  contractor page; formal PDF/Word in Dutch, Suriname time, real page numbers.
- **Marketing site** — permanent redirects from the previous site's URLs; `/share/` kept out
  of search engines.
- **CI** — a browser-flow job that cannot silently skip (`CODECO_E2E_REQUIRED=1`): day report
  lifecycle, controlled document, online/offline create and sync, account isolation on a
  shared device, offline boot, and the layout walk over every module and width.
- **UI consistency pass** (details and the screen-by-screen record in `ui-consistency-matrix.md`) —
  one dialog contract for every dialog (focus trap, inert background, Escape, focus return) with
  a browser test for each dialog at three widths; type scale floor of 11 px (430 rules used
  7–10 px); accessible names and heading hierarchy; screens that hide what the signed-in role
  cannot do (`public.my_project_permissions`, fails open); one vocabulary for the local queue;
  ≈ 330 explanatory sentences, card descriptions and repeated placeholders removed in both
  languages; offline manager reachable on phones; Dutch default workforce disciplines;
  Management → Project setup translated; notifications titled in the interface language.

## 3. How to verify (local)

```bash
# database: empty database, migrations, lint, tests
npx supabase@2.109.1 start
npx supabase@2.109.1 db reset
npx supabase@2.109.1 db lint --local --level error
npx supabase@2.109.1 test db

# web: lint, unit and source tests, build, audit
cd apps/web
npm ci
npm run lint
npm test
npm audit --omit=dev

# browser flows against the local stack (never against a hosted project)
node tests/e2e/seed-local-fixtures.mjs      # refuses any non-local Supabase URL
npx playwright test
```

`apps/web/.env` on a developer machine may point at production. The browser tests and the
seed script must run with `.env.production.local` / `.env.development.local` pointing at the
local stack; the seed script stops when the URL is not local.

## 4. Flows verified in a real browser

| Flow | How | Result |
| --- | --- | --- |
| A — record online, reload, still there | `offline-create-and-sync.spec.ts` (action through the real form) | Pass |
| B — NCR with engineer signature → share link → contractor proposes correction with name, position, signature → ready for verification → QC closes with signature | By hand against the local stack; database state checked afterwards. Boundaries in pgTAP 015 | Pass |
| C — visual marker / 360° | **Not run** — needs a Blob store. Database side covered by pgTAP 006 | Open (blocker 10) |
| D — two-building day: start, workforce per building, daily questions, check, submit, approve and freeze, sign | `day-report-lifecycle.spec.ts` | Pass |
| E — controlled document: RFI recorded against a party, numbered, answered by a named respondent, response kept after reload | `controlled-document.spec.ts` (found and fixed: "Record external submission" opened a materials-delivery form). RFA, WCR and WIR use the same form and response path but were not each driven separately | Pass (RFI) |
| F — create offline, reconnect, automatic sync, queue empty | `offline-create-and-sync.spec.ts` | Pass |
| G — second account on the same device cannot read the first account's offline data | `offline-account-isolation.spec.ts` | Pass |
| H — formal PDF and Word from the frozen version | `day-report-lifecycle.spec.ts` downloads both; inspected by hand: 4 pages, numbered, Dutch, Suriname time, signature image | Pass |
| Layout — all eight modules, signed in, at 360, 390, 430, 820, 1024×768, 1280, 1440 and 1920 px, plus 125 % and 150 % zoom on a 1280 px laptop (1024 and 853 CSS px): the page never scrolls sideways | `viewport-walk.spec.ts`; component rules in `responsive-audit` (320/390/820/1280), `responsive-workspace`, `layout-hygiene`, `field-readiness` | Pass (found and fixed: Management was 8 px too wide on phones) |

Not verified: a real phone on a site connection, an actual screen reader (the accessibility
tree, focus order, names and live regions were checked in Chrome only), anything that renders an
uploaded image or drawing (Flow C, below).

**Flow C — what is needed.** Evidence upload, photo markup, 360° and drawing pins need a private Vercel
Blob store the local stack does not have, and the store's read/write token. Nothing was created on
the Vercel account for this: the available tooling can create a store but not return its token, and
a store on the shared team is a billable, outward change that is the owner's to make. To close it:
create a *separate* private Blob store (not the production one, not the backup one), set
`BLOB_READ_WRITE_TOKEN` and `BACKUP_BLOB_READ_WRITE_TOKEN` (two different stores) in a
git-ignored `apps/web/.env.production.local` or in the Preview environment together with a separate
Supabase project, then run `npx playwright test media-and-sharing`. Expected: upload → marker →
linked finding → reload → marker persists → void marker → audit row remains; then 360° annotation;
then drawing pin create/move/void. Faking the Blob API locally was considered and rejected: the
SDK signs and verifies against Vercel's own endpoints and hosts, so an emulator would test the
emulator.

**UI pass.** Dialogs: 11 dialogs × 3 widths (`dialogs.spec.ts`). Roles: client, contractor and
supervisor (`role-views.spec.ts`). Both run in the release gate.

## 5. Production environment (read-only inspection, 10 October 2026)

- Supabase `dljbeheogaeviokpcvca`: 65 migrations applied, identical to the repository up to
  `202608090003`. Row-level security enabled on all public tables.
- Security advisors: `rls_auto_enable()` and `sync_visual_annotation_disposition()` are
  executable by `anon` (fixed by migration `…0002`, not yet applied); leaked-password
  protection disabled. The 45 "authenticated can execute SECURITY DEFINER" notices are the
  application's RPC surface: each function checks membership and permission itself.
- Vercel `code-co-nv`: environment variables present for Supabase, Blob, backup Blob, cron
  secret, site URL and VAPID. Not present: Resend, `NOTIFICATION_FROM_EMAIL`.
- Cron: `/api/cron/daily` at 07:00 UTC (04:00 in Suriname). It requires `CRON_SECRET` of at
  least 16 characters; use 32 or more random characters.

### Grant drift

The hosted project gives `service_role` the broad default table privileges Supabase
projects were created with. The migrations do not: a database built from the repository
gives `service_role` only what `202610060005_service_role_explicit_grants.sql` lists. The
application works with the narrow set (CI runs on it). Production is therefore *more*
permissive than the repository describes. Narrowing production to the migration's set is a
separate, deliberate change — do it after the nine migrations are applied and the server
routes have been exercised on a preview, not as part of this release.

## 6. Environment variables

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | yes | Preview must not use the production project |
| `SUPABASE_SECRET_KEY` | server only | yes | Never `NEXT_PUBLIC_`; never in logs |
| `BLOB_READ_WRITE_TOKEN` (or `BLOB_STORE_ID` + OIDC) | server only | yes | Private store |
| `BACKUP_BLOB_READ_WRITE_TOKEN` | server only | yes in production | Must be a different store than the primary one |
| `CRON_SECRET` | server only | yes | ≥ 16 characters; 32+ recommended |
| `NEXT_PUBLIC_SITE_URL` | browser + server | yes | `https://www.codeconv.com`; also Site URL and redirect URL in Supabase Auth |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | mixed | for push | |
| `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL` | server only | for e-mail | Without them e-mail is skipped, not queued forever |

## 7. Backup and restore

- Daily: the cron exports each organization to the backup Blob store with a SHA-256 and
  records the run in `backup_runs`; a failure is recorded and raises a `backup_failed`
  notification. Manual export: *Management → Back-up & continuity* (rate limited).
- Supabase's own database backups are a second, independent line; check the plan's retention.
- **Restore rehearsal (not yet done).** Never restore over production.
  1. Create a scratch Supabase project; apply the repository's migrations.
  2. Download the latest verified backup; check its SHA-256 against `backup_runs`.
  3. Import it into the scratch project; compare row counts per table with the export manifest.
  4. Sign in to a preview that points at the scratch project; open a project, a frozen
     report and a file.
  5. Record date, backup id, duration, differences and who did it in *Production readiness*
     in the app; delete the scratch project.
  Repeat monthly.

## 8. Known limitations (accepted or open)

- Offline changes to existing central records are not queued (by design; see
  `offline-security-model.md`).
- A full or blocked device store has no dedicated message.
- Discipline names in workforce are project data. New projects start with CODECO's Dutch list; projects that still had the untouched English default are migrated by `202610100002`; anything a project edited, and every attendance already recorded, is left exactly as stored. the database as English at project creation; they are editable per project but not translated.
- Free text is stored in the language it was typed in; a Dutch reader sees English answers
  if the supervisor wrote English.
- Modal dialogs close on Escape and Back but do not trap keyboard focus.
- `operational-workspace.tsx` and `codeco-supervision-app.tsx` are very large single files;
  splitting them is maintenance work that was deliberately not mixed into this release.

## 9. Release procedure

1. Review and merge the pull request; all three `Quality gates` jobs must be green.
2. Apply migrations `202610060001`–`202610060007` and `202610100001`–`202610100004` to production; re-run both advisors.
3. Resolve the Vercel deployment block; deploy `main`; check the security headers and
   `/supervisie` on the deployment URL.
4. Sign in with a real account: start a day, record a finding, share it with a contractor,
   complete it through the link, approve and sign a day report, download PDF and Word.
5. Attach the domain and switch DNS; verify the old URLs redirect.
6. Perform the restore rehearsal.
7. Only then tick the go-live decision in `production-readiness-checklist.md`.

## 10. Identifying the running release

`GET /api/release` returns the short commit, branch, Vercel environment and deployment id, and the
schema version the build expects (`expectedSchemaVersion` in `apps/web/lib/release.ts`, kept equal
to the newest migration by a unit test). After a deployment, compare it with the commit in GitHub,
the deployment id in Vercel, and `select max(version) from supabase_migrations.schema_migrations`.

Rolling back the application (Vercel → Deployments → promote the previous deployment) does not roll
back the database. The migrations of this release only add rules and triggers and are compatible with
the previous application version; restore from a backup only for data damage, never over the live
database.
