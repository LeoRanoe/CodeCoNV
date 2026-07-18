import type { Metadata } from "next";
import { Geist_Mono, Hind } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

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
  "De centrale CODECO-werkplek voor dagelijkse constructiesupervisie, inspecties, acties en rapportage.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);
  const imageUrl = new URL("/og.png", baseUrl).toString();

  return {
    metadataBase: baseUrl,
    title: {
      default: "CODECO Supervisie",
      template: "%s | CODECO Supervisie",
    },
    description,
    openGraph: {
      type: "website",
      locale: "nl_SR",
      title: "CODECO Supervisie | Van waarneming naar dagrapport",
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "CODECO constructiesupervisie" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "CODECO Supervisie | Van waarneming naar dagrapport",
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
      <body className={`${hind.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
