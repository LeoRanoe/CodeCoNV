import { expect, type Page, test } from "@playwright/test";

/**
 * QA sweep L32. A module with records showed its list and then fell back to "Loading project
 * records…" a moment later, because the day report arrived after the first render and changed the
 * query key. Once the records are on the screen, the loading line may not come back.
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
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
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

test("the records stay on the screen once they have appeared", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The loading order does not depend on the viewport.");
  await signIn(page);
  const project = new URL(page.url()).searchParams.get("project");
  await page.addInitScript(() => {
    const states: string[] = [];
    (window as unknown as { __recordStates: string[] }).__recordStates = states;
    const sample = () => {
      const loading = Boolean(document.querySelector(".operation-loading"));
      const content = Boolean(document.querySelector(".record-form-shell, .secondary-header, .workspace-header"));
      const state = loading ? "loading" : content ? "content" : "empty";
      if (states[states.length - 1] !== state) states.push(state);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto(`/supervisie?project=${project}&nav=project&tab=registers`);
  await expect(page.locator("main")).toBeVisible();
  await page.waitForTimeout(4000);
  const states = await page.evaluate(() => (window as unknown as { __recordStates: string[] }).__recordStates);
  const firstContent = states.indexOf("content");
  expect(firstContent, JSON.stringify(states)).toBeGreaterThanOrEqual(0);
  expect(states.slice(firstContent), JSON.stringify(states)).not.toContain("loading");
});
