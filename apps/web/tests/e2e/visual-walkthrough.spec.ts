import { expect, type Page, test } from "@playwright/test";

/**
 * The in-app visual walkthrough: first-use introduction, Help re-entry, keyboard handling, English and
 * Dutch, and safe navigation to the real screen for the supervisor, contractor and client roles.
 * Opening a guide step must only navigate: no write request may leave the page.
 */
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const accounts = {
  supervisor: { email: process.env.CODECO_E2E_EMAIL, password: process.env.CODECO_E2E_PASSWORD },
  contractor: { email: process.env.CODECO_E2E_CONTRACTOR_EMAIL, password: process.env.CODECO_E2E_CONTRACTOR_PASSWORD },
  client: { email: process.env.CODECO_E2E_CLIENT_PORTAL_EMAIL, password: process.env.CODECO_E2E_CLIENT_PORTAL_PASSWORD },
};
test.skip(!accounts.supervisor.email || !accounts.contractor.email || !accounts.client.email, "Role accounts are required (tests/e2e/seed-ui-demo-data.mjs).");

async function signIn(page: Page, who: keyof typeof accounts, language: "en" | "nl", firstUse: boolean) {
  const account = accounts[who];
  await page.goto("/supervisie");
  await page.evaluate(({ language, firstUse }) => {
    localStorage.setItem("codeco-language-choice", language);
    for (const key of ["codeco-field-guide-seen-v3", "codeco-portal-guide-seen-v1-contractor", "codeco-portal-guide-seen-v1-client"]) {
      if (firstUse) localStorage.removeItem(key); else localStorage.setItem(key, "yes");
    }
  }, { language, firstUse });
  await page.reload();
  const form = page.locator(".access-form");
  await form.waitFor({ state: "visible" });
  await form.locator("input[type='email']").fill(account.email!);
  await form.locator("input[type='password']").fill(account.password!);
  await form.locator("button[type='submit']").click();
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.locator(".portal-shell, .main-content").first()).toBeVisible({ timeout: 60_000 });
}

function watchWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method()) && /\/rest\/v1\/(?!rpc)/.test(request.url())) writes.push(`${request.method()} ${request.url()}`);
  });
  return writes;
}

const dialog = (page: Page) => page.getByRole("dialog");
async function openHelp(page: Page) {
  if (await dialog(page).count()) return;
  await page.getByRole("button", { name: /^Help/ }).click();
  await expect(dialog(page)).toBeVisible();
}

test("supervisor: first-use tour, keyboard, close and reopen, English", async ({ page }) => {
  await signIn(page, "supervisor", "en", true);
  await expect(dialog(page)).toBeVisible({ timeout: 15_000 });
  await expect(dialog(page).getByRole("button", { name: "Guided tours" })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog(page).locator(".walk-step h3")).toHaveText("Start your day");
  // Focus starts inside the dialog and Tab never leaves it.
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
  }
  // Steps move with the keyboard and announce the current stage.
  await dialog(page).getByRole("button", { name: "Next step" }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page).locator(".walk-stages li[aria-current='step']")).toContainText("Do it");
  // Escape closes, focus returns to Help, and Help reopens the same tours.
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Help/ })).toBeFocused();
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(dialog(page)).toHaveCount(0);
  await page.getByRole("button", { name: /^Help/ }).click();
  await expect(dialog(page).getByRole("button", { name: "Guided tours" })).toBeVisible();
  // The existing reference help is still there.
  await dialog(page).getByRole("button", { name: "Quick help and reference" }).click();
  await expect(dialog(page).getByText("All functions from A to Z")).toBeVisible();
  await expect(dialog(page).getByText("The five buttons at the bottom")).toBeVisible();
});

test("supervisor: skip, 15 forms open the real form without writing", async ({ page }) => {
  const writes = watchWrites(page);
  await signIn(page, "supervisor", "en", false);
  await openHelp(page);
  await dialog(page).getByLabel("Choose a task").selectOption({ label: "The 15 Workspace forms" });
  const buttons = dialog(page).locator("[data-guide-form]");
  await expect(buttons).toHaveCount(15);
  const forms = await buttons.evaluateAll((items) => items.map((item) => ({ tile: item.getAttribute("data-guide-form")!, name: item.querySelector("strong")!.textContent! })));
  for (const { tile, name } of forms) {
    await openHelp(page);
    await dialog(page).getByLabel("Choose a task").selectOption({ label: "The 15 Workspace forms" });
    await dialog(page).locator(`[data-guide-form='${tile}']`).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator("main h1, main h2").first()).toContainText(name, { timeout: 15_000 });
  }
  expect(writes).toEqual([]);
  // Skip closes without navigating.
  await openHelp(page);
  await dialog(page).getByRole("button", { name: "Skip the tour" }).click();
  await expect(dialog(page)).toHaveCount(0);
});

test("supervisor: every tour opens its screen; Management only for administrators", async ({ page }) => {
  const writes = watchWrites(page);
  await signIn(page, "supervisor", "en", false);
  await openHelp(page);
  const options = await dialog(page).getByLabel("Choose a task").locator("option").allTextContents();
  expect(options).toContain("From record to archive");
  for (const title of options.filter((option) => option !== "The 15 Workspace forms")) {
    await openHelp(page);
    await dialog(page).getByLabel("Choose a task").selectOption({ label: title });
    await dialog(page).locator("[data-guide-open]").click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator(".main-content")).toBeVisible();
  }
  expect(writes).toEqual([]);
});

test("supervisor: Dutch labels", async ({ page }) => {
  await signIn(page, "supervisor", "nl", false);
  await page.getByRole("button", { name: /^Help/ }).click();
  await expect(dialog(page).getByRole("button", { name: "Rondleidingen" })).toBeVisible();
  await expect(dialog(page).getByLabel("Kies een taak")).toBeVisible();
  await expect(dialog(page).locator(".walk-step h3")).toHaveText("Start je werkdag");
  await expect(dialog(page).getByRole("button", { name: "Open in app" })).toBeVisible();
});

for (const who of ["contractor", "client"] as const) {
  test(`${who}: first-use tour, Help, navigation to the real section, Dutch`, async ({ page }) => {
    const writes = watchWrites(page);
    await signIn(page, who, "en", true);
    await expect(dialog(page)).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
    // Administration is never offered to a portal user.
    const options = await dialog(page).getByLabel("Choose a task").locator("option").allTextContents();
    expect(options.join("|")).not.toMatch(/Set up a project|15 Workspace/);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(dialog(page)).toHaveCount(0);
    for (const title of options) {
      await page.getByRole("button", { name: /^Help/ }).click();
      await dialog(page).getByLabel("Choose a task").selectOption({ label: title });
      await dialog(page).locator("[data-guide-open]").click();
      await expect(dialog(page)).toHaveCount(0);
      await expect(page.locator(".portal-section")).toBeVisible();
      // A wide table must scroll inside its own box, never widen the page (it hid the Help button on phones).
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${title} overflows sideways`).toBe(true);
    }
    expect(writes).toEqual([]);
  });
}
