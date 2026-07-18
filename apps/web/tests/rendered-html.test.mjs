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

test("server-renders the required CODECO project entry point", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Vandaag \| CODECO Supervisie<\/title>/i);
  assert.match(html, /CODECO N\.V\./);
  assert.match(html, /Mijn projecten/);
  assert.match(html, /Waar ga je vandaag werken\?/);
  assert.match(html, /Kwattaweg Residence/);
  assert.match(html, /Commewijne Port Facility/);
  assert.doesNotMatch(html, /Sitezicht|codex-preview|Building your site|react-loading-skeleton/i);
});

test("keeps the MVP interaction and accessibility hooks in source", async () => {
  const [app, page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(app, /aria-modal="true"/);
  assert.match(app, /event\.key === "Escape"/);
  assert.match(app, /timeZone: "America\/Paramaribo"/);
  assert.match(app, /WorkspaceStage/);
  assert.match(app, /Projectstart openen/);
  assert.match(app, /Aanwezigheid vandaag/);
  assert.match(app, /setEntries/);
  assert.match(app, /Demosessie · niet centraal opgeslagen/);
  assert.doesNotMatch(app, /Alles opgeslagen|centraal opgeslagen met project-/);
  assert.match(page, /CodecoSupervisionApp/);
  assert.match(layout, /<html lang="nl">/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("keeps the online-first Supabase foundation enforceable", async () => {
  const [migration, supabaseClient, envExample] = await Promise.all([
    readFile(
      new URL("../../../supabase/migrations/202607180001_core_supervision_foundation.sql", import.meta.url),
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
  assert.match(compliance, /Open klantbesluiten/);
  assert.match(clientProfile, /Kwaliteit/);
  assert.match(clientProfile, /Transparantie/);
  assert.match(clientProfile, /projectspecifieke inspectie- en kwaliteitschecklists/i);
});
