# Launch audit: camera, saved images and tablet UI (2026-10-31)

Branch `claude/amazing-tesla-xx8xc7`. Every reproduction and fix below ran against the local Supabase stack, the local fixture accounts and the fake Blob store (`tests/e2e/fake-blob`), on a **production build** (`npm run start:e2e:blob`). Production was only read: the applied-migration list and four aggregate queries on `files`, `file_links`, `visual_captures` and `findings` (counts per day, no content), the public `/api/release` endpoint and the Vercel runtime-error summary. Nothing on production was written, deployed or merged.

Status labels: **verified fixed** (reproduced, fixed, re-run in the running app and covered by a test), **fixed – awaiting device or service retest**, **blocked** (the check could not be done here; the reason is given), **open**.

## Release decision

Not launch-ready yet. The camera and image path now passes every scenario that can be run here, on tablet, phone and desktop widths. It is merged (PR #14, `33471d8`) and deployed to production, and migration `202610310001` is applied there. Two checks remain that this machine cannot do: real iPad Safari and Android Chrome devices, and a real Blob-enabled run (preview or a signed-in production photo). See "Blocked checks".

## Camera and saved images

How the path was traced: tap → hidden `<input type="file" capture="environment">` → `normalizeImageFile` (bytes decide the type) → review in the photo library or in a form's photo stack → `queueOfflineUpload` (IndexedDB `uploads`) → `/api/storage/uploads` (reservation + presigned URL) → PUT to Blob → `/api/storage/uploads/complete` → `create_visual_capture` / `file_links` → thumbnail through `/api/storage/files/:id` → reopen after reload.

Reproduction script: a Playwright driver (kept outside the repository) that taps the real buttons, answers the file chooser, then reads the device queue (IndexedDB), the `files` rows and the thumbnails after a reload. The regression cases are in `tests/e2e/camera-capture.spec.ts`.

### CAM-1 · P1 · A photo stack never saves — verified fixed (local), production needs migration

- **Journey:** Photos → Upload photos (or Take photo twice) → Save photo stack.
- **Reproduction (local, 820×1180):** three JPEGs → Save photo stack.
- **Expected:** three photos in the library, grouped as one stack, nothing left on the device.
- **Actual:** "3 file upload(s) not confirmed… Sending failed · tap Send now". The three files were `available` in storage; the device queue kept all three with `permission denied for table visual_captures`. Every retry failed the same way.
- **Root cause:** signed-in users may only *read* `visual_captures` (grant and policy from `202607180020`), but the app grouped the stack, and edited a photo's title and description, with a direct table update. Locally the grant refuses it. On production the role still has the table privilege, so row-level security silently matches no row: the read-only check found **0 captures with a `stack_id`** in production, ever, and "describe" on a stored photo ends in a "no row" error.
- **Change:** migration `202610310001_visual_capture_stack_and_details.sql` adds `set_visual_capture_stack` and `update_visual_capture_details` (security definer, same `files.manage` check as `create_visual_capture`, no table privilege widened). `lib/supabase/operations.ts` calls them. A database without the migration keeps saving the photo and only loses the grouping, as before. `expectedSchemaVersion` is `202610310001`.
- **Verification:** pgTAP `026_visual_capture_stack_and_details` (9 assertions); re-run of the stack scenario at 390, 820, 1180 and 1280 px: "Files uploaded and linked automatically.", device queue empty, three captures share one `stack_id`; e2e `camera-capture.spec.ts` (stack case).

### CAM-2 · P1 · Form photo buttons refuse an Android camera JPEG — verified fixed

- **Journey:** Workspace → Issues (also HSE, NCR, Inspection, register forms) → Add photo.
- **Reproduction:** the same JPEG offered as `image/jpeg`, `image/jpg` and untyped. Only the first was added; the others gave "Use JPEG, PNG or WebP files up to 25 MB each."
- **Root cause:** `addPhotosToStack` in `operational-workspace.tsx` checked `file.type`. The byte check introduced earlier for the app-wide camera and the photo library had never reached the form photo stacks.
- **Change:** the forms use the shared `prepareCameraPhotos` (bytes decide; the size limit stays), which also names any photo it refuses.
- **Verification:** re-run: 1, 2, 3 photos staged for the three labels in Issues and HSE, no error; e2e `camera-capture.spec.ts` (first case, fails on the old code).

### CAM-3 · P2 · A HEIC photo disappears without a word — verified fixed (browser part), device retest pending

- **Reproduction:** the app-wide Take photo with a HEIC file: no review, no message, nothing queued.
- **Root cause:** `normalizeImageFile` returned null for anything but JPEG/PNG/WebP, and the camera handler returned silently when nothing was left.
- **Change:** HEIC/HEIF/AVIF are recognised by their `ftyp` brand and converted to JPEG where the browser can open them (Safari can; Chrome on Windows cannot). Otherwise every capture point names the file: "IMG_0001.HEIC: HEIC photo this browser cannot open. Not added. Choose a JPEG, or set the camera to 'Most compatible'." The library, the visual-evidence screen and the day log use the same normaliser.
- **Verification:** re-run in Chrome: message shown, nothing staged; e2e `camera-capture.spec.ts`. **Awaiting device retest:** the conversion path on iPad Safari (a photo copied from Files as HEIC). iPad camera captures themselves arrive as JPEG because the inputs accept only JPEG/PNG/WebP.

### CAM-4 · P1 · On mobile data the library's Save keeps photos on the device — verified fixed (emulated), device retest pending

- **Reproduction:** `navigator.connection.type = "cellular"` (what Android Chrome reports on a SIM connection) → Take photo → Save with date. Result: "1 upload(s) waiting… Automatic sync is paused on this metered connection", no `files` row. Another device never sees the photo.
- **Root cause:** data saver is on by default, and the library's Save only uploaded when the connection was not metered. The forms already forced the upload on save; the library did not.
- **Change:** tapping Save sends the photo, also on mobile data; the data saver still holds back automatic background sync (the client's 22-07 requirement was about automatic upload).
- **Verification:** emulated re-run: uploaded, queue empty. **Awaiting device retest** on an Android tablet with a SIM.

### CAM-5 · P1 · An offline photo taken before the project was opened is lost — verified fixed

- **Reproduction:** sign in, go offline before opening the workspace, Take photo. The workspace showed "Loading project records…" for ever; the photo lived only in memory; a reload lost it.
- **Root cause (two):** (a) the workspace query (`offlineFirst`, `retry: 1`) paused its retry while offline when there was no stored copy, so it never failed and never showed the offline state; (b) the camera handler handed the photo to the library in memory, and the library only writes its device draft once it has opened.
- **Change:** the workspace query fails at once offline (stored copy or a "No connection. This project has no offline copy on this device yet. Photos you take are kept on this device…" notice). The camera handler writes the photo to the device draft before navigating; the library de-duplicates by name, size and capture time.
- **Verification:** re-run: draft on device after capture and after an offline reload; online again the bar "A photo you took is not saved yet · Back to the photo" leads to it; Save → one `available` file, thumbnail renders.

### CAM-6 · P1 · Offline save in the library uploads the photo twice — verified fixed

- **Found while fixing CAM-5.** With the project copy present offline: Save → queued (correct), but the photo also stayed in the draft, so after reconnecting it was saved a second time (two `files` rows).
- **Root cause:** the "saved on this device" message went through `run()`, whose refetch remounts the library while offline before it clears the draft.
- **Change:** the library shows that message from its own state ("Saved on this device. Not uploaded yet; sent when you're online.", shown while the queue holds files).
- **Verification:** re-run: one queued upload, no draft, one `files` row after reconnect.

### CAM-7 · P3 · "Upload is waiting" stays after a successful Send now — verified fixed

Simulated 500 on `/api/storage/uploads` → photo queued with "Sending failed" (correct). After the route recovered, Send now uploaded it but the old warning stayed. It is cleared now. Re-run: one `available` file, no warning.

### CAM-8 · P3 · Screen readers hear "Back online." on every load — verified fixed

The live region announced a connection change whenever the language changed. It now announces only a real change of `online`.

### Camera checks that passed without a change

Sidebar and bottom-bar Take photo (`capture="environment"`, accept JPEG/PNG/WebP), the library's own Take photo, desktop Upload photos, single photo, offline with a stored project copy, failed upload then retry, thumbnail after reload: all pass at 390, 820, 1180 and 1280 px. The device queue never claims a central upload: "Files uploaded and linked automatically." appears only after the queue is empty.

### Not reproducible here and not changed

- **iOS orientation prompt and the file picker in one tap.** Take photo calls `DeviceOrientationEvent.requestPermission()` before `input.click()`. Desktop Chrome has no such prompt. Whether iPad Safari shows the camera on the first tap needs a device (see Blocked).

## Tablet UI

Compared with the 6 September revision (`54e5d14`, the end of the period the client preferred), built from a separate worktree and run against the same local data at 820×1180 and 1180×820. The screenshots and per-screen heights were taken with a Playwright driver kept outside the repository.

| ID | Screen | Finding | Change | Status |
|---|---|---|---|---|
| UI-1 | Sidebar (≥1025 px) | The logo sat on a white plate, read as a sticker. The September version had none; the logo's yellow letters carry their own outline and read on the dark ink. | Plate removed in `brand.css`; design direction updated. | Verified fixed (screenshot 1180×820) |
| UI-2 | Overview, tablet/phone | One column: Latest work → Recent activity → Priority queue, so the queue (the screen's job) started below the first screen. September had the queue right after latest work. | Below 1024 px the queue follows latest work. | Verified fixed (queue fully in first screen at 820×1180) |
| UI-3 | Workspace, tablet | The six filters stood open above the modules on tablets and pushed half the modules below the fold. | Filters fold behind their summary up to 1024 px (open on desktop). | Verified fixed (all 15 modules and the supporting tools in the first screen) |
| UI-4 | Issue form, tablet | 3.8 screens tall. The September form had the same 11 numbered sections of the client's paper form. | Not changed: the length is the client's form. | Accepted |
| UI-5 | Assets & folders, photo cards | Found by the stability audit once the library held photos: until the private preview loaded, the card's open button was 285×7 px (the thumbnail area was `height: 100%` of an auto-height button) and the card jumped when the photo arrived. | The thumbnail area holds 155 px, like a single preview. | Verified fixed (stability audit with photos: 0 findings) |
| UI-6 | Photo cards, failed preview | When a preview cannot load (a missing Blob, a dropped connection), its Retry `<button>` sat inside the card's open `<button>`: invalid markup, and it overlapped "Open" (48×24 at tablet). | No nested button: the preview retries when the connection returns; opening the card shows the photo with its own retry. | Verified fixed (stability audit in the failed-preview state, tablet and phone) |
| LQA-011 | Project Docs | Two visible `h1`. | The document centre's heading is an `h2`. | Fixed (unit and a11y specs pass) |
| LQA-012 | Address `?nav=punchlist` | Without `tab` the workspace grid showed while Issues was highlighted. | A bare `nav=punchlist` / `nav=projectdocs` opens its module. | Fixed (node field-workflows) |

Kept from the current build on purpose: the first-version palette the client chose on 30-10, the module list rows (the September tiles had tinted icon squares and coloured top stripes, which the approved palette excludes), and every newer feature and permission.

## Role journeys

Covered in the whole-suite run above, against the production build, by these specs (supervisor unless named): sign-in and its errors (`login-a11y`, `session-revoked`), project selection and a link to an unreachable project (`role-views`), daily work and Works ongoing (`day-report-lifecycle`, `works-ongoing-one-field`), workforce (`register-touch-targets`, `field-readiness`), inspections with signature (`inspection-workflow`), issues, NCR, return for correction (`issue-return-for-correction`, `action-center-tabs`), actions (`action-without-assignee`, `double-submit`), documents and signatures (`controlled-document`, `two-party-signature`), photos, 360°, drawings and pins, external sharing (`media-and-sharing`, `camera-capture`), reports (`period-report`), offline use (`offline-app`, `offline-create-and-sync`, `offline-records`), account isolation (`offline-account-isolation`), the contractor's submissions (`contractor-submission`) and what the client and contractor can see (`role-views`).

LQA-013 (the share page's status badge after a contractor answers): `media-and-sharing.spec.ts` now asserts that the badge reads "Gereed voor verificatie" right after a "ready" reply, without a reload. Passed on the production fake-Blob build; LQA-013 is fixed in the register.

## Gates

| Gate | Result |
|---|---|
| Type check (`tsc --noEmit`) | Pass, after the last code change |
| Lint (eslint, stylelint) and design guardrails | Pass; guardrails 9 of 9 |
| Unit and static tests (`npm test`, production build) | Pass, 228 of 228 |
| Database tests (`supabase db reset` + `supabase test db`) | Pass, 26 files, 616 assertions (new: 026, 9) |
| Whole authenticated Playwright suite, production build, fake Blob store, three viewports | 174 passed, 0 failed, 129 skipped by design (16.8 min) |
| Re-run of the specs touched after that build (camera-capture, ui-stability-audit, a11y-audit, media-and-sharing, media-desktop-upload) | 30 passed, 0 failed; UI stability audit 72 screens, 0 findings, worst layout shift 0.004 |
| Camera scenarios in the running app (driver outside the repository) | Pass at 390, 820, 1180, 1280 px: sidebar and library Take photo, desktop upload, `image/jpg` and untyped JPEG, HEIC message, stack, mobile data, offline with and without a project copy, failed upload and retry, thumbnail after reload |

Not covered by any local run: the real Vercel Blob store, real devices, and production with migration `202610310001`.

## Blocked checks

| Check | Why it is blocked | What is needed |
|---|---|---|
| iPad Safari and Android Chrome on real devices (camera, permission prompt, HEIC conversion, mobile data) | No device is connected to this machine. | Run `tests/e2e/camera-capture.spec.ts` steps by hand on an iPad and an Android tablet with a SIM, against a preview. |
| Real Blob-enabled preview | Preview deployments sit behind Vercel Authentication; opening one needs a share link (a write on the Vercel project) and a sign-in on whatever database the preview uses, which is not known (its environment values were not decrypted). | The owner opens the preview of this branch, applies `202610310001` to the preview database, and takes a photo, a stack and a 360° image. |
| Production sign-in smoke | Needs a production account; none was used. | As in `PRODUCTION-READINESS-2026-10-31.md`. |

## Deployed on 2026-10-31

With the owner's permission in chat: PR #14 merged into `main` (`33471d8`) after its five checks passed (Playwright, database lint and pgTAP, web lint/test/build/audit, Vercel preview). Vercel built it as production deployment `dpl_Ber2aLi2MGfY3N8Cxa54iVe6ryVx`; `/api/release` reports commit `33471d81774a` and `expectedSchemaVersion` `202610310001`.

Migration `202610310001` was then applied to production (`dljbeheogaeviokpcvca`) through the Supabase tool, as written. The tool recorded it as `20261031180519`; that row was renamed to `202610310001` so a later `supabase db push` sees it as applied. Checked afterwards: latest version `202610310001`; both functions are `SECURITY DEFINER`, executable by `authenticated` and not by `anon`; an anonymous call to `/rest/v1/rpc/set_visual_capture_stack` returns 401 "permission denied for function", so the API has loaded it. The security advisor lists the two new functions under the existing "signed-in users can execute SECURITY DEFINER function" warning (they check `files.manage` inside) and nothing new otherwise.

Read-only smoke after the deploy: `/`, `/supervisie`, `/sw.js` and `/manifest.webmanifest` return 200; an unknown share token returns 404; no runtime errors in the hour after the deploy. Not done: a signed-in photo, stack and 360° capture on production, which needs a production account.
