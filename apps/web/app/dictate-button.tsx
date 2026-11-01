"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

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

function speechConstructor() {
  if (typeof window === "undefined") return null;
  const browser = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}

export function speechToTextAvailable() {
  return Boolean(speechConstructor());
}

// Appends the dictated transcript to whatever the field already holds.
export function appendDictation(current: string, transcript: string) {
  const words = transcript.trim();
  return words ? `${current}${current && !/\s$/.test(current) ? " " : ""}${words}` : current;
}

/** Where the microphone sits on a one-line field, and the room the field leaves for it. */
export const micInputStyle = { bottom: 3 } as const;
export const inputWithMicStyle = { paddingRight: 52 } as const;

export function DictateButton({
  onText,
  className = "dictate-button",
  label,
  style,
}: {
  onText: (transcript: string) => void;
  className?: string;
  label?: string;
  /** A single-line field is shorter than the writing area the button is sized for. */
  style?: React.CSSProperties;
}) {
  const { language, text } = useLanguage();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  // Why dictation stopped, shown beside the button: a tooltip never appears on a tablet.
  const [error, setError] = useState<"" | "blocked" | "failed">("");
  useEffect(() => { onTextRef.current = onText; }, [onText]);
  useEffect(() => {
    const stop = () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (!recognition) return;
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try { if (recognition.abort) recognition.abort(); else recognition.stop(); } catch { /* Already ended. */ }
      setListening(false);
    };
    const onVisibility = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { document.removeEventListener("visibilitychange", onVisibility); stop(); };
  }, [language]);

  if (!speechToTextAvailable()) return null;

  const toggle = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { recognitionRef.current = null; }
      setListening(false);
      return;
    }
    const Constructor = speechConstructor();
    if (!Constructor) return;
    const recognition = new Constructor();
    setError("");
    // Android Chrome repeats earlier words in continuous mode; one phrase per tap there.
    recognition.continuous = !/Android/i.test(navigator.userAgent);
    recognition.interimResults = false;
    recognition.lang = language === "nl" ? "nl-NL" : "en-US";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) transcript += `${event.results[index][0].transcript} `;
      }
      if (recognitionRef.current === recognition && transcript.trim()) onTextRef.current(transcript.trim());
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      if (event?.error === "no-speech" || event?.error === "aborted") { recognitionRef.current = null; setListening(false); return; }
      recognitionRef.current = null;
      recognition.onresult = null; recognition.onend = null; recognition.onerror = null;
      try { recognition.abort?.(); } catch { /* Already stopped. */ }
      setError(event?.error === "not-allowed" || event?.error === "service-not-allowed" ? "blocked" : "failed");
      setListening(false);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        setListening(false);
        recognitionRef.current = null;
      }
    };
    recognitionRef.current = recognition;
    setListening(true);
    try { recognition.start(); }
    catch {
      recognitionRef.current = null;
      setListening(false);
      setError("failed");
    }
  };

  const stopLabel = text("Stop dictation", "Stop dicteren");
  const startLabel = label ?? text("Dictate", "Dicteren");

  const errorText = error === "blocked"
    ? text("Microphone blocked. Allow it for this site in the browser settings.", "Microfoon geblokkeerd. Sta hem toe voor deze site in de browserinstellingen.")
    : text("Dictation unavailable. Your typed text is kept; try again.", "Dicteren niet beschikbaar. Je tekst blijft bewaard; probeer opnieuw.");

  return (
    <>
      <button
        className={`${className} ${listening ? "recording" : ""}`}
        style={style}
        type="button"
        onClick={toggle}
        aria-label={listening ? stopLabel : startLabel}
        title={error ? errorText : listening ? stopLabel : startLabel}
        aria-pressed={listening}
      >
        {listening ? <MicOff size={18} /> : <Mic size={18} />}
      </button>
      {error ? <span className="dictate-error" role="status" style={style?.bottom !== undefined ? { bottom: Number(style.bottom) + 44 } : undefined}>{errorText}</span> : null}
    </>
  );
}
