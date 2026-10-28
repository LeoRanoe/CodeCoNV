# Navigation audit

Scope: every way a supervisor moves through CODECO Supervisie on a phone (390px) and a laptop,
reviewed on the local fixture project on 2026-10-28. This records what was found, what changed,
and what is still open. Nothing here was checked on a real device.

## The map

| Surface | Phone | Laptop |
|---|---|---|
| Project and account | Header row: project name (opens the project switcher), help, connection state, notifications. Language and sign-out are in the More sheet. | Sidebar project card, account card with sign-out, header row with the same four controls. |
| Main destinations | Bottom bar: Overview, Workspace, Photo, Actions, More. | Sidebar: Overview, Workspace, Actions, Rapid Verify, Reports, Settings (what each person may open depends on their role). Project Docs and Issues are workspace modules, not sidebar items. |
| Modules | Workspace tiles, two per row. A module page has one row: back to Workspace, title with count, New. | Same, three tiles per row. |
| Sections inside a page | Tab grids (Management, Reports, Actions, Daily log, Documents). | Same grids. |
| Forms | Opened by New (or Edit) inside a module; closed by saving, cancelling or the back arrow. | Same. |

## Findings and what changed

1. **Tab bars scrolled sideways.** Management, Reports, Actions, the daily log and Documents hid
   their later tabs off-screen, so a person could not tell they were there. All of them are now a
   wrapping grid at every width: every tab is visible and one tap away, the current one is orange
   with a heavier label, and each target is at least 48px.
2. **The header held seven controls in two rows.** It is one row of four: project, help,
   connection state, notifications. Weather moved out of the header (the overview already shows
   it) and the language choice moved to the More sheet.
3. **A form opened under four layers of chrome** (module card, form heading, status chip, a table
   of seven facts). On a phone the first field was about 700px down. The module card is one row, the
   form heading is one row, and the facts are a compact two-column block, which puts the first
   field at about 490px.
4. **Leaving a form lost what was typed.** Only the daily log, the workforce register and photos
   kept a draft. Issue, NCR, HSE, Start inspection, every register (delivery, agreement, change
   order, delay report, lesson learned, technical instruction and the rest) and the New action
   dialog now keep one too. See "Autosave" below.
5. **Module names were one per row.** Two per row shows about twice as many modules on a screen.
6. **Nothing answered a tap.** Pages fade in over 160ms, dialogs rise 12px, buttons and tabs
   press down to 97%. No motion loops, nothing moves by itself, and a device set to reduce motion
   gets none.

## Autosave

- One draft per form, per project, stored on the device in the existing `drafts` store (the one the
  daily log already used). It is cleared on sign-out and on account switch by the existing account
  isolation, so one account's draft is never offered to another.
- A draft is written about 0.6s after the last change, and immediately when the page is hidden or the
  person switches module. Opening a form and leaving writes nothing.
- A saved draft is put back when the form is opened again, with "Draft from 12:04 put back" and a
  Start over button. Sending the record removes the draft.
- Photos, files and signatures are part of the draft. A draft is only ever for a new record; editing a
  stored record keeps using the stored record.
- Not covered: sign-in and password forms (nothing secret is ever stored), the project start (day
  start) questions, project setup, team invitations, and filters and searches. These are short or
  deliberately not kept.

## Still open

- **Switching module inside a form.** The module pages have no module switcher, by an earlier client
  decision ("I do not understand this, maybe it can go"). Moving to another module is Workspace, then
  the tile. With autosave this is now safe, but it is two taps, not one.
- **More sheet on a phone** mixes destinations (Reports, Management) with actions (Switch project,
  Sign out). Splitting them into two groups is the next refinement.
- **Overview** still has no single obvious first action; Open workspace and the three icon buttons
  compete.
- **Desktop tab grids** wrap onto two rows when a section has many tabs. A side list may read better
  above eight tabs.
- **Not verified:** a real phone (keyboard, camera, GPS), private media, live external sharing, and
  the autosave of photo-heavy forms on a device that is low on storage.
