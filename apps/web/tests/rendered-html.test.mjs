import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the secure CODECO entry point", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Vandaag \| CODECO Supervisie<\/title>/i);
  assert.match(html, /CODECO N\.V\./);
  assert.match(html, /Veilige werkruimte openen/);
  assert.match(html, /sessie en projecttoegang/i);
  assert.doesNotMatch(html, /Sitezicht|codex-preview|Building your site|react-loading-skeleton/i);
});

test("keeps the central MVP interaction and accessibility hooks in source", async () => {
  const [app, page, layout, packageJson, dailyReportForm, dataLayer, pdfReport, providers] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/forms/daily-report.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/daily-report-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/providers.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(app, /aria-modal="true"/);
  assert.match(app, /event\.key === "Escape"/);
  assert.match(app, /timeZone: "America\/Paramaribo"/);
  assert.match(app, /WorkspaceStage/);
  assert.match(app, /Projectstart invullen/);
  assert.match(app, /Aanwezigheid vandaag/);
  assert.match(app, /Hoe is het project vandaag gegaan\?/);
  assert.match(app, /Wat was het werkelijke weer\?/);
  assert.match(app, /Geactiveerd door:/);
  assert.match(app, /Dagvragen bevestigen/);
  assert.match(app, /useForm<DailyCloseoutAnswers>/);
  assert.match(app, /zodResolver\(dailyCloseoutSchema\)/);
  assert.match(app, /setEntries/);
  assert.match(app, /signInWithPassword/);
  assert.match(app, /bootstrapOrganization/);
  assert.match(app, /createProjectWorkspace/);
  assert.match(app, /Centraal opgeslagen/);
  assert.doesNotMatch(app, /Demosessie|Kwattaweg Residence|Commewijne Port Facility/);
  assert.match(page, /CodecoSupervisionApp/);
  assert.match(page, /Providers/);
  assert.match(layout, /<html lang="nl">/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(packageJson, /react-hook-form/);
  assert.match(packageJson, /"zod"/);
  assert.match(packageJson, /@tanstack\/react-query/);
  assert.match(packageJson, /@react-pdf\/renderer/);
  assert.match(dailyReportForm, /clientReportSections/);
  assert.match(dailyReportForm, /AUTO-HSE-01/);
  assert.match(app, /Geen AI|No AI/i);
  assert.match(dataLayer, /saveProjectStart/);
  assert.match(dataLayer, /saveSiteRegistration/);
  assert.match(dataLayer, /saveAttendance/);
  assert.match(dataLayer, /saveDailyCloseout/);
  assert.match(dataLayer, /submitReportForReview/);
  assert.match(pdfReport, /CONSTRUCTIESUPERVISIE/);
  assert.match(pdfReport, /17–19\. Foto's, bijlagen en controle/);
  assert.match(providers, /QueryClientProvider/);
});

test("keeps the online-first Supabase foundation enforceable", async () => {
  const [migration, questionnaireMigration, liveFlowMigration, supabaseClient, envExample] = await Promise.all([
    readFile(
      new URL("../../../supabase/migrations/202607180001_core_supervision_foundation.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../../supabase/migrations/202607180002_daily_questionnaires.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../../supabase/migrations/202607180003_live_workspace_flow.sql", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/supabase/client.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  for (const table of [
    "organizations",
    "projects",
    "buildings",
    "day_reports",
    "attendance_entries",
    "site_registrations",
    "actions",
    "report_versions",
    "audit_events",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
  }

  assert.match(migration, /unique \(project_id, report_date\)/);
  assert.match(migration, /check \(not is_physical or building_id is not null\)/);
  assert.match(migration, /\(select auth\.uid\(\)\)/);
  assert.match(migration, /create trigger audit_events_immutable/);
  assert.match(migration, /create trigger report_versions_immutable/);
  assert.match(migration, /create trigger day_reports_status_guard/);
  assert.match(migration, /create trigger actions_status_guard/);
  assert.match(migration, /idempotency_key/);
  assert.match(supabaseClient, /getSupabaseBrowserClient/);
  assert.match(supabaseClient, /if \(!isSupabaseConfigured\) return null/);
  assert.match(supabaseClient, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(supabaseClient, /SERVICE_ROLE/);
  assert.match(questionnaireMigration, /create table public\.day_start_checks/);
  assert.match(questionnaireMigration, /create table public\.day_closeouts/);
  assert.match(questionnaireMigration, /automation_rules_snapshot/);
  assert.match(questionnaireMigration, /alter table public\.day_start_checks enable row level security/);
  assert.match(questionnaireMigration, /alter table public\.day_closeouts enable row level security/);
  assert.match(liveFlowMigration, /create or replace function public\.create_project_workspace/);
  assert.match(liveFlowMigration, /create or replace function public\.submit_day_report_for_review/);
  assert.match(liveFlowMigration, /attendance_entries_report_party_discipline_key/);
  const configuredEnvKeys = envExample
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .join("\n");
  assert.doesNotMatch(configuredEnvKeys, /SERVICE_ROLE|GOOGLE.*TOKEN/i);
});

test("tracks product-plan and CODECO compliance explicitly", async () => {
  const compliance = await readFile(
    new URL("../../../docs/product/product-plan-compliance.md", import.meta.url),
    "utf8",
  );
  const clientProfile = await readFile(
    new URL("../../../docs/product/client-profile-codeco.md", import.meta.url),
    "utf8",
  );

  assert.match(compliance, /WF-01/);
  assert.match(compliance, /MVP-01/);
  assert.match(compliance, /TA-01/);
  assert.match(compliance, /TA-05/);
  assert.match(compliance, /CDR-01/);
  assert.match(compliance, /CDR-19/);
  assert.match(compliance, /Open klantbesluiten/);
  assert.match(clientProfile, /Kwaliteit/);
  assert.match(clientProfile, /Transparantie/);
  assert.match(clientProfile, /projectspecifieke inspectie- en kwaliteitschecklists/i);
});
