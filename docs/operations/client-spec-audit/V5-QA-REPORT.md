# V5 QA report (25-11-2026, overnight run)

Everything below was run on the local stack (local Supabase in Docker, production build of the web app, fake Blob store). Nothing was run against production or a hosted preview.

## Automated results

| Check | Result |
|---|---|
| Unit tests (`node --test`, the list in `npm test`, 49 files) | 365 passed, 0 failed |
| `tsc --noEmit` | clean |
| `npm run lint` (eslint max-warnings 0, stylelint) | clean |
| Production build (`next build`) | succeeds |
| pgTAP after `supabase db reset` (all migrations from scratch) | 48 files, 997 tests, all passing. New: 047 photo record IDs (11), 048 delivery acceptance (7) |
| Playwright, all three projects (desktop-office, mobile-field, tablet-field), clean database, final run | 262 passed, 253 skipped by design, 1 failed. The failure is `first-load` on the desktop project: the weather endpoint answered 429 (limit of 30 lookups per user per 10 minutes, reached late in a 29-minute run). It passed when run alone. The same effect was seen in an earlier round |
| Playwright, earlier full run in the same session | 255 passed, 8 failed, 245 skipped, 2 did not run. Causes, all fixed and re-run (23 passed, 0 failed, 22 skipped): four axe failures from my section headings (`h4` after `h2` is a heading-order violation; now `h3`), one new rule meeting an old fixture (a cement delivery saved as Accepted; the fixture now uses insulation), two tests that depended on data other specs leave behind (`v5-link-first` on phone and tablet, the contractor filter) and the consequence "2 did not run" |

### The skipped tests

The 253 skips are `test.skip` conditions in the specs, not failures: 18 on desktop-office, 105 on mobile-field, 124 on tablet-field. The 18 desktop skips are specs for the phone or tablet layout ("touch targets are a rule up to 1024 px", "Rapid Verify on a tablet", "the phone module menu"); each runs, and passed, under its own project in the same gate. None is outdated or hiding an unfinished feature, none was weakened, no timeout was raised.

## Browser and visual checks

- Playwright screenshots at 1280 and 390 px (`v5-visual-evidence.spec.ts`, read by eye): the Issue Verify dialog (a modal on desktop, a bottom sheet on the phone), the report option block, the numbered Works Ongoing form (seven sections), Actions. No sideways scrolling on any of them.
- A generated PDF (grouped by contractor, and the summary) was rendered to images and read. It showed English form names in a Dutch report; fixed with Dutch labels.
- A generated Excel workbook with photos was opened with openpyxl: sheets, two pictures at the right rows.
- Client Portal (ten submenus) and Contractor Portal (six) walked by Playwright; each opens, none blank, no internal menus. This found that **View as never worked** (it queried `parties.type`; the column is `party_type`). Fixed.

## Not verified

- The side-by-side document viewer and the assistant button of the compliance check: built, type-checked, the assistant logic unit-tested (4 tests), never opened with real PDFs.
- Report option controls, Verify dialog and the photo auto bar on a tablet width; Dutch wording read only on the screens in the screenshots.
- The photo auto bar was not screenshotted (the photo review needs the fake Blob upload flow); it is covered by the `period-report` photo test, which reads the Record ID in the library and in the PDF.
- A hosted preview or staging deployment, Supabase advisors, and any production behaviour. The new migrations were applied only to the local database.
- Existing visual quirk, not caused by this run and not changed: in the Works forms a label appears twice (for example "Werkdiscipline", "Hoeveelheid gereed", "Handtekeningen"): once for the row and once for the field.

## Defects found and fixed in this run

1. View as never listed any organisation (wrong column).
2. Section headings broke heading order (axe).
3. English form names in a Dutch report.
4. A byte-level corruption of an en dash caused by my own scripted edit (caught by a unit test).
5. Tests that depended on leftover fixture data (three).

## Security and data integrity

- New migrations: 202611250014 (photo numbers) and 202611250015 (delivery acceptance). No RLS policy was changed or weakened. The number-assigning function is `security definer` with a fixed `search_path` and execute revoked from public; the number cannot be edited afterwards (trigger, pgTAP 047). The backfill only fills `capture_number` where it is null and is repeatable (ordered by created_at, id).
- The decision dialog calls the existing `record_signoff_action`, so permissions (`findings.verify`), the "not your own response" rule and the approver lists are enforced by the database as before. The status-change fallback is the existing `transition_project_finding`.
- No service-role key reaches the browser; the report, assistant and viewer run in the signed-in user's session.
