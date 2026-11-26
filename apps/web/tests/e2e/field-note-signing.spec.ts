import { expect, type Page, test } from "@playwright/test";
import { finishSigning } from "./sign-popup";

/**
 * Developer package v5: saving a field note opens the signing popup. A note's signature is optional, so the popup also
 * offers to save without one; signing stores the signature on the note.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

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
  const project = new URL(page.url()).searchParams.get("project");
  await page.goto(`/supervisie?project=${project}&nav=project&tab=tools`);
  await expect(page.locator(".field-tools-grid")).toBeVisible();
}

test("saving a field note opens the signing popup; the note can be signed or saved without a signature", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "desktop route");
  await signIn(page);
  const card = page.locator(".note-tool-card");
  // No inline signature field any more: the signature is asked for in the popup.
  await expect(card.getByRole("button", { name: "Sign now" })).toHaveCount(0);

  const first = `Signed note ${Date.now()}`;
  await card.getByLabel(/^Title|Subject/i).first().fill(first);
  await card.locator("textarea").first().fill("Concrete pour inspected, no issues.");
  await card.getByRole("button", { name: "Save note" }).click();
  await expect(page.locator(".signature-modal")).toBeVisible();
  await expect(page.locator(".signature-modal").getByRole("button", { name: "Submit without signature" })).toBeVisible();
  await finishSigning(page, { skip: false });
  await expect(page.getByText("Field note saved.")).toBeVisible({ timeout: 30_000 });

  // The form clears itself once the note is stored; the next note is typed into the empty form.
  const title = card.getByLabel(/^Title|Subject/i).first();
  await expect(title).toHaveValue("");
  const second = `Unsigned note ${Date.now()}`;
  await title.fill(second);
  await card.locator("textarea").first().fill("Second note without a signature.");
  await card.getByRole("button", { name: "Save note" }).click();
  await finishSigning(page, { skip: true });
  await expect(page.getByText("Field note saved.")).toBeVisible({ timeout: 30_000 });
});
