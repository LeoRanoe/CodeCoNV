# Offline security model — CODECO Supervisie

What a field device keeps, who can read it, and what that asks of the device.
The code is `apps/web/lib/offline/` (`idb.ts`, `account-isolation.ts`, `record-queue.ts`,
`upload-queue.ts`) and `apps/web/public/sw.js`.

## What is stored on a device

| Data | Where | Can it be downloaded again? | Lifetime |
| --- | --- | --- | --- |
| Readable project copy (project snapshot, cached files) | IndexedDB `codeco-field-v1`: `snapshots`, `files` | Yes | Removed on every sign-out and whenever a different account signs in |
| Unsent form drafts | `localStorage` keys `codeco:*-draft:*` | No, but they are drafts | Removed together with the readable copy |
| Unsent work: new registrations, photos, drawing pins | IndexedDB: `records`, `uploads`, `drawingPins` | **No — it exists nowhere else** | Kept until sent, or until its owner explicitly discards it |
| App shell (HTML, JS, CSS, icons) | Cache Storage `codeco-field-shell-*` | Yes | Replaced by the next deployment |
| Language choice, "guide seen" flag | `localStorage` | n/a | Kept |

Server responses with project data are **not** cached by the service worker. The service
worker caches the application shell only, and it is registered only in production builds.

## Account isolation on a shared device

1. Every item of unsent work is stamped with the account that wrote it (`ownerUserId`).
2. The storage layer only returns, counts and sends items of the active account. A second
   account on the same phone cannot see, open, send or delete the first account's work.
3. The readable copy is deleted — not hidden — on sign-out and when another account signs in,
   before the new session is shown.
4. Signing out with unsent work asks first: stay signed in, sign out and keep the work for
   the next sign-in of the same account, or discard it. Nothing is discarded silently.
5. Work that belongs to another account stays on the device untouched until that account
   signs in again on that device.

Covered by `tests/e2e/offline-account-isolation.spec.ts` (two accounts, one browser profile)
and `tests/e2e/offline-create-and-sync.spec.ts` (queue, owner stamp, send on reconnect).

## What is *not* promised

- **A full or blocked device store is not handled gracefully yet.** When the browser refuses
  to store a registration (storage quota, private browsing), the save fails with a general
  message. The input stays in the open form, but there is no dedicated explanation. Tracked
  as an open item in `production-readiness.md`.

- **The offline copy is not encrypted by the application.** IndexedDB and Cache Storage are
  protected by the operating system: the device lock screen and the device's own storage
  encryption. The app does not claim "encrypted at rest" anywhere; do not add that claim
  unless application-level encryption is actually built.
- Someone who can unlock the device and open the browser profile while a user is signed in
  can read what that user can read. That is the same boundary as the online app.
- Offline changes to records that already exist centrally (status transitions,
  verifications, signatures, review decisions) are not queued. Offline, the device cannot
  know the current state of that record; the form says so and keeps the input on screen.

## Device requirements (policy for CODECO)

- Screen lock (PIN/biometric) with automatic lock after at most 5 minutes.
- Storage encryption enabled (default on current iOS and Android; BitLocker/FileVault on laptops).
- Personal accounts only — no shared logins. Shared devices are supported, shared accounts are not.
- Sign out at the end of a shift on a shared device.
- A lost or stolen device: suspend the user under *Management → Team*, then reset the
  password. Suspension revokes server access immediately. The readable copy on the device
  is removed when the app next runs online and finds that the session has ended; until
  then it is protected only by the device lock.

## What happens when…

| Situation | Behaviour |
| --- | --- |
| No connection while creating a finding, HSE event, register entry or action | Saved on the device, shown in the list as waiting, header shows the number waiting |
| Connection returns | Registrations are sent first, then their photos; the queue empties itself |
| A queued item is rejected by the server | It stays on the device with the reason; it is never dropped |
| The user clears the offline copy in *Offline* settings | The readable copy is removed; unsent work is kept and the screen says so |
