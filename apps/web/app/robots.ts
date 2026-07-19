import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/supervisie", "/api/"],
    },
    sitemap: "https://www.codeconv.com/sitemap.xml",
  };
}
