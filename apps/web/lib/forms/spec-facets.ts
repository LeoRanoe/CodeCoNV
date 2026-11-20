/**
 * Reporting filters across all forms ("Test … reporting filters across all forms"): every record
 * of the client's specification reads as the same four facets — discipline, type / category,
 * status and priority — whatever form it came from, so a list, the workspace search and the
 * period report filter all records the same way.
 */
export type SpecFacets = { discipline: string; type: string; category: string; status: string; priority: string };
export type SpecFacetFilter = Partial<Record<"discipline" | "type" | "status" | "priority", string>>;

const first = (spec: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = spec[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const typeKeys = ["issue_type", "ncr_type", "hse_type", "incident_type", "change_type", "instruction_type", "agreement_type", "delay_cause_type", "project_phase", "material_group", "photo_purpose", "activity"];
const categoryKeys = ["issue_category", "ncr_category", "hse_category", "incident_category", "change_category", "instruction_category", "agreement_category", "delay_cause_category", "lesson_category"];
const statusKeys = ["workflow_status", "approval_status", "review_status", "inspection_status", "progress_status", "inspection_result", "delivery_status", "attendance_status"];
const priorityKeys = ["priority", "risk_rating", "severity", "incident_severity", "risk_severity"];

export function specFacets(spec: unknown): SpecFacets {
  const values = spec && typeof spec === "object" && !Array.isArray(spec) ? spec as Record<string, unknown> : {};
  return {
    discipline: first(values, ["discipline"]),
    type: first(values, typeKeys),
    category: first(values, categoryKeys),
    status: first(values, statusKeys),
    priority: first(values, priorityKeys),
  };
}

/** The spec object of any stored record: findings, HSE events, register entries, inspections, photos. */
export function recordSpec(record: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!record) return {};
  const issue = record.issue_management as Record<string, unknown> | null | undefined;
  const details = record.details as Record<string, unknown> | null | undefined;
  const spec = (issue && typeof issue === "object" ? issue.spec : undefined) ?? (details && typeof details === "object" ? details.spec : undefined) ?? record.spec;
  return spec && typeof spec === "object" && !Array.isArray(spec) ? spec as Record<string, unknown> : {};
}

export function matchesSpecFacets(facets: SpecFacets, filter: SpecFacetFilter) {
  return (!filter.discipline || facets.discipline === filter.discipline)
    && (!filter.type || facets.type === filter.type || facets.category === filter.type)
    && (!filter.status || facets.status === filter.status)
    && (!filter.priority || facets.priority === filter.priority);
}

export const facetFilterActive = (filter: SpecFacetFilter) => Object.values(filter).some(Boolean);

/** The values present in a set of records, per facet, for the filter lists. */
export function facetOptions(facets: SpecFacets[]) {
  const collect = (pick: (item: SpecFacets) => string[]) => [...new Set(facets.flatMap(pick).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  return {
    discipline: collect((item) => [item.discipline]),
    type: collect((item) => [item.type, item.category]),
    status: collect((item) => [item.status]),
    priority: collect((item) => [item.priority]),
  };
}

/** A period report snapshot with only the records that match the filter; other sections stay. */
export function filterPeriodSnapshot<T extends Record<string, unknown>>(snapshot: T, filter: SpecFacetFilter): T {
  if (!facetFilterActive(filter)) return snapshot;
  const keep = (rows: unknown) => Array.isArray(rows) ? rows.filter((row) => matchesSpecFacets(specFacets(recordSpec(row as Record<string, unknown>)), filter)) : rows;
  return {
    ...snapshot,
    findings: keep(snapshot.findings),
    hse_events: keep(snapshot.hse_events),
    register_entries: keep(snapshot.register_entries),
    inspections: keep(snapshot.inspections),
  };
}
