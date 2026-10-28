"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clearFormDraft, loadFormDraft, saveFormDraft } from "@/lib/offline/form-drafts";

export type AutosaveStatus = "idle" | "saving" | "saved" | "restored";

/**
 * Keeps a half-filled form on the device while it is being filled in and puts it back when
 * the person returns: after a tab switch, a reload, a call, or a phone that dropped the page.
 * One draft per `id` (form, project, subject). It is written only after a change is made on
 * the form, so opening a form and walking away leaves nothing behind, and it is removed when
 * the record is sent (`clear`) or thrown away (`discard`).
 *
 * `value` must be what the form would send: plain data, files and signatures included.
 */
export function useFormAutosave<Value>({
  id,
  value,
  enabled = true,
  restore,
  delay = 600,
}: {
  id: string;
  value: Value;
  /** The form is open for a new record. An edit of a stored record has its own source of truth. */
  enabled?: boolean;
  /** Puts a stored draft back into the form's own state. Called once per opening of the form. */
  restore: (draft: Value) => void;
  delay?: number;
}) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  /** The id whose stored draft has been read; changes are only written after this. */
  const [readyId, setReadyId] = useState<string | null>(null);
  const baseline = useRef<string | null>(null);
  const finished = useRef(false);
  const restoreRef = useRef(restore);
  const valueRef = useRef(value);
  /** A change is waiting for its debounce; leaving the form must not lose it. */
  const pending = useRef(false);

  // The latest callbacks and value, readable from timers and page events.
  useEffect(() => {
    restoreRef.current = restore;
    valueRef.current = value;
  });

  // Read the draft once for the form that was opened.
  useEffect(() => {
    if (!enabled) return;
    baseline.current = null;
    finished.current = false;
    let cancelled = false;
    void loadFormDraft<Value>(id).then((draft) => {
      if (cancelled) return;
      if (draft) {
        restoreRef.current(draft.value);
        setSavedAt(draft.savedAt);
        setStatus("restored");
      } else {
        setStatus("idle");
        setSavedAt(null);
      }
      setReadyId(id);
    });
    return () => {
      cancelled = true;
      setReadyId(null);
    };
  }, [enabled, id]);

  // Write after a change; the first value after the draft is read is the baseline, not a change.
  const serialised = enabled && readyId === id ? safeStringify(value) : null;
  useEffect(() => {
    if (serialised === null || finished.current) return;
    if (baseline.current === null) { baseline.current = serialised; return; }
    if (serialised === baseline.current) return;
    setStatus("saving");
    pending.current = true;
    const timer = window.setTimeout(() => {
      pending.current = false;
      if (finished.current) return;
      void saveFormDraft<Value>(id, valueRef.current).then((saved) => {
        if (finished.current) return;
        if (saved) { setSavedAt(new Date().toISOString()); setStatus("saved"); } else setStatus("idle");
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [delay, id, serialised]);

  // Switching to another tab or leaving the page flushes a change that is still waiting.
  useEffect(() => {
    if (!enabled) return;
    const flush = () => {
      if (!pending.current || finished.current) return;
      pending.current = false;
      void saveFormDraft<Value>(id, valueRef.current);
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  }, [enabled, id]);

  /** The record was sent: the draft has nothing left to protect, and a late write must not bring it back. */
  const clear = useCallback(() => {
    finished.current = true;
    pending.current = false;
    baseline.current = null;
    void clearFormDraft(id);
    setStatus("idle");
    setSavedAt(null);
  }, [id]);

  return { status, savedAt, clear };
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, (_key, item) => (typeof Blob !== "undefined" && item instanceof Blob ? `blob:${item.size}:${item.type}` : item));
  } catch {
    return String(Math.random());
  }
}
