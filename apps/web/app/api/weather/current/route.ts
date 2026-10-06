import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  weatherConditionFromWmoCode,
  windConditionFromSpeed,
  type CurrentProjectWeather,
} from "@/lib/weather";

const querySchema = z.object({
  location: z.string().trim().min(2).max(180),
});

type GeocodingResult = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
};

type ForecastResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
  };
};

const requestTimeoutMs = 8_000;

async function signedInUser(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!supabaseUrl || !publishableKey || !accessToken) return null;
  const validationClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const userResult = await validationClient.auth.getUser(accessToken);
  if (userResult.error || !userResult.data.user) return null;
  const userClient = createClient(supabaseUrl, publishableKey, {
    accessToken: async () => accessToken,
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return { userClient };
}

async function fetchJson<T>(url: URL) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (!response.ok) throw new Error(`Weather source returned ${response.status}.`);
  return response.json() as Promise<T>;
}

function locationQueries(location: string) {
  const cleaned = location.replace(/\s+/g, " ").trim();
  const lastSegment = cleaned.split(",").map((part) => part.trim()).filter(Boolean).at(-1);
  return [...new Set([
    cleaned,
    `${cleaned}, Suriname`,
    lastSegment && lastSegment !== cleaned ? lastSegment : "",
  ].filter((value): value is string => Boolean(value)))];
}

async function resolveLocation(location: string) {
  for (const query of locationQueries(location)) {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", query);
    url.searchParams.set("count", "8");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");
    const payload = await fetchJson<{ results?: GeocodingResult[] }>(url);
    const results = payload.results ?? [];
    const match = results.find((item) => item.country_code === "SR") ?? results[0];
    if (match) return match;
  }
  throw new Error("Project location could not be resolved.");
}

export async function GET(request: NextRequest) {
  const auth = await signedInUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Aanmelden is vereist." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const input = querySchema.safeParse({ location: request.nextUrl.searchParams.get("location") ?? "" });
  if (!input.success) {
    return NextResponse.json({ error: "Kies een geldige projectlocatie." }, { status: 400 });
  }

  const rateLimit = await auth.userClient.rpc("consume_security_rate_limit", {
    p_action_code: "weather_lookup",
    p_max_requests: 30,
    p_window_minutes: 10,
  });
  if (rateLimit.error) {
    return NextResponse.json({ error: "De weerbeveiligingslimiet kon niet worden gecontroleerd." }, { status: 503 });
  }
  if (rateLimit.data !== true) {
    return NextResponse.json(
      { error: "Te veel weerverzoeken. Probeer het later opnieuw." },
      { status: 429, headers: { "Retry-After": "600", "Cache-Control": "no-store" } },
    );
  }

  try {
    const location = await resolveLocation(input.data.location);
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set("timezone", "America/Paramaribo");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set(
      "current",
      "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m",
    );
    const forecast = await fetchJson<ForecastResponse>(url);
    const current = forecast.current;
    if (
      !current
      || typeof current.temperature_2m !== "number"
      || typeof current.weather_code !== "number"
      || typeof current.wind_speed_10m !== "number"
    ) {
      throw new Error("Current weather is incomplete.");
    }

    const precipitationMm = current.precipitation ?? 0;
    const windGustKph = current.wind_gusts_10m ?? current.wind_speed_10m;
    const result: CurrentProjectWeather = {
      condition: weatherConditionFromWmoCode(current.weather_code, precipitationMm),
      temperatureC: Math.round(current.temperature_2m),
      apparentTemperatureC: Math.round(current.apparent_temperature ?? current.temperature_2m),
      windCondition: windConditionFromSpeed(current.wind_speed_10m, windGustKph),
      windSpeedKph: Math.round(current.wind_speed_10m),
      windGustKph: Math.round(windGustKph),
      precipitationMm,
      relativeHumidityPercent: Math.round(current.relative_humidity_2m ?? 0),
      weatherCode: current.weather_code,
      observedAt: current.time ?? new Date().toISOString(),
      resolvedLocation: [location.name, location.admin1, location.country].filter(Boolean).join(", "),
      latitude: location.latitude,
      longitude: location.longitude,
      source: "Open-Meteo",
    };

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=600, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json(
      { error: "Het actuele weer kon niet automatisch worden geladen. Controleer het handmatig." },
      { status: 503 },
    );
  }
}
