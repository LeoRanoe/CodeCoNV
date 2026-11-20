import { validAccessToken } from "@/lib/supabase/access-token";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * One dictation engine for every free-text field. Two ways to listen:
 * - "bilingual": the recording is transcribed by the server (app/api/speech/transcribe), which
 *   detects Dutch and English by itself, also mixed in one sentence. Used when the server has a
 *   transcription key and the browser can record audio.
 * - "browser": the browser's own speech recognition, in the app language. The fallback.
 */
type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type DictationError = "blocked" | "failed";
export type DictationSession = { stop: () => void; abort: () => void; mode: "bilingual" | "browser" };

function speechConstructor() {
  if (typeof window === "undefined") return null;
  const browser = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}

const canRecord = () => typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

let serverStatus: Promise<boolean> | null = null;
/** Whether the server transcribes (asked once per page load). */
export function bilingualDictationAvailable() {
  if (typeof window === "undefined" || !canRecord()) return Promise.resolve(false);
  serverStatus ??= fetch("/api/speech/transcribe", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : { configured: false }))
    .then((payload: { configured?: boolean }) => Boolean(payload.configured))
    .catch(() => false);
  return serverStatus;
}

/** Whether this device can dictate at all (either way). */
export function dictationSupported() {
  return Boolean(speechConstructor()) || canRecord();
}

function recorderType() {
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
}

async function transcribe(blob: Blob) {
  const client = getSupabaseBrowserClient();
  const token = client ? await validAccessToken(client) : "";
  const body = new FormData();
  body.append("audio", blob, "dictation");
  const response = await fetch("/api/speech/transcribe", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body });
  if (!response.ok) throw new Error(`transcription ${response.status}`);
  const payload = await response.json() as { text?: string };
  return String(payload.text ?? "").trim();
}

export async function startDictation(options: {
  language: "en" | "nl";
  onText: (transcript: string) => void;
  onError: (error: DictationError) => void;
  /** Recording stopped and (for bilingual) the text is being written out. */
  onBusy?: (busy: boolean) => void;
  onEnd: () => void;
}): Promise<DictationSession | null> {
  if (canRecord() && (await bilingualDictationAvailable())) {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      options.onError(error instanceof DOMException && error.name === "NotAllowedError" ? "blocked" : "failed");
      options.onEnd();
      return null;
    }
    const type = recorderType();
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    let aborted = false;
    // A dictated note is short; a forgotten microphone does not record for ever.
    const limit = window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 120_000);
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      window.clearTimeout(limit);
      stream.getTracks().forEach((track) => track.stop());
      if (aborted || !chunks.length) { options.onEnd(); return; }
      options.onBusy?.(true);
      try {
        const text = await transcribe(new Blob(chunks, { type: recorder.mimeType || type || "audio/webm" }));
        if (text) options.onText(text);
      } catch {
        options.onError("failed");
      } finally {
        options.onBusy?.(false);
        options.onEnd();
      }
    };
    recorder.start();
    return {
      mode: "bilingual",
      stop: () => { if (recorder.state === "recording") recorder.stop(); },
      abort: () => { aborted = true; if (recorder.state === "recording") recorder.stop(); else stream.getTracks().forEach((track) => track.stop()); },
    };
  }

  const Constructor = speechConstructor();
  if (!Constructor) { options.onError("failed"); options.onEnd(); return null; }
  const recognition = new Constructor();
  let live = true;
  // Android Chrome repeats earlier words in continuous mode; one phrase per tap there.
  recognition.continuous = !/Android/i.test(navigator.userAgent);
  recognition.interimResults = false;
  recognition.lang = options.language === "nl" ? "nl-NL" : "en-US";
  recognition.onresult = (event) => {
    let transcript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      if (event.results[index].isFinal) transcript += `${event.results[index][0].transcript} `;
    }
    if (live && transcript.trim()) options.onText(transcript.trim());
  };
  recognition.onerror = (event) => {
    if (!live) return;
    if (event?.error === "no-speech" || event?.error === "aborted") return;
    live = false;
    options.onError(event?.error === "not-allowed" || event?.error === "service-not-allowed" ? "blocked" : "failed");
  };
  recognition.onend = () => { live = false; options.onEnd(); };
  try {
    recognition.start();
  } catch {
    options.onError("failed");
    options.onEnd();
    return null;
  }
  return {
    mode: "browser",
    stop: () => { try { recognition.stop(); } catch { /* Already ended. */ } },
    abort: () => { live = false; recognition.onresult = null; try { if (recognition.abort) recognition.abort(); else recognition.stop(); } catch { /* Already ended. */ } },
  };
}

/** Writes dictated words into any text field, so React and the field's own handlers see them. */
export function insertIntoField(field: HTMLInputElement | HTMLTextAreaElement, transcript: string) {
  const words = transcript.trim();
  if (!words) return;
  const current = field.value;
  const next = `${current}${current && !/\s$/.test(current) ? " " : ""}${words}`.slice(0, field.maxLength > 0 ? field.maxLength : undefined);
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, next);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}
