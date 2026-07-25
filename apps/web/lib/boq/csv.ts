export type BoqImportItem = {
  code: string;
  description: string;
  quantity: number | null;
  unit: string;
  unit_rate: number | null;
  contract_value: number | null;
  progress_percent: number;
  source_row: number;
};

const aliases: Record<keyof Omit<BoqImportItem, "source_row">, string[]> = {
  code: ["code", "item", "item_code", "post", "postnummer", "nr", "nummer"],
  description: ["description", "omschrijving", "beschrijving", "werk", "item_description"],
  quantity: ["quantity", "qty", "hoeveelheid", "aantal"],
  unit: ["unit", "eenheid"],
  unit_rate: ["unit_rate", "rate", "prijs", "eenheidsprijs", "unitprice"],
  contract_value: ["contract_value", "value", "bedrag", "contractbedrag", "totaal"],
  progress_percent: ["progress_percent", "progress", "voortgang", "voortgang_%", "percentage"],
};

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
}

function parseLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else cell += character;
  }
  cells.push(cell.trim());
  return cells;
}

function numeric(value: string, row: number, field: string, optional: boolean) {
  const cleaned = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned && optional) return null;
  const number = Number(cleaned || "0");
  if (!Number.isFinite(number)) throw new Error(`Rij ${row}: ${field} moet een getal zijn.`);
  return number;
}

export function parseBoqCsv(text: string): BoqImportItem[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Het BOQ-bestand moet een kopregel en minimaal één gegevensrij bevatten.");
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = parseLine(lines[0], delimiter).map(normalizedHeader);
  const indexFor = (field: keyof Omit<BoqImportItem, "source_row">) => headers.findIndex((header) => aliases[field].includes(header));
  const indexes = {
    code: indexFor("code"), description: indexFor("description"), quantity: indexFor("quantity"),
    unit: indexFor("unit"), unit_rate: indexFor("unit_rate"), contract_value: indexFor("contract_value"),
    progress_percent: indexFor("progress_percent"),
  };
  if (indexes.code < 0 || indexes.description < 0) throw new Error("De BOQ-kopregel moet minimaal code/item en description/omschrijving bevatten.");
  if (lines.length - 1 > 5000) throw new Error("Een BOQ-import mag maximaal 5000 regels bevatten.");

  return lines.slice(1).map((line, position) => {
    const row = position + 2;
    const cells = parseLine(line, delimiter);
    const cell = (index: number) => index < 0 ? "" : (cells[index] ?? "");
    const code = cell(indexes.code).trim();
    const description = cell(indexes.description).trim();
    if (!code || description.length < 3) throw new Error(`Rij ${row}: code en omschrijving zijn verplicht.`);
    const progress = numeric(cell(indexes.progress_percent), row, "voortgang", true) ?? 0;
    if (progress < 0 || progress > 100) throw new Error(`Rij ${row}: voortgang moet tussen 0 en 100 liggen.`);
    return {
      code,
      description,
      quantity: numeric(cell(indexes.quantity), row, "hoeveelheid", true),
      unit: cell(indexes.unit).trim(),
      unit_rate: numeric(cell(indexes.unit_rate), row, "eenheidsprijs", true),
      contract_value: numeric(cell(indexes.contract_value), row, "contractbedrag", true),
      progress_percent: progress,
      source_row: row,
    };
  });
}

export function downloadBoqCsvTemplate() {
  const content = "code;omschrijving;hoeveelheid;eenheid;eenheidsprijs;contractbedrag;voortgang_%\nBOQ-001;Voorbeeld werkpakket;100;m2;25.50;2550;0\n";
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "CODECO-BOQ-importsjabloon.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
