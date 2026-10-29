import { z } from "zod";

export const projectActionSchema = z.object({
  title: z.string().trim().min(3, "Beschrijf de actie in minimaal 3 tekens.").max(240),
  description: z.string().trim().min(5, "Geef voldoende context voor de verantwoordelijke.").max(2000),
  ownerPartyId: z.string().uuid("Kies een verantwoordelijke partij."),
  // Optional: an action can be created for its party first and assigned later.
  ownerUserId: z.union([z.string().uuid("Kies een medewerker van het bedrijf."), z.literal("")]),
  dueAt: z.string().min(1, "Kies een deadline.").refine((value) => !Number.isNaN(new Date(value).getTime()), "Kies een geldige deadline."),
  priority: z.enum(["low", "normal", "high", "critical"]),
});

export const actionTransitionSchema = z.object({
  note: z.string().trim().min(5, "Noteer in minimaal 5 tekens wat is uitgevoerd of gecontroleerd.").max(2000),
});

export type ProjectActionAnswers = z.infer<typeof projectActionSchema>;
export type ActionTransitionAnswers = z.infer<typeof actionTransitionSchema>;
