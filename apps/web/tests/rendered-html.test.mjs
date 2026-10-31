import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile as readRawFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";

// Source assertions are written against LF. A Windows checkout with core.autocrlf yields
// CRLF, which would make every multi-line pattern fail locally while CI passes.
async function readFile(path, encoding) {
  const text = await readRawFile(path, encoding);
  if (typeof text !== "string") return text;
  const normalized = text.replace(/\r\n/g, "\n");
  if (!String(path).endsWith("/app/globals.css")) return normalized;

  // Source checks inspect the complete stylesheet. Keep following local imports as
  // the area styles move out of globals.css; third-party imports have no local source.
  async function expandLocalImports(source, sourceUrl) {
    const parts = [];
    for (const line of source.split("\n")) {
      const match = line.match(/^@import "(\.\/[^"]+\.css)";$/);
      if (match) {
        const importedUrl = new URL(match[1], sourceUrl);
        const imported = (await readRawFile(importedUrl, "utf8")).replace(/\r\n/g, "\n");
        parts.push(await expandLocalImports(imported, importedUrl));
      } else {
        parts.push(line);
      }
    }
    return parts.join("\n");
  }
  return expandLocalImports(normalized, path);
}

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
  assert.match(response.headers.get("content-security-policy") ?? "", /connect-src[^;]*https:\/\/vercel\.com/);
  assert.match(response.headers.get("content-security-policy") ?? "", /connect-src[^;]*blob:/);
  assert.match(response.headers.get("content-security-policy") ?? "", /script-src[^;]*'wasm-unsafe-eval'/);
  assert.doesNotMatch(response.headers.get("content-security-policy") ?? "", /script-src[^;]*'unsafe-eval'/);
  assert.match(response.headers.get("strict-transport-security") ?? "", /max-age=63072000/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");

  const html = await response.text();
  assert.match(html, /<title>Architecture &amp; Engineering in Suriname \| CODECO N\.V\.<\/title>/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.codeconv\.com\/?"/i);
  assert.match(html, /application\/ld\+json/i);
  assert.match(html, /ProfessionalService/i);
  assert.match(html, /Design and engineering for Suriname/i);
  assert.match(html, /Paramaribo, Suriname/i);
  assert.match(html, /codeco-logo\.png/);
  assert.match(html, /CODECO Construction Designers &amp; Consultants N\.V\./);
  assert.match(html, /Design and engineering for Suriname/i);
  assert.match(html, /Start a project/i);
  assert.match(html, /Newmont Recreation Centre/i);
  assert.match(html, /Kwattaweg 717E/i);
  assert.doesNotMatch(html, /href="\/supervisie/i);
  assert.match(html, /manifest\.webmanifest/i);
  // The tab icon is the square app icon set, the same one the phone installs.
  assert.match(html, /rel="icon"[^>]+favicon\.svg/i);
  assert.match(html, /rel="apple-touch-icon"[^>]+icon-192\.png/i);
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
  assert.equal(manifest.start_url, "/supervisie");
  assert.equal(manifest.display, "standalone");
  // The sizes a phone needs before it offers to install the app, plus the maskable icon
  // Android crops to its own shape.
  assert.deepEqual(
    manifest.icons.map((icon) => `${icon.sizes}:${icon.purpose}`),
    ["192x192:any", "512x512:any", "512x512:maskable", "any:any"],
  );
});

test("explains an invalid external-party link without exposing a token error", async () => {
  const response = await fetch(`${baseUrl}/share/not-a-valid-token`);
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /Deze gedeelde link is niet meer beschikbaar/i);
  assert.match(html, /nieuwe link/i);
  assert.doesNotMatch(html, /JWT|invalid token|token expired|stack trace/i);
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
  assert.match(page, /studio-hero-content/);
  assert.doesNotMatch(page, /studio-hero-aperture|data-reveal="project"/);
  assert.match(page, /studio-icon-arrow/);
  assert.doesNotMatch(`${page}${navigation}`, /[→↗↓]/);
  assert.match(motion, /window\.addEventListener\("scroll", updateNavigation/);
  assert.doesNotMatch(motion, /IntersectionObserver|requestAnimationFrame/);
  assert.match(landingCss, /min-height: 100svh/);
  assert.match(landingCss, /scroll-snap-type: x mandatory/);
  assert.match(landingCss, /flex: 0 0 84vw/);
  assert.match(landingCss, /studio-fade-in 320ms/);
  assert.doesNotMatch(landingCss, /studio-aperture-line|studio-line-reveal/);
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
  assert.match(await readFile(new URL("../app/dialog-manager.tsx", import.meta.url), "utf8"), /event\.key === "Escape"/);
  assert.match(app, /PASSWORD_RECOVERY/);
  assert.match(app, /resetPasswordForEmail/);
  assert.match(await readFile(new URL("../app/dialog-manager.tsx", import.meta.url), "utf8"), /inert/);
  assert.match(app, /aria-live=/);
  assert.match(app, /timeZone: "America\/Paramaribo"/);
  assert.match(app, /WorkspaceStage/);
  assert.match(app, /Werkdag starten/);
  // Workforce and the day log are workspace pages now, not pop-ups.
  assert.match(app, /<WorkforceForm/);
  assert.doesNotMatch(app, /WorkforceModal|DailyLogModal/);
  // The overview is the client dashboard. The older greeting dashboard and the secondary
  // module screens were unreachable from every route and have been removed.
  assert.match(app, /<ClientDashboard/);
  assert.doesNotMatch(app, /function TodayView|function SecondaryView/);
  // The day closeout has one form, the day log. The four-step "daily questions" form wrote
  // the same record a second time and is gone.
  assert.match(app, /<DailyLogForm/);
  assert.doesNotMatch(app, /function DailyQuestionsModal/);
  assert.doesNotMatch(app, /setModal\("daily_questions"\)/);
  assert.match(app, /setEntries/);
  assert.match(app, /signInWithPassword/);
  assert.doesNotMatch(app, /\.auth\.signUp\(/);
  assert.doesNotMatch(app, />Account maken</);
  assert.match(app, /Gebruikers en toegang/);
  assert.match(app, /UserAdminModal/);
  // One name for the management screen, whoever opens it (QA sweep M2).
  assert.match(operationalWorkspace, /Beheeroverzicht/);
  assert.match(operationalWorkspace, /Bewijsreferenties, nooit geheimen/);
  assert.match(operationalWorkspace, /updateProductionReadiness/);
  assert.match(app, /must_set_password/);
  assert.match(app, /bootstrapOrganization/);
  assert.match(app, /createProjectWorkspace/);
  assert.match(app, /Centraal opgeslagen/);
  assert.match(app, /Live werkruimte · gesynchroniseerd/);
  assert.match(app, /postgres_changes/);
  assert.doesNotMatch(app, /Demosessie|Kwattaweg Residence|Commewijne Port Facility/);
  assert.match(page, /Design and engineering for Suriname/);
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
  // Items 1–18 are tables built from the report model (tests/daily-report-model.test.mjs);
  // item 19 has its own signature block.
  assert.match(pdfReport, /model\.sections\.map/);
  assert.match(pdfReport, /19\. Controle, naam\/functie en ondertekening/);
  assert.match(providers, /QueryClientProvider/);
});

test("keeps standard photo and validated 360 camera annotation production paths", async () => {
  const [workspace, app, operations, migration, drawingWorkspace, drawingMigration, i18n, vercel] = await Promise.all([
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202607180020_visual_evidence_and_annotations.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/drawing-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202607220001_drawing_pin_workspace.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/i18n.tsx", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ]);

  assert.match(workspace, /360° camera image/);
  // Every 360° image is accepted: the screen describes what was chosen instead of refusing it.
  assert.match(workspace, /describePanoramaImage/);
  assert.match(workspace, /DualFisheyeAdapter/);
  assert.doesNotMatch(workspace, /cameraSourceConfirmed/);
  assert.doesNotMatch(workspace, /A 360° camera image must be a stitched 2:1/);
  assert.doesNotMatch(workspace, /Experimental 360°/);
  assert.match(workspace, /new core\.Viewer/);
  assert.match(workspace, /ReadyEvent/);
  assert.match(workspace, /PanoramaErrorEvent/);
  assert.match(workspace, /xRatio/);
  assert.match(workspace, /yaw/);
  assert.match(workspace, /createVisualAnnotationFinding/);
  assert.match(app, /type === "photo"/);
  // The camera button lands in the photo library, the same place as the Photos tile's own
  // camera, where several photos wait side by side instead of replacing each other.
  assert.match(app, /openWorkspaceModule\("files"\)/);
  assert.match(operations, /create_visual_annotation_finding/);
  assert.match(migration, /create table public\.visual_captures/);
  assert.match(migration, /create table public\.visual_annotations/);
  assert.match(migration, /'annotation'/);
  assert.match(drawingWorkspace, /Drawings workspace/);
  // The link types are the pin legend now: a pin is placed for the record you came with.
  assert.match(drawingWorkspace, /rfi: \{ en: "RFI"/);
  assert.match(drawingWorkspace, /visual: \{ en: "Photo \/ 360°"/);
  assert.match(drawingWorkspace, /pdfjs-dist/);
  assert.match(drawingWorkspace, /xRatio/);
  assert.match(drawingMigration, /create table public\.drawing_pins/);
  assert.match(drawingMigration, /create or replace function public\.create_drawing_pin/);
  assert.match(drawingMigration, /alter publication supabase_realtime add table public\.drawing_pins/);
  assert.match(operations, /createDrawingPin/);
  assert.match(i18n, /codeco-language/);
  assert.match(i18n, /language === "en"/);
  assert.match(vercel, /"framework": "nextjs"/);
});

test("implements the handwritten client PDF as required workflows without AI or SMS", async () => {
  const [migration, visualLinkMigration, app, operationalWorkspace, visualWorkspace, dataLayer, fieldTools, dictateButtonModule, drawingWorkspace, periodReport, boqCsv, operations, emailDelivery, pushDelivery, pushClient, pushSubscriptionRoute, dispatchRoute, cronRoute, envExample] = await Promise.all([
    readFile(new URL("../../../supabase/migrations/202607220002_client_pdf_requirements.sql", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202607270002_link_existing_finding_visual.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/field-tools.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dictate-button.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/drawing-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/period-report-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/boq/csv.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/notifications/email.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/notifications/push.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/notifications/push-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/notifications/push-subscriptions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/notifications/dispatch/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cron/daily/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /create table public\.drawing_markups/);
  assert.match(migration, /create table public\.checklist_library_templates/);
  assert.match(migration, /'LIB-' \|\| lpad\(sort_order::text, 3, '0'\)/);
  assert.match(migration, /create or replace function public\.build_period_report_snapshot/);
  assert.match(migration, /create or replace function public\.import_project_boq/);
  assert.match(migration, /email_notifications_enabled/);
  assert.match(migration, /'rfa','inspection_request','boq'/);
  assert.match(app, /project\.openIssues/);
  assert.match(app, /project\.issueCount/);
  assert.match(await readFile(new URL("../lib/forms/disciplines.ts", import.meta.url), "utf8"), /Timmerlieden/);
  // Work ongoing and work completed are asked in the day log, the one closeout form.
  assert.match(await readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"), /Beton en wapening/);
  assert.match(await readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"), /Werk vandaag afgerond/);
  assert.match(dataLayer, /work_ongoing/);
  assert.match(operationalWorkspace, /Bijlage uploaden/);
  assert.doesNotMatch(operationalWorkspace, /Upload contract, technische specificatie of bijlage/);
  assert.match(operationalWorkspace, /uploadProjectFile/);
  assert.match(operationalWorkspace, /Markeer op foto \/ 360°/);
  assert.match(operationalWorkspace, /Plaats op tekening/);
  assert.match(visualWorkspace, /Koppel pointer aan issue/);
  assert.match(operations, /linkVisualAnnotationToFinding/);
  assert.match(visualLinkMigration, /create_visual_annotation_for_finding/);
  assert.match(dataLayer, /finding_type !== "ncr"/);
  assert.match(dataLayer, /"technical_instruction", "site_instruction", "change_order", "variation"/);
  assert.match(dictateButtonModule, /webkitSpeechRecognition/);
  assert.match(fieldTools, /DictateButton/);
  assert.match(fieldTools, /Construction calculator/);
  assert.match(fieldTools, /createRegisterEntry/);
  assert.doesNotMatch(fieldTools, /\bAI\b|SMS/i);
  assert.match(drawingWorkspace, /Revision cloud/);
  assert.match(drawingWorkspace, /createDrawingMarkup/);
  assert.match(drawingWorkspace, /\.dwg/);
  assert.match(periodReport, /Dagelijks, wekelijks, maandelijks of vrij gekozen periode/);
  assert.match(periodReport, /BOQ, voortgang en declaraties/);
  assert.match(boqCsv, /CODECO-BOQ-importsjabloon\.csv/);
  assert.match(operations, /installChecklistLibraryTemplate/);
  assert.match(operations, /buildPeriodReportSnapshot/);
  assert.match(emailDelivery, /https:\/\/api\.resend\.com\/emails/);
  assert.match(emailDelivery, /idempotency-key/);
  assert.match(dispatchRoute, /authenticateStorageRequest/);
  assert.match(dispatchRoute, /notification_push_dispatch/);
  assert.match(dispatchRoute, /sendPendingPushNotifications/);
  assert.match(dispatchRoute, /sendPendingNotificationEmails/);
  assert.match(pushDelivery, /sendPushVerification/);
  assert.match(pushSubscriptionRoute, /await sendPushVerification\(input\.data\)/);
  assert.match(pushClient, /sameApplicationServerKey/);
  assert.match(pushClient, /await subscription\.unsubscribe\(\)/);
  assert.match(cronRoute, /sendPendingNotificationEmails/);
  assert.match(envExample, /^RESEND_API_KEY=/m);
  assert.match(envExample, /^NOTIFICATION_FROM_EMAIL=/m);
  assert.match(envExample, /^NEXT_PUBLIC_VAPID_PUBLIC_KEY=/m);
  assert.match(envExample, /^VAPID_PRIVATE_KEY=/m);
  assert.doesNotMatch(`${migration}${emailDelivery}${dispatchRoute}${cronRoute}`, /twilio|\bsms\b/i);
});

test("implements the late client document set as controlled forms and shared report data", async () => {
  const [workspace, operations, formModel, documentPdf, ncrPdf, dailyPdf, periodPdf, logo, migration, pgtap] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/forms/controlled-project-documents.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/controlled-document-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/ncr-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/daily-report-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/period-report-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/codeco-logo-pdf.png", import.meta.url)),
    readFile(new URL("../../../supabase/migrations/202607240001_client_controlled_documents.sql", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/tests/010_client_controlled_documents.pgtap.sql", import.meta.url), "utf8"),
  ]);

  assert.match(formModel, /codeco\.controlled-document\.v1/);
  assert.match(formModel, /environmental_report/);
  assert.match(formModel, /issueCatalogPresets/);
  assert.match(formModel, /Broken curtain wall glass/);
  assert.match(workspace, /Client B1 issue catalog/);
  assert.match(workspace, /Record inspection progress/);
  assert.match(workspace, /Create controlled document/);
  assert.match(workspace, /Confirm human response/);
  assert.match(operations, /respond_to_controlled_project_document/);
  assert.match(operations, /record_finding_progress/);
  assert.match(operations, /build_client_period_report_snapshot/);
  assert.match(documentPdf, /REQUEST FOR INFORMATION/);
  assert.match(documentPdf, /WORK INSPECTION REQUEST/);
  assert.match(documentPdf, /TECHNICAL INSTRUCTION/);
  assert.match(documentPdf, /RECIPIENT ACKNOWLEDGEMENT/);
  assert.match(ncrPdf, /NON-CONFORMANCE REPORT/);
  assert.match(ncrPdf, /Issue not resolved/);
  assert.match(periodPdf, /Document control matrix/);
  assert.match(periodPdf, /Milieu, social en housekeeping/);
  assert.match(periodPdf, /GEBOUWVOORTGANG/);
  for (const report of [documentPdf, ncrPdf, dailyPdf, periodPdf]) {
    assert.match(report, /codeco-logo-pdf\.png/);
  }
  assert.ok(logo.length > 10_000 && logo.length < 200_000);
  assert.match(migration, /create table public\.finding_progress_updates/);
  assert.match(migration, /100% complete; independent verification is still required/);
  assert.match(migration, /'WIR-' \|\| v_project_code/);
  assert.match(migration, /build_client_period_report_snapshot/);
  assert.match(pgtap, /100 percent stops at ready for human verification/);
});

test("keeps scheduled backups, retention and daily notification automation enforceable", async () => {
  const [backupServer, storageServer, cronRoute, watchdogRoute, backupClient, app, migration, vercel, envExample] = await Promise.all([
    readFile(new URL("../lib/backups/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/storage/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cron/daily/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/backups/ensure-daily/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/backups/client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202607190003_automated_vercel_blob_backups.sql", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  const normalizedBackupServer = backupServer.replace(/\r\n/g, "\n");
  const normalizedStorageServer = storageServer.replace(/\r\n/g, "\n");
  const normalizedApp = app.replace(/\r\n/g, "\n");

  assert.match(normalizedBackupServer, /access: "private"/);
  assert.match(normalizedBackupServer, /BACKUP_BLOB_READ_WRITE_TOKEN[\s\S]*BLOB_READ_WRITE_TOKEN/);
  assert.match(normalizedBackupServer, /await get\(pathname/);
  assert.match(normalizedBackupServer, /BACKUP_BLOB_CHECKSUM_MISMATCH/);
  assert.match(normalizedBackupServer, /sorted\.slice\(0, 7\)/);
  assert.match(normalizedBackupServer, /weeks\.size >= 4/);
  assert.match(normalizedBackupServer, /months\.size >= 3/);
  assert.match(cronRoute, /timingSafeEqual/);
  assert.match(cronRoute, /runScheduledOrganizationBackup/);
  assert.match(cronRoute, /refresh_all_project_notifications/);
  assert.match(cronRoute, /sendPendingNotificationEmails/);
  assert.match(cronRoute, /record_scheduled_backup_failure/);
  assert.match(watchdogRoute, /authenticateStorageRequest/);
  assert.match(watchdogRoute, /permission_code", "backup\.manage"/);
  assert.match(watchdogRoute, /runScheduledOrganizationBackup/);
  assert.match(normalizedStorageServer, /BACKUP_BLOB_READ_WRITE_TOKEN[\s\S]*BLOB_READ_WRITE_TOKEN/);
  assert.match(backupClient, /api\/backups\/ensure-daily/);
  assert.match(normalizedApp, /dailyBackupCheckRef/);
  assert.match(normalizedApp, /ensureDailyBackup/);
  assert.match(migration, /build_scheduled_backup_export/);
  assert.match(migration, /build_organization_backup_manifest/);
  assert.match(migration, /retention_tier/);
  assert.match(migration, /service_role/);
  assert.match(migration, /Automatische back-up mislukt/);
  assert.match(vercel, /"schedule": "0 7 \* \* \*"/);
  assert.match(envExample, /^CRON_SECRET=/m);
  assert.match(envExample, /^BACKUP_BLOB_READ_WRITE_TOKEN=/m);
  assert.match(envExample, /^RESEND_API_KEY=/m);
  assert.match(envExample, /^NOTIFICATION_FROM_EMAIL=/m);
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

test("implements the customer video workflows without external accounts", async () => {
  const [app, dailyLog, operations, offlineQueue, storageGateway, storageUploadRoute, media, sharePage, shareActions, responseRoute, uploadRoute, migration] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/upload-queue.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/storage/gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/storage/uploads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/share/[token]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/share/[token]/external-share-actions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/external-share/[token]/response/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/external-share/[token]/upload/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202607230001_customer_demo_workflows.sql", import.meta.url), "utf8"),
  ]);

  // The one-tap workforce counter was replaced by the client's own daily log format.
  assert.match(app, /DailyLogForm/);
  assert.match(dailyLog, /Construction activity & location|Bouwactiviteit & locatie/);
  assert.match(dailyLog, /QC performed & advice|QC uitgevoerd & advies/);
  assert.match(dailyLog, /Health & safety issues|Gezondheid & veiligheid/);
  assert.match(dailyLog, /General advice to the contractor|Algemeen advies aan de aannemer/);
  // The crew is counted in the Workforce register only; the day log shows the count.
  assert.match(dailyLog, /attendanceTotal/);
  assert.doesNotMatch(dailyLog, /<WorkforceRegister/);
  assert.match(dailyLog, /DictateButton/);
  assert.match(operations, /Create issue", "Issue registreren/);
  assert.match(operations, /findingGroup/);
  assert.match(offlineQueue, /createFinding/);
  assert.match(offlineQueue, /relationship: "before"/);
  assert.match(offlineQueue, /projectSyncLocks/);
  assert.match(offlineQueue, /fileId: upload\.id/);
  assert.match(offlineQueue, /offline-finding:/);
  assert.match(offlineQueue, /existingCapture/);
  assert.match(storageGateway, /fileId\?: string/);
  assert.match(storageUploadRoute, /repeatedReservation/);
  assert.match(storageUploadRoute, /reservationNeedsPreparation/);
  assert.match(storageUploadRoute, /existing\.storage_provider === "vercel_blob"/);
  assert.match(storageUploadRoute, /allowOverwrite: repeatedReservation/);
  assert.match(media, /flaky connection must never prevent the local evidence copy/);
  assert.match(media, /Remove this unsynchronized field file/);
  assert.match(app, /Photo added\. Describe it and save\./);
  assert.match(app, /syncOfflineUploads/);
  assert.match(sharePage, /ExternalShareActions/);
  assert.match(shareActions, /ready_for_verification/);
  assert.match(shareActions, /Probleem melden/);
  assert.match(shareActions, /capture="environment"/);
  assert.match(responseRoute, /submit_external_share_response/);
  assert.match(uploadRoute, /submitted_via_share_id/);
  assert.match(migration, /create table public\.external_share_responses/);
  assert.match(migration, /external[\s\S]{0,80}completion means "ready for CODECO verification"/);
  assert.match(migration, /grant execute on function public\.submit_external_share_response[\s\S]*to service_role/);
  // No SMS gateway and no stored phone numbers: the client asked for a link he can send
  // himself, so the app only opens the phone's own SMS app with the message ready.
  assert.doesNotMatch(`${app}\n${operations}\n${shareActions}`, /twilio|messagebird|sms_gateway|sendSms\(/i);
  assert.match(operations, /sms:\?&body=/);
});

test("minimizes repetitive field typing with controlled quick choices", async () => {
  const [app, operations, visuals, media] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(app, /Choose expected risks|Kies verwachte risico/);
  assert.match(app, /Install formwork|Bekisting plaatsen/);
  assert.match(app, /Perform roofing work|Dakwerk uitvoeren/);
  assert.match(app, /Choose a standard action|Kies een standaardactie/);
  assert.match(app, /actionDeadlineFromToday/);
  assert.match(app, /Choose a standard status note|Kies een standaard statusnotitie/);
  assert.match(operations, /Choose a standard HSE record|Kies een standaard HSE-registratie/);
  assert.match(operations, /Choose a standard register item|Kies een standaard registeritem/);
  assert.match(operations, /Choose the completed measure|Kies de uitgevoerde maatregel/);
  assert.match(visuals, /Choose a common issue|Kies een veelvoorkomend probleem/);
  assert.match(media, /Choose an asset folder|Kies een middelenmap/);
});

test("keeps the project workspace mobile-first and task driven", async () => {
  const [app, operations, workspaceHome, styles] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/project-workspace-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /useState<ProjectTabKey>\("home"\)/);
  // Photos on the workspace open the photo library, not the camera: the client asked to
  // land on the photos first and choose taking, uploading or 360° afterwards.
  assert.doesNotMatch(app, /openQuickCamera=\{openQuickAdd\}/);
  // The "Switch module" dropdown is gone: the client wrote "ik begrijp dit niet, misschien kan
  // het weg" beside it. What is left is the way back and the name of the module you are in;
  // every module is one tap away on the workspace launcher itself.
  assert.doesNotMatch(operations, /mobile-workspace-section-select/);
  assert.doesNotMatch(operations, /text\("Switch module", "Wissel van module"\)/);
  assert.doesNotMatch(operations, /Switch project module/);
  assert.doesNotMatch(styles, /mobile-workspace-section-select/);
  assert.match(operations, /workspace-back-button/);
  assert.match(operations, /workspace-current-module/);
  // The workspace start screen is the client's fifteen-tile launcher, not a hidden legacy hub.
  assert.match(operations, /<ProjectWorkspaceHome/);
  assert.doesNotMatch(operations, /workspace-task-hub/);
  assert.match(workspaceHome, /workspace-launcher-grid/);
  assert.match(workspaceHome, /openPhotoLibrary/);
  assert.match(workspaceHome, /works_ongoing/);
  assert.match(workspaceHome, /works_completed/);
  // Overview is now a visit surface: every tile opens the populated tab and never a
  // blank create form. Creation remains available after the user reaches that tab.
  assert.match(workspaceHome, /openFinding\("issue", false\)/);
  assert.match(workspaceHome, /openFinding\("ncr", false\)/);
  // Four tiles used to land on the same register form holding whatever type was chosen
  // last. Each opens the record it names.
  assert.match(workspaceHome, /id: "technical-instructions"[\s\S]{0,420}registerType: "technical_instruction"/);
  assert.match(workspaceHome, /id: "materials-delivery"[\s\S]{0,420}registerType: "delivery"/);
  assert.match(workspaceHome, /id: "change-order"[\s\S]{0,420}registerType: "change_order"/);
  assert.match(workspaceHome, /id: "agreements-made"[\s\S]{0,420}registerType: "agreement"/);

  assert.match(workspaceHome, /agreements-made/);
  assert.doesNotMatch(workspaceHome, /openRegister\("(wcr|rfi|rfa|inspection_request)"\)/);
  assert.match(workspaceHome, /openTask\("documents", false\)/);
  assert.match(styles, /\.workspace-task-hub/);
  assert.match(styles, /\.overview-shortcut\.mobile-redundant\s*\{\s*display: none/);
  assert.doesNotMatch(operations, /field-flow-launcher/);
});

test("ships automatic project weather, anchor checklists and stacked issue photos", async () => {
  const [app, weatherRoute, weatherRules, anchorLibrary, operations, supabaseOperations, offlineQueue, fieldGuide, styles, migration] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/weather/current/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/weather.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/checklists/anchor-library.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/upload-queue.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/field-guide.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202607260001_codeco_anchor_checklists.sql", import.meta.url), "utf8"),
  ]);

  assert.match(app, /api\/weather\/current/);
  assert.match(app, /Automatically loaded|Automatisch geladen/);
  assert.match(weatherRoute, /geocoding-api\.open-meteo\.com/);
  assert.match(weatherRoute, /api\.open-meteo\.com\/v1\/forecast/);
  assert.match(weatherRules, /weatherConditionFromWmoCode/);
  assert.match(anchorLibrary, /legacyAnchorPrompts/);
  assert.match(anchorLibrary, /LIB-101/);
  assert.match(anchorLibrary, /LIB-102/);
  assert.match(anchorLibrary, /LIB-103/);
  assert.match(operations, /Approve section|Sectie akkoord/);
  assert.match(operations, /Prepare all 3 checklists|Zet alle 3 checklists klaar/);
  assert.match(operations, /addPhotosToStack/);
  assert.match(operations, /Tap a photo to describe, mark or remove it|Tik op een foto om te omschrijven/);
  assert.match(operations, /findingPhotos\.length/);
  assert.match(supabaseOperations, /create_project_checklist/);
  assert.match(supabaseOperations, /anchorChecklistLibrary[\s\S]*\.filter/);
  assert.match(offlineQueue, /findingIds = new Map/);
  assert.match(fieldGuide, /Built-in field guide|Ingebouwde veldgids/);
  assert.match(fieldGuide, /All functions from A to Z|Alle functies van A tot Z/);
  assert.match(fieldGuide, /Photos, folders, offline use and 360°/);
  assert.match(fieldGuide, /Inspections and checklists/);
  assert.match(fieldGuide, /Issues, NCR, HSE and actions/);
  assert.match(fieldGuide, /Backups, status signals and recovery/);
  assert.match(fieldGuide, /onOpenDestination/);
  assert.match(styles, /@media \(max-width: 1024px\)[\s\S]*\.field-guide-trigger[\s\S]*bottom: calc\(84px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(migration, /'LIB-101'/);
  assert.match(migration, /'LIB-102'/);
  assert.match(migration, /'LIB-103'/);
  assert.match(migration, /AUTO_WEATHER/);
  assert.match(migration, /projects_install_codeco_anchor_checklists/);
});

test("hardens controlled external submissions and restores WCR end to end", async () => {
  const migration = await readFile(
    new URL("../../../supabase/migrations/202607300001_external_submission_roles_and_wcr.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /'submissions\.read'/);
  assert.match(migration, /'submissions\.review'/);
  assert.match(migration, /when 'contractor' then array\['submissions\.read','files\.read'\]/);
  assert.match(migration, /when 'client' then array\['submissions\.read','submissions\.review'/);
  assert.match(migration, /register_type in \([\s\S]*'wcr'[\s\S]*'rfi'[\s\S]*'rfa'[\s\S]*'inspection_request'/);
  assert.match(migration, /when 'wcr' then char_length/);
  assert.match(migration, /security definer/);
  assert.match(migration, /has_project_permission\(v_entry\.project_id, 'submissions\.review'\)/);
  assert.match(migration, /grant execute on function public\.respond_to_controlled_project_document[\s\S]*to authenticated/);
});

test("treats every project as a multi-building workspace", async () => {
  const [app, data, migration, dailyPdf, periodPdf] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202607260005_multi_building_daily_reports.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/daily-report-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/period-report-pdf.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(app, /additionalBuildings/);
  assert.match(app, /ManageBuildingsModal/);
  assert.match(app, /setModal\("manage_buildings"\)/);
  assert.match(app, /buildings\.length[\s\S]*in this project/);
  assert.match(app, /allowAll/);
  assert.match(app, /ALL_BUILDINGS/);
  assert.match(data, /createBuilding/);
  assert.match(data, /client\.rpc\("create_building"/);
  assert.match(migration, /create or replace function public\.create_building/);
  assert.match(migration, /unique \(day_report_id, building_id\)/);
  assert.match(dailyPdf, /normalizeRecords/);
  assert.match(periodPdf, /buildingById/);
});

test("keeps employee assignment, editable external rights and openable document history enforceable", async () => {
  const [app, operations, documents, media, data, storage, pushClient, roleRoute, migration, roleRepairMigration] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/project-documents-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/storage/gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/notifications/push-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/project-role/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202607300002_company_employee_task_assignment.sql", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608020001_fix_project_role_assignment.sql", import.meta.url), "utf8"),
  ]);

  assert.match(app, /Assigned company employee/);
  assert.match(app, /defaultProjectRole[\s\S]*external_guest/);
  assert.match(app, /Edit rights|Rechten aanpassen/);
  assert.match(app, /setUserProjectRole/);
  assert.match(operations, /Assign and redistribute project tasks|Projecttaken toewijzen en herverdelen/);
  assert.match(operations, /assignProjectAction/);
  assert.match(operations, /Open record & history|Open dossier & historie/);
  assert.match(operations, /attachment_files/);
  assert.match(documents, /loadProjectFileBlob/);
  assert.match(documents, /document-preview-modal/);
  assert.match(media, /Open file|Bestand openen/);
  assert.match(storage, /export async function openProjectFile/);
  assert.match(data, /agreementCount/);
  assert.match(pushClient, /sameApplicationServerKey/);
  assert.match(roleRoute, /can_manage_organization_members/);
  assert.match(roleRoute, /audit_events/);
  assert.match(roleRoute, /De rechtenwijziging is teruggedraaid/);
  assert.match(migration, /create or replace function public\.assign_project_action/);
  assert.match(migration, /create or replace function public\.set_user_project_role/);
  assert.match(migration, /app_private\.is_company_project_employee/);
  assert.match(migration, /insert into public\.audit_events/);
  assert.match(roleRepairMigration, /create or replace function public\.set_user_project_role/);
  assert.doesNotMatch(roleRepairMigration, /role\.active/);
});

test("makes photo linkage, punch-list marker colours and report topics real", async () => {
  const [operations, media, visual, drawings, operationalWorkspace, periodPdf, periodDocx, styles, markerMigration, historyMigration, originHelper] = await Promise.all([
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/drawing-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/period-report-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/period-report-docx.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202607300004_visual_marker_disposition_and_building.sql", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202607300005_controlled_document_response_history.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/file-origins.ts", import.meta.url), "utf8"),
  ]);

  // A photo must show which record it belongs to; file_links was written but never read.
  assert.match(operations, /client\.from\("file_links"\)\.select/);
  assert.match(operations, /fileLinks\?: FileLink\[\]/);
  assert.match(originHelper, /export function createFileOriginResolver/);
  assert.match(originHelper, /export function filesForRecord/);
  assert.match(media, /media-origin-chips/);
  assert.match(media, /originFilter/);
  assert.match(operationalWorkspace, /RecordPhotoStrip/);
  assert.match(styles, /\.media-origin-chip/);
  assert.match(styles, /\.record-photo-strip/);

  // Marker colour follows the client's punch list, not severity, and is stored as data.
  assert.match(visual, /function markerTone/);
  assert.match(visual, /visual-marker \$\{markerTone\(annotation\)\}/);
  assert.match(styles, /\.visual-marker\.alternative-solution/);
  assert.match(operations, /p_disposition: input\.disposition/);
  assert.match(operations, /p_building_id: input\.buildingId/);
  assert.match(markerMigration, /visual_annotations_disposition_check/);
  assert.match(markerMigration, /Building does not belong to this project/);
  // The marker names every building the image shows, not only one.
  assert.match(visual, /BuildingMultiPicker\s+id="marker-buildings"/);
  // The classification must no longer be smuggled into the description text.
  assert.doesNotMatch(visual, /\[\$\{issue\.disposition\.replaceAll/);

  // An issue can be pinned on a drawing straight from its own card.
  assert.match(operationalWorkspace, /linkDrawing=\{\(finding\) =>/);
  assert.match(drawings, /initialFindingId/);
  assert.match(drawings, /drawing-finding-handoff/);

  // Controlled submissions keep every decision instead of overwriting the last one.
  assert.match(historyMigration, /response_history/);
  assert.doesNotMatch(historyMigration, /jsonb_set\(\s*v_entry\.details,\s*'\{response\}'/);
  assert.match(operationalWorkspace, /controlled-history-timeline/);
  assert.match(styles, /\.controlled-history-timeline/);

  // WCR, RFI, RFA and WIR belong to Management, never to the supervision workspace.
  assert.match(operationalWorkspace, /externalSubmissionRegisterTypes/);
  assert.doesNotMatch(operationalWorkspace, /<strong>WCR<\/strong>/);
  assert.doesNotMatch(operationalWorkspace, /<strong>WIR<\/strong>/);

  // Every one of the fifteen client subjects changes the generated document on its own.
  assert.match(periodPdf, /export type PeriodReportTopic/);
  assert.match(periodPdf, /topics\.has\("works_ongoing"\)/);
  assert.match(periodPdf, /topics\.has\("works_completed"\)/);
  assert.match(periodPdf, /topics\.has\("ncr"\)/);
  assert.match(periodPdf, /topics\.has\("hse_incident"\)/);
  assert.match(periodDocx, /topics\.has\("materials_delivery"\)/);
  assert.match(periodDocx, /topics\.has\("delays"\)/);
  assert.match(operationalWorkspace, /topics: activeTopics/);
});

test("uses the client's own daily log format, a building dropdown and a calm mobile header", async () => {
  const [dailyLog, app, picker, styles] = await Promise.all([
    readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/building-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // The daily log mirrors the day blocks of the client's own weekly report and writes
  // the real closeout, so reports and the Daily work module show the same facts.
  assert.match(dailyLog, /Weather conditions|Weersomstandigheden/);
  assert.match(dailyLog, /Construction activity & location|Bouwactiviteit & locatie/);
  assert.match(dailyLog, /QC performed & advice|QC uitgevoerd & advies/);
  assert.match(dailyLog, /Health & safety issues|Gezondheid & veiligheid/);
  assert.match(dailyLog, /General advice to the contractor|Algemeen advies aan de aannemer/);
  assert.match(dailyLog, /workOngoing: log\.constructionActivity/);
  assert.match(dailyLog, /communication: log\.adviceToContractor/);
  assert.match(app, /saveDailyCloseout\(supabase, \{/);
  assert.doesNotMatch(app, /OneTapDailyLogModal/);

  // Buildings are always a dropdown, never a growing row of buttons, and never sticky.
  assert.match(picker, /<select id=\{id\}/);
  assert.doesNotMatch(picker, /building-picker-compact/);
  assert.match(styles, /\.building-picker-field \{[\s\S]*?position: static/);

  // The phone header keeps project, weather, sync and alerts; language and settings
  // live in the bottom-nav "More" screen instead of crowding the bar.
  assert.match(styles, /\.topbar \.language-switcher,\s*\n\s*\.topbar \.management-button \{\s*\n\s*display: none/);
});

test("processes the five annotated field screens from 31 July", async () => {
  const [app, dailyLog, evidence, picker, dashboard, i18n, queue, styles] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/photo-evidence.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/building-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/client-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/i18n.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/upload-queue.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // Screen 1: the project picker only picks a project. No portfolio counters.
  assert.doesNotMatch(app, /portfolio-dashboard/);
  assert.doesNotMatch(styles, /\.portfolio-dashboard/);
  assert.match(app, /selection-copy[\s\S]{0,180}project\.location/);
  assert.doesNotMatch(app, /className="selection-icon"/);

  // Screen 2: a smaller project header, and photos are called photos.
  assert.match(styles, /\.overview-hero h1 \{[\s\S]*?font-size: clamp\(var\(--text-lg\)/);
  assert.match(dashboard, /label=\{text\("Pictures", "Foto's"\)\}/);
  assert.doesNotMatch(dashboard, /text\("Evidence", "Bewijs"\)/);

  // Screens 3 and 6: Dutch is the default again, a proposed description disappears on
  // the first keystroke, a record can cover several buildings, work packages are the
  // ones from the client's daily report, drawings are selectable as the exact location,
  // and the camera opens inside the record instead of on another page.
  // Only a language picked in the switcher counts; devices that never chose open in Dutch.
  assert.match(i18n, /const chosenLanguageKey = "codeco-language-choice"/);
  assert.match(i18n, /chosen === "en" \|\| chosen === "nl" \? chosen : "nl"/);
  // The loose field-record form these screens described is gone: it filed works and delays
  // as a registration that never showed up in the works lists. Its parts live on in the day
  // log (several buildings, the camera inside the form) and in the workspace modules.
  assert.doesNotMatch(app, /function EntryModal|function QuickAddModal/);
  assert.match(dailyLog, /BuildingMultiPicker/);
  assert.match(picker, /export function BuildingMultiPicker/);
  assert.match(dailyLog, /capture="environment"/);
  assert.match(dailyLog, /<PhotoEvidenceList/);
  assert.doesNotMatch(app, /openPhoto=\{\(\) => chooseType\("photo"\)\}/);
  assert.match(queue, /"inspection" \| "hse" \| "registration"/);
  assert.match(queue, /ensureVisualCapture/);

  // Screen 5: photos of the day can be named and removed, and the workforce block has
  // the standard sentences about manning levels.
  assert.match(dailyLog, /export type DailyLogPhoto/);
  assert.match(dailyLog, /<PhotoEvidenceList/);
  // The naming is now one question instead of a title next to a description, and the report
  // name is taken from the answer.
  assert.match(evidence, /\{text\("Description", "Omschrijving"\)\}/);
  assert.match(evidence, /photo-evidence-remove/);
  assert.match(dailyLog, /workforceNoteChoices/);
  assert.match(dailyLog, /Too few workers|Onvoldoende arbeiders/);
  assert.match(app, /photoTitle\(photo\)\.slice\(0, 120\)/);
});

test("processes the second batch of annotated screens from 31 July", async () => {
  const [app, dailyLog, workspace, , picker, locationPicker, operations, queue, controlledDocuments, styles] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/photo-evidence.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/building-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/location-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/upload-queue.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/forms/controlled-project-documents.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // Daily log: several buildings at once, and workforce rows are added instead of a
  // fixed counter row for every project party.
  assert.match(dailyLog, /BuildingMultiPicker/);
  assert.match(dailyLog, /buildingIds: string\[\]/);
  assert.match(app, /for \(const logBuildingId of targetBuildingIds\)/);
  assert.doesNotMatch(app, /Quick workforce entry or the complete client log/);
  assert.match(picker, /export function BuildingMultiPicker/);

  // An empty location field is noise: it stays away until a location tree exists.
  assert.match(locationPicker, /if \(!available\.length && !depthRequired\) return null/);

  // Opening a module shows its entry form right away.
  assert.match(workspace, /setShowForm\(true\);\s*\n\s*setActiveInspection\(null\)/);

  // HSE: no second Type dropdown next to the situation chips, and every evidence photo
  // can carry the text that says what it shows.
  // Every evidence photo carries the text that says what it shows — now the same fields in
  // every module instead of a caption in two of them.
  assert.match(workspace, /photos=\{hsePhotos\}/);
  assert.match(styles, /\.photo-evidence-row/);
  assert.match(styles, /\.photo-detail-modal/);

  // A started checklist can be reopened from the list and completed.
  assert.match(operations, /export async function loadInspectionResponses/);
  assert.match(workspace, /const resumeInspection = async/);
  assert.match(workspace, /onEdit: inspection\.status[^\n]+resumeInspection\(inspection\)/);
  assert.match(styles, /\.record-row-open/);

  // Controlled documents: project information and dates on top, a chosen author, an
  // optional project-wide scope, a drawing reference and no foreign example presets.
  assert.match(workspace, /controlled-document-context/);
  assert.match(styles, /\.controlled-document-context/);
  assert.match(controlledDocuments, /issuerName: string/);
  assert.match(controlledDocuments, /issued_by: draft\.issuerName\.trim\(\) \|\| context\.currentUserName/);
  assert.match(workspace, /documentIssuerOptions/);
  assert.match(workspace, /technical_instruction: \[\],/);
  assert.doesNotMatch(workspace, /Replacing generator of Central Lab/);
  // A controlled document can apply to the whole project; the building field is the same
  // one as everywhere else, with "All buildings" as its first option.
  assert.match(workspace, /<RecordBuildingsField id="register-buildings"/);
  assert.match(workspace, /buildingIds: selectedRegisterBuildingIds/);
  assert.match(workspace, /registerRecordBuildingId/);
  assert.match(operations, /buildingId: string \| null;/);

  // The bill of quantities no longer sits open under the register form.
  assert.match(workspace, /boq-import-section/);
  assert.match(styles, /\.boq-import-section/);

  // Register items carry site photos, linked to the register entry.
  assert.match(workspace, /register-photo-capture/);
  assert.match(workspace, /recordType: "register_entry"/);
  assert.match(queue, /"registration" \| "register_entry"/);
});

test("lets a new deployment reach an installed field app", async () => {
  const [serviceWorker, providers] = await Promise.all([
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/providers.tsx", import.meta.url), "utf8"),
  ]);

  // Documents are never served from the cache first; that is what kept a deployed
  // change invisible on a phone that had the app installed.
  assert.match(serviceWorker, /const CACHE = "codeco-field-shell-v5"/);
  assert.match(serviceWorker, /const isDocument = request\.mode === "navigate"/);
  assert.match(serviceWorker, /_rsc/);
  assert.doesNotMatch(serviceWorker, /SHELL = \["\/supervisie"/);
  assert.match(serviceWorker, /codeco-activate-update/);

  // The page keeps sw.js out of the HTTP cache, activates a waiting worker and reloads
  // once when that worker takes control.
  assert.match(providers, /updateViaCache: "none"/);
  assert.match(providers, /registration\.update\(\)/);
  assert.match(providers, /controllerchange/);
  assert.match(providers, /hadController/);
  assert.match(providers, /offlineShellReady/);
  assert.match(serviceWorker, /codeco-precache-complete/);
});

test("processes the third batch of annotated screens from 31 July", async () => {
  const [workspace, controlledDocuments, operations, styles] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/forms/controlled-project-documents.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // Issues and NCR are separate modules; the issue screen is for issues only.
  assert.match(workspace, /\["ncr", "NCR"/);
  assert.doesNotMatch(workspace, /finding-scope-switch/);
  assert.doesNotMatch(styles, /\.finding-scope-switch/);
  assert.match(workspace, /const findingScope: "issue" \| "ncr" = tab === "ncr"/);

  // The columns of the client's own Issue Management Template are still filled in, but
  // through the newer screen they sent: the description is section 4, the deadline is
  // section 9, and the owner of the correction stands under the responsible person.
  assert.match(workspace, /expectedResolutionDate: event\.target\.value/);
  assert.match(workspace, /Contractor · owner of the correction|Aannemer · eigenaar van de correctie/);
  // The NCR module keeps the client's own paper form, with its own columns.
  assert.match(workspace, /text\("Date identified", "Datum vastgesteld"\)/);
  assert.match(workspace, /text\("Expected resolution date", "Verwachte oplossingsdatum"\)/);
  assert.match(workspace, /text\("Escalation required", "Escalatie nodig"\)/);
  assert.match(workspace, /Final Resolution & Rationale/);
  // The issue type list became the client's own vocabulary on 4 August; the columns of
  // their Issues_Tracking_Log around it stayed.
  assert.match(workspace, /const issueTypeOptions = \[/);
  assert.match(operations, /date_identified: input\.dateIdentified/);
  assert.doesNotMatch(workspace, /Initial completion date|Eerste opleverdatum/);

  // A register item can be about general material, and a delivery is judged and counted.
  assert.match(workspace, /<RecordBuildingsField id="register-buildings"/);
  assert.match(workspace, /registerQuantityTypes/);
  assert.match(workspace, /Does the delivered material comply\?|Voldoet het geleverde materiaal\?/);
  assert.match(workspace, /text\("Quantity", "Hoeveelheid"\)/);
  assert.match(workspace, /outcome: registerOutcome \|\| null/);

  // The controlled document form asks less, keeps the database valid, is signed by its
  // author and can be sent to the contractor.
  assert.doesNotMatch(workspace, /Issued by position|Functie opsteller/);
  assert.doesNotMatch(workspace, /Requested to \/ recipient name/);
  assert.doesNotMatch(workspace, /Related RFI \/ NCR \/ drawing/);
  assert.doesNotMatch(workspace, /Reason for instruction|Reden voor instructie/);
  assert.match(workspace, /text\("To", "Aan"\)/);
  assert.match(controlledDocuments, /reason: draft\.reason\.trim\(\) \|\| draft\.details\.trim\(\)/);
  assert.match(controlledDocuments, /required_action: draft\.requiredAction \|\| "proceed"/);
  assert.match(controlledDocuments, /signedBy: string/);
  // Signing is the written signature, captured on the form itself, not a checkbox.
  assert.match(workspace, /<SignatureField/);
  assert.match(styles, /\.signature-field/);
  assert.match(workspace, /Send to contractor|Naar aannemer sturen/);
  assert.match(workspace, /const contractorMessage =/);
});

test("fixes what the client saw on the deployed build", async () => {
  const [app, workspace, i18n, sketch, styles] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/i18n.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sketch-pad.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // The field-record form and its parked-record bar are gone with the form itself. The
  // bar now offers back a camera photo that was taken but never saved.
  assert.doesNotMatch(app, /entryDraftParked/);
  assert.match(app, /Back to the photo|Terug naar de foto/);
  assert.match(styles, /\.entry-resume-bar/);

  // A device that never picked a language opens in Dutch, also after using the app before.
  assert.match(i18n, /codeco-language-choice/);

  // Sketching by hand, saved as a photo along the existing evidence road.
  assert.match(sketch, /export function SketchPad/);
  assert.match(sketch, /image\/png/);
  // The sketch stays where a sketch is made on site — inside the day log, next to the
  // photos. The client crossed it off the register form on 5 August.
  assert.match(await readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"), /Make a sketch|Schets maken/);
  assert.doesNotMatch(workspace, /Make a sketch|Schets maken/);
  assert.match(styles, /\.sketch-canvas/);
});

test("processes the annotated screens of 1 August: NCR form, agreement and deadlines", async () => {
  const [workspace, actionCenter, sharePage, shareActions, shareRoute, operations, queue, ncrPdf, ncrDocx, migration, styles] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/project-action-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/share/[token]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/share/[token]/external-share-actions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/external-share/[token]/response/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/upload-queue.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/ncr-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/ncr-docx.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608010001_ncr_contractor_correction.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // #14 · The NCR module opens on its own entry form, and that form carries the boxes
  // of the client's own non-conformance report.
  assert.match(workspace, /const openTask = \(next: ProjectTab, createRecord = true, preset\?: WorkspaceTilePreset\)/);
  assert.match(workspace, /const openFinding = \(scope: "issue" \| "ncr", createRecord = true\)/);
  assert.match(workspace, /ncr-form-context/);
  assert.match(workspace, /Reference checklist \/ earlier report|Referentiechecklist \/ eerder rapport/);
  assert.match(workspace, /Description of non-conformance|Omschrijving van de afwijking/);
  assert.match(workspace, /Recommended action by engineer|Aanbevolen actie door de ingenieur/);
  assert.match(workspace, /Sign as the engineer who issues this NCR|Ondertekenen als ingenieur/);
  assert.match(workspace, /text\("Remarks", "Opmerkingen"\)/);
  assert.match(workspace, /Contractor · receives this NCR|Aannemer · ontvangt deze NCR/);
  assert.match(workspace, /ncr-form-boxes/);
  assert.match(styles, /\.ncr-form-boxes/);
  assert.match(operations, /reference_checklist: input\.referenceChecklist/);
  assert.match(operations, /recommended_action: input\.recommendedAction/);
  assert.match(queue, /referenceChecklist\?: string;/);

  // #14A · After submitting, the link to the contractor stands where you submitted.
  assert.match(workspace, /function SubmittedRecordShare/);
  // The contractor link only exists for a record the database has actually numbered; a
  // record that had to wait on the device gets it after it is sent.
  assert.match(workspace, /setSubmittedFinding\(queuedOffline \? null : created\)/);
  // The record is written with or without a connection: without one it waits on the
  // device and stands in the list, instead of the save simply failing.
  assert.match(workspace, /kind: "finding",\r?\n\s+projectId,/);
  assert.match(workspace, /buildingIds: selectedFindingBuildingIds/);
  assert.match(workspace, /send: \(\) => createFinding\(client, \{ \.\.\.draft, reportId: effectiveReportId \}\)/);
  assert.doesNotMatch(workspace, /createFinding\(client, \{ \.\.\.draft, buildingId: targetBuildingId/);
  assert.match(styles, /\.submitted-record-share/);

  // #14 · The contractor fills the correction in through the link and sends it back.
  assert.match(shareActions, /"ready_for_verification" \| "issue" \| "proposed_correction"/);
  assert.match(shareActions, /Correctie invullen/);
  assert.match(shareActions, /Voorgestelde correctieve actie/);
  assert.match(sharePage, /record\.record_kind === "ncr"/);
  assert.match(sharePage, /external-ncr-instruction/);
  assert.match(shareRoute, /proposed_correction/);
  assert.match(shareRoute, /result\.error\?\.code === "22023"/);
  assert.match(migration, /'ready_for_verification', 'issue', 'proposed_correction'/);
  assert.match(migration, /proposed_correction = btrim\(p_note\)/);
  assert.match(migration, /'record_kind', v_record_kind/);
  assert.match(operations, /correction = ""/);
  assert.match(ncrPdf, /PROPOSED CORRECTIVE ACTION BY CONTRACTOR/);
  assert.match(ncrPdf, /issue\.recommended_action === "rework" \? "\[X\]"/);
  assert.match(ncrDocx, /Proposed corrective action by contractor/);

  // #13 · A change order asks the same as a technical instruction and offers no example
  // from another project.
  assert.match(workspace, /change_order: \[\],/);
  assert.doesNotMatch(workspace, /Wall thickness Building 1–8/);
  assert.match(workspace, /Change description|Omschrijving van de wijziging/);

  // The agreement register is text, the two parties who made it and a signature each.
  assert.match(workspace, /const agreementRegister = registerForm\.type === "agreement"/);
  assert.match(workspace, /<AgreementSignatureFields/);
  // The single "what was agreed?" box grew into the client's own four sections on
  // 9 August; the agreement still says what was agreed, in section 1.
  assert.match(workspace, /Description of agreement|Omschrijving van de afspraak/);
  assert.match(workspace, /agreementSignatureDetails\(agreementForm\)/);
  assert.match(styles, /\.agreement-signatures/);
  assert.match(workspace, /agreement: \[\],/);

  // #15 · The deadline page is about deadlines: no creation date standing in for one,
  // overdue first, and every record that carries a deadline is on it.
  assert.match(actionCenter, /text\("Deadlines", "Deadlines"\)/);
  // The day arithmetic itself moved into a module of its own, tested without React.
  assert.match(actionCenter, /daysUntilOnSite,/);
  assert.match(actionCenter, /from "@\/lib\/actions\/action-center.mjs"/);
  assert.match(actionCenter, /dueAt: finding\.due_at,/);
  assert.doesNotMatch(actionCenter, /finding\.due_at \?\? finding\.created_at/);
  assert.doesNotMatch(actionCenter, /entry\.due_at \?\? entry\.occurred_at/);
  assert.match(actionCenter, /const overdue = \(item: UnifiedItem\)/);
  assert.match(actionCenter, /day\(s\) overdue|dag\(en\) te laat/);
  assert.match(actionCenter, /deadline-summary/);
  assert.match(styles, /\.deadline-summary/);
});

test("keeps the action centre and makes its deadlines and choices true on site", async () => {
  const [workspace, actionCenter, rules, home, app, styles] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/project-action-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/actions/action-center.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/project-workspace-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // The action centre keeps the name the client asked for and gains the deadline view
  // instead of being renamed into one.
  assert.match(actionCenter, /text\("Action center", "Actiecentrum"\)/);
  assert.match(actionCenter, /export type ActionCenterView = "mine" \| "work" \| "deadlines"/);
  assert.match(actionCenter, /action-center-views/);
  assert.match(styles, /\.action-center-views/);
  assert.match(actionCenter, /type WorkFilter = "open" \| "escalated" \| "verification" \| "all"/);
  assert.match(actionCenter, /Waiting for verification|Wacht op verificatie/);
  assert.match(actionCenter, /Escalations · late or urgent|Escalaties · te laat of urgent/);
  // Deadlines are counted in the day on site, and an NCR opens in the NCR module — on the
  // record itself, not on the list it stands in.
  assert.match(rules, /timeZone: siteTimeZone \}\)\.format\(value\)\}T00:00:00Z/);
  assert.match(actionCenter, /openProjectArea\(item\.recordKind === "ncr" \? "ncr" : "findings", item\.id\)/);
  // The deadline tile opens the same page on its deadline view.
  assert.match(home, /openActionCenter\("deadlines"\)/);
  assert.match(app, /const \[actionCenterView, setActionCenterView\]/);
  assert.match(workspace, /initialView=\{actionCenterView\}/);

  // #16 · A photo says in every form that it can be described, marked or removed.
  assert.match(workspace, /const photoCaptureHint = text\(/);
  assert.match(workspace, /describe, mark or remove it|omschrijven, markeren of verwijderen/);
  // Three forms keep the list of photos and its sentence; the two record screens the
  // client drew show a strip of pictures, and say so in their own words.
  assert.equal(workspace.match(/\{photoCaptureHint\}/g)?.length, 3);
  assert.match(workspace, /const photoStripHint = text\(/);
  assert.equal(workspace.match(/\{photoStripHint\}/g)?.length, 2);

  // #16 · The building and location choice is the same field in every form, and
  // "all buildings" is stored instead of failing.
  assert.match(workspace, /RecordBuildingsField id="hse-buildings"/);
  assert.match(workspace, /const projectWideHse = selectedHseBuildingIds\.length === buildings\.length/);
  // The punchlist names the buildings it covers, and "All buildings" is selecting every
  // one of them in the same control. Project-wide still associates the one numbered
  // record with every building instead of cloning it.
  assert.match(workspace, /const selectedFindingBuildingIds = findingBuildingIds\.length \? findingBuildingIds : \[findingBuildingId\]/);
  assert.match(workspace, /const projectWideFinding = buildings\.length > 0 && selectedFindingBuildingIds\.length === buildings\.length/);
  assert.match(workspace, /buildingIds: selectedHseBuildingIds/);
  assert.match(workspace, /buildingIds: selectedFindingBuildingIds/);

  // #16 · An SMS reaches a contractor who does not use WhatsApp.
  assert.match(workspace, /function openSms\(message: string\)/);
  assert.match(workspace, /sms:\?&body=/);
  assert.equal(workspace.match(/Send as SMS|Als SMS sturen/g)?.length, 6);
});

test("makes every recorded signature visible on the document it belongs to", async () => {
  const [workspace, fieldTools, agreement, shareActions, operations, dailyPdf, dailyDocx, controlledPdf, controlledDocx, ncrPdf, ncrDocx, migration] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/field-tools.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/agreement-signature.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/share/[token]/external-share-actions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/daily-report-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/daily-report-docx.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/controlled-document-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/controlled-document-docx.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/ncr-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/ncr-docx.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608010002_signature_on_the_record.sql", import.meta.url), "utf8"),
  ]);

  // The day report of the client ends with item 19: control, name/position and signature.
  assert.match(dailyPdf, /19\. Controle, naam\/functie en ondertekening/);
  assert.match(dailyPdf, /function SignatureSection/);
  assert.match(dailyPdf, /signatures\?: ReportSignatureLine\[\]/);
  assert.match(dailyDocx, /19\. Controle, naam\/functie en ondertekening/);
  assert.match(dailyDocx, /function signatureFields/);
  // A version is signed after it is frozen, so the declarations travel beside it.
  assert.match(operations, /report_signatures"\)\.select\("id,report_version_id,signer_name,signer_role,declaration/);
  assert.match(workspace, /const signatureLines = \(versionId: string\)/);
  assert.match(workspace, /downloadFormalReportPdf\(version\.snapshot as FormalReportSnapshot, version\.revision, version\.sha256, signatureLines\(version\.id\)\)/);

  // A controlled document says who signed it, instead of only offering a blank line.
  assert.match(controlledPdf, /ISSUED AND SIGNED BY/);
  assert.match(controlledPdf, /controlledDocumentSignatures\(entry\)/);
  assert.match(controlledDocx, /Issued and signed by/);
  assert.doesNotMatch(controlledPdf, /A blank signature line is intentional/);
  assert.doesNotMatch(controlledDocx, /A blank signature line is intentional/);

  // The contractor's name under the corrective action is that signature, and it is
  // required, stored on the record and printed on the NCR form.
  assert.match(shareActions, /const signatureRequired = responseType === "proposed_correction"/);
  // The contractor writes that signature now, so a name alone is no longer enough.
  assert.match(shareActions, /signatureRequired && \(contactName\.trim\(\)\.length < 2 \|\| !signature\)/);
  assert.match(migration, /'correction_signed_by', coalesce\(v_contact, ''\)/);
  assert.match(migration, /'completion_signed_by', coalesce\(v_contact, ''\)/);
  assert.match(operations, /correction_signed_by\?: string;/);
  assert.match(workspace, /issue\.correction_signed_by/);
  assert.match(ncrPdf, /issue\.correction_signed_by \|\| issue\.completion_signed_by/);
  assert.match(ncrDocx, /Signed by contractor/);

  // An agreement is signed the same way wherever it is written, and the register shows it.
  assert.match(agreement, /export function AgreementSignatureFields/);
  assert.match(agreement, /export function agreementSummaryLine/);
  assert.match(workspace, /<AgreementSignatureFields\s+options=\{agreementPartyOptions\}/);
  assert.match(fieldTools, /<AgreementSignatureFields options=\{agreementPartyOptions\}/);
  assert.match(fieldTools, /agreementSignatureDetails\(agreement\)/);
  assert.match(workspace, /agreementSummaryLine\(entry\.details, text\)/);
});

test("only asks for a signature where the client's own forms have one", async () => {
  const [workspace, operations, ncrPdf, ncrDocx, controlledPdf, controlledDocx] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/ncr-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/ncr-docx.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/controlled-document-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/controlled-document-docx.ts", import.meta.url), "utf8"),
  ]);

  // On the client's RFI, RFA and WIR forms the contractor signs the request and CODECO
  // signs the reply, so CODECO never signs those as the author.
  assert.match(workspace, /const submittedRegister = externalSubmissionRegisterTypes\.includes\(registerForm\.type\)/);
  assert.match(workspace, /Submitted by · name on the form|Ingediend door · naam op het formulier/);
  assert.match(workspace, /Signature on the submitted form|Handtekening op het ingediende formulier/);
  assert.match(controlledPdf, /SUBMITTED AND SIGNED BY/);
  assert.match(controlledDocx, /Submitted and signed by/);

  // The recorded verifier (`verified_by`, set by the database itself) is the fallback
  // name on a closed NCR; a written QC signature on the record itself, from 7 August,
  // takes priority over it — never the person who happens to download the document.
  assert.match(operations, /verified_by: string \| null;/);
  assert.match(operations, /final_measure,issue_management,verified_by,verified_at/);
  assert.match(workspace, /verifierName: resolveUserName\(finding\.verified_by\)/);
  assert.match(ncrPdf, /resolved \? issue\.verification_signed_by \|\| context\.verifierName \|\| "" : ""/);
  assert.match(ncrDocx, /resolved \? issue\.verification_signed_by \|\| context\.verifierName \|\| "" : ""/);
  assert.doesNotMatch(ncrPdf, /"QC verification", resolved \? context\.issuerName/);

  // Who has to sign a report is a project setting; the database enforces it, so the form
  // offers exactly those roles instead of a fixed list.
  assert.match(workspace, /const signingWorkflow = data\.settings\?\.signing_workflow\?\.length/);
  assert.match(workspace, /const requiredRoles = signingWorkflow\.filter\(\(rule\) => rule\.required\)/);
  assert.match(workspace, /required signatures recorded|verplichte handtekeningen gezet/);
  assert.doesNotMatch(workspace, /<option value="quality_hse_manager">/);
});

test("gives the phone back button a screen to go back to", async () => {
  const [app, workspace, history, photoEvidence, photoMarkup, sketch] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/navigation/app-history.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/photo-evidence.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/photo-markup.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sketch-pad.tsx", import.meta.url), "utf8"),
  ]);

  // Every screen the user perceives as a page is a history entry with its own address.
  assert.match(app, /const screen: AppScreen = useMemo/);
  assert.match(app, /useScreenHistory\(screen, applyScreen\)/);
  assert.match(app, /const applyScreen = useCallback/);
  // Each entry also remembers the screen underneath it.
  assert.match(history, /window\.history\.pushState\(\{ codecoScreen: screen, codecoBelow: previous \} satisfies HistoryEntry, "", url\)/);
  assert.match(history, /window\.addEventListener\("popstate", onPopState\)/);
  // Closing a dialog by hand steps back only when the entry underneath is the screen that
  // remains; otherwise it rewrites the entry, so an older screen or dialog never resurfaces.
  assert.match(history, /if \(below && sameScreen\(below, screen\)\) \{\s*\n\s*window\.history\.back\(\);/);
  assert.match(history, /window\.history\.replaceState\(\{ codecoScreen: screen, codecoBelow: below \?\? null \}/);
  // The flag that follows the back button must never survive into the next navigation.
  assert.match(history, /restoringRef\.current = false;\s*\n\s*if \(action === "none"\) return;/);

  // The open module belongs to the shell, so back can bring a module back.
  assert.match(workspace, /onTabChange: \(tab: ProjectTab\) => void;/);
  assert.match(app, /onProjectTabChange=\{setInitialProjectTab\}/);
  assert.doesNotMatch(workspace, /key=\{`\$\{projectId\}:\$\{initialProjectTab\}/);

  // A full-screen overlay closes on back instead of leaving the screen behind it.
  assert.match(photoEvidence, /useBackToClose\(true, close\)/);
  assert.match(photoMarkup, /useBackToClose\(true, close\)/);
  assert.match(sketch, /useBackToClose\(true, close\)/);
});

test("makes the action centre say what the user has to do and open the record itself", async () => {
  const [actionCenter, rules, workspace, app, focus, styles, recordList] = await Promise.all([
    readFile(new URL("../app/project-action-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/actions/action-center.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/navigation/record-focus.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/forms/record-list.tsx", import.meta.url), "utf8"),
  ]);

  // The product plan's action board: my work, project work, deadlines, status and
  // escalations. "My work" is the answer to "what am I supposed to do here".
  assert.match(actionCenter, /text\("My work", "Mijn werk"\)/);
  assert.match(actionCenter, /text\("All project work", "Al het projectwerk"\)/);
  assert.match(actionCenter, /const mine = useMemo/);
  assert.match(actionCenter, /item\.ownerUserId === currentUserId/);
  assert.match(actionCenter, /currentUserId: string;/);
  // Somebody with assigned work lands on it; somebody without it does not land on an
  // empty page.
  assert.match(actionCenter, /initialView === "work" && mine\.some\(isOpenItem\) \? "mine" : initialView/);
  assert.match(app, /currentUserId=\{session\.user\.id\}/);

  // Every row carries the one instruction that belongs to it, plus who it waits on.
  assert.match(actionCenter, /const nextStepLabel = \(item: UnifiedItem\)/);
  assert.match(actionCenter, /Assign who has to do this|Wijs toe wie dit moet doen/);
  assert.match(actionCenter, /Check the work on site and close it out|Controleer het werk op locatie en sluit af/);
  assert.match(actionCenter, /Record the decision on this submission|Leg het besluit over deze indiening vast/);
  assert.match(actionCenter, /unified-action-next/);
  assert.match(styles, /\.unified-action-next/);
  assert.match(actionCenter, /const ownerLabel = \(item: UnifiedItem\)/);
  assert.match(rules, /export function nextStepFor/);

  // Tapping a row opens that record, instead of the module list it stands in.
  assert.match(focus, /export function recordAnchorId/);
  assert.match(focus, /export function useRecordFocus/);
  assert.match(actionCenter, /openProjectArea\("registers", item\.id\)/);
  assert.match(workspace, /id=\{recordAnchorId\(finding\.id\)\}/);
  assert.match(workspace, /id=\{recordAnchorId\(entry\.id\)\}/);
  assert.match(workspace, /from "@\/app\/forms\/record-list"/);
  assert.match(recordList, /id=\{recordAnchorId\(row\.id\)\}/);
  assert.match(workspace, /focusRecordId === finding\.id \? "record-focused" : ""/);
  assert.match(app, /setFocusRecordId\(recordId \?\? ""\)/);
  assert.match(styles, /\.record-focused/);

  // The decorative floor plan is replaced by what actually needs a decision today.
  assert.match(actionCenter, /action-focus-card/);
  assert.match(actionCenter, /Needs attention now|Vraagt nu aandacht/);
  assert.match(styles, /\.action-focus-card/);
  assert.doesNotMatch(actionCenter, /plan-mass/);
  assert.doesNotMatch(actionCenter, /action-plan-preview/);
});

test("gives the 360 degree viewer the same reach as the photo options", async () => {
  const [evidence, workspace, styles, packageJson] = await Promise.all([
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  // Looking around is a labelled button as well as a gesture: on site the gesture alone
  // was not discovered.
  assert.match(evidence, /className="panorama-controls"/);
  assert.match(evidence, /text\("Reset view", "Beginstand"\)/);
  assert.match(evidence, /text\("Auto turn", "Vanzelf draaien"\)/);
  assert.match(evidence, /text\("Fullscreen", "Volledig scherm"\)/);
  assert.match(evidence, /text\("Zoom out", "Uitzoomen"\)/);
  assert.match(evidence, /text\("Zoom in", "Inzoomen"\)/);
  assert.match(evidence, /text\("Move phone to look", "Kijken met de telefoon"\)/);
  assert.match(evidence, /navbar: false,/);
  assert.match(styles, /\.panorama-controls/);

  // A compass and a readable heading, so a direction on a 360 image can be named the same
  // way the facing direction of a normal photo is.
  assert.match(evidence, /CompassPlugin/);
  assert.match(evidence, /className="panorama-heading"/);
  assert.match(styles, /\.panorama-heading/);
  assert.match(styles, /@import "@photo-sphere-viewer\/compass-plugin\/index.css";/);
  for (const plugin of ["autorotate-plugin", "compass-plugin", "gyroscope-plugin", "markers-plugin"]) {
    assert.match(packageJson, new RegExp(`"@photo-sphere-viewer/${plugin}"`), `${plugin} must be a dependency`);
  }

  // Every marking is listed and numbered as it is on the image, and choosing one turns
  // the view towards it — a marker can sit behind you on a sphere.
  assert.match(evidence, /function VisualMarkerList/);
  assert.match(evidence, /Markings on this image|Markeringen op dit beeld/);
  assert.match(evidence, /viewerRef\.current\?\.animate\(\{ yaw: Number\(annotation\.yaw\)/);
  assert.match(styles, /\.visual-marker-list/);

  // The words that belong to the image stand next to the image, and the original export
  // can be opened or downloaded, exactly as a photo in the library can.
  assert.match(evidence, /function CaptureDetails/);
  assert.match(evidence, /text\("Open original", "Origineel openen"\)/);
  assert.match(evidence, /text\("Download", "Downloaden"\)/);
  assert.match(evidence, /openProjectFile, downloadProjectFile|downloadProjectFile, isStorageGatewayConfigured, loadProjectFileObjectUrl, openProjectFile/);
  assert.match(styles, /\.capture-details/);

  // "Upload 360° image" in the photo library opens the 360° form instead of asking for
  // the same button a second time.
  assert.match(workspace, /setVisual360Intent\(true\); setTab\("visual"\)/);
  assert.match(evidence, /start360Upload\?: boolean;/);
  assert.match(evidence, /handled360Intent/);
});

test("opens and works as an installed app with or without internet", async () => {
  const [serviceWorker, providers, app, offlineSession, queryCache, fullSync, fileCache, gateway, idb, manager, styles] = await Promise.all([
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/providers.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/offline-session.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/query-cache.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/full-sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/file-cache.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/storage/gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/idb.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/offline-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // A query that is "paused" because the device reports no connection never runs its
  // loader, so the copy on the device is never read. This is what makes the installed app
  // open on its own data instead of on an empty screen.
  assert.match(providers, /networkMode: "offlineFirst"/);
  assert.match(providers, /mutations: \{ retry: 0, networkMode: "offlineFirst" \}/);

  // Offline the library cannot refresh an expired token and answers "no session". The
  // session stored on the device is used instead, and a null session while offline is not
  // treated as a sign-out.
  assert.match(offlineSession, /export function storedSessionOnThisDevice/);
  assert.match(offlineSession, /export async function getSessionWithOfflineFallback/);
  assert.match(offlineSession, /sb-\$\{reference\}-auth-token/);
  assert.match(app, /getSessionWithOfflineFallback\(supabase\)/);
  assert.match(app, /if \(!nextSession && !navigator\.onLine && storedSessionOnThisDevice\(\)\) return;/);

  // Every project read has a copy on the device, including the smaller ones that used to
  // leave the app with empty pickers and default settings when opened offline.
  assert.match(queryCache, /export async function loadWithOfflineCache/);
  for (const key of ["projectConfiguration", "projectLocations", "projectNotifications", "internalAccess"]) {
    assert.match(app, new RegExp(`offlineQueryKeys\\.${key}\\(`), `${key} must fall back to the offline copy`);
    assert.match(fullSync, new RegExp(`offlineQueryKeys\\.${key}\\(`), `${key} must be filled in by the full sync`);
  }
  // The drawings list is read by the drawing screen itself; the full sync still fills it.
  assert.match(fullSync, /offlineQueryKeys\.projectDrawings\(/);

  // Everything the account can read, on the device on purpose, before leaving.
  assert.match(fullSync, /export async function syncEverythingForOffline/);
  assert.match(fullSync, /loadProjectOperations\(client, project\.id, project\.organizationId, reportId\)/);
  assert.match(fullSync, /if \(reportId\) await cacheProjectSnapshot\(project\.id, null, snapshot\)/);
  assert.match(fullSync, /storeProjectFileOffline\(client, file\.id, project\.id\)/);
  // The lazily loaded parts of the app are downloaded too; offline is exactly when they
  // would otherwise be fetched for the first time.
  assert.match(fullSync, /async function warmLazyModules/);
  assert.match(fullSync, /import\("@photo-sphere-viewer\/core"\)/);
  assert.match(fullSync, /import\("pdfjs-dist"\)/);

  // Evidence is private and travels with a token, so it is stored by the app itself
  // instead of in the service worker cache, and read from there when the network fails.
  assert.match(idb, /const databaseVersion = 5/);
  assert.match(idb, /createObjectStore\("drafts"/);
  assert.match(idb, /createObjectStore\("drawingPins"/);
  assert.match(idb, /createObjectStore\("files"/);
  assert.match(fileCache, /export async function cacheProjectFile/);
  assert.match(gateway, /const cached = await readCachedProjectFile\(fileId\)/);
  assert.match(gateway, /export async function storeProjectFileOffline/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)\) return;/);

  // The shell itself: precached documents, a network timeout so an unusable connection
  // does not look like an app that will not open, and the assets it renders with.
  assert.match(serviceWorker, /const SHELL_DOCUMENTS = \["\/supervisie", "\/"\]/);
  assert.match(serviceWorker, /DOCUMENT_NETWORK_TIMEOUT/);
  assert.match(serviceWorker, /function networkWithTimeout/);
  assert.match(serviceWorker, /woff2\?/);
  assert.match(serviceWorker, /codeco-refresh-shell/);
  assert.match(providers, /codeco-refresh-shell/);

  // The way in, and an honest list of what does and does not work without a connection.
  assert.match(app, /modal === "offline"/);
  assert.match(app, /<OfflineManagerModal/);
  assert.match(manager, /Make everything available offline|Alles offline beschikbaar maken/);
  assert.match(manager, /What works without internet|Wat werkt zonder internet/);
  assert.match(manager, /What still needs a connection|Waar nog verbinding voor nodig is/);
  assert.match(manager, /Remove offline copy|Offline kopie verwijderen/);
  assert.match(styles, /\.offline-manager-state/);
});

test("installs as an application with square icons and its own identity", async () => {
  const [manifest, layout] = await Promise.all([
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  // A phone offers to install an app that has an id, a standalone display and square
  // icons; the wide logo was rendered squashed on the home screen.
  assert.match(manifest, /id: "\/supervisie"/);
  assert.match(manifest, /display_override: \["standalone", "minimal-ui"\]/);
  assert.match(manifest, /purpose: "maskable"/);
  assert.match(layout, /apple: \[\{ url: "\/icon-192\.png"/);
});

test("lets a field record be written without a connection and sends it by itself", async () => {
  const [queue, pending, workspace, app, uploads, manager, styles] = await Promise.all([
    readFile(new URL("../lib/offline/record-queue.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/pending-records.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/upload-queue.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/offline-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // A new registration waits on the device; changing a record that already exists does
  // not, because this device cannot know what that record looks like right now.
  assert.match(queue, /export type OfflineRecordKind = "finding" \| "hse" \| "register" \| "action"/);
  assert.match(queue, /export async function saveRecordOnlineOrQueue/);
  assert.match(queue, /export function isConnectionFailure/);
  assert.match(queue, /if \(!isConnectionFailure\(error\)\) throw error;/);
  // The same key on every attempt, so a retry can never create the record twice.
  assert.match(queue, /const idempotencyKey = `offline-\$\{record\.kind\}:\$\{record\.id\}`/);

  // Each of the four kinds actually goes through the queue.
  for (const kind of ["finding", "hse", "register"]) {
    assert.match(workspace, new RegExp(`kind: "${kind}",`), `${kind} must be able to wait on the device`);
  }
  assert.match(app, /kind: "action",/);

  // A queued record stands in the list marked as waiting: a record that disappears after
  // saving reads as data loss.
  assert.match(pending, /export function withPendingRecords/);
  assert.match(pending, /export function withPendingActions/);
  assert.match(pending, /export const pendingStatus = "queued_offline"/);
  assert.match(workspace, /const snapshot = withPendingRecords\(query\.data, pendingRecords\)/);
  assert.match(app, /withPendingActions\(dayQuery\.data\?\.actions \?\? \[\], pendingRecordsQuery\.data \?\? \[\]\)/);
  assert.match(workspace, /record-waiting-note/);
  assert.match(styles, /\.record-waiting/);

  // It is read-only until it is central: its number, deadline and contractor link are
  // decided by the database.
  assert.match(workspace, /<div className="finding-actions" hidden=\{waitingToBeSent\}>/);
  assert.match(app, /if \(isPendingRecordId\(action\.id\)\) \{/);

  // Photos attached to a queued record carry its local id and find the real one after the
  // record has been sent; the records are therefore sent before the files.
  assert.match(uploads, /pendingRecordId\?: string;/);
  assert.match(uploads, /await resolvePendingRecordId\(upload\.findingGroup\.pendingRecordId\)/);
  assert.match(uploads, /isPendingRecordId\(upload\.recordLink\.recordId\)/);
  assert.match(app, /syncOfflineRecords\(supabase, selectedProject\.id\)/);

  // The offline screen shows what is still owed and can send it on demand.
  assert.match(manager, /offline-outbox/);
  assert.match(manager, /Send now|Nu versturen/);
  assert.match(styles, /\.offline-outbox/);
  assert.match(manager, /Changing a record that already exists|Een bestaand record wijzigen/);
});

test("processes the three annotated capture screens from 2 August", async () => {
  const [evidence, visual, picker, drawingPicker, compass, queue, operations, styles] = await Promise.all([
    readFile(new URL("../app/photo-evidence.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/building-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/drawing-location-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/images/compass.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/upload-queue.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // #17 and #18: "voor nr is 1 invoer voldoende". The title, the category and the typed room
  // name are struck through on both photo screens; one written field is left.
  for (const [name, source] of [["photo detail sheet", evidence], ["capture screen", visual]]) {
    assert.match(source, /\{text\("Description", "Omschrijving"\)\}/, `${name} asks one question`);
    assert.doesNotMatch(source, /\{text\("Category", "Categorie"\)\}/, `${name} no longer asks for a category`);
  }
  assert.doesNotMatch(visual, /Room \/ location in your own words/);
  // #17: the building stays — the client ticked it off.
  assert.match(evidence, /\{text\("Building", "Gebouw"\)\}/);

  // #18: "laten we met knopjes werken, en meerdere kiezen".
  assert.match(picker, /export function BuildingChoiceField/);
  assert.match(picker, /aria-pressed=\{chosen\}/);
  assert.match(visual, /<BuildingChoiceField/);
  assert.match(visual, /value=\{captureBuildingIds\}/);
  assert.match(styles, /\.building-choice-options button/);

  // #17 and #18: "kan dit automatisch?" — the direction comes from the photo itself, and
  // otherwise from the compass of the device, and only then from a tap.
  assert.match(compass, /webkitCompassHeading/);
  assert.match(compass, /deviceorientationabsolute/);
  for (const source of [evidence, visual]) {
    assert.match(source, /readPhotoDirection/);
    assert.doesNotMatch(source, /FacingDirectionField/);
  }

  // #18: "locatie kunnen kiezen in PDF" — the spot is pointed at on the drawing and stays
  // there as a pin next to the photo.
  assert.match(drawingPicker, /export function DrawingLocationPicker/);
  assert.match(drawingPicker, /pdfjs-dist/);
  assert.match(drawingPicker, /ResizeObserver/);
  assert.match(drawingPicker, /onPointerDown/);
  assert.match(drawingPicker, /renderTask\?\.cancel/);
  assert.doesNotMatch(drawingPicker, /onClick=\{\(event\) => onPoint/);
  assert.match(visual, /<DrawingLocationPicker/);
  assert.match(queue, /drawingPin\?: \{/);
  assert.match(queue, /linkedRecordType: "visual"/);

  // #18: "ik begrijp dit niet, misschien kan het weg" — the module dropdown is gone.
  assert.doesNotMatch(operations, /Switch project module/);

  // #18: "kunnen we de zwarte delen wegdoen" — the preview no longer pads a portrait photo
  // out to the full card width with black.
  assert.match(styles, /\.visual-photo-preview img \{[\s\S]{0,220}width: auto/);
  assert.doesNotMatch(styles, /\.visual-photo-preview img \{[\s\S]{0,220}background: #000/);

  // The photo library and the marker panel stay away while a photo is waiting to be saved.
  assert.match(visual, /captures\.length && !showUpload/);
});

test("processes the feedback of 4 August: photos first, written signatures, an NCR author, unique codes and a chosen drawing", async () => {
  const [app, operations, workspaceHome, media, visual, drawingPicker, agreement, signaturePad, findings, controlledDocuments, ncrPdf, ncrDocx, controlledPdf, controlledDocx, docxShared, migration, reportMigration, contractorMigration, externalActions, externalRoute, styles] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/project-workspace-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/drawing-location-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/agreement-signature.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/signature-pad.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/forms/controlled-project-documents.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/ncr-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/ncr-docx.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/controlled-document-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/controlled-document-docx.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/docx-shared.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608040001_unique_document_codes.sql", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608040002_written_report_signature.sql", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608040003_written_contractor_signature.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/share/[token]/external-share-actions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/external-share/[token]/response/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // "wanneer ik op Camera druk moet het mij niet gelijk brengen naar camera maar naar de
  // foto's, daarna met de optie uploaden of foto maken en 360 upload": the tile opens the
  // library, and the four ways to add something stand on top of the photos themselves.
  assert.match(workspaceHome, /openPhotoLibrary: \(\) => void;/);
  assert.match(operations, /openPhotoLibrary=\{\(\) => switchTab\("files"\)\}/);
  assert.doesNotMatch(app, /openQuickCamera=/);
  assert.match(media, /media-choice-bar/);
  assert.match(media, /Take photo|Maak foto/);
  assert.match(media, /Upload photos|Foto's uploaden/);
  assert.match(media, /Upload 360°|360° uploaden/);
  assert.match(media, /Upload drawing|Tekening uploaden/);
  // The photo choice and the drawing choice each have their own input, so a choice can
  // never pick up the accepted file types of the other one.
  assert.match(media, /ref=\{photoImportRef\}/);
  assert.match(media, /ref=\{drawingImportRef\}/);
  assert.match(media, /uploadKind: "photo" \| "drawing" \| "document" = kind/);
  assert.match(media, /mode\?: "photos" \| "assets"/);
  // Marking a problem on a picture belongs on every screen a photo appears on, the Photos
  // tab included: the client asked for that route back after it was cut here.
  assert.doesNotMatch(media, /allowMarkup=\{false\}/);
  assert.match(media, /openMarking=\{markPhotoIssue\}/);
  assert.match(styles, /\.media-choice-bar/);

  // "bij Signing document moet gebeuren op dat moment; nu gebeurt het door een check te
  // drukken": every signature is written on the form, and no signature is a checkbox.
  assert.match(signaturePad, /export function SignaturePad/);
  assert.match(signaturePad, /export function SignatureField/);
  assert.match(signaturePad, /toDataURL\("image\/png"\)/);
  assert.match(operations, /<SignatureField[\s\S]{0,400}Sign as the engineer who issues this NCR/);
  assert.match(operations, /<SignatureField[\s\S]{0,400}Sign as the author of this document|<SignatureField[\s\S]{0,400}Signature on the submitted form/);
  assert.match(agreement, /<SignatureField/);
  assert.doesNotMatch(agreement, /type="checkbox"/);
  assert.doesNotMatch(operations, /checked=\{Boolean\(findingForm\.signedBy\)\}/);
  assert.doesNotMatch(operations, /checked=\{Boolean\(registerForm\.signedBy\)\}/);
  assert.match(findings, /signature_image\?: string \| null;/);
  assert.match(controlledDocuments, /signature_image: draft\.signatureImage \|\| null/);
  // The written signature is printed on the documents that leave the app.
  assert.match(ncrPdf, /styles\.signatureInk/);
  assert.match(controlledPdf, /styles\.signatureInk/);
  assert.match(docxShared, /export function signatureImageBytes/);
  assert.match(controlledDocx, /controlledDocumentSignatures\(entry\)/);
  assert.match(styles, /\.signature-field/);
  assert.match(styles, /\.signature-canvas/);
  // The formal report declaration and the contractor's box on the NCR are signed the
  // same way: the signature travels with the record, never as a tick.
  assert.match(operations, /signReport\(client, reportId!, effectiveSignerRole, reportSignature\?\.name \|\| currentUserName, declaration, reportSignature\?\.image \?\? null\)/);
  assert.match(reportMigration, /add column if not exists signature_image text/);
  assert.match(externalActions, /<SignatureField/);
  assert.match(externalActions, /signatureImage: signature\?\.image \?\? null/);
  assert.match(externalRoute, /p_signature_image: input\.data\.signatureImage \|\| null/);
  assert.match(contractorMigration, /correction_signature_image/);

  // "de NCR moet ook een indicatie hebben wie het heeft opgesteld": the author is stored
  // with the record, shown on the form and on the card, and printed on the report.
  assert.match(findings, /issued_by\?: string;/);
  assert.match(findings, /issued_by: input\.issuedBy\?\.trim\(\) \|\| ""/);
  assert.match(operations, /issuedBy: currentUserName/);
  assert.match(operations, /Drawn up by", "Opgesteld door/);
  assert.match(operations, /issuerName: finding\.issue_management\?\.issued_by \|\| currentUserName/);
  assert.match(ncrPdf, /Drawn up by/);
  assert.match(ncrDocx, /\["Drawn up by", issue\.issued_by \|\| context\.issuerName\]/);

  // "alles moet uniek zijn met een nummer ter onderscheiding; je moet kunnen opzoeken op
  // basis van de unique code op alle documenten": files are numbered by the database, and
  // the workspace search finds any record back from its code.
  assert.match(migration, /add column if not exists document_code text/);
  assert.match(migration, /files_project_document_code_key/);
  assert.match(migration, /assign_file_document_code/);
  assert.match(migration, /when 'photo' then 'PHO'/);
  assert.match(migration, /when 'drawing' then 'DWG'/);
  assert.match(findings, /document_code: string \| null;/);
  assert.match(findings, /schemaFeatureMissing\(fileResult\.error, \["document_code"\]\)/);
  assert.match(operations, /buildRecordDirectory\(\{ \.\.\.data, buildings \}\)/);
  assert.match(workspaceHome, /filterRecordDirectory\(records, query/);
  assert.match(workspaceHome, /workspace-search-filters/);
  assert.match(workspaceHome, /groupedMatches\.map/);
  assert.match(workspaceHome, /workspace-code-results/);
  assert.match(workspaceHome, /openRecord\(record\.tab, record\.id, record\.kind\)/);
  assert.match(media, /file\.document_code \? <span className="media-code-chip"/);
  assert.match(styles, /\.workspace-code-results/);

  // "bij point on drawing moet ik een drawing kunnen kiezen, want nu geeft het mij gewoon
  // een drawing": the picker starts on the list of drawings and can be switched back.
  assert.match(drawingPicker, /drawing-choice-list/);
  assert.match(drawingPicker, /Choose the drawing first|Kies eerst de tekening/);
  assert.match(drawingPicker, /Choose another drawing|Andere tekening kiezen/);
  assert.match(drawingPicker, /useState\(initial\?\.fileId \?\? ""\)/);
  assert.doesNotMatch(drawingPicker, /drawings\[0\]\?\.id/);
  assert.match(visual, /<DrawingLocationPicker[\s\S]{0,200}buildings=\{buildings\}/);
  assert.match(styles, /\.drawing-choice-list/);
});

test("sends the workforce overview tile to its browse screen and keeps quick attendance", async () => {
  const [app, workspaceHome] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/project-workspace-home.tsx", import.meta.url), "utf8"),
  ]);

  // §4.3 of the product plan: the Workforce tile opens the workforce register itself —
  // organisation, crew, discipline, headcount, visitors — not the day's work list, which
  // is what "Attendance by contractor and trade" had been landing on.
  assert.match(workspaceHome, /id: "workforce"[\s\S]{0,300}action: openWorkforce/);
  assert.doesNotMatch(workspaceHome, /id: "workforce"[\s\S]{0,300}openTask\("daily", false\)/);
  // It is a workspace page with its form, like every other record module — not a pop-up.
  const workspace = await readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /openWorkforce=\{\(\) => switchTab\("workforce"\)\}/);
  assert.match(workspace, /tab === "workforce" \? \(/);
  assert.doesNotMatch(app, /setModal\("attendance"\)|setModal\("one_tap_log"\)/);

  // Counting the crew is often the first thing done on site, so it starts the day report
  // itself instead of refusing until one exists.
  const attendanceModal = app.slice(app.indexOf("renderWorkforce: ("), app.indexOf("<ProjectPermissionsProvider value"));
  assert.match(attendanceModal, /dayQuery\.data\?\.report \?\? await createOrGetReport/);
  assert.doesNotMatch(attendanceModal, /Start eerst het centrale dagrapport/);

  // Writing the day log has the same dead end behind it, and the same fix.
  const dayLogModal = app.slice(app.indexOf("renderDayLog: ("), app.indexOf("renderWorkforce: ("));
  assert.match(dayLogModal, /dayQuery\.data\?\.report \?\? await createOrGetReport/);
  assert.doesNotMatch(dayLogModal, /Start eerst het centrale dagrapport/);

  // Every confirmation the supervisor sees speaks the language the app is set to. These were
  // Dutch-only while the client runs the app in English.
  assert.doesNotMatch(app, /setToast\("[^"]{15,}"\)/);
  assert.doesNotMatch(app, /runSynced\([\s\S]{0,200}?\n\s+"[A-Z][^"]{15,}",\n/);
});

test("gives the workforce screen the full register, not a counter per party", async () => {
  const [app, register, dailyLog, dataLayer, styles] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/workforce-register.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // The screen this replaced could only count down one row per project party. A contractor
  // with masons and carpenters on site could not be recorded at all.
  assert.match(register, /export function addWorkforceRow/);
  assert.match(register, /Add person|Persoon toevoegen/);
  assert.match(register, /workforce-row-remove/);
  assert.match(register, /<TimeField /);
  // The context tiles were struck through later; the headcount they left is what remains.
  assert.match(register, /workforce-headline/);
  assert.match(register, /No project parties configured yet|Nog geen projectpartijen ingericht/);

  // One register, on the Workforce page itself.
  assert.match(app, /<WorkforceForm/);
  // One register, one place to write it. The day log used to count the crew again and its
  // save overwrote the crew, notes and signature written in the Workforce register.
  assert.doesNotMatch(dailyLog, /<WorkforceRegister/);
  const dayLogSave = app.slice(app.indexOf("renderDayLog: ("), app.indexOf("renderWorkforce: ("));
  assert.ok(dayLogSave.length > 500, "the day log renderer must be found");
  assert.doesNotMatch(dayLogSave, /saveAttendance\(/);
  assert.match(dayLogSave, /openWorkforce=\{openWorkforce\}/);
  assert.doesNotMatch(app, /function AttendanceModal/);

  // "Copy previous workday" was a button that always reported there was nothing.
  assert.match(dataLayer, /export async function loadPreviousWorkdayAttendance/);
  assert.match(app, /loadPreviousWorkdayAttendance\(supabase/);
  assert.match(register, /copyPreviousWorkday\(buildingId\)/);

  // The markup of the removed screens left its styling behind; it must not pile up.
  assert.doesNotMatch(styles, /\.one-tap-workforce/);
  assert.doesNotMatch(styles, /\.attendance-toolbar/);
  assert.match(styles, /\.workforce-row \{/);

  // The client struck three things through on this very screen, and they must stay struck.
  // A fixed row per project party at zero — "Opdrachtgever 0, Supervisie 0, Uitvoering 0".
  assert.match(register, /initialRows\.filter\(\(row\) => row\.count > 0\)/);
  // The location and weather tiles above the crew.
  assert.doesNotMatch(register, /workforce-context/);
  assert.doesNotMatch(register, /weatherLabel/);
  assert.doesNotMatch(styles, /\.workforce-context/);
  // "Ik kan hier niet van beide gebouwen invullen!" — every building keeps its own crew and
  // one confirm writes them all.
  assert.match(register, /rowsByBuilding/);
  assert.match(register, /workforce-buildings/);
  assert.match(register, /filledBuildings\.map\(/);
  assert.match(app, /for \(const entry of perBuilding\)/);

  // "Geordend, hoe het was": every block is a titled card with its own count, in a fixed
  // order, instead of one flat stack of fields a supervisor has to read top to bottom.
  assert.match(register, /function WorkforceSection/);
  assert.match(styles, /\.workforce-section-icon/);
  // The card itself is the shared record-form section every other form is built from, so
  // workforce cannot drift away from the rest of the app's forms again.
  assert.match(register, /<RecordFormSection/);
  assert.match(register, /className="workforce-section"/);
  assert.match(register, /<RecordSignatureField/);
  assert.match(register, /record-form-sections workforce-sections/);
  assert.match(styles, /\.record-form-section \{/);
  // Numbered like every other form, and numbered on what is actually on screen.
  assert.match(register, /step=\{1\}/);
  assert.match(register, /const stepTotals = showVisitors \? 3 : 2;/);
  const blocks = ["Workforce by trade", "Visitors", "Totals for today", "Deviating workforce"]
    .map((title) => register.indexOf(`title={text("${title}"`));
  assert.ok(blocks.every((position) => position > 0), `every block needs its own heading: ${blocks}`);
  // Crew first, then visitors, then the totals, then what needs explaining.
  assert.deepEqual([...blocks].sort((left, right) => left - right), blocks);
});

test("processes the annotated screens of 4 August: ordered photos, a named pin, the client's issue form and a day-aware record", async () => {
  const [app, operations, media, drawings, library, pinMigration, styles] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/drawing-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/media/photo-library.mjs", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608040004_registration_drawing_pins.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // The photos and folders are ordered: a folder counts exactly what its gallery shows,
  // the daily folders come first, and the pictures stand under the day they were taken.
  assert.match(library, /export function visibleLibraryFiles/);
  assert.match(library, /export function orderMediaFolders/);
  assert.match(library, /export function groupFilesByDay/);
  assert.match(media, /visibleLibraryFiles\(data\.files, libraryBuildingId\)/);
  assert.match(media, /orderMediaFolders\(/);
  assert.match(media, /groupFilesByDay\(files\)/);
  assert.match(media, /filesInFolder\(buildingFiles, "all"\)\.length/);
  assert.doesNotMatch(media, /<b>\{data\.files\.length\}<\/b>/);
  assert.match(styles, /\.media-day-heading/);

  // #19: a pin is placed for the record you came with, and carries that record's own
  // name, number and date. The list of link types and the freehand pen are gone.
  assert.match(pinMigration, /'observation','inspection','visual','registration'/);
  assert.match(pinMigration, /elsif p_linked_record_type = 'registration' then/);
  assert.match(pinMigration, /from public\.site_registrations registration/);
  assert.match(drawings, /pendingRecord\?: \{ label: string; title: string;/);
  assert.match(drawings, /linkedRecordType: incomingFinding \? "observation"/);
  assert.doesNotMatch(drawings, /\["freehand", PenLine/);
  assert.doesNotMatch(drawings, /Select item to be linked|Selecteer het te koppelen item/);
  assert.doesNotMatch(drawings, /const linkOptions = useMemo/);
  assert.match(drawings, /drawing-pin-code/);
  assert.match(drawings, /drawing-pin-legend/);
  assert.match(drawings, /registration: \{ en: "Daily works", nl: "Dagwerk" \}/);
  assert.match(drawings, /className="drawing-pin"/);
  assert.doesNotMatch(drawings, /className=\{`drawing-pin \$\{tone/);
  assert.match(styles, /\.drawing-pin-code/);
  assert.match(operations, /pendingRecord=\{pendingRecordPin\}/);

  // #20 asked the field record to say which part of the day it belonged to. Works ongoing,
  // works completed and delays now have their own page — the day log, opened on that block —
  // so the field record that asked it is gone.
  assert.doesNotMatch(app, /chooseActivityKind|activityKindLabel/);
  assert.match(operations, /setDayLogFocus\(view === "day" \? undefined : view === "delays" \? "delay" : view\)/);

  // #23 and #23A: the issue form is the client's own form. No preset problems, no B1
  // catalog, the type is safety / quality / equipment / materials / schedule /
  // operational, priority is high, medium or low, no disposition, and impact and
  // follow-up can simply be typed.
  assert.match(operations, /const issueTypeOptions = \[/);
  for (const kind of ["safety", "quality", "equipment", "materials", "schedule", "operational"]) {
    assert.match(operations, new RegExp(`id: "${kind}"`));
  }
  // The ready-made problems and the historic B1 catalog live on the NCR form only, and
  // that form is now a screen of its own instead of a set of conditions inside the issue.
  assert.match(operations, /\{showForm && findingScope === "ncr" \? \(/);
  assert.match(operations, /<div className="quick-issue-presets" aria-label=\{text\("Common issue choices/);
  assert.match(operations, /<label className="form-field"><span>\{text\("Client B1 issue catalog/);
  assert.match(operations, /<option value="high">\{text\("High · 3 days"/);
  assert.match(operations, /Impact in your own words|Impact in eigen woorden/);
  // "Required follow-up" was struck off the NCR form itself on 9 August — what has to
  // happen is the engineer's recommended action, and what will happen is the
  // contractor's proposal. The two lists at the head of that form replaced it.
  assert.match(operations, /text\("Category", "Categorie"\)/);
  assert.match(operations, /text\("Type", "Type"\)/);
  assert.doesNotMatch(operations, /Different impact or action|Andere impact of actie/);
  // The issue form is signed too: the client wrote "signature" beside it.
  assert.match(operations, /Sign as the supervisor who reports this issue|Ondertekenen als supervisor die dit issue meldt/);

  // #21: Workforce counts people per contractor and per trade, on its own page.
  assert.match(app, /renderWorkforce: \(\{ close \}\) =>/);
});

test("covers section 4.3 of the product plan on the workforce screen", async () => {
  const [register, app, dataLayer, migration, plan] = await Promise.all([
    readFile(new URL("../app/workforce-register.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608050001_workforce_crew_visitors_and_notes.sql", import.meta.url), "utf8"),
    readFile(new URL("../../../docs/productplan-constructiesupervisie-webapp.md", import.meta.url), "utf8"),
  ]);

  // The section this screen answers to, quoted so the test fails if the plan is rewritten.
  assert.match(plan, /### 4\.3 Aanwezige partijen en mankracht/);

  // Functionaliteit: organisatie, ploeg, discipline en aantal personen.
  assert.match(register, /\{text\("Party", "Partij"\)\}/);
  assert.match(register, /\{text\("Crew · optional", "Ploeg · optioneel"\)\}/);
  assert.match(register, /\{text\("Trade", "Discipline"\)\}/);
  // Werktijd of dienst.
  assert.match(register, /<TimeField /);
  // Bezoekersregistratie.
  assert.match(register, /export type VisitorRow/);
  assert.match(register, /title=\{text\("Visitors", "Bezoekers"\)\}/);
  assert.match(app, /entryType: "visitor" as const/);
  // Toelichting bij afwijkende bezetting.
  assert.match(register, /title=\{text\("Deviating workforce", "Afwijkende bezetting"\)\}/);
  assert.match(register, /\{text\("Explanation", "Toelichting"\)\}/);
  assert.match(dataLayer, /notes: row\.notes\?\.trim\(\) \|\| null/);

  // Automatisering: vorige werkdag kopiëren, totalen per organisatie en discipline,
  // en grote afwijkingen signaleren.
  assert.match(dataLayer, /export async function loadPreviousWorkdayAttendance/);
  assert.match(register, /workforceByParty/);
  assert.match(register, /workforceByDiscipline/);
  assert.match(register, /workforceDeviations/);
  assert.match(register, /workforce-totals/);

  // The columns the screen writes have a migration, and it stays additive: a column that
  // already exists must never be recreated on a live database.
  assert.match(migration, /add column if not exists entry_type/);
  assert.match(migration, /add column if not exists crew/);
  assert.match(migration, /add column if not exists visitor_name/);
  // Until that migration has run the count itself still has to reach the report.
  assert.match(dataLayer, /schemaColumnMissing\(withCrew\.error, column\)/);
  assert.match(dataLayer, /\["entry_type", "crew", "visitor_name"\]/);

  // A visitor is on site but is not manning the work, so no headcount counts them.
  assert.match(app, /\(row\.entry_type \?\? "workforce"\) === "workforce"/);
});

test("processes the annotated screens of 5 August: one building field, a signed inspection, the HSE heading and a delivery of several lines", async () => {
  const [app, operations, drawings, media, hseMigration, styles] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/drawing-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608050002_hse_category_and_inspection_signature.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // #26 and #25: "uniform maken" / "niet uniform" — every building field is the same
  // component with the same words, instead of a dropdown with its own label per screen.
  assert.doesNotMatch(operations, /<BuildingPicker[^/]*label=/);
  assert.doesNotMatch(media, /<BuildingPicker[^/]*label=/);
  assert.match(operations, /<BuildingPicker id="inspection-filter-building"/);
  assert.doesNotMatch(operations, /Building · or general material|Gebouw · of algemeen materiaal/);

  // #26: the inspection date filter offers the days that actually carry an inspection.
  assert.match(operations, /const inspectionDates = Array\.from\(new Set\(data\.inspections/);
  assert.match(operations, /All dates|Alle datums/);
  assert.doesNotMatch(operations, /<input type="date" value=\{inspectionFilterDate\}/);

  // #26 and #26A: the checklist can be pinned on the drawing, is signed before it can be
  // completed, and can raise the NCR itself.
  assert.match(operations, /Pin this location on the drawing|Locatie op de tekening pinnen/);
  assert.match(drawings, /initialInspectionId\?: string;/);
  assert.match(drawings, /linkedRecordType: incomingFinding \? "observation" : "inspection"/);
  assert.match(operations, /<RecordSignatureField[\s\S]{0,500}By signing you confirm that you checked every point/);
  assert.match(operations, /disabled=\{busy \|\| !inspectionSignature/);
  assert.match(operations, /const raiseNcrFromInspection = async \(inspection: Inspection\)/);
  assert.match(operations, /Raise an NCR from this checklist|NCR opstellen vanuit deze checklist/);
  assert.match(hseMigration, /add column if not exists signature_image text/);

  // #24: Health, Safety or Environmental, the two texts under each other, and the app
  // saying out loud that day, date and time come by themselves.
  assert.match(hseMigration, /hse_category in \('health','safety','environmental'\)/);
  assert.match(hseMigration, /p_hse_category text/);
  // The three headings moved into section 1 of the client's newer HSE screen: they are
  // tiles now, and the heading they stand for is still stored next to the event kind.
  assert.match(operations, /\{ id: "health", en: "Health", nl: "Health", icon: HeartPulse, category: "health", eventType: "observation" \}/);
  assert.match(operations, /category: "safety"/);
  assert.doesNotMatch(operations, /Different HSE situation|Andere HSE-situatie/);

  // #25: the form says it is a materials delivery, the format hides away, a delivery is
  // several lines with their own words, and the crossed-out fields are gone.
  assert.match(operations, /title=\{registerNames\[registerForm\.type\]/);
  assert.doesNotMatch(operations, /Add project register item|Projectregister aanvullen/);
  assert.match(operations, /register-type-switch/);
  assert.match(operations, /const \[registerLines, setRegisterLines\]/);
  assert.match(operations, /Add a line|Regel toevoegen/);
  assert.match(operations, /Description · optional|Omschrijving · optioneel/);
  assert.match(operations, /lines: deliveryLines\.map/);
  assert.doesNotMatch(operations, /Different title or document content|Andere titel of documentinhoud/);
  assert.doesNotMatch(operations, /Involved party|Betrokken partij/);
  assert.doesNotMatch(operations, /sketch-open-button/);
  assert.match(styles, /\.register-line \{/);

  // #22 named the drawing field on the field-record form, which is gone with that form; a
  // photo still picks its spot on the PDF drawing in the photo workspace.
  assert.doesNotMatch(app, /function EntryModal/);
});

test("builds the HSE observation / issue screen the client sent, section by section", async () => {
  const [operations, dataLayer, pendingRecords, issueMigration, evidence, periodPdf, periodDocx, styles] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/pending-records.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608050003_hse_issue_form_sections.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/photo-evidence.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/period-report-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/period-report-docx.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // The head of the screen: everything the app already knows before a box is filled in.
  assert.match(operations, /sectioned-record-context/);
  for (const heading of [/Issue ID/, /Reporter|Melder/, /Site \/ location|Locatie/, /Weather|Weer/, /Department|Afdeling/]) {
    assert.match(operations, heading);
  }

  // The twelve numbered sections, in the order and with the words the client drew.
  const sections = [
    [1, /Issue type", "Issuetype/],
    [2, /Category", "Categorie/],
    [3, /Severity", "Ernst/],
    [4, /Description", "Omschrijving/],
    [5, /Location", "Locatie/],
    [6, /Photos \/ evidence/],
    [7, /Immediate action taken", "Directe maatregel/],
    [8, /Responsible person", "Verantwoordelijke/],
    [9, /Due date", "Deadline/],
    [10, /Root cause", "Oorzaak/],
    [11, /Corrective action required", "Vereiste correctieve actie/],
    [12, /Notes", "Notities/],
  ];
  for (const [number, label] of sections) {
    assert.match(operations, new RegExp(`record-section-number">${number}<`), `section ${number} is numbered as the client numbered it`);
    assert.match(operations, label);
  }

  // Section 1 is a grid of tiles, and each tile keeps saying both what the client's form
  // files it under and what kind of event it is.
  assert.match(operations, /const hseIssueTypes = \[/);
  for (const tile of ["safety", "health", "environment", "near_miss", "incident", "unsafe_act", "unsafe_condition", "other"]) {
    assert.match(operations, new RegExp(`\\{ id: "${tile}",`));
  }
  assert.match(operations, /const chooseHseIssueType = \(id: string\)/);

  // Sections 3 and 9 belong together: the severity decides the priority and the deadline,
  // by the same ladder a finding is given.
  assert.match(operations, /const recordSeverityDueDays: Record<string, number> = \{ critical: 1, high: 3, medium: 7, low: 14 \}/);
  assert.match(operations, /record-priority-badge record-priority-\$\{hsePriority\}/);
  assert.match(issueMigration, /when 'critical' then interval '1 day' when 'high' then interval '3 days'/);

  // Section 7 is ticked, not typed, and still reaches the report as one measure.
  assert.match(operations, /const immediateActionsTaken = \[/);
  assert.match(operations, /const hseImmediateMeasure = \(form: HseIssueForm\)/);
  assert.match(operations, /immediate_actions text\[\]|immediateActions/);
  assert.match(issueMigration, /add column if not exists immediate_actions text\[\] not null default '\{\}'/);

  // The screen has no title box, so the list line is the first sentence of the description.
  assert.match(operations, /function recordLogLine\(description: string, fallback: string\)/);
  assert.doesNotMatch(operations, /hseForm\.title\.trim\(\)\.length < 3/);

  // Every new box has a column of its own, is written by one function and is read back
  // the same way on a device that is still offline.
  for (const column of ["issue_type", "issue_category", "responsible_person", "due_at", "root_cause", "corrective_action", "notes", "latitude", "longitude"]) {
    assert.match(issueMigration, new RegExp(`add column if not exists ${column}\\b`));
    assert.match(dataLayer, new RegExp(`${column}`));
  }
  assert.match(dataLayer, /p_immediate_actions: input\.immediateActions \?\? \[\]/);
  assert.match(pendingRecords, /issue_type: \(input\.issueType as string\) \|\| null/);

  // A database that has not run the migration yet still records the event and still loads
  // its own list: the newer boxes step back one signature at a time.
  assert.match(dataLayer, /schemaFeatureMissing\(hseResult\.error, \[/);
  assert.match(dataLayer, /const fallbackType = input\.type === "observation" \|\| input\.type === "other" \? "positive_observation" : input\.type/);

  // A box that is filled in on the screen is printed in the period report; a box that is
  // only asked for reads as a box that was never stored.
  assert.match(periodPdf, /export function immediateActionText\(issue: Record<string, unknown>\)/);
  for (const key of ["hse_category", "issue_category", "responsible_person", "immediate_measure", "root_cause"]) {
    assert.match(periodPdf, new RegExp(`"${key}"`), `the period report prints ${key}`);
    assert.match(periodDocx, new RegExp(`"${key}"`), `the period report document prints ${key}`);
  }

  // "Save draft" parks the screen on the device; it is offered back, never pushed back.
  assert.match(operations, /Save draft", "Concept opslaan/);
  assert.match(operations, /Put it back", "Terugzetten/);
  assert.match(operations, /function writeRecordDraft\(kind: RecordDraftKind, projectId: string, form: unknown\)/);

  // The screen the client drew has a head of its own: back, what it is, whether it will
  // sync, and the button that parks it — and a provisional number while it is written.
  assert.match(operations, /className="record-back-button"/);
  assert.match(operations, /record-sync-chip\$\{online \? "" : " offline"\}/);
  assert.match(operations, /className="ui-button ui-button--secondary ui-button--md record-heading-draft"/);
  assert.match(operations, /function nextRecordNumber\(existing: string\[\], prefix: string, year: string\)/);
  assert.match(operations, /Provisional · fixed on submit|Voorlopig · vast bij indienen/);

  // Section 6 is the strip of pictures with the tile that adds one, not a list of rows.
  assert.match(operations, /className="record-evidence-strip"/);
  assert.match(operations, /layout="gallery"/);
  assert.match(evidence, /layout\?: "list" \| "gallery";/);
  assert.match(evidence, /className="photo-evidence-tile-remove"/);
  assert.match(styles, /\.record-add-photo \{/);

  // The strip has a class of its own: .record-photo-strip already belonged to the photos
  // under a saved record, and its button and image rules resized these tiles into a grey
  // square with a cross on it.
  assert.match(operations, /className="record-evidence-strip"/);
  assert.doesNotMatch(operations, /className="record-photo-strip">\s*\n\s*<PhotoEvidenceList/);
  assert.match(styles, /\.record-evidence-strip \{ display: flex; align-items: center; flex-wrap: wrap; gap: 9px; \}/);
  assert.match(styles, /\.photo-evidence-tile-open \{[^}]*width: 108px;/);

  // Section 9 says what the deadline means, and a chosen person can be cleared again.
  assert.match(operations, /function deadlineDistanceLabel\(/);
  assert.match(operations, /className="record-due-distance"/);
  assert.match(operations, /className="record-field-clear"/);

  // Every control on the client's bar does something: the chip pushes what is still on
  // the device, the paperclip attaches, and the boxes read back where they are looked for.
  assert.match(operations, /const syncWaitingRecordsNow = \(\) => void run\(/);
  assert.match(operations, /<label className="record-attachment-count">/);
  assert.match(operations, /event\.responsible_person \? text\(`for \$\{event\.responsible_person\}`/);
  assert.match(operations, /Already done:", "Al gedaan:/);

  // The two columns, the tiles and the action bar have a shape of their own.
  for (const rule of [/\.sectioned-record-columns \{/, /\.record-tile-grid \{/, /\.record-severity-choices \{/, /\.record-action-grid \{/, /\.record-form-actions \{/]) {
    assert.match(styles, rule);
  }
});

test("gives the issue screen the same sections the client drew for it", async () => {
  const [operations, dataLayer, pendingRecords, uploadQueue] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/pending-records.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/upload-queue.ts", import.meta.url), "utf8"),
  ]);

  // The issue screen and the NCR form are two screens now, not one form with conditions.
  assert.match(operations, /\{showForm && findingScope === "issue" \? \(/);
  assert.match(operations, /\{showForm && findingScope === "ncr" \? \(/);

  // The eleven sections of the client's own issue screen, in their order.
  const sections = [
    [1, /Issue type", "Issuetype/],
    [2, /Category", "Categorie/],
    [3, /Severity", "Ernst/],
    [4, /Description", "Omschrijving/],
    [5, /Location", "Locatie/],
    [6, /Photos \/ evidence/],
    [7, /Immediate action taken", "Directe maatregel/],
    [8, /Responsible person", "Verantwoordelijke/],
    [9, /Due date", "Deadline/],
    [10, /Root cause", "Oorzaak/],
    [11, /Additional notes", "Aanvullende notities/],
  ];
  for (const [number, label] of sections) {
    assert.match(operations, new RegExp(`record-section record-order-${number}"`), `issue section ${number} is numbered as the client numbered it`);
    assert.match(operations, label);
  }

  // Section 1 is the tile grid of the client's issue screen, with the kinds it files under.
  assert.match(operations, /const issueTypeTiles = \[/);
  for (const tile of ["safety", "quality", "environmental", "equipment", "materials", "schedule", "operational", "documentation", "other"]) {
    assert.match(operations, new RegExp(`\\{ id: "${tile}", en:`));
  }

  // Severity now goes up to critical on an ordinary issue, because the client's screen does.
  assert.match(operations, /record-severity-choice record-severity-choice-\$\{value\}\$\{findingForm\.severity === value/);

  // The two screens share one shape: the same sections, tiles, checks and action bar.
  for (const shared of [/const immediateActionsTaken = \[/, /const recordRootCauses = \[/, /function recordLogLine\(/, /function recordDueDateTimeDefault\(/]) {
    assert.match(operations, shared);
  }

  // The new boxes reach the record: the colleague is assigned, the rest travels in the
  // issue-management object the client's own register already uses.
  assert.match(dataLayer, /p_assigned_user_id: input\.assignedUserId \|\| null/);
  for (const key of ["issue_category", "immediate_actions", "responsible_person", "root_cause", "latitude", "longitude"]) {
    assert.match(dataLayer, new RegExp(`${key}:`));
  }
  assert.match(pendingRecords, /assigned_user_id: \(input\.assignedUserId as string\) \|\| null/);
  assert.match(uploadQueue, /assignedUserId\?: string;/);

  // The impact, the follow-up and the escalation flag are not on the new screen but are
  // read by the period report, so they stay reachable instead of disappearing.
  assert.match(operations, /<details className="record-extra-details">/);
  assert.match(operations, /Impact, follow-up and escalation|Impact, opvolging en escalatie/);
  assert.match(operations, /escalationRequired: event\.target\.checked/);
});

test("shows the spot on a satellite view without opening the application to the map provider", async () => {
  const [route, mapComponent, operations, config, styles, checklist] = await Promise.all([
    readFile(new URL("../app/api/maps/static/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/record-location-map.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../../../docs/operations/vercel-deployment-checklist.md", import.meta.url), "utf8"),
  ]);

  // The key belongs to the server. It is never a NEXT_PUBLIC_ value and never reaches a
  // phone, so the picture is fetched here and handed back as an image of this application.
  assert.match(route, /process\.env\.GOOGLE_MAPS_API_KEY/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_GOOGLE/);
  assert.doesNotMatch(mapComponent, /googleapis|GOOGLE_MAPS/);
  assert.match(route, /https:\/\/maps\.googleapis\.com\/maps\/api\/staticmap/);

  // Every picture costs the project money, so an anonymous caller gets nothing.
  assert.match(route, /Signing in is required/);
  assert.match(route, /auth\.getUser\(accessToken\)/);
  assert.match(mapComponent, /authorization: `Bearer \$\{token\}`/);

  // The security policy stays shut: no external script, no iframe, images from here only.
  assert.match(config, /"img-src 'self' blob: data:"/);
  assert.doesNotMatch(config, /frame-src/);
  assert.doesNotMatch(config, /script-src[^"]*googleapis/);
  // The screens do ask the phone where it stands, so geolocation has to be allowed here.
  assert.match(config, /geolocation=\(self\)/);

  // Tapping the picture moves the pin: the provider's own script is not needed for that.
  assert.match(mapComponent, /import \{ coordinatesFromTap, validMapCoordinates \} from "@\/lib\/maps\/mercator\.mjs"/);
  assert.match(mapComponent, /Tap the map to move the pin|Tik op de kaart om de speld te verplaatsen/);
  assert.match(styles, /\.record-location-map img \{/);

  // Without a provider, and on a site without a signal, the coordinates stay.
  assert.match(route, /No map provider is configured for this environment/);
  assert.match(mapComponent, /if \(!cancelled\) setMapImage\(null\)/);
  assert.match(mapComponent, /No coordinates recorded yet|Nog geen coördinaten vastgelegd/);

  // Both record screens use the one map block, centred on the project until the phone
  // has been asked.
  assert.equal(operations.match(/<RecordLocationMap/g)?.length, 2);
  assert.match(operations, /const projectCenter = liveWeather \? \{ latitude: liveWeather\.latitude, longitude: liveWeather\.longitude \} : null/);

  // Whoever deploys this has to know the key exists, what it costs and how to cap it.
  assert.match(checklist, /GOOGLE_MAPS_API_KEY/);
  assert.match(checklist, /Maps Static API/);
});

test("keeps the record screens and the photo library usable on a phone and a tablet", async () => {
  const [styles, media] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
  ]);

  // In one column the sections are as wide as the screen. Without this they keep the
  // align-items: start of the two-column rule and every box is as wide as its own text.
  const stacked = styles.match(/\.sectioned-record-columns \{ align-items: stretch; display: flex; flex-direction: column; \}/g);
  assert.equal(stacked?.length, 2, "both the narrow container and the narrow window stack into full-width sections");

  // Two columns when the form is wide enough, not when the window is: the workspace has a
  // module switcher beside it, so a wide tablet can still leave a phone-width form.
  assert.match(styles, /\.sectioned-record-form \{ container-type: inline-size; \}/);
  assert.match(styles, /@container \(max-width: 780px\)/);

  // The head of the form wraps instead of squeezing the title to a few pixels.
  assert.match(styles, /\.sectioned-record-heading \{[^}]*flex-wrap: wrap;/);
  // A date and time field has a wide minimum of its own; the row wraps around it.
  assert.match(styles, /\.record-due-field \{ align-items: center; display: flex; flex-wrap: wrap;/);
  assert.match(styles, /\.record-due-field input \{ flex: 1 1 150px; min-width: 0; \}/);

  // The photo in the library opens when it is tapped, like a photo everywhere else, and
  // the icons beside it are big enough for a thumb.
  assert.match(media, /className="media-card-open"/);
  assert.match(media, /onClick=\{\(\) => void openProjectFile\(client, file\.id, file\.original_name\)\}/);
  assert.match(styles, /\.media-card-open \{/);
  assert.match(styles, /\.media-file-actions button \{[^}]*min-height: 42px; min-width: 42px;/);
});

test("gives a file a name a person can read, and a phone controls it can reach", async () => {
  const [library, media, drawings, styles] = await Promise.all([
    readFile(new URL("../lib/media/photo-library.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/drawing-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // A phone names a photo after a millisecond and a camera after its counter. The card
  // shows what was written about the picture, or what it is and when it arrived.
  assert.match(library, /export function readableFileLabel\(/);
  assert.match(library, /export function machineNamed\(/);
  assert.match(media, /readableFileLabel\(file, \{/);
  assert.match(drawings, /const drawingLabel = \(drawing: FileRecord\)/);
  assert.doesNotMatch(drawings, /<h2>\{activeDrawing\.original_name\}<\/h2>/);

  // The browser's own file control was the one thing on the drawing screen that did not
  // look like the application around it.
  assert.match(drawings, /className="finding-photo-capture drawing-file-picker"/);
  assert.match(styles, /\.drawing-file-picker \{ width: 100%; \}/);

  // The page arrows were pushed off the card, and the help button covered the actions of
  // the last row in every list.
  assert.match(styles, /\.drawing-stage-header \{[^}]*flex-wrap: wrap;/);
  assert.match(styles, /\.field-guide-trigger \{ bottom: calc\(84px \+ env\(safe-area-inset-bottom\)\); \}/);

  // A half-transparent orange button reads as broken instead of as not-yet.
  assert.doesNotMatch(styles, /\.ui-button--primary:disabled \{\s*cursor: not-allowed;\s*opacity: 0\.48;/);
  assert.match(styles, /\.ui-button--primary:disabled \{[^}]*color: var\(--ink-700\);/);
});

test("opens a stored photo on its own screen everywhere it is shown", async () => {
  const [detail, media, visual, workspace, styles] = await Promise.all([
    readFile(new URL("../app/stored-photo-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // One screen, used by every place a stored photo is shown, so they cannot drift apart.
  assert.match(detail, /export function StoredPhotoDetail\(/);
  assert.match(media, /<StoredPhotoDetail/);
  assert.match(workspace, /<StoredPhotoDetail/);
  assert.doesNotMatch(media, /function MediaFileDetail\(/);

  // It says what the app knows about the picture.
  for (const fact of [/Building", "Gebouw/, /Taken", "Gemaakt/, /Folder", "Map/, /Marked problems", "Gemarkeerde problemen/, /Linked records", "Gekoppelde registraties/]) {
    assert.match(detail, fact);
  }
  assert.match(styles, /\.media-detail-facts \{/);

  // Marking a problem happens on a capture; a photo gets one the first time it is asked
  // for, on the file that is already there.
  assert.match(detail, /const markProblem = async \(\)/);
  assert.match(detail, /createVisualCapture\(client, \{/);
  assert.match(detail, /Mark a problem on this photo", "Probleem op deze foto markeren/);

  // Tapping a photo no longer drops the raw file into a browser tab.
  assert.doesNotMatch(workspace, /onClick=\{\(\) => void run\(\(\) => openProjectFile\(client, file\.id, file\.original_name\)/);
  assert.match(workspace, /onClick=\{\(\) => setOpenFileId\(file\.id\)\}/);
  assert.match(media, /setOpenFileId\(file\.id\); setOpenStackIds/);

  // And the marking screen opens on that photo instead of on whatever was first.
  assert.match(workspace, /markPhotoIssue=\{\(fileId\) => \{ setVisualFileId\(fileId\); switchTab\("visual"\); \}\}/);
  assert.match(workspace, /openPhotoMarking=\{\(fileId\) => \{ setVisualFileId\(fileId\); switchTab\("visual"\); \}\}/);
  assert.match(visual, /const \[pendingSelectionFileId, setPendingSelectionFileId\] = useState\(initialFileId\)/);
  assert.match(visual, /if \(initialFileId\) onInitialFileConsumed\?\.\(\)/);
});

test("keeps Photos photo-only and gives complete asset and historical visual routes", async () => {
  const [workspace, media, evidence, visual, operations, queue, migration, styles] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/photo-evidence.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline/upload-queue.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608050006_photo_stack_identity.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(workspace, /ProjectTab = [^;]*"assets"/);
  assert.match(workspace, /mode="photos"/);
  assert.match(workspace, /mode="assets"/);
  assert.match(media, /assetsMode \? <button[\s\S]{0,600}Upload drawing/);
  assert.match(media, /assetsMode \? <div className="media-folder-bar/);
  assert.match(media, /asset-record-library/);
  assert.match(media, /updateProjectFile/);
  assert.match(media, /linkFileToRecord/);
  assert.doesNotMatch(media, /allowMarkup=\{false\}/);
  assert.doesNotMatch(evidence, /FacingDirectionField/);
  assert.doesNotMatch(visual, /FacingDirectionField/);

  assert.match(media, /evidenceGroupId/);
  assert.match(queue, /stackId: upload\.evidenceGroupId/);
  assert.match(migration, /add column if not exists stack_id uuid/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
  assert.match(styles, /\.media-stack-thumbnails/);
  assert.match(styles, /\.media-stack-detail-strip/);

  assert.match(operations, /const historicalImageCaptures/);
  assert.match(operations, /derived_from_file: true/);
  assert.match(visual, /if \(activeCapture\.derived_from_file\)/);
  assert.match(visual, /No project photos yet/);
});

test("records accountable delays and keeps project documents in one short flow", async () => {
  const [delayForm, operations, dailyPdf, periodPdf, periodDocx, projectDocuments, migration, styles] = await Promise.all([
    readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/daily-report-model.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/period-report-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/period-report-docx.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/project-documents-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608050008_delay_contractor_acknowledgement.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(delayForm, /Reason for delay/);
  assert.match(delayForm, /<SignatureField/);
  assert.match(delayForm, /contractor is responsible for the work affected by this delay/);
  assert.match(operations, /schemaFeatureMissing\(dailyWorkResult\.error, \[/);
  for (const source of [dailyPdf, periodPdf, periodDocx]) {
    assert.match(source, /delay_reason/);
    assert.match(source, /contractor_signature_image/);
  }
  assert.match(migration, /add column if not exists contractor_signature_image text/);
  assert.match(migration, /notify pgrst, 'reload schema'/);

  assert.match(projectDocuments, /createMediaFolder/);
  assert.match(projectDocuments, /queueOfflineUpload/);
  assert.match(projectDocuments, /onDrop=/);
  assert.match(projectDocuments, /normalizeRecordCode/);
  assert.match(projectDocuments, /linkFileToRecord/);
  assert.match(projectDocuments, /Document linked without copying the file/);
  assert.match(styles, /@media \(max-width: 1280px\)[\s\S]*\.client-workspace-grid \{ grid-template-columns: repeat\(3/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.client-workspace-grid \{ grid-template-columns: repeat\(2/);
});

test("a search result opens, the assets tab survives, and a shared day stays on every building", async () => {
  const [shell, workspace, mediaLibrary, dailyRegister] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/daily-work-register.tsx", import.meta.url), "utf8"),
  ]);

  // Assets is a real tab: leaving it and coming back has to land on it again, so it has to
  // be one of the keys the restored session accepts.
  assert.match(shell, /const projectTabKeys: ProjectTabKey\[\] = \[[^\]]*"assets"/);
  assert.match(workspace, /openProjectArea: \(tab: [^)]*\| "assets" \| "submissions"/);

  // A photo or document found in the workspace search opens itself, instead of dropping the
  // supervisor on the tab to look for it a second time.
  assert.match(workspace, /<MediaLibraryWorkspace mode="photos" focusRecordId=\{focusRecordId\}/);
  assert.match(workspace, /<MediaLibraryWorkspace mode="assets" focusRecordId=\{focusRecordId\}/);
  assert.match(mediaLibrary, /focusRecordId\.startsWith\("file:"\)/);
  assert.match(mediaLibrary, /setOpenFileId\(file\.id\)/);

  // A day recorded for two buildings belongs to both of them, in the filter and on the card.
  assert.match(dailyRegister, /recordBuildings\(record\)\.includes\(buildingFilter\)/);
  assert.match(dailyRegister, /recordBuildings\(record\)\.map\(buildingName\)/);
});

test("the punchlist screen is the client's punchlist again, and a photo can be marked anywhere", async () => {
  const [workspace, media] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
  ]);

  // The module behind the Punchlist button keeps the client's own screen: its plain form
  // heading, one building with "All buildings" on it, and the staged list with the
  // contractor-to-supervisor review cycle above it.
  assert.match(workspace, /className="operation-form wide sectioned-record-form"/);
  assert.match(workspace, /<BuildingMultiPicker id="finding-buildings"/);
  assert.match(workspace, /punchlist-command/);
  assert.match(workspace, /punchlist-stages/);
  assert.match(workspace, /punchlist-cycle-card/);
  // A project-wide issue does not have to name an exact location to be submittable.
  assert.match(workspace, /exactLocationRequired && !findingCoversEveryBuilding && !findingLocationNodeId/);
  // The record list keeps the actions the client asked for in the round before this one.
  assert.match(workspace, /viewRecord=\{viewFinding\}/);
  assert.match(workspace, /editRecord=\{editFinding\}/);

  // Every photo surface can carry a marked problem: the capture list and the stored photo.
  assert.doesNotMatch(media, /allowMarkup=\{false\}/);
  assert.match(media, /openMarking=\{markPhotoIssue\}/);
  assert.match(workspace, /mode="photos"[\s\S]*?markPhotoIssue=/);
});

test("a spot on a drawing carries its own record, and a sheet is known by its own name", async () => {
  const [drawing, styles] = await Promise.all([
    readFile(new URL("../app/drawing-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // Tapping the drawing on its own screen used to end in a panel that only said no.
  assert.doesNotMatch(drawing, /Open the record first, then place it here/);
  assert.match(drawing, /const createIssueAtPoint = async/);
  assert.match(drawing, /const linkRecordToPoint = async/);
  assert.match(drawing, /createFinding\(client, \{/);
  assert.match(drawing, /drawing-spot-modes/);
  assert.match(styles, /\.drawing-spot-modes/);

  // The backlog of records that stand on no drawing yet is one tap from being placed.
  assert.match(drawing, /const unplacedRecords = pinnableRecords/);
  assert.match(styles, /\.drawing-unplaced-list/);

  // Sheet labels and the title come out of the drawing itself.
  assert.match(drawing, /pdf\.getPageLabels\(\)/);
  assert.match(drawing, /pdf\.getMetadata\(\)/);
  assert.match(drawing, /onDocumentDetails/);
  assert.match(drawing, /const pageLabel = \(page: number\)/);

  // An upload that cannot go through says what is wrong with it.
  assert.match(drawing, /const uploadRefusal = \(file: File \| null\)/);
  assert.match(drawing, /the project limit is/);
  assert.match(drawing, /DWG source stored/);
});

test("nothing is left open: folders nest, a marker is signed, and a note can be corrected", async () => {
  const [media, visual, operations, tools, styles] = await Promise.all([
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/field-tools.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // Assets: folders read as a tree and can be moved, not just made and renamed.
  assert.match(media, /nestMediaFolders/);
  assert.match(media, /folderMoveTargets\(folders, folder\.id\)/);
  assert.match(media, /const moveFolder = async/);
  assert.match(media, /updateMediaFolder\(client, folder\.id, \{ parentId/);
  assert.match(styles, /\.asset-folder-move/);

  // A marker that creates a formal finding is signed like every other record screen.
  assert.match(visual, /<SignatureField/);
  assert.match(visual, /setIssueSignature/);
  assert.match(operations, /signedBy\?: string;[\s\S]{0,200}p_disposition|input\.signedBy && annotation\?\.finding_id/);
  assert.match(operations, /input\.signedBy && annotation\?\.finding_id/);

  // The field notepad opens a saved note back into its own form and updates it.
  assert.match(tools, /const openNote =/);
  assert.match(tools, /updateRegisterRecord\(client, \{/);
  assert.match(tools, /Open and edit/);
  // The number is assigned once, at creation; editing never mints a second one.
  assert.doesNotMatch(tools, /editingNoteId[\s\S]{0,200}entry_number:/);
});

test("the drawing overlay draws in the page's own pixels, with real arrowheads and clouds", async () => {
  const [drawing, geometry] = await Promise.all([
    readFile(new URL("../app/drawing-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/drawings/markup-geometry.mjs", import.meta.url), "utf8"),
  ]);

  // The square viewBox stretched over a page of any shape is what squashed every shape:
  // an arrowhead became a black wedge and a revision cloud became a row of dots.
  assert.doesNotMatch(drawing, /viewBox="0 0 1000 1000"/);
  assert.doesNotMatch(drawing, /preserveAspectRatio="none"/);
  assert.match(drawing, /viewBox=\{`0 0 \$\{pageSize\.width\} \$\{pageSize\.height\}`\}/);

  // No SVG marker: it scales with the stroke and context-stroke is not honoured in
  // Chrome, which is why the heads rendered black and enormous.
  assert.doesNotMatch(drawing, /<marker/);
  assert.doesNotMatch(drawing, /context-stroke/);
  assert.doesNotMatch(drawing, /markerEnd/);
  assert.match(drawing, /arrowHeadPoints\(start, end, width\)/);
  assert.match(drawing, /<polygon points=\{arrowHeadPoints/);

  // A cloud is a scalloped arc path, not a dashed straight line.
  assert.doesNotMatch(drawing, /strokeDasharray=\{tool === "cloud"/);
  assert.match(drawing, /d=\{cloudPath\(points\)\}/);
  assert.match(geometry, /A \$\{round\(arc\)\} \$\{round\(arc\)\}/);

  // Stroke widths are the widths the supervisor chose, not those times 2.5.
  assert.doesNotMatch(drawing, /stroke_width\) \* 2\.5/);
  assert.doesNotMatch(drawing, /strokeWidth \* 2\.5/);

  // The overlay is measured from the page, so rotation and split-screen keep it true.
  assert.match(drawing, /setPageSize\(\{ width, height \}\)/);
});

test("every workspace button opens the record it names", async () => {
  const [workspaceHome, workspace, app, dailyLog, styles] = await Promise.all([
    readFile(new URL("../app/project-workspace-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // Workforce is the register of §4.3, not the day's work list.
  assert.match(workspaceHome, /action: openWorkforce/);
  assert.match(workspace, /openWorkforce=\{\(\) => switchTab\("workforce"\)\}/);
  assert.match(app, /renderWorkforce: \(\{ close \}\) =>/);

  // A tile that names a register opens that register, not the last type chosen.
  assert.match(workspace, /if \(preset\?\.registerType\)/);
  assert.match(workspace, /clearRegisterStaging\(preset\.registerType\)/);
  assert.match(workspace, /if \(preset\?\.hseEventType\)/);
  assert.match(workspaceHome, /hseEventType: "incident"/);

  // Works and delays are read from the day closeout, so they are written there too: the
  // tile opens the day log on its own block. Writing an activity registration never
  // appeared in the list it was pressed from.
  assert.match(workspace, /setDayLogFocus\(view === "day" \? undefined : view === "delays" \? "delay" : view\)/);
  assert.doesNotMatch(app, /setEntryActivityKind/);
  assert.match(dailyLog, /focus\?: "delay" \| "works_ongoing" \| "works_completed"/);

  // Works ongoing and works completed are two fields of one day closeout, opened on their
  // own question, so each button ends up with the field it was pressed for filled in.
  assert.match(dailyLog, /const summaryRequired = dayContextRequired \|\| ongoingOnly/);
  assert.match(dailyLog, /const performedRequired = dayContextRequired \|\| completedOnly/);
  assert.match(dailyLog, /daily-log-field-ongoing/);
  assert.match(dailyLog, /daily-log-field-completed/);
  // The one that was not asked for folds away instead of standing beside it dimmed; the
  // full check on that lives in "works ongoing and works completed stop opening the same
  // form" below.
  assert.match(styles, /\.daily-log-body\.focus-ongoing \.daily-log-field-ongoing textarea/);

  // Opening on a block means that block reads as the subject, and a focused screen only
  // demands the day's own answers when there is no closeout to attach itself to.
  // Works ongoing is the exception: one input box plus the buildings, never the rest of the day
  // (client, 30-10-2026), so even its first entry of the day asks for nothing else.
  assert.match(dailyLog, /const dayContextRequired = !\(delayOnly \|\| workOnly\) \|\| \(!initialCloseout && !ongoingOnly\)/);
  assert.match(dailyLog, /const ordered = ongoingOnly\s*\? \[ongoingBlock\]/);
  assert.match(styles, /\.daily-log-body\.focus-delay > \.daily-log-delay/);

  // Every route into a workspace module runs through one helper, so a tile, a menu row and
  // a dialog all land on the module the same way.
  assert.match(app, /const openWorkspaceModule = \(tab: ProjectTabKey\) => \{/);
  assert.doesNotMatch(app, /setInitialProjectTab\("visual"\);\n\s*setActiveNav\("project"\)/);
});

test("every record form is signed and can name more than one building", async () => {
  const [workspace, tools, dailyLog, visual, drawing, workforce, dataLayer, operations, migration] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/field-tools.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/drawing-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/workforce-register.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608070001_daily_and_workforce_signature.sql", import.meta.url), "utf8"),
  ]);

  // A signature on every form that writes a record.
  for (const [name, source] of [["workspace", workspace], ["field tools", tools], ["daily log", dailyLog], ["visual evidence", visual], ["drawing", drawing], ["workforce", workforce]]) {
    assert.match(source, /SignatureField/, `${name} has no signature field`);
  }
  assert.match(dailyLog, /value=\{daySignature\}/);
  assert.match(workforce, /value=\{signature\}/);
  assert.match(drawing, /value=\{spotSignature\}/);

  // More than one building on every form that belongs to buildings. The punchlist keeps
  // "All buildings" — it is selecting every one of them in the same control.
  for (const [name, source] of [["workspace", workspace], ["field tools", tools], ["daily log", dailyLog], ["visual evidence", visual], ["drawing", drawing]]) {
    assert.match(source, /BuildingMultiPicker|RecordBuildingsField/, `${name} cannot name more than one building`);
  }
  assert.match(workspace, /<BuildingMultiPicker id="finding-buildings"/);
  assert.match(workspace, /<BuildingMultiPicker id="ncr-buildings"/);
  assert.match(workspace, /const findingCoversEveryBuilding = buildings\.length > 0 && findingBuildingIds\.length === buildings\.length/);
  assert.match(visual, /<BuildingMultiPicker\s+id="marker-buildings"/);
  assert.match(drawing, /id="drawing-spot-buildings"/);

  // Storage, its stepped read-back and the schema reload the client's database needs.
  assert.match(migration, /alter table public\.day_closeouts[\s\S]{0,200}add column if not exists signature_image text/);
  assert.match(migration, /alter table public\.attendance_entries[\s\S]{0,200}add column if not exists signature_image text/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
  assert.match(operations, /schemaFeatureMissing\(dailyWorkResult\.error, \["signed_by", "signed_at", "signature_image"\]\)/);
  assert.match(dataLayer, /schemaColumnMissing\(update\.error, "signed_by"\)/);
  assert.match(dataLayer, /const signatureMissing = \["signed_by", "signed_at", "signature_image"\]/);
});

test("the photo screen has no folders, and nothing sends the user to a screen that does not exist", async () => {
  const [media, detail, guide, app, workspace, visual] = await Promise.all([
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/stored-photo-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/field-guide.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visual-evidence-workspace.tsx", import.meta.url), "utf8"),
  ]);

  // Folders belong to the asset library. Every folder control on this screen is behind
  // assetsMode, so the photo screen cannot grow one back by accident.
  for (const control of ["media-folder-bar", "media-folder-create", "media-folder-presets"]) {
    const at = media.indexOf(control);
    assert.ok(at > 0, `${control} is gone entirely; the asset library still needs it`);
    assert.match(media.slice(Math.max(0, at - 260), at), /assetsMode \?/, `${control} is not gated on the asset library`);
  }
  // The empty state used to say "this folder is empty" on a screen without folders.
  assert.match(media, /No photos yet|Nog geen foto's/);
  assert.match(media, /showFolder=\{assetsMode\}/);
  // A photo's own screen only names its folder where a folder can be opened.
  assert.match(detail, /showFolder\?: boolean;/);
  assert.match(detail, /\{showFolder \? <div><dt>\{text\("Folder", "Map"\)\}/);

  // The guide sent people to the photo screen to manage folders that are not there.
  assert.doesNotMatch(guide, /Photo folders|Fotomappen/);
  assert.match(guide, /Assets & folders|Middelen & mappen/);

  // "Photos & folders" is not a screen in this app; the sync queue lives under Photos.
  for (const [name, source] of [["app", app], ["workspace", workspace], ["visual evidence", visual], ["guide", guide], ["media", media]]) {
    assert.doesNotMatch(source, /Photos & folders/, `${name} names a screen that does not exist`);
    assert.doesNotMatch(source, /Foto(?:'|’)s & mappen/, `${name} names a screen that does not exist`);
  }

  // A focused day log belongs to the tile that opened it and never outlives it: the tile
  // sets the focus, and a whole-day request clears it.
  assert.match(workspace, /const openDailyWork = \(view: DailyWorkView \| "day"\)/);
  assert.match(workspace, /focus: dayLogFocus/);
});

test("closing an NCR asks for the Quality Control / Verification signature the client's own form requires", async () => {
  const [workspace, operations, ncrPdf, ncrDocx, migration] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/ncr-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/ncr-docx.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608070002_ncr_quality_control_signature.sql", import.meta.url), "utf8"),
  ]);

  // #1 · Client feedback of 7 August: the Quality Control / Verification box marks its
  // signature line required, exactly like the engineer's recommendation and the
  // contractor's correction already are — an issue closes without one.
  // The signature grew a box around it on 9 August — the rest of the Quality Control /
  // Verification field, which the client's own form also asks for.
  assert.match(workspace, /finding\.finding_type === "ncr" && nextStatus === "closed" \? \(\s*<div className="ncr-verification-box">/);
  assert.match(workspace, /Sign as the person closing this NCR|Onderteken als afsluiter van deze NCR/);
  assert.match(workspace, /finding\.finding_type === "ncr" && nextStatus === "closed" && \(!verificationSignature/);
  assert.match(workspace, /verificationSignature\?\.name \?\? "", verificationSignature\?\.image \?\? ""/);
  assert.match(workspace, /issue\.verification_signature_image/);

  // The transition RPC forwards the written signature, and degrades to the six-argument
  // function when a deployment has not refreshed its schema cache yet.
  assert.match(operations, /verification_signed_by\?: string;/);
  assert.match(operations, /p_verification_signed_by: verificationSignedBy \|\| null/);
  assert.match(operations, /schemaFeatureMissing\(result\.error, \["p_verification_signed_by", "p_verification_signature_image"\]\)/);

  // The database requires the signature only to close an NCR, never a plain issue, and
  // keeps the six-argument function working for a client that has not redeployed yet.
  assert.match(migration, /p_next_status = 'closed' and v_finding\.finding_type = 'ncr' and \(v_signed_by is null or v_signature_image is null\)/);
  assert.match(migration, /'issue_management'\]\)/);
  assert.match(migration, /grant execute on function public\.transition_project_finding\(uuid,text,text,text,text,text,text,text\) to authenticated;/);

  // The signature travels into the generated NCR documents, on the record itself —
  // never only the person who happens to download the file.
  assert.match(ncrPdf, /issue\.verification_signed_by \|\| context\.verifierName \|\| ""/);
  assert.match(ncrDocx, /issue\.verification_signed_by \|\| context\.verifierName \|\| ""/);
});

test("gives Lessons Learned the workspace tile the client struck Deadlines off", async () => {
  const [home, workspace] = await Promise.all([
    readFile(new URL("../app/project-workspace-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
  ]);

  // The workspace mockup strikes "Deadlines" through and writes LESSONS LEARNED over it.
  // The tile is gone; the deadline view of the action centre stays reachable from the
  // supporting tools, because the client struck the tile, not the escalations behind it.
  assert.doesNotMatch(home, /id: "deadlines"/);
  assert.match(home, /id: "lessons-learned"/);
  assert.match(home, /action: \(\) => openTask\("registers", false, \{ registerType: "lessons_learned" \}\)/);
  assert.match(home, /workspace-support-strip[\s\S]*onClick=\{\(\) => openActionCenter\("deadlines"\)\}/);

  // The register form itself: the client's own fields, minus the target date the client
  // struck off the original Lessons Learned mockup.
  assert.match(workspace, /const lessonsLearnedRegister = registerForm\.type === "lessons_learned"/);
  // The abbreviation belongs in the name: LL-0001 is the number the client writes under it.
  assert.match(workspace, /lessons_learned: "Geleerde lessen \(LL\)"/);
  for (const label of [/Issue", "Probleem"/, /Cause", "Oorzaak"/, /Solution \/ improvement/, /Expected results/, /Follow-up action/]) {
    assert.match(workspace, label);
  }
  assert.doesNotMatch(workspace, /lessonForm\.targetDate/);

  // Picture of Issue and Picture of Result: two named slots, both required, because a
  // pile of photos cannot say which one is the before and which one is the after.
  assert.match(workspace, /label=\{text\("Picture of issue", "Foto van het probleem"\)\}/);
  assert.match(workspace, /label=\{text\("Picture of result", "Foto van het resultaat"\)\}/);
  assert.match(workspace, /Boolean\(registerNamedPhotos\.lesson_issue\)/);
  assert.match(workspace, /Boolean\(registerNamedPhotos\.lesson_result\)/);
});

test("a named photo slot files its picture under the box it was taken in", async () => {
  const [evidence, workspace, css] = await Promise.all([
    readFile(new URL("../app/photo-evidence.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // One component for every photo the client's forms ask for by name, so all of them get
  // the same detail screen, the same marking pad and the same words.
  assert.match(evidence, /export function NamedPhotoSlot/);
  assert.match(evidence, /<PhotoDetailSheet/);
  assert.match(css, /\.named-photo-slot-capture/);

  // The label travels with the picture into the media library and onto the record, which
  // is the whole point of a named slot over one more photo in the pile.
  assert.match(workspace, /const namedPhotoRoles: Record<string, \{ en: string; nl: string \}>/);
  assert.match(workspace, /namedPhotoLabel\(role, language\)/);
  assert.match(workspace, /named_photos: namedRegisterPhotos\.map/);
});

test("gives Agreements Made the four boxes of the client's own form", async () => {
  const [workspace, agreement] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/agreement-signature.tsx", import.meta.url), "utf8"),
  ]);

  // 1 Agreement details, 2 Action owner, 3 Agreement confirmation, 4 Completion.
  for (const heading of [
    /title=\{text\("Agreement details", "Details van de afspraak"\)\}/,
    /title=\{text\("Action owner", "Eigenaar van de actie"\)\}/,
    /title=\{text\("Agreement confirmation", "Bevestiging van de afspraak"\)\}/,
    /title=\{text\("Completion", "Afronding"\)\}/,
  ]) {
    assert.match(workspace, heading);
  }
  assert.match(workspace, /agreementRecordDetails\(agreementRecord\)/);

  // Two named signers, not three: the client struck the developer's column off the
  // Agreement Confirmation box. Each carries a name, a position and a signature.
  assert.match(workspace, /roleLabels=\{\[text\("Contractor representative", "Vertegenwoordiger aannemer"\), text\("Supervision \(consultant\)", "Supervisie \(consultant\)"\)\]\}/);
  assert.doesNotMatch(workspace, /Developer representative/i);
  assert.match(agreement, /positionA: string;/);
  assert.match(agreement, /position_first: state\.positionA\.trim\(\) \|\| null/);

  // The completion box carries the date the status was reached, next to the status.
  assert.match(workspace, /agreementRecord\.actualCompletionDate/);
  assert.match(agreement, /completion_status: state\.completionStatus \|\| null/);
});

test("finishes the NCR form the way the client marked up its three sheets", async () => {
  const [workspace, operations, ncrPdf, ncrDocx, share, migration] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/ncr-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/ncr-docx.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/share/[token]/external-share-actions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608090001_ncr_quality_control_verification_box.sql", import.meta.url), "utf8"),
  ]);

  // The two lists the client kept, with the twelve and fourteen entries they wrote out.
  assert.match(workspace, /const ncrCategories = \[/);
  assert.match(workspace, /const ncrWorkTypes = \[/);
  assert.equal((workspace.match(/^\s+\{ id: "[a-z_]+", en: "[^"]+", nl: "[^"]+" \},$/gm) ?? []).length > 0, true);
  for (const option of [/en: "Workmanship", nl: "Uitvoering"/, /en: "Concrete work", nl: "Betonwerk"/, /en: "Flooring \/ tiling \/ LVT"/]) {
    assert.match(workspace, option);
  }

  // The third list on that sheet is struck through and must not come back.
  assert.doesNotMatch(workspace, /const ncrSources = \[/);
  assert.doesNotMatch(workspace, /Site Inspection \(Internal\)/);

  // "Corrective Action Required" is struck off the NCR form, and only off that one: the
  // issue screen has no engineer's recommendation to duplicate, so it keeps its box.
  const ncrFormStart = workspace.indexOf('{showForm && findingScope === "ncr" ? (');
  const ncrForm = workspace.slice(ncrFormStart, workspace.indexOf("{submittedFinding ? (", ncrFormStart));
  assert.ok(ncrFormStart > 0 && ncrForm.length > 1000, "the NCR entry form should be findable in the workspace");
  assert.doesNotMatch(ncrForm, /text\("Required follow-up", "Vereiste opvolging"\)/);
  assert.match(workspace, /text\("Required follow-up", "Vereiste opvolging"\)/);
  assert.match(ncrForm, /text\("Category", "Categorie"\)/);
  assert.match(ncrForm, /text\("Type", "Type"\)/);

  // Name and position under every signature line.
  assert.match(workspace, /findingForm\.signedPosition/);
  assert.match(operations, /signed_position\?: string;/);
  assert.match(operations, /correction_signed_position\?: string;/);
  assert.match(operations, /verification_signed_position\?: string;/);
  assert.match(share, /Functie \/ titel/);
  assert.match(ncrPdf, /line\.position/);
  assert.match(ncrDocx, /position \? \[labelValue\(`\$\{label\} · position`/);

  // The Quality Control / Verification box in full, and a database that only lets a
  // transition write that box — never the engineer's own recommendation.
  for (const field of [
    /text\("Quality control issue", "Bevinding kwaliteitscontrole"\)/,
    /text\("Date of QC inspection", "Datum QC-inspectie"\)/,
    /text\("Remarks \/ observations", "Opmerkingen \/ waarnemingen"\)/,
    /text\("Verification comments", "Verificatiecommentaar"\)/,
  ]) {
    assert.match(workspace, field);
  }
  assert.match(operations, /export type QualityControlVerification/);
  assert.match(migration, /'verification_signed_position','verification_comments'/);
  assert.match(migration, /'qc_inspection_date','qc_issue_resolved','qc_remarks'/);
  assert.match(migration, /p_verification_details jsonb default null/);
});

test("makes the change order the client's own CO form, with one approval column", async () => {
  const [workspace, changeOrder, coPdf, coDocx] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/forms/change-order.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/controlled-document-pdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/reports/controlled-document-docx.ts", import.meta.url), "utf8"),
  ]);

  for (const heading of [
    /title=\{text\("Change description", "Omschrijving van de wijziging"\)\}/,
    /title=\{text\("Scope of change", "Omvang van de wijziging"\)\}/,
    /title=\{text\("Schedule impact", "Planningimpact"\)\}/,
    /title=\{text\("Acknowledgement & agreement", "Erkenning & akkoord"\)\}/,
    /title=\{text\("Approval · supervision", "Goedkeuring · supervisie"\)\}/,
  ]) {
    assert.match(workspace, heading);
  }

  // Section 3 is a yes/no, and the revised date is calculated so the form the contractor
  // signs cannot contradict itself.
  assert.match(workspace, /changeOrder\.affectsSchedule === value/);
  assert.match(changeOrder, /export function changeOrderFinishDate/);
  assert.match(workspace, /changeOrderFinishDate\(changeOrder\.originalFinishDate, changeOrder\.extensionDays\)/);

  // The client struck two of the three approval columns and the status photo off this
  // form, so neither may come back.
  assert.doesNotMatch(workspace, /Developer \(originator\) approval/i);
  assert.doesNotMatch(workspace, /Contractor acceptance/i);
  assert.doesNotMatch(workspace, /Actual status on original finish date/i);
  assert.match(coPdf, /ISSUED AND APPROVED BY · SUPERVISION/);
  assert.match(coDocx, /Issued and approved by · supervision/);
});

test("gives the project delay report its own form, numbered PDR and evidenced by photo", async () => {
  const [workspace, delayReport, home, migration] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/forms/delay-report.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/project-workspace-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202608090003_delay_report_and_lessons_learned_register.sql", import.meta.url), "utf8"),
  ]);

  // Its own way in, and its own register type — the daily closeout keeps the day's lost
  // hours, which is a different record about a different thing.
  assert.match(home, /registerType: "delay_report"/);
  assert.match(workspace, /const delayReportRegister = registerForm\.type === "delay_report"/);
  assert.match(workspace, /delay_report: "Vertragingsrapport \(PDR\)"/);

  // The database has to accept both of the register types the app now writes. Lessons
  // Learned was added to the app in August without ever being added here.
  assert.match(migration, /'lessons_learned',\n\s+'delay_report'/);
  assert.match(migration, /when 'delay_report' then 'PDR'/);
  assert.match(migration, /when 'lessons_learned' then 'LL'/);

  // The five sections of the client's own form, with the header the client asked to work
  // "zelfde als HSE" — filled by the app before a box is touched.
  assert.match(workspace, /text\("Delay report header", "Kop van het vertragingsrapport"\)/);
  for (const heading of [
    /title=\{text\("Delay details", "Details van de vertraging"\)\}/,
    /title=\{text\("Delay dates", "Datums van de vertraging"\)\}/,
    /title=\{text\("Status on original finish date", "Status op de oorspronkelijke einddatum"\)\}/,
    /title=\{text\("Contractor acknowledgement", "Erkenning door de aannemer"\)\}/,
    /title=\{text\("Completion verification", "Verificatie van de afronding"\)\}/,
  ]) {
    assert.match(workspace, heading);
  }

  // The duration drives the revised date, exactly as the client's arrow on the mockup.
  assert.match(delayReport, /export function delayRevisedFinishDate/);
  assert.match(workspace, /delayRevisedFinishDate\(delayForm\.originalFinishDate, delayForm\.durationDays\)/);

  // Both photo boxes: section 3 always, section 5 the moment the completion box is used.
  assert.match(workspace, /registerNamedPhotos\.delay_status/);
  assert.match(workspace, /required=\{delayCompletionStarted\(delayForm\)\}/);
  assert.match(workspace, /Boolean\(registerNamedPhotos\.delay_status\)/);

  // The fields the client struck off this form stay off it.
  assert.doesNotMatch(delayReport, /delayStartDate/);
  assert.doesNotMatch(workspace, /Proposed finish date \(by contractor\)/i);
  assert.doesNotMatch(workspace, /Likely completion date/i);
});

test("gives every record form the width of the desktop it is opened on", async () => {
  const [workspace, styles] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // .operation-form without .wide is a 720px column. Only a controlled document carried
  // .wide, so PDR, Lessons Learned, Agreements Made and Materials delivery — and the NCR
  // and the inspection beside them — sat in that column with the rest of the window empty.
  assert.match(styles, /\.operation-form \{[^}]*width: min\(100%, 720px\);/);
  assert.match(workspace, /const registerFormClassName = `wide sectioned-record-form\$\{controlledRegister \? " controlled-document-form" : ""\}`/);
  assert.match(workspace, /className=\{registerFormClassName\}/);
  assert.doesNotMatch(workspace, /className=\{controlledRegister \? "wide controlled-document-form" : ""\}/);
  assert.match(workspace, /className="operation-form wide sectioned-record-form snap-assign-form"/);
  assert.match(workspace, /title=\{text\("Start inspection", "Inspectie starten"\)\} status=\{text\("New", "Nieuw"\)\} busy=\{busy\} className="wide sectioned-record-form"/);

  // And the width is used rather than only granted: two columns of sections once the form
  // itself is wide enough, measured on the form and not on the window.
  assert.match(styles, /@container \(min-width: 900px\) \{\n\s+\.agreement-sections,\n\s+\.change-order-sections,\n\s+\.delay-report-sections \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(styles, /\.delay-report-sections\n\) > \*:last-child:nth-child\(odd\) \{ grid-column: 1 \/ -1; \}/);
  // Never the shell's own wrapper: that holds whatever a form passes it — a heading strip,
  // a helper line, a checklist run — and two columns of that is every form torn up.
  assert.doesNotMatch(styles, /@container \(min-width: 900px\) \{\n\s+\.record-form-sections \{/);
  assert.doesNotMatch(styles, /\.record-form-sections\n\) > \*:last-child:nth-child\(odd\)/);
});

test("breaks a record card on its own width, not the window's", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  // A record list gets whatever column the screen leaves it, so a card on a 1280px desktop
  // can be narrower than a phone. The status chip is a column of its own text — "ready for
  // verification" is 157px — and it was taking that out of the title, the description and
  // the record number, which then read a word at a time or not at all.
  assert.match(styles, /\.record-stack \{ container-type: inline-size; \}/);
  assert.match(styles, /@container \(max-width: 620px\) \{[\s\S]*?\.finding-card-main,\n\s+\.record-row \{ grid-template-columns: auto minmax\(0, 1fr\); \}/);
  assert.match(styles, /@container \(max-width: 620px\) \{[\s\S]*?\.record-row > \.task-status \{ grid-column: 2; justify-self: start; \}/);
  assert.match(styles, /@container \(max-width: 620px\) \{[\s\S]*?\.finding-actions \{ justify-content: flex-start; \}/);

  // A container query carries no weight of its own, so it has to stand after the rules it
  // overrides. Both of those are declared above it in the file; if one moves below, the
  // card silently goes back to three columns.
  const container = styles.indexOf("@container (max-width: 620px)");
  assert.ok(container > styles.indexOf("\n.finding-card-main {"), ".finding-card-main is declared before the container query that overrides it");
  assert.ok(container > styles.indexOf("\n.finding-actions {"), ".finding-actions is declared before the container query that overrides it");

  // The window-width copy stays: a row outside a record stack has no container to ask.
  assert.match(styles, /@media \(max-width: 640px\) \{[\s\S]*?\.finding-card-main,\n\s+\.record-row \{\n\s+grid-template-columns: auto minmax\(0, 1fr\);/);
});

test("calls each form what the client's own paper calls it, in one place", async () => {
  const [workspace, home, app] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/project-workspace-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
  ]);

  // The workspace tile and the heading of the form say the same thing, and where the client
  // writes an abbreviation on the sheet it is part of the name — the number reads the same.
  for (const [register, tile] of [
    [/delay_report: "Project Delay Report \(PDR\)"/, /label: text\("Project Delay Report \(PDR\)", "Vertragingsrapport \(PDR\)"\)/],
    [/lessons_learned: "Lessons Learned \(LL\)"/, /label: text\("Lessons Learned \(LL\)", "Geleerde lessen \(LL\)"\)/],
    [/agreement: "Agreements Made"/, /label: text\("Agreements Made", "Gemaakte afspraken"\)/],
    [/delivery: "Materials delivery"/, /label: text\("Materials delivery", "Materiaallevering"\)/],
  ]) {
    assert.match(workspace, register);
    assert.match(home, tile);
  }
  // "Change order · CO" on the tile against "Change order (CO)" in the register was the
  // same form written two ways.
  assert.match(home, /label: text\("Change order \(CO\)", "Change order \(CO\)"\)/);
  // The NCR form heading is the title on the client's own sheet.
  assert.match(workspace, /<h2>\{text\("Non-conformance report", "Non-conformance report"\)\}<\/h2>/);

  // One module, one name. The bottom bar called the findings module Punchlist while the
  // workspace tile called it Issues, and punch_list is a register of its own.
  assert.doesNotMatch(app, /label: "Punchlist"/);
  assert.doesNotMatch(app, /<strong>Punchlist<\/strong>/);
  // The bar no longer repeats the Issues module at all: the workspace tile is its way in.
  assert.doesNotMatch(app, /\{ id: "punchlist", label:/);
  assert.match(app, /punchlist: "Issues",/);
  assert.match(workspace, /punch_list: "Punch list"/);
});

test("keeps a tick box a tick box inside a form field, so its label stays on the screen", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  // Category, type and impact on the delay report are ticked inside a .form-field, and the
  // field's own sizing rule reaches every input below it, so the box was stretched to the
  // full width of the form and pushed its label off the side of the phone.
  assert.match(styles, /^\.form-field input,\n\.form-field select,\n\.form-field textarea \{\n\s+width: 100%;/m);
  assert.match(styles, /\.form-field input\[type="checkbox"\],\n\.form-field input\[type="radio"\] \{[\s\S]*?width: auto;/);

  // The exclusion must not be written as a :not() on the rule itself. That raises it from
  // (0,1,1) to (0,3,1), and more than fifty rules in this stylesheet override .form-field
  // input with a single class — every search field, filter and inline box in the workspace
  // lost its own size and took the field box instead. This is that mistake, held down.
  assert.doesNotMatch(styles, /\.form-field input:not\(/);
  assert.doesNotMatch(styles, /\.form-field input:where\(/);
  assert.doesNotMatch(styles, /\.form-field input:is\(/);

  // And the tick has a size of its own, so it is the same on every form that ticks. It is
  // declared after the reset above, which is the only reason 17px survives `width: auto`.
  assert.match(styles, /\.record-action-check input\[type="checkbox"\] \{[^}]*width: 17px;/);
  assert.match(styles, /\.record-action-check \{[^}]*overflow-wrap: anywhere;/);
  assert.ok(
    styles.indexOf('.form-field input[type="checkbox"]') < styles.indexOf('.record-action-check input[type="checkbox"]'),
    "the field reset is declared before the tick grid sizes its own box",
  );
});

test("lets a supervisor switch project from anywhere without carrying data across", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const normalizedApp = app.replace(/\r\n/g, "\n");

  // The switcher itself, and the three places it can be reached from: the sidebar card on
  // a desktop, the project name in the header on a phone, and the "more" drawer.
  assert.match(normalizedApp, /function ProjectSwitcherModal/);
  assert.match(normalizedApp, /modal === "switch_project" \? \(/);
  assert.match(normalizedApp, /className="project-context-card"[\s\S]{0,240}setModal\("switch_project"\)/);
  assert.match(normalizedApp, /className="breadcrumb-step breadcrumb-project"[\s\S]{0,320}setModal\("switch_project"\)/);
  assert.match(normalizedApp, /className="mobile-module-switch"[\s\S]{0,200}setModal\("switch_project"\)/);
  assert.match(normalizedApp, /Switch project", "Van project wisselen/);

  // The header on a phone hides the sidebar, so the project step has to stay visible there
  // while the building step is the one that folds away.
  const normalizedCss = css.replace(/\r\n/g, "\n");
  assert.match(normalizedCss, /\.breadcrumb-building,\n\s+\.storage-state span/);
  assert.doesNotMatch(normalizedCss, /\.breadcrumb-project,\n\s+\.storage-state span/);

  // Nothing of one project may survive into the next: the day mirrored on the screen, the
  // record being written and the photos still on the device are all dropped, and every
  // module below is remounted on the project it belongs to.
  assert.match(normalizedApp, /const resetProjectScopedState = useCallback\(/);
  for (const cleared of [
    /setEntries\(\[\]\)/,
    /setAttendance\(\[\]\)/,
    /setProjectStartAnswers\(null\)/,
    /setDailyCloseoutAnswers\(null\)/,
    /setSelectedAction\(null\)/,
    /setPendingQuickPhotos\(\[\]\)/,
    /setFocusRecordId\(""\)/,
  ]) {
    assert.match(normalizedApp, cleared);
  }
  assert.match(normalizedApp, /if \(project\.id !== selectedProject\?\.id\) resetProjectScopedState\(\);/);
  assert.match(normalizedApp, /hydratedProjectRef\.current = projectId;\n\s+resetProjectScopedState\(\);/);
  assert.match(normalizedApp, /<main id="main-content" tabIndex=\{-1\} className=\{`main-content\$\{unsavedPhotos \? " has-resume-bar" : ""\}`\} key=\{selectedProject\?\.id \?\? "no-project"\}>/);
});

test("never names the database vendor in anything a user can see", async () => {
  const uiSources = await Promise.all([
    "../app/codeco-supervision-app.tsx",
    "../app/operational-workspace.tsx",
    "../app/project-workspace-home.tsx",
    "../app/offline-manager.tsx",
    "../app/client-dashboard.tsx",
    "../lib/reports/daily-report-pdf.tsx",
    "../lib/reports/daily-report-docx.ts",
    "../lib/storage/server.ts",
  ].map(async (path) => [path, await readFile(new URL(path, import.meta.url), "utf8")]));

  // The vendor may only survive as code: a type, the package, the client helpers and the
  // server-side environment variables. Every other occurrence would be readable text.
  const codeOnly = [
    /SupabaseClient/g,
    /@supabase\/supabase-js/g,
    /getSupabaseBrowserClient/g,
    /isSupabaseConfigured/g,
    /supabaseConfiguration/g,
    /STORAGE_SUPABASE_CONFIGURATION_MISSING/g,
    /NEXT_PUBLIC_SUPABASE_[A-Z_]+/g,
    /SUPABASE_SECRET_KEY/g,
    /@\/lib\/supabase\/[a-z-]+/g,
    /supabase\.[a-zA-Z]/g,
    /\bsupabase\b/g,
  ];
  for (const [path, source] of uiSources) {
    const stripped = codeOnly.reduce((text, pattern) => text.replaceAll(pattern, ""), source);
    assert.doesNotMatch(stripped, /supabase/i, `${path} still names the database vendor in readable text`);
  }
});

test("closes the gaps that an odd tile count and a long file name tear in the mobile grids", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  // A three-item strip in two columns used to leave the last tile beside a hole. Every
  // strip that folds hands the orphan the whole row instead, scoped to the width at which
  // that grid is actually two columns wide. The behaviour itself is measured in the
  // browser by tests/e2e/layout-hygiene.spec.ts; this only holds the roster in place.
  const orphanSection = css.slice(css.indexOf("Odd tile in an even grid"));
  assert.ok(orphanSection, "the odd-tile section must stay findable by its heading");
  for (const strip of [
    "action-center-summary",
    "action-center-views",
    "action-record-shortcuts",
    "client-workspace-grid",
    "daily-work-tabs",
    "overview-evidence-grid",
    "overview-metrics",
    "project-document-filters",
    "project-document-tabs",
    "quick-grid",
    "record-tile-grid",
    "register-summary-grid",
    "workspace-launcher-grid",
  ]) {
    assert.match(orphanSection, new RegExp(`\\.${strip}\\b`), `${strip} is missing from the odd-tile roster`);
  }
  assert.match(orphanSection, /> \*:last-child:nth-child\(odd\) \{ grid-column: 1 \/ -1; \}/);

  // Grids that already manage their own parity with a full-row child must stay out of it,
  // or that rule would stretch a tile the layout deliberately keeps at half a row.
  for (const excluded of [
    "workspace-support-strip",
    "workspace-module-groups",
    "overview-secondary-grid",
    "document-link-panel",
    "period-report-types",
    "form-grid",
  ]) {
    assert.doesNotMatch(orphanSection.split("*/")[1] ?? "", new RegExp(`\\.${excluded}\\b`), `${excluded} must not be swept into the odd-tile rule`);
  }

  // Search, alerts and day questions share one row; the dead track at the right is gone.
  assert.match(css, /\.overview-hero-actions \{ display: grid; grid-template-columns: minmax\(0, 1fr\) 40px 40px; \}/);
  assert.doesNotMatch(css, /\.overview-search \{ grid-column: 1 \/ -1; \}/);

  // A camera file name is one unbreakable word, so the caption needs to be allowed to
  // shrink before the shortening rule above it can do anything.
  assert.match(css, /\.overview-evidence-grid > button > span \{ min-width: 0; \}/);
  assert.match(css, /\.daily-work-tabs button span \{ display: grid; gap: 1px; min-width: 0; \}/);
  assert.match(css, /\.daily-work-tabs button > svg \{ flex-shrink: 0; margin-top: 1px; \}/);

  // A grid needs more than min-width to let go: its implicit column is sized to the widest
  // line in it, which is how one long project name widened the whole switcher dialog.
  assert.match(css, /\.project-switcher-copy \{[^}]*grid-template-columns: minmax\(0, 1fr\);/s);
  // A flex row never draws an ellipsis, so the location line is a block that can.
  assert.match(css, /\.project-switcher-copy small \{[^}]*text-overflow: ellipsis;/s);
});

test("the overview reads the day instead of writing it", async () => {
  const [dashboard, app, mediaLibrary, css] = await Promise.all([
    readFile(new URL("../app/client-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // Nothing on the overview may hand the user to the camera or to a blank record. The
  // photo button in the bottom bar is on every screen already, which is what made a
  // second route to it from a dashboard tile read as a mistake.
  assert.doesNotMatch(dashboard, /openQuickAdd/);
  assert.doesNotMatch(dashboard, /openCamera|captureInputRef|capture="environment"/);
  // The dashboard is mounted without that route at all, so it cannot grow one by accident.
  const mountStart = app.indexOf("<ClientDashboard");
  assert.ok(mountStart > 0, "the overview must still be mounted from the app shell");
  const dashboardMount = app.slice(mountStart, app.indexOf("/>", mountStart));
  assert.match(dashboardMount, /openActions=/, "the mount slice must cover the props");
  assert.doesNotMatch(dashboardMount, /openQuickAdd/);
  // Every remaining route out of it leads to something that already exists.
  for (const viewRoute of [
    /onClick=\{openWorkspace\}/,
    /onClick=\{openActions\}/,
    /Open workspace", "Open werkruimte/,
    /View all", "Alles bekijken/,
  ]) {
    assert.match(dashboard, viewRoute);
  }

  // The photo filters are a list, not seven chips wrapping over two ragged rows.
  assert.match(mediaLibrary, /<label className="form-field media-origin-field" htmlFor="media-origin-filter">/);
  assert.match(mediaLibrary, /originFilters\.map\(\(filter\) => \(\s*<option/s);
  assert.doesNotMatch(mediaLibrary, /media-origin-bar/);
  assert.doesNotMatch(css, /\.media-origin-bar/);
  // It stands beside the building, and neither of the two is squeezed to a stub.
  assert.match(css, /\.media-origin-field \{ flex: 1 1 200px; min-width: 0; \}/);
});

test("the overview searches the whole project, not only the day on the screen", async () => {
  const [dashboard, app, workspace, css] = await Promise.all([
    readFile(new URL("../app/client-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // The client asked to find "files, documents and photos and more" from here, so every
  // register the project keeps is reachable from the one search box.
  for (const searchable of [
    /add\("photos", text\("Photos", "Foto's"\)/,
    /add\("drawings", text\("Drawings", "Tekeningen"\)/,
    /add\("documents", text\("Documents", "Documenten"\)/,
    /add\("findings", text\("Issues and NCRs"/,
    /add\("inspections", text\("Inspections", "Inspecties"\)/,
    /add\("hse", "HSE"/,
    /add\("registers", text\("Registers", "Registers"\)/,
    /add\("actions", text\("Actions", "Acties"\)/,
    /add\("work", text\("Recorded work"/,
  ]) {
    assert.match(dashboard, searchable);
  }

  // It reads the snapshot the workspace already loads, under that exact key, so a search
  // costs nothing once the workspace has been open and opening a result is instant.
  assert.match(dashboard, /queryKey: \["project-operations", projectId, reportId\]/);
  assert.match(workspace, /queryKey: \["project-operations", projectId, reportId\]/);
  // And it stays off until something has actually been typed, so the overview loads as
  // lightly as it did before the search existed.
  assert.match(dashboard, /enabled: searching && Boolean\(client\)/);
  assert.match(dashboard, /const searching = term\.length >= minimumSearchLength/);

  // A result opens the module it lives in, on that record — the route the action centre
  // already uses — instead of dropping the user at the top of a list.
  assert.match(app, /openRecord=\{\(tab, recordId\) => \{\s*openWorkspaceModule\(tab\);\s*setFocusRecordId\(recordId\);/s);
  assert.match(dashboard, /openRecord\("files", file\.id\)/);
  assert.match(dashboard, /openRecord\(finding\.finding_type === "ncr" \? "ncr" : "findings", finding\.id\)/);

  // A file name is one unbreakable word, so both lines of a result must be free to shrink.
  assert.match(css, /\.overview-search-list > button > span \{ display: grid; gap: 2px; min-width: 0; \}/);
});

test("gives the backup screen enough to actually manage continuity with", async () => {
  const [center, operations, workspace, css] = await Promise.all([
    readFile(new URL("../app/backup-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // The three columns the old screen never read, on a table that already held them.
  assert.match(operations, /select\("id,project_id,run_type,status,schema_version,size_bytes,sha256,verified_at,created_at,retention_tier,record_counts,error_summary"\)/);
  // A database without the retention migration must still show its history.
  assert.match(operations, /schemaFeatureMissing\(backupResult\.error, \["retention_tier", "record_counts", "error_summary"\]\)/);

  // What the screen can now do, none of which it could before.
  for (const capability of [
    /ensureDailyBackup\(client, organizationId\)/,          // run the job by hand
    /scope === "project" \? projectId : null/,               // one project or the whole organization
    /function RecordCounts/,                                  // what is inside a backup
    /setLastDryRun\(result\)/,                                // a restore test that reports back
    /backupStaleAfterHours/,                                  // an old backup is called out
    /restoreTestStaleAfterDays/,                              // so is an untested one
    /heldCopies/,                                             // the retention promise is checkable
    /historyFilter/,                                          // history is filterable
    /openRunId/,                                              // and each run opens
  ]) {
    assert.match(center, capability);
  }

  assert.match(workspace, /<BackupCenter/);
  assert.match(css, /\.backup-health-card/);
  // The manual export may now be organization-wide, so its type has to allow no project.
  assert.match(operations, /export async function downloadManualBackup\(client: SupabaseClient, organizationId: string, projectId: string \| null\)/);
});

test("names the jobs the application will not do, with the prompt and what to attach", async () => {
  const [library, workspace] = await Promise.all([
    readFile(new URL("../app/prompt-library.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
  ]);

  // The client asked for this list by naming one of them: a compact monthly report.
  const normalizedLibrary = library.replace(/\r\n/g, "\n");
  assert.match(normalizedLibrary, /id: "compact-monthly"/);
  assert.match(normalizedLibrary, /Een compact maandrapport uit de volle maand/);

  // Every prompt has to say why the application leaves the job alone and which export to
  // attach; a prompt without either is a sentence the reader cannot act on.
  const entries = normalizedLibrary.split(/\n    \{\n      id: "/).slice(1);
  assert.ok(entries.length >= 10, `expected a real library, found ${entries.length} prompts`);
  for (const entry of entries) {
    const id = entry.slice(0, entry.indexOf('"'));
    assert.match(entry, /category: "(report|analysis|compare|capture)"/, `${id} has no category`);
    assert.match(entry, /\n      why: /, `${id} does not say why the app leaves it alone`);
    assert.match(entry, /\n      attach: /, `${id} does not say what to attach`);
    assert.match(entry, /\n      sources: \[/, `${id} names no source to fetch the attachment from`);
    assert.match(entry, /\n      prompt: /, `${id} has no prompt`);
  }

  // Naming the export in prose left the reader hunting for the screen it lives on, so
  // every source is routed. Two of them are deliberately not: a schedule and a meeting
  // transcript do not come from this application, and a button there would go nowhere.
  const declared = [...normalizedLibrary.matchAll(/^  \| "([a-z-]+)"$/gm)].map((match) => match[1]);
  assert.ok(declared.length >= 12, `expected the source list, found ${declared.length}`);
  for (const source of declared) {
    assert.match(normalizedLibrary, new RegExp(`"?${source}"?: \\{ label:`), `${source} has no route`);
  }
  for (const own of ["own-schedule", "own-transcript"]) {
    assert.match(normalizedLibrary, new RegExp(`"${own}": \\{ label: text\\([^}]*\\) \\}`), `${own} must stay a label without a button`);
  }
  assert.match(workspace, /openModule=\{openProjectArea\}/);
  assert.match(workspace, /openDeadlines=\{\(\) => openActionCenter\("deadlines"\)\}/);

  // It is a view of its own, not ten prompts behind a summary nobody opened.
  assert.match(workspace, /reportView === "prompts" \? \(\s*<PromptLibrary/s);
  assert.doesNotMatch(workspace, /report-prompt-library/);
  assert.match(workspace, /className="report-prompt-link"/);
  // And it never ships project data anywhere by itself.
  assert.doesNotMatch(library, /fetch\(|supabase|\.rpc\(/);
});

test("works ongoing and works completed stop opening the same form", async () => {
  const [modal, css] = await Promise.all([
    readFile(new URL("../app/daily-log-modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // They are two fields of one day closeout, so one form is right; one *identical* form
  // was not. Each focus now names its own heading instead of the shared one.
  assert.match(modal, /ongoingOnly\s*\n?\s*\? text\("What is running right now", "Wat er op dit moment loopt"\)/);
  assert.match(modal, /\? text\("What was finished today", "Wat vandaag is afgerond"\)/);

  // The field that was not asked for folds away rather than being dimmed beside the one
  // that was: 62% opacity on a phone in daylight is no difference at all.
  assert.doesNotMatch(css, /focus-completed \.daily-log-field-ongoing \{ opacity/);
  assert.match(modal, /className="daily-log-secondary"/);
  assert.match(modal, /Also finished something today\?", "Vandaag ook iets afgerond\?/);
  assert.match(modal, /Also work still running\?", "Ook werk dat nog loopt\?/);
  assert.match(css, /\.daily-log-secondary \{/);

  // The activity shortcuts write into the works-ongoing field, so they must not sit on
  // the completed form where they would fill a field the user cannot see.
  assert.match(modal, /\{completedOnly \? null : <div className="quick-issue-presets"/);
});

test("the overview's photo panel opens the photo library, not the workspace home", async () => {
  const [dashboard, library] = await Promise.all([
    readFile(new URL("../app/client-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
  ]);

  // Pressing a picture used to land on the workspace home screen, which the reader then
  // had to navigate out of again to reach the photos they had just pointed at.
  assert.match(dashboard, /onClick=\{\(\) => openRecord\("files", photo\.fileId\)\}/);
  // The header, the empty slots, the picture tile and a photo line in recent activity all
  // lead to the same library; only the thumbnail knows which picture to open on.
  assert.equal((dashboard.match(/openRecord\("files", ""\)/g) ?? []).length, 4);

  // The panel that holds the pictures must not route to the workspace at all any more.
  const panel = dashboard.slice(dashboard.indexOf("overview-evidence-panel"), dashboard.indexOf("overview-site-panel"));
  assert.doesNotMatch(panel, /openWorkspace/);

  // And the library really does resolve a file id, otherwise the focus would be dropped.
  assert.match(library, /const file = data\.files\.find\(\(item\) => item\.id === fileId\)/);
  assert.match(library, /setOpenFileId\(file\.id\)/);
});

test("retains historical client form-feedback fixes without losing underlying workflows", async () => {
  const [workspace, home, css] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/project-workspace-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // Client struck the duplicate Delays shortcut; the actual daily-delay and PDR flows remain.
  assert.doesNotMatch(home, /id: "delays",/);
  assert.match(home, /id: "delay-report",/);
  assert.match(home, /openDailyWork\("works_ongoing"\)/);
  assert.match(home, /"works_ongoing" \| "works_completed" \| "delays"/);

  // The controlled document starts with title and description, not duplicate read-only dates.
  assert.match(workspace, /className="form-grid controlled-document-primary"/);
  assert.match(workspace, /className="form-field controlled-document-deadline"/);
  assert.doesNotMatch(workspace, /className="controlled-document-dates"/);
  assert.match(css, /\.controlled-document-primary\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);

  // Record type switching is still available for external submissions and general registers.
  // The client crossed out the format switch on the materials delivery; only a submitted form keeps it.
  assert.match(workspace, /\{submittedRegister \? <details className="optional-text-entry register-type-switch"/);
  assert.doesNotMatch(workspace, /!controlledRegister \|\| submittedRegister/);
  // Existing records retain revision editing; new records start with the canonical default.
  assert.match(workspace, /editingRegisterId \? <label className="form-field"><span>\{text\("Revision"/);
  // The original author remains changeable in the existing header, not duplicated below.
  assert.match(workspace, /className="controlled-document-author-edit"/);
  // Impact metadata remains available, but is not forced into every technical instruction.
  assert.match(workspace, /className="controlled-document-optional-impact"/);
});

test("QA M6/L3/L4: save buttons say what they wait for; pin removal is confirmed inline", async () => {
  const [workspace, drawings] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/drawing-workspace.tsx", import.meta.url), "utf8"),
  ]);
  assert.equal((workspace.match(/<StillNeeded items=/g) ?? []).length, 3);
  assert.doesNotMatch(workspace, /Nog niemand van dit project staat in de app/);
  assert.doesNotMatch(drawings, /window\.confirm/);
  assert.match(drawings, /role="alertdialog"/);
  assert.match(drawings, /\{activeDrawing \? <div className="operation-alert"><ShieldCheck/);
});

test("QA L18: a refused work-day start says why next to the button and scrolls to the reason", async () => {
  const app = await readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8");
  assert.match(app, /handleSubmit\(save, \(\) => \{/);
  assert.match(app, /Nog niet compleet/);
});

test("QA L23/L8: tile and tab counts follow the other filter; the building code input is labelled", async () => {
  const actionCenter = await readFile(new URL("../app/project-action-center.tsx", import.meta.url), "utf8");
  // A tile counts within the chosen type, a tab within the chosen state, so the number
  // on a button is the number of rows it leaves in the list.
  assert.match(actionCenter, /const typeScopedItems = scopedItems\.filter/);
  assert.match(actionCenter, /const stateScopedItems = scopedItems\.filter/);
  assert.match(actionCenter, /typeScopedItems\.filter\(isOpen\)\.length/);
  assert.match(actionCenter, /stateScopedItems\.filter\(\(item\) => item\.type === tab\.id\)\.length/);
  const app = await readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8");
  assert.match(app, /<label className="form-field"><span>\{text\("Building code \*", "Gebouwcode \*"\)\}<\/span><input value=\{code\}/);
});

test("QA L19: the local auth stack slows down repeated sign-in attempts", async () => {
  const config = await readFile(new URL("../../../supabase/config.toml", import.meta.url), "utf8");
  const limit = Number(/^sign_in_sign_ups\s*=\s*(\d+)/m.exec(config)?.[1]);
  assert.ok(limit > 0 && limit <= 30, "sign-in attempts per five minutes must be limited");
});

test("QA L24: the root layout does not preload fonts the first screen does not use", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /Geist_Mono\(\{[^}]*preload: false/s);
  assert.doesNotMatch(layout, /weight: \["400", "500"/);
});

test("QA L28: every pgTAP file that creates an organization starts from an empty tenant table", async () => {
  const { readdir } = await import("node:fs/promises");
  const directory = new URL("../../../supabase/tests/", import.meta.url);
  const files = (await readdir(directory)).filter((name) => name.endsWith(".pgtap.sql"));
  assert.ok(files.length >= 20);
  for (const name of files) {
    const sql = await readFile(new URL(name, directory), "utf8");
    if (!/bootstrap_organization|insert into public\.organizations/.test(sql)) continue;
    assert.match(sql, /truncate public\.organizations, auth\.users cascade;/, `${name} must not depend on an empty database`);
  }
});

test("QA L24: a failed daily backup check waits ten minutes before it is tried again", async () => {
  const app = await readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8");
  assert.match(app, /dailyBackupFailedAtRef\.current = Date\.now\(\)/);
  assert.match(app, /Date\.now\(\) - dailyBackupFailedAtRef\.current < 10 \* 60 \* 1000/);
});

test("QA L9/L26: the technical instruction answers follow the language; the policy is written down", async () => {
  const workspace = await readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /<option value="none">\{text\("None", "Geen"\)\}<\/option>/);
  assert.match(workspace, /<option value="confirmed">\{text\("Confirmed", "Bevestigd"\)\}<\/option>/);
  assert.match(workspace, /<option value="structural">\{text\("Structural", "Constructief"\)\}<\/option>/);
  assert.doesNotMatch(workspace, /<option value="possible">Possible<\/option>/);
  const policy = await readFile(new URL("../../../docs/product/taalbeleid.md", import.meta.url), "utf8");
  assert.match(policy, /Workforce, Issues, Punchlist, Project Docs/);
});
