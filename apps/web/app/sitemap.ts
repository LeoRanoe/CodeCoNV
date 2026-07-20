import type { MetadataRoute } from "next";
import { siteConfig } from "../lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: `${siteConfig.url}/`,
    lastModified: new Date("2026-07-20"),
    changeFrequency: "monthly",
    priority: 1,
    images: [
      `${siteConfig.url}/landing/hero-residence.jpg`,
      `${siteConfig.url}/landing/newmont-recreation-centre.jpg`,
      `${siteConfig.url}/landing/commewijne-port-facility.png`,
    ],
  }];
}
