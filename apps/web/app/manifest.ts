import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CODECO Supervisie",
    short_name: "CODECO",
    description: "Secure CODECO workspace for construction supervision, evidence and reporting.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f4f3",
    theme_color: "#14151a",
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
