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
