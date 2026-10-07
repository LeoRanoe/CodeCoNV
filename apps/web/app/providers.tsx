"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LanguageProvider } from "@/lib/i18n";
import { ensureOfflineDatabase } from "@/lib/offline/idb";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: true,
        // Without this a query is *paused* while the device reports no connection: the
        // loader never runs, so the offline copy on the device is never read and the
        // installed app opens on an empty screen in the field. Every loader tries the
        // network first and falls back to what is stored, which is what "offline first"
        // means here.
        networkMode: "offlineFirst",
      },
      mutations: { retry: 0, networkMode: "offlineFirst" },
    },
  }));

  useEffect(() => {
    // The device storage is opened at start-up, so the version upgrade never lands in the
    // middle of saving a field record.
    void ensureOfflineDatabase().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // The worker serves /_next/static/ from its cache because production chunk names carry a
    // content hash. Development chunk names do not, so a worker would keep serving the code
    // from before the last edit. Development runs without it and removes a leftover one.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .then(() => (typeof caches === "undefined" ? undefined : caches.keys()))
        .then((names) => Promise.all((names ?? []).filter((name) => name.startsWith("codeco-")).map((name) => caches.delete(name))))
        .catch(() => undefined);
      return;
    }
    let reloading = false;
    // Only a client that was already controlled by an older worker needs the reload; a
    // first visit is served by the network anyway and must never reload itself.
    const hadController = Boolean(navigator.serviceWorker.controller);
    // A new deployment has to reach the phone on the next reload, not whenever the
    // browser happens to notice. updateViaCache: "none" keeps sw.js out of the HTTP
    // cache, and a waiting worker is asked to take over immediately.
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => {
      const activateWaiting = () => registration.waiting?.postMessage("codeco-activate-update");
      activateWaiting();
      registration.addEventListener("updatefound", () => {
        registration.installing?.addEventListener("statechange", (event) => {
          if ((event.target as ServiceWorker).state === "installed") activateWaiting();
        });
      });
      void registration.update().catch(() => undefined);
      // Refresh the offline shell while there still is a connection, so the installed app
      // opens without internet on the version that is deployed now, and hand over the code
      // this page is running: on a first visit the worker did not see it being loaded.
      if (navigator.onLine) {
        void navigator.serviceWorker.ready.then((ready) => {
          ready.active?.postMessage("codeco-refresh-shell");
          const assets = performance.getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((name) => name.startsWith(window.location.origin) && (name.includes("/_next/static/") || /\.(?:woff2?|css)$/.test(name)));
          if (assets.length && ready.active) {
            // A first visit is not controlled yet, so its build chunks have to be handed
            // to the newly activated worker. Wait for an acknowledgement: without it a
            // phone that loses coverage immediately after opening can retain only the
            // first few chunks and paint an unhydrated shell on its next cold start.
            const channel = new MessageChannel();
            channel.port1.addEventListener("message", () => {
              document.documentElement.dataset.offlineShellReady = "true";
              channel.port1.close();
            }, { once: true });
            channel.port1.start();
            ready.active.postMessage(
              { type: "codeco-precache", urls: Array.from(new Set(assets)) },
              [channel.port2],
            );
          }
        }).catch(() => undefined);
      }
    }).catch(() => undefined);

    // When the new worker takes control, load the page it serves once.
    const takeOver = () => {
      if (reloading || !hadController) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", takeOver);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", takeOver);
  }, []);

  return <LanguageProvider><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></LanguageProvider>;
}
