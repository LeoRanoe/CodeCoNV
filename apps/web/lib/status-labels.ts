/**
 * The one place a stored status or severity code becomes words on a screen.
 *
 * The same domain state must read the same everywhere — the workspace, the action centre,
 * the contractor's shared link and the reports — and a raw code such as
 * "ready_for_verification" must never reach a user. Wording is copied from the screens that
 * already used it; nothing here is new vocabulary.
 */

export type StatusLanguage = "en" | "nl";

type Labels = Record<string, { en: string; nl: string }>;

export const findingStatusLabels: Labels = {
  draft: { en: "Draft", nl: "Concept" },
  open: { en: "Open", nl: "Open" },
  assigned: { en: "Assigned", nl: "Toegewezen" },
  in_progress: { en: "In progress", nl: "In uitvoering" },
  ready_for_verification: { en: "Ready for verification", nl: "Gereed voor verificatie" },
  closed: { en: "Closed", nl: "Gesloten" },
  rejected: { en: "Rejected", nl: "Afgewezen" },
  reopened: { en: "Reopened", nl: "Heropend" },
  cancelled: { en: "Cancelled", nl: "Geannuleerd" },
};

export const actionStatusLabels: Labels = {
  open: { en: "Open", nl: "Open" },
  accepted: { en: "Accepted", nl: "Geaccepteerd" },
  in_progress: { en: "In progress", nl: "In uitvoering" },
  ready_for_verification: { en: "Ready for verification", nl: "Gereed voor verificatie" },
  verified: { en: "Verified", nl: "Geverifieerd" },
  cancelled: { en: "Cancelled", nl: "Geannuleerd" },
};

export const severityLabels: Labels = {
  low: { en: "Low", nl: "Laag" },
  medium: { en: "Medium", nl: "Middel" },
  normal: { en: "Normal", nl: "Normaal" },
  high: { en: "High", nl: "Hoog" },
  critical: { en: "Critical", nl: "Kritiek" },
};

/** Turns an unknown code into readable words instead of leaking it with underscores. */
function humanize(code: string) {
  const words = code.replaceAll("_", " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : words;
}

export function labelFor(labels: Labels, code: string | null | undefined, language: StatusLanguage, fallback = "") {
  if (!code) return fallback;
  return labels[code]?.[language] ?? humanize(code);
}

/** Plain maps for screens that already index a Record<string, string> by code. */
export function labelMap(labels: Labels, language: StatusLanguage): Record<string, string> {
  return Object.fromEntries(Object.entries(labels).map(([code, label]) => [code, label[language]]));
}
