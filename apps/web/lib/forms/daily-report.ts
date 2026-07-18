import { z } from "zod";

export const yesNoSchema = z.enum(["yes", "no"]);

export const projectStartSchema = z
  .object({
    weatherCondition: z.enum(["sunny", "partly_cloudy", "cloudy", "rain", "heavy_rain"]),
    temperatureC: z.number().min(15, "Controleer de temperatuur").max(50, "Controleer de temperatuur"),
    windCondition: z.enum(["calm", "moderate", "strong"]),
    shiftStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Gebruik uu:mm"),
    shiftEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Gebruik uu:mm"),
    plannedWork: z.string().trim().min(10, "Beschrijf de geplande werkzaamheden"),
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
        message: "De eindtijd moet na de starttijd liggen",
      });
    }
    if (answers.drawingStatus === "missing" && !answers.drawingIssueReported) {
      context.addIssue({
        code: "custom",
        path: ["drawingIssueReported"],
        message: "Bevestig dat de ontbrekende goedgekeurde tekening is gemeld",
      });
    }
  });

export type ProjectStartAnswers = z.infer<typeof projectStartSchema>;

export const dailyCloseoutSchema = z
  .object({
    daySummary: z.string().trim().min(20, "Beschrijf in minimaal één volledige zin hoe de dag is verlopen").max(700),
    weatherSummary: z.string().trim().min(5, "Beschrijf het werkelijke weer").max(180),
    workPerformed: z.string().trim().min(10, "Beschrijf de uitgevoerde werkzaamheden").max(1200),
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
    tomorrowPlan: z.string().trim().min(10, "Beschrijf de planning voor morgen").max(1000),
    photoCount: z.number().int().min(0).max(10000),
    attachmentsConfirmed: z.boolean(),
  })
  .superRefine((answers, context) => {
    if (answers.qualityIssues === "yes" && (answers.qualityDetails?.length ?? 0) < 10) {
      context.addIssue({ code: "custom", path: ["qualityDetails"], message: "Omschrijf de kwaliteitsbevinding" });
    }
    if (answers.hseEvent !== "none" && (answers.hseDetails?.length ?? 0) < 10) {
      context.addIssue({ code: "custom", path: ["hseDetails"], message: "Omschrijf de HSE-gebeurtenis" });
    }
    if (answers.delayCause !== "none" && answers.delayHours <= 0) {
      context.addIssue({ code: "custom", path: ["delayHours"], message: "Vul het tijdverlies in" });
    }
  });

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
  previousDayWorkers = 41,
): AutomationRule[] {
  const rules: AutomationRule[] = [
    {
      id: "AUTO-DR-01",
      title: "Conceptdagrapport klaarzetten",
      action: "Rapportnummer, project, gebouw, datum en supervisor worden vooraf ingevuld.",
      source: "Nieuwe werkdag",
      tone: "success",
    },
    {
      id: "AUTO-OPEN-01",
      title: "Open zaken ophalen",
      action: "Open acties, kritieke bevindingen en geplande inspecties worden als startlijst getoond.",
      source: "Rapport gestart",
      tone: "info",
    },
  ];

  if (answers.weatherCondition === "rain" || answers.weatherCondition === "heavy_rain") {
    rules.push({
      id: "AUTO-WEATHER-01",
      title: "Weervertraging actief bewaken",
      action: "De supervisor krijgt een tijdverliesvraag en de planning wordt op regenrisico gecontroleerd.",
      source: "Weer = regen",
      tone: answers.weatherCondition === "heavy_rain" ? "critical" : "warning",
    });
  }

  if (answers.windCondition === "strong" || answers.highRiskWork === "yes") {
    rules.push({
      id: "AUTO-HSE-01",
      title: "HSE-startcheck verplicht",
      action: "PBM, steiger, valbeveiliging, hijswerk, vergunning en toolbox moeten menselijk worden bevestigd.",
      source: answers.windCondition === "strong" ? "Sterke wind" : "Hoog-risicowerk = ja",
      tone: "critical",
    });
  }

  if (answers.concreteWork === "yes") {
    rules.push({
      id: "AUTO-CONCRETE-01",
      title: "Betoncontrole klaarzetten",
      action: "Wapening/bekisting, levering, slump/cube test en stortfoto's worden voorgesteld.",
      source: "Betonwerk = ja",
      tone: "warning",
    });
  }

  if (answers.inspectionPlanned === "yes") {
    rules.push({
      id: "AUTO-INSPECTION-01",
      title: "Inspectie aan dagplan toevoegen",
      action: "De relevante projectspecifieke checklist wordt klaargezet; de supervisor kiest en bevestigt deze.",
      source: "Inspectie gepland = ja",
      tone: "info",
    });
  }

  if (answers.workPermit === "missing") {
    rules.push({
      id: "AUTO-PERMIT-01",
      title: "Werkvergunning ontbreekt",
      action: "Een kritieke waarschuwing en opvolgactie worden voorgesteld; de app keurt het werk niet autonoom goed.",
      source: "Werkvergunning = ontbreekt",
      tone: "critical",
    });
  }

  if (answers.drawingStatus === "missing") {
    rules.push({
      id: "AUTO-DRAWING-01",
      title: "Goedgekeurde tekening ontbreekt",
      action: "Een documentactie wordt voorgesteld en de melding moet vóór projectstart worden bevestigd.",
      source: "Tekeningstatus = ontbreekt",
      tone: "critical",
    });
  }

  if (typeof answers.expectedWorkers === "number" && previousDayWorkers > 0) {
    const difference = Math.abs(answers.expectedWorkers - previousDayWorkers) / previousDayWorkers;
    if (difference >= 0.2) {
      rules.push({
        id: "AUTO-STAFF-01",
        title: "Bezettingsafwijking controleren",
        action: `De verwachte bezetting wijkt minstens 20% af van de vorige werkdag (${previousDayWorkers}).`,
        source: "Vaste bezettingsdrempel = 20%",
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
