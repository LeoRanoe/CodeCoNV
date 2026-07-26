import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const [sourceDirectory, outputDirectory] = process.argv.slice(2);
if (!sourceDirectory || !outputDirectory) {
  throw new Error("Usage: inspect_workbooks.mjs <source_dir> <output_dir>");
}

await fs.mkdir(outputDirectory, { recursive: true });

function safeName(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

const sourceFiles = (await fs.readdir(sourceDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && [".xlsx", ".xls"].includes(path.extname(entry.name).toLowerCase()))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

const output = [];

for (const fileName of sourceFiles) {
  const sourcePath = path.join(sourceDirectory, fileName);
  const workbookRecord = {
    file: fileName,
    sourcePath,
    importError: null,
    summary: null,
    sheets: [],
  };

  try {
    const input = await FileBlob.load(sourcePath);
    const workbook = await SpreadsheetFile.importXlsx(input);
    const summary = await workbook.inspect({
      kind: "workbook,sheet,table,drawing,definedName",
      maxChars: 12000,
      tableMaxRows: 8,
      tableMaxCols: 12,
      tableMaxCellChars: 120,
    });
    workbookRecord.summary = summary.ndjson;

    for (const sheet of workbook.worksheets.items) {
      const usedRange = sheet.getUsedRange();
      const values = usedRange ? usedRange.values : [];
      const formulas = usedRange ? usedRange.formulas : [];
      const sheetRecord = {
        name: sheet.name,
        usedAddress: usedRange?.address ?? null,
        rowCount: Array.isArray(values) ? values.length : 0,
        columnCount:
          Array.isArray(values) && Array.isArray(values[0]) ? values[0].length : 0,
        values,
        formulas,
        renderPath: null,
        renderError: null,
      };

      try {
        const preview = await workbook.render({
          sheetName: sheet.name,
          autoCrop: "all",
          scale: 1.5,
          format: "png",
        });
        const previewPath = path.join(
          outputDirectory,
          `${safeName(path.parse(fileName).name)}--${safeName(sheet.name)}.png`,
        );
        await fs.writeFile(
          previewPath,
          new Uint8Array(await preview.arrayBuffer()),
        );
        sheetRecord.renderPath = previewPath;
      } catch (error) {
        sheetRecord.renderError = error instanceof Error ? error.message : String(error);
      }

      workbookRecord.sheets.push(sheetRecord);
    }
  } catch (error) {
    workbookRecord.importError = error instanceof Error ? error.message : String(error);
  }

  output.push(workbookRecord);
}

const outputPath = path.join(outputDirectory, "workbook-context.json");
await fs.writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");
console.log(
  JSON.stringify(
    output.map((workbook) => ({
      file: workbook.file,
      importError: workbook.importError,
      sheets: workbook.sheets.map((sheet) => ({
        name: sheet.name,
        usedAddress: sheet.usedAddress,
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount,
        renderPath: sheet.renderPath,
        renderError: sheet.renderError,
      })),
    })),
    null,
    2,
  ),
);
