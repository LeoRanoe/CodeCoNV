import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";

const port = 3187;
const baseUrl = `http://127.0.0.1:${port}`;
let server;

before(async () => {
  const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
  server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [];
  server.stdout.on("data", (chunk) => output.push(String(chunk)));
  server.stderr.on("data", (chunk) => output.push(String(chunk)));
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next.js exited before the smoke test:\n${output.join("")}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The server socket is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  throw new Error(`Next.js did not become ready:\n${output.join("")}`);
});

after(() => {
  server?.kill();
});

async function render() {
  return fetch(baseUrl, { headers: { accept: "text/html" } });
}

test("server-renders the public CODECO landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.match(response.headers.get("strict-transport-security") ?? "", /max-age=63072000/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");

  const html = await response.text();
  assert.match(html, /<title>Architecture &amp; Engineering in Suriname \| CODECO N\.V\.<\/title>/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.codeconv\.com\/?"/i);
  assert.match(html, /application\/ld\+json/i);
  assert.match(html, /ProfessionalService/i);
  assert.match(html, /Architecture &amp; engineering/i);
  assert.match(html, /Paramaribo, Suriname/i);
  assert.match(html, /codeco-logo\.png/);
  assert.match(html, /CODECO Construction Designers &amp; Consultants N\.V\./);
  assert.match(html, /built for Suriname/i);
  assert.match(html, /Start a project/i);
  assert.match(html, /Newmont Recreation Centre/i);
  assert.match(html, /Kwattaweg 717E/i);
  assert.doesNotMatch(html, /href="\/supervisie/i);
  assert.match(html, /manifest\.webmanifest/i);
  assert.match(html, /rel="icon"[^>]+codeco-logo\.png/i);
  assert.doesNotMatch(html, /Sitezicht|codex-preview|Building your site|react-loading-skeleton/i);
});

test("serves branded recovery pages and install metadata", async () => {
  const missing = await fetch(`${baseUrl}/route-die-niet-bestaat-codeco-qa`);
  assert.equal(missing.status, 404);
  const missingHtml = await missing.text();
  assert.match(missingHtml, /Page not found \/ Pagina niet gevonden/i);
  assert.match(missingHtml, /codeco-logo\.png/i);

  const manifestResponse = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get("content-type") ?? "", /^application\/manifest\+json\b/i);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.short_name, "CODECO");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.icons[0].src, "/codeco-logo.png");
});

test("keeps the mobile landing experience intentional and touch friendly", async () => {
  const [page, navigation, motion, landingCss] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/landing-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/landing-motion.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/landing.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /studio-project-grid/);
  assert.match(page, /studio-footer-top/);
  assert.match(page, /info@codeconv\.com/);
  assert.match(page, /Kwattaweg 717E/);
  assert.match(navigation, /aria-expanded=/);
  assert.match(navigation, /event\.key === "Escape"/);
  assert.match(navigation, /studio-mobile-overlay/);
  assert.match(page, /studio-hero-aperture/);
  assert.match(page, /studio-hero-line/);
  assert.match(page, /data-reveal="project"/);
  assert.match(page, /studio-icon-arrow/);
  assert.doesNotMatch(`${page}${navigation}`, /[→↗↓]/);
  assert.match(motion, /IntersectionObserver/);
  assert.match(motion, /requestAnimationFrame/);
  assert.match(motion, /prefers-reduced-motion/);
  assert.match(landingCss, /min-height: 100svh/);
  assert.match(landingCss, /scroll-snap-type: x mandatory/);
  assert.match(landingCss, /flex: 0 0 84vw/);
  assert.match(landingCss, /studio-aperture-line/);
  assert.match(landingCss, /studio-line-reveal/);
  assert.match(landingCss, /prefers-reduced-motion/);
});

test("keeps the central post-MVP interaction and accessibility hooks in source", async () => {
  const [app, operationalWorkspace, page, supervisionPage, layout, packageJson, dailyReportForm, actionForm, userForm, dataLayer, pdfReport, providers, adminRoute, storageClient, storageUploadRoute, storageCompleteRoute, storageFileRoute] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/supervisie/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/forms/daily-report.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/forms/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/forms/users.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/daily-report-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/providers.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/storage/gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/storage/uploads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/storage/uploads/complete/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/storage/files/[fileId]/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /aria-modal="true"/);
  assert.match(app, /event\.key === "Escape"/);
  assert.match(app, /PASSWORD_RECOVERY/);
  assert.match(app, /resetPasswordForEmail/);
  assert.match(app, /keepFocusInside/);
  assert.match(app, /aria-live=/);
  assert.match(app, /timeZone: "America\/Paramaribo"/);
  assert.match(app, /greetingForSuriname/);
  assert.match(app, /Good afternoon|Goedemiddag/);
  assert.match(app, /setInterval\(\(\) => setClock\(new Date\(\)\), 60_000\)/);
  assert.match(app, /WorkspaceStage/);
  assert.match(app, /Werkdag starten/);
  assert.match(app, /Aanwezigheid vandaag/);
  assert.match(app, /Hoe is het project vandaag gegaan\?/);
  assert.match(app, /Wat was het werkelijke weer\?/);
  assert.match(app, /Triggered by|Geactiveerd door/);
  assert.match(app, /Dagvragen bevestigen/);
  assert.match(app, /useForm<DailyCloseoutAnswers>/);
  assert.match(app, /zodResolver\(localizedDailyCloseoutSchema\)/);
  assert.match(app, /setEntries/);
  assert.match(app, /signInWithPassword/);
  assert.doesNotMatch(app, /\.auth\.signUp\(/);
  assert.doesNotMatch(app, />Account maken</);
  assert.match(app, /Alleen medewerkers die door een organisatiebeheerder zijn uitgenodigd/);
  assert.match(app, /Gebruikers en toegang/);
  assert.match(app, /UserAdminModal/);
  assert.match(operationalWorkspace, /Managementoverzicht/);
  assert.match(operationalWorkspace, /Bewijsreferenties, nooit geheimen/);
  assert.match(operationalWorkspace, /updateProductionReadiness/);
  assert.match(app, /must_set_password/);
  assert.match(app, /bootstrapOrganization/);
  assert.match(app, /createProjectWorkspace/);
  assert.match(app, /Centraal opgeslagen/);
  assert.match(app, /Supabase Realtime/);
  assert.match(app, /postgres_changes/);
  assert.doesNotMatch(app, /Demosessie|Kwattaweg Residence|Commewijne Port Facility/);
  assert.match(page, /Architecture &amp; engineering/);
  assert.match(page, /Kwattaweg 717E/);
  assert.doesNotMatch(page, /href="\/supervisie/);
  assert.match(supervisionPage, /CodecoSupervisionApp/);
  assert.match(supervisionPage, /Providers/);
  assert.match(supervisionPage, /index: false/);
  assert.match(layout, /<html lang="en"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(packageJson, /react-hook-form/);
  assert.match(packageJson, /"zod"/);
  assert.match(packageJson, /@tanstack\/react-query/);
  assert.match(packageJson, /@react-pdf\/renderer/);
  assert.match(packageJson, /@vercel\/blob/);
  assert.match(dailyReportForm, /clientReportSections/);
  assert.match(dailyReportForm, /AUTO-HSE-01/);
  assert.doesNotMatch(dailyReportForm, /previousDayWorkers = 41/);
  assert.match(actionForm, /projectActionSchema/);
  assert.match(actionForm, /actionTransitionSchema/);
  assert.match(userForm, /internalUserInviteSchema/);
  assert.match(app, /Geen AI|No AI/i);
  assert.match(dataLayer, /saveProjectStart/);
  assert.match(dataLayer, /saveSiteRegistration/);
  assert.match(dataLayer, /saveAttendance/);
  assert.match(dataLayer, /saveDailyCloseout/);
  assert.match(dataLayer, /submitReportForReview/);
  assert.match(dataLayer, /createProjectAction/);
  assert.match(dataLayer, /transitionProjectAction/);
  assert.match(dataLayer, /surinameLocalDateTimeToIso/);
  assert.match(dataLayer, /-03:00/);
  assert.match(dataLayer, /loadInternalAccess/);
  assert.match(dataLayer, /inviteInternalUser/);
  assert.match(adminRoute, /inviteUserByEmail/);
  assert.match(adminRoute, /can_manage_organization_members/);
  assert.match(adminRoute, /SUPABASE_SECRET_KEY/);
  assert.match(adminRoute, /process\.env/);
  assert.doesNotMatch(adminRoute, /cloudflare:workers/);
  assert.doesNotMatch(adminRoute, /NEXT_PUBLIC_SUPABASE_SECRET_KEY|SERVICE_ROLE/);
  assert.match(storageClient, /\/api\/storage\/uploads/);
  assert.match(storageClient, /XMLHttpRequest/);
  assert.doesNotMatch(storageClient, /NEXT_PUBLIC_STORAGE_GATEWAY_URL|Google Drive/);
  assert.match(storageUploadRoute, /issueSignedToken/);
  assert.match(storageUploadRoute, /presignUrl/);
  assert.match(storageUploadRoute, /authenticateStorageRequest/);
  assert.match(storageUploadRoute, /blob_upload/);
  assert.match(storageCompleteRoute, /can_manage_project_files/);
  assert.match(storageCompleteRoute, /head\(input\.data\.pathname\)/);
  assert.match(storageCompleteRoute, /blob\.size !== file\.size_bytes/);
  assert.match(storageFileRoute, /access: "private"/);
  assert.match(storageFileRoute, /authenticateStorageRequest/);
  assert.match(pdfReport, /CONSTRUCTIESUPERVISIE/);
  assert.match(pdfReport, /17–19\. Foto's, bijlagen en controle/);
  assert.match(providers, /QueryClientProvider/);
});

test("keeps standard photo and optional 360 annotation production paths", async () => {
  const [workspace, app, operations, migration, i18n, vercel] = await Promise.all([
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202607180020_visual_evidence_and_annotations.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/i18n.tsx", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ]);

  assert.match(workspace, /Standard photo/);
  assert.match(workspace, /360° panorama/);
  assert.match(workspace, /EquirectangularAdapter/);
  assert.match(workspace, /xRatio/);
  assert.match(workspace, /yaw/);
  assert.match(workspace, /createVisualAnnotationFinding/);
  assert.match(app, /type === "photo"/);
  assert.match(app, /setInitialProjectTab\("visual"\)/);
  assert.match(operations, /create_visual_annotation_finding/);
  assert.match(migration, /create table public\.visual_captures/);
  assert.match(migration, /create table public\.visual_annotations/);
  assert.match(migration, /'annotation'/);
  assert.match(i18n, /codeco-language/);
  assert.match(i18n, /language === "en"/);
  assert.match(vercel, /"framework": "nextjs"/);
});

test("keeps scheduled backups, retention and daily notification automation enforceable", async () => {
  const [backupServer, cronRoute, migration, vercel, envExample] = await Promise.all([
    readFile(new URL("../lib/backups/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cron/daily/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202607190003_automated_vercel_blob_backups.sql", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(backupServer, /access: "private"/);
  assert.match(backupServer, /await get\(pathname/);
  assert.match(backupServer, /BACKUP_BLOB_CHECKSUM_MISMATCH/);
  assert.match(backupServer, /sorted\.slice\(0, 7\)/);
  assert.match(backupServer, /weeks\.size >= 4/);
  assert.match(backupServer, /months\.size >= 3/);
  assert.match(cronRoute, /timingSafeEqual/);
  assert.match(cronRoute, /runScheduledOrganizationBackup/);
  assert.match(cronRoute, /refresh_all_project_notifications/);
  assert.match(cronRoute, /record_scheduled_backup_failure/);
  assert.match(migration, /build_scheduled_backup_export/);
  assert.match(migration, /build_organization_backup_manifest/);
  assert.match(migration, /retention_tier/);
  assert.match(migration, /service_role/);
  assert.match(migration, /Automatische back-up mislukt/);
  assert.match(vercel, /"schedule": "0 7 \* \* \*"/);
  assert.match(envExample, /^CRON_SECRET=/m);
});

test("keeps the online-first Supabase foundation enforceable", async () => {
  const [migration, questionnaireMigration, liveFlowMigration, actionMigration, accountMigration, readinessMigration, blobMigration, blobReadinessMigration, supabaseClient, envExample, supabaseConfig] = await Promise.all([
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
    readFile(
      new URL("../../../supabase/migrations/202607180004_action_workflow_realtime.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../../supabase/migrations/202607180005_internal_account_administration.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../../supabase/migrations/202607180019_production_readiness_checklist.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../../supabase/migrations/202607190001_vercel_blob_storage.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../../supabase/migrations/202607190002_refresh_vercel_blob_readiness.sql", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/supabase/client.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/config.toml", import.meta.url), "utf8"),
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
  assert.match(actionMigration, /create table public\.action_updates/);
  assert.match(actionMigration, /create or replace function public\.create_project_action/);
  assert.match(actionMigration, /create or replace function public\.transition_project_action/);
  assert.match(actionMigration, /alter publication supabase_realtime add table/);
  assert.match(accountMigration, /create or replace function public\.provision_internal_user/);
  assert.match(accountMigration, /create or replace function public\.list_internal_access/);
  assert.match(accountMigration, /Only an organization administrator can create another organization/);
  assert.match(readinessMigration, /alter table public\.production_readiness_items enable row level security/);
  assert.match(readinessMigration, /Missing organization\.manage permission/);
  assert.match(readinessMigration, /Completion evidence is required/);
  assert.match(readinessMigration, /revoke all on function public\.update_production_readiness_item/);
  assert.match(blobMigration, /rename column drive_file_id to storage_object_key/);
  assert.match(blobMigration, /can_manage_project_files/);
  assert.match(blobMigration, /vercel_blob/);
  assert.match(blobMigration, /blob_upload/);
  assert.match(blobReadinessMigration, /create or replace function app_private\.seed_production_readiness_items/);
  assert.match(blobReadinessMigration, /ACC-VERCEL-STORAGE/);
  assert.match(blobReadinessMigration, /CFG-BLOB-ROUTES/);
  assert.match(blobReadinessMigration, /OPS-BLOB-QUOTA/);
  assert.match(supabaseConfig, /\[auth\][\s\S]*enable_signup = false/);
  assert.match(supabaseConfig, /\[auth\.email\][\s\S]*enable_signup = true/);
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
