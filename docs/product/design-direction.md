# CODECO Supervisie visual direction

CODECO Supervisie serves site supervisors working on phones and tablets in Suriname daylight, often one-handed, and office staff working on laptops. The output is formal records and signed reports. Its visual model is a site document: drawing title blocks, registers, inspection forms, ruled lines, tabular figures, prominent record codes, and compact lists.

## Visual rules

- Structure comes from alignment and hairlines. Use white paper on a warm off-white canvas (`--canvas`) and a warm charcoal ink ramp. Big surfaces take a soft 1 px outline (`--line`); fields and buttons keep the 3:1 outline (`--ink-500`). Avoid decorative cards and shadows; a soft surface tint is used only where it separates a kind of information (recent activity on `--ink-025`, site conditions on `--sage-50`).
- CODECO signal orange (`#f07400`, charcoal text on it) marks the one primary action in a view, the active page and the current selection. Sage green is the secondary brand colour: the tick of every checkbox, progress and completion, the day that has started, and work moved from paper onto the device (`--sage-700` for text, `--sage-500` for fills, `--sage-50`–`--sage-200` for surfaces). Red, amber, and blue convey record state only. Modules have no assigned colour.
- The sidebar is the dark charcoal (`--ink-950`) with the black-and-yellow logo on a white plate; the current page is a raised row with an orange bar. The desktop header and the page stay light; the phone header is charcoal and one row high. These roles are stated in `app/styles/brand.css`; shared surfaces and controls are finished in `app/styles/system.css`.
- The overview reads in order: project heading with date and day state, one ruled strip of key figures, latest work beside the priority queue (its top rule carries the state of open work), then photos and site conditions.
- Hind is the app face at weights 400, 600, and 700 and sizes 12, 14, 16, 18, 22, and 28 px. Inputs are at least 16 px on phones. Counts, dates, and codes use tabular numerals. Geist Mono is reserved for codes and tokens; Jost is for the public site.
- Controls use a 6 px radius, surfaces 10 px, and status badges a pill. One shadow is available for overlays. A surface gets a 1 px border or a shadow, never both.
- Motion indicates a state change and lasts 150–200 ms. Empty states use one sentence and the action that fills the state.

## Exclusions

No decorative gradients or blur, tinted icon squares, uppercase eyebrow headings, colour-coded modules, nested cards, fake empty-state tiles, invented numbers, ambient loops, or multiple primary buttons in one view. Image scrims for legibility are allowed.
