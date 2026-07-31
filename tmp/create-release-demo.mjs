import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createClient } from "../apps/web/node_modules/@supabase/supabase-js/dist/index.mjs";

const envText = await readFile(new URL("../apps/web/.env", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = env.SUPABASE_SECRET_KEY;
if (!url || !publishableKey || !secretKey) throw new Error("Supabase demo prerequisites are missing.");

const suffix = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const email = `codex.release.${suffix}@example.com`;
const password = `Cd!${randomBytes(18).toString("base64url")}7a`;
const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { display_name: "CODECO Release Demo", release_demo: true },
});
if (created.error || !created.data.user) throw created.error ?? new Error("Demo user was not created.");

try {
  const scaffoldSlug = `release-scaffold-${suffix}`;
  const scaffoldOrganization = await admin
    .from("organizations")
    .insert({ name: "Release authorization scaffold", slug: scaffoldSlug, created_by: created.data.user.id })
    .select("id")
    .single();
  if (scaffoldOrganization.error) throw scaffoldOrganization.error;
  const scaffoldOrganizationId = scaffoldOrganization.data.id;
  const scaffoldRole = await admin
    .from("roles")
    .insert({
      organization_id: scaffoldOrganizationId,
      scope: "organization",
      code: "organization_admin",
      name: "Release administrator",
      is_system: true,
      created_by: created.data.user.id,
    })
    .select("id")
    .single();
  if (scaffoldRole.error) throw scaffoldRole.error;
  const scaffoldMembership = await admin
    .from("organization_memberships")
    .insert({
      organization_id: scaffoldOrganizationId,
      user_id: created.data.user.id,
      status: "active",
      invited_by: created.data.user.id,
    })
    .select("id")
    .single();
  if (scaffoldMembership.error) throw scaffoldMembership.error;
  const scaffoldPermissions = await admin.from("role_permissions").insert({
    organization_id: scaffoldOrganizationId,
    role_id: scaffoldRole.data.id,
    permission_code: "organization.manage",
  });
  if (scaffoldPermissions.error) throw scaffoldPermissions.error;
  const scaffoldAssignment = await admin.from("organization_member_roles").insert({
    organization_id: scaffoldOrganizationId,
    membership_id: scaffoldMembership.data.id,
    role_id: scaffoldRole.data.id,
  });
  if (scaffoldAssignment.error) throw scaffoldAssignment.error;

  const client = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;

  const slug = `codeco-release-${suffix}`;
  const organization = await client.rpc("bootstrap_organization", {
    p_name: "CODECO Release Demo",
    p_slug: slug,
    p_display_name: "CODECO Release Demo",
  });
  if (organization.error) throw organization.error;

  const organizationId = organization.data.id;
  const project = await client.rpc("create_project_workspace", {
    p_organization_id: organizationId,
    p_code: `DEMO-${suffix.slice(-6)}`,
    p_name: "Paramaribo Field Readiness Demo",
    p_location: "Paramaribo, Suriname",
    p_client_name: "Demo Opdrachtgever",
    p_building_code: "B1",
    p_building_name: "Building B1",
    p_contractor_name: "Demo Hoofdaannemer",
  });
  if (project.error) throw project.error;

  process.stdout.write(JSON.stringify({
    email,
    password,
    userId: created.data.user.id,
    organizationId,
    scaffoldOrganizationId,
    project: project.data,
  }));
} catch (error) {
  await admin.auth.admin.deleteUser(created.data.user.id);
  throw error;
}
