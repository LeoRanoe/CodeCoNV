import type { ReactNode } from "react";

/**
 * One numbered card of a form laid out as the client's mockups v6: a number, a title and a short hint, then the card's
 * fields. SpecFields builds these cards itself for the Excel sheet forms; a screen that has its own controls (the
 * inspection, the workforce) uses this card so it looks the same.
 */
export function SheetCard({ number, title, hint, className, children }: {
  number: number;
  title: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`sheet-card${className ? ` ${className}` : ""}`}>
      <h3 className="sheet-section-title" data-sheet-section={number}>
        <span className="sheet-section-number" aria-hidden="true">{number}</span>
        <span className="sheet-section-name">{title}</span>
        {hint ? <span className="sheet-section-hint">{hint}</span> : null}
      </h3>
      {children}
    </section>
  );
}
