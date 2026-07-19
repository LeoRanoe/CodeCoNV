import { issueSignedToken, presignUrl } from "@vercel/blob";
import { z } from "zod";
import {
  authenticateStorageRequest,
  createStorageAdminClient,
  isBlobServerConfigured,
  storageErrorResponse,
  storageJson,
} from "@/lib/storage/server";

export const dynamic = "force-dynamic";

const categories = ["photo", "document", "certificate", "drawing", "report", "evidence", "backup", "export"] as const;
const allowedMimeTypes = new Set([
  "application/octet-stream",
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
]);

const uploadRequestSchema = z.object({
  fileId: z.uuid(),
  projectId: z.uuid(),
  buildingId: z.uuid().nullable(),
  category: z.enum(categories),
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(150),
  sizeBytes: z.number().int().positive().max(100 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

function safeFilename(filename: string) {
  const normalized = filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (normalized || "file").slice(-160);
}

export async function POST(request: Request) {
  try {
    if (!isBlobServerConfigured()) {
      return storageJson({ error: "Koppel eerst een private Vercel Blob-store aan dit Vercel-project." }, 503);
    }

    const input = uploadRequestSchema.safeParse(await request.json().catch(() => null));
    if (!input.success || !allowedMimeTypes.has(input.data?.mimeType ?? "")) {
      return storageJson({ error: "Controleer het bestandstype en de bestandsgegevens." }, 400);
    }

    const { user, userClient } = await authenticateStorageRequest(request);
    const rateLimitResult = await userClient.rpc("consume_security_rate_limit", {
      p_action_code: "blob_upload",
      p_max_requests: 60,
      p_window_minutes: 60,
    });
    if (rateLimitResult.error) throw new Error("De uploadlimiet kon niet worden gecontroleerd.");
    if (rateLimitResult.data !== true) {
      return storageJson({ error: "De uploadlimiet is bereikt. Probeer het later opnieuw." }, 429);
    }

    const projectResult = await userClient
      .from("projects")
      .select("id,organization_id")
      .eq("id", input.data.projectId)
      .maybeSingle();
    if (projectResult.error || !projectResult.data) {
      return storageJson({ error: "Je hebt geen toegang tot dit project." }, 403);
    }

    if (input.data.buildingId) {
      const buildingResult = await userClient
        .from("buildings")
        .select("id")
        .eq("id", input.data.buildingId)
        .eq("project_id", input.data.projectId)
        .maybeSingle();
      if (buildingResult.error || !buildingResult.data) {
        return storageJson({ error: "Het geselecteerde gebouw hoort niet bij dit project." }, 400);
      }
    }

    const settingsResult = await userClient
      .from("project_settings")
      .select("max_file_size_mb")
      .eq("project_id", input.data.projectId)
      .maybeSingle();
    if (settingsResult.error) throw new Error("De projectlimiet voor uploads kon niet worden gecontroleerd.");
    const maximumSizeInBytes = Math.min(Number(settingsResult.data?.max_file_size_mb ?? 25), 100) * 1024 * 1024;
    if (input.data.sizeBytes > maximumSizeInBytes) {
      return storageJson({ error: `Het bestand is groter dan de projectlimiet van ${Math.floor(maximumSizeInBytes / 1024 / 1024)} MB.` }, 413);
    }

    const reservationResult = await userClient.from("files").insert({
      id: input.data.fileId,
      organization_id: projectResult.data.organization_id,
      project_id: input.data.projectId,
      building_id: input.data.buildingId,
      original_name: input.data.originalName,
      mime_type: input.data.mimeType,
      size_bytes: 0,
      category: input.data.category,
      status: "pending",
      created_by: user.id,
    });
    if (reservationResult.error) {
      const duplicate = reservationResult.error.code === "23505";
      return storageJson({ error: duplicate ? "Deze upload is al gereserveerd." : "Je hebt geen bestandsrecht voor dit project." }, duplicate ? 409 : 403);
    }

    const pathname = `projects/${input.data.projectId}/${input.data.category}/${input.data.fileId}/${safeFilename(input.data.originalName)}`;
    const adminClient = createStorageAdminClient();
    const pathResult = await adminClient
      .from("files")
      .update({
        storage_provider: "vercel_blob",
        storage_object_key: pathname,
        size_bytes: input.data.sizeBytes,
        sha256: input.data.sha256,
      })
      .eq("id", input.data.fileId)
      .eq("status", "pending")
      .select("id")
      .single();
    if (pathResult.error || !pathResult.data) throw new Error("Bestandsmetadata kon niet voor Blob-opslag worden voorbereid.");

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
      await adminClient.from("files").update({ status: "failed" }).eq("id", input.data.fileId);
      throw new Error("Vercel Blob kon geen beveiligde upload-URL aanmaken.");
    }
  } catch (error) {
    return storageErrorResponse(error);
  }
}
