import { issueSignedToken, presignUrl } from "@vercel/blob";
import { z } from "zod";
import { loadActiveExternalShare } from "@/lib/external-share/server";
import {
  createStorageAdminClient,
  isBlobServerConfigured,
  storageErrorResponse,
  storageJson,
} from "@/lib/storage/server";

export const dynamic = "force-dynamic";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const uploadSchema = z.object({
  fileId: z.uuid(),
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(150),
  sizeBytes: z.number().int().positive().max(15 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

function safeFilename(filename: string) {
  return (filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "bewijsfoto.jpg").slice(-160);
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (!isBlobServerConfigured()) return storageJson({ error: "De private beeldopslag is nog niet gekoppeld." }, 503);
    const { token } = await params;
    const share = await loadActiveExternalShare(token);
    if (!share) return storageJson({ error: "Deze link is verlopen of ingetrokken." }, 404);
    const input = uploadSchema.safeParse(await request.json().catch(() => null));
    if (!input.success || !allowedMimeTypes.has(input.data?.mimeType ?? "")) {
      return storageJson({ error: "Kies een geldige JPG-, PNG- of WebP-foto." }, 400);
    }
    const admin = createStorageAdminClient();
    const recent = await admin
      .from("files")
      .select("id", { count: "exact", head: true })
      .eq("submitted_via_share_id", share.id)
      .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((recent.count ?? 0) >= 20) return storageJson({ error: "De uploadlimiet voor deze link is bereikt." }, 429);
    const settings = await admin.from("project_settings").select("max_file_size_mb").eq("project_id", share.project_id).maybeSingle();
    const maximumSizeInBytes = Math.min(Number(settings.data?.max_file_size_mb ?? 15), 15) * 1024 * 1024;
    if (input.data.sizeBytes > maximumSizeInBytes) {
      return storageJson({ error: `De foto mag maximaal ${Math.floor(maximumSizeInBytes / 1024 / 1024)} MB zijn.` }, 413);
    }
    const pathname = `projects/${share.project_id}/external-evidence/${share.id}/${input.data.fileId}/${safeFilename(input.data.originalName)}`;
    const reservation = await admin.from("files").insert({
      id: input.data.fileId,
      organization_id: share.organization_id,
      project_id: share.project_id,
      building_id: share.building_id,
      original_name: input.data.originalName,
      mime_type: input.data.mimeType,
      size_bytes: input.data.sizeBytes,
      sha256: input.data.sha256,
      category: "evidence",
      status: "pending",
      storage_provider: "vercel_blob",
      storage_object_key: pathname,
      submitted_via_share_id: share.id,
      created_by: share.created_by,
    });
    if (reservation.error) {
      const duplicate = reservation.error.code === "23505";
      return storageJson({ error: duplicate ? "Deze upload is al gereserveerd." : "De foto kon niet worden gereserveerd." }, duplicate ? 409 : 400);
    }
    try {
      const validUntil = Date.now() + 10 * 60 * 1000;
      const signedToken = await issueSignedToken({
        pathname,
        operations: ["put"],
        allowedContentTypes: [input.data.mimeType],
        maximumSizeInBytes,
        validUntil,
      });
      const { presignedUrl } = await presignUrl(signedToken, {
        operation: "put",
        pathname,
        access: "private",
        allowedContentTypes: [input.data.mimeType],
        maximumSizeInBytes,
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 30 * 24 * 60 * 60,
        validUntil,
      });
      return storageJson({ fileId: input.data.fileId, pathname, presignedUrl }, 201);
    } catch {
      await admin.from("files").update({ status: "failed" }).eq("id", input.data.fileId);
      throw new Error("De beveiligde upload kon niet worden gestart.");
    }
  } catch (error) {
    return storageErrorResponse(error, request, "external_share");
  }
}
