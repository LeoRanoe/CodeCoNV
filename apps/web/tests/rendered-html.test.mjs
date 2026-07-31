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
  assert.equal(manifest.start_url, "/supervisie");
  assert.equal(manifest.icons[0].src, "/codeco-logo.png");
});

test("explains an invalid external-party link without exposing a token error", async () => {
  const response = await fetch(`${baseUrl}/share/not-a-valid-token`);
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /Deze gedeelde link is niet meer beschikbaar/i);
  assert.match(html, /geen account nodig/i);
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
  assert.match(app, /Actual weather · automatic|Werkelijk weer · automatisch/);
  assert.match(app, /Triggered by|Geactiveerd door/);
  assert.match(app, /Dagvragen bevestigen/);
  assert.match(app, /useForm<DailyCloseoutAnswers>/);
  assert.match(app, /zodResolver\(localizedDailyCloseoutSchema\)/);
  assert.match(app, /setEntries/);
  assert.match(app, /signInWithPassword/);
  assert.doesNotMatch(app, /\.auth\.signUp\(/);
  assert.doesNotMatch(app, />Account maken</);
  assert.match(app, /Alleen projectgebruikers die door een organisatiebeheerder zijn uitgenodigd/);
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
  assert.match(app, /vaste projectregel|fixed project rule/i);
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

  assert.match(workspace, /Standard photo/);
  assert.match(workspace, /360° camera image/);
  assert.match(workspace, /Insta360 or equivalent/);
  assert.match(workspace, /3840 × 1920/);
  assert.match(workspace, /cameraSourceConfirmed/);
  assert.doesNotMatch(workspace, /Experimental 360°/);
  assert.match(workspace, /new core\.Viewer/);
  assert.match(workspace, /ReadyEvent/);
  assert.match(workspace, /PanoramaErrorEvent/);
  assert.match(workspace, /xRatio/);
  assert.match(workspace, /yaw/);
  assert.match(workspace, /createVisualAnnotationFinding/);
  assert.match(app, /type === "photo"/);
  assert.match(app, /setInitialProjectTab\("visual"\)/);
  assert.match(operations, /create_visual_annotation_finding/);
  assert.match(migration, /create table public\.visual_captures/);
  assert.match(migration, /create table public\.visual_annotations/);
  assert.match(migration, /'annotation'/);
  assert.match(drawingWorkspace, /Drawings workspace/);
  assert.match(drawingWorkspace, /Link an RFI/);
  assert.match(drawingWorkspace, /Link a photo \/ 360° camera image/);
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
  assert.match(app, /project\.technicalInstructionCount/);
  assert.match(app, /project\.changeOrderCount/);
  assert.match(app, /Timmerlieden/);
  assert.match(app, /Beton en wapening/);
  assert.match(app, /Werk lopend aan het einde van de dag/);
  assert.match(app, /Werk vandaag afgerond/);
  assert.match(dataLayer, /work_ongoing/);
  assert.match(operationalWorkspace, /Upload contract, technische specificatie of bijlage/);
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
  assert.match(documentPdf, /CONTRACTOR ACKNOWLEDGEMENT/);
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

  assert.match(backupServer, /access: "private"/);
  assert.match(backupServer, /BACKUP_BLOB_READ_WRITE_TOKEN[\s\S]{0,160}BLOB_READ_WRITE_TOKEN/);
  assert.match(backupServer, /await get\(pathname/);
  assert.match(backupServer, /BACKUP_BLOB_CHECKSUM_MISMATCH/);
  assert.match(backupServer, /sorted\.slice\(0, 7\)/);
  assert.match(backupServer, /weeks\.size >= 4/);
  assert.match(backupServer, /months\.size >= 3/);
  assert.match(cronRoute, /timingSafeEqual/);
  assert.match(cronRoute, /runScheduledOrganizationBackup/);
  assert.match(cronRoute, /refresh_all_project_notifications/);
  assert.match(cronRoute, /sendPendingNotificationEmails/);
  assert.match(cronRoute, /record_scheduled_backup_failure/);
  assert.match(watchdogRoute, /authenticateStorageRequest/);
  assert.match(watchdogRoute, /permission_code", "backup\.manage"/);
  assert.match(watchdogRoute, /runScheduledOrganizationBackup/);
  assert.match(storageServer, /BACKUP_BLOB_READ_WRITE_TOKEN[\s\S]{0,160}BLOB_READ_WRITE_TOKEN/);
  assert.match(backupClient, /api\/backups\/ensure-daily/);
  assert.match(app, /dailyBackupCheckRef/);
  assert.match(app, /ensureDailyBackup/);
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
  assert.match(app, /DailyLogModal/);
  assert.match(dailyLog, /Construction activity & location|Bouwactiviteit & locatie/);
  assert.match(dailyLog, /QC performed & advice|QC uitgevoerd & advies/);
  assert.match(dailyLog, /Health & safety issues|Gezondheid & veiligheid/);
  assert.match(dailyLog, /General advice to the contractor|Algemeen advies aan de aannemer/);
  assert.match(dailyLog, /daily-log-counter/);
  assert.match(dailyLog, /DictateButton/);
  assert.match(operations, /Issue management|Issuebeheer/);
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
  assert.match(app, /Photo ready[\s\S]*click the image to place a finding/);
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
  assert.doesNotMatch(`${app}\n${operations}\n${shareActions}`, /\bSMS\b/i);
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
  assert.match(app, /Choose a daily summary|Kies een dagsamenvatting/);
  assert.match(operations, /Choose a standard HSE record|Kies een standaard HSE-registratie/);
  assert.match(operations, /Choose a standard register item|Kies een standaard registeritem/);
  assert.match(operations, /Choose the completed measure|Kies de uitgevoerde maatregel/);
  assert.match(visuals, /Choose a common issue|Kies een veelvoorkomend probleem/);
  assert.match(media, /Choose a photo folder|Kies een fotomap/);
});

test("keeps the project workspace mobile-first and task driven", async () => {
  const [app, operations, workspaceHome, styles] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/project-workspace-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /useState<"home"[\s\S]*>\("home"\)/);
  assert.match(app, /openQuickCamera=\{openQuickAdd\}/);
  assert.match(operations, /mobile-workspace-section-select/);
  assert.match(operations, /projectSectionGroups/);
  assert.match(operations, /workspace-current-module/);
  // The workspace start screen is the client's fifteen-tile launcher, not a hidden legacy hub.
  assert.match(operations, /<ProjectWorkspaceHome/);
  assert.doesNotMatch(operations, /workspace-task-hub/);
  assert.match(workspaceHome, /workspace-launcher-grid/);
  assert.match(workspaceHome, /openQuickCamera/);
  assert.match(workspaceHome, /works_ongoing/);
  assert.match(workspaceHome, /works_completed/);
  assert.match(workspaceHome, /openFinding\("issue"\)/);
  assert.match(workspaceHome, /openFinding\("ncr"\)/);
  assert.match(workspaceHome, /openRegister\("technical_instruction"\)/);
  assert.match(workspaceHome, /openRegister\("change_order"\)/);
  assert.match(workspaceHome, /agreements-made/);
  assert.doesNotMatch(workspaceHome, /openRegister\("(wcr|rfi|rfa|inspection_request)"\)/);
  assert.match(workspaceHome, /openTask\("documents"\)/);
  assert.match(styles, /\.workspace-task-hub/);
  assert.match(styles, /\.workspace-desktop-tabs\s*\{\s*display: none/);
  assert.match(styles, /\.overview-shortcut\.mobile-redundant\s*\{\s*display: none/);
  assert.match(app, /Project, building, time and folder automatic/);
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
  assert.match(operations, /Tap again for another photo|Tik opnieuw voor nog een foto/);
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
  assert.match(styles, /@media \(max-width: 860px\)[\s\S]*\.field-guide-trigger[\s\S]*bottom: calc\(84px \+ env\(safe-area-inset-bottom\)\)/);
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
  assert.match(dailyPdf, /snapshot\.buildings/);
  assert.match(periodPdf, /buildingById/);
});

test("keeps employee assignment, editable external rights and openable document history enforceable", async () => {
  const [app, operations, documents, media, data, storage, pushClient, roleRoute, migration] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/project-documents-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/media-library-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/storage/gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/notifications/push-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/project-role/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/202607300002_company_employee_task_assignment.sql", import.meta.url), "utf8"),
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
  assert.match(visual, /BuildingPicker id="marker-building"/);
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
