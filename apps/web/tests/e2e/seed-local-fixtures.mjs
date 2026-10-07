// Seeds the two accounts and projects the critical browser flows run against.
//
// LOCAL ONLY. It refuses any Supabase URL that is not a local development host, so it can
// never write synthetic data into a hosted (production) project. The passwords below are
// test values for the local stack only; they exist nowhere else.
//
//   CODECO_E2E_SUPABASE_URL      default http://127.0.0.1:54321
//   CODECO_E2E_PUBLISHABLE_KEY   local publishable/anon key  (`supabase status -o env`)
//   CODECO_E2E_SECRET_KEY        local secret/service key    (`supabase status -o env`)
//
// Prints the fixture identities as KEY=value lines for the Playwright run.

import { createClient } from "@supabase/supabase-js";

const url = process.env.CODECO_E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.CODECO_E2E_PUBLISHABLE_KEY;
const secretKey = process.env.CODECO_E2E_SECRET_KEY;

const host = new URL(url).hostname;
if (!["127.0.0.1", "localhost", "[::1]"].includes(host) && !host.endsWith(".localhost")) {
  console.error(`Refusing to seed fixtures into a non-local Supabase project (${host}).`);
  process.exit(2);
}
if (!publishableKey || !secretKey) {
  console.error("CODECO_E2E_PUBLISHABLE_KEY and CODECO_E2E_SECRET_KEY are required (see `supabase status -o env`).");
  process.exit(2);
}

export const fixtures = {
  supervisorA: { email: "supervisor-a@codeco.test", password: "Local-E2E-Supervisor-A-2026!", name: "Supervisor Alpha" },
  supervisorB: { email: "supervisor-b@codeco.test", password: "Local-E2E-Supervisor-B-2026!", name: "Supervisor Bravo" },
  projectA: { code: "E2E-001", name: "Paramaribo Field Readiness Demo" },
  projectB: { code: "E2E-OTHER", name: "Other Organisation Project" },
};

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, secretKey, options);

function fail(step, error) {
  if (error) {
    console.error(`${step}: ${error.message ?? error}`);
    process.exit(1);
  }
}

async function ensureUser({ email, password, name }) {
  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  fail("list users", list.error);
  const existing = list.data.users.find((user) => user.email === email);
  if (existing) return existing.id;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  fail(`create ${email}`, created.error);
  return created.data.user.id;
}

async function signedIn({ email, password }) {
  const client = createClient(url, publishableKey, options);
  const result = await client.auth.signInWithPassword({ email, password });
  fail(`sign in ${email}`, result.error);
  return client;
}

async function ensureOrganization(client, name, slug, displayName) {
  const existing = await client.from("organizations").select("id").eq("slug", slug).maybeSingle();
  fail("read organization", existing.error);
  if (existing.data) return existing.data.id;
  const created = await client.rpc("bootstrap_organization", { p_name: name, p_slug: slug, p_display_name: displayName });
  fail(`bootstrap ${slug}`, created.error);
  const row = await client.from("organizations").select("id").eq("slug", slug).single();
  fail("read organization", row.error);
  return row.data.id;
}

async function ensureProject(client, organizationId, project) {
  const existing = await client.from("projects").select("id").eq("organization_id", organizationId).eq("code", project.code).maybeSingle();
  fail("read project", existing.error);
  if (existing.data) return existing.data.id;
  const created = await client.rpc("create_project_workspace", {
    p_organization_id: organizationId,
    p_code: project.code,
    p_name: project.name,
    p_location: "Paramaribo",
    p_client_name: "Opdrachtgever E2E",
    p_building_code: "HOOFD",
    p_building_name: "Hoofdgebouw",
    p_contractor_name: "Hoofdaannemer E2E",
  });
  fail(`create project ${project.code}`, created.error);
  const row = await client.from("projects").select("id").eq("organization_id", organizationId).eq("code", project.code).single();
  fail("read project", row.error);
  return row.data.id;
}

const supervisorAId = await ensureUser(fixtures.supervisorA);
const supervisorBId = await ensureUser(fixtures.supervisorB);

const clientA = await signedIn(fixtures.supervisorA);
const organizationA = await ensureOrganization(clientA, "CODECO E2E", "codeco-e2e", fixtures.supervisorA.name);
const projectA = await ensureProject(clientA, organizationA, fixtures.projectA);

// A second building, so multi-building flows have something to choose between.
const secondBuilding = await clientA.rpc("create_building", {
  p_project_id: projectA,
  p_code: "NB",
  p_name: "Nieuwbouw Oost",
  p_description: "Second building for multi-building E2E flows",
});
fail("create second building", secondBuilding.error);

// User B works for a different organization and has no access to project A at all.
const organizationB = await ensureOrganization(clientA, "Other E2E Organisation", "codeco-e2e-other", fixtures.supervisorA.name);
const projectB = await ensureProject(clientA, organizationB, fixtures.projectB);
const provisioned = await clientA.rpc("provision_internal_user", {
  p_organization_id: organizationB,
  p_user_id: supervisorBId,
  p_display_name: fixtures.supervisorB.name,
  p_role_code: "supervisor",
  p_project_id: projectB,
});
fail("provision supervisor B", provisioned.error);

console.log(`CODECO_E2E_EMAIL=${fixtures.supervisorA.email}`);
console.log(`CODECO_E2E_PASSWORD=${fixtures.supervisorA.password}`);
console.log(`CODECO_E2E_PROJECT=${fixtures.projectA.name}`);
console.log(`CODECO_E2E_SECOND_EMAIL=${fixtures.supervisorB.email}`);
console.log(`CODECO_E2E_SECOND_PASSWORD=${fixtures.supervisorB.password}`);
console.log(`CODECO_E2E_SECOND_PROJECT=${fixtures.projectB.name}`);
console.log(`# user A ${supervisorAId}, user B ${supervisorBId}, project A ${projectA}, project B ${projectB}`);
