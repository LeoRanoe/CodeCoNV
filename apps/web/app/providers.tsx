"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LanguageProvider } from "@/lib/i18n";

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
    if (!("serviceWorker" in navigator)) return;
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
          if (assets.length) ready.active?.postMessage({ type: "codeco-precache", urls: Array.from(new Set(assets)) });
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
