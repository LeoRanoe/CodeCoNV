import { logEvent, requestIdFrom } from "@/lib/observability/log";
import { z } from "zod";
import { loadActiveExternalShare } from "@/lib/external-share/server";
import { normalizeExternalShareToken } from "@/lib/external-share/token.mjs";
import { createStorageAdminClient, storageErrorResponse, storageJson } from "@/lib/storage/server";

export const dynamic = "force-dynamic";

const responseSchema = z.object({
  responseType: z.enum(["ready_for_verification", "issue", "proposed_correction"]),
  note: z.string().trim().min(3).max(2000),
  contactName: z.string().trim().max(120).optional().default(""),
  /** The job the signer holds; the client's own NCR form prints it under the name. */
  contactPosition: z.string().trim().max(240).optional().default(""),
  /** The signature the contractor wrote, as a small inline PNG. */
  signatureImage: z.string().regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).max(200000).nullable().optional(),
  evidenceFileId: z.uuid().nullable().optional(),
  idempotencyKey: z.string().min(8).max(200),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const route = await params;
    const token = normalizeExternalShareToken(route.token);
    if (!token || !await loadActiveExternalShare(token)) return storageJson({ error: "Deze link is verlopen of ingetrokken." }, 404);
    const input = responseSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return storageJson({ error: "Controleer de gereedmelding en probeer opnieuw." }, 400);
    const admin = createStorageAdminClient();
    // Three shapes of the same call, newest first: with the signer's position, with the
    // written signature only, and with neither. Each step down is a database that has not
    // been given the newer migration yet, and each still receives the answer.
    const submit = (responseType: string, note: string, level: "position" | "signature" | "plain" = "position") => admin.rpc("submit_external_share_response", {
      p_token: token,
      p_response_type: responseType,
      p_note: note,
      p_contact_name: input.data.contactName || null,
      p_evidence_file_id: input.data.evidenceFileId || null,
      p_idempotency_key: input.data.idempotencyKey,
      ...(level === "plain" ? {} : { p_signature_image: input.data.signatureImage || null }),
      ...(level === "position" ? { p_contact_position: input.data.contactPosition || null } : {}),
    });
    const functionMissing = (error: { code?: string; message?: string } | null) => Boolean(error)
      && (error?.code === "PGRST202" || Boolean(error?.message?.toLowerCase().includes("could not find the function")));
    let result = await submit(input.data.responseType, input.data.note);
    if (functionMissing(result.error)) {
      result = await submit(input.data.responseType, input.data.note, "signature");
    }
    // A database that does not know the written signature yet still has to receive the
    // answer; the name and the moment are then all it stores.
    if (functionMissing(result.error)) {
      result = await submit(input.data.responseType, input.data.note, "plain");
    }
    // A database that does not know the contractor's own box yet still has to receive
    // the text; it then arrives as a reported answer with the same words.
    if (result.error?.code === "22023" && input.data.responseType === "proposed_correction") {
      result = await submit("issue", `Voorgestelde correctieve actie: ${input.data.note}`);
    }
    if (result.error) {
      if (result.error.code === "P0002") return storageJson({ error: "Deze link is verlopen of ingetrokken." }, 404);
      // The record is no longer the contractor's to answer: finished, or waiting for CODECO's check.
      if (result.error.code === "55000") {
        return storageJson({
          error: result.error.message.includes("waiting for verification")
            ? "Dit punt wacht op controle door CODECO. Een nieuw voorstel kan pas worden gedaan als CODECO het heropent."
            : "Dit punt is afgesloten. Neem contact op met CODECO als er nog iets niet klopt.",
        }, 409);
      }
      if (result.error.message.includes("rate limit")) return storageJson({ error: "Te veel reacties. Probeer het later opnieuw." }, 429);
      logEvent("error", "external_share", "response_rejected", { requestId: requestIdFrom(request), error: result.error });
      throw new Error("De reactie kon niet veilig worden opgeslagen.");
    }
    return storageJson(result.data, 201);
  } catch (error) {
    return storageErrorResponse(error, request, "external_share");
  }
}
