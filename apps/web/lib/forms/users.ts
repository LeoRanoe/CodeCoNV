import { z } from "zod";

export const internalUserInviteSchema = z.object({
  organizationId: z.uuid(),
  displayName: z.string().trim().min(2, "Vul de volledige naam in").max(120),
  email: z.email("Vul een geldig e-mailadres in"),
  roleCode: z.string().regex(/^[a-z]+(?:_[a-z]+)*$/, "Kies een geldige rol"),
  projectId: z.union([z.uuid(), z.literal("")]).optional(),
});

export type InternalUserInviteAnswers = z.infer<typeof internalUserInviteSchema>;
