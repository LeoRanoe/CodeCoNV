"use client";

import { Compass, Pencil } from "lucide-react";
import { useState } from "react";
import { dutchDirectionLabels, photoDirections } from "@/app/photo-evidence";
import { useLanguage } from "@/lib/i18n";

/**
 * The direction a photo was taken from — filled in by the app, not by the supervisor.
 *
 * The client asked for this in two words: "automatisch, aub". The photo carries the compass
 * reading of the camera, and the device compass fills the gap when it does not. Only when both
 * stay silent does the field ask a question, and even then it never blocks saving: a picture
 * without a bearing is still a picture.
 */
export function FacingDirectionField({
  value,
  automatic,
  onChange,
}: {
  value: string;
  /** True when the reading came from the camera or the compass instead of from a tap. */
  automatic: boolean;
  onChange: (direction: string, automatic: boolean) => void;
}) {
  const { language, text } = useLanguage();
  const [editing, setEditing] = useState(false);
  const label = value ? (language === "en" ? value : dutchDirectionLabels[value] ?? value) : "";

  if (value && automatic && !editing) {
    return (
      <div className="form-field facing-direction-field">
        <span>{text("Facing direction", "Kijkrichting")}</span>
        <p className="facing-direction-automatic">
          <Compass size={15} />
          <strong>{label}</strong>
          <em>{text("measured automatically", "automatisch bepaald")}</em>
          <button type="button" onClick={() => setEditing(true)}>
            <Pencil size={12} /> {text("Change", "Wijzig")}
          </button>
        </p>
      </div>
    );
  }

  return (
    <label className="form-field facing-direction-field">
      <span>{text("Facing direction", "Kijkrichting")}</span>
      <select
        value={value}
        onChange={(event) => { setEditing(false); onChange(event.target.value, false); }}
      >
        <option value="">{text("Not measured · optional", "Niet gemeten · optioneel")}</option>
        {photoDirections.map((option) => (
          <option value={option} key={option}>{language === "en" ? option : dutchDirectionLabels[option]}</option>
        ))}
      </select>
    </label>
  );
}
