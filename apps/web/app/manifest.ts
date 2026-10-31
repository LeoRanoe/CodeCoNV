import type { MetadataRoute } from "next";
import { siteConfig } from "../lib/site-config";

/**
 * What the phone needs to treat the shortcut as an application of its own: a stable
 * identity, square icons in the sizes Android and iOS ask for, and a start screen that is
 * the workspace instead of the marketing page. The app is meant to be installed and used on
 * a site without coverage, so it has to open standalone and offline.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/supervisie",
    name: "CODECO Supervisie",
    short_name: "CODECO",
    description: `${siteConfig.description} Offline veldregistratie en pushmeldingen.`,
    start_url: "/supervisie",
    scope: "/",
    display: "standalone",
    // A browser that does not know "standalone" still gets something app-like.
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait-primary",
    lang: "nl",
    dir: "ltr",
    categories: ["business", "productivity", "utilities"],
    background_color: "#f4f1e9",
    theme_color: "#11120f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops an icon to its own shape; the maskable one keeps the logo inside it.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Open supervisie", short_name: "Supervisie", url: "/supervisie" },
    ],
  };
}
