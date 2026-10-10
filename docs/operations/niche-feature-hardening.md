# Niche feature hardening — CODECO Supervisie

Audit started: 2026-10-10. Status: **partial hardening delivered for review; remaining audit work recorded below; not production-certified**.

## Discovery evidence

- Repository-wide browser-API search: app, lib, public/sw.js; dependency review: package.json; API routes, migrations, pgTAP, unit and Playwright suites searched.
- Product documentation checked: field-guide.tsx, offline-gebruik-en-grenzen.md, production-readiness.md and product signing/360 notes.
- Computer Use discovery: local existing supervisor fixture signed in at /supervisie, selected Paramaribo Field Readiness Demo, opened Workspace and inspected supporting tools. Full conditional/role/feature operation remains pending.
- Second source pass covered browser APIs, generated downloads, project calendar dates, GPS cancellation, signature validation, account ownership and IndexedDB lifecycle. The discovered API list is preserved in niche-browser-api-discovery.txt beside this document.
- No layout redesign. The pre-existing .claude/launch.json is excluded. Existing integration commits are included in the review branch unchanged.
- Source inspection and existing tests are not manual verification. Unknown or environment-dependent checks stay pending.

## Inventory

### 01. Drawing PDF pages / raster preview / DWG source

| Field | Evidence / state |
|---|---|
| Feature | Drawing PDF pages / raster preview / DWG source |
| Component/files | apps/web/app/drawing-workspace.tsx; apps/web/app/drawing-location-picker.tsx |
| User entry point | Workspace → Drawings & pins; record location picker |
| Primary interaction | PDF loading, rapid page changes, original-source storage/download |
| Browser APIs used | PDF.js worker, canvas, ResizeObserver, object URLs |
| Server/API dependency | storage routes; drawing files |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Cached files only; DWG is source-only |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Page-loading gesture race; PDF import-after-unmount worker leak |
| Automated coverage | drawing-viewport.test.mjs; media-and-sharing.spec.ts; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Page-loading gesture race; PDF import-after-unmount worker leak (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Guard PDF teardown and require the displayed file/page/render identity before gestures. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 02. Drawing pan / zoom / pinch / linked pins

| Field | Evidence / state |
|---|---|
| Feature | Drawing pan / zoom / pinch / linked pins |
| Component/files | apps/web/lib/drawings/viewport.mjs; apps/web/app/drawing-workspace.tsx |
| User entry point | Drawings & pins → pin/pan tools |
| Primary interaction | Normalized positions, tap vs drag vs pinch, linked-record navigation |
| Browser APIs used | Pointer capture, SVG, keyboard |
| Server/API dependency | drawing pin RPCs; drawing_pins |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Create/move/void queue |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Pin drag cancellation; loading-page coordinates; read-only interaction boundaries |
| Automated coverage | drawing-viewport.test.mjs; media-and-sharing.spec.ts; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Pin drag cancellation; loading-page coordinates; read-only interaction boundaries (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Reject interrupted, non-primary and loading-page gestures; restore queued linked pins. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 03. Drawing markup

| Field | Evidence / state |
|---|---|
| Feature | Drawing markup |
| Component/files | apps/web/lib/drawings/markup-geometry.mjs; apps/web/app/drawing-workspace.tsx |
| User entry point | Drawings & pins → pen/arrow/cloud/text |
| Primary interaction | Create/save per-page normalized geometry |
| Browser APIs used | Pointer capture, SVG |
| Server/API dependency | create_drawing_markup; drawing_markups |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Requires connection |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Interrupted gestures crossing pages/tools; simultaneous saves |
| Automated coverage | drawing-viewport.test.mjs; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Interrupted gestures crossing pages/tools; simultaneous saves (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Reset gestures on page/tool/source changes; reject gestures against stale rendered pages. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 04. Drawing-pin offline replay

| Field | Evidence / state |
|---|---|
| Feature | Drawing-pin offline replay |
| Component/files | apps/web/lib/offline/drawing-pin-queue.ts; apps/web/lib/offline/idb.ts |
| User entry point | Drawing pin changes while offline |
| Primary interaction | Ordered retry, idempotency, account/project isolation |
| Browser APIs used | IndexedDB, online events |
| Server/API dependency | create/move/void drawing RPCs; drawing_pins |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Durable per-owner queue |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Account switch during in-flight sync; failure reported as success; queued pins not reconstructed on reopen |
| Automated coverage | offline-account-isolation.spec.ts (general); dedicated coverage needed; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Account switch during in-flight sync; failure reported as success; queued pins not reconstructed on reopen (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Replay queued edits in order, stop after failures, surface storage errors, and capture/check owner around asynchronous writes. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 05. Panorama source normalization

| Field | Evidence / state |
|---|---|
| Feature | Panorama source normalization |
| Component/files | apps/web/lib/images/field-image.mjs; apps/web/lib/offline/upload-queue.ts; apps/web/app/visual-evidence-workspace.tsx |
| User entry point | Visual evidence → 360 upload |
| Primary interaction | INSP normalization, image decode, dual-fisheye samples, size reduction |
| Browser APIs used | createImageBitmap, canvas, File, object URLs |
| Server/API dependency | storage upload routes; files, visual_captures |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Durable queued upload |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Extension-only MIME inference; async selected-file race; upload before decode completes |
| Automated coverage | field-workflows.test.mjs; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Extension-only MIME inference; async selected-file race; upload before decode completes (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Validate image magic, dimensions and upload input; ignore obsolete preprocessing results. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 06. Panorama viewer / spherical markers

| Field | Evidence / state |
|---|---|
| Feature | Panorama viewer / spherical markers |
| Component/files | apps/web/app/visual-evidence-workspace.tsx |
| User entry point | Visual evidence → stored 360 image |
| Primary interaction | Look, zoom, mark spherical coordinates, focus a marker |
| Browser APIs used | WebGL, pointer/touch, fullscreen |
| Server/API dependency | visual annotation/finding RPCs; visual_annotations |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Cached images; writes require connection |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Failed frame recoverability; malformed saved geometry; instance lifecycle |
| Automated coverage | media-and-sharing.spec.ts; field-workflows.test.mjs; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Failed frame recoverability; malformed saved geometry; instance lifecycle (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Destroy failed viewer initialization and reset viewer controls when capture changes. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 07. 360 tours

| Field | Evidence / state |
|---|---|
| Feature | 360 tours |
| Component/files | apps/web/app/visual-evidence-workspace.tsx |
| User entry point | 360 upload → tour name/order; viewer next/previous |
| Primary interaction | Circular frame navigation, stable ordering |
| Browser APIs used | Viewer/object URL lifecycle |
| Server/API dependency | visual_captures tour_name/tour_order |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Cached frames only |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Blank/invalid order; same-name mixed photo/building tour; failed frame navigation |
| Automated coverage | media-and-sharing.spec.ts (single sphere); tour coverage needed; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Blank/invalid order; same-name mixed photo/building tour; failed frame navigation (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Scope and stably order tours by building/type/status; validate named-tour position. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 08. Panorama gyroscope / autorotate / compass

| Field | Evidence / state |
|---|---|
| Feature | Panorama gyroscope / autorotate / compass |
| Component/files | apps/web/app/visual-evidence-workspace.tsx; apps/web/lib/images/compass.ts |
| User entry point | 360 viewer control bar; photo direction |
| Primary interaction | Explicit phone motion activation and heading display |
| Browser APIs used | DeviceOrientationEvent, gyroscope plugin, fullscreen |
| Server/API dependency | No new dependency beyond capture read |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Local device capability |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Capability state persists across frame change; async activation after destroy |
| Automated coverage | Real-device verification required; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Capability state persists across frame change; async activation after destroy (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Reset gyroscope/autorotate state across captures; physical permission behavior remains pending. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 09. Photo markup editor and output

| Field | Evidence / state |
|---|---|
| Feature | Photo markup editor and output |
| Component/files | apps/web/app/photo-markup.tsx; apps/web/lib/images/field-image.mjs |
| User entry point | Photo evidence → mark photo |
| Primary interaction | Numbered markers, pen, arrows, boxes, tone/severity/context, image/text output |
| Browser APIs used | Canvas, SVG, Pointer capture, object URLs |
| Server/API dependency | normal evidence upload and record details |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Generated photo enters normal queue |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Image/text numbering consistency; invalid/huge image; multi-pointer/cancel export race |
| Automated coverage | field-workflows.test.mjs; media-and-sharing.spec.ts; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Image/text numbering consistency; invalid/huge image; multi-pointer/cancel export race (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Prevent stale image initialization and duplicate export; catch null image output. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 10. Camera / photo stacks / thumbnail previews

| Field | Evidence / state |
|---|---|
| Feature | Camera / photo stacks / thumbnail previews |
| Component/files | apps/web/app/photo-evidence.tsx; apps/web/app/codeco-supervision-app.tsx; apps/web/app/stored-photo-detail.tsx |
| User entry point | Photo button; record evidence attachment |
| Primary interaction | Camera file capture, multi-photo stack, detail modal |
| Browser APIs used | File input capture, object URLs, image decoding |
| Server/API dependency | files and visual capture routes |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Upload queue and cached files |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Preview lifecycle; stale selection; decoding failure and size |
| Automated coverage | media-and-sharing.spec.ts; mobile-forms.spec.ts; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Preview lifecycle; stale selection; decoding failure and size (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Guard upload/preprocessing races and reject unsupported image bytes. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 11. EXIF photo direction extraction

| Field | Evidence / state |
|---|---|
| Feature | EXIF photo direction extraction |
| Component/files | apps/web/lib/images/exif-direction.mjs; apps/web/lib/images/compass.ts |
| User entry point | Photo selection → automatic direction |
| Primary interaction | Bounded JPEG TIFF/GPS parsing and compass fallback |
| Browser APIs used | ArrayBuffer/DataView, File.slice, orientation events |
| Server/API dependency | Stored direction on visual capture |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Local parsing |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Corrupt offsets; repeated selection late result; missing metadata |
| Automated coverage | field-workflows.test.mjs; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Corrupt offsets; repeated selection late result; missing metadata (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Guard obsolete EXIF preprocessing; broader fixture coverage remains pending. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 12. Record satellite map math

| Field | Evidence / state |
|---|---|
| Feature | Record satellite map math |
| Component/files | apps/web/app/record-location-map.tsx; apps/web/app/api/maps/static/route.ts |
| User entry point | Issue / daily work → location section |
| Primary interaction | Tap map image → Web Mercator coordinates at current zoom |
| Browser APIs used | Fetch, object URL, rendered bounds |
| Server/API dependency | authenticated rate-limited map proxy; optional Google Maps |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Coordinate entry works; map requires provider/network |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Polar/out-of-range center; zero bounds; NaN/Infinity; antimeridian |
| Automated coverage | New deterministic map tests required; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Polar/out-of-range center; zero bounds; NaN/Infinity; antimeridian (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Clamp Mercator latitude/world position, wrap longitude and validate coordinates/zoom. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 13. Device geolocation

| Field | Evidence / state |
|---|---|
| Feature | Device geolocation |
| Component/files | apps/web/app/operational-workspace.tsx |
| User entry point | Issue / daily work → Use my location |
| Primary interaction | GPS convenience with manual fallback |
| Browser APIs used | navigator.geolocation |
| Server/API dependency | Coordinates saved on record |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | GPS may operate offline |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Timeout already bounded at 15s; late callback overriding newer/manual input; low accuracy |
| Automated coverage | Browser permission/error mocking and real-device checks required; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Timeout already bounded at 15s; late callback overriding newer/manual input; low accuracy (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Bound and cancel GPS requests; preserve manual edits and show denial fallback. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 14. Hierarchical locations

| Field | Evidence / state |
|---|---|
| Feature | Hierarchical locations |
| Component/files | apps/web/app/location-picker.tsx |
| User entry point | Record/photo/field-tool building and location controls |
| Primary interaction | Building → floor → room → element; breadcrumbs and required depth |
| Browser APIs used | React controlled select |
| Server/API dependency | location_nodes; server location validation |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Snapshot tree |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Cycles/missing parent are truncated; foreign ancestor accepted; shallow selection permitted; stale building selection |
| Automated coverage | New deterministic hierarchy tests required; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Cycles/missing parent are truncated; foreign ancestor accepted; shallow selection permitted; stale building selection (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Reject cyclic, orphaned, inactive and foreign-building hierarchy nodes; clear stale selection. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 15. Speech dictation

| Field | Evidence / state |
|---|---|
| Feature | Speech dictation |
| Component/files | apps/web/app/dictate-button.tsx |
| User entry point | Microphone beside text fields |
| Primary interaction | Explicit start/stop and append final transcript |
| Browser APIs used | SpeechRecognition / webkitSpeechRecognition |
| Server/API dependency | Browser recognition provider; no application AI |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Provider/browser dependent |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | No unmount cleanup; start exception; stale callback; hidden background recognition |
| Automated coverage | Browser mock interaction tests required; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | No unmount cleanup; start exception; stale callback; hidden background recognition (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Detach and abort recognition on hidden/unmounted/language changes; preserve text, surface errors and allow retry. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 16. Rapid Verify PDF/text indexing

| Field | Evidence / state |
|---|---|
| Feature | Rapid Verify PDF/text indexing |
| Component/files | apps/web/app/rapid-verify-workspace.tsx |
| User entry point | Sidebar/Workspace → Rapid Verify → Add sources |
| Primary interaction | Local PDF page text extraction and source library |
| Browser APIs used | PDF.js worker, File, arrayBuffer |
| Server/API dependency | Optional authenticated project file downloads |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Local sources operate offline |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | PDF workers not destroyed; unbounded file/pages; duplicate name identity; partial batch failure |
| Automated coverage | New extraction lifecycle/browser tests required; execution evidence recorded below when run |
| Manual coverage | After automation: added valid text plus corrupt PDF, observed partial success/error, checked cited evidence and immediate clearing after unrelated query. |
| Issues found | PDF workers not destroyed; unbounded file/pages; duplicate name identity; partial batch failure (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Hash actual bytes; validate bounded PDF/text sources; cancel/clean up extraction; keep partial batch successes and actual page citations. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 17. Rapid Verify deterministic search / compare

| Field | Evidence / state |
|---|---|
| Feature | Rapid Verify deterministic search / compare |
| Component/files | apps/web/app/rapid-verify-workspace.tsx |
| User entry point | Rapid Verify question/compare tabs |
| Primary interaction | Normalize, rank actual source passages and calculate term coverage |
| Browser APIs used | Local processing; clipboard |
| Server/API dependency | None after source indexing |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Local-only session index |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Accent normalization inconsistent; removed source retains evidence; duplicate-name result keys; stale query conclusion |
| Automated coverage | New deterministic search tests required; execution evidence recorded below when run |
| Manual coverage | After automation: added valid text plus corrupt PDF, observed partial success/error, checked cited evidence and immediate clearing after unrelated query. |
| Issues found | Accent normalization inconsistent; removed source retains evidence; duplicate-name result keys; stale query conclusion (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Normalize accents, bound search/excerpts and invalidate evidence when query, mode or sources change. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 18. Signature pad across contexts

| Field | Evidence / state |
|---|---|
| Feature | Signature pad across contexts |
| Component/files | apps/web/app/signature-pad.tsx; apps/web/lib/signatures/handwritten-signature.mjs |
| User entry point | Daily reports, NCR, record signatures, external share |
| Primary interaction | Handwritten ink, undo/clear, cropped PNG, name/time attribution |
| Browser APIs used | Canvas, Pointer capture, resize |
| Server/API dependency | Record/signature RPCs and external response route |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Depends on containing record queue |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Resize clips CSS-pixel strokes; second pointer corrupts stroke; cancellation |
| Automated coverage | field-workflows.test.mjs; controlled-document.spec.ts; day-report-lifecycle.spec.ts; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Resize clips CSS-pixel strokes; second pointer corrupts stroke; cancellation (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Keep strokes in stable logical coordinates across resize; validate signature image header and timestamp. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 19. Two-party agreement signatures

| Field | Evidence / state |
|---|---|
| Feature | Two-party agreement signatures |
| Component/files | apps/web/app/agreement-signature.tsx; apps/web/app/field-tools.tsx; apps/web/app/operational-workspace.tsx |
| User entry point | Agreements register; Field tools agreement |
| Primary interaction | Independent signer name/position/timestamp/image |
| Browser APIs used | Shared SignaturePad |
| Server/API dependency | register_entries details fields |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Record rules apply |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | FieldTools opens agreement without hydrating both signers; save clears existing signatures; type selector while editing |
| Automated coverage | Two-party persistence browser tests required; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | FieldTools opens agreement without hydrating both signers; save clears existing signatures; type selector while editing (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Hydrate both parties and signatures independently; preserve images during edit; prevent duplicate saves. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 20. Sketch pad

| Field | Evidence / state |
|---|---|
| Feature | Sketch pad |
| Component/files | apps/web/app/sketch-pad.tsx |
| User entry point | Photo modal → sketch |
| Primary interaction | Hand drawing, colour/width, undo/clear, PNG export |
| Browser APIs used | Canvas, Pointer capture, resize, toBlob |
| Server/API dependency | Saved as ordinary photo evidence |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Local generated evidence can queue |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Resize clips ink; tap produces invisible image; second pointer; interrupted toBlob save |
| Automated coverage | New geometry and browser tests required; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Resize clips ink; tap produces invisible image; second pointer; interrupted toBlob save (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Keep logical strokes across resize, clear pointer state and guard failed/duplicate exports. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 21. Construction calculator

| Field | Evidence / state |
|---|---|
| Feature | Construction calculator |
| Component/files | apps/web/app/field-tools.tsx |
| User entry point | Management → Field tools |
| Primary interaction | Expression grammar and dimensional area/volume |
| Browser APIs used | Local number parsing |
| Server/API dependency | None |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Fully local |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Recursion/input bounds missing; decimal .5 unsupported; quantity zero treated as one; overflow |
| Automated coverage | New deterministic calculator tests required; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Recursion/input bounds missing; decimal .5 unsupported; quantity zero treated as one; overflow (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Replace expression evaluation with bounded arithmetic grammar; reject injection, non-finite results and division by zero. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 22. Field notepad / agreement workflow

| Field | Evidence / state |
|---|---|
| Feature | Field notepad / agreement workflow |
| Component/files | apps/web/app/field-tools.tsx |
| User entry point | Management → Field tools |
| Primary interaction | Edit dated notes, agreements, location, responsibility, dictation |
| Browser APIs used | Shared speech/signature/location controls |
| Server/API dependency | create/update register RPCs |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Depends on register queue support |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Editing technical_instruction coerced to note; signer hydration; stale agreement state between notes |
| Automated coverage | field-workflows.test.mjs (general); browser tests needed; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Editing technical_instruction coerced to note; signer hydration; stale agreement state between notes (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Restrict editing to supported note/agreement types; hydrate agreement metadata; preserve zero quantities and guard duplicate saves. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 23. Backup verification / retention / restore validation

| Field | Evidence / state |
|---|---|
| Feature | Backup verification / retention / restore validation |
| Component/files | apps/web/app/backup-center.tsx; apps/web/lib/backups/server.ts; apps/web/lib/supabase/operations.ts |
| User entry point | Management → Backup Center |
| Primary interaction | Scope export, checksum, scheduled status, dry-run manifest validation |
| Browser APIs used | File, Blob download, crypto SHA-256 |
| Server/API dependency | backup routes/RPCs; backup_runs; private Blob backup store |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Requires connection |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Old verified run can mask newer failed run; future timestamps treated healthy; restore rehearsal vs manifest dry run |
| Automated coverage | 008_automated_backups.pgtap.sql; production-readiness notes; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Old verified run can mask newer failed run; future timestamps treated healthy; restore rehearsal vs manifest dry run (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Sort runs without mutation; distinguish scheduled failure, unknown timestamps, archive validation and actual restore rehearsal. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 24. Push device states / PWA installation

| Field | Evidence / state |
|---|---|
| Feature | Push device states / PWA installation |
| Component/files | apps/web/lib/notifications/push-client.ts; apps/web/lib/notifications/push.ts; apps/web/app/offline-manager.tsx |
| User entry point | Offline / notification activation control |
| Primary interaction | Permission and VAPID subscription lifecycle, expired endpoints |
| Browser APIs used | Notification, PushManager, service worker, display-mode |
| Server/API dependency | push subscription route; push_subscriptions |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Activation requires connection |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | iPad detection uses userAgent instead of platform fallback; standalone check ordering; worker-ready indefinite wait |
| Automated coverage | Field readiness browser tests; device verification required; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | iPad detection uses userAgent instead of platform fallback; standalone check ordering; worker-ready indefinite wait (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Handle unsupported/SSR/iPad installation states, subscription expiry/VAPID mismatch and bounded readiness. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 25. Service worker update / precache / notifications

| Field | Evidence / state |
|---|---|
| Feature | Service worker update / precache / notifications |
| Component/files | apps/web/public/sw.js; apps/web/app/offline-manager.tsx |
| User entry point | App startup; offline install/update banner; notification click |
| Primary interaction | Install/activate, shell fallback, hashed assets, same-origin notification routing |
| Browser APIs used | CacheStorage, service worker events, MessageChannel |
| Server/API dependency | Same-origin shell; no private API caching |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Cached shell with network timeout |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Activation deletes unrelated origin caches; precache arbitrary URLs; malformed push JSON |
| Automated coverage | offline-app.spec.ts; offline-create-and-sync.spec.ts; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Activation deletes unrelated origin caches; precache arbitrary URLs; malformed push JSON (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Restrict cache cleanup to owned namespace and same-origin precache; await cache writes and handle malformed push data. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 26. Account/project offline cache and record/upload queues

| Field | Evidence / state |
|---|---|
| Feature | Account/project offline cache and record/upload queues |
| Component/files | apps/web/lib/offline/*; apps/web/lib/supabase/offline-session.ts; apps/web/app/offline-manager.tsx |
| User entry point | Offline availability → download / sync / sign-out |
| Primary interaction | Snapshot/file caching, durable writes, idempotent reconnect |
| Browser APIs used | IndexedDB, localStorage, online events, crypto |
| Server/API dependency | Supabase record/file RPCs and gateway |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Per-owner unsent stores; readable cache purged on account change |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | In-flight account change; blocked IDB upgrade; failed transactions leave connections open; storage denial |
| Automated coverage | offline-account-isolation.spec.ts; offline-records.spec.ts; offline-create-and-sync.spec.ts; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | In-flight account change; blocked IDB upgrade; failed transactions leave connections open; storage denial (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Own cached files per account, reject obsolete gateway reads and bound/close IndexedDB connections; record/upload sync switching remains open. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 27. External share mini-app

| Field | Evidence / state |
|---|---|
| Feature | External share mini-app |
| Component/files | apps/web/app/share/[token]/*; apps/web/app/api/external-share/*; apps/web/lib/external-share/* |
| User entry point | Recipient opens restricted share URL |
| Primary interaction | Anonymous evidence upload, signature and response completion |
| Browser APIs used | File, fetch, crypto, SignaturePad |
| Server/API dependency | token hash lookup; rate limits; record scope RPCs; files/share_links |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Response requires network; errors keep typed fields |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Retry generates new idempotency key; upload repeated after response transport failure; revoked/expired tokens |
| Automated coverage | media-and-sharing.spec.ts; 015_external_ncr_contractor_boundaries.pgtap.sql; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Retry generates new idempotency key; upload repeated after response transport failure; revoked/expired tokens (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Prevent duplicate in-flight responses; reuse response idempotency and uploaded evidence during same-page retry. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 28. Private file uploads / hash verification / downloads

| Field | Evidence / state |
|---|---|
| Feature | Private file uploads / hash verification / downloads |
| Component/files | apps/web/lib/storage/gateway.ts; apps/web/app/api/storage/*; apps/web/lib/storage/content-hash.ts |
| User entry point | Evidence/doc/drawing upload and download controls |
| Primary interaction | Presigned XHR upload, server verified completion, preview/download |
| Browser APIs used | XHR progress, crypto.subtle, object URLs, popup |
| Server/API dependency | private Blob store and file authorization RPCs |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Cached read fallback; queue writes |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Cached read fallback after authorization failure; immediate download URL revoke; XHR has no timeout |
| Automated coverage | media-and-sharing.spec.ts; production-readiness review; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Cached read fallback after authorization failure; immediate download URL revoke; XHR has no timeout (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Do not fall back after HTTP/auth failure; capture file-cache owner, bound uploads and delay download URL revocation. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 29. Generated PDF / DOCX / JSON downloads

| Field | Evidence / state |
|---|---|
| Feature | Generated PDF / DOCX / JSON downloads |
| Component/files | apps/web/lib/reports/*; apps/web/lib/supabase/operations.ts; apps/web/app/report-download-buttons.tsx |
| User entry point | Report export controls; manual backup |
| Primary interaction | Snapshot formatting, signature/photo embedding, generated file delivery |
| Browser APIs used | React PDF renderer, docx, Blob/object URL |
| Server/API dependency | Report snapshot/file read and backup RPCs |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Some snapshots cached; generation local |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Async multiple clicks; download filename and URL lifecycle; embedding failure |
| Automated coverage | report-vocabulary.test.mjs; field-workflows.test.mjs; report lifecycle E2E; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Async multiple clicks; download filename and URL lifecycle; embedding failure (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Share attached/sanitized blob download helper with delayed revocation across PDF, DOCX, JSON and templates. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 30. BOQ CSV parser / preview / import / template

| Field | Evidence / state |
|---|---|
| Feature | BOQ CSV parser / preview / import / template |
| Component/files | apps/web/lib/boq/csv.ts; apps/web/app/operational-workspace.tsx |
| User entry point | Management BOQ → choose CSV → review → import |
| Primary interaction | Quoted CSV, aliases, numeric values, bulk import |
| Browser APIs used | File.text, Blob download |
| Server/API dependency | BOQ import RPC; boq_items |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Requires network to import |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Quoted multiline split incorrectly; unclosed quotes accepted; duplicate codes/columns; unbounded bytes |
| Automated coverage | New deterministic CSV tests required; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Quoted multiline split incorrectly; unclosed quotes accepted; duplicate codes/columns; unbounded bytes (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Parse quoted multiline/BOM/CRLF CSV correctly; bound data; reject malformed cells, duplicate aliases/codes and invalid numbers; ignore obsolete previews. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 31. Prompt Library / source routes / clipboard

| Field | Evidence / state |
|---|---|
| Feature | Prompt Library / source routes / clipboard |
| Component/files | apps/web/app/prompt-library.tsx; apps/web/app/operational-workspace.tsx |
| User entry point | Management → Prompt Library |
| Primary interaction | Search categories, copy prompt, navigate required exports |
| Browser APIs used | navigator.clipboard; timeout |
| Server/API dependency | None until navigating source screen |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Local prompt library |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Clipboard failure unhandled; timeout cleanup; language switching |
| Automated coverage | Source-route/browser tests needed; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Clipboard failure unhandled; timeout cleanup; language switching (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Await clipboard outcome, report failure, clean legacy fallback and restore focus. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 32. Local record search / dates / urgency ranking

| Field | Evidence / state |
|---|---|
| Feature | Local record search / dates / urgency ranking |
| Component/files | apps/web/lib/records/record-directory.mjs; apps/web/lib/actions/action-center.mjs |
| User entry point | Workspace and overview search; Actions/Deadlines |
| Primary interaction | Code/fuzzy ranking; Dutch/English filters; site-time due date sorting |
| Browser APIs used | Intl timezone; local processing |
| Server/API dependency | Cached project register snapshot |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Snapshot search available |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Malformed dates, limit bounds, no results, duplicate codes |
| Automated coverage | field-workflows.test.mjs; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Malformed dates, limit bounds, no results, duplicate codes (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Apply Suriname calendar day filters regardless of browser timezone and reject invalid date input. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 33. Modal focus / browser history / back navigation

| Field | Evidence / state |
|---|---|
| Feature | Modal focus / browser history / back navigation |
| Component/files | apps/web/app/dialog-manager.tsx; apps/web/lib/navigation/app-history.ts; apps/web/lib/navigation/record-focus.ts |
| User entry point | All nested modals; browser/mobile back; record deep link |
| Primary interaction | Focus trap/restore, inert background, body scroll lock, overlay history |
| Browser APIs used | MutationObserver, keyboard, history, requestAnimationFrame |
| Server/API dependency | None |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Local UI |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Nested modal and rapid replacement; interruption; unmounted trigger |
| Automated coverage | dialogs.spec.ts; field-workflows.test.mjs; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Nested modal and rapid replacement; interruption; unmounted trigger (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Discovery/source review only; no new modal/history fix claimed. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 34. Weather refresh and deterministic form suggestions

| Field | Evidence / state |
|---|---|
| Feature | Weather refresh and deterministic form suggestions |
| Component/files | apps/web/lib/weather.ts; apps/web/lib/weather-client.ts; apps/web/app/live-weather-chip.tsx |
| User entry point | Topbar weather; day report/inspection suggested conditions |
| Primary interaction | Location resolution, refresh, provider failure, recorded vs live status |
| Browser APIs used | Fetch, interval, Intl |
| Server/API dependency | authenticated rate-limited weather route; Open-Meteo |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Last recorded weather distinct from live |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Slow refresh/out-of-order location results; missing provider data |
| Automated coverage | field-workflows.test.mjs; field-readiness.spec.ts; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Slow refresh/out-of-order location results; missing provider data (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Discovery/source review only; no new weather fix claimed. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

### 35. Authentication / MFA / project switching / role cache

| Field | Evidence / state |
|---|---|
| Feature | Authentication / MFA / project switching / role cache |
| Component/files | apps/web/app/codeco-supervision-app.tsx; apps/web/lib/permissions/project-permissions.tsx; apps/web/lib/supabase/access-token.ts |
| User entry point | Sign-in, management MFA, project selector |
| Primary interaction | Multi-step auth, refresh tokens, cached permissions, role-dependent controls |
| Browser APIs used | Supabase subscriptions, localStorage |
| Server/API dependency | Supabase auth and my_project_permissions RPC; RLS |
| Database dependency | See server/API dependency; exact RPC/RLS runtime verification pending |
| Offline behavior | Cached session/project rules; central auth authoritative online |
| Mobile behavior | 390px / 820px operation pending |
| Touch behavior | Tap/drag/pinch where applicable; operation pending |
| Persistence model | As described in primary interaction and offline behavior; refresh/restore check pending |
| Permission model | Project role/RLS or narrow external token; editor/read-only/cross-project runtime checks pending |
| Failure modes | Cross-window account switch, stale permissions, role revoke mid-operation |
| Automated coverage | role-views.spec.ts; 016/017 pgTAP; offline-account-isolation.spec.ts; execution evidence recorded below when run |
| Manual coverage | Entry point discovered where reachable; individual operation not yet verified |
| Issues found | Cross-window account switch, stale permissions, role revoke mid-operation (initial risk inventory; see fix status for the delivered scope) |
| Fix status | Account-cache ownership hardened; role and cross-account browser checks plus database policy regression suite executed. |
| Verification status | Partial: see exact executed coverage below; unlisted hardware and end-to-end flows remain pending. |

## Execution evidence

- Final production build and unit suite: `npm test`, 168 passed, zero failed/skipped. Final lint: `npm run lint`, passed.
- New deterministic coverage exercises actual drawing queue, storage gateway, service worker, GPS and clipboard implementations, plus calculator, Mercator, hierarchy, CSV, signature strokes, image types, tours, search and PDF cleanup.
- Database regression: 17 pgTAP files / 513 assertions passed in an isolated local audit database populated with schema and reference permissions/templates. Populated application fixtures conflicted with tests expecting empty data, so the suite was rerun in isolation. Schema-copy platform grants emitted restore diagnostics; the tested public schema and policies were present. No new migrations or production data changes were made.
- Browser checks against a production server connected to local Supabase fixtures: 28 passed, zero failed, two intentionally skipped account-isolation cases (that suite runs desktop only). Rapid Verify, speech lifecycle and independent agreement signatures cover phone, tablet and desktop; offline shell, cached records, role visibility and account isolation are also checked.
- Computer Use after automation verified Rapid Verify partial ingestion, visible corrupt-file failure, actual source citations and stale-evidence clearing; Workspace discovery was repeated.

### Remaining checks and known gaps

- This is a partial delivery at the user's request to push for later merge. The 35-feature inventory is a checklist, not certification of every entry. Mobile/touch/permission/persistence rows still marked pending require their specific operation to be tested; viewport emulation does not verify real devices.
- Private Blob storage was unavailable locally; media upload/hash/completion, panorama/DWG persistence, download browser behavior and live external-share evidence were not verified end to end.
- Real iOS installation, push delivery, microphone, GPS, gyroscope permissions and physical touch gestures remain device checks. Speech/GPS failure tests use mocks.
- Record and upload queues still need an account-change-during-sync audit, scoped temporary-ID maps and online-to-offline idempotency verification. Drawing queue and readable file ownership fixes do not certify those other queues.
- External response retry state is retained only for the current page; refresh recovery and upload-completion response loss need additional durable idempotency work.
- Backup status wording was corrected; a full production restore rehearsal, retention execution and scheduled archive validation remain pending. The local backup endpoint could not run without private storage.
- Modal/history, weather races, role revocation mid-operation, MFA and cross-window authentication remain broader audit items. Existing policy tests passing does not establish full UI coverage.
- Local Rapid Verify sources are intentionally tab memory only and the interface now says so; refresh clears them. Project-source extraction and encrypted/paged/scan-only PDF device checks remain pending.

The review branch includes the existing integration history (39 commits ahead of main before this hardening commit). Those prior changes are part of the PR diff but are not newly implemented by this audit.
