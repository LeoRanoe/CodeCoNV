import type { NextConfig } from "next";

function allowedConnectSources() {
  const sources = [
    "'self'",
    "blob:",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://vercel.com",
    "https://blob.vercel-storage.com",
    "https://*.blob.vercel-storage.com",
  ];
  // The local test stack keeps its fake Blob store on a port of this machine (tests/e2e/fake-blob).
  // Nothing but a loopback address is ever added.
  const localBlob = process.env.VERCEL_BLOB_API_URL ?? "";
  if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(localBlob)) sources.push(localBlob);
  for (const candidate of [process.env.NEXT_PUBLIC_SUPABASE_URL]) {
    if (!candidate) continue;
    try {
      const origin = new URL(candidate);
      sources.push(origin.origin);
      // Realtime runs over a websocket on the same host; *.supabase.co is covered above, a
      // custom domain or a local stack is not.
      sources.push(`${origin.protocol === "http:" ? "ws:" : "wss:"}//${origin.host}`);
    } catch {
      // Invalid values fail the application configuration check; never add them to CSP.
    }
  }
  return [...new Set(sources)];
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // PDF.js uses WebAssembly for document/image decoding. This narrowly permits
  // WASM compilation without enabling general JavaScript eval().
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  `connect-src ${allowedConnectSources().join(" ")}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // These are the intentional quality values used by the public portfolio images.
    // Declaring them avoids Next.js falling back to an unconfigured quality warning.
    qualities: [75, 78, 82],
  },
  // Playwright and field devices may reach the local dev server through its numeric host.
  // Production CSP stays strict; this only lets Next's development HMR origin through.
  allowedDevOrigins: ["127.0.0.1"],
  // The previous WordPress site's pages, mapped to the section of the one-page site that
  // now carries the same content, so links and search results keep working after the
  // cutover. Theme demo pages (/icons, /pricing-and-plans, /landing-page, /faq) had no
  // CODECO content and are deliberately left to 404 instead of being sent to "/".
  async redirects() {
    const toSection = (paths: string[], section: string) => paths.map((path) => ({
      source: path,
      destination: `/#${section}`,
      permanent: true,
    }));
    return [
      ...toSection(["/about-us", "/our-history", "/team", "/company-career"], "about"),
      ...toSection(["/core-values"], "values"),
      ...toSection(["/our-clients"], "clients"),
      ...toSection(["/engineering", "/consulting", "/project-management", "/contracting", "/our-solutions-image-overlay"], "services"),
      ...toSection(["/projects", "/projects-2", "/portfolio/:slug*", "/category-portfolio/:slug*"], "work"),
      ...toSection(["/contact"], "contact"),
    ];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        // The record screens ask the phone where it is standing; without self the browser
        // refuses the request before the user is even asked.
        { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default nextConfig;
