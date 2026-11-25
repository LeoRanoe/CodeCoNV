import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { checklistItemsFromRows, parseCsv, parseXlsx, readChecklistFile } from "../lib/checklists/import-checklist.mjs";
import { reportWorkbook } from "../lib/reports/register-xlsx.mjs";

test("a CSV with English headers becomes checklist items", () => {
  const rows = parseCsv('section,prompt,type,required,guidance,unit\nBefore pour,"Cover blocks, in place",Pass/Fail/NA,yes,"Minimum ""40"" mm",\nAfter pour,Slump,number,no,,mm\n');
  const { items, errors } = checklistItemsFromRows(rows);
  assert.deepEqual(errors, []);
  assert.deepEqual(items, [
    { prompt: "Cover blocks, in place", required: true, section: "Before pour", response_type: "pass_fail_na", guidance: 'Minimum "40" mm' },
    { prompt: "Slump", required: false, section: "After pour", response_type: "number", unit: "mm" },
  ]);
});

test("Dutch headers and a semicolon delimiter are understood", () => {
  const { items, errors } = checklistItemsFromRows(parseCsv("sectie;controlepunt;antwoord;verplicht\nBekisting;Maatvoering gecontroleerd;ja/nee/nvt;nee\n"));
  assert.deepEqual(errors, []);
  assert.deepEqual(items, [{ prompt: "Maatvoering gecontroleerd", required: false, section: "Bekisting", response_type: "yes_no_na" }]);
});

test("a sheet without a header row is one prompt per line", () => {
  const { items } = checklistItemsFromRows(parseCsv("Wapening gecontroleerd\nDekking gemeten\n"));
  assert.deepEqual(items.map((item) => item.prompt), ["Wapening gecontroleerd", "Dekking gemeten"]);
});

test("empty prompts, unknown types and over-long lists are reported, not guessed", () => {
  const bad = checklistItemsFromRows(parseCsv("prompt,type\n,text\nOk prompt,colour\n"));
  assert.equal(bad.items.length, 0);
  assert.equal(bad.errors.length, 2);
  const many = checklistItemsFromRows([["prompt"], ...Array.from({ length: 301 }, (_, index) => [`Check ${index + 100}`])]);
  assert.ok(many.errors.some((error) => error.includes("300")));
});

test("an xlsx made by the report workbook is read back, shared strings included", async () => {
  const bytes = await reportWorkbook({
    title: "Checklist", metadata: [],
    sheets: [{ name: "Checklist", headers: ["section", "prompt", "type", "required"], rows: [["A & B", "Surface <closed>", "text", "yes"], ["C", "Second item", "number", "no"]] }],
  });
  const rows = await parseXlsx(bytes);
  const { items, errors } = checklistItemsFromRows(rows.filter((row) => row.some((cell) => cell !== "")).slice(rows.findIndex((row) => row[1] === "prompt")));
  assert.deepEqual(errors, []);
  assert.equal(items[0].section, "A & B");
  assert.equal(items[0].prompt, "Surface <closed>");
  assert.equal(items[1].response_type, "number");
  assert.equal(items[1].required, false);
});

test("a hand-made xlsx with shared strings is read", async () => {
  const zip = new JSZip();
  zip.file("xl/sharedStrings.xml", '<sst><si><t>prompt</t></si><si><t>Cover is checked</t></si></sst>');
  zip.file("xl/worksheets/sheet1.xml", '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c></row></sheetData></worksheet>');
  const file = new File([await zip.generateAsync({ type: "uint8array" })], "list.xlsx");
  const { items, errors } = await readChecklistFile(file);
  assert.deepEqual(errors, []);
  assert.deepEqual(items.map((item) => item.prompt), ["Cover is checked"]);
  assert.deepEqual((await readChecklistFile(new File(["x"], "list.pdf"))).errors, ["Upload an .xlsx or .csv file."]);
});
