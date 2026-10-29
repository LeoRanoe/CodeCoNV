import { head } from "@vercel/blob";
import { z } from "zod";
import { sha256OfStoredBlob } from "@/lib/storage/content-hash";
import {
  authenticateStorageRequest,
  createStorageAdminClient,
  isBlobServerConfigured,
  storageErrorResponse,
  storageJson,
} from "@/lib/storage/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Hashing the stored object reads it once; 100 MB (the largest project limit) fits easily.
export const maxDuration = 60;

const completionSchema = z.object({
  fileId: z.uuid(),
  pathname: z.string().min(10).max(700),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function POST(request: Request) {
  try {
    if (!isBlobServerConfigured()) {
      // The operator's instruction goes to the log; the person who is uploading reads what happens to the file.
      console.warn("[storage] Geen private Vercel Blob-store gekoppeld aan dit Vercel-project.");
      return storageJson({ error: "Uploaden is nu niet beschikbaar; je foto blijft op dit apparaat." }, 503);
    }
    const { user, userClient } = await authenticateStorageRequest(request);
    const input = completionSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return storageJson({ error: "De uploadbevestiging is ongeldig." }, 400);

    const fileResult = await userClient
      .from("files")
      .select("id,project_id,created_by,original_name,mime_type,size_bytes,status,sha256,storage_provider,storage_object_key")
      .eq("id", input.data.fileId)
      .maybeSingle();
    if (fileResult.error || !fileResult.data) return storageJson({ error: "Het bestand bestaat niet of is niet toegankelijk." }, 404);
    const file = fileResult.data;
    if (file.created_by !== user.id) return storageJson({ error: "Alleen de uploader kan deze upload afronden." }, 403);

    const permissionResult = await userClient.rpc("can_manage_project_files", { p_project_id: file.project_id });
    if (permissionResult.error || permissionResult.data !== true) {
      return storageJson({ error: "Je bestandsrecht voor dit project is ingetrokken." }, 403);
    }
    if (file.storage_provider !== "vercel_blob" || file.storage_object_key !== input.data.pathname) {
      return storageJson({ error: "De Blob-locatie hoort niet bij deze upload." }, 409);
    }
    if (file.sha256 !== input.data.sha256) {
      return storageJson({ error: "De upload-checksum wijkt af van de reservering." }, 409);
    }
    if (file.status === "available") {
      return storageJson({ fileId: file.id, sha256: file.sha256 });
    }
    if (file.status !== "pending" && file.status !== "uploading") {
      return storageJson({ error: "Deze upload kan niet meer worden afgerond." }, 409);
    }

    const blob = await head(input.data.pathname);
    const blobContentType = blob.contentType.split(";", 1)[0].trim().toLowerCase();
    if (blob.pathname !== input.data.pathname || blobContentType !== file.mime_type.toLowerCase() || blob.size !== file.size_bytes) {
      return storageJson({ error: "Vercel Blob bevestigde niet dezelfde bestandsinhoud en metadata." }, 409);
    }

    const adminClient = createStorageAdminClient();
    // The declared checksum is the browser's claim; the stored bytes decide.
    const storedSha256 = await sha256OfStoredBlob(blob.pathname);
    if (storedSha256 !== input.data.sha256) {
      await adminClient.from("files").update({ status: "failed" }).eq("id", file.id).in("status", ["pending", "uploading"]);
      return storageJson({ error: "De opgeslagen bestandsinhoud komt niet overeen met de checksum van dit apparaat. Upload het bestand opnieuw." }, 409);
    }
    const updateResult = await adminClient
      .from("files")
      .update({
        status: "available",
        size_bytes: blob.size,
        sha256: storedSha256,
        content_verified_at: new Date().toISOString(),
        storage_provider: "vercel_blob",
        storage_object_key: blob.pathname,
        storage_parent_key: null,
      })
      .eq("id", file.id)
      .eq("storage_object_key", blob.pathname)
      .in("status", ["pending", "uploading"])
      .select("id")
      .single();
    if (updateResult.error || !updateResult.data) {
      throw new Error("Het bestand staat in Blob, maar de centrale metadata kon niet worden bevestigd.");
    }
    return storageJson({ fileId: file.id, sha256: input.data.sha256 });
  } catch (error) {
    return storageErrorResponse(error, request, "storage");
  }
}
