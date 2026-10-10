# Final release verification — CODECO Supervisie

Evidence for the integrated release candidate. Last updated 10 October 2026, branch
`integrate/codeco-final-release` (PR #1 `fix/supervisie-production-readiness` + PR #2
`codex/niche-feature-hardening`, merged without conflicts, plus the changes listed below).

Status words are used strictly:

| Word | Meaning |
| --- | --- |
| **Verified** | Operated in a real browser or run against a real database, with the result recorded here |
| **Source only** | Present in the code and covered by a source/unit assertion, not operated |
| **Blocked** | Cannot be run in this environment; the missing thing and its owner are named |
| **Open** | Known gap |

A passing build is not a working feature, a preview is not production, and a local database is not
the hosted CODECO database.

## 1. Four verdicts

| Verdict | Result |
| --- | --- |
| Code integration | See §2 |
| Client feedback (8 screenshots) | See §3 |
| Staging | See §6 |
| Production | **NO-GO** — see §7 |

## 2. Integration

- Branch ancestry (checked with `git merge-base --is-ancestor`): every other remote branch
  (`claude/*`, `codex/client-feature-completion`, `dev`, …) is an ancestor of PR #1 or PR #2.
  `integrate/all` and `integrate/final` are ancestors of PR #1. PR #1 head `8e39bf0` and PR #2
  head `824c2b7` share the merge base `a64a107`.
- Merge: `git merge origin/codex/niche-feature-hardening` into `8e39bf0` — no textual conflicts
  (`operational-workspace.tsx`, two test files auto-merged; the merged hunks were read).
- Local checks on the merged tree: ESLint 0 warnings, `tsc` clean, 175 node unit/source tests,
  `npm audit --omit=dev` 0 vulnerabilities, 19 pgTAP files / 542 assertions on a database built
  from zero, `supabase db lint` clean.

### Changes made on top of the merge

| Area | Change | Test |
| --- | --- | --- |
| Permissions | UI no longer fails open: while the permission lookup is unknown, missing or failing, only read controls are offered | `niche-feature-hardening.test.mjs` |
| Share links | `create_external_share_link` needs the write permission of the source (migration `202610100003`) | pgTAP 018 |
| Signatures | A stored signature, and the response log, cannot be rewritten by editing a record; CODECO-issued documents, inspections and HSE reports are signed under the account's own name (migration `202610100004`) | pgTAP 019 |
| Recipient signature | Handwritten recipient signature on the formal response; server stamps who captured it, when, and `own_account` / `on_device`; recipient cannot be the issuer | pgTAP 019, `two-party-signature.spec.ts` |
| Reports | PDF and Word show issuer and recipient with ink, names, positions and Suriname time; change order signature images; selected required action | unit test, browser downloads |
| Change order | One issuer signature (supervision approval, own name); title and description asked once; no empty stretched panel | `two-party-signature.spec.ts` |
| Technical instruction | **Defect fixed:** it could not be saved (readiness demanded a reason no field sets). Also present on `main`. | `two-party-signature.spec.ts` |
| Inspections | Signed before completed; "Approve section" no longer overwrites a "No"; progress saved before leaving for an NCR or "Complete later"; generic per-point instruction removed; lookup full width | `inspection-workflow.spec.ts` |
| Concurrency | Editing a controlled document refuses to overwrite a record changed in the meantime (row version) | source only |
| Release id | `/api/release` returns commit, environment and the expected schema version | unit test (schema version tracks the newest migration) |

## 3. Historical client feedback (eight screenshots)

| # | Request | Result | Evidence |
| --- | --- | --- | --- |
| 1 Workspace | Remove the Delays tile; keep PDR and daily delays; no card descriptions | **Verified** (1440 px): tile gone, PDR kept, cards show icon, title, count | browser screenshot |
| 2 Document lower section | Fewer impact inputs, simpler attachments, no automatic-metadata paragraph, clear signing | **Verified** (TI, 1440 px): attachment notes and impact collapsed, no banner, signature block | browser screenshot |
| 3 Change order | Title first, no repeated date/author, automatic revision, correct recipient, two signers | **Verified** (1440 px, 390 px no overflow): title/description once; header holds date and author; no revision field; issuer + contractor signatures; one-page PDF | `two-party-signature.spec.ts`, PDF inspected |
| 4 Active inspection | Answers, section approval, signature, NCR | **Verified**: failed point survives "Approve section"; NCR detour keeps answers; signed under own name; completed; signature after reload | `inspection-workflow.spec.ts` |
| 5 Technical instruction | Title at top, no duplicate author/revision, conditional impact | **Verified** | browser screenshot, spec |
| 6 TI context | Automatic date/time, uniform building/location, no type switch | **Verified** except drawing selection (needs Blob, §8) | browser screenshot |
| 7 Inspection start | Uniform selectors, exact location, derived dates | **Verified** (building field shared; lookup dates come from stored inspections; four controls on one row) | browser screenshot |
| 8 Signing | Issuer and recipient distinguished, no false attribution, PDF/Word show both | **Verified** (PDF rendered and read; Word checked by its XML and embedded images, not rendered) | `two-party-signature.spec.ts` |

Inspection → drawing pin is **Blocked** locally (§8). Inspection → NCR is **Verified** up to the
pre-filled NCR form; saving the NCR from that form was not driven.

## 4. Traceability

| Requirement | Implementation | Automated test | Browser | Deployment | Status |
| --- | --- | --- | --- | --- | --- |
| Org/project isolation, RLS | migrations | pgTAP 001–019 (542) | role-views spec | not checked on hosted | Verified locally |
| Share-link creation permission | `…0003` | pgTAP 018 | – | not applied to hosted | Verified locally |
| Signature integrity, two-party | `…0004`, forms, reports | pgTAP 019, unit, spec | yes | not applied to hosted | Verified locally |
| Inspection sign + complete | operational-workspace | spec | yes | – | Verified locally |
| Permission fallback | `permission-model.mjs` | unit | – | – | Verified (unit) |
| Offline queue, account isolation | PR #1/#2 | gate specs | see §5 | – | see §5 |
| Drawings, pins, 360°, photo markup | PR #2 | niche unit tests | – | – | Blocked (§8) |
| Formal PDF / Word | report modules | unit | PDF read, Word XML | – | Verified (TI, CO) |
| Backups and restore | cron, `backup_runs` | pgTAP 008 | – | – | Open: no restore rehearsal (§7) |
| Vercel deployment | – | – | – | every deployment `BLOCKED` | Blocked (§7) |

## 5. Browser gate (production build, local Supabase)

Pending. The result of the run is recorded in §9 once it has finished.

## 6. Staging

Pending. See §9.

## 7. Production — NO-GO

| # | Blocker | Owner | Action |
| --- | --- | --- | --- |
| 1 | Every Vercel deployment of project `code-co-nv` is `BLOCKED` ("team configuration"); production serves the old commit | CODECO (Vercel owner) | Move the project to a CODECO-owned Pro team or make the Git author the account owner, then redeploy |
| 2 | Hosted production has 65 migrations (last `202608090003`); this release adds `202610060001`–`7` and `202610100001`–`4` | CODECO + developer | Apply only after staging and a restore rehearsal pass, then redeploy in the order in `production-readiness.md` §9 |
| 3 | No restore rehearsal has been performed | CODECO + developer | `production-readiness.md` §7 |
| 4 | Preview environment variables are not isolated from production, and the staging service key is not available to this tooling | CODECO | Set Preview `NEXT_PUBLIC_SUPABASE_URL`, `…PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` and a separate Blob store to the staging project |
| 5 | `www.codeconv.com` points at the old host; no custom domain on the Vercel project | CODECO (DNS owner) | Needs explicit approval before any DNS change |
| 6 | `main` cannot be protected on the current GitHub plan | Repository owner | Upgrade or move to an organization |

Nothing in production was changed: no migration, no deployment, no DNS, no data.

## 8. Not exercised (infrastructure)

- Evidence upload, photo markup, drawing pins, 360° viewer and everything that renders an uploaded
  image or drawing need a private Vercel Blob store; the local stack has none.
- Real phones, Safari/WebKit, Firefox and an installed PWA were not tested. Phone checks are Chrome
  emulation (390 px, touch events); signing works with touch input in emulation only.
- Word output was checked structurally, not rendered.
- Performance with large datasets was not measured.
- Concurrency (two supervisors on one record) is covered by the database guards and the row-version
  check, not by a two-browser test.

## 9. Run log

Filled in below as runs complete.
