import { expect, type Page, test } from "@playwright/test";

/**
 * Walkthrough finding (L13 follow-up). The people counter of the Workforce register, its remove
 * button and shift lists, the "Remove this line" button of the delivery register and the
 * Online chip of the record forms were 33-38 px on a phone and a tablet. A thumb needs 44 px.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the release gate.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

async function signIn(page: Page) {
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-contractor", "yes"); localStorage.setItem("codeco-portal-guide-seen-v1-client", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  const form = page.locator(".access-form");
  await form.waitFor({ state: "visible" });
  await form.locator("input[type='email']").fill(email!);
  await form.locator("input[type='password']").fill(password!);
  await form.locator("button[type='submit']").click();
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
}

async function openDestination(page: Page, destination: string) {
  await page.locator(".mobile-bottom-nav").getByRole("button", { name: "Workspace" }).click();
  await page.locator(`[data-workspace-destination='${destination}']`).click();
}

async function sizes(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { width: Math.round(box.width), height: Math.round(box.height) };
  }));
}

test("a Workforce draft restores attendance and counts only the crew on site", async ({ page }) => {
  await signIn(page);
  await page.locator(".sidebar:visible, .mobile-bottom-nav:visible").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator('[data-workspace-destination="workforce"]').click();
  const total = page.locator(".workforce-headline strong");
  const baseline = Number(await total.textContent());
  const crew = `Attendance check ${Date.now()}`;
  await page.getByLabel("Crew · optional").fill(crew);
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  const status = page.locator(".workforce-row", { hasText: crew }).getByLabel(/^Attendance status of/);
  await expect(total).toHaveText(String(baseline + 1));
  for (const offSite of ["Absent", "On Leave", "Off Shift", "Demobilized"]) {
    await status.selectOption(offSite);
    await expect(total).toHaveText(String(baseline));
  }
  await status.selectOption("Late");
  await expect(total).toHaveText(String(baseline + 1));
  await status.selectOption("Absent");
  await expect(total).toHaveText(String(baseline));
  await expect.poll(() => page.evaluate((value) => new Promise<boolean>((resolve) => {
    const request = indexedDB.open("codeco-field-v1");
    request.onerror = () => resolve(false);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("drafts")) { db.close(); resolve(false); return; }
      const draft = db.transaction("drafts").objectStore("drafts").getAll();
      draft.onsuccess = () => {
        resolve(JSON.stringify(draft.result).includes(value));
        db.close();
      };
      draft.onerror = () => { resolve(false); db.close(); };
    };
  }), crew)).toBe(true);
  await page.reload();
  await expect(status).toHaveValue("Absent");
  await expect(total).toHaveText(String(baseline));
});

test("the register steppers, remove buttons and sync chip are 44 px on a phone and a tablet", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop-office", "Touch targets are a rule up to 1024 px.");
  test.setTimeout(90_000);

  await signIn(page);
  await openDestination(page, "workforce");
  await page.getByRole("button", { name: "Add person" }).first().click();
  await expect(page.locator(".workforce-row").first()).toBeVisible();
  for (const selector of [".workforce-row .counter-control button", ".workforce-row-remove", ".workforce-shift select"]) {
    const found = await sizes(page, selector);
    expect(found.length, `${selector} exists`).toBeGreaterThan(0);
    for (const size of found) {
      expect(size.height, `${selector} height`).toBeGreaterThanOrEqual(44);
      expect(size.width, `${selector} width`).toBeGreaterThanOrEqual(44);
    }
  }

  await openDestination(page, "materials-delivery");
  // The Materials Delivery sheet (PR #22) records one material per row; the multi-line remove
  // button only exists on the older line-based registers. When it is there, it is a thumb target.
  const lineRemove = await sizes(page, ".register-line-remove");
  for (const size of lineRemove) {
    expect(size.height).toBeGreaterThanOrEqual(44);
    expect(size.width).toBeGreaterThanOrEqual(44);
  }

  await openDestination(page, "issues");
  for (const size of await sizes(page, ".record-sync-chip")) expect(size.height, "sync chip height").toBeGreaterThanOrEqual(44);
});
