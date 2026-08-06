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
  for (const candidate of [process.env.NEXT_PUBLIC_SUPABASE_URL]) {
    if (!candidate) continue;
    try {
      sources.push(new URL(candidate).origin);
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
  // Playwright and field devices may reach the local dev server through its numeric host.
  // Production CSP stays strict; this only lets Next's development HMR origin through.
  allowedDevOrigins: ["127.0.0.1"],
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
