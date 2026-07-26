import { z } from "zod";
import { loadActiveExternalShare } from "@/lib/external-share/server";
import { normalizeExternalShareToken } from "@/lib/external-share/token.mjs";
import { createStorageAdminClient, storageErrorResponse, storageJson } from "@/lib/storage/server";

export const dynamic = "force-dynamic";

const responseSchema = z.object({
  responseType: z.enum(["ready_for_verification", "issue"]),
  note: z.string().trim().min(3).max(2000),
  contactName: z.string().trim().max(120).optional().default(""),
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
    const result = await createStorageAdminClient().rpc("submit_external_share_response", {
      p_token: token,
      p_response_type: input.data.responseType,
      p_note: input.data.note,
      p_contact_name: input.data.contactName || null,
      p_evidence_file_id: input.data.evidenceFileId || null,
      p_idempotency_key: input.data.idempotencyKey,
    });
    if (result.error) {
      if (result.error.code === "P0002") return storageJson({ error: "Deze link is verlopen of ingetrokken." }, 404);
      if (result.error.message.includes("rate limit")) return storageJson({ error: "Te veel reacties. Probeer het later opnieuw." }, 429);
      throw new Error("De reactie kon niet veilig worden opgeslagen.");
    }
    return storageJson(result.data, 201);
  } catch (error) {
    return storageErrorResponse(error);
  }
}
