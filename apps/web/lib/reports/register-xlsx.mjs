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
  return reportWorkbook({ title, metadata, sheets: [{ name: "Register", headers, rows }] });
}

/** Points per pixel: Excel row heights are in points, pictures in pixels. */
const pointsPerPixel = 0.75;
const emuPerPixel = 9525;

/**
 * A picture anchored in a data cell: `row` counts the data rows from 0, `column` from 0; width and height are pixels.
 * @typedef {{ row: number, column: number, bytes: Uint8Array, extension: "jpeg" | "png", width: number, height: number, name?: string }} SheetImage
 */

/**
 * @param {string} title
 * @param {string[]} metadata
 * @param {string[]} headers
 * @param {(string | number | null | undefined)[][]} rows
 * @param {{ images?: SheetImage[] }} [extra]
 */
function sheetXml(title, metadata, headers, rows, extra = {}) {
  const images = extra.images ?? [];
  const headerRow = metadata.length + 3;
  const worksheet = [[title], ...metadata.map((line) => [line]), [], headers, ...rows];
  // A row that holds a picture is as tall as the picture.
  const heights = new Map();
  for (const image of images) {
    const sheetRow = headerRow + 1 + image.row;
    heights.set(sheetRow, Math.max(heights.get(sheetRow) ?? 0, Math.ceil(image.height * pointsPerPixel) + 6));
  }
  const sheetData = worksheet.map((values, index) => {
    const row = index + 1;
    const cells = values.map((value, column) => {
      const ref = columnName(column) + row;
      if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
      // Inline strings keep user-entered content literal, even if it starts with "=".
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join("");
    const height = heights.get(row);
    return `<row r="${row}"${height ? ` ht="${height}" customHeight="1"` : ""}>${cells}</row>`;
  }).join("");
  const pictureColumns = new Map();
  for (const image of images) pictureColumns.set(image.column, Math.max(pictureColumns.get(image.column) ?? 0, image.width));
  const columnCount = Math.max(headers.length, ...[...pictureColumns.keys()].map((column) => column + 1));
  const columns = Array.from({ length: columnCount }, (_, index) => {
    const name = headers[index] ?? "";
    const width = pictureColumns.has(index) ? Math.ceil(pictureColumns.get(index) / 7) + 2 : Math.max(15, Math.min(38, name.length + 8));
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");
  const views = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
  const range = `A${headerRow}:${columnName(Math.max(0, headers.length - 1))}${worksheet.length}`;
  return `${xml}<worksheet xmlns="${spreadsheet}" xmlns:r="${relationships}">${views}<cols>${columns}</cols><sheetData>${sheetData}</sheetData><autoFilter ref="${range}"/>${images.length ? '<drawing r:id="rId1"/>' : ""}</worksheet>`;
}

function drawingXml(images, headerRow) {
  const anchors = images.map((image, index) => `<xdr:oneCellAnchor><xdr:from><xdr:col>${image.column}</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>${headerRow + image.row}</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from><xdr:ext cx="${image.width * emuPerPixel}" cy="${image.height * emuPerPixel}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${index + 2}" name="${escapeXml(image.name ?? `Photo ${index + 1}`)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${index + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${image.width * emuPerPixel}" cy="${image.height * emuPerPixel}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`).join("");
  return `${xml}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${relationships}">${anchors}</xdr:wsDr>`;
}

/** Excel sheet names: at most 31 characters, none of []:*?/\, unique within the workbook. */
function sheetName(name, used) {
  const base = String(name || "Sheet").replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet";
  let candidate = base;
  for (let index = 2; used.has(candidate.toLowerCase()); index += 1) candidate = `${base.slice(0, 27)} (${index})`;
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * A native workbook with one sheet per section, each headed by the report title and its metadata
 * (period, cut-off, filters, generation time: Word 11).
 * @param {{ title: string, metadata: string[], sheets: { name: string, headers: string[], rows: (string | number | null | undefined)[][], images?: SheetImage[] }[] }} report
 */
export async function reportWorkbook({ title, metadata, sheets }) {
  const zip = new JSZip();
  const used = new Set();
  const named = sheets.map((sheet) => ({ ...sheet, name: sheetName(sheet.name, used) }));
  const drawings = [];
  named.forEach((sheet, index) => { if (sheet.images?.length) drawings.push({ sheet: index + 1, drawing: drawings.length + 1, images: sheet.images }); });
  const extensions = new Set(drawings.flatMap((drawing) => drawing.images.map((image) => image.extension)));
  const overrides = named.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")
    + drawings.map((drawing) => `<Override PartName="/xl/drawings/drawing${drawing.drawing}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join("");
  const imageTypes = [...extensions].map((extension) => `<Default Extension="${extension}" ContentType="image/${extension}"/>`).join("");
  zip.file("[Content_Types].xml", `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${imageTypes}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`);
  zip.file("_rels/.rels", `${xml}<Relationships xmlns="${packageRelationships}"><Relationship Id="rId1" Type="${relationships}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `${xml}<workbook xmlns="${spreadsheet}" xmlns:r="${relationships}"><sheets>${named.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `${xml}<Relationships xmlns="${packageRelationships}">${named.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${relationships}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}</Relationships>`);
  named.forEach((sheet, index) => {
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, sheetXml(title, metadata, sheet.headers, sheet.rows, { images: sheet.images }));
  });
  let mediaNumber = 0;
  for (const drawing of drawings) {
    const headerRow = metadata.length + 3;
    zip.file(`xl/worksheets/_rels/sheet${drawing.sheet}.xml.rels`, `${xml}<Relationships xmlns="${packageRelationships}"><Relationship Id="rId1" Type="${relationships}/drawing" Target="../drawings/drawing${drawing.drawing}.xml"/></Relationships>`);
    zip.file(`xl/drawings/drawing${drawing.drawing}.xml`, drawingXml(drawing.images, headerRow));
    const rels = drawing.images.map((image, index) => {
      mediaNumber += 1;
      zip.file(`xl/media/image${mediaNumber}.${image.extension}`, image.bytes);
      return `<Relationship Id="rId${index + 1}" Type="${relationships}/image" Target="../media/image${mediaNumber}.${image.extension}"/>`;
    }).join("");
    zip.file(`xl/drawings/_rels/drawing${drawing.drawing}.xml.rels`, `${xml}<Relationships xmlns="${packageRelationships}">${rels}</Relationships>`);
  }
  return zip.generateAsync({ type: "blob", mimeType: contentType, compression: "DEFLATE" });
}
