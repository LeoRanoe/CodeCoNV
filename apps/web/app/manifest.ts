import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CODECO N.V.",
    short_name: "CODECO",
    description: "Engineering, contracting, project management and consulting in Paramaribo, Suriname.",
    start_url: "/",
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
  };
}
