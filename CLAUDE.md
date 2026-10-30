# UI rules

Read [the product design direction](docs/product/design-direction.md) and [the UI audit](docs/operations/ui-ai-slop-audit.md) before editing the web UI. Use the tokens in `apps/web/app/styles/tokens.css` for colour, type, radius, and shadow. Keep status colour for record state and orange for the current selection and one primary action per view. The roles (dark sidebar, orange, green) are in `apps/web/app/styles/brand.css`. Run `npx playwright test tests/e2e/ui-stability-audit.spec.ts` after a UI change: it fails on overlapping, clipped or too-small controls and on layout shift.

Avoid decorative gradients, glass effects, tinted icon squares, uppercase eyebrows above headings, coloured modules, nested cards, fake empty-state content, invented figures, and ambient or looping motion. Preserve behaviour, permissions, data flow, accessible names, roles, and test selectors when making visual changes.
