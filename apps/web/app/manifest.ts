import type { MetadataRoute } from "next";
import { siteConfig } from "../lib/site-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CODECO Supervisie",
    short_name: "CODECO",
    description: `${siteConfig.description} Offline veldregistratie en pushmeldingen.`,
    start_url: "/supervisie",
    scope: "/",
    display: "standalone",
    background_color: "#f4f1e9",
    theme_color: "#11120f",
    icons: [
      {
        src: "/codeco-logo.png",
        sizes: "738x291",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      { name: "Open supervisie", short_name: "Supervisie", url: "/supervisie" },
    ],
  };
}
