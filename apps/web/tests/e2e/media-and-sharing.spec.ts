import { expect, type Browser, type Page, test } from "@playwright/test";
import { basename, extname } from "node:path";

const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const photoOne = process.env.CODECO_E2E_PHOTO_1;
const photoTwo = process.env.CODECO_E2E_PHOTO_2;
const photoThree = process.env.CODECO_E2E_PHOTO_3;
const panorama = process.env.CODECO_E2E_360;
const drawing = process.env.CODECO_E2E_DRAWING;

test.skip(
  !email || !password || !photoOne || !photoTwo || !photoThree || !panorama || !drawing,
  "Authenticated media fixture paths are required.",
);
test.setTimeout(300_000);

async function openAuthenticatedWorkspace(page: Page) {
  // The drawing is tall and the mouse can only drag a pin that is on the screen.
  await page.setViewportSize({ width: 1440, height: 1300 });
  await page.goto("/supervisie");
  // These assertions use the English interface; Supervisie itself defaults to Dutch.
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  await page.locator(".access-form, .project-selection-grid").first().waitFor({ state: "visible" });
  const accessForm = page.locator(".access-form");
  if (await accessForm.isVisible().catch(() => false)) {
    await accessForm.locator("input[type='email']").fill(email!);
    await accessForm.locator("input[type='password']").fill(password!);
    await page.getByRole("button", { name: "Sign in securely" }).click();
  }
  await page.getByRole("button", { name: new RegExp(projectName) }).click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
}

async function openWorkspaceHome(page: Page) {
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  const back = page.locator(".workspace-back-button");
  if (await back.isVisible().catch(() => false)) await back.click();
  await expect(page.getByRole("heading", { name: "Workspace", exact: true })).toBeVisible();
}

async function openVisualEvidence(page: Page) {
  await openWorkspaceHome(page);
  // The photo and 360° tools open from the module they are used in.
  await page.locator('[data-workspace-destination="issues"]').click();
  await page.getByRole("button", { name: "Open photo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Visual evidence", exact: true })).toBeVisible();
}

async function createStackedFinding(page: Page, title: string) {
  await openWorkspaceHome(page);
  // A tile opens its module with the form ready.
  await page.locator('[data-workspace-destination="issues"]').click();
  await expect(page.getByRole("heading", { name: "Create issue" })).toBeVisible();
  await page.getByRole("button", { name: "Quality", exact: true }).click();
  await page.getByRole("combobox", { name: "Category", exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "High", exact: true }).click();
  await page.locator("textarea").first().fill(`${title}. Three field photos document the same exact defect and its surrounding context.`);
  const photoInput = page.getByLabel("Add photo").first();
  await photoInput.setInputFiles(photoOne!);
  await photoInput.setInputFiles(photoTwo!);
  await photoInput.setInputFiles(photoThree!);
  await expect(page.getByText("Describe", { exact: true })).toHaveCount(3);
  await page.getByPlaceholder("First and last name").fill("Demo Hoofdaannemer");
  await page.getByRole("button", { name: "Submit issue" }).click();
  await expect(page.locator(".operation-alert.success")).toContainText(/Issue|saved|secured/i, { timeout: 90_000 });
  await openWorkspaceHome(page);
  await page.locator('[data-workspace-destination="issues"]').click();
  await expect(page.locator(".finding-card").filter({ hasText: title })).toBeVisible({ timeout: 60_000 });
  const queueState = await page.evaluate(async () => new Promise<Array<{ fileName: string; lastError: string | null }>>((resolve, reject) => {
    const open = indexedDB.open("codeco-field-v1");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const request = database.transaction("uploads", "readonly").objectStore("uploads").getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result.map((entry) => ({ fileName: String(entry.fileName), lastError: entry.lastError ? String(entry.lastError) : null })));
        database.close();
      };
    };
  }));
  expect(queueState, `Offline queue must be empty after forced online sync: ${JSON.stringify(queueState)}`).toEqual([]);
}

async function testDirectPointAndShoot(page: Page) {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator(".quick-add-side").click();
  const chooser = await chooserPromise;
  await chooser.setFiles(photoOne!);
  await expect(page.getByRole("heading", { name: "Project photos" })).toBeVisible();
  // A photo taken or chosen waits on the form until it is saved with its date.
  await page.getByRole("button", { name: "Save with date" }).click();
  await expect(page.locator(".media-capture-review")).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator(".offline-queue")).toHaveCount(0);
}

async function uploadAndMarkPhoto(page: Page, title: string) {
  await openVisualEvidence(page);
  await page.locator(".visual-toolbar input[type='file'][capture='environment']").setInputFiles(photoTwo!);
  await expect(page.getByRole("heading", { name: "Photo ready to save" })).toBeVisible();
  await page.locator(".visual-upload-form").getByRole("textbox", { name: "Description" }).fill(title);
  await page.getByRole("button", { name: "Save photo" }).click();
  const capture = page.locator(".visual-capture-list button").filter({ hasText: title });
  await expect(capture).toBeVisible({ timeout: 60_000 });
  await capture.click();
  await expect(page.getByRole("button", { name: "Photo. Click to mark an issue." })).toBeVisible();
  await page.getByRole("button", { name: "Place marker at image center" }).click();
  await page.getByRole("button", { name: "Work incomplete", exact: true }).click();
  await page.getByRole("button", { name: "Create finding" }).click();
  await expect(page.locator(".visual-marker").first()).toBeVisible({ timeout: 60_000 });
}

async function uploadAndMarkPanorama(page: Page, title: string) {
  await page.getByRole("button", { name: "Upload 360°" }).click();
  const uploadForm = page.locator(".visual-upload-form");
  const fileInput = uploadForm.locator("input[type='file']");

  await fileInput.setInputFiles(panorama!);
  // Every 360° export is accepted: the form describes the image it was given instead of
  // refusing it over its proportions or its resolution.
  await expect(uploadForm.locator(".operation-alert")).toContainText(/pixels ·/);
  await uploadForm.locator("textarea").first().fill(title);
  await uploadForm.getByLabel(/Tour name/).fill("B1 Release Tour");
  await uploadForm.getByLabel("Position in tour").fill("1");
  await page.getByRole("button", { name: "Secure and sync 360° image" }).click();

  const capture = page.locator(".visual-capture-list button").filter({ hasText: title });
  await expect(capture).toBeVisible({ timeout: 90_000 });
  await capture.click();
  await expect(page.locator(".panorama-viewer canvas").first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Mark center of current view" }).click();
  await page.getByRole("button", { name: "Safety risk", exact: true }).click();
  await page.getByRole("button", { name: "Create finding" }).click();
  await expect(page.locator(".panorama-marker-dot").first()).toBeVisible({ timeout: 60_000 });
}

async function uploadDrawingAndCreatePin(page: Page, findingTitle: string) {
  // The coordinated drawing opens from the Action center.
  await page.locator(".sidebar").getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("button", { name: /Open coordinated drawing/ }).click();
  await expect(page.getByRole("heading", { name: "Pins that open the exact project record" })).toBeVisible();
  await page.locator(".drawing-upload-strip input[type='file']").setInputFiles(drawing!);
  await page.getByRole("button", { name: "Upload drawing" }).click();
  await expect(page.locator(".operation-alert.success")).toContainText("Drawing uploaded", { timeout: 90_000 });
  const drawingName = basename(drawing!, extname(drawing!));
  const drawingButton = page.locator(".drawing-file-list button").filter({ hasText: drawingName }).first();
  await expect(drawingButton).toBeVisible({ timeout: 90_000 });
  await drawingButton.click();

  await openWorkspaceHome(page);
  await page.locator('[data-workspace-destination="issues"]').click();
  const finding = page.locator(".finding-card").filter({ hasText: findingTitle });
  await finding.getByRole("button", { name: "Place on drawing" }).click();
  await expect(page.getByRole("heading", { name: "Pins that open the exact project record" })).toBeVisible();
  await page.locator(".drawing-file-list button").filter({ hasText: drawingName }).first().click();

  const canvas = page.getByRole("application", { name: "Interactive drawing. Pan, zoom or place a linked pin." });
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await page.getByRole("toolbar").getByRole("button", { name: "Link pin" }).click();
  await canvas.press("Enter");
  await page.getByRole("button", { name: "Confirm pin" }).click();
  await expect(page.locator(".drawing-pin").first()).toBeVisible({ timeout: 60_000 });

  const pin = page.locator("button.drawing-pin").first();
  const normalizedPosition = async () => pin.evaluate((element) => {
    const anchor = element.closest(".drawing-pin-anchor") as HTMLElement;
    return { left: anchor.style.left, top: anchor.style.top };
  });
  const positionBeforeZoom = await normalizedPosition();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  expect(await normalizedPosition()).toEqual(positionBeforeZoom);

  const pinBox = await pin.boundingBox();
  expect(pinBox).not.toBeNull();
  await page.mouse.move(pinBox!.x + pinBox!.width / 2, pinBox!.y + pinBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(pinBox!.x + 110, pinBox!.y + 70, { steps: 8 });
  await page.mouse.up();
  // A moved pin is saved without a message; the position has changed on the drawing.
  await expect.poll(normalizedPosition, { timeout: 30_000 }).not.toEqual(positionBeforeZoom);

  const pager = await page.locator(".tour-controls span").first().textContent();
  const pageTotal = Number(pager?.split("/")[1]?.trim() ?? "1");
  if (pageTotal > 1) {
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(canvas).toHaveAttribute("data-page", "2");
    await expect(page.locator("button.drawing-pin")).toHaveCount(0);
    await page.getByRole("button", { name: "Previous page" }).click();
    await expect(canvas).toHaveAttribute("data-page", "1");
  }

  await page.reload();
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await openWorkspaceHome(page);
  await page.locator('[data-workspace-destination="issues"]').click();
  await page.locator(".finding-card").filter({ hasText: findingTitle }).getByRole("button", { name: "View on drawing" }).click();
  await expect(page.locator("button.drawing-pin").first()).toBeVisible({ timeout: 60_000 });

  const existingMarkups = await page.locator(".drawing-markup-layer line").count();
  await page.getByRole("toolbar").getByRole("button", { name: "Arrow" }).click();
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.scrollBehavior = "auto";
  });
  const reloadedCanvas = page.getByRole("application", { name: "Interactive drawing. Pan, zoom or place a linked pin." });
  await reloadedCanvas.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
  await expect.poll(async () => {
    const bounds = await reloadedCanvas.boundingBox();
    const viewport = page.viewportSize();
    return Boolean(bounds && viewport && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height);
  }, { timeout: 10_000 }).toBe(true);
  const box = await reloadedCanvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.3, box!.y + box!.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height * 0.65, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".drawing-markup-layer line")).toHaveCount(existingMarkups + 1, { timeout: 60_000 });

  await page.context().setOffline(true);
  const offlinePin = page.locator("button.drawing-pin").first();
  const offlinePinBox = await offlinePin.boundingBox();
  expect(offlinePinBox).not.toBeNull();
  const offlineStartX = offlinePinBox!.x + offlinePinBox!.width / 2;
  const offlineStartY = offlinePinBox!.y + offlinePinBox!.height / 2;
  await page.mouse.move(offlineStartX, offlineStartY);
  await page.mouse.down();
  await page.mouse.move(offlineStartX + 55, offlineStartY + 40, { steps: 6 });
  await page.mouse.up();
  const queuedPinMutations = () => page.evaluate(async () => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open("codeco-field-v1");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const request = database.transaction("drawingPins", "readonly").objectStore("drawingPins").count();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { resolve(request.result); database.close(); };
    };
  }));
  await expect.poll(queuedPinMutations).toBeGreaterThan(0);
  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(queuedPinMutations, { timeout: 60_000 }).toBe(0);

  await offlinePin.click();
  // The removal is confirmed on the page itself, next to the pin, not in a browser dialog.
  await page.getByRole("button", { name: "Remove pin", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Remove this pin?" }).getByRole("button", { name: "Remove pin", exact: true }).click();
  await expect(page.locator("button.drawing-pin")).toHaveCount(0, { timeout: 60_000 });
}

async function testExternalShareAndRevocation(page: Page, browser: Browser, findingTitle: string) {
  await openWorkspaceHome(page);
  await page.locator('[data-workspace-destination="issues"]').click();
  const finding = page.locator(".finding-card").filter({ hasText: findingTitle });
  await expect(finding).toBeVisible();
  await finding.getByRole("button", { name: /Send to external party/ }).click();
  const preflight = finding.locator(".external-share-preflight");
  await expect(preflight).toBeVisible();
  const shareUrl = await preflight.locator("input[readonly]").inputValue();
  expect(shareUrl).toMatch(/\/share\/[a-f0-9]{48}$/);

  const popupPromise = page.waitForEvent("popup");
  await preflight.getByRole("button", { name: "Open WhatsApp and send" }).click();
  const whatsapp = await popupPromise;
  await expect.poll(() => whatsapp.url()).toMatch(/^https:\/\/(?:wa\.me\/|api\.whatsapp\.com\/send)/);
  await whatsapp.close();

  const outsideContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const outside = await outsideContext.newPage();
  const response = await outside.goto(shareUrl);
  expect(response?.status()).toBe(200);
  await expect(outside.getByRole("heading", { name: findingTitle })).toBeVisible();
  await expect(outside.locator(".access-form")).toHaveCount(0);
  await outside.getByRole("button", { name: "Werk is gereed; bewijsfoto is toegevoegd." }).click();
  await outside.locator(".external-photo-input input[type='file']").setInputFiles(photoThree!);
  await outside.getByLabel("Naam (optioneel)").fill("Demo Hoofdaannemer");
  await outside.getByRole("button", { name: "Markeer gereed voor controle" }).click();
  await expect(outside.getByRole("heading", { name: "Bedankt" })).toBeVisible({ timeout: 60_000 });

  const activeLinks = finding.locator(".active-external-shares");
  await expect(activeLinks).toBeVisible({ timeout: 30_000 });
  await activeLinks.getByRole("button", { name: "Revoke link" }).click();
  await activeLinks.getByRole("button", { name: "Confirm revoke" }).click();
  await expect(activeLinks).toHaveCount(0, { timeout: 30_000 });

  const revoked = await outside.goto(shareUrl);
  expect(revoked?.status()).toBe(404);
  await outsideContext.close();
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office");
  await openAuthenticatedWorkspace(page);
});

test("photo stacks, point-and-shoot, normal pins, 360, drawing pins and account-free sharing work end to end", async ({ page, browser }) => {
  const stamp = Date.now().toString().slice(-8);
  const findingTitle = `Stacked evidence ${stamp}`;
  await testDirectPointAndShoot(page);
  await createStackedFinding(page, findingTitle);
  await uploadAndMarkPhoto(page, `Marked field photo ${stamp}`);
  await uploadAndMarkPanorama(page, `Interactive 360 ${stamp}`);
  await uploadDrawingAndCreatePin(page, findingTitle);
  await testExternalShareAndRevocation(page, browser, findingTitle);
});

/**
 * QA M8 and M26, on a window the size of a laptop. The pin is confirmed on the screen where it
 * was placed, its record opens from the pin, a drawing is not a photo, and saving photos twice
 * in one day files them in one folder.
 */
test("a placed pin is confirmed on screen, its record opens from the pin, and a drawing stays out of the photo count", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const stamp = Date.now().toString().slice(-8);
  const findingTitle = `Pin evidence ${stamp}`;
  await createStackedFinding(page, findingTitle);

  const photoCount = async () => {
    await page.locator(".sidebar").getByRole("button", { name: "Overview", exact: true }).click();
    const tile = page.locator(".overview-metrics > *").filter({ hasText: "Pictures" });
    await expect(tile).toBeVisible();
    // The count follows the data a moment after the screen opens; read it once it stops moving.
    let last = -1;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const current = Number((await tile.innerText()).match(/\d+/)?.[0] ?? "NaN");
      if (current === last) return current;
      last = current;
      await page.waitForTimeout(1500);
    }
    return last;
  };
  const before = await photoCount();

  await page.locator(".sidebar").getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("button", { name: /Open coordinated drawing/ }).click();
  await page.locator(".drawing-upload-strip input[type='file']").setInputFiles(drawing!);
  await page.getByRole("button", { name: "Upload drawing" }).click();
  await expect(page.locator(".operation-alert.success")).toContainText("Drawing uploaded", { timeout: 90_000 });
  expect(await photoCount(), "a drawing saved as an image is not a photo").toBe(before);

  await openWorkspaceHome(page);
  await page.locator('[data-workspace-destination="issues"]').click();
  await page.locator(".finding-card").filter({ hasText: findingTitle }).getByRole("button", { name: "Place on drawing" }).click();
  await page.locator(".drawing-file-list button").first().click();
  const canvas = page.getByRole("application", { name: "Interactive drawing. Pan, zoom or place a linked pin." });
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await page.getByRole("toolbar").getByRole("button", { name: "Link pin" }).click();
  await canvas.press("Enter");
  // The confirmation is where the person is looking, not a screen below.
  await expect(page.getByRole("button", { name: "Confirm pin" })).toBeInViewport();
  await page.getByRole("button", { name: "Confirm pin" }).click();
  await expect(page.locator("button.drawing-pin").first()).toBeVisible({ timeout: 60_000 });

  await page.locator("button.drawing-pin").first().click();
  const openRecord = page.getByRole("button", { name: "Open linked project record" });
  await expect(openRecord).toBeInViewport();
  await openRecord.click();
  // The record itself opens: its card, not the list with an empty form.
  await expect(page.locator(".finding-card").filter({ hasText: findingTitle })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Create issue" })).toHaveCount(0);
});

test("saving photos twice in one day files them in one folder", async ({ page, request }) => {
  test.setTimeout(180_000);
  const supabaseUrl = process.env.CODECO_E2E_SUPABASE_URL;
  const publishableKey = process.env.CODECO_E2E_PUBLISHABLE_KEY;
  test.skip(!supabaseUrl || !publishableKey, "The local Supabase keys are required to count the folders.");
  expect(supabaseUrl, "folders are only counted on the local stack").toMatch(/^http:\/\/(127\.0\.0\.1|localhost):/);
  const save = async (file: string) => {
    const chooserPromise = page.waitForEvent("filechooser");
    await page.locator(".quick-add-side").click();
    (await chooserPromise).setFiles(file);
    await expect(page.getByRole("heading", { name: "Project photos" })).toBeVisible();
    await page.getByRole("button", { name: "Save with date" }).click();
    await expect(page.locator(".media-capture-review")).toHaveCount(0, { timeout: 60_000 });
  };
  await save(photoOne!);
  await save(photoTwo!);
  // Read as the signed-in supervisor, as the app does: the folders are protected by the project's rules.
  const login = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: publishableKey! },
    data: { email, password },
  });
  expect(login.ok()).toBe(true);
  const { access_token: accessToken } = await login.json() as { access_token: string };
  const response = await request.get(`${supabaseUrl}/rest/v1/media_folders?select=id,name,status&name=like.Daily%20progress*`, {
    headers: { apikey: publishableKey!, authorization: `Bearer ${accessToken}` },
  });
  expect(response.ok(), `folders could not be read: ${response.status()} ${await response.text()}`).toBe(true);
  const folders = await response.json() as Array<{ name: string; status: string }>;
  const names = new Map<string, number>();
  for (const folder of folders) if (folder.status === "active") names.set(folder.name, (names.get(folder.name) ?? 0) + 1);
  for (const [name, count] of names) expect(count, `one active folder named ${name}`).toBe(1);
  expect(names.size).toBeGreaterThan(0);
});
