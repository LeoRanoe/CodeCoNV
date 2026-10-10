import { get } from "@vercel/blob";
import { loadActiveExternalShare } from "@/lib/external-share/server";
import {
  createStorageAdminClient,
  isBlobServerConfigured,
  storageErrorResponse,
  storageJson,
} from "@/lib/storage/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (!isBlobServerConfigured()) return storageJson({ error: "De private beeldopslag is nog niet gekoppeld." }, 503);
    const { token } = await params;
    const share = await loadActiveExternalShare(token);
    if (!share?.source_file_id) return storageJson({ error: "Er is geen bronfoto aan deze taak gekoppeld." }, 404);
    const fileResult = await createStorageAdminClient()
      .from("files")
      .select("mime_type,status,storage_provider,storage_object_key")
      .eq("id", share.source_file_id)
      .eq("project_id", share.project_id)
      .eq("status", "available")
      .maybeSingle();
    if (fileResult.error || !fileResult.data?.storage_object_key || fileResult.data.storage_provider !== "vercel_blob") {
      return storageJson({ error: "De bronfoto is niet beschikbaar." }, 404);
    }
    const result = await get(fileResult.data.storage_object_key, { access: "private" });
    if (!result) return storageJson({ error: "De bronfoto is niet gevonden." }, 404);
    return new Response(result.stream, {
      headers: {
        "cache-control": "private, no-store",
        "content-length": String(result.blob.size),
        "content-type": result.blob.contentType || fileResult.data.mime_type,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return storageErrorResponse(error, _request, "external_share");
  }
}
