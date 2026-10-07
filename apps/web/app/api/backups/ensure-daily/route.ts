import { z } from "zod";
import { runScheduledOrganizationBackup } from "@/lib/backups/server";
import {
  authenticateStorageRequest,
  createStorageAdminClient,
  isBackupStoreConfigured,
  storageErrorResponse,
  storageJson,
} from "@/lib/storage/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({ organizationId: z.uuid() });

export async function POST(request: Request) {
  try {
    const { user } = await authenticateStorageRequest(request);
    const input = requestSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return storageJson({ error: "Ongeldige organisatie voor de back-upcontrole." }, 400);

    const admin = createStorageAdminClient();
    const membership = await admin
      .from("organization_memberships")
      .select("id")
      .eq("organization_id", input.data.organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (membership.error) throw membership.error;
    if (!membership.data) return storageJson({ error: "Geen toegang tot deze organisatie." }, 403);

    const assignedRoles = await admin
      .from("organization_member_roles")
      .select("role_id")
      .eq("organization_id", input.data.organizationId)
      .eq("membership_id", membership.data.id);
    if (assignedRoles.error) throw assignedRoles.error;
    const roleIds = (assignedRoles.data ?? []).map((row) => String(row.role_id));
    if (!roleIds.length) return storageJson({ error: "Back-upbeheer is niet toegestaan." }, 403);

    const permission = await admin
      .from("role_permissions")
      .select("role_id")
      .eq("organization_id", input.data.organizationId)
      .eq("permission_code", "backup.manage")
      .in("role_id", roleIds)
      .limit(1)
      .maybeSingle();
    if (permission.error) throw permission.error;
    if (!permission.data) return storageJson({ error: "Back-upbeheer is niet toegestaan." }, 403);
    if (!isBackupStoreConfigured()) return storageJson({ error: "De private back-upopslag is niet geconfigureerd." }, 503);

    const backup = await runScheduledOrganizationBackup(admin, input.data.organizationId);
    return storageJson({
      ok: true,
      backupRunId: backup.backupRunId,
      status: backup.status,
      verified: backup.status === "verified" || backup.status === "skipped",
    });
  } catch (error) {
    return storageErrorResponse(error, request, "backup");
  }
}
