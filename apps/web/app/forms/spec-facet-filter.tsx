"use client";

import { Filter } from "lucide-react";
import { useState } from "react";
import { facetOptions, type SpecFacetFilter, type SpecFacets } from "@/lib/forms/spec-facets";
import { specLabel } from "@/lib/forms/spec-labels-nl";
import { useLanguage } from "@/lib/i18n";

/**
 * Discipline, type / category, status and priority: the four reporting filters of the
 * specification, offered with the values the records actually carry. Nothing shows when the
 * records carry none.
 */
export function SpecFacetFilterBar({ facets, value, onChange, id, foldable = false }: {
  facets: SpecFacets[];
  value: SpecFacetFilter;
  onChange: (next: SpecFacetFilter) => void;
  id: string;
  /** Above a record list the four filters fold behind one "Filters" button (OPUS-F08): open, they filled a phone screen before the first record. */
  foldable?: boolean;
}) {
  const { language, text } = useLanguage();
  const active = Object.values(value).filter(Boolean).length;
  const [open, setOpen] = useState(false);
  const options = facetOptions(facets);
  const fields: Array<[keyof SpecFacetFilter, string]> = [
    ["discipline", text("Discipline", "Discipline")],
    ["type", text("Type / category", "Soort / categorie")],
    ["status", text("Status", "Status")],
    ["priority", text("Priority", "Prioriteit")],
  ];
  const shown = fields.filter(([key]) => options[key].length || value[key]);
  if (!shown.length) return null;
  if (foldable && !open && !active) {
    return (
      <div className="spec-facet-toggle-row">
        <button className="ui-button ui-button--secondary ui-button--md spec-facet-toggle" type="button" aria-expanded={false} aria-controls={`${id}-group`} onClick={() => setOpen(true)}>
          <Filter size={15} aria-hidden="true" /> {text("Filters", "Filters")}
        </button>
      </div>
    );
  }
  return (
    <div className="spec-facet-filter" id={`${id}-group`} role="group" aria-label={text("Filter by specification fields", "Filter op specificatievelden")}>
      {shown.map(([key, label]) => (
        <label className="form-field" key={key} htmlFor={`${id}-${key}`}>
          <span>{label}</span>
          <select id={`${id}-${key}`} value={value[key] ?? ""} onChange={(event) => onChange({ ...value, [key]: event.target.value })}>
            <option value="">{text("All", "Alle")}</option>
            {options[key].map((option) => <option key={option} value={option}>{specLabel(option, language)}</option>)}
          </select>
        </label>
      ))}
    </div>
  );
}
