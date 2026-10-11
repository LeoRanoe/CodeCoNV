# Live QA — continuation checkpoint

Read this first if you pick the audit up. Everything below is a fact about the repository or
about what was run; nothing here is a plan that was already carried out.

## Where things stand

- Branch `qa/live-website-audit`, created from `origin/main` at `1fe8f1c` (PR #3 merged; this is
  what production serves: `GET https://code-co-nv.vercel.app/api/release` →
  `commit 1fe8f1cb1110`, `environment production`, `deployment dpl_9eaBkJJDyoNP6XayFDquaBEkvr3u`,
  `expectedSchemaVersion 202610100004`).
- Not yet pushed, no PR yet. CI has not run on this branch.
- Hosted databases: production (`dljbeheogaeviokpcvca`) has all migrations through
  `202610100004` (checked read-only). Staging (`rtuaumbiviwgikthyfmr`) has the same.
  **Migration `202610100005` is applied only to the local stack.** Applying it to the hosted
  projects was attempted for staging through the Supabase tool and refused by the session's
  permission check; it needs the owner's explicit go (see "Next safe action").
- `www.codeconv.com` still does not serve the application (browser error page); only
  `code-co-nv.vercel.app` is attached to the Vercel project (checked with the Vercel API).

## Environment used

| What | Detail |
| --- | --- |
| Production | `https://code-co-nv.vercel.app/supervisie`, the user's own signed-in Chrome session (CODECO Administrator), **read only** |
| Local stack | Supabase CLI 2.109.1 in Docker, `supabase db reset`, fixtures + demo data seeded with `tests/e2e/seed-local-fixtures.mjs` and `seed-ui-demo-data.mjs` |
| Local app | `next dev` on :3000 (browser pane), `next build && next start` on :3100 for sweeps |
| Local accounts | the fixture accounts (supervisor, client, contractor, second org) and one audit supervisor created for the browser pane (`.audit-tmp/provision.mjs`, git-excluded) |
| Credentials | never printed; Playwright reads `tmp/e2e.env` through `node --env-file`, which is git-ignored |

## Defects found and fixed (details in `live-qa-bug-register.md`)

LQA-001 overview counts · LQA-002 row caps · LQA-003 contractor link overwrites signed
corrective action (migration) · LQA-004 role-blind status step · LQA-005 disabled buttons
without a reason · LQA-006 double tap creates two records · LQA-007 delivery line overflow ·
LQA-008–010 copy and counts · LQA-014 revoked session shows cached workspace as live.

## Commands

```bash
# local database: reset, lint, all pgTAP (20 files, 563 assertions at the last run)
npx supabase@2.109.1 db reset --local
npx supabase@2.109.1 db lint --local --level error
npx supabase@2.109.1 test db

# seed (outputs contain credentials: filter them), then browser specs
node tests/e2e/seed-local-fixtures.mjs; node tests/e2e/seed-ui-demo-data.mjs
cd apps/web && node --env-file=../../tmp/e2e.env ./node_modules/@playwright/test/cli.js test --project=desktop-office

# the opt-in sweep (modules + tiles at 1440/1280/820/390/360, report in test-results/audit-sweep)
CODECO_AUDIT_SWEEP=1 CODECO_E2E_REUSE_SERVER=1 CODECO_E2E_BASE_URL=http://127.0.0.1:3100 \
  node --env-file=../../tmp/e2e.env ./node_modules/@playwright/test/cli.js test audit-sweep --project=desktop-office
```

## Traps met during the audit

- A hot-reloaded half-edit of `operational-workspace.tsx` crashed the page under a running
  sweep (`registerTitle` used before its declaration) and made 100+ screens "unreachable". Run the
  sweep against a production build (`next build`), not `next dev`.
- `next dev` served stale CSS after edits; stop it and `rm -rf apps/web/.next/dev`.
- The Next.js dev indicator covers the bottom-left tab at phone widths; the sweep hides it.
- The browser pane's screenshots go blank after a programmatic `scrollIntoView`; a real wheel
  scroll refreshes them.
- The Chrome extension's screenshot times out while the Chrome window is in the background;
  DOM reads (`get_page_text`, `javascript_tool`) keep working.
- pgTAP needs an empty database (`bootstrap_organization` only works for the first
  organisation): `db reset` before `test db`, and reseed afterwards.
- `apps/web/.env` points at production; the e2e and seed scripts refuse non-local URLs, keep it so.

## Next safe action

1. Push the branch, open one PR, let the three CI quality gates run.
2. Owner decision: apply `202610100005` to staging, then production (additive: two nullable
   columns on `external_share_responses`, one function replaced; the app is compatible with the
   database before and after it).
3. After merge and deployment, repeat the non-destructive production smoke listed in
   `live-qa-release-verification.md`.
4. Untested areas are listed in `live-website-feature-audit.md`; the biggest are everything that
   needs a Blob store (uploads, photo markup, drawings, 360° markers) and a real phone.
