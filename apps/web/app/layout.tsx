import type { Metadata } from "next";
import { Geist_Mono, Hind } from "next/font/google";
import { headers } from "next/headers";
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

const description =
  "CODECO N.V. is a multidisciplinary engineering firm in Paramaribo for civil, structural and construction projects.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);
  return {
    metadataBase: baseUrl,
    title: {
      default: "CODECO N.V. | Engineering, Contracting & Consulting",
      template: "%s | CODECO N.V.",
    },
    description,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/codeco-logo.png", type: "image/png" }],
      shortcut: "/codeco-logo.png",
      apple: "/codeco-logo.png",
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      alternateLocale: ["nl_SR"],
      title: "CODECO N.V. | Sound thinking. Solid structures.",
      description,
      images: [{ url: new URL("/landing/hero-residence.jpg", baseUrl).toString(), width: 2560, height: 1440, alt: "Architectural design by CODECO N.V." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "CODECO N.V. | Sound thinking. Solid structures.",
      description,
      images: [new URL("/landing/hero-residence.jpg", baseUrl).toString()],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${hind.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
