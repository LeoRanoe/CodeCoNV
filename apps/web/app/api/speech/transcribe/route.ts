import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Dictation that understands Dutch and English in the same sentence (client, 20-11-2026). The
 * browser's own speech recognition listens in one language at a time, so the recording is sent
 * here and transcribed by a service that detects the language itself. Configure it with
 * TRANSCRIPTION_API_KEY (an OpenAI-compatible /audio/transcriptions endpoint); without it the
 * app keeps using the browser's recognition in the app language.
 */
const endpoint = () => (process.env.TRANSCRIPTION_API_URL?.trim() || "https://api.openai.com/v1/audio/transcriptions");
const apiKey = () => process.env.TRANSCRIPTION_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
const model = () => process.env.TRANSCRIPTION_MODEL?.trim() || "whisper-1";
const maxBytes = 12 * 1024 * 1024;
const audioTypes = /^audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|aac|m4a|x-m4a)(;.*)?$/;

/** Per user, per server instance: 60 recordings in 10 minutes. */
const recent = new Map<string, number[]>();
function allowed(userId: string) {
  const now = Date.now();
  const window = (recent.get(userId) ?? []).filter((time) => now - time < 10 * 60_000);
  if (window.length >= 60) return false;
  window.push(now);
  recent.set(userId, window);
  return true;
}

async function signedInUserId(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!supabaseUrl || !publishableKey || !accessToken) return null;
  const client = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  const result = await client.auth.getUser(accessToken);
  return result.error || !result.data.user ? null : result.data.user.id;
}

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  return NextResponse.json({ configured: Boolean(apiKey()) }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!apiKey()) return NextResponse.json({ error: "Transcription is not configured." }, { status: 503, headers: noStore });
  const userId = await signedInUserId(request);
  if (!userId) return NextResponse.json({ error: "Aanmelden is vereist." }, { status: 401, headers: noStore });
  if (!allowed(userId)) return NextResponse.json({ error: "Te veel dicteerverzoeken. Probeer het over een paar minuten opnieuw." }, { status: 429, headers: { ...noStore, "Retry-After": "300" } });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || !audio.size || audio.size > maxBytes || !audioTypes.test(audio.type)) {
    return NextResponse.json({ error: "Geen bruikbare opname ontvangen." }, { status: 400, headers: noStore });
  }
  const extension = audio.type.includes("mp4") || audio.type.includes("m4a") || audio.type.includes("aac") ? "m4a" : audio.type.includes("ogg") ? "ogg" : audio.type.includes("wav") ? "wav" : audio.type.includes("mp") ? "mp3" : "webm";
  const upstream = new FormData();
  upstream.append("file", audio, `dictation.${extension}`);
  upstream.append("model", model());
  // No language is set on purpose: the service detects Dutch, English or both in one recording.
  upstream.append("prompt", "Bouwplaats supervisie in Suriname. Site supervision notes, mixed Dutch and English: bekisting, wapening, formwork, rebar, NCR, HSE, aannemer, contractor.");
  upstream.append("response_format", "json");

  try {
    const response = await fetch(endpoint(), { method: "POST", headers: { Authorization: `Bearer ${apiKey()}` }, body: upstream, signal: AbortSignal.timeout(45_000) });
    if (!response.ok) {
      console.warn("[speech] transcription failed", response.status);
      return NextResponse.json({ error: "Dicteren is even niet beschikbaar." }, { status: 502, headers: noStore });
    }
    const payload = await response.json() as { text?: string };
    return NextResponse.json({ text: String(payload.text ?? "").trim() }, { headers: noStore });
  } catch (error) {
    console.warn("[speech] transcription unreachable", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Dicteren is even niet beschikbaar." }, { status: 504, headers: noStore });
  }
}
