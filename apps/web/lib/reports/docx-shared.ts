import { downloadBlob } from "@/lib/browser/download";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IBorderOptions,
} from "docx";

export const brandTeal = "0D8885";
export const brandDarkTeal = "123747";
export const brandMuted = "5C7480";
export const brandBorder = "D9E5E9";
export const brandSectionFill = "EDF8F7";
export const brandSectionText = "0D7372";

export async function loadLogoImageBytes(logoSource = "/codeco-logo-pdf.png"): Promise<ArrayBuffer> {
  const response = await fetch(logoSource);
  return response.arrayBuffer();
}

export function brandHeader(imageBytes: ArrayBuffer, title: string, subtitle?: string): Paragraph[] {
  const paragraphs = [
    new Paragraph({
      children: [
        new ImageRun({ type: "png", data: imageBytes, transformation: { width: 67, height: 31 } }),
        new TextRun({ text: "   CONSTRUCTIESUPERVISIE", bold: true, color: brandTeal, size: 18 }),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: title, bold: true, color: brandDarkTeal })],
      spacing: { after: subtitle ? 60 : 200 },
    }),
  ];
  if (subtitle) {
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: subtitle, color: brandMuted, size: 18 })], spacing: { after: 240 } }));
  }
  return paragraphs;
}

export function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    shading: { type: ShadingType.CLEAR, fill: brandSectionFill },
    children: [new TextRun({ text: title, bold: true, color: brandSectionText, size: 22 })],
    spacing: { before: 200, after: 100 },
  });
}

export function labelValue(label: string, value: string | number | null | undefined): Paragraph {
  const displayValue = value === undefined || value === null || value === "" ? "Niet geregistreerd" : String(value);
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, color: brandMuted, size: 18 }),
      new TextRun({ text: displayValue, size: 18 }),
    ],
    spacing: { after: 80 },
  });
}

export function bodyText(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: text || "Niet geregistreerd", size: 18 })], spacing: { after: 120 } });
}

function standardBorder(): IBorderOptions {
  return { style: BorderStyle.SINGLE, size: 4, color: brandBorder };
}

function standardTableBorders() {
  const border = standardBorder();
  return { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
}

function gridCell(children: Paragraph[], widthPercent: number, shadeFill?: string): TableCell {
  return new TableCell({
    children,
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: shadeFill ? { type: ShadingType.CLEAR, fill: shadeFill } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  });
}

/** A bordered label/value grid, e.g. report metadata — mirrors the PDF templates' metadata cards. */
export function metadataTable(pairs: Array<[string, string]>, columns = 2): Table {
  const rows: TableRow[] = [];
  for (let index = 0; index < pairs.length; index += columns) {
    const chunk = pairs.slice(index, index + columns);
    const cells = chunk.map(([label, value]) => gridCell([
      new Paragraph({ children: [new TextRun({ text: label.toUpperCase(), bold: true, color: brandMuted, size: 14 })] }),
      new Paragraph({ children: [new TextRun({ text: value || "—", bold: true, color: brandDarkTeal, size: 18 })] }),
    ], 100 / columns));
    while (cells.length < columns) cells.push(gridCell([new Paragraph({ children: [] })], 100 / columns));
    rows.push(new TableRow({ children: cells }));
  }
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: standardTableBorders() });
}

/** A header row and body rows with column widths in percent; used for the report tables. */
export function dataTable(columns: string[], body: string[][], widths?: number[]): Table {
  const share = widths && widths.length === columns.length ? widths : columns.map(() => 100 / columns.length);
  const head = new TableRow({
    tableHeader: true,
    children: columns.map((column, index) => gridCell([
      new Paragraph({ children: [new TextRun({ text: column, bold: true, color: brandMuted, size: 15 })] }),
    ], share[index], brandSectionFill)),
  });
  const lines = body.map((row) => new TableRow({
    cantSplit: true,
    children: row.map((cell, index) => gridCell([new Paragraph({ children: [new TextRun({ text: cell || "—", size: 16 })] })], share[index])),
  }));
  return new Table({ rows: [head, ...lines], width: { size: 100, type: WidthType.PERCENTAGE }, borders: standardTableBorders() });
}

/**
 * A row of signature fields, each with the written signature — or a blank line to sign —
 * above the printed name; mirrors the PDF signature blocks.
 *
 * A signature that was written in the app travels as a small PNG data URL, which Word
 * needs as raw bytes before it can be placed on the signature line.
 */
export function signatureImageBytes(dataUrl: string | null | undefined): Uint8Array | null {
  const base64 = String(dataUrl ?? "").split(",")[1];
  if (!base64) return null;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

/** Each field is a label, the name under the line, and optionally the written signature. */
export function signatureBlock(fields: Array<[string, string, (string | null)?]>): Table {
  const cells = fields.map(([label, filledValue, ink]) => {
    const inkBytes = signatureImageBytes(ink);
    return gridCell([
      new Paragraph({ children: [new TextRun({ text: label.toUpperCase(), bold: true, color: brandMuted, size: 14 })] }),
      inkBytes
        ? new Paragraph({
          children: [new ImageRun({ type: "png", data: inkBytes, transformation: { width: 132, height: 46 } })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "555555" } },
          spacing: { before: 120, after: 60 },
        })
        : new Paragraph({
          children: [new TextRun({ text: " ", size: 18 })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "555555" } },
          spacing: { before: 360, after: 60 },
        }),
      new Paragraph({ children: [new TextRun({ text: filledValue || " ", size: 18 })] }),
    ], 100 / fields.length);
  });
  return new Table({ rows: [new TableRow({ children: cells })], width: { size: 100, type: WidthType.PERCENTAGE }, borders: standardTableBorders() });
}

export function documentFooter(text: string): Footer {
  return new Footer({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, color: brandMuted, size: 14 })] })],
  });
}

export async function downloadDocxBlob(doc: Document, filename: string): Promise<void> {
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, filename);
}
