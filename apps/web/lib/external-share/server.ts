import { createHash } from "node:crypto";
import { normalizeExternalShareToken } from "@/lib/external-share/token.mjs";
import { createStorageAdminClient } from "@/lib/storage/server";

export type ActiveExternalShare = {
  id: string;
  organization_id: string;
  project_id: string;
  building_id: string | null;
  source_type: "finding" | "action" | "inspection" | "visual";
  source_id: string;
  source_number: string;
  source_file_id: string | null;
  created_by: string;
  expires_at: string;
};

export async function loadActiveExternalShare(token: string) {
  const normalizedToken = normalizeExternalShareToken(token);
  if (!normalizedToken) return null;
  const tokenHash = createHash("sha256").update(normalizedToken).digest("hex");
  const result = await createStorageAdminClient()
    .from("external_share_links")
    .select("id,organization_id,project_id,building_id,source_type,source_id,source_number,source_file_id,created_by,expires_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (result.error || !result.data) return null;
  return result.data as ActiveExternalShare;
}
