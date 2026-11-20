import { ImageRun, Paragraph, TextRun } from "docx";
import type { SignoffHistoryEntry } from "@/lib/forms/signoff";
import { brandMuted, signatureImageBytes } from "@/lib/reports/docx-shared";

/** The chronological sign-off history of a record, for every Word file that prints the record. */
export function signoffHistoryDocx(history: SignoffHistoryEntry[], title = "Sign-off history"): Paragraph[] {
  if (!history.length) return [];
  const out: Paragraph[] = [new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 18 })], spacing: { before: 120, after: 40 } })];
  for (const entry of history) {
    out.push(new Paragraph({ children: [new TextRun({ text: entry.line, size: 16 })], spacing: { after: 20 } }));
    if (entry.comments) out.push(new Paragraph({ children: [new TextRun({ text: entry.comments, color: brandMuted, size: 16 })], spacing: { after: 20 } }));
    const ink = signatureImageBytes(entry.signature);
    if (ink) out.push(new Paragraph({ children: [new ImageRun({ type: "png", data: ink, transformation: { width: 96, height: 32 } })], spacing: { after: 40 } }));
  }
  return out;
}
