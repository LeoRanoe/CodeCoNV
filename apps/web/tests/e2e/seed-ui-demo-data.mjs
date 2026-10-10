// Fills the local fixture project with the records a real week on site leaves behind, plus a
// client (owner) account and a contractor account, so every screen can be looked at populated
// and from every role. Run after seed-local-fixtures.mjs.
//
// LOCAL ONLY. Refuses any Supabase URL that is not a local development host.
//
//   CODECO_E2E_SUPABASE_URL      default http://127.0.0.1:54321
//   CODECO_E2E_PUBLISHABLE_KEY   local publishable/anon key  (`supabase status -o env`)
//   CODECO_E2E_SECRET_KEY        local secret/service key    (`supabase status -o env`)

import { createClient } from "@supabase/supabase-js";

const url = process.env.CODECO_E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey = process.env.CODECO_E2E_PUBLISHABLE_KEY;
const secretKey = process.env.CODECO_E2E_SECRET_KEY;
const host = new URL(url).hostname;
if (!["127.0.0.1", "localhost", "[::1]"].includes(host) && !host.endsWith(".localhost")) {
  console.error(`Refusing to seed demo data into a non-local Supabase project (${host}).`);
  process.exit(2);
}
if (!publishableKey || !secretKey) {
  console.error("CODECO_E2E_PUBLISHABLE_KEY and CODECO_E2E_SECRET_KEY are required (see `supabase status -o env`).");
  process.exit(2);
}

export const accounts = {
  supervisor: { email: "supervisor-a@codeco.test", password: "Local-E2E-Supervisor-A-2026!" },
  client: { email: "client-a@codeco.test", password: "Local-E2E-Client-A-2026!", name: "Client Owner Representative" },
  contractor: { email: "contractor-a@codeco.test", password: "Local-E2E-Contractor-A-2026!", name: "Contractor Site Manager" },
};

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, secretKey, options);
const warn = (step, error) => { if (error) console.warn(`  ! ${step}: ${error.message ?? error}`); return !error; };

async function ensureUser({ email, password, name }) {
  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list.data.users.find((user) => user.email === email);
  if (existing) return existing.id;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } });
  if (created.error) throw new Error(`create ${email}: ${created.error.message}`);
  return created.data.user.id;
}

async function signedIn({ email, password }) {
  const client = createClient(url, publishableKey, options);
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) throw new Error(`sign in ${email}: ${result.error.message}`);
  return client;
}

const supervisor = await signedIn(accounts.supervisor);
const org = (await supervisor.from("organizations").select("id").eq("slug", "codeco-e2e").single()).data;
const project = (await supervisor.from("projects").select("id").eq("organization_id", org.id).eq("code", "E2E-001").single()).data;
const buildings = (await supervisor.from("buildings").select("id, code, name").eq("project_id", project.id).order("code")).data;
const main = buildings.find((b) => b.code === "HOOFD") ?? buildings[0];
const second = buildings.find((b) => b.code === "NB") ?? buildings[1];
const supervisorId = (await supervisor.auth.getUser()).data.user.id;
const parties = (await supervisor.from("parties").select("id, name, party_type").eq("project_id", project.id)).data ?? [];
const contractorParty = parties.find((p) => p.party_type === "contractor") ?? parties[0];

// Stress values (CODECO_E2E_STRESS=1): names as long as real ones get, so clipping and
// wrapping show up on screen. Off by default, because they change what other flows count.
const stress = process.env.CODECO_E2E_STRESS === "1";
const longParty = "Coöperatieve Vereniging van Onderaannemers voor Water- en Wegenbouw Suriname N.V.";
if (stress && !parties.some((p) => p.name === longParty)) {
  warn("long party", (await supervisor.from("parties").insert({ organization_id: org.id, project_id: project.id, code: "LONG-1", name: longParty, party_type: "subcontractor", created_by: supervisorId })).error);
}
if (stress && !buildings.some((b) => b.code === "LANG")) {
  warn("long building", (await supervisor.rpc("create_building", { p_project_id: project.id, p_code: "LANG", p_name: "Bouwblok Noord-West inclusief parkeerkelder en technische ruimte fase 2", p_description: "Stress test" })).error);
}
console.log(`project ${project.id}, buildings ${buildings.map((b) => b.code).join(",")}, parties ${parties.length}`);

// Accounts for the other roles.
for (const [role, account, code] of [["client", accounts.client, "client"], ["contractor", accounts.contractor, "contractor"]]) {
  const id = await ensureUser(account);
  const result = await supervisor.rpc("provision_internal_user", {
    p_organization_id: org.id,
    p_user_id: id,
    p_display_name: account.name,
    p_role_code: code,
    p_project_id: project.id,
  });
  warn(`provision ${role}`, result.error);
}

const printAccounts = () => {
  console.log(`CODECO_E2E_CLIENT_EMAIL=${accounts.client.email}`);
  console.log(`CODECO_E2E_CLIENT_PASSWORD=${accounts.client.password}`);
  console.log(`CODECO_E2E_CONTRACTOR_EMAIL=${accounts.contractor.email}`);
  console.log(`CODECO_E2E_CONTRACTOR_PASSWORD=${accounts.contractor.password}`);
};
// CODECO_E2E_DEMO_DATA=0: only the two role accounts, no records (what the release gate needs).
if (process.env.CODECO_E2E_DEMO_DATA === "0") {
  printAccounts();
  process.exit(0);
}

const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Paramaribo" });
const inDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString();

const report = await supervisor.rpc("create_day_report", { p_project_id: project.id, p_report_date: today, p_idempotency_key: `report:${project.id}:${today}` });
warn("day report", report.error);
const reportId = report.data?.id ?? report.data;

const longTitle = "Hoofdbetonnen kolom op as C-14 op de derde verdieping vertoont een doorgaande scheur bij de aansluiting met de naastliggende wapeningsstaven";
const findings = [
  { type: "deficiency", severity: "high", title: "Scheur in betonnen kolom as B-3", description: "Doorgaande scheur van ongeveer 1,2 meter, breedte 0,4 mm.", building: main },
  { type: "ncr", severity: "critical", title: "Wapening niet conform goedgekeurde tekening", description: "Staafdiameter wijkt af; stort mag niet doorgaan.", building: main },
  { type: "observation", severity: "low", title: longTitle, description: "Foto's volgen.", building: second },
  { type: "deviation", severity: "medium", title: "Afmetingen kozijn wijken af", description: "Maatvoering 12 mm kleiner dan tekening.", building: second },
];
for (const finding of findings) {
  const result = await supervisor.rpc("create_project_finding", {
    p_project_id: project.id, p_building_id: finding.building.id, p_day_report_id: reportId, p_inspection_id: null,
    p_inspection_response_id: null, p_finding_type: finding.type, p_title: finding.title, p_description: finding.description,
    p_severity: finding.severity, p_responsible_party_id: contractorParty?.id ?? null, p_assigned_user_id: null,
    p_idempotency_key: `finding:${finding.title}`, p_issue_management: { issue_type: "quality", disposition: "to_be_corrected" },
  });
  warn(`finding ${finding.title.slice(0, 30)}`, result.error);
}

const actions = [
  { title: "Wapeningskeuring herhalen na correctie", due: inDays(-2), priority: "high", building: main },
  { title: "Opslagzone cement afdekken", due: inDays(1), priority: "normal", building: main },
  { title: "Ontbrekende tekening revisie D opvragen bij de architect", due: inDays(5), priority: "critical", building: second },
];
for (const action of actions) {
  const result = await supervisor.rpc("create_project_action", {
    p_project_id: project.id, p_building_id: action.building.id, p_owner_party_id: null, p_owner_user_id: supervisorId,
    p_title: action.title, p_description: "Opvolging vanuit de dagcontrole.", p_due_at: action.due, p_priority: action.priority,
    p_idempotency_key: `action:${action.title}`, p_location_node_id: null,
  });
  warn(`action ${action.title.slice(0, 30)}`, result.error);
}

for (const [type, title, building] of [
  ["activity", "Betonstort vloer begane grond sectie A", main],
  ["activity", "Metselwerk gevel noord", second],
]) {
  const result = await supervisor.rpc("create_site_registration", {
    p_project_id: project.id, p_building_id: building.id, p_report_date: today, p_registration_type: type, p_title: title,
    p_description: "Werk in uitvoering volgens planning.", p_priority: "normal", p_occurred_at: new Date().toISOString(),
    p_idempotency_key: `registration:${title}`, p_location_node_id: null,
  });
  warn(`registration ${title.slice(0, 30)}`, result.error);
}

const hse = await supervisor.rpc("create_project_hse_event", {
  p_project_id: project.id, p_building_id: main.id, p_day_report_id: reportId, p_event_type: "near_miss", p_title: "Losse steigerplank bijna gevallen",
  p_description: "Plank op 6 meter hoogte, niemand geraakt.", p_severity: "high", p_immediate_measure: "Zone afgezet en plank vastgezet.",
  p_confidential: false, p_occurred_at: new Date().toISOString(), p_idempotency_key: "hse:plank", p_location_node_id: null,
});
warn("hse", hse.error);

for (const [type, title, details] of [
  ["delivery", "Levering betonstaal Ø16", { quantity: 12, unit: "ton", verdict: "accepted" }],
  ["agreement", "Stortplanning vloer 2 afgesproken", {}],
  ["lessons_learned", "Afdekken wapening bij regen", { issue: "Roest door regen", cause: "Geen afdekking", solution: "Zeil over de wapening", expected_results: "Geen roest", follow_up_action: "Zeilen bestellen" }],
]) {
  const result = await supervisor.rpc("create_project_register_entry", {
    p_project_id: project.id, p_building_id: main.id, p_day_report_id: reportId, p_register_type: type, p_title: title,
    p_occurred_at: new Date().toISOString(), p_due_at: null, p_responsible_party_id: contractorParty?.id ?? null,
    p_details: details, p_idempotency_key: `register:${title}`,
  });
  warn(`register ${type}`, result.error);
}

printAccounts();
