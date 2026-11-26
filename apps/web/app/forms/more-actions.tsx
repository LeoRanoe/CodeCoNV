"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "@/lib/i18n";

/**
 * The secondary actions of a record card behind one button (OPUS-F07). A card keeps one or two actions in view
 * (open the record, the next step of its workflow); edit, withdraw, place on a drawing, send and export are one tap
 * further. The menu closes on Escape, on a tap outside it and after an action was chosen.
 */
export function MoreActions({ children, label }: { children: ReactNode; label?: string }) {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      root.current?.querySelector<HTMLButtonElement>(".more-actions-trigger")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  return (
    <div className="more-actions" ref={root}>
      <button
        className="ui-button ui-button--secondary ui-button--md more-actions-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={16} aria-hidden="true" /> {label ?? text("More actions", "Meer acties")}
      </button>
      <div
        className="more-actions-menu"
        id={id}
        role="group"
        aria-label={label ?? text("More actions", "Meer acties")}
        hidden={!open}
        // A chosen action closes the menu; a download or an inline form opens where it always did.
        onClick={(event) => { if ((event.target as HTMLElement).closest("button")) setOpen(false); }}
      >
        {children}
      </div>
    </div>
  );
}
