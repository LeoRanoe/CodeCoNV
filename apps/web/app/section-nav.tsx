"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useLanguage } from "@/lib/i18n";

export type SectionNavItem = {
  id: string;
  label: string;
  /** A number or short value shown next to the name: open items, a total. */
  count?: number | string;
  icon?: ReactNode;
  selected: boolean;
  onSelect: () => void;
};

const wideQuery = "(min-width: 1024px)";

function useWideScreen() {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia(wideQuery);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia(wideQuery).matches,
    () => false,
  );
}

/**
 * How a screen moves between its own sections. Two or three sections are a segmented
 * control that is always in view. More than that is an underlined bar on a wide screen, and
 * on a phone (or when there are too many for one line) a single bar that names where you are
 * and opens a list of every section, with its count, when tapped. Nothing scrolls sideways.
 */
export function SectionNav({
  label,
  items,
  className = "",
}: {
  /** Names the group for assistive technology and the menu. */
  label: string;
  items: SectionNavItem[];
  className?: string;
}) {
  const wide = useWideScreen();
  if (items.length <= 3) return <SegmentedNav label={label} items={items} className={className} />;
  if (wide && items.length <= 6) return <UnderlineNav label={label} items={items} className={className} />;
  return <MenuNav label={label} items={items} className={className} />;
}

function Count({ value }: { value?: number | string }) {
  return value === undefined ? null : <span className="section-nav__count">{value}</span>;
}

function SegmentedNav({ label, items, className }: { label: string; items: SectionNavItem[]; className: string }) {
  return (
    <div className={`section-nav section-nav--segmented ${className}`.trim()} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button type="button" role="tab" aria-selected={item.selected} className={item.selected ? "active" : ""} onClick={item.onSelect} key={item.id}>
          {item.icon}
          <span className="section-nav__label">{item.label}</span>
          <Count value={item.count} />
        </button>
      ))}
    </div>
  );
}

function UnderlineNav({ label, items, className }: { label: string; items: SectionNavItem[]; className: string }) {
  return (
    <div className={`section-nav section-nav--bar ${className}`.trim()} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button type="button" role="tab" aria-selected={item.selected} className={item.selected ? "active" : ""} onClick={item.onSelect} key={item.id}>
          {item.icon}
          <span className="section-nav__label">{item.label}</span>
          <Count value={item.count} />
        </button>
      ))}
    </div>
  );
}

function MenuNav({ label, items, className }: { label: string; items: SectionNavItem[]; className: string }) {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const current = items.find((item) => item.selected) ?? items[0];

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); close(); return; }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const options = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>("[role='tab']") ?? []);
      const index = options.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0) return;
      event.preventDefault();
      options[(index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length]?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    // The list opens on the section the person is in.
    rootRef.current?.querySelector<HTMLButtonElement>("[role='tab'][aria-selected='true']")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [close, open]);

  if (!current) return null;
  return (
    <div className={`section-nav section-nav--menu ${open ? "is-open" : ""} ${className}`.trim()} ref={rootRef}>
      <button
        ref={triggerRef}
        className="section-nav__trigger"
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${current.label}`}
        onClick={() => setOpen((value) => !value)}
      >
        {current.icon ? <span className="section-nav__icon" aria-hidden="true">{current.icon}</span> : null}
        <span className="section-nav__current">
          <small>{label}</small>
          <strong>{current.label}</strong>
        </span>
        <Count value={current.count} />
        <ChevronDown className="section-nav__chevron" size={18} aria-hidden="true" />
      </button>
      {open ? <div className="section-nav__scrim" aria-hidden="true" /> : null}
      <div className="section-nav__panel" id={listId} hidden={!open}>
        <div className="section-nav__panel-head">
          <strong>{label}</strong>
          <button type="button" className="section-nav__close" aria-label={text("Close", "Sluiten")} onClick={() => close()}><X size={18} /></button>
        </div>
        <div role="tablist" aria-label={label} aria-orientation="vertical" className="section-nav__list">
          {items.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={item.selected}
              className={item.selected ? "active" : ""}
              onClick={() => { item.onSelect(); close(); }}
              key={item.id}
            >
              {item.icon ? <span className="section-nav__icon" aria-hidden="true">{item.icon}</span> : null}
              <span className="section-nav__label">{item.label}</span>
              <Count value={item.count} />
              {item.selected ? <Check className="section-nav__check" size={18} aria-hidden="true" /> : <span className="section-nav__check" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
