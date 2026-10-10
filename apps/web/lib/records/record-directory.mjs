/**
 * Every record in the app carries a unique code, and the client wants to find any of them
 * back by typing that code: "alles moet uniek zijn met een nummer ter onderscheiding, en
 * je moet in de applicatie kunnen opzoeken op basis van die code".
 *
 * The codes come from the database — Q-2026-0004 for a finding, INS-…, HSE-…, RFI-…,
 * PHO-… for a photo — and they are written on paper and in e-mails in every possible
 * shape: with dashes, without, lower case, with the year left out. So the search here
 * compares the bare characters instead of the exact string, and it also looks at the
 * title, because half the time the code is exactly what somebody does not have at hand.
 */

/** Bare characters of a code, so "q-2026-0004", "Q20260004" and "q 2026 0004" are one. */
export function normalizeRecordCode(value) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * The record kinds a code can belong to, with the module each one opens in. The module
 * names are the workspace tabs, so a search result can be opened straight away.
 */
export const recordKindTabs = {
  ncr: "ncr",
  finding: "findings",
  inspection: "inspections",
  hse: "hse",
  register: "registers",
  report: "documents",
  // A photo is opened in the library, where its code and its links are shown.
  photo: "files",
  drawing: "drawings",
  file: "assets",
  folder: "assets",
  building: "home",
  daily_work: "daily",
  delay: "daily",
};

function entry(kind, id, code, title, subtitle, metadata = {}) {
  return {
    id,
    kind,
    tab: recordKindTabs[kind] ?? "home",
    code: String(code ?? "").trim(),
    normalizedCode: normalizeRecordCode(code),
    title: String(title ?? "").trim(),
    subtitle: String(subtitle ?? "").trim(),
    buildingIds: Array.from(new Set((metadata.buildingIds ?? []).filter(Boolean))),
    date: String(metadata.date ?? ""),
    status: String(metadata.status ?? subtitle ?? ""),
    author: String(metadata.author ?? ""),
    folderId: metadata.folderId ?? null,
    delayHours: Number(metadata.delayHours ?? 0),
  };
}

function recordBuildings(record) {
  return record?.building_ids?.length ? record.building_ids : record?.building_id ? [record.building_id] : [];
}

/**
 * One flat list of everything in the project snapshot that has a unique code. It is the
 * index behind the search box; nothing is fetched for it, so it also works offline on the
 * cached snapshot.
 */
export function buildRecordDirectory(snapshot) {
  const data = snapshot ?? {};
  const found = [];

  for (const finding of data.findings ?? []) {
    found.push(entry(
      finding.finding_type === "ncr" ? "ncr" : "finding",
      finding.id,
      finding.finding_number,
      finding.title,
      finding.status,
      { buildingIds: recordBuildings(finding), date: finding.created_at, status: finding.status, author: finding.issue_management?.issued_by },
    ));
  }
  for (const inspection of data.inspections ?? []) {
    found.push(entry("inspection", inspection.id, inspection.inspection_number, inspection.title, inspection.status, { buildingIds: recordBuildings(inspection), date: inspection.completed_at ?? inspection.started_at ?? inspection.planned_at, status: inspection.status, author: inspection.signed_by }));
  }
  for (const event of data.hseEvents ?? []) {
    found.push(entry("hse", event.id, event.event_number, event.title, event.status, { buildingIds: recordBuildings(event), date: event.occurred_at ?? event.created_at, status: event.status, author: event.signed_by }));
  }
  for (const register of data.registerEntries ?? []) {
    found.push(entry("register", register.id, register.entry_number, register.title, register.register_type, { buildingIds: recordBuildings(register), date: register.occurred_at, status: register.status, author: register.signed_by ?? register.details?.issued_by }));
  }
  for (const report of data.dayReports ?? []) {
    found.push(entry("report", report.id, report.report_number, report.report_date, report.status, { date: report.report_date, status: report.status }));
  }
  const filesById = new Map((data.files ?? []).map((file) => [file.id, file]));
  for (const capture of data.visualCaptures ?? []) {
    const file = filesById.get(capture.file_id);
    found.push(entry("photo", capture.id, file?.document_code ?? "", capture.title || file?.original_name, capture.description || capture.location_label, { buildingIds: recordBuildings(capture), date: capture.captured_at ?? capture.created_at, status: capture.status, folderId: file?.folder_id }));
  }
  for (const work of data.dailyWork ?? []) {
    const delayed = Number(work.delay_hours ?? 0) > 0;
    found.push(entry(delayed ? "delay" : "daily_work", work.id, "", work.day_summary || work.work_performed, delayed ? work.delay_cause : work.work_ongoing || work.work_performed, { buildingIds: recordBuildings(work), date: work.created_at, status: delayed ? "delayed" : "recorded", delayHours: work.delay_hours }));
  }
  for (const folder of data.mediaFolders ?? []) {
    found.push(entry("folder", folder.id, "", folder.name, folder.folder_type, { buildingIds: recordBuildings(folder), date: folder.created_at, status: folder.status }));
  }
  for (const building of data.buildings ?? []) {
    found.push(entry("building", building.id, building.code ?? "", building.name, building.status ?? "", { buildingIds: [building.id], status: building.status ?? "active" }));
  }
  // A photo is looked up by the code of the file it is stored as, so the code on a photo
  // card, in the register and in a report is the same one everywhere.
  const captureFileIds = new Set((data.visualCaptures ?? []).map((capture) => capture.file_id));
  for (const file of data.files ?? []) {
    const capture = (data.visualCaptures ?? []).find((item) => item.file_id === file.id);
    // A visual capture already contributes the image identity and opens the exact capture;
    // the file is still indexed separately when it is a document or drawing.
    if (capture && (file.category === "photo" || file.category === "image" || file.mime_type?.startsWith("image/"))) continue;
    const folder = (data.mediaFolders ?? []).find((item) => item.id === file.folder_id);
    const kind = file.category === "drawing" ? "drawing" : captureFileIds.has(file.id) || file.mime_type?.startsWith("image/") ? "photo" : "file";
    found.push(entry(kind, file.id, file.document_code, file.original_name, [file.category, folder?.name].filter(Boolean).join(" · "), { buildingIds: recordBuildings(file), date: file.created_at, status: file.status, folderId: file.folder_id }));
  }

  return found;
}

/**
 * The matches for what somebody typed, best first: the exact code, then a code that
 * starts with it, then a code that contains it, and only then the words in the title.
 */
export function searchRecordDirectory(entries, query, limit = 8) {
  const typed = String(query ?? "").trim();
  if (typed.length < 2) return [];
  const code = normalizeRecordCode(typed);
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean);

  const scored = [];
  for (const item of entries ?? []) {
    const haystack = `${item.title} ${item.subtitle} ${item.code}`.toLowerCase();
    const rank = code && item.normalizedCode === code ? 0
      : code && item.normalizedCode.startsWith(code) ? 1
        : code && item.normalizedCode.includes(code) ? 2
          : words.every((word) => haystack.includes(word)) ? 3
            : -1;
    if (rank >= 0) scored.push({ rank, item });
  }

  return scored
    .sort((left, right) => left.rank - right.rank || left.item.code.localeCompare(right.item.code))
    .slice(0, Math.max(0, limit))
    .map((scored_) => scored_.item);
}

const kindWords = new Map([
  ["foto", "photo"], ["foto's", "photo"], ["fotos", "photo"], ["photo", "photo"], ["photos", "photo"],
  ["inspectie", "inspection"], ["inspecties", "inspection"], ["inspection", "inspection"], ["inspections", "inspection"],
  ["ncr", "ncr"], ["hse", "hse"], ["issue", "finding"], ["issues", "finding"], ["probleem", "finding"], ["problemen", "finding"],
  ["document", "file"], ["documenten", "file"], ["documents", "file"], ["bestand", "file"],
  ["vertraging", "delay"], ["vertragingen", "delay"], ["delay", "delay"], ["delays", "delay"],
  ["levering", "register"], ["leveringen", "register"], ["delivery", "register"], ["deliveries", "register"],
  ["tekening", "drawing"], ["tekeningen", "drawing"], ["drawing", "drawing"], ["drawings", "drawing"],
]);

/** Calendar dates in search use the project timezone, even on a device abroad. */
export function projectRecordDay(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
  }
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Paramaribo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isoDay(date) {
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function dateWindow(query, now) {
  const lower = query.toLocaleLowerCase("nl");
  const localDay = projectRecordDay(now ?? new Date().toISOString());
  if (!localDay) return {};
  const day = new Date(`${localDay}T12:00:00Z`);
  const range = (from, to = from) => ({ dateFrom: isoDay(from), dateTo: isoDay(to) });
  if (/\b(vandaag|today)\b/.test(lower)) return range(day);
  if (/\b(gisteren|yesterday)\b/.test(lower)) { const date = new Date(day); date.setUTCDate(date.getUTCDate() - 1); return range(date); }
  const startOfWeek = new Date(day); startOfWeek.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  if (/\b(deze week|this week)\b/.test(lower)) return range(startOfWeek, day);
  if (/\b(vorige week|last week)\b/.test(lower)) { const from = new Date(startOfWeek); from.setUTCDate(from.getUTCDate() - 7); const to = new Date(startOfWeek); to.setUTCDate(to.getUTCDate() - 1); return range(from, to); }
  if (/\b(deze maand|this month)\b/.test(lower)) return range(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1)), day);
  if (/\b(vorige maand|last month)\b/.test(lower)) return range(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() - 1, 1)), new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 0)));
  if (/\b(dit jaar|this year)\b/.test(lower)) return range(new Date(Date.UTC(day.getUTCFullYear(), 0, 1)), day);
  const explicit = lower.match(/\b(\d{1,2})-(\d{1,2})-(\d{4})\b/);
  if (explicit) {
    const expected = `${explicit[3]}-${explicit[2].padStart(2, "0")}-${explicit[1].padStart(2, "0")}`;
    const date = new Date(`${expected}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && isoDay(date) === expected ? range(date) : { dateFrom: "invalid", dateTo: "invalid" };
  }
  const months = ["januari|january", "februari|february", "maart|march", "april", "mei|may", "juni|june", "juli|july", "augustus|august", "september", "oktober|october", "november", "december"];
  const monthIndex = months.findIndex((names) => new RegExp(`\\b(?:${names})\\b`).test(lower));
  if (monthIndex >= 0) return range(new Date(Date.UTC(day.getUTCFullYear(), monthIndex, 1)), new Date(Date.UTC(day.getUTCFullYear(), monthIndex + 1, 0)));
  return {};
}

/** Deterministic Dutch/English spoken-query parsing; words it does not know stay free text. */
export function parseRecordQuery(query, context = {}) {
  const typed = String(query ?? "").trim();
  const lower = typed.toLocaleLowerCase("nl");
  const tokens = lower.match(/[\p{L}\p{N}'-]+/gu) ?? [];
  const kind = tokens.map((token) => kindWords.get(token)).find(Boolean) ?? "";
  const status = /\b(open|urgent)\b/.test(lower) ? (/\burgent\b/.test(lower) ? "urgent" : "open")
    : /\b(gesloten|closed)\b/.test(lower) ? "closed"
      : /\b(afgerond|completed|complete)\b/.test(lower) ? "completed" : "";
  const buildings = context.buildings ?? [];
  const building = buildings.find((item) => {
    const candidates = [item.name, item.code].filter(Boolean).map((value) => String(value).toLocaleLowerCase("nl"));
    return candidates.some((candidate) => {
      const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:gebouw\\s+|building\\s+)?${escaped}(?=$|[^\\p{L}\\p{N}])`, "u").test(lower);
    });
  });
  const authorMatch = lower.match(/\b(?:door|by)\s+([\p{L}'-]+(?:\s+[\p{L}'-]+)?)(?=\s+(?:in|op|van|deze|vorige|this|last)\b|$)/u);
  const delayMatch = lower.match(/\b(?:langer dan|longer than|meer dan|over)\s+(\d+(?:[,.]\d+)?)\s*(?:uur|hours?)\b/);
  const parsedTokens = new Set([
    ...kindWords.keys(), "van", "of", "de", "het", "een", "alle", "all", "met", "with", "code", "gebouw", "building",
    "vandaag", "today", "gisteren", "yesterday", "deze", "this", "vorige", "last", "week", "maand", "month", "jaar", "year",
    "open", "urgent", "gesloten", "closed", "afgerond", "completed", "door", "by", "in", "langer", "longer", "meer", "dan", "than", "over", "uur", "hour", "hours",
    "januari", "january", "februari", "february", "maart", "march", "april", "mei", "may", "juni", "june", "juli", "july", "augustus", "august", "september", "oktober", "october", "november", "december",
    ...(building ? [String(building.name).toLocaleLowerCase("nl"), String(building.code ?? "").toLocaleLowerCase("nl")] : []),
    ...(authorMatch ? authorMatch[1].split(/\s+/) : []),
  ]);
  const delayNumber = delayMatch?.[1]?.replace(",", ".") ?? "";
  const freeText = tokens.filter((token) => !parsedTokens.has(token) && token.replace(",", ".") !== delayNumber && !/^\d{1,2}-\d{1,2}-\d{4}$/.test(token)).join(" ");
  return {
    kind,
    buildingIds: building ? [building.id] : [],
    status,
    ...dateWindow(lower, context.now),
    author: authorMatch?.[1] ?? "",
    minDelayHours: delayMatch ? Number(delayMatch[1].replace(",", ".")) : null,
    freeText,
  };
}

export function filterRecordDirectory(entries, query, filters = {}, context = {}, limit = 50) {
  const spoken = parseRecordQuery(query, context);
  const combined = {
    kind: filters.kind || spoken.kind,
    buildingIds: filters.buildingIds?.length ? filters.buildingIds : spoken.buildingIds,
    status: filters.status || spoken.status,
    dateFrom: filters.dateFrom || spoken.dateFrom || "",
    dateTo: filters.dateTo || spoken.dateTo || "",
    author: filters.author || spoken.author,
    minDelayHours: filters.minDelayHours ?? spoken.minDelayHours,
  };
  const parsedAnything = Boolean(spoken.kind || spoken.buildingIds.length || spoken.status || spoken.dateFrom || spoken.author || spoken.minDelayHours != null);
  const freeText = spoken.freeText || (parsedAnything ? "" : String(query ?? "").trim());
  const normalized = normalizeRecordCode(freeText);
  const words = freeText.toLocaleLowerCase("nl").split(/\s+/).filter(Boolean);
  return (entries ?? []).map((item) => {
    const haystack = `${item.code} ${item.title} ${item.subtitle} ${item.author}`.toLocaleLowerCase("nl");
    const itemStatus = `${item.status} ${item.subtitle}`.toLocaleLowerCase("nl");
    const rank = normalized && item.normalizedCode === normalized ? 0
      : normalized && item.normalizedCode.startsWith(normalized) ? 1
        : !words.length || words.every((word) => haystack.includes(word)) ? 2 : -1;
    return { item, rank, itemStatus };
  }).filter(({ item, rank, itemStatus }) => rank >= 0
    && (!combined.kind || item.kind === combined.kind || (combined.kind === "file" && ["file", "report"].includes(item.kind)))
    && (!combined.buildingIds?.length || combined.buildingIds.some((id) => item.buildingIds.includes(id)))
    && (!combined.status || (combined.status === "open" ? !["closed", "cancelled", "completed", "approved", "archived"].some((status) => itemStatus.includes(status)) : combined.status === "urgent" ? ["critical", "urgent", "overdue", "action_required"].some((status) => itemStatus.includes(status)) : itemStatus.includes(combined.status)))
    && (!combined.dateFrom || projectRecordDay(item.date) >= combined.dateFrom)
    && (!combined.dateTo || projectRecordDay(item.date) <= combined.dateTo)
    && (!combined.author || item.author.toLocaleLowerCase("nl").includes(combined.author.toLocaleLowerCase("nl")))
    && (combined.minDelayHours == null || item.delayHours > combined.minDelayHours)
  ).sort((left, right) => left.rank - right.rank || String(right.item.date).localeCompare(String(left.item.date)) || left.item.code.localeCompare(right.item.code))
    .slice(0, Math.max(0, limit)).map(({ item }) => item);
}
