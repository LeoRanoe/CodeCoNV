# Test records on production (QA finding L12)

The QA sweep of 2026-10-28 left test records on the production project: "TEST 360 — DELETE ME",
"Test phase 3", the NCR category "Sweep tile", the closed issue Q-2026-0008 and the QA-sweep files.
Nothing in this repository writes to production, so removing them is a step for the project owner.

1. List them (read-only; it signs in as you and sends GET requests only):

   ```bash
   cd apps/web
   SUPABASE_URL=https://<project>.supabase.co \
   SUPABASE_PUBLISHABLE_KEY=<publishable key> \
   ADMIN_EMAIL=<your address> ADMIN_PASSWORD=<your password> \
   node scripts/find-test-records.mjs
   ```

   `PATTERN="your|words"` changes what it looks for. It was run against the local stack, where it
   found 15 records for `PATTERN="Stacked evidence"` and none for the default words.
2. Withdraw each one in the app (Workspace → the module → the record → *Withdraw*, with a reason such
   as "QA test record"). A withdrawn record stays in the history and drops out of every count, list
   and report; nothing is deleted, which is what the audit trail needs.
3. Run the script again; it should report none.

Hosted authentication settings (Dutch recovery mail, redirect addresses, sign-in limit) are the other
production step: see `auth-recovery-and-rate-limits.md`.
