"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Loader2, Mic, MicOff } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { dictationSupported, startDictation, type DictationError, type DictationSession } from "@/lib/speech/dictation";

const noSubscription = () => () => {};

export function speechToTextAvailable() {
  return dictationSupported();
}

// Appends the dictated transcript to whatever the field already holds.
export function appendDictation(current: string, transcript: string) {
  const words = transcript.trim();
  return words ? `${current}${current && !/\s$/.test(current) ? " " : ""}${words}` : current;
}

/** Where the microphone sits on a one-line field, and the room the field leaves for it. */
export const micInputStyle = { bottom: 3 } as const;
export const inputWithMicStyle = { paddingRight: 52 } as const;

/**
 * The microphone of a free-text field. Where the server transcribes, Dutch and English are
 * understood together, also mixed in one sentence (client, 20-11-2026); otherwise the
 * browser listens in the app language.
 */
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
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<DictationSession | null>(null);
  // Set when the field leaves the screen, so a session that was still starting is stopped too.
  const goneRef = useRef(false);
  const onTextRef = useRef(onText);
  // Why dictation stopped, shown beside the button: a tooltip never appears on a tablet.
  const [error, setError] = useState<"" | DictationError>("");
  // False on the server, the device's answer in the browser.
  const supported = useSyncExternalStore(noSubscription, dictationSupported, () => false);
  useEffect(() => { onTextRef.current = onText; }, [onText]);
  useEffect(() => {
    const stop = () => {
      sessionRef.current?.abort();
      sessionRef.current = null;
      setListening(false);
    };
    const onVisibility = () => { if (document.hidden) stop(); };
    goneRef.current = false;
    document.addEventListener("visibilitychange", onVisibility);
    return () => { goneRef.current = true; document.removeEventListener("visibilitychange", onVisibility); stop(); };
  }, [language]);

  if (!supported) return null;

  const toggle = async () => {
    if (busy) return;
    if (sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
      setListening(false);
      return;
    }
    setError("");
    setListening(true);
    const session = await startDictation({
      language,
      onText: (transcript) => onTextRef.current(transcript),
      onError: (kind) => setError(kind),
      onBusy: setBusy,
      onEnd: () => { sessionRef.current = null; setListening(false); },
    });
    // Left the screen while the microphone was still starting: never keep listening.
    if (goneRef.current) { session?.abort(); return; }
    sessionRef.current = session;
    if (!session) setListening(false);
  };

  const stopLabel = text("Stop dictation", "Stop dicteren");
  const startLabel = label ?? text("Dictate (Dutch or English)", "Dicteren (Nederlands of Engels)");
  const errorText = error === "blocked"
    ? text("Microphone blocked. Allow it for this site in the browser settings.", "Microfoon geblokkeerd. Sta hem toe voor deze site in de browserinstellingen.")
    : text("Dictation unavailable. Your typed text is kept; try again.", "Dicteren niet beschikbaar. Je tekst blijft bewaard; probeer opnieuw.");

  return (
    <>
      <button
        className={`${className} ${listening ? "recording" : ""}`}
        style={style}
        type="button"
        // Keeps the focus in the field, so the words land where the person was typing.
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => void toggle()}
        aria-label={busy ? text("Writing out the dictation…", "Dictaat wordt uitgeschreven…") : listening ? stopLabel : startLabel}
        title={error ? errorText : listening ? stopLabel : startLabel}
        aria-pressed={listening}
        aria-busy={busy}
      >
        {busy ? <Loader2 className="spin" size={18} /> : listening ? <MicOff size={18} /> : <Mic size={18} />}
      </button>
      {error ? <span className="dictate-error" role="status" style={style?.bottom !== undefined ? { bottom: Number(style.bottom) + 44 } : undefined}>{errorText}</span> : null}
    </>
  );
}
