import { type Page } from "@playwright/test";

/**
 * Submitting a form that has a signature field opens the signing popup first (developer package v5).
 * Call this right after pressing the submit button: it signs, or skips an optional signature, and
 * returns once the popup is gone. When the form has no signature field nothing opens and it returns.
 */
export async function finishSigning(page: Page, options: { skip?: boolean } = {}) {
  const dialog = page.locator(".signature-modal");
  const outcome = page.locator(".operation-alert.success, .operation-alert.error, .field-error");
  await Promise.race([
    dialog.waitFor({ state: "visible", timeout: 6_000 }).catch(() => undefined),
    outcome.first().waitFor({ state: "visible", timeout: 6_000 }).catch(() => undefined),
  ]);
  if (!(await dialog.isVisible().catch(() => false))) return;
  const skip = dialog.getByRole("button", { name: "Submit without signature" });
  if (options.skip !== false && (await skip.count())) {
    await skip.click();
  } else {
    const canvas = dialog.locator("canvas.signature-canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("The signature field has no size");
    await page.mouse.move(box.x + 30, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3, { steps: 8 });
    await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    const name = dialog.getByRole("textbox").first();
    if (!(await name.inputValue())) await name.fill("E2E Supervisor");
    await dialog.getByRole("button", { name: /Sign & submit|Sign/ }).last().click();
  }
  await dialog.waitFor({ state: "hidden", timeout: 15_000 });
}
