# CODECO Supervisie visual direction

CODECO Supervisie serves site supervisors working on phones and tablets in Suriname daylight, often one-handed, and office staff working on laptops. The output is formal records and signed reports. Its visual model is a site document: drawing title blocks, registers, inspection forms, ruled lines, tabular figures, prominent record codes, and compact lists.

## Visual rules

- Structure comes from alignment and hairlines. Use white paper on one light canvas and a nine-step blue-grey ink ramp, the calm of the first version of the app. Big surfaces take a soft outline (`--ink-300`); fields and buttons keep the 3:1 outline (`--ink-500`). Avoid decorative cards, tints, and shadows.
- CODECO signal orange (`#f07400`) marks the one primary action in a view and its current selection. Green (`#177960`) is also the tick of every checkbox and the colour of what is done. Red, amber, green, and blue otherwise convey record state only. Modules have no assigned colour.
- The sidebar is the dark ink (`--ink-950`) with the logo on a white plate; the current page is a raised row with an orange bar. The header and the page stay light. These roles are stated once, in `app/styles/brand.css`.
- Hind is the app face at weights 400, 600, and 700 and sizes 12, 14, 16, 18, 22, and 28 px. Inputs are at least 16 px on phones. Counts, dates, and codes use tabular numerals. Geist Mono is reserved for codes and tokens; Jost is for the public site.
- Controls use a 6 px radius, surfaces 10 px, and status badges a pill. One shadow is available for overlays. A surface gets a 1 px border or a shadow, never both.
- Motion indicates a state change and lasts 150–200 ms. Empty states use one sentence and the action that fills the state.

## Exclusions

No decorative gradients or blur, tinted icon squares, uppercase eyebrow headings, colour-coded modules, nested cards, fake empty-state tiles, invented numbers, ambient loops, or multiple primary buttons in one view. Image scrims for legibility are allowed.
