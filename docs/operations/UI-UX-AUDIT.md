# UI and UX audit (2026-10-31)

Rules followed: `CLAUDE.md` (UI rules), `docs/product/design-direction.md`, `docs/operations/ui-ai-slop-audit.md`. Colour, type, radius and shadow come from `apps/web/app/styles/tokens.css`. No redesign was made; layouts, brand and behaviour are kept.

## Decision that drove this pass

The client wrote on 30-10-2026 at 13:05 that the first colour version "was good". PR #11 had replaced it with a warm palette with sage. That palette is removed. `tokens.css` and `brand.css` are back to the first version, which is blue-grey ink, white paper, orange (`#f07400`) for the one primary action and the current selection, green (`#177960`) for done and ticks, and the dark ink sidebar. `manifest.ts`, `system.css`, `docs/product/design-direction.md` and `docs/operations/ui-refresh-2026-10-30/README.md` were adjusted to match. Everything else PR #11 changed (headings, module header, dialogs, data fixes) stays.

## What changed in the UI in this pass

| Change | Where | Reason (client item) |
|---|---|---|
| Works ongoing is one section: the text box and the building ticks, nothing else | `daily-log-modal.tsx` | 30-10 13:31 and 13:32 |
| Materials delivery: no "Register / document format", no "Location on drawing", no empty dashed box; empty location reads "No PDF selected" | `operational-workspace.tsx` | C R448-1, R452-3, R452-4 |
| TI and CO: upload button reads "Upload attachment"; TI loses Cost impact, CO gains it; TI Discipline sits above Title | `lib/forms/change-order.ts`, `operational-workspace.tsx` | D R12, R15, R16, R26 |
| CO, Agreements, Lessons Learned start with the same header strip as PDR and HSE | `operational-workspace.tsx` | C R477-1, R478-1, R479-1 |
| Issue types reduced to Safety, Quality, Equipment, Materials, Schedule, Operational; cards print the real type | `operational-workspace.tsx` | C R449-4, D5 |
| Count badges on PDR, TI, CO and Lessons Learned tiles | `project-workspace-home.tsx` | P row 2, C D8 |
| "Calculator & notes" entry in Workspace; "HSE incident" tile preselects Incident | `project-workspace-home.tsx` | P row 53, B def 3 |
| Dictate microphone on the remaining free-text inputs | `dictate-button.tsx` and callers | P row 52 |
| Drawing pins take the colour of their record type; legend swatches match; the colour picker is removed | `drawing-workspace.tsx`, `tokens.css`, `02-media.css` | C R445-2, R445-4 |
| "Return for correction" on issues that are ready for verification | `operational-workspace.tsx` | P 43 |
| Rapid Verify lists each compared value as matches, differs or not found | `rapid-verify-workspace.tsx` | P 37, 38 |
| Inspection lookup date defaults to today | `operational-workspace.tsx` | C R453-4 |
| Photo thumbnails and markup preview no longer blank in development | `photo-evidence.tsx`, `photo-markup.tsx` | B def 1 |

All edits use existing tokens and classes. No gradients, glass, tinted icon squares, uppercase eyebrows, nested cards or looping motion were added, and accessible names, roles and test selectors were kept.

## Findings left open

| Finding | Why |
|---|---|
| "Works completed" and "Delays" still open the full ten-section log | The client decided only Works ongoing. Ask before changing. |
| Phone header: dark or light | Client screenshots show both; ask. |
| Narrow portrait photos make a thin strip in a wide preview frame | Cosmetic. |
| Mixed Dutch and English text in a few generated titles | See `FUNCTIONAL-AUDIT.md` F-19. |

## Verification

- `tests/e2e/ui-stability-audit.spec.ts` (fails on overlap, clipping, controls under the minimum size and layout shift): 72 screens, 0 findings in the runs on this branch. PR #11 recorded 123 screens at every role and width. The release-gate run is in `PRODUCTION-READINESS-2026-10-31.md`.
- `tests/design-guardrails` unit test (9 of 9 pass) guards the token and banned-pattern rules.
- Layout was also checked with `responsive-audit`, `responsive-workspace`, `viewport-walk`, `layout-hygiene` and `mobile-forms` in the gate run.
- Not done: a manual contrast pass on the restored palette. It was the palette already shipped in `a95aa44`, which passed the earlier audit, but this pass did not re-measure it.
