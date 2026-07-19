import { get } from "@vercel/blob";
import { z } from "zod";
import {
  authenticateStorageRequest,
  isBlobServerConfigured,
  storageErrorResponse,
  storageJson,
} from "@/lib/storage/server";

export const dynamic = "force-dynamic";

function contentDisposition(filename: string, download: boolean) {
  const fallback = filename.replace(/[^a-zA-Z0-9._-]+/g, "-") || "bestand";
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    if (!isBlobServerConfigured()) {
      return storageJson({ error: "Koppel eerst een private Vercel Blob-store aan dit Vercel-project." }, 503);
    }
    const { fileId } = await params;
    if (!z.uuid().safeParse(fileId).success) return storageJson({ error: "Ongeldig bestand-ID." }, 400);

    const { userClient } = await authenticateStorageRequest(request);
    const fileResult = await userClient
      .from("files")
      .select("id,original_name,mime_type,size_bytes,status,storage_provider,storage_object_key")
      .eq("id", fileId)
      .eq("status", "available")
      .maybeSingle();
    if (fileResult.error || !fileResult.data) return storageJson({ error: "Het bestand bestaat niet of is niet toegankelijk." }, 404);
    const file = fileResult.data;
    if (file.storage_provider !== "vercel_blob" || !file.storage_object_key) {
      return storageJson({ error: "Dit bestand staat niet in de gekoppelde Vercel Blob-store." }, 409);
    }

    const ifNoneMatch = request.headers.get("if-none-match") ?? undefined;
    const result = await get(file.storage_object_key, {
      access: "private",
      ifNoneMatch,
    });
    if (!result) return storageJson({ error: "De bestandsinhoud is niet gevonden." }, 404);
    if (result.statusCode === 304) {
      return new Response(null, {
        status: 304,
        headers: { etag: result.blob.etag, "cache-control": "private, no-cache" },
      });
    }

    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(result.stream, {
      headers: {
        "cache-control": "private, no-cache",
        "content-disposition": contentDisposition(file.original_name, download),
        "content-length": String(result.blob.size),
        "content-type": result.blob.contentType || file.mime_type,
        etag: result.blob.etag,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return storageErrorResponse(error);
  }
}
