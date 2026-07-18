import { z } from "zod";

export const authSchema = z.object({
  displayName: z.string().trim().max(120).optional(),
  email: z.email("Vul een geldig e-mailadres in"),
  password: z.string().min(8, "Gebruik minimaal 8 tekens").max(128),
});

export type AuthAnswers = z.infer<typeof authSchema>;

export const organizationSetupSchema = z.object({
  displayName: z.string().trim().min(2, "Vul je naam in").max(120),
  organizationName: z.string().trim().min(2).max(160),
  organizationSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Gebruik kleine letters, cijfers en streepjes"),
});

export type OrganizationSetupAnswers = z.infer<typeof organizationSetupSchema>;

export const projectSetupSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(180),
  location: z.string().trim().min(2).max(180),
  clientName: z.string().trim().min(2).max(180),
  buildingCode: z.string().trim().min(1).max(40),
  buildingName: z.string().trim().min(2).max(160),
  contractorName: z.string().trim().min(2).max(180),
});

export type ProjectSetupAnswers = z.infer<typeof projectSetupSchema>;
