import type { Metadata } from "next";
import { Geist_Mono, Hind, Jost } from "next/font/google";
import { siteConfig } from "../lib/site-config";
import "./globals.css";
import "./landing.css";

const hind = Hind({
  variable: "--font-hind",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: {
    default: "CODECO N.V. | Engineering, Contracting & Consulting",
    template: "%s | CODECO N.V.",
  },
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/icon-192.png",
    // iOS uses this for the home-screen icon; the wide logo was rendered squashed there.
    apple: [{ url: "/icon-192.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_SR",
    alternateLocale: ["nl_SR"],
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [{
      url: "/og-supervision.png",
      width: 1536,
      height: 1024,
      alt: "CODECO N.V. Supervision field app for automatic weather, checklists and stacked photo evidence",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: ["/og-supervision.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${hind.variable} ${geistMono.variable} ${jost.variable}`}>
        {children}
      </body>
    </html>
  );
}
