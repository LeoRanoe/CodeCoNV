import JSZip from "jszip";

const spreadsheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageRelationships = "http://schemas.openxmlformats.org/package/2006/relationships";
const contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const xml = '<?xml version="1.0" encoding="UTF-8"?>';

function escapeXml(value) {
  const text = Array.from(String(value ?? "")).filter((character) => {
    const code = character.codePointAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code < 0xd800) || (code >= 0xe000 && code <= 0xfffd) || code >= 0x10000;
  }).join("");
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function columnName(index) {
  let name = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + (value - 1) % 26) + name;
  }
  return name;
}

/** @param {{ title: string, metadata: string[], headers: string[], rows: (string | number | null | undefined)[][] }} report */
export async function registerWorkbook({ title, metadata, headers, rows }) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  zip.file("_rels/.rels", `${xml}<Relationships xmlns="${packageRelationships}"><Relationship Id="rId1" Type="${relationships}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `${xml}<workbook xmlns="${spreadsheet}" xmlns:r="${relationships}"><sheets><sheet name="Register" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `${xml}<Relationships xmlns="${packageRelationships}"><Relationship Id="rId1" Type="${relationships}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);

  const headerRow = metadata.length + 3;
  const worksheet = [[title], ...metadata.map((line) => [line]), [], headers, ...rows];
  const sheetData = worksheet.map((values, index) => {
    const row = index + 1;
    const cells = values.map((value, column) => {
      const ref = columnName(column) + row;
      if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
      // Inline strings keep user-entered content literal, even if it starts with "=".
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join("");
    return `<row r="${row}">${cells}</row>`;
  }).join("");
  const columns = headers.map((name, index) => {
    const width = Math.max(15, Math.min(38, name.length + 8));
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");
  const views = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
  const range = `A${headerRow}:${columnName(headers.length - 1)}${worksheet.length}`;
  zip.file("xl/worksheets/sheet1.xml", `${xml}<worksheet xmlns="${spreadsheet}">${views}<cols>${columns}</cols><sheetData>${sheetData}</sheetData><autoFilter ref="${range}"/></worksheet>`);
  return zip.generateAsync({ type: "blob", mimeType: contentType, compression: "DEFLATE" });
}
