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
  onerror: (() => void) | null;
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

export function DictateButton({
  onText,
  className = "dictate-button",
  label,
}: {
  onText: (transcript: string) => void;
  className?: string;
  label?: string;
}) {
  const { language, text } = useLanguage();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  const [error, setError] = useState(false);
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
    setError(false);
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = language === "nl" ? "nl-NL" : "en-US";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) transcript += `${event.results[index][0].transcript} `;
      }
      if (recognitionRef.current === recognition && transcript.trim()) onTextRef.current(transcript.trim());
    };
    recognition.onerror = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      recognition.onresult = null; recognition.onend = null; recognition.onerror = null;
      try { recognition.abort?.(); } catch { /* Already stopped. */ }
      setError(true);
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
      setError(true);
    }
  };

  const stopLabel = text("Stop dictation", "Stop dicteren");
  const startLabel = label ?? text("Dictate", "Dicteren");

  return (
    <button
      className={`${className} ${listening ? "recording" : ""}`}
      type="button"
      onClick={toggle}
      aria-label={listening ? stopLabel : startLabel}
      title={error ? text("Dictation unavailable. Your typed text is preserved; try again.", "Dicteren niet beschikbaar. Je tekst blijft behouden; probeer opnieuw.") : listening ? stopLabel : startLabel}
      aria-pressed={listening}
    >
      {listening ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}
