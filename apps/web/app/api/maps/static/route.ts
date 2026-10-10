import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The satellite view on the client's record screens.
 *
 * The picture is fetched here and not in the browser, for two reasons. The application's
 * content security policy allows images from this origin only — no external host, no
 * external script, no iframe — and the map key is a secret that must not travel to a
 * phone. So the server holds the key, asks the provider, and hands the bytes back as an
 * image of this application.
 *
 * Without a configured key the endpoint says so plainly; the screens then keep showing
 * the coordinates themselves, which is what they did before there was a map at all.
 *
 * Every picture costs the project money at the provider, so the caller has to be signed
 * in. The screens fetch it with the same bearer token they use for stored files, and show
 * the result from the device's own memory.
 */
const querySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  zoom: z.coerce.number().int().min(3).max(20).default(17),
  width: z.coerce.number().int().min(120).max(640).default(560),
  height: z.coerce.number().int().min(90).max(640).default(240),
});

const requestTimeoutMs = 8_000;

async function signedInUser(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !publishableKey) return null;
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!accessToken) return null;
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const result = await client.auth.getUser(accessToken);
  if (result.error || !result.data.user) return null;
  const userClient = createClient(supabaseUrl, publishableKey, {
    accessToken: async () => accessToken,
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return { user: result.data.user, userClient };
}

export async function GET(request: NextRequest) {
  const auth = await signedInUser(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Signing in is required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "No map provider is configured for this environment." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const input = querySchema.safeParse({
    latitude: request.nextUrl.searchParams.get("latitude"),
    longitude: request.nextUrl.searchParams.get("longitude"),
    zoom: request.nextUrl.searchParams.get("zoom") ?? undefined,
    width: request.nextUrl.searchParams.get("width") ?? undefined,
    height: request.nextUrl.searchParams.get("height") ?? undefined,
  });
  if (!input.success) {
    return NextResponse.json({ error: "Invalid map coordinates." }, { status: 400 });
  }

  const rateLimit = await auth.userClient.rpc("consume_security_rate_limit", {
    p_action_code: "map_lookup",
    p_max_requests: 30,
    p_window_minutes: 10,
  });
  if (rateLimit.error) {
    return NextResponse.json({ error: "The map security limit could not be checked." }, { status: 503 });
  }
  if (rateLimit.data !== true) {
    return NextResponse.json(
      { error: "Too many map requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "600", "Cache-Control": "no-store" } },
    );
  }

  const { latitude, longitude, zoom, width, height } = input.data;
  const center = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", center);
  url.searchParams.set("zoom", String(zoom));
  url.searchParams.set("size", `${width}x${height}`);
  // Two device pixels per map pixel: the same picture on a phone screen, still sharp.
  url.searchParams.set("scale", "2");
  // Hybrid is satellite with the street names on it, which is how a site is described.
  url.searchParams.set("maptype", "hybrid");
  url.searchParams.set("markers", `color:red|${center}`);
  url.searchParams.set("key", key);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(requestTimeoutMs) });
    if (!response.ok) throw new Error(`Map provider returned ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) throw new Error("Map provider did not return an image.");
    const bytes = await response.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        // The same spot at the same zoom is the same picture; a phone on site should not
        // fetch it twice.
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "The map could not be loaded. The coordinates themselves are recorded." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
