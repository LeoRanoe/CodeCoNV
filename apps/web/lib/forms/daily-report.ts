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
    plannedWork: z.string().trim().min(10, text("Describe the planned work", "Beschrijf de geplande werkzaamheden")),
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
    communication: z.string().trim().max(1000).optional(),
    risks: z.string().trim().max(1000).optional(),
    tomorrowPlan: z.string().trim().min(10, text("Describe tomorrow's plan", "Beschrijf de planning voor morgen")).max(1000),
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
  const rules: AutomationRule[] = [
    {
      id: "AUTO-DR-01",
      title: text("Prepare draft daily report", "Conceptdagrapport klaarzetten"),
      action: text("Report number, project, building, date and supervisor are prefilled.", "Rapportnummer, project, gebouw, datum en supervisor worden vooraf ingevuld."),
      source: text("New workday", "Nieuwe werkdag"),
      tone: "success",
    },
    {
      id: "AUTO-OPEN-01",
      title: text("Load open matters", "Open zaken ophalen"),
      action: text("Open actions, critical findings and planned inspections are shown as a start list.", "Open acties, kritieke bevindingen en geplande inspecties worden als startlijst getoond."),
      source: text("Report started", "Rapport gestart"),
      tone: "info",
    },
  ];

  if (answers.weatherCondition === "rain" || answers.weatherCondition === "heavy_rain") {
    rules.push({
      id: "AUTO-WEATHER-01",
      title: text("Actively monitor weather delay", "Weervertraging actief bewaken"),
      action: text("The supervisor receives a time-loss question and the plan is checked for rain risk.", "De supervisor krijgt een tijdverliesvraag en de planning wordt op regenrisico gecontroleerd."),
      source: text("Weather = rain", "Weer = regen"),
      tone: answers.weatherCondition === "heavy_rain" ? "critical" : "warning",
    });
  }

  if (answers.windCondition === "strong" || answers.highRiskWork === "yes") {
    rules.push({
      id: "AUTO-HSE-01",
      title: text("HSE start check required", "HSE-startcheck verplicht"),
      action: text("PPE, scaffolding, fall protection, lifting, permits and toolbox must be confirmed by a person.", "PBM, steiger, valbeveiliging, hijswerk, vergunning en toolbox moeten menselijk worden bevestigd."),
      source: answers.windCondition === "strong" ? text("Strong wind", "Sterke wind") : text("High-risk work = yes", "Hoog-risicowerk = ja"),
      tone: "critical",
    });
  }

  if (answers.concreteWork === "yes") {
    rules.push({
      id: "AUTO-CONCRETE-01",
      title: text("Prepare concrete inspection", "Betoncontrole klaarzetten"),
      action: text("Reinforcement/formwork, delivery, slump/cube test and pour photos are suggested.", "Wapening/bekisting, levering, slump/cube test en stortfoto's worden voorgesteld."),
      source: text("Concrete work = yes", "Betonwerk = ja"),
      tone: "warning",
    });
  }

  if (answers.inspectionPlanned === "yes") {
    rules.push({
      id: "AUTO-INSPECTION-01",
      title: text("Add inspection to day plan", "Inspectie aan dagplan toevoegen"),
      action: text("The relevant project-specific checklist is prepared; the supervisor selects and confirms it.", "De relevante projectspecifieke checklist wordt klaargezet; de supervisor kiest en bevestigt deze."),
      source: text("Inspection planned = yes", "Inspectie gepland = ja"),
      tone: "info",
    });
  }

  if (answers.workPermit === "missing") {
    rules.push({
      id: "AUTO-PERMIT-01",
      title: text("Work permit is missing", "Werkvergunning ontbreekt"),
      action: text("A critical warning and follow-up action are proposed; the app does not approve work autonomously.", "Een kritieke waarschuwing en opvolgactie worden voorgesteld; de app keurt het werk niet autonoom goed."),
      source: text("Work permit = missing", "Werkvergunning = ontbreekt"),
      tone: "critical",
    });
  }

  if (answers.drawingStatus === "missing") {
    rules.push({
      id: "AUTO-DRAWING-01",
      title: text("Approved drawing is missing", "Goedgekeurde tekening ontbreekt"),
      action: text("A document action is proposed and the notice must be confirmed before project start.", "Een documentactie wordt voorgesteld en de melding moet vóór projectstart worden bevestigd."),
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
