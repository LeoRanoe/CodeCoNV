import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Eén centrale werkplek voor dagelijkse constructiesupervisie, inspecties, acties en rapportage.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);
  const imageUrl = new URL("/og.png", baseUrl).toString();

  return {
    metadataBase: baseUrl,
    title: {
      default: "Sitezicht | Constructiesupervisie",
      template: "%s | Sitezicht",
    },
    description,
    openGraph: {
      type: "website",
      locale: "nl_SR",
      title: "Sitezicht | Van waarneming naar dagrapport",
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "Sitezicht constructiesupervisie" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Sitezicht | Van waarneming naar dagrapport",
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
