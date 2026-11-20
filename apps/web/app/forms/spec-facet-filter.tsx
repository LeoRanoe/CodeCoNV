"use client";

import { facetOptions, type SpecFacetFilter, type SpecFacets } from "@/lib/forms/spec-facets";
import { specLabel } from "@/lib/forms/spec-labels-nl";
import { useLanguage } from "@/lib/i18n";

/**
 * Discipline, type / category, status and priority: the four reporting filters of the
 * specification, offered with the values the records actually carry. Nothing shows when the
 * records carry none.
 */
export function SpecFacetFilterBar({ facets, value, onChange, id }: {
  facets: SpecFacets[];
  value: SpecFacetFilter;
  onChange: (next: SpecFacetFilter) => void;
  id: string;
}) {
  const { language, text } = useLanguage();
  const options = facetOptions(facets);
  const fields: Array<[keyof SpecFacetFilter, string]> = [
    ["discipline", text("Discipline", "Discipline")],
    ["type", text("Type / category", "Soort / categorie")],
    ["status", text("Status", "Status")],
    ["priority", text("Priority", "Prioriteit")],
  ];
  const shown = fields.filter(([key]) => options[key].length || value[key]);
  if (!shown.length) return null;
  return (
    <div className="spec-facet-filter" role="group" aria-label={text("Filter by specification fields", "Filter op specificatievelden")}>
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
