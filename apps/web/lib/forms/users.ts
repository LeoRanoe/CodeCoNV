import { z } from "zod";

export function createInternalUserInviteSchema(language: "en" | "nl" = "en") {
  const message = (english: string, dutch: string) => language === "en" ? english : dutch;
  return z.object({
  organizationId: z.uuid(),
  displayName: z.string().trim().min(2, message("Enter the full name", "Vul de volledige naam in")).max(120),
  email: z.email(message("Enter a valid email address", "Vul een geldig e-mailadres in")),
  roleCode: z.string().regex(/^[a-z]+(?:_[a-z]+)*$/, message("Choose a valid role", "Kies een geldige rol")),
  projectId: z.union([z.uuid(), z.literal("")]).optional(),
  });
}

export const internalUserInviteSchema = createInternalUserInviteSchema();

export type InternalUserInviteAnswers = z.infer<typeof internalUserInviteSchema>;
