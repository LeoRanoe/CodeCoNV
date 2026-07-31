// Field shell cache. Bump the version on every change to this file: the activate
// handler deletes every other cache, so a new version wipes what the old one stored.
const CACHE = "codeco-field-shell-v2";

// Only content-addressed or stable assets may be served from the cache. Documents are
// never cache-first: doing that kept a deployed change invisible until the browser
// storage was cleared by hand.
const STATIC_SHELL = ["/manifest.webmanifest", "/codeco-logo.png"];
const OFFLINE_DOCUMENT = "/supervisie";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // A failing single asset must not block activation of a new version.
    await Promise.allSettled([...STATIC_SHELL, OFFLINE_DOCUMENT].map((path) => cache.add(new Request(path, { cache: "reload" }))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  // The page asks the waiting worker to take over instead of waiting for every tab
  // to close, so a supervisor sees the new version on the next reload.
  if (event.data === "codeco-activate-update") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Documents and the data Next.js fetches for them always come from the network. The
  // cached copy is the offline fallback only.
  const isDocument = request.mode === "navigate"
    || request.destination === "document"
    || url.searchParams.has("_rsc")
    || url.pathname === OFFLINE_DOCUMENT;
  if (isDocument) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (request.mode === "navigate" && url.pathname === OFFLINE_DOCUMENT && response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(OFFLINE_DOCUMENT, copy));
        }
        return response;
      } catch {
        const cached = await caches.match(request) ?? await caches.match(OFFLINE_DOCUMENT);
        return cached ?? Response.error();
      }
    })());
    return;
  }

  // Build assets carry a content hash in their URL, so serving them from the cache can
  // never show yesterday's code: a new build asks for new URLs.
  const cacheable = url.pathname.startsWith("/_next/static/") || STATIC_SHELL.includes(url.pathname);
  if (!cacheable) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) void caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() ?? {};
  event.waitUntil(self.registration.showNotification(payload.title || "CODECO Supervisie", {
    body: payload.body || "Er is een nieuwe projectmelding.",
    icon: "/codeco-logo.png",
    badge: "/favicon.svg",
    tag: payload.tag || "codeco-notification",
    renotify: true,
    data: { url: payload.url || "/supervisie" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/supervisie", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    for (const client of clients) {
      if ("focus" in client) {
        await client.navigate(destination);
        return client.focus();
      }
    }
    return self.clients.openWindow(destination);
  }));
});
