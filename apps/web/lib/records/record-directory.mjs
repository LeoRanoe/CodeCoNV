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
  file: "files",
};

function entry(kind, id, code, title, subtitle) {
  return {
    id,
    kind,
    tab: recordKindTabs[kind] ?? "home",
    code: String(code ?? "").trim(),
    normalizedCode: normalizeRecordCode(code),
    title: String(title ?? "").trim(),
    subtitle: String(subtitle ?? "").trim(),
  };
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
    ));
  }
  for (const inspection of data.inspections ?? []) {
    found.push(entry("inspection", inspection.id, inspection.inspection_number, inspection.title, inspection.status));
  }
  for (const event of data.hseEvents ?? []) {
    found.push(entry("hse", event.id, event.event_number, event.title, event.status));
  }
  for (const register of data.registerEntries ?? []) {
    found.push(entry("register", register.id, register.entry_number, register.title, register.register_type));
  }
  for (const report of data.dayReports ?? []) {
    found.push(entry("report", report.id, report.report_number, report.report_date, report.status));
  }
  // A photo is looked up by the code of the file it is stored as, so the code on a photo
  // card, in the register and in a report is the same one everywhere.
  const captureFileIds = new Set((data.visualCaptures ?? []).map((capture) => capture.file_id));
  for (const file of data.files ?? []) {
    if (!file.document_code) continue;
    const kind = file.category === "drawing" ? "drawing" : captureFileIds.has(file.id) ? "photo" : "file";
    found.push(entry(kind, file.id, file.document_code, file.original_name, file.category));
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
