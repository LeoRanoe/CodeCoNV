"use client";

import { Check, History } from "lucide-react";
import type { AutosaveStatus } from "@/lib/offline/use-form-autosave";
import { useLanguage } from "@/lib/i18n";

function clock(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Paramaribo" }).format(date);
}

/**
 * The one line that tells a person their words are safe on this device. A restored draft says
 * so and offers a clean start; a form being filled in shows a quiet "saved" once it has.
 */
export function DraftNotice({
  status,
  savedAt,
  onDiscard,
}: {
  status: AutosaveStatus;
  savedAt: string | null;
  onDiscard?: () => void;
}) {
  const { text } = useLanguage();
  if (status === "idle") return null;
  const time = clock(savedAt);
  if (status === "restored") {
    return (
      <p className="draft-notice draft-notice--restored" role="status">
        <History size={16} aria-hidden="true" />
        <span>{time ? text(`Draft from ${time} put back.`, `Concept van ${time} teruggezet.`) : text("Draft put back.", "Concept teruggezet.")}</span>
        {onDiscard ? <button className="text-link" type="button" onClick={onDiscard}>{text("Start over", "Opnieuw beginnen")}</button> : null}
      </p>
    );
  }
  return (
    <p className="draft-notice" role="status" aria-live="polite">
      <Check size={16} aria-hidden="true" />
      <span>{status === "saving" ? text("Saving draft…", "Concept opslaan…") : text(`Draft saved on this device ${time}`.trim(), `Concept bewaard op dit apparaat ${time}`.trim())}</span>
    </p>
  );
}
