import { Document, Paragraph } from "docx";
import {
  bodyText,
  brandHeader,
  documentFooter,
  downloadDocxBlob,
  labelValue,
  loadLogoImageBytes,
  metadataTable,
  sectionHeading,
  signatureBlock,
} from "@/lib/reports/docx-shared";
import { immutableDailySnapshot, type DailyReportPdfSnapshot, type FormalReportSnapshot, type ReportSignatureLine } from "@/lib/reports/daily-report-pdf";

function section(title: string, ...body: Paragraph[]): Paragraph[] {
  return [sectionHeading(title), ...body];
}

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
    signature.role.replaceAll("_", " "),
    signature.name ? `${signature.name} · ${signature.signedAt.slice(0, 16).replace("T", " ")}` : "Nog niet ondertekend",
    // The signature that was written when the version was signed.
    signature.signatureImage ?? null,
  ]);
}

export function buildDailyReportDocxDocument(snapshot: DailyReportPdfSnapshot, logoBytes: ArrayBuffer): Document {
  const { projectStart: start, closeout } = snapshot;
  const metadata: Array<[string, string]> = [
    ["Rapport", snapshot.reportNumber],
    ["Datum", snapshot.reportDate],
    ["Project", `${snapshot.projectCode} · ${snapshot.projectName}`],
    ["Gebouw", snapshot.buildingName],
    ["Locatie", snapshot.location],
    ["Supervisor", snapshot.supervisorName],
  ];
  if (snapshot.formal) metadata.push(["Snapshot SHA-256", `${snapshot.formal.sha256.slice(0, 16)}…`]);

  const buildingSections = snapshot.buildings?.length
    ? [
        sectionHeading("Dagrapport · per gebouw"),
        ...snapshot.buildings.flatMap((building) => [
          sectionHeading(building.name),
          labelValue("Weer", `${building.projectStart.weatherCondition}; ${building.projectStart.temperatureC} °C`),
          labelValue("Werk lopend", building.closeout.workOngoing || "Niet geregistreerd"),
          labelValue("Werk afgerond", building.closeout.workPerformed),
          labelValue("Voortgang", `${building.closeout.progressPercent}%`),
          labelValue("Kwaliteit", building.closeout.qualityIssues === "yes" ? building.closeout.qualityDetails : "Geen afwijking gemeld"),
          labelValue("HSE", building.closeout.hseEvent === "none" ? "Geen incident of near miss gemeld" : building.closeout.hseDetails),
          labelValue("Vertraging", building.closeout.delayCause === "none" ? "Geen vertraging" : `${building.closeout.delayCause}; ${building.closeout.delayHours} uur · ${building.closeout.delayReason || "geen reden"}`),
          ...(building.closeout.contractorSignedBy ? [signatureBlock([["Aannemer", `${building.closeout.contractorSignedBy} · ${building.closeout.contractorCompany || ""} · ${building.closeout.contractorSignedAt?.slice(0, 16).replace("T", " ") || ""}`, building.closeout.contractorSignatureImage ?? null]])] : []),
          labelValue("Planning morgen", building.closeout.tomorrowPlan),
        ]),
      ]
    : [];

  return new Document({
    title: `${snapshot.reportNumber} - ${snapshot.projectName}`,
    creator: "CODECO N.V.",
    sections: [
      {
        footers: { default: documentFooter("CODECO Supervisie · gegenereerd uit de centrale projectadministratie") },
        children: [
          ...brandHeader(logoBytes, "Dagrapport", snapshot.formal ? `Formele immutable revisie ${snapshot.formal.revision}` : "Vaste, controleerbare samenvatting uit bevestigde projectregistraties"),
          metadataTable(metadata, 3),
          ...section("1. Projectinformatie, weer en werkuren",
            labelValue("Weer", `${start.weatherCondition}; ${start.temperatureC} °C; wind ${start.windCondition}`),
            labelValue("Werkuren", `${start.shiftStart}–${start.shiftEnd}`),
            labelValue("Verwachte bezetting", start.expectedWorkers),
          ),
          ...section("2. Samenvatting van de dag", bodyText(closeout.daySummary)),
          ...section("3–4. Aanwezigheid, werkzaamheden en voortgang",
            labelValue("Aanwezig", `${snapshot.attendanceTotal} personen`),
            labelValue("Werk lopend", closeout.workOngoing || "Niet geregistreerd"),
            labelValue("Werk afgerond", closeout.workPerformed),
            labelValue("Voortgang", `${closeout.progressPercent}%`),
          ),
          ...section("5–7. Inspecties, kwaliteit en HSE",
            labelValue("Inspecties", closeout.inspectionResult),
            labelValue("Kwaliteit", closeout.qualityIssues === "yes" ? closeout.qualityDetails : "Geen afwijking gemeld"),
            labelValue("HSE", closeout.hseEvent === "none" ? "Geen incident of near miss gemeld" : closeout.hseDetails),
          ),
          ...section("8–12. Materieel, leveringen, testen, wijzigingen en vertraging",
            labelValue("Materieel", closeout.equipmentStatus),
            labelValue("Leveringen", closeout.deliveries),
            labelValue("Testen/meten", closeout.testsMeasurements),
            labelValue("Wijzigingswerk", closeout.variationWork),
            labelValue("Vertraging", closeout.delayCause === "none" ? "Geen vertraging" : `${closeout.delayCause}; ${closeout.delayHours} uur`),
            ...(closeout.delayCause !== "none" ? [
              labelValue("Reden vertraging", closeout.delayReason),
              labelValue("Aannemersbedrijf", closeout.contractorCompany),
            ] : []),
          ),
          ...(closeout.delayCause !== "none" ? [signatureBlock([["Handtekening aannemer", `${closeout.contractorSignedBy || ""} · ${closeout.contractorSignedAt?.slice(0, 16).replace("T", " ") || ""}`, closeout.contractorSignatureImage ?? null]])] : []),
          ...section("13–16. Communicatie, acties, risico's en morgen",
            labelValue("Communicatie", closeout.communication),
            labelValue("Registraties", `${snapshot.registrationCount} dagregistraties`),
            labelValue("Risico's", closeout.risks),
            labelValue("Planning morgen", closeout.tomorrowPlan),
          ),
          ...section("17–18. Foto's en bijlagen",
            labelValue("Foto's", closeout.photoCount),
            labelValue("Bijlagen", closeout.attachmentsConfirmed ? "Door supervisor gecontroleerd" : "Nog niet bevestigd"),
            bodyText(snapshot.formal
              ? `Dit Word-document is uitsluitend opgebouwd uit de immutable snapshot van ${snapshot.formal.frozenAt}. Volledige SHA-256: ${snapshot.formal.sha256}`
              : "Werkversie uit bevestigde dagregistraties. Formele status staat in de rapporthistorie."),
          ),
          // Item 19 of the client's day report: control, name/position and signature.
          sectionHeading("19. Controle, naam/functie en ondertekening"),
          signatureBlock(signatureFields(snapshot.signatures ?? [])),
          ...(snapshot.signatures ?? []).map((signature) => bodyText(`${signature.name} · ${signature.role.replaceAll("_", " ")}: “${signature.declaration}”`)),
          ...buildingSections,
        ],
      },
    ],
  });
}

export async function downloadDailyReportDocx(snapshot: DailyReportPdfSnapshot): Promise<void> {
  const logoBytes = await loadLogoImageBytes();
  const doc = buildDailyReportDocxDocument(snapshot, logoBytes);
  await downloadDocxBlob(doc, `${snapshot.reportNumber}.docx`);
}

export async function downloadFormalReportDocx(snapshot: FormalReportSnapshot, revision: number, sha256: string, signatures: ReportSignatureLine[] = []): Promise<void> {
  const normalized = { ...immutableDailySnapshot(snapshot, revision, sha256), signatures };
  const logoBytes = await loadLogoImageBytes();
  const doc = buildDailyReportDocxDocument(normalized, logoBytes);
  await downloadDocxBlob(doc, `${normalized.reportNumber}-revisie-${revision}.docx`);
}
