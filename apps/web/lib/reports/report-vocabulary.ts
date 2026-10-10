/**
 * Words and times as they appear on a formal CODECO document (PDF and Word alike).
 *
 * A report handed to a client never shows a stored code ("partly_cloudy", "none",
 * "project_manager") or a UTC timestamp: codes become Dutch words and every moment is shown
 * in Suriname time, which is the time on site.
 */

const weather: Record<string, string> = {
  sunny: "Zonnig",
  partly_cloudy: "Licht bewolkt",
  cloudy: "Bewolkt",
  rain: "Regen",
  heavy_rain: "Zware regen",
};

const wind: Record<string, string> = { calm: "kalm", moderate: "matig", strong: "sterk" };

const inspection: Record<string, string> = {
  none: "Geen inspectie",
  all_ok: "Uitgevoerd · alles akkoord",
  issues: "Uitgevoerd · afwijking gevonden",
};

const variation: Record<string, string> = {
  none: "Niet van toepassing",
  pending: "In behandeling",
  approved: "Goedgekeurd",
  rejected: "Afgewezen",
};

const delay: Record<string, string> = {
  none: "Geen vertraging",
  weather: "Weer",
  delivery: "Levering te laat",
  material: "Materiaaltekort",
  equipment: "Materieelstoring",
  other: "Andere oorzaak",
};

const roles: Record<string, string> = {
  supervisor: "Supervisor",
  lead_supervisor: "Lead supervisor",
  project_manager: "Projectleider",
  quality_hse_manager: "Kwaliteit & HSE",
  contractor: "Aannemer",
  client: "Opdrachtgever",
  organization_admin: "Organisatiebeheerder",
};

function word(map: Record<string, string>, code: string | null | undefined) {
  if (!code) return "";
  return map[code] ?? code.replaceAll("_", " ");
}

export const reportWeather = (code: string) => word(weather, code);
export const reportWind = (code: string) => word(wind, code);
export const reportInspection = (code: string) => word(inspection, code);
export const reportVariation = (code: string) => word(variation, code);
export const reportDelayCause = (code: string) => word(delay, code);
export const reportRole = (code: string) => word(roles, code);

const suriname = "America/Paramaribo";

/** A moment (ISO timestamp) in Suriname time, e.g. "7 okt 2026, 07:14 (SRT)". */
export function reportMoment(iso: string | null | undefined) {
  if (!iso) return "";
  const moment = new Date(iso);
  if (Number.isNaN(moment.getTime())) return iso;
  return `${new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: suriname }).format(moment)} (SRT)`;
}

/** A calendar day (YYYY-MM-DD) as written on the report, e.g. "woensdag 7 oktober 2026". */
export function reportDay(day: string | null | undefined) {
  if (!day) return "";
  const moment = new Date(`${day.slice(0, 10)}T12:00:00-03:00`);
  if (Number.isNaN(moment.getTime())) return day;
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "full", timeZone: suriname }).format(moment);
}
