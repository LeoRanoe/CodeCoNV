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
    icon: [{ url: "/codeco-logo.png", type: "image/png" }],
    shortcut: "/codeco-logo.png",
    apple: "/codeco-logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_SR",
    alternateLocale: ["nl_SR"],
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [{
      url: "/landing/hero-residence.jpg",
      width: 2560,
      height: 1440,
      alt: "Architectural design and engineering by CODECO N.V. in Suriname",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: ["/landing/hero-residence.jpg"],
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
