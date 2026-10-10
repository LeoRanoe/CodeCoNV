import { z } from "zod";

export const yesNoSchema = z.enum(["yes", "no"]);

export function createProjectStartSchema(language: "en" | "nl" = "en") {
  const text = (english: string, dutch: string) => language === "en" ? english : dutch;
  return z
  .object({
    weatherCondition: z.enum(["sunny", "partly_cloudy", "cloudy", "rain", "heavy_rain"]),
    temperatureC: z.number().min(15, text("Check the temperature", "Controleer de temperatuur")).max(50, text("Check the temperature", "Controleer de temperatuur")),
    windCondition: z.enum(["calm", "moderate", "strong"]),
    shiftStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, text("Use hh:mm", "Gebruik uu:mm")),
    shiftEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, text("Use hh:mm", "Gebruik uu:mm")),
    plannedWork: z.string().trim().min(3, text("Choose the planned work", "Kies de geplande werkzaamheden")),
    expectedWorkers: z.number().int().min(0).max(10000),
    inspectionPlanned: yesNoSchema,
    highRiskWork: yesNoSchema,
    concreteWork: yesNoSchema,
    workPermit: z.enum(["available", "missing", "not_required"]),
    drawingStatus: z.enum(["approved", "missing", "not_required"]),
    drawingIssueReported: z.boolean(),
    riskNotes: z.string().trim().max(600).optional(),
  })
  .superRefine((answers, context) => {
    if (answers.shiftEnd <= answers.shiftStart) {
      context.addIssue({
        code: "custom",
        path: ["shiftEnd"],
        message: text("The end time must be after the start time", "De eindtijd moet na de starttijd liggen"),
      });
    }
    if (answers.drawingStatus === "missing" && !answers.drawingIssueReported) {
      context.addIssue({
        code: "custom",
        path: ["drawingIssueReported"],
        message: text("Confirm that the missing approved drawing was reported", "Bevestig dat de ontbrekende goedgekeurde tekening is gemeld"),
      });
    }
  });
}

export const projectStartSchema = createProjectStartSchema();

export type ProjectStartAnswers = z.infer<typeof projectStartSchema>;

export function createDailyCloseoutSchema(language: "en" | "nl" = "en") {
  const text = (english: string, dutch: string) => language === "en" ? english : dutch;
  return z
  .object({
    daySummary: z.string().trim().min(20, text("Describe how the day went in at least one complete sentence", "Beschrijf in minimaal één volledige zin hoe de dag is verlopen")).max(700),
    weatherSummary: z.string().trim().min(5, text("Describe the actual weather", "Beschrijf het werkelijke weer")).max(180),
    workOngoing: z.string().trim().max(1200).optional(),
    workPerformed: z.string().trim().min(10, text("Describe the work performed", "Beschrijf de uitgevoerde werkzaamheden")).max(1200),
    progressPercent: z.number().min(0).max(100),
    inspectionResult: z.enum(["none", "all_ok", "issues"]),
    qualityIssues: yesNoSchema,
    qualityDetails: z.string().trim().max(1000).optional(),
    hseEvent: z.enum(["none", "near_miss", "incident"]),
    hseDetails: z.string().trim().max(1000).optional(),
    equipmentStatus: z.string().trim().max(800).optional(),
    deliveries: z.string().trim().max(800).optional(),
    testsMeasurements: z.string().trim().max(1000).optional(),
    variationWork: z.enum(["none", "pending", "approved", "rejected"]),
    delayCause: z.enum(["none", "weather", "delivery", "material", "equipment", "other"]),
    delayHours: z.number().min(0).max(24),
    delayReason: z.string().trim().max(1500).optional(),
    contractorCompany: z.string().trim().max(240).optional(),
    contractorSignedBy: z.string().trim().max(240).optional(),
    contractorSignedAt: z.string().trim().max(80).optional(),
    contractorSignatureImage: z.string().max(300000).optional(),
    /** The supervisor who closed the day, signed on the day's own form. */
    signedBy: z.string().trim().max(240).optional(),
    signedAt: z.string().trim().max(80).optional(),
    signatureImage: z.string().max(300000).optional(),
    communication: z.string().trim().max(1000).optional(),
    risks: z.string().trim().max(1000).optional(),
    tomorrowPlan: z.string().trim().min(3, text("Choose tomorrow's plan", "Kies de planning voor morgen")).max(1000),
    photoCount: z.number().int().min(0).max(10000),
    attachmentsConfirmed: z.boolean(),
  })
  .superRefine((answers, context) => {
    if (answers.qualityIssues === "yes" && (answers.qualityDetails?.length ?? 0) < 10) {
      context.addIssue({ code: "custom", path: ["qualityDetails"], message: text("Describe the quality finding", "Omschrijf de kwaliteitsbevinding") });
    }
    if (answers.hseEvent !== "none" && (answers.hseDetails?.length ?? 0) < 10) {
      context.addIssue({ code: "custom", path: ["hseDetails"], message: text("Describe the HSE event", "Omschrijf de HSE-gebeurtenis") });
    }
    if (answers.delayCause !== "none" && answers.delayHours <= 0) {
      context.addIssue({ code: "custom", path: ["delayHours"], message: text("Enter the time lost", "Vul het tijdverlies in") });
    }
    if (answers.delayCause !== "none" && (answers.delayReason?.length ?? 0) < 10) {
      context.addIssue({ code: "custom", path: ["delayReason"], message: text("Describe what actually caused this delay", "Beschrijf wat deze vertraging daadwerkelijk heeft veroorzaakt") });
    }
    if (answers.delayCause !== "none" && (answers.contractorCompany?.length ?? 0) < 2) {
      context.addIssue({ code: "custom", path: ["contractorCompany"], message: text("Enter the responsible contractor company", "Vul het verantwoordelijke aannemersbedrijf in") });
    }
    if (answers.delayCause !== "none" && (!(answers.contractorSignedBy?.length ?? 0) || !answers.contractorSignedAt || !answers.contractorSignatureImage)) {
      context.addIssue({
        code: "custom",
        path: ["contractorSignatureImage"],
        message: text(
          "The contractor signature is required because the contractor is responsible for the work affected by this delay",
          "De handtekening van de aannemer is verplicht omdat de aannemer verantwoordelijk is voor het werk waarop deze vertraging betrekking heeft",
        ),
      });
    }
    if (!answers.attachmentsConfirmed) {
      context.addIssue({ code: "custom", path: ["attachmentsConfirmed"], message: text("Confirm that the attachments were checked", "Bevestig dat de bijlagen zijn gecontroleerd") });
    }
  });
}

export const dailyCloseoutSchema = createDailyCloseoutSchema();

export type DailyCloseoutAnswers = z.infer<typeof dailyCloseoutSchema>;

export type AutomationRule = {
  id: string;
  title: string;
  action: string;
  source: string;
  tone: "info" | "warning" | "critical" | "success";
};

export function getProjectStartAutomation(
  answers: Partial<ProjectStartAnswers>,
  previousDayWorkers?: number,
  language: "en" | "nl" = "en",
): AutomationRule[] {
  const text = (english: string, dutch: string) => language === "en" ? english : dutch;
  const rules: AutomationRule[] = [];

  if (answers.weatherCondition === "rain" || answers.weatherCondition === "heavy_rain") {
    rules.push({
      id: "AUTO-WEATHER-01",
      title: text("Actively monitor weather delay", "Weervertraging actief bewaken"),
      action: text("Time-loss question added; plan checked for rain risk.", "Tijdverliesvraag toegevoegd; planning gecontroleerd op regenrisico."),
      source: text("Weather = rain", "Weer = regen"),
      tone: answers.weatherCondition === "heavy_rain" ? "critical" : "warning",
    });
  }

  if (answers.windCondition === "strong" || answers.highRiskWork === "yes") {
    rules.push({
      id: "AUTO-HSE-01",
      title: text("HSE start check required", "HSE-startcheck verplicht"),
      action: text("PPE, scaffolding, fall protection, lifting, permits and toolbox must be confirmed.", "PBM, steiger, valbeveiliging, hijswerk, vergunning en toolbox moeten worden bevestigd."),
      source: answers.windCondition === "strong" ? text("Strong wind", "Sterke wind") : text("High-risk work = yes", "Hoog-risicowerk = ja"),
      tone: "critical",
    });
  }

  if (answers.concreteWork === "yes") {
    rules.push({
      id: "AUTO-CONCRETE-01",
      title: text("Prepare concrete inspection", "Betoncontrole klaarzetten"),
      action: text("Suggested: reinforcement/formwork, delivery, slump/cube test, pour photos.", "Voorgesteld: wapening/bekisting, levering, slump/kubustest, stortfoto's."),
      source: text("Concrete work = yes", "Betonwerk = ja"),
      tone: "warning",
    });
  }

  if (answers.inspectionPlanned === "yes") {
    rules.push({
      id: "AUTO-INSPECTION-01",
      title: text("Add inspection to day plan", "Inspectie aan dagplan toevoegen"),
      action: text("Choose and confirm the project checklist.", "Kies en bevestig de projectchecklist."),
      source: text("Inspection planned = yes", "Inspectie gepland = ja"),
      tone: "info",
    });
  }

  if (answers.workPermit === "missing") {
    rules.push({
      id: "AUTO-PERMIT-01",
      title: text("Work permit is missing", "Werkvergunning ontbreekt"),
      action: text("Critical warning and follow-up action proposed. Work is not approved automatically.", "Kritieke waarschuwing en opvolgactie voorgesteld. Werk wordt niet automatisch goedgekeurd."),
      source: text("Work permit = missing", "Werkvergunning = ontbreekt"),
      tone: "critical",
    });
  }

  if (answers.drawingStatus === "missing") {
    rules.push({
      id: "AUTO-DRAWING-01",
      title: text("Approved drawing is missing", "Goedgekeurde tekening ontbreekt"),
      action: text("Document action proposed. Confirm the notice before project start.", "Documentactie voorgesteld. Bevestig de melding vóór projectstart."),
      source: text("Drawing status = missing", "Tekeningstatus = ontbreekt"),
      tone: "critical",
    });
  }

  if (typeof answers.expectedWorkers === "number" && typeof previousDayWorkers === "number" && previousDayWorkers > 0) {
    const difference = Math.abs(answers.expectedWorkers - previousDayWorkers) / previousDayWorkers;
    if (difference >= 0.2) {
      rules.push({
        id: "AUTO-STAFF-01",
        title: text("Check workforce deviation", "Bezettingsafwijking controleren"),
        action: text(`The expected workforce differs by at least 20% from the previous workday (${previousDayWorkers}).`, `De verwachte bezetting wijkt minstens 20% af van de vorige werkdag (${previousDayWorkers}).`),
        source: text("Fixed workforce threshold = 20%", "Vaste bezettingsdrempel = 20%"),
        tone: "warning",
      });
    }
  }

  return rules;
}

export const clientReportSections = [
  "Algemene projectinformatie",
  "Samenvatting van de dag",
  "Aanwezige partijen",
  "Uitgevoerde werkzaamheden",
  "Inspecties uitgevoerd",
  "Kwaliteitsbevindingen",
  "Veiligheid (HSE)",
  "Materieel op de bouwplaats",
  "Materiaal geleverd",
  "Testen en metingen",
  "Meer- en minderwerk",
  "Vertragingen",
  "Communicatie",
  "Openstaande actiepunten",
  "Risico's",
  "Planning morgen",
  "Fotoregistratie",
  "Bijlagen",
  "Digitale handtekening",
] as const;
