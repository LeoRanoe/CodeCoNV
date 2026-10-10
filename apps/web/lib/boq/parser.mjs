const aliases = {
  code: ["code", "item", "item_code", "post", "postnummer", "nr", "nummer"],
  description: ["description", "omschrijving", "beschrijving", "werk", "item_description"],
  quantity: ["quantity", "qty", "hoeveelheid", "aantal"], unit: ["unit", "eenheid"],
  unit_rate: ["unit_rate", "rate", "prijs", "eenheidsprijs", "unitprice"],
  contract_value: ["contract_value", "value", "bedrag", "contractbedrag", "totaal"],
  progress_percent: ["progress_percent", "progress", "voortgang", "voortgang_%", "percentage"],
};
function rowsFromCsv(text, delimiter) {
  const rows = [];
  let cells = [], cell = "", quoted = false, closed = false, line = 1, sourceRow = 1;
  const finishCell = () => { cells.push(cell.trim()); cell = ""; closed = false; };
  const finishRow = () => {
    finishCell();
    if (cells.some((value) => value)) rows.push({ cells, row: sourceRow });
    if (rows.length > 5001) throw new Error("Een BOQ-import mag maximaal 5000 regels bevatten.");
    cells = [];
  };
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (quoted) {
      if (ch === '"') {
        if (text[index + 1] === '"') { cell += '"'; index += 1; }
        else { quoted = false; closed = true; }
      } else { cell += ch; if (ch === "\n") line += 1; }
    } else if (ch === '"') {
      if (cell.trim() || closed) throw new Error(`Rij ${line}: ongeldig aanhalingsteken.`);
      quoted = true;
    } else if (ch === delimiter) finishCell();
    else if (ch === "\n" || ch === "\r") {
      finishRow();
      if (ch === "\r" && text[index + 1] === "\n") index += 1;
      line += 1; sourceRow = line;
    } else {
      if (closed && ch.trim()) throw new Error(`Rij ${line}: tekst na afsluitend aanhalingsteken.`);
      cell += ch;
    }
  }
  if (quoted) throw new Error(`Rij ${sourceRow}: ontbrekend afsluitend aanhalingsteken.`);
  if (cell || cells.length) finishRow();
  return rows;
}
function numeric(value, row, field) {
  const clean = value.replace(/\s/g, "").replace(",", ".");
  if (!clean) return null;
  const number = Number(clean);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(clean) || !Number.isFinite(number)) throw new Error(`Rij ${row}: ${field} moet een getal zijn.`);
  return number;
}
export function parseBoqCsv(text) {
  if (typeof text !== "string" || text.length > 5_000_000 || text.includes("\0")) throw new Error("Ongeldig of te groot CSV-bestand (maximaal 5 MB). Gebruik UTF-8.");
  text = text.replace(/^\uFEFF/, "");
  // Determine the delimiter using only unquoted header separators.
  let quoted = false, commas = 0, semicolons = 0;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && (ch === "\r" || ch === "\n")) break;
    if (!quoted && ch === ",") commas += 1;
    if (!quoted && ch === ";") semicolons += 1;
  }
  const rows = rowsFromCsv(text, semicolons >= commas ? ";" : ",");
  if (rows.length < 2) throw new Error("Het BOQ-bestand moet een kopregel en minimaal één gegevensrij bevatten.");
  const headers = rows[0].cells.map((value) => value.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  const indexes = {};
  for (const [key, names] of Object.entries(aliases)) {
    const matching = headers.flatMap((header, index) => names.includes(header) ? [index] : []);
    if (matching.length > 1) throw new Error(`Dubbele BOQ-kolom: ${key}.`);
    indexes[key] = matching[0] ?? -1;
  }
  if (indexes.code < 0 || indexes.description < 0) throw new Error("De BOQ-kopregel moet minimaal code/item en description/omschrijving bevatten.");
  const seen = new Set();
  return rows.slice(1).map(({ cells, row }) => {
    if (cells.length !== headers.length) throw new Error(`Rij ${row}: aantal kolommen wijkt af van de kopregel.`);
    const value = (key) => indexes[key] < 0 ? "" : cells[indexes[key]];
    const code = value("code"), description = value("description");
    if (!code || description.length < 3) throw new Error(`Rij ${row}: code en omschrijving zijn verplicht.`);
    const identity = code.toLowerCase();
    if (seen.has(identity)) throw new Error(`Rij ${row}: dubbele BOQ-code ${code}.`);
    seen.add(identity);
    const progress = numeric(value("progress_percent"), row, "voortgang") ?? 0;
    if (progress < 0 || progress > 100) throw new Error(`Rij ${row}: voortgang moet tussen 0 en 100 liggen.`);
    return { code, description, quantity: numeric(value("quantity"), row, "hoeveelheid"), unit: value("unit"),
      unit_rate: numeric(value("unit_rate"), row, "eenheidsprijs"), contract_value: numeric(value("contract_value"), row, "contractbedrag"),
      progress_percent: progress, source_row: row };
  });
}
