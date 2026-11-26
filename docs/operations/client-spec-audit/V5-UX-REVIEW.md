# V5 UX review (26-11-2026)

Question asked: are the gaps against the client's request verified, and are the spaces and popups logical (for example a popup where a drawing needs room)?

## How it was done

`apps/web/tests/e2e/ux-walk.spec.ts` (a review aid, run with `UX_WALK=1`, not part of the gates) opens 22 screens of the supervisor app at 1280, 820 and 390 px on the local stack and saves a picture of each. All 66 pictures were made and none of the screens scrolls sideways (checked by the script). I looked at the pictures by eye for about 20 of them: most of the desktop screens and a few on tablet and phone. The rest were not read by eye. The compliance check was checked separately with two real PDFs (`compliance-viewer.spec.ts`).

## Judgement per kind of space

| Where | Space used now | Logical? |
|---|---|---|
| Signing | Popup on submit, plus an inline Signatures block | Popup is right (a signature needs room and a deliberate moment). The inline block and the popup are two ways to the same signature, with a double heading "Signatures / Signature". Open: keep one path |
| Choose a spot on a drawing | Popup over the form, first the drawing, then the spot | Right: a drawing needs the whole window and the form should not move |
| Drawings and pins (the full page) | A link under "Supporting tools" of the Workspace | Logical as a page, but easy to miss; also reachable from Actions |
| Verify / Return on an Issue | Popup (modal on desktop, bottom sheet on a phone) | Right: a short decision with required text |
| Forms (Issue, Works, Delivery, ...) | One page, numbered sections, bar with Record ID, date, "by", status | Right; one long page is what the Excel and the mockups ask for |
| Rapid Verify, spec compliance check | An entry of its own in the section menu ("Spec compliance check"); the document search stays under "Check against specs" | Right. It was three levels deep (section menu, tab row, segmented control); the compliance check is now one step from the menu |
| Compliance check, side by side | Two panes on desktop, stacked on tablet and phone | Right; stacked panes are readable on a phone |
| Portals (View as) | Inside the workspace, read-only, organisation picker | Right |

## Defects found and fixed in this pass

1. Two captions on one field in the sheet forms ("Work discipline" twice, "Quantity completed" twice): the row's caption and the field's. The field's caption is now read, not shown.
2. The drawing picker asked for "the drawing this photo belongs to" in a Works form, and said "No drawing matches this search" for a project without drawings. It now speaks of the record, explains that drawings are uploaded under Project Documents, and shows no "Use this spot" button before a drawing is chosen.
3. "6 required left" on the Issue form listed "category" and "Category" as two things; it now lists a field once.
4. On a phone the Rapid Verify search box stood in a 260 px high empty frame (a flex basis meant for a row).
5. The address `nav=projectdocs` opened the Workspace tiles with Project Documents highlighted.
6. **The two PDFs of the compliance check stayed blank in an `<iframe>`** (blocked by the CSP, and blank on Android Chrome). They are now drawn with pdf.js like everywhere else in the app. This one had passed every earlier check, because none of them opened a real PDF.
7. The compliance assistant read a page as one sentence and proposed a single wrong row ("Clause"). It now reads the lines of the page and proposes one row per requirement; units are shown as written (MPa).
8. The portal preview said "every item shared with a contractor" while one organisation was chosen, and said it twice. One note now names the organisation.
9. A specification registered with the default type "Drawing" never appeared in the compliance check, without a word of explanation. The form now says what to do.

## Not reviewed

- A drawing picker with real drawings (the local data has none): only its empty state and the layout of the dialog were seen.
- Most screens on tablet and phone were not read by eye (the script only proves that nothing scrolls sideways).
- Dutch wording on screen (all pictures are English).
- Scanned PDFs without text in the compliance check (it says so, but it was not run on one).
