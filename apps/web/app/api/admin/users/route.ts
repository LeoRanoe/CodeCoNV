import { createClient } from "@supabase/supabase-js";
import { internalUserInviteSchema } from "@/lib/forms/users";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as Partial<Record<
    "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" | "SUPABASE_SECRET_KEY",
    string
  >>;
  const supabaseUrl = runtimeEnv.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = runtimeEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = runtimeEnv.SUPABASE_SECRET_KEY?.trim();
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json({ error: "De beveiligde uitnodigingsservice is niet geconfigureerd." }, 503);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!accessToken) return json({ error: "Aanmelden is vereist." }, 401);

  const input = internalUserInviteSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return json({ error: input.error.issues[0]?.message ?? "Controleer de uitnodigingsgegevens." }, 400);
  }

  const validationClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const userResult = await validationClient.auth.getUser(accessToken);
  if (userResult.error || !userResult.data.user) return json({ error: "Je sessie is verlopen." }, 401);

  const userClient = createClient(supabaseUrl, publishableKey, {
    accessToken: async () => accessToken,
  });

  const permissionResult = await userClient.rpc("can_manage_organization_members", {
    p_organization_id: input.data.organizationId,
  });
  if (permissionResult.error || permissionResult.data !== true) {
    return json({ error: "Alleen een organisatiebeheerder kan accounts uitnodigen." }, 403);
  }

  const roleResult = await userClient
    .from("roles")
    .select("scope")
    .eq("organization_id", input.data.organizationId)
    .eq("code", input.data.roleCode)
    .maybeSingle();
  if (roleResult.error || !roleResult.data) return json({ error: "De geselecteerde rol bestaat niet." }, 400);
  if (roleResult.data.scope === "project" && !input.data.projectId) {
    return json({ error: "Kies een project voor deze projectrol." }, 400);
  }
  if (roleResult.data.scope === "organization" && input.data.projectId) {
    return json({ error: "Een organisatierol kan niet aan één project worden beperkt." }, 400);
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const redirectTo = new URL(request.url).origin;
  const inviteResult = await adminClient.auth.admin.inviteUserByEmail(input.data.email.trim().toLowerCase(), {
    redirectTo,
    data: {
      display_name: input.data.displayName.trim(),
      internal_access: true,
      must_set_password: true,
    },
  });
  if (inviteResult.error || !inviteResult.data.user) {
    const duplicate = /already|registered|exists/i.test(inviteResult.error?.message ?? "");
    return json({
      error: duplicate
        ? "Voor dit e-mailadres bestaat al een account."
        : "De uitnodigingsmail kon niet worden verzonden.",
    }, duplicate ? 409 : 502);
  }

  const provisionResult = await userClient.rpc("provision_internal_user", {
    p_organization_id: input.data.organizationId,
    p_user_id: inviteResult.data.user.id,
    p_display_name: input.data.displayName.trim(),
    p_role_code: input.data.roleCode,
    p_project_id: input.data.projectId || null,
  });
  if (provisionResult.error) {
    await adminClient.auth.admin.deleteUser(inviteResult.data.user.id);
    return json({ error: "Het account is niet aangemaakt omdat de projectrechten niet konden worden vastgelegd." }, 500);
  }

  return json({ invitation: provisionResult.data }, 201);
}
