import { choosePhotoPurpose } from "./photo-purpose";
import { createHash } from "node:crypto";
import { mkdir, readFile, utimes, writeFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Browser, type Page, test } from "@playwright/test";
import JSZip from "jszip";
import { fillSpecFields } from "./spec-fill";
import { finishSigning } from "./sign-popup";

/**
 * Word section 17, the three journeys end to end on the local fixture stack, plus the F05 photo
 * evidence check:
 *   17.1 NCR assigned to a contractor → corrected in the contractor portal → the NCR itself moves
 *        → verified in Rapid Verify → the NCR and its portal item are closed → archived with every round;
 *   17.2 a revised drawing: revision A approved, a Technical Instruction written against exactly
 *        A, revision B approved later → the instruction keeps A and warns, the register shows the link;
 *   17.3 the Technical Instruction issued to the contractor, acknowledged and answered in the
 *        portal, accepted by CODECO, with the rounds in Record History.
 * F05: a mixed-date photo batch, one saved online and one offline then replayed, keeps each
 * photo's own capture time and the original bytes with data saver on, checked by SHA-256.
 *
 * Needs the role accounts (seed-ui-demo-data.mjs) and, for uploads, the fake Blob stack.
 */
const supervisor = { email: process.env.CODECO_E2E_EMAIL, password: process.env.CODECO_E2E_PASSWORD };
const contractor = { email: process.env.CODECO_E2E_CONTRACTOR_EMAIL, password: process.env.CODECO_E2E_CONTRACTOR_PASSWORD };
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const uploads = process.env.CODECO_E2E_FAKE_BLOB === "1";
const photos = [process.env.CODECO_E2E_PHOTO_1, process.env.CODECO_E2E_PHOTO_2].filter(Boolean) as string[];

test.skip(!supervisor.email || !contractor.email, "Role accounts are required (tests/e2e/seed-ui-demo-data.mjs).");
test.describe.configure({ mode: "serial" });

const suffix = Date.now().toString(36).slice(-5).toUpperCase();
const ncrTitle = `Honeycombing C${suffix}`;
const documentNumber = `S-${suffix}`;
const instructionTitle = `Extra stirrups ${suffix}`;

async function signIn(page: Page, account: { email?: string; password?: string }) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-contractor", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-client", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  const form = page.locator(".access-form");
  await form.waitFor({ state: "visible" });
  await form.locator("input[type='email']").fill(account.email!);
  await form.locator("input[type='password']").fill(account.password!);
  await form.locator("button[type='submit']").click();
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" }).or(page.locator(".portal-shell")).first()).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

async function openSection(page: Page, scope: string, name: RegExp) {
  await page.locator(scope).locator("[role='tablist'], button[aria-haspopup='true']").first().waitFor({ timeout: 60_000 });
  const tab = page.locator(scope).getByRole("tab", { name }).first();
  if (!(await tab.isVisible().catch(() => false))) await page.locator(`${scope} button[aria-haspopup='true']`).first().click();
  await page.locator(scope).getByRole("tab", { name }).first().click();
}

async function nav(page: Page, name: string) {
  await page.locator(".sidebar").getByRole("button", { name, exact: true }).click();
}

/** The database API signed in as one of the fixture accounts (row-level security applies). */
async function api(account: { email?: string; password?: string }) {
  const url = process.env.CODECO_E2E_SUPABASE_URL;
  const key = process.env.CODECO_E2E_PUBLISHABLE_KEY;
  test.skip(!url || !key, "Needs the local database API.");
  const client = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await client.auth.signInWithPassword({ email: account.email!, password: account.password! });
  if (signedIn.error) throw signedIn.error;
  return client;
}

async function projectContext(client: SupabaseClient) {
  const project = (await client.from("projects").select("id").eq("name", projectName).single()).data!;
  const building = (await client.from("buildings").select("id").eq("project_id", project.id).order("code").limit(1).single()).data!;
  const party = (await client.from("parties").select("id").eq("project_id", project.id).eq("party_type", "contractor").order("created_at").limit(1).single()).data!;
  return { projectId: project.id as string, buildingId: building.id as string, partyId: party.id as string };
}

async function contractorPortal(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, contractor);
  await expect(page.locator(".portal-shell")).toBeVisible();
  return page;
}

test("17.1 an NCR is assigned, corrected in the contractor portal, verified and archived with every round", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "One journey; the screens are covered per viewport elsewhere.");
  test.setTimeout(300_000);
  const lead = await api(supervisor);
  const { projectId, buildingId, partyId } = await projectContext(lead);
  const created = await lead.rpc("create_project_finding", {
    p_project_id: projectId, p_building_id: buildingId, p_day_report_id: null, p_inspection_id: null, p_inspection_response_id: null,
    p_finding_type: "ncr", p_title: ncrTitle, p_description: "Honeycombing at the base of the column.", p_severity: "high",
    p_responsible_party_id: partyId, p_assigned_user_id: null, p_idempotency_key: `e2e-w17-ncr-${suffix}`, p_issue_management: {},
  });
  expect(created.error).toBeNull();
  const ncr = created.data as { id: string; finding_number: string };
  // Word 3.1/17.1: submitting the NCR with a responsible contractor assigns it to that portal (migration 202611240009).
  const auto = await lead.from("portal_shares").select("id,status,requested_action").eq("record_id", ncr.id).eq("party_id", partyId);
  expect(auto.data?.length).toBe(1);
  expect(auto.data?.[0].status).toBe("assigned");
  const shared = auto.data?.length ? { error: null } : await lead.rpc("share_to_portal", {
    p_project_id: projectId, p_audience: "contractor", p_party_id: partyId, p_record_type: "finding", p_record_id: ncr.id,
    p_title: ncrTitle, p_summary: "Break out, recast and submit evidence.", p_requested_action: "submit_evidence",
    p_priority: "high", p_due_at: new Date(Date.now() + 3 * 86_400_000).toISOString(), p_file_ids: [], p_contact_user_id: null,
  });
  expect(shared.error).toBeNull();

  // The contractor finds it under Assigned to me and reports the correction complete.
  const portal = await contractorPortal(browser);
  await openSection(portal, ".portal-main", /Assigned to me/);
  await portal.getByRole("button", { name: new RegExp(ncrTitle) }).first().click();
  const item = portal.locator(".portal-detail");
  await item.getByRole("button", { name: "Report complete", exact: true }).click();
  await item.getByLabel("Comment", { exact: true }).fill("Recast with vibration; cubes taken.");
  await item.locator(".portal-response-actions .ui-button--primary").click();
  await expect(item.getByText("Submitted for verification").first()).toBeVisible();

  // F01: the NCR itself now waits for verification (one state across portal and record).
  expect((await lead.from("findings").select("status").eq("id", ncr.id).single()).data?.status).toBe("ready_for_verification");

  // CODECO verifies it in Rapid Verify.
  const page = await (await browser.newContext()).newPage();
  await signIn(page, supervisor);
  await nav(page, "Rapid Verify");
  await openSection(page, ".verification-workspace", /NCR verification/);
  const row = page.locator(".verification-row").filter({ hasText: ncrTitle });
  await row.getByRole("button", { name: "Verify" }).click();
  const dialog = page.getByRole("dialog", { name: /Verify/ });
  await dialog.getByRole("radio", { name: "Pass" }).click();
  await dialog.getByLabel("Comment").fill("Recast checked on site.");
  await dialog.getByRole("button", { name: "Record verification" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".verification-row").filter({ hasText: ncrTitle })).toHaveCount(0);

  // The NCR is closed and so is its portal item, with the closing step in the contractor's history.
  expect((await lead.from("findings").select("status").eq("id", ncr.id).single()).data?.status).toBe("closed");
  const share = (await lead.from("portal_shares").select("id,status").eq("record_id", ncr.id).single()).data!;
  expect(share.status).toBe("closed");
  const rounds = (await lead.from("portal_events").select("action").eq("share_id", share.id).not("action", "in", "(view,download)").order("sequence")).data!.map((event) => event.action);
  expect(rounds).toEqual(["assign", "mark_complete", "close"]);
  await portal.reload();
  await expect(portal.getByText(ncrTitle)).toHaveCount(0, { timeout: 30_000 }).catch(async () => {
    // A closed item may still be listed under History; it must not be listed as assigned.
    await openSection(portal, ".portal-main", /Assigned to me/);
    await expect(portal.locator(".portal-main").getByRole("button", { name: new RegExp(ncrTitle) })).toHaveCount(0);
  });
  await portal.context().close();

  // Records & Photos finds it through the server archive and shows every round in Record History.
  await nav(page, "Records & Photos");
  const archive = page.locator(".records-archive");
  await archive.getByRole("textbox", { name: "Search records" }).fill(ncr.finding_number);
  await expect(archive.locator("[data-archive-source='server']")).toBeVisible({ timeout: 30_000 });
  await expect(archive.locator(".portal-list").getByText(ncrTitle)).toBeVisible();
  await openSection(page, ".records-archive", /Record history/);
  const history = archive.locator(".portal-table");
  await expect(history.getByRole("row").filter({ hasText: "mark complete" }).first()).toBeVisible({ timeout: 30_000 });
  await expect(history.getByRole("row").filter({ hasText: "Recast checked on site." }).first()).toBeVisible();
  await page.context().close();
});

test("17.2 and 17.3 a revised drawing and a Technical Instruction issued against its exact revision", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office" || !uploads, "Needs the fake Blob stack for document uploads.");
  test.setTimeout(420_000);
  const page = await (await browser.newContext()).newPage();
  await signIn(page, supervisor);

  // 17.2: register revision A and approve it.
  await nav(page, "Project Documents");
  const register = page.locator(".document-register");
  await register.getByRole("button", { name: "Register document" }).click();
  const dialog = page.getByRole("dialog", { name: "Register document" });
  await dialog.getByLabel("Document number").fill(documentNumber);
  await dialog.getByLabel("Title (required)").fill(`Foundation plan ${suffix}`);
  await dialog.getByLabel("Revision (as on the document)").fill("A");
  await dialog.getByLabel("File").setInputFiles({ name: `${documentNumber}-A.pdf`, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") });
  await dialog.getByRole("button", { name: "Register", exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 60_000 });
  await register.getByRole("button", { name: `Foundation plan ${suffix}` }).click();
  const detail = page.locator(".document-detail");
  await detail.getByRole("button", { name: "Review status" }).click();
  await detail.getByLabel(/New status for revision/).selectOption("approved");
  await detail.getByRole("button", { name: "Save status" }).click();
  const revisions = detail.locator("table").first();
  await expect(revisions.getByRole("row").filter({ hasText: /^A/ }).getByText("Approved")).toBeVisible({ timeout: 30_000 });

  await detail.getByRole("button", { name: "Close" }).click();
  // The Technical Instruction refers to exactly revision A, chosen from the register.
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("[data-workspace-destination='technical-instructions']").click();
  const form = page.locator("[data-sheet-form='technical_instruction']");
  await expect(form).toBeVisible();
  // A Technical Instruction has no title row; its description identifies it.
  await form.locator("[data-sheet-slot='description'] textarea").fill(`${instructionTitle}: add stirrups at 150 mm at the column heads.`);
  const reference = form.locator("[data-spec-field='drawing_reference']");
  await reference.getByRole("searchbox").fill(documentNumber);
  const option = reference.locator("select option").filter({ hasText: `${documentNumber} rev A` });
  await reference.locator("select").selectOption({ value: (await option.getAttribute("value"))! });
  await expect(reference.locator(".spec-record-chip")).toContainText(`${documentNumber} rev A`);
  await fillSpecFields(page.locator("main"));
  await fillSpecFields(page.locator("main"));
  await page.locator("main").getByRole("button", { name: /^Create controlled document$/ }).last().click();
  await finishSigning(page);
  await expect(page.locator(".operation-alert.success")).toBeVisible({ timeout: 30_000 });

  const lead = await api(supervisor);
  const { projectId, partyId } = await projectContext(lead);
  const instruction = (await lead.from("project_register_entries").select("id,entry_number,details").eq("project_id", projectId)
    .eq("register_type", "technical_instruction").eq("details->spec->>drawing_reference", `${documentNumber} rev A`).single()).data!;
  expect(instruction.details.spec.drawing_reference).toBe(`${documentNumber} rev A`);
  expect(String(instruction.details.spec.drawing_reference_ref)).toMatch(/^revision:/);

  // The register lists the instruction against revision A; revision B is then uploaded and approved.
  await nav(page, "Project Documents");
  await register.getByRole("button", { name: `Foundation plan ${suffix}` }).click();
  await expect(detail.locator("[data-link-revision='A']")).toBeVisible({ timeout: 30_000 });
  await detail.getByRole("button", { name: "Upload new revision" }).click();
  await detail.locator("input[type='file']").setInputFiles({ name: `${documentNumber}-B.pdf`, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n2 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") });
  // Word 4.3: an upload is not approved. A stays current and B is shown as the newer revision under review.
  await expect(detail.locator("[data-pending-revision='B']")).toBeVisible({ timeout: 60_000 });
  await expect(revisions.getByText("A · current")).toBeVisible();
  // While B is only submitted, the instruction's revision A is still the one to use.
  await expect(detail.locator(".document-link-stale")).toHaveCount(0);
  await detail.getByRole("button", { name: "Review status" }).click();
  await detail.getByLabel(/New status for revision/).selectOption("approved");
  await detail.getByRole("button", { name: "Save status" }).click();
  await expect(revisions.getByRole("row").filter({ hasText: /^B/ }).getByText("Approved")).toBeVisible({ timeout: 30_000 });
  await expect(revisions.getByText("B · current")).toBeVisible();
  await expect(detail.locator("[data-pending-revision]")).toHaveCount(0);
  await page.reload();
  await nav(page, "Project Documents");
  await register.getByRole("button", { name: `Foundation plan ${suffix}` }).click();
  await expect(detail.locator(".document-link-stale")).toContainText("rev B approved since", { timeout: 30_000 });
  await detail.getByRole("button", { name: "Close" }).click();
  await register.getByRole("textbox", { name: "Search the register" }).fill(documentNumber);
  const [workbook] = await Promise.all([
    page.waitForEvent("download"),
    register.getByRole("button", { name: "Excel (XLSX)" }).click(),
  ]);
  expect(workbook.suggestedFilename()).toMatch(/\.xlsx$/);
  const zip = await JSZip.loadAsync(await readFile((await workbook.path())!));
  const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  expect(sheet).toContain(documentNumber);
  expect(sheet).toContain("Approved");
  const [pdf] = await Promise.all([
    page.waitForEvent("download"),
    register.getByRole("button", { name: "PDF", exact: true }).click(),
  ]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect((await readFile((await pdf.path())!)).subarray(0, 5).toString()).toBe("%PDF-");
  // The instruction keeps its stored reference to A.
  expect((await lead.from("project_register_entries").select("details").eq("id", instruction.id).single()).data!.details.spec.drawing_reference).toBe(`${documentNumber} rev A`);

  // The instruction's own record shows the warning next to its reference.
  await nav(page, "Records & Photos");
  const archive = page.locator(".records-archive");
  await archive.getByRole("textbox", { name: "Search records" }).fill(instruction.entry_number);
  await archive.locator(".portal-list").getByText(instruction.entry_number, { exact: false }).first().click();
  // F17: the saved record is headed by its own form, and its viewer shows the reference.
  await expect(page.locator(".workspace-current-module h1")).toHaveText("Technical instructions");
  await page.locator("article").filter({ hasText: instruction.entry_number }).getByRole("button", { name: "Open record & history" }).click();
  await expect(page.locator(".spec-link-chip [data-revision-stale='true']")).toContainText("Rev B is approved", { timeout: 60_000 });

  // 17.3: issued to the contractor, acknowledged and answered in the portal, accepted by CODECO.
  // A TI issued to this contractor is already assigned on submission; otherwise assign it here.
  const autoTi = await lead.from("portal_shares").select("id").eq("record_id", instruction.id).eq("party_id", partyId).neq("status", "closed");
  const shared = autoTi.data?.length ? { error: null } : await lead.rpc("share_to_portal", {
    p_project_id: projectId, p_audience: "contractor", p_party_id: partyId, p_record_type: "register_entry", p_record_id: instruction.id,
    p_title: instructionTitle, p_summary: "Add stirrups per the instruction; confirm the method.", p_requested_action: "propose",
    p_priority: "normal", p_due_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), p_file_ids: [], p_contact_user_id: null,
  });
  expect(shared.error).toBeNull();
  const portal = await contractorPortal(browser);
  await openSection(portal, ".portal-main", /Assigned to me/);
  await portal.getByRole("button", { name: new RegExp(instructionTitle) }).first().click();
  const item = portal.locator(".portal-detail");
  await item.getByRole("button", { name: "Acknowledge receipt", exact: true }).click();
  await item.locator(".portal-response-actions .ui-button--primary").click();
  await expect(item.getByText("Acknowledged").first()).toBeVisible();
  await item.getByRole("button", { name: "Respond", exact: true }).click();
  await item.getByLabel("Comment", { exact: true }).fill("Stirrups added at 150 mm; method attached to site file.");
  await item.locator(".portal-response-actions .ui-button--primary").click();
  await expect(item.getByText("Response submitted").first()).toBeVisible();
  await portal.context().close();

  const share = (await lead.from("portal_shares").select("id").eq("record_id", instruction.id).single()).data!;
  expect((await lead.rpc("review_portal_share", { p_share_id: share.id, p_action: "accept", p_comment: "Method accepted.", p_file_ids: [] })).error).toBeNull();
  const rounds = (await lead.from("portal_events").select("action,actor_side").eq("share_id", share.id).not("action", "in", "(view,download)").order("sequence")).data!;
  expect(rounds.map((event) => `${event.actor_side}:${event.action}`)).toEqual(["codeco:assign", "contractor:acknowledge", "contractor:respond", "codeco:accept"]);
  await nav(page, "Records & Photos");
  await openSection(page, ".records-archive", /Record history/);
  await archive.getByRole("textbox", { name: "Search records" }).fill(instruction.entry_number);
  await expect(archive.locator(".portal-table").getByRole("row").filter({ hasText: "Method accepted." })).toBeVisible({ timeout: 30_000 });
  await page.context().close();
});

test("F05 photos keep each capture time and original bytes online, offline and after markup", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office" || !uploads || photos.length < 2, "Needs the fake Blob stack and two fixture photos.");
  test.setTimeout(240_000);
  // Two photos taken on different days (file times as the camera wrote them).
  const dir = testInfo.outputPath("batch");
  await mkdir(dir, { recursive: true });
  const taken = [new Date("2026-11-18T09:15:00Z"), new Date("2026-11-20T14:40:00Z")];
  const files: string[] = [];
  for (const [index, source] of photos.slice(0, 2).entries()) {
    const target = `${dir}/w17-${suffix}-${index + 1}.jpg`;
    // Unique bytes past the previous compression threshold, so this detects byte replacement.
    await writeFile(target, Buffer.concat([await readFile(source), Buffer.from(`
codeco-e2e-${suffix}-${index}`), Buffer.alloc(950_000)]));
    await utimes(target, taken[index], taken[index]);
    files.push(target);
  }
  const hashes = await Promise.all(files.map(async (file) => createHash("sha256").update(await readFile(file)).digest("hex")));

  await page.addInitScript(() => localStorage.setItem("codeco-data-saver", "true"));
  await signIn(page, supervisor);
  const project = new URL(page.url()).searchParams.get("project");
  await page.goto(`/supervisie?project=${project}&nav=project&tab=files`);
  // The way a user does it: "Upload photos" opens the file chooser (also in the offline view).
  const choose = async (file: string) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /^Upload photos/ }).click();
    await (await chooser).setFiles(file);
    if (file !== files[0]) await choosePhotoPurpose(page.locator(".media-capture-review"), "Progress Documentation");
  };
  const save = page.locator(".media-capture-review .ui-button--primary").first();

  // The first photo is saved online.
  await choose(files[0]);
  await save.click();
  await expect(page.getByRole("alert").filter({ hasText: "a purpose for every photo" })).toBeVisible();
  await choosePhotoPurpose(page.locator(".media-capture-review"), "Site Conditions");
  await save.click();
  const lead = await api(supervisor);
  await expect.poll(async () => (await lead.from("files").select("id").eq("project_id", project).eq("sha256", hashes[0])).data?.length ?? 0, { timeout: 90_000 }).toBe(1);
  await expect(page.locator(".offline-queue")).toHaveCount(0, { timeout: 60_000 });
  // The device draft of the stored photo is cleared: a reload offers nothing to save again.
  await page.reload();
  await expect(page.getByRole("button", { name: /^Upload photos/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".media-capture-review")).toHaveCount(0);
  // The second is saved offline, waits on the device, and is sent when the connection returns.
  await context.setOffline(true);
  await choose(files[1]);
  await save.click();
  await expect(page.locator(".offline-queue")).toContainText("1 upload(s) waiting", { timeout: 30_000 });
  await context.setOffline(false);
  // Reconnecting starts the replay by itself; nothing waits on the device afterwards.
  await expect(page.locator(".offline-queue")).toHaveCount(0, { timeout: 120_000 });

  for (const [index, hash] of hashes.entries()) {
    const file = (await lead.from("files").select("id,sha256,size_bytes").eq("project_id", project).eq("sha256", hash).maybeSingle()).data;
    expect(file, `photo ${index + 1} is stored with the original's SHA-256`).not.toBeNull();
    const capture = (await lead.from("visual_captures").select("captured_at,spec").eq("file_id", file!.id).single()).data!;
    expect(new Date(capture.captured_at).toISOString()).toBe(taken[index].toISOString());
    expect(capture.spec?._original?.sha256).toBe(hash);
    expect(capture.spec?._original?.stored).toBe("original");
    expect(capture.spec?.photo_purpose).toBe(index === 0 ? "Site Conditions" : "Progress Documentation");
  }
  await page.reload();

  const markedPath = `${dir}/w17-${suffix}-marked-source.jpg`;
  const markedSource = Buffer.concat([await readFile(photos[0]), Buffer.from(`codeco-marked-${suffix}`)]);
  await writeFile(markedPath, markedSource);
  const markedHash = createHash("sha256").update(markedSource).digest("hex");
  await choose(markedPath);
  await page.getByRole("button", { name: "Open the details of photo 1" }).click();
  const photoDetail = page.getByRole("dialog", { name: "Photo details" });
  await expect(photoDetail.getByLabel("Work location")).toBeVisible();
  await photoDetail.getByLabel("Location detail").fill("Bay A, beside the gate");
  await photoDetail.getByLabel("Photo date/time").fill("2026-11-18T09:45");
  await photoDetail.getByLabel("Caption / observation").fill("Check the dimension at the marker.");
  await page.getByRole("button", { name: "Mark on photo" }).click();
  const markup = page.locator(".photo-markup-modal");
  await markup.getByRole("button", { name: "Photo. Tap to place a marker." }).press("Enter");
  await markup.getByRole("button", { name: "Save markings on the photo" }).click();
  await expect(markup).toHaveCount(0);
  await expect(page.locator(".media-capture-review")).toContainText("1 marked");
  await save.click();
  await expect.poll(async () => (await lead.from("visual_captures").select("id").eq("project_id", project).eq("spec->_original->>sha256", markedHash)).data?.length ?? 0, { timeout: 90_000 }).toBe(1);
  const marked = (await lead.from("visual_captures").select("file_id,spec,captured_at,description").eq("project_id", project).eq("spec->_original->>sha256", markedHash).single()).data!;
  expect(marked.spec.location_detail).toBe("Bay A, beside the gate");
  expect(new Date(marked.captured_at).toISOString()).toBe("2026-11-18T12:45:00.000Z");
  expect(marked.description).toContain("Check the dimension at the marker.");
  expect(marked.spec._original.stored).toBe("original_and_markup");
  expect(marked.spec._original.file_id).not.toBe(marked.file_id);
  const source = (await lead.from("files").select("sha256,size_bytes").eq("id", marked.spec._original.file_id).single()).data!;
  expect(source.sha256).toBe(markedHash);
  expect(source.size_bytes).toBe(markedSource.byteLength);

  const stored = (await lead.from("files").select("original_name").eq("id", marked.file_id).single()).data!;
  await expect(page.locator(".offline-queue")).toHaveCount(0, { timeout: 60_000 });
  await page.reload();
  await page.getByRole("checkbox", { name: `Select ${stored.original_name}`, exact: true }).check();
  const picker = page.locator(".photo-stack-actions select");
  await expect(page.locator(".photo-stack-actions")).toContainText("Related record");
  const value = await picker.locator("option").nth(1).getAttribute("value", { timeout: 10_000 });
  expect(value).toBeTruthy();
  const [recordType, recordId] = value!.split(":");
  await picker.selectOption(value!);
  await page.getByRole("button", { name: "Link", exact: true }).click({ timeout: 10_000 });
  await expect.poll(async () => (await lead.from("file_links").select("id").eq("file_id", marked.file_id).eq("record_type", recordType).eq("record_id", recordId)).data?.length ?? 0).toBe(1);
});
