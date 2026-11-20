"use client";

import { useEffect, useState } from "react";
import { DictateButton } from "@/app/dictate-button";
import { insertIntoField } from "@/lib/speech/dictation";

type FreeTextField = HTMLInputElement | HTMLTextAreaElement;

/** A field where something is written freely: a writing area or a one-line text box. */
export function isFreeTextField(element: Element | null): element is FreeTextField {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled;
  if (!(element instanceof HTMLInputElement)) return false;
  const type = (element.getAttribute("type") ?? "text").toLowerCase();
  if (!["text", ""].includes(type) || element.readOnly || element.disabled) return false;
  // Sign-in, codes and coordinates are not dictated.
  return !element.closest(".access-form, [data-no-dictation]") && !/latitude|longitude|code|email|password/i.test(element.name || element.id || "");
}

/** The field already has its own microphone beside it. */
const hasOwnMicrophone = (field: FreeTextField) => Boolean(field.parentElement?.querySelector(":scope > .dictate-button"));

/** The text does not run under the microphone while it is shown; the field's own padding returns after. */
function makeRoomForMicrophone(element: FreeTextField) {
  const previous = element.style.paddingRight;
  element.style.setProperty("padding-right", "52px");
  return () => element.style.setProperty("padding-right", previous);
}

/**
 * Every free-text field gets dictation (client, 20-11-2026). Fields that do not carry their own
 * microphone get this one while they have the focus, at their right edge; the words are written
 * into the field as if they were typed.
 */
export function DictationLayer() {
  const [field, setField] = useState<FreeTextField | null>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const target = event.target as Element | null;
      if (isFreeTextField(target) && !hasOwnMicrophone(target)) setField(target);
    };
    const onBlur = (event: FocusEvent) => {
      const next = event.relatedTarget as Element | null;
      if (next?.closest(".dictation-layer")) return;
      // A recording in progress keeps its button; otherwise it leaves with the focus.
      if (!document.querySelector(".dictation-layer .recording, .dictation-layer [aria-busy=true]")) setField(null);
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => { document.removeEventListener("focusin", onFocus); document.removeEventListener("focusout", onBlur); };
  }, []);

  useEffect(() => {
    if (!field) return undefined;
    const place = () => {
      if (!field.isConnected) { setField(null); return; }
      const rect = field.getBoundingClientRect();
      const size = 40;
      const top = field instanceof HTMLTextAreaElement ? rect.bottom - size - 6 : rect.top + (rect.height - size) / 2;
      setBox({ top, left: rect.right - size - 6 });
    };
    const frame = window.requestAnimationFrame(place);
    const restorePadding = makeRoomForMicrophone(field);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.cancelAnimationFrame(frame);
      restorePadding();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [field]);

  if (!field || !box) return null;
  return (
    <div className="dictation-layer" style={{ top: box.top, left: box.left }}>
      <DictateButton className="dictate-button dictation-layer-button" onText={(transcript) => { if (field.isConnected) { insertIntoField(field, transcript); field.focus(); } }} />
    </div>
  );
}
