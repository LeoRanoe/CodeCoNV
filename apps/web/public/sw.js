// Field shell cache. Bump the version on every change to this file: the activate
// handler deletes every other cache, so a new version wipes what the old one stored.
const CACHE = "codeco-field-shell-v4";

// Only content-addressed or stable assets may be served from the cache. Documents are
// never cache-first: doing that kept a deployed change invisible until the browser
// storage was cleared by hand.
const STATIC_SHELL = [
  "/manifest.webmanifest",
  "/codeco-logo.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/favicon.svg",
];
const OFFLINE_DOCUMENT = "/supervisie";
// The landing page is precached too, so opening the app from a bookmark on "/" offline
// still lands on a real page instead of a browser error.
const SHELL_DOCUMENTS = ["/supervisie", "/"];

// On a site the connection is often not absent but unusable: the request neither answers
// nor fails. Waiting for that is indistinguishable from an app that will not open, so a
// document falls back to the stored copy once this has passed.
const DOCUMENT_NETWORK_TIMEOUT = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // A failing single asset must not block activation of a new version.
    await Promise.allSettled([...STATIC_SHELL, ...SHELL_DOCUMENTS].map((path) => cache.add(new Request(path, { cache: "reload" }))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    // Navigation preload would race the timeout below and answer with a hanging network
    // response; the stored document has to win in that case.
    if (self.registration.navigationPreload) await self.registration.navigationPreload.disable().catch(() => undefined);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  // The page asks the waiting worker to take over instead of waiting for every tab
  // to close, so a supervisor sees the new version on the next reload.
  if (event.data === "codeco-activate-update") void self.skipWaiting();
  // After a deployment the shell is fetched again while there still is a connection, so
  // the installed app keeps opening offline on the new version too.
  if (event.data === "codeco-refresh-shell") {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled([...STATIC_SHELL, ...SHELL_DOCUMENTS].map((path) => cache.add(new Request(path, { cache: "reload" }))));
    })());
  }
  // The very first visit is not yet controlled by a worker, so the code the page is
  // running was never seen here. The page hands over the list, otherwise an app that was
  // opened exactly once would have its documents stored and none of its JavaScript.
  if (event.data?.type === "codeco-precache" && Array.isArray(event.data.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const missing = [];
      for (const url of event.data.urls.slice(0, 400)) {
        if (!(await cache.match(url))) missing.push(url);
      }
      await Promise.allSettled(missing.map((url) => cache.add(new Request(url, { credentials: "same-origin" }))));
      event.ports[0]?.postMessage({ type: "codeco-precache-complete", stored: event.data.urls.length });
    })());
  }
});

/** The stored document for this navigation, or the workspace as the general fallback. */
async function storedDocument(request, url) {
  const cache = await caches.open(CACHE);
  return (await cache.match(request, { ignoreSearch: true }))
    ?? (await cache.match(url.pathname))
    ?? (await cache.match(OFFLINE_DOCUMENT));
}

function networkWithTimeout(request, milliseconds) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("network-timeout")), milliseconds);
    fetch(request).then((response) => {
      clearTimeout(timer);
      resolve(response);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Project data and files travel with a bearer token to /api/; they are private and are
  // kept in the app's private origin-scoped device storage instead of in a shared cache.
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Documents and the data Next.js fetches for them always come from the network. The
  // cached copy is the offline fallback only.
  const isDocument = request.mode === "navigate"
    || request.destination === "document"
    || url.searchParams.has("_rsc")
    || SHELL_DOCUMENTS.includes(url.pathname);
  if (isDocument) {
    event.respondWith((async () => {
      try {
        const response = await networkWithTimeout(request, DOCUMENT_NETWORK_TIMEOUT);
        if (request.mode === "navigate" && SHELL_DOCUMENTS.includes(url.pathname) && response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(url.pathname, copy));
        }
        return response;
      } catch {
        const cached = await storedDocument(request, url);
        return cached ?? Response.error();
      }
    })());
    return;
  }

  // Build assets carry a content hash in their URL, so serving them from the cache can
  // never show yesterday's code: a new build asks for new URLs. Everything the installed
  // app needs to render itself is here — the code, the styles, the fonts and the icons.
  const cacheable = url.pathname.startsWith("/_next/static/")
    || url.pathname.startsWith("/_next/image")
    || STATIC_SHELL.includes(url.pathname)
    || /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname);
  if (!cacheable) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) void caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
    return response;
  }).catch((error) => {
    // An asset that was never fetched cannot be invented; failing loudly is better than
    // an empty response the page would try to parse.
    throw error;
  })));
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() ?? {};
  event.waitUntil(self.registration.showNotification(payload.title || "CODECO Supervisie", {
    body: payload.body || "Er is een nieuwe projectmelding.",
    icon: "/icon-192.png",
    badge: "/favicon.svg",
    tag: payload.tag || "codeco-notification",
    renotify: true,
    data: { url: payload.url || "/supervisie" },
  }));
});

function safeNotificationDestination(value) {
  const fallback = new URL("/supervisie", self.location.origin).href;
  try {
    const destination = new URL(typeof value === "string" ? value : fallback, self.location.origin);
    return destination.origin === self.location.origin ? destination.href : fallback;
  } catch {
    return fallback;
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = safeNotificationDestination(event.notification.data?.url);
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
