import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const inputSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
  projectId: z.uuid(),
  roleCode: z.string().regex(/^[a-z]+(?:_[a-z]+)*$/),
  reason: z.string().trim().min(5).max(500),
});

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json({ error: "De beveiligde rechtenservice is niet geconfigureerd." }, 503);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!accessToken) return json({ error: "Aanmelden is vereist." }, 401);

  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return json({ error: input.error.issues[0]?.message ?? "Controleer de rechtenwijziging." }, 400);

  const validationClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const userResult = await validationClient.auth.getUser(accessToken);
  if (userResult.error || !userResult.data.user) return json({ error: "Je sessie is verlopen." }, 401);

  const userClient = createClient(supabaseUrl, publishableKey, { accessToken: async () => accessToken });
  const permission = await userClient.rpc("can_manage_organization_members", {
    p_organization_id: input.data.organizationId,
  });
  if (permission.error || permission.data !== true) {
    return json({ error: "Alleen de eigenaar of organisatiebeheerder kan projectrechten aanpassen." }, 403);
  }

  const rateLimit = await userClient.rpc("consume_security_rate_limit", {
    p_action_code: "admin_project_role",
    p_max_requests: 30,
    p_window_minutes: 60,
  });
  if (rateLimit.error) return json({ error: "De beveiligingslimiet kon niet worden gecontroleerd." }, 503);
  if (rateLimit.data !== true) return json({ error: "Te veel rechtenwijzigingen. Probeer het later opnieuw." }, 429);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const [projectResult, roleResult, membershipResult] = await Promise.all([
    admin.from("projects").select("id").eq("id", input.data.projectId).eq("organization_id", input.data.organizationId).maybeSingle(),
    admin.from("roles").select("id,code,name").eq("organization_id", input.data.organizationId).eq("scope", "project").eq("code", input.data.roleCode).eq("active", true).maybeSingle(),
    admin.from("project_memberships").select("id,status").eq("organization_id", input.data.organizationId).eq("project_id", input.data.projectId).eq("user_id", input.data.userId).maybeSingle(),
  ]);
  if (projectResult.error || !projectResult.data) return json({ error: "Het project behoort niet tot deze organisatie." }, 400);
  if (roleResult.error || !roleResult.data) return json({ error: "De geselecteerde projectrol bestaat niet of is niet actief." }, 400);
  if (membershipResult.error || !membershipResult.data) return json({ error: "Deze gebruiker heeft geen toegang tot het geselecteerde project." }, 404);

  const currentRoles = await admin.from("project_member_roles").select("role_id").eq("membership_id", membershipResult.data.id).eq("project_id", input.data.projectId);
  if (currentRoles.error) return json({ error: "De huidige projectrol kon niet worden gecontroleerd." }, 500);
  if ((currentRoles.data ?? []).length !== 1) {
    return json({ error: "Deze account heeft een afwijkende rolconfiguratie. Herstel deze eerst onder databasebeheer." }, 409);
  }
  const previousRoleId = currentRoles.data![0].role_id;

  const update = await admin
    .from("project_member_roles")
    .update({ role_id: roleResult.data.id })
    .eq("membership_id", membershipResult.data.id)
    .eq("project_id", input.data.projectId)
    .eq("role_id", previousRoleId)
    .select("role_id")
    .single();
  if (update.error) return json({ error: "De projectrol kon niet veilig worden aangepast." }, 500);

  const audit = await admin.from("audit_events").insert({
    organization_id: input.data.organizationId,
    project_id: input.data.projectId,
    actor_user_id: userResult.data.user.id,
    operation: "STATUS",
    table_name: "project_member_roles",
    record_id: membershipResult.data.id,
    old_values: { role_id: previousRoleId },
    new_values: { role_id: roleResult.data.id, role_code: roleResult.data.code, reason: input.data.reason, user_id: input.data.userId },
  });
  if (audit.error) {
    await admin.from("project_member_roles").update({ role_id: previousRoleId }).eq("membership_id", membershipResult.data.id).eq("role_id", roleResult.data.id);
    return json({ error: "De rechtenwijziging is teruggedraaid omdat de auditregel niet kon worden opgeslagen." }, 500);
  }

  return json({ result: { userId: input.data.userId, projectId: input.data.projectId, roleCode: roleResult.data.code } });
}
