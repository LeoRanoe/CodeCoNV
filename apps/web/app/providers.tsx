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
      },
      mutations: { retry: 0 },
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
