"use client";

import { useLanguage } from "@/lib/i18n";
import { hourChoices, joinTime, minuteChoices, splitTime } from "@/lib/forms/time-value.mjs";

/**
 * A time of day on a 24-hour clock, as two lists. The phone still opens its own wheel for each
 * list, and nothing shows AM or PM whatever the browser's language is.
 */
export function TimeField({ value, onChange, label, className = "time-field" }: {
  value: string;
  onChange: (value: string) => void;
  /** What the pair of lists is for, read out before "hour" and "minute". */
  label: string;
  className?: string;
}) {
  const { text } = useLanguage();
  const { hour, minute } = splitTime(value);
  return (
    <span className={className} role="group" aria-label={label}>
      <select aria-label={`${label} · ${text("hour", "uur")}`} value={hour} onChange={(event) => onChange(joinTime(event.target.value, minute))}>
        <option value="">--</option>
        {hourChoices.map((choice) => <option value={choice} key={choice}>{choice}</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select aria-label={`${label} · ${text("minute", "minuut")}`} value={minute} disabled={!hour} onChange={(event) => onChange(joinTime(hour, event.target.value))}>
        {!hour ? <option value="">--</option> : null}
        {minuteChoices.map((choice) => <option value={choice} key={choice}>{choice}</option>)}
      </select>
    </span>
  );
}
