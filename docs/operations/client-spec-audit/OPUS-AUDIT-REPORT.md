# Opus audit report (26 / 27-11-2026)

Independent audit of CODECO Supervision against the client's developer package v5 (Excel v5.0, Word v2.0, mockups v6), on the local stack only. Running log with every finding, its evidence and status: `OPUS-AUDIT-LOG.md`. Decisions: `V5-DECISION-REGISTER.md` D-31 and later.

## 1. What was wrong (short)

The owner's complaint was right, and the earlier "all tests pass" did not cover it: the tests measured overlap at 1440 x 900, 820 x 1024 and 390 x 844 and never at a laptop's 1366 x 768 or 1280 x 720, and never checked that the sidebar shows all its menus.

1. **The sidebar did not fit a laptop screen.** At 768 px height the tenth menu ("Management") was cut off behind the orange "Take photo" button; only the page list scrolled. (F01)
2. **Record lists were broken everywhere.** The shared record row put View / Edit / Withdraw in the icon column, so every title sat in the right half and the state pill lay over "Withdraw". (F04, F14) This was a blocker on every Workspace list.
3. **Wrong content.** Opening "Works ongoing" listed every register record of the project, including change orders and technical instructions, with a count of 21. (F02)
4. **Too many controls.** Issue and NCR cards had up to ten buttons each; controlled documents seven. Four filters filled a phone screen before the first record. (F07, F08)
5. **Duplicated and inconsistent navigation.** Rapid Verify and Project Docs were both main menus and "Supporting tools"; Project Documents opened with a "← Workspace" button and the name "Project Docs"; "Reports" opened a page called "Client reports", "Actions" a page called "Action center"; "Issues" counted 9 on the Workspace and 11 in Records & Photos. (F06, F10, F11, F13, F18)
6. **Wasted height.** The module header put "New" on its own row (60 px on every module page); on a phone on its side the two bars took a third of the screen. (F03, F12)

## 2. What was fixed

See the log for each ID. In short: the sidebar is the ten Word menus, the project and the account (the photo button moved to the top bar on desktop, the bottom bar on phone and tablet); shorter rows on short screens; record rows laid out in the shared rule; one list per form; secondary card actions behind one "More actions" / "Send or export" button; filters fold; tile counts per form; page names equal menu names; Project Documents is a main menu page with one orange action; compact bars on a phone on its side; a focused field scrolls clear of the sticky action bar.

## 3. Information architecture: the decision

Authority: Word section 2 (ten menus) and 2.1 (principles); mockups v6 for the sidebar look.

| Place | Before | After | Reason |
|---|---|---|---|
| Sidebar | logo, project, ten menus, "Take photo", account | logo, project, ten menus in Word order, account | Word 2 lists ten menus; the mockups show no photo button; the tenth menu was unreachable at 768 px |
| Top bar (desktop) | breadcrumb, Help, weather, language, connection, notifications (Management gear hidden by CSS) | "Take photo" first (orange on the Overview only, icon-only from 1025 to 1280 px), then the same | One photo button per screen size; the top bar has room, the sidebar has not |
| Phone / tablet bottom bar | Overview, Workspace, Photo, Actions, More | unchanged | The five frequent jobs, one tap |
| Workspace | 15 forms + Supporting tools (Rapid Verify, Project Docs, Assets & folders, Drawings & pins, Calculator & notes, Deadlines) | 15 forms + Drawings & pins, Calculator & notes, Deadlines | Rapid Verify and Project Documents are main menus; files are in Project Documents and Records & Photos |
| Records & Photos | the same 15-form grid as folders | unchanged | Word 5 asks for an archive per form; the grid is the folder list, not a second Workspace (it opens records, not forms) |
| Page names | "Client reports", "Action center", "Project Docs" | "Reports", "Actions", "Project Documents" | One thing, one name (Word 2 names) |

Recommended, not done tonight (see section 6): open Actions on the automatic follow-up list (Word 9; the sidebar badge counts that list, the page opens on "My work"); route the legacy `client` and `contractor` roles to their portals only (Word 8, 21).

## 4. Traceability

- Excel v5.0, every field row of the 15 forms: `OPUS-TRACE-EXCEL.md` (382 rows: 229 match, 128 differ, 3 missing, 22 extra; list values compared by script). Read-only comparison of the code before this run's fixes; none of tonight's fixes changes a form field.
- Word v2.0, every section: `OPUS-TRACE-WORD.md` (about 230 rows). Written against the code before tonight's fixes; rows on the sidebar, Supporting tools and page names are superseded by section 3 above.
- Mockups v6: section 5.

## 5. Mockups against the screens

(filled in below during the run)

## 6. What remains

(filled in at the end of the run)

## 7. Client questions

- Q-1 (F16): may a contractor create RFI, RFA, WCR and inspection requests in the Contractor Portal? Word v2.0 decision 1 says all forms are filled in by Supervision only; Word 6.2 lists no contractor RFI; an earlier written request (20-11-2026) asked for contractor submissions. Default kept: the button stays.
