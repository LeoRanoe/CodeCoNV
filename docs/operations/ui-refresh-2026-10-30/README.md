# UI refresh, 30 October 2026: before and after

Each image shows the screen before the change on the left and after it on the right, captured with
`tests/e2e/ui-audit-screenshots.spec.ts` against the local fixture project at 1440 px (`*-desktop.jpg`)
and 390 px (`*-phone.jpg`). The full set of 56 screens per side can be reproduced with that spec.

What changed:

- **Palette.** Warm off-white canvas, white paper, warm charcoal ink. CODECO orange stays the primary action,
  the active page and the current selection. Sage green is the secondary brand colour for progress, completion,
  ticks and the day that has started. Red, amber and blue stay record state. All text pairs meet 4.5:1
  (body 14.5:1, muted 5.4–8:1, sage text 6.2:1, charcoal on orange 5.8:1); fields and buttons keep a 3:1 outline.
- **Overview hierarchy.** The project name is the page title with the date and the day's state under it; the
  four counts sit in one ruled strip with large tabular numbers and the high-priority / NCR detail in amber;
  the priority queue carries the state of open work in its top rule and a sage progress bar; recent activity
  is quieter; photos are larger; site conditions sit on the one sage surface.
- **Shared controls.** One-pixel soft outlines on surfaces instead of 2 px dark ones, softer tabs and segmented
  controls, quiet count pills on workspace modules, a lighter bottom navigation with an orange marker for the
  current tab.
- **Phone.** The overview heading and its tools take two short rows (search beside the day's three buttons;
  Workspace is in the bottom bar), and the counts are a single ruled two-by-two block, so the day's work starts
  higher on the screen.

The rules are in `apps/web/app/styles/system.css` (loaded last) and the values in `apps/web/app/styles/tokens.css`.

## Second pass: full audit

123 screens were captured for this pass: sign-in, the project list, every module, the dialogs and sheets
(notifications, help, day log, start of day, report check, project switcher, the phone module sheet, new action)
and the Management sub-pages. They cover the supervisor, client and contractor roles at 1440, 820 and 390 px,
plus the 20 workspace modules at 1440 and 390 px. Findings and what was done:

| # | Finding | Fix |
|---|---|---|
| 1 | Form, dialog and page titles rendered at body weight: Tailwind's reset sets headings to `inherit`, and many app headings never set their own weight | One zero-specificity rule makes app headings bold and charcoal; rules that set a weight on purpose still win. Scoped to the app, so the public site is untouched |
| 2 | Module header: tiny module name, project name in caps, a very wide outlined "New" button, the count far from the name | Module name is the page title (22 px), the project is a plain line above it, the count sits beside the name and "New" is its natural width. On phones the back button is the arrow alone (its accessible name stays), so long names fit |
| 3 | Overview weather error was shown in Dutch on the English screen (the API returns Dutch text) | The overview shows its own bilingual message |
| 4 | Recent activity showed the **viewer's** name on every record (a client saw their own name on the supervisor's work) | The line shows the viewer's name only on their own records, a member's name when the directory is loaded, otherwise "Another team member" |
| 5 | A client was offered "Take photo" in the photo empty state | Users who cannot record are pointed to the photo library instead |
| 6 | A contractor with no follow-up saw "No records match this view" and "Clear filters" although nothing was filtered | "No follow-up in this project yet", without the filter button |
| 7 | Quality standards showed 12 orange "Install checklist" buttons in one view | Secondary buttons; installed ones read as done in sage |
| 8 | Project rules: about 20 orange on/off chips, and screen readers were not told whether a chip was on | On is sage with a tick, off is neutral; the chips now carry `aria-pressed` |
| 9 | Help guide: an orange caps label above the question, task icons in tinted squares | A plain muted label; line icons; the chosen task has an orange border |
| 10 | Phone module sheet: every row a separate card with an icon in a tinted square | One ruled list with line icons |
| 11 | Project switcher marked the current project in green | The current selection is orange, as everywhere else |
| 12 | Report check on a phone: icon, text and the "Complete" button in three misaligned places; the button read like a status | A ruled list; the button sits under its text and says "Fill in" |
| 13 | Report sources turned the whole list green once ticked; on a phone the list was 16 rows long | Neutral rows (the tick carries the state); two per row on a phone |
| 14 | Rapid Verify placeholder was bold and dark, so it looked like typed text | Placeholders are regular weight in the muted ink |
| 15 | Project list: logo label off-centre, dark header rule, pill-shaped button unlike every other button | Aligned label, soft rule, 8 px button radius, sage "Online" notice |
| 16 | Tablet: the overview heading was right-aligned, the workspace toolbar centred, and "New action" fell under its title | Left-aligned headings; title and primary action share a row |
| 17 | Management, Backup and media: dark outlines on strips and cards, tinted icon squares on backup health, upload tiles with dark borders, a borderless asset search | Soft rules everywhere; backup health shows its state in the icon colour and a top rule; the search field has its outline |
| 18 | Action rows, progress sliders | Plain line icons; sliders are sage |

Not changed: notification titles that the database writes in Dutch (data, documented in
`codeco-supervision-app.tsx`), and the second back arrow inside an open record (it closes the record, not the module).
