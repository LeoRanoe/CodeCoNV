import { z } from "zod";

export function createAuthSchema(language: "en" | "nl" = "en") {
  const text = (english: string, dutch: string) => language === "en" ? english : dutch;
  return z.object({
    email: z.email(text("Enter a valid email address", "Vul een geldig e-mailadres in")),
    password: z.string().min(8, text("Use at least 8 characters", "Gebruik minimaal 8 tekens")).max(128),
  });
}

export const authSchema = createAuthSchema();

export type AuthAnswers = z.infer<typeof authSchema>;

export function createPasswordSetupSchema(language: "en" | "nl" = "en") {
  const text = (english: string, dutch: string) => language === "en" ? english : dutch;
  return z.object({
  password: z.string()
    .min(12, text("Use at least 12 characters", "Gebruik minimaal 12 tekens"))
    .max(128)
    .regex(/[a-z]/, text("Use at least one lowercase letter", "Gebruik minimaal één kleine letter"))
    .regex(/[A-Z]/, text("Use at least one uppercase letter", "Gebruik minimaal één hoofdletter"))
    .regex(/[0-9]/, text("Use at least one number", "Gebruik minimaal één cijfer")),
  passwordConfirmation: z.string().min(12, text("Repeat the password", "Herhaal het wachtwoord")),
  }).refine((answers) => answers.password === answers.passwordConfirmation, {
  message: text("The passwords do not match", "De wachtwoorden zijn niet gelijk"),
  path: ["passwordConfirmation"],
  });
}

export const passwordSetupSchema = createPasswordSetupSchema();

export type PasswordSetupAnswers = z.infer<typeof passwordSetupSchema>;

export function createOrganizationSetupSchema(language: "en" | "nl" = "en") {
  const text = (english: string, dutch: string) => language === "en" ? english : dutch;
  return z.object({
    displayName: z.string().trim().min(2, text("Enter your name", "Vul je naam in")).max(120),
    organizationName: z.string().trim().min(2).max(160),
    organizationSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, text("Use lowercase letters, numbers and hyphens", "Gebruik kleine letters, cijfers en streepjes")),
  });
}

export const organizationSetupSchema = createOrganizationSetupSchema();

export type OrganizationSetupAnswers = z.infer<typeof organizationSetupSchema>;

export function createProjectSetupSchema() {
  return z.object({
    code: z.string().trim().min(2).max(40),
    name: z.string().trim().min(2).max(180),
    location: z.string().trim().min(2).max(180),
    clientName: z.string().trim().min(2).max(180),
    buildingCode: z.string().trim().min(1).max(40),
    buildingName: z.string().trim().min(2).max(160),
    additionalBuildings: z.string().max(4000),
    locationLevels: z.string().max(4000),
    contractorName: z.string().trim().min(2).max(180),
    defaultLanguage: z.enum(["en", "nl"]),
    shiftStart: z.string().regex(/^\d{2}:\d{2}$/),
    shiftEnd: z.string().regex(/^\d{2}:\d{2}$/),
    reportPrefix: z.string().trim().min(1).max(12),
    requiredLocationDepth: z.enum(["building", "floor", "room", "element"]),
    disciplines: z.string().trim().min(2).max(4000),
    lowDeadlineDays: z.number().int().min(0).max(365),
    mediumDeadlineDays: z.number().int().min(0).max(365),
    highDeadlineDays: z.number().int().min(0).max(365),
    criticalDeadlineDays: z.number().int().min(0).max(365),
    notificationLeadHours: z.number().int().min(1).max(720),
    reportHeader: z.string().max(240),
    reportFooter: z.string().max(240),
    enableWorkforce: z.boolean(),
    enableInspections: z.boolean(),
    enableQuality: z.boolean(),
    enableHse: z.boolean(),
    enableDocuments: z.boolean(),
    enableVisualEvidence: z.boolean(),
  });
}

export const projectSetupSchema = createProjectSetupSchema();

export type ProjectSetupAnswers = z.infer<typeof projectSetupSchema>;
