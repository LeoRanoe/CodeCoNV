"use client";

import { useRef, useState } from "react";
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
  return `${current}${current ? " " : ""}${transcript}`;
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

  if (!speechToTextAvailable()) return null;

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Constructor = speechConstructor();
    if (!Constructor) return;
    const recognition = new Constructor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = language === "nl" ? "nl-NL" : "en-US";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) transcript += `${event.results[index][0].transcript} `;
      }
      if (transcript.trim()) onText(transcript.trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const stopLabel = text("Stop dictation", "Stop dicteren");
  const startLabel = label ?? text("Dictate", "Dicteren");

  return (
    <button
      className={`${className} ${listening ? "recording" : ""}`}
      type="button"
      onClick={toggle}
      aria-label={listening ? stopLabel : startLabel}
      title={listening ? stopLabel : startLabel}
    >
      {listening ? <MicOff size={13} /> : <Mic size={13} />}
    </button>
  );
}
