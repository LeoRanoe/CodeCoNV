import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheProjectFile, readCachedProjectFile } from "@/lib/offline/file-cache";
import { validAccessToken } from "@/lib/supabase/access-token";

// Storage routes are part of the same Next.js application. The server route
// reports a configuration error until a private Vercel Blob store is connected.
export const isStorageGatewayConfigured = true;

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function storageError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? `Private opslag gaf status ${response.status}.`;
}

function uploadToPresignedUrl(url: string, file: File, onProgress?: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("content-type", file.type || "application/octet-stream");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(5 + Math.round((event.loaded / event.total) * 90));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Vercel Blob weigerde de upload met status ${request.status}.`));
    });
    request.addEventListener("error", () => reject(new Error("De verbinding met Vercel Blob is tijdens de upload verbroken.")));
    request.addEventListener("abort", () => reject(new Error("De upload is afgebroken.")));
    request.send(file);
  });
}

export async function uploadProjectFile(
  client: SupabaseClient,
  input: {
    fileId?: string;
    projectId: string;
    buildingId: string;
    folderId?: string | null;
    category: string;
    file: File;
    onProgress?: (percent: number) => void;
  },
) {
  const token = await validAccessToken(client);
  input.onProgress?.(1);
  const sha256 = await sha256Hex(input.file);
  const fileId = input.fileId ?? crypto.randomUUID();
  input.onProgress?.(4);

  const initiation = await fetch("/api/storage/uploads", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      fileId,
      projectId: input.projectId,
      buildingId: input.buildingId || null,
      folderId: input.folderId || null,
      category: input.category,
      originalName: input.file.name,
      mimeType: input.file.type || "application/octet-stream",
      sizeBytes: input.file.size,
      sha256,
    }),
  });
  if (!initiation.ok) throw new Error(await storageError(initiation));
  const upload = await initiation.json() as {
    fileId: string;
    pathname: string;
    presignedUrl?: string;
    status?: "pending" | "available";
    sha256?: string;
  };
  if (upload.status === "available") {
    input.onProgress?.(100);
    return { fileId: upload.fileId, sha256: upload.sha256 ?? sha256 };
  }
  if (!upload.presignedUrl) throw new Error("De beveiligde upload-URL ontbreekt.");
  await uploadToPresignedUrl(upload.presignedUrl, input.file, input.onProgress);
  input.onProgress?.(96);

  const completion = await fetch("/api/storage/uploads/complete", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ fileId: upload.fileId, pathname: upload.pathname, sha256 }),
  });
  if (!completion.ok) throw new Error(await storageError(completion));
  input.onProgress?.(100);
  return completion.json() as Promise<{ fileId: string; sha256: string }>;
}

async function authorizedFileResponse(client: SupabaseClient, fileId: string, download = false) {
  const token = await validAccessToken(client);
  const response = await fetch(`/api/storage/files/${encodeURIComponent(fileId)}${download ? "?download=1" : ""}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await storageError(response));
  return response;
}

export async function downloadProjectFile(client: SupabaseClient, fileId: string, filename: string) {
  // Downloading a file that is already on the device must keep working in the field.
  const blob = await authorizedFileResponse(client, fileId, true).then((response) => response.blob()).catch(async (error: unknown) => {
    const cached = await readCachedProjectFile(fileId).catch(() => null);
    if (cached) return cached;
    throw error;
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function openProjectFile(client: SupabaseClient, fileId: string, filename: string) {
  const previewWindow = window.open("about:blank", "_blank");
  try {
    const blob = await loadProjectFileBlob(client, fileId);
    const url = URL.createObjectURL(blob);
    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.location.replace(url);
    } else {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.title = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    previewWindow?.close();
    throw error;
  }
}

/**
 * The bytes of one project file. Every successful read leaves a copy on the device, and a
 * read that cannot reach the network uses that copy. A supervisor who opened a photo once,
 * or who made the project available offline, keeps seeing it in the field.
 */
export async function loadProjectFileBlob(client: SupabaseClient, fileId: string, projectId = "") {
  try {
    const response = await authorizedFileResponse(client, fileId);
    const blob = await response.blob();
    await cacheProjectFile(fileId, projectId, blob).catch(() => undefined);
    return blob;
  } catch (error) {
    const cached = await readCachedProjectFile(fileId).catch(() => null);
    if (cached) return cached;
    throw error;
  }
}

export async function loadProjectFileObjectUrl(client: SupabaseClient, fileId: string) {
  const preview = await loadProjectFilePreviewObjectUrl(client, fileId);
  if (!preview.mimeType.startsWith("image/")) {
    URL.revokeObjectURL(preview.url);
    throw new Error("The selected file is not a supported image.");
  }
  return preview.url;
}

export async function loadProjectFilePreviewObjectUrl(client: SupabaseClient, fileId: string) {
  const blob = await loadProjectFileBlob(client, fileId);
  if (!blob.type.startsWith("image/") && blob.type !== "application/pdf") {
    throw new Error("The selected file is not a supported drawing preview.");
  }
  return { url: URL.createObjectURL(blob), mimeType: blob.type };
}

/**
 * Puts one file on the device on purpose, for "make this project available offline". It is
 * skipped when the same file is already stored, so a second run only fetches what is new.
 */
export async function storeProjectFileOffline(client: SupabaseClient, fileId: string, projectId: string) {
  const existing = await readCachedProjectFile(fileId).catch(() => null);
  if (existing) return { bytes: existing.size, alreadyStored: true };
  const response = await authorizedFileResponse(client, fileId);
  const blob = await response.blob();
  await cacheProjectFile(fileId, projectId, blob);
  return { bytes: blob.size, alreadyStored: false };
}
