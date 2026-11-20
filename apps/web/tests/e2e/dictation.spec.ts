import { expect, type Page, test } from "@playwright/test";

/**
 * Client feedback of 20-11-2026: every field that is typed freely can be dictated, in Dutch and
 * English. A field without its own microphone gets one while it has the focus; the words land in
 * the field as if they were typed, and the focus stays there.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

async function signIn(page: Page) {
  // A stand-in for the browser's recognition that "hears" a mixed Dutch and English phrase.
  await page.addInitScript(() => {
    class FakeRecognition {
      continuous = false; interimResults = false; lang = "";
      onresult: ((event: unknown) => void) | null = null; onerror: (() => void) | null = null; onend: (() => void) | null = null;
      start() { setTimeout(() => { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "bekisting klaar, formwork ready" }], { isFinal: true })] }); this.onend?.(); }, 50); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
  });
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  await page.locator(".access-form, .project-selection-grid").first().waitFor({ state: "visible" });
  // Sign-in fields are never dictated.
  const form = page.locator(".access-form");
  if (await form.isVisible().catch(() => false)) {
    await form.locator("input[type='email']").focus();
    await expect(page.locator(".dictation-layer")).toHaveCount(0);
    await form.locator("input[type='email']").fill(email!);
    await form.locator("input[type='password']").fill(password!);
    await form.locator("button[type='submit']").click();
  }
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
}

test("a free-text field without its own microphone can be dictated", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page);
  await page.locator(".sidebar").getByRole("button", { name: "Workspace", exact: true }).click();
  await page.locator("[data-workspace-destination='hse']").click();
  const field = page.getByRole("textbox", { name: "Name of the responsible person" });
  await field.scrollIntoViewIfNeeded();
  await field.click();
  const microphone = page.locator(".dictation-layer").getByRole("button", { name: "Dictate (Dutch or English)" });
  await expect(microphone).toBeVisible();
  await microphone.click();
  await expect(field).toHaveValue(/bekisting klaar, formwork ready/);
  await expect(field).toBeFocused();
  // The microphone leaves with the focus.
  await page.locator("main h1, main h2").first().click();
  await expect(page.locator(".dictation-layer")).toHaveCount(0);
});
