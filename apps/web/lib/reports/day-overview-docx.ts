import { Document, ImageRun, Paragraph, type Table, TextRun } from "docx";
import type { DayExportDocument } from "@/lib/reports/day-overview-export";
import {
  brandHeader,
  brandMuted,
  dataTable,
  documentFooter,
  downloadDocxBlob,
  loadLogoImageBytes,
  metadataTable,
  sectionHeading,
  signatureBlock,
  signatureImageBytes,
} from "@/lib/reports/docx-shared";

const line = (text: string, options: { bold?: boolean; muted?: boolean; size?: number; after?: number } = {}) => new Paragraph({
  children: [new TextRun({ text: text || " ", bold: options.bold, color: options.muted ? brandMuted : undefined, size: options.size ?? 18 })],
  spacing: { after: options.after ?? 60 },
});

/** The same day report as the PDF, as a Word file the user can still edit and forward. */
export function buildDayExportDocx(document: DayExportDocument, logoBytes: ArrayBuffer, emptyLabel: string): Document {
  const body: Array<Paragraph | Table> = [];
  body.push(metadataTable(document.head, 3));
  body.push(line("", { after: 120 }));
  // Every form with its count, the way the PDF opens.
  body.push(dataTable(["", ""], document.sections.map((section) => [section.title, String(section.count)]), [80, 20]));

  for (const section of document.sections) {
    body.push(sectionHeading(`${section.title} · ${section.count}`));
    const hasContent = Boolean(section.items.length || section.table || section.photos?.length || section.summary);
    if (!hasContent) body.push(line(emptyLabel, { muted: true }));
    if (section.summary) body.push(line(section.summary, { bold: true }));
    if (section.table) body.push(dataTable(section.table.columns, section.table.rows, [80, 20]));
    for (const item of section.items) {
      if (item.code) body.push(line(item.code, { muted: true, size: 16, after: 20 }));
      body.push(new Paragraph({
        children: [
          new TextRun({ text: item.title || "—", bold: true, size: 20 }),
          new TextRun({ text: item.status ? `   ${item.status}` : "", color: brandMuted, size: 16 }),
        ],
        spacing: { after: 60 },
      }));
      for (const [label, value] of item.facts) {
        body.push(new Paragraph({
          children: [new TextRun({ text: `${label}: `, bold: true, color: brandMuted, size: 18 }), new TextRun({ text: value, size: 18 })],
          spacing: { after: 40 },
        }));
      }
      if (item.signatures.length) {
        body.push(signatureBlock(item.signatures.slice(0, 4).map((signature): [string, string, (string | null)?] => [
          signature.label,
          [signature.name, signature.signedAt].filter(Boolean).join(" · "),
          signature.image,
        ])));
      }
      body.push(line("", { after: 120 }));
    }
    for (const photo of section.photos ?? []) {
      const bytes = signatureImageBytes(photo.image);
      if (bytes) body.push(new Paragraph({ children: [new ImageRun({ type: "jpg", data: bytes, transformation: { width: 240, height: 180 } })], spacing: { after: 40 } }));
      body.push(line(photo.title, { bold: true, after: 20 }));
      if (photo.meta) body.push(line(photo.meta, { muted: true, size: 16, after: 120 }));
    }
  }
  if (document.emptyNote) body.push(line(document.emptyNote, { muted: true }));

  return new Document({
    title: `${document.title} · ${document.subtitle}`,
    creator: "CODECO N.V.",
    sections: [{
      footers: { default: documentFooter(document.footer) },
      children: [...brandHeader(logoBytes, document.title, document.subtitle), ...body],
    }],
  });
}

export async function downloadDayExportDocx(document: DayExportDocument, emptyLabel: string) {
  const logo = await loadLogoImageBytes();
  await downloadDocxBlob(buildDayExportDocx(document, logo, emptyLabel), `${document.fileName}.docx`);
}
