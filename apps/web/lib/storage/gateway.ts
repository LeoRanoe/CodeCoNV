import type { SupabaseClient } from "@supabase/supabase-js";

export const storageGatewayUrl = process.env.NEXT_PUBLIC_STORAGE_GATEWAY_URL?.trim().replace(/\/$/, "") ?? "";
export const isStorageGatewayConfigured = Boolean(storageGatewayUrl);

async function accessToken(client: SupabaseClient) {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Je sessie is verlopen. Meld je opnieuw aan.");
  return data.session.access_token;
}

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function gatewayError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? `Opslaggateway gaf status ${response.status}.`;
}

export async function uploadProjectFile(
  client: SupabaseClient,
  input: {
    projectId: string;
    buildingId: string;
    category: string;
    file: File;
    onProgress?: (percent: number) => void;
  },
) {
  if (!isStorageGatewayConfigured) throw new Error("De private Google Drive-gateway is nog niet gekoppeld.");
  const token = await accessToken(client);
  input.onProgress?.(1);
  const sha256 = await sha256Hex(input.file);
  input.onProgress?.(4);
  const initiation = await fetch(`${storageGatewayUrl}/v1/uploads/initiate`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      buildingId: input.buildingId,
      name: input.file.name,
      mimeType: input.file.type || "application/octet-stream",
      sizeBytes: input.file.size,
      sha256,
      category: input.category,
    }),
  });
  if (!initiation.ok) throw new Error(await gatewayError(initiation));
  const session = await initiation.json() as { fileId: string; uploadToken: string; chunkSize: number };
  const chunkSize = Math.max(256 * 1024, session.chunkSize);
  let offset = 0;
  while (offset < input.file.size) {
    const endExclusive = Math.min(offset + chunkSize, input.file.size);
    const chunk = input.file.slice(offset, endExclusive);
    const response = await fetch(`${storageGatewayUrl}/v1/uploads/chunk`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "x-upload-token": session.uploadToken,
        "content-type": input.file.type || "application/octet-stream",
        "content-range": `bytes ${offset}-${endExclusive - 1}/${input.file.size}`,
      },
      body: chunk,
    });
    if (!response.ok) throw new Error(await gatewayError(response));
    offset = endExclusive;
    input.onProgress?.(Math.min(100, 4 + Math.round((offset / input.file.size) * 96)));
  }
  return { fileId: session.fileId, sha256 };
}

export async function downloadProjectFile(client: SupabaseClient, fileId: string, filename: string) {
  if (!isStorageGatewayConfigured) throw new Error("De private Google Drive-gateway is nog niet gekoppeld.");
  const token = await accessToken(client);
  const response = await fetch(`${storageGatewayUrl}/v1/files/${encodeURIComponent(fileId)}/content`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await gatewayError(response));
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function loadProjectFileObjectUrl(client: SupabaseClient, fileId: string) {
  if (!isStorageGatewayConfigured) throw new Error("The private Google Drive gateway is not configured.");
  const token = await accessToken(client);
  const response = await fetch(`${storageGatewayUrl}/v1/files/${encodeURIComponent(fileId)}/content`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await gatewayError(response));
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("The selected file is not a supported image.");
  return URL.createObjectURL(blob);
}
