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
  // Item 19 has its own signature block now, so 17–18 are the photos and attachments.
  assert.match(pdfReport, /17–18\. Foto's en bijlagen/);
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

  assert.match(app, /useState<ProjectTabKey>\("home"\)/);
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
  assert.match(app, /selection-copy[\s\S]{0,180}selection-icon/);

  // Screen 2: a smaller project header, and photos are called photos.
  assert.match(styles, /\.overview-hero h1 \{[\s\S]*?font-size: clamp\(1\.15rem/);
  assert.match(dashboard, /label=\{text\("Pictures", "Foto's"\)\}/);
  assert.doesNotMatch(dashboard, /text\("Evidence", "Bewijs"\)/);

  // Screens 3 and 6: Dutch is the default again, a proposed description disappears on
  // the first keystroke, a record can cover several buildings, work packages are the
  // ones from the client's daily report, drawings are selectable as the exact location,
  // and the camera opens inside the record instead of on another page.
  // Only a language picked in the switcher counts; devices that never chose open in Dutch.
  assert.match(i18n, /const chosenLanguageKey = "codeco-language-choice"/);
  assert.match(i18n, /chosen === "en" \|\| chosen === "nl" \? chosen : "nl"/);
  assert.match(app, /descriptionSuggested/);
  assert.match(app, /if \(descriptionSuggested\) event\.currentTarget\.select\(\)/);
  assert.match(app, /field-clear-button/);
  assert.match(app, /BuildingMultiPicker/);
  assert.match(picker, /export function BuildingMultiPicker/);
  assert.match(app, /workPackageOptions/);
  assert.match(app, /Piling and foundations/);
  assert.match(app, /Location on drawing|Locatie op tekening/);
  assert.match(app, /project-drawings/);
  assert.match(app, /ref=\{cameraInputRef\}[^>]*capture="environment"/);
  // A photo in a record still shows up under it, now through the shared photo block that
  // also carries the photo's own words.
  assert.match(app, /<PhotoEvidenceList/);
  assert.doesNotMatch(app, /openPhoto=\{\(\) => chooseType\("photo"\)\}/);
  assert.match(app, /recordType: "registration"/);
  assert.match(queue, /"inspection" \| "hse" \| "registration"/);
  assert.match(queue, /ensureVisualCapture/);

  // Screen 5: photos of the day can be named and removed, and the workforce block has
  // the standard sentences about manning levels.
  assert.match(dailyLog, /export type DailyLogPhoto/);
  assert.match(dailyLog, /<PhotoEvidenceList/);
  assert.match(evidence, /What is on this photo\?|Wat staat er op deze foto\?/);
  assert.match(evidence, /photo-evidence-remove/);
  assert.match(dailyLog, /workforceNoteChoices/);
  assert.match(dailyLog, /Too few workers|Onvoldoende arbeiders/);
  assert.match(app, /photo\.details\.title\.trim\(\)\.slice\(0, 120\)/);
});

test("processes the second batch of annotated screens from 31 July", async () => {
  const [app, dailyLog, workspace, evidence, picker, locationPicker, operations, queue, controlledDocuments, styles] = await Promise.all([
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
  assert.match(dailyLog, /addWorkforceRow/);
  assert.match(dailyLog, /Add person|Persoon toevoegen/);
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
  assert.match(evidence, /Description · what is visible|Toelichting · wat is te zien/);
  assert.match(styles, /\.photo-evidence-row/);
  assert.match(styles, /\.photo-detail-modal/);

  // A started checklist can be reopened from the list and completed.
  assert.match(operations, /export async function loadInspectionResponses/);
  assert.match(workspace, /const resumeInspection = async/);
  assert.match(workspace, /Fill in checklist|Checklist invullen/);
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
  assert.match(workspace, /Building · or project-wide|Gebouw · of projectbreed/);
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
  assert.match(serviceWorker, /const CACHE = "codeco-field-shell-v2"/);
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

  // The issue form uses the columns of the client's own Issue Management Template
  // (Issues_Tracking_Log), with their names, not a summary of another worksheet.
  assert.match(workspace, /text\("Issue description", "Issue Description"\)/);
  assert.match(workspace, /text\("Date identified", "Date Identified"\)/);
  assert.match(workspace, /text\("Expected resolution date", "Expected Resolution Date"\)/);
  assert.match(workspace, /text\("Assigned to owner", "Assigned To Owner"\)/);
  assert.match(workspace, /Escalation Required \(Y\/N\)/);
  assert.match(workspace, /Final Resolution & Rationale/);
  assert.match(workspace, /<option value="informational">Informational<\/option>/);
  assert.match(operations, /date_identified: input\.dateIdentified/);
  assert.doesNotMatch(workspace, /Initial completion date|Eerste opleverdatum/);

  // A register item can be about general material, and a delivery is judged and counted.
  assert.match(workspace, /Building · or general material|Gebouw · of algemeen materiaal/);
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
  assert.match(workspace, /text\("To:", "Aan:"\)/);
  assert.match(controlledDocuments, /reason: draft\.reason\.trim\(\) \|\| draft\.details\.trim\(\)/);
  assert.match(controlledDocuments, /required_action: draft\.requiredAction \|\| "proceed"/);
  assert.match(controlledDocuments, /signedBy: string/);
  assert.match(workspace, /controlled-document-signature/);
  assert.match(styles, /\.check-field\.controlled-document-signature/);
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

  // Dictation replaces the proposed text once and then keeps adding to what was said.
  // The decision is read from a ref because speech callbacks keep an older closure.
  assert.match(app, /const dictateDescription = \(transcript: string\) => \{/);
  assert.match(app, /descriptionSuggestedRef/);
  assert.match(app, /setDescription\(\(current\) => appendDictation\(replacing \? "" : current, transcript\)\)/);
  assert.match(app, /<DictateButton onText=\{dictateDescription\} \/>/);

  // Clear sits in the label row, so it no longer stretches across the field and collides
  // with the dictate button anchored to the bottom of that field.
  assert.match(app, /field-label-row/);
  assert.match(styles, /\.field-label-row \{[\s\S]*?display: flex/);
  assert.match(styles, /\.field-clear-button \{[\s\S]*?justify-self: start/);

  // Opening a drawing parks the record and offers the way back.
  assert.match(app, /entryDraftParked/);
  assert.match(app, /Back to the record|Terug naar de registratie/);
  assert.match(styles, /\.entry-resume-bar/);

  // A device that never picked a language opens in Dutch, also after using the app before.
  assert.match(i18n, /codeco-language-choice/);

  // Sketching by hand, saved as a photo along the existing evidence road.
  assert.match(sketch, /export function SketchPad/);
  assert.match(sketch, /image\/png/);
  assert.match(app, /Make a sketch|Schets maken/);
  assert.match(workspace, /Make a sketch|Schets maken/);
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
  assert.match(workspace, /const openTask = \(next: ProjectTab, createRecord = true\)/);
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
  assert.match(workspace, /setSubmittedFinding\(created\)/);
  assert.match(workspace, /if \(navigator\.onLine \|\| !findingPhotos\.length\) \{/);
  assert.match(workspace, /const record = await createFinding\(client, \{ \.\.\.draft, buildingId: targetBuildingId/);
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
  assert.match(operations, /correction = ""\) \{/);
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
  assert.match(workspace, /What was agreed\?|Wat is afgesproken\?/);
  assert.match(workspace, /agreementSignatureDetails\(agreementForm\)/);
  assert.match(styles, /\.agreement-signatures/);
  assert.match(workspace, /agreement: \[\],/);

  // #15 · The deadline page is about deadlines: no creation date standing in for one,
  // overdue first, and every record that carries a deadline is on it.
  assert.match(actionCenter, /text\("Deadlines", "Deadlines"\)/);
  assert.match(actionCenter, /function daysUntil/);
  assert.match(actionCenter, /dueAt: finding\.due_at,/);
  assert.doesNotMatch(actionCenter, /finding\.due_at \?\? finding\.created_at/);
  assert.doesNotMatch(actionCenter, /entry\.due_at \?\? entry\.occurred_at/);
  assert.match(actionCenter, /const overdue = \(item: UnifiedItem\)/);
  assert.match(actionCenter, /day\(s\) overdue|dag\(en\) te laat/);
  assert.match(actionCenter, /deadline-summary/);
  assert.match(styles, /\.deadline-summary/);
});

test("keeps the action centre and makes its deadlines and choices true on site", async () => {
  const [workspace, actionCenter, home, app, styles] = await Promise.all([
    readFile(new URL("../app/operational-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/project-action-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/project-workspace-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  // The action centre keeps the name the client asked for and gains the deadline view
  // instead of being renamed into one.
  assert.match(actionCenter, /text\("Action center", "Actiecentrum"\)/);
  assert.match(actionCenter, /export type ActionCenterView = "work" \| "deadlines"/);
  assert.match(actionCenter, /action-center-views/);
  assert.match(styles, /\.action-center-views/);
  assert.match(actionCenter, /type WorkFilter = "open" \| "urgent" \| "verification" \| "all"/);
  assert.match(actionCenter, /Awaiting verification|Wacht op verificatie/);
  assert.match(actionCenter, /Urgent or overdue|Urgent of te laat/);
  // Deadlines are counted in the day on site, and an NCR opens in the NCR module.
  assert.match(actionCenter, /timeZone: "America\/Paramaribo" \}\)\.format\(value\)\}T00:00:00Z/);
  assert.match(actionCenter, /openProjectArea\(item\.recordKind === "ncr" \? "ncr" : "findings"\)/);
  // The deadline tile opens the same page on its deadline view.
  assert.match(home, /openActionCenter\("deadlines"\)/);
  assert.match(app, /const \[actionCenterView, setActionCenterView\]/);
  assert.match(workspace, /initialView=\{actionCenterView\}/);

  // #16 · A photo says in every form that it can be described, marked or removed.
  assert.match(workspace, /const photoCaptureHint = text\(/);
  assert.match(workspace, /describe, mark or remove it|omschrijven, markeren of verwijderen/);
  assert.equal(workspace.match(/<small>\{photoCaptureHint\}<\/small>/g)?.length, 4);

  // #16 · The building and location choice is the same field in every form, and
  // "all buildings" is stored instead of failing.
  assert.match(workspace, /BuildingPicker id="hse-building"[^/]*allowAll/);
  assert.match(workspace, /const projectWideHse = hseBuildingId === ALL_BUILDINGS/);
  assert.match(workspace, /const projectWideFinding = findingBuildingId === ALL_BUILDINGS/);
  assert.match(workspace, /for \(const targetBuildingId of hseBuildingIds\)/);
  assert.match(workspace, /for \(const targetBuildingId of findingBuildingIds\)/);

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
  assert.match(controlledPdf, /text\(details, "signed_by", text\(details, "issued_by"\)\)/);
  assert.match(controlledDocx, /Issued and signed by/);
  assert.doesNotMatch(controlledPdf, /A blank signature line is intentional/);
  assert.doesNotMatch(controlledDocx, /A blank signature line is intentional/);

  // The contractor's name under the corrective action is that signature, and it is
  // required, stored on the record and printed on the NCR form.
  assert.match(shareActions, /const signatureRequired = responseType === "proposed_correction"/);
  assert.match(shareActions, /signatureRequired && contactName\.trim\(\)\.length < 2/);
  assert.match(migration, /'correction_signed_by', coalesce\(v_contact, ''\)/);
  assert.match(migration, /'completion_signed_by', coalesce\(v_contact, ''\)/);
  assert.match(operations, /correction_signed_by\?: string;/);
  assert.match(workspace, /issue\.correction_signed_by/);
  assert.match(ncrPdf, /issue\.correction_signed_by \|\| issue\.completion_signed_by/);
  assert.match(ncrDocx, /Signed by contractor/);

  // An agreement is signed the same way wherever it is written, and the register shows it.
  assert.match(agreement, /export function AgreementSignatureFields/);
  assert.match(agreement, /export function agreementSummaryLine/);
  assert.match(workspace, /<AgreementSignatureFields options=\{agreementPartyOptions\}/);
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
  assert.match(workspace, /The submitted form is signed by that person|Het ingediende formulier is door die persoon ondertekend/);
  assert.match(controlledPdf, /SUBMITTED AND SIGNED BY/);
  assert.match(controlledDocx, /Submitted and signed by/);

  // The QC signature on a closed NCR is the recorded verifier, never the person who
  // downloads the document.
  assert.match(operations, /verified_by: string \| null;/);
  assert.match(operations, /final_measure,issue_management,verified_by,verified_at/);
  assert.match(workspace, /verifierName: resolveUserName\(finding\.verified_by\)/);
  assert.match(ncrPdf, /resolved \? context\.verifierName \?\? "" : ""/);
  assert.match(ncrDocx, /resolved \? context\.verifierName \?\? "" : ""/);
  assert.doesNotMatch(ncrPdf, /"QC verification", resolved \? context\.issuerName/);

  // Who has to sign a report is a project setting; the database enforces it, so the form
  // offers exactly those roles instead of a fixed list.
  assert.match(workspace, /const signingWorkflow = data\.settings\?\.signing_workflow\?\.length/);
  assert.match(workspace, /const requiredRoles = signingWorkflow\.filter\(\(rule\) => rule\.required\)/);
  assert.match(workspace, /required signatures recorded for this version|verplichte handtekeningen vastgelegd voor deze versie/);
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
  assert.match(history, /window\.history\.pushState\(entry, "", url\)/);
  assert.match(history, /window\.addEventListener\("popstate", onPopState\)/);
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
