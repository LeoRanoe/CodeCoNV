import JSZip from "jszip";

// Developer package v5 (25-11-2026), Word 3 / 13: the Project Admin uploads own checklists (xlsx / csv).
// Columns: section, prompt (required), type, required, guidance, unit. Column names are matched in
// English and Dutch; a sheet without a header row is read as one prompt per line in the first column.

const columnAliases = {
  section: ["section", "sectie", "onderdeel", "group", "groep"],
  prompt: ["prompt", "item", "checkpoint", "controlepunt", "vraag", "omschrijving", "description", "check"],
  type: ["type", "answer", "answer type", "antwoord", "antwoordtype", "response"],
  required: ["required", "mandatory", "verplicht"],
  guidance: ["guidance", "help", "toelichting", "instructie", "note", "opmerking"],
  unit: ["unit", "eenheid"],
};

const typeAliases = {
  pass_fail_na: ["pass_fail_na", "pass/fail/na", "pass / fail / n/a", "pass fail na", "pass-fail", "pass/fail", "goed/fout/nvt", "akkoord/niet akkoord/nvt"],
  yes_no_na: ["yes_no_na", "yes/no/na", "yes / no / n/a", "yes no na", "ja/nee/nvt", "ja / nee / nvt"],
  number: ["number", "numeric", "getal", "meting", "measurement"],
  text: ["text", "tekst", "free text", "vrije tekst"],
};

const falseWords = new Set(["no", "nee", "n", "false", "0", "optional", "optioneel"]);

function normalise(value) {
  return String(value ?? "").replace(/^﻿/, "").trim().toLowerCase();
}

function columnKey(header) {
  const name = normalise(header);
  return Object.keys(columnAliases).find((key) => columnAliases[key].includes(name)) ?? null;
}

function answerType(value) {
  const name = normalise(value);
  if (!name) return undefined;
  return Object.keys(typeAliases).find((key) => typeAliases[key].includes(name)) ?? "invalid";
}

/** Parses CSV text (comma or semicolon, quoted fields, doubled quotes) into rows of strings. */
export function parseCsv(text) {
  const source = String(text ?? "").replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === delimiter) { row.push(field); field = ""; }
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += character;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

function textOf(fragment) {
  return [...fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join("");
}

function columnIndex(reference) {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? "A";
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

/** Reads the first worksheet of an .xlsx file into rows of strings (shared and inline strings, numbers). */
export async function parseXlsx(buffer) {
  const zip = await JSZip.loadAsync(typeof buffer?.arrayBuffer === "function" ? await buffer.arrayBuffer() : buffer);
  const shared = [];
  const sharedFile = zip.file("xl/sharedStrings.xml");
  if (sharedFile) {
    const xml = await sharedFile.async("string");
    for (const match of xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)) shared.push(textOf(match[1]));
  }
  const sheetName = Object.keys(zip.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))[0];
  if (!sheetName) throw new Error("The workbook has no worksheet.");
  const xml = await zip.file(sheetName).async("string");
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1];
      const body = cellMatch[2] ?? "";
      const reference = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1] ?? "A1";
      const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1])] ?? "";
      else if (type === "inlineStr") value = textOf(body);
      else value = decodeXml(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
      cells[columnIndex(reference)] = value;
    }
    const filled = Array.from(cells, (cell) => cell ?? "");
    if (filled.some((cell) => cell.trim() !== "")) rows.push(filled);
  }
  return rows;
}

/**
 * Turns sheet rows into checklist items. Returns `{ items, errors }`; `errors` lists row problems and an
 * upload with errors must not be sent. At most 300 items, matching the database.
 */
export function checklistItemsFromRows(rows) {
  const errors = [];
  if (!rows.length) return { items: [], errors: ["The file has no rows."] };
  const header = rows[0].map(columnKey);
  const hasHeader = header.includes("prompt");
  const body = hasHeader ? rows.slice(1) : rows;
  const map = hasHeader ? header : ["prompt"];
  const items = [];
  body.forEach((cells, offset) => {
    const rowNumber = offset + (hasHeader ? 2 : 1);
    const value = (key) => {
      const position = map.indexOf(key);
      return position < 0 ? "" : String(cells[position] ?? "").trim();
    };
    const prompt = value("prompt");
    if (!prompt) { errors.push(`Row ${rowNumber}: the prompt is empty.`); return; }
    if (prompt.length < 3 || prompt.length > 500) { errors.push(`Row ${rowNumber}: a prompt needs 3 to 500 characters.`); return; }
    const type = answerType(value("type"));
    if (type === "invalid") { errors.push(`Row ${rowNumber}: unknown answer type "${value("type")}".`); return; }
    const requiredText = normalise(value("required"));
    const item = { prompt, required: requiredText ? !falseWords.has(requiredText) : true };
    if (value("section")) item.section = value("section");
    if (type) item.response_type = type;
    if (value("guidance")) item.guidance = value("guidance");
    if (value("unit")) item.unit = value("unit");
    items.push(item);
  });
  if (items.length > 300) errors.push("A checklist holds at most 300 items.");
  if (!items.length && !errors.length) errors.push("The file has no checklist items.");
  return { items, errors };
}

/** Reads an uploaded .xlsx or .csv file (a File or Blob) into checklist items. */
export async function readChecklistFile(file) {
  const name = String(file.name ?? "").toLowerCase();
  const rows = name.endsWith(".xlsx")
    ? await parseXlsx(await file.arrayBuffer())
    : name.endsWith(".csv") || name.endsWith(".txt")
      ? parseCsv(await file.text())
      : null;
  if (!rows) return { items: [], errors: ["Upload an .xlsx or .csv file."] };
  return checklistItemsFromRows(rows);
}
