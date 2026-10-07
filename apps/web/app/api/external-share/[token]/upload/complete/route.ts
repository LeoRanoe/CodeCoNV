import { head } from "@vercel/blob";
import { sha256OfStoredBlob } from "@/lib/storage/content-hash";
import { z } from "zod";
import { loadActiveExternalShare } from "@/lib/external-share/server";
import {
  createStorageAdminClient,
  isBlobServerConfigured,
  storageErrorResponse,
  storageJson,
} from "@/lib/storage/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const completionSchema = z.object({
  fileId: z.uuid(),
  pathname: z.string().min(10).max(700),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (!isBlobServerConfigured()) return storageJson({ error: "De private beeldopslag is nog niet gekoppeld." }, 503);
    const { token } = await params;
    const share = await loadActiveExternalShare(token);
    if (!share) return storageJson({ error: "Deze link is verlopen of ingetrokken." }, 404);
    const input = completionSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return storageJson({ error: "De uploadbevestiging is ongeldig." }, 400);
    const admin = createStorageAdminClient();
    const result = await admin
      .from("files")
      .select("id,mime_type,size_bytes,status,sha256,storage_object_key,submitted_via_share_id")
      .eq("id", input.data.fileId)
      .eq("submitted_via_share_id", share.id)
      .maybeSingle();
    if (result.error || !result.data) return storageJson({ error: "De bewijsfoto hoort niet bij deze link." }, 404);
    const file = result.data;
    if (file.status === "available") return storageJson({ fileId: file.id, sha256: file.sha256 });
    if (file.status !== "pending" || file.storage_object_key !== input.data.pathname || file.sha256 !== input.data.sha256) {
      return storageJson({ error: "De uploadgegevens komen niet overeen." }, 409);
    }
    const blob = await head(input.data.pathname);
    const contentType = blob.contentType.split(";", 1)[0].trim().toLowerCase();
    if (blob.pathname !== input.data.pathname || blob.size !== file.size_bytes || contentType !== file.mime_type.toLowerCase()) {
      return storageJson({ error: "De opgeslagen foto komt niet overeen met de reservering." }, 409);
    }
    // The contractor's device declared this checksum; only the stored bytes count as proof.
    const storedSha256 = await sha256OfStoredBlob(blob.pathname);
    if (storedSha256 !== file.sha256) {
      await admin.from("files").update({ status: "failed" }).eq("id", file.id).eq("status", "pending");
      return storageJson({ error: "De opgeslagen foto komt niet overeen met de checksum. Upload de foto opnieuw." }, 409);
    }
    const update = await admin.from("files").update({ status: "available", size_bytes: blob.size, content_verified_at: new Date().toISOString() }).eq("id", file.id).eq("status", "pending").select("id").single();
    if (update.error || !update.data) throw new Error("De bewijsfoto is geüpload maar kon niet worden bevestigd.");
    return storageJson({ fileId: file.id, sha256: input.data.sha256 });
  } catch (error) {
    return storageErrorResponse(error, request, "external_share");
  }
}
