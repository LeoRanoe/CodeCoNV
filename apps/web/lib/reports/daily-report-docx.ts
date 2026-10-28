import { Document, Paragraph, type Table } from "docx";
import { buildDailyReportModel } from "@/lib/reports/daily-report-model";
import { reportMoment, reportRole } from "@/lib/reports/report-vocabulary";
import {
  bodyText,
  brandHeader,
  dataTable,
  documentFooter,
  downloadDocxBlob,
  labelValue,
  loadLogoImageBytes,
  metadataTable,
  sectionHeading,
  signatureBlock,
} from "@/lib/reports/docx-shared";
import { immutableDailySnapshot, type DailyReportPdfSnapshot, type FormalReportSnapshot, type ReportSignatureLine } from "@/lib/reports/daily-report-pdf";

/** Three signature columns; a role that has not signed keeps an empty line. */
function signatureFields(signatures: ReportSignatureLine[]): Array<[string, string, (string | null)?]> {
  const roles = signatures.length
    ? signatures.slice(0, 3)
    : [
      { name: "", role: "Supervisor", declaration: "", signedAt: "", legalLevel: "" },
      { name: "", role: "Aannemer", declaration: "", signedAt: "", legalLevel: "" },
      { name: "", role: "Opdrachtgever", declaration: "", signedAt: "", legalLevel: "" },
    ];
  return roles.map((signature) => [
    reportRole(signature.role),
    signature.name ? `${signature.name} · ${reportMoment(signature.signedAt)}` : "Nog niet ondertekend",
    // The signature that was written when the version was signed.
    signature.signatureImage ?? null,
  ]);
}

export function buildDailyReportDocxDocument(snapshot: DailyReportPdfSnapshot, logoBytes: ArrayBuffer): Document {
  const model = buildDailyReportModel(snapshot.records);
  const body: Array<Paragraph | Table> = [];
  for (const section of model.sections) {
    body.push(sectionHeading(`${section.number}. ${section.title}`));
    for (const [label, value] of section.facts ?? []) body.push(labelValue(label, value));
    for (const paragraph of section.paragraphs ?? []) body.push(bodyText(paragraph));
    for (const { caption, table } of section.tables ?? []) {
      if (caption) body.push(bodyText(caption));
      body.push(dataTable(table.columns, table.rows, table.widths));
    }
    if (section.signatures?.length) {
      body.push(signatureBlock(section.signatures.map((signature): [string, string, (string | null)?] => [signature.label, `${signature.name}${signature.signedAt ? ` · ${reportMoment(signature.signedAt)}` : ""}`, signature.image])));
    }
    if (section.empty && !section.tables?.length) body.push(bodyText(section.empty));
  }

  return new Document({
    title: `${snapshot.reportNumber} - ${snapshot.projectName}`,
    creator: "CODECO N.V.",
    sections: [
      {
        footers: { default: documentFooter("CODECO Supervisie · gegenereerd uit de centrale projectadministratie") },
        children: [
          ...brandHeader(logoBytes, "Dagrapport", snapshot.formal ? `Formele, onveranderbare revisie ${snapshot.formal.revision}` : "Conceptversie uit de actuele projectregistraties · nog niet vastgezet"),
          metadataTable(model.head, 3),
          sectionHeading("Kerncijfers"),
          metadataTable(model.kpis.map((kpi): [string, string] => [kpi.label, kpi.value]), 5),
          ...body,
          // Item 19 of the client's day report: control, name/position and signature.
          sectionHeading("19. Controle, naam/functie en ondertekening"),
          signatureBlock(signatureFields(snapshot.signatures ?? [])),
          ...(snapshot.signatures ?? []).map((signature) => bodyText(`${signature.name} · ${reportRole(signature.role)}: “${signature.declaration}”`)),
          bodyText(snapshot.formal
            ? `Dit Word-document is uitsluitend opgebouwd uit de onveranderbare momentopname van ${reportMoment(snapshot.formal.frozenAt)}. Volledige SHA-256: ${snapshot.formal.sha256}`
            : "Werkversie uit de actuele dagregistraties. De formele status staat in de rapporthistorie."),
        ],
      },
    ],
  });
}

export async function downloadDailyReportDocx(snapshot: DailyReportPdfSnapshot): Promise<void> {
  const logoBytes = await loadLogoImageBytes();
  const doc = buildDailyReportDocxDocument(snapshot, logoBytes);
  await downloadDocxBlob(doc, `${snapshot.reportNumber}${snapshot.draft ? "-concept" : ""}.docx`);
}

export async function downloadFormalReportDocx(snapshot: FormalReportSnapshot, revision: number, sha256: string, signatures: ReportSignatureLine[] = []): Promise<void> {
  const normalized = { ...immutableDailySnapshot(snapshot, revision, sha256), signatures };
  const logoBytes = await loadLogoImageBytes();
  const doc = buildDailyReportDocxDocument(normalized, logoBytes);
  await downloadDocxBlob(doc, `${normalized.reportNumber}-revisie-${revision}.docx`);
}
