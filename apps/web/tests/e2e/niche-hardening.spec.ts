import { expect, test, type Page } from "@playwright/test";

const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
test.skip(!email || !password, "Local fixture credentials required.");

async function open(page: Page, nav: string, tab?: string) {
  await page.addInitScript(() => {
    localStorage.setItem("codeco-language-choice", "en");
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
  });
  await page.goto("/supervisie");
  await page.locator(".access-form input[type=email]").fill(email!);
  await page.locator(".access-form input[type=password]").fill(password!);
  await page.locator(".access-form button[type=submit]").click();
  await page.getByRole("button", { name: /E2E-001/ }).click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
  const url = new URL(page.url());
  url.searchParams.set("nav", nav);
  if (tab) url.searchParams.set("tab", tab);
  await page.goto(url.href);
}

function pdf(text: string) {
  const stream = `BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(output.length); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = output.length;
  output += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}

test("Rapid Verify keeps successful sources, extracts real PDF pages and invalidates stale evidence", async ({ page }, info) => {
  if (info.project.name === "desktop-office") await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "verify");
  await expect(page.getByRole("heading", { name: "Rapid Verify", exact: true })).toBeVisible();
  const input = page.locator("input[type=file][multiple]");
  await input.setInputFiles([
    { name: "requirements.pdf", mimeType: "application/pdf", buffer: pdf("Concrete strength C35 for shear wall.") },
    { name: "same-name.txt", mimeType: "text/plain", buffer: Buffer.from("Café anchors require stainless steel grade A4.") },
    { name: "same-name.txt", mimeType: "text/plain", buffer: Buffer.from("Concrete cover shall be 40 mm.") },
    { name: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a PDF") },
  ]);
  await expect(page.locator(".rapid-source-list article")).toHaveCount(3);
  await expect(page.locator(".operation-alert.error")).toContainText("broken.pdf");
  const query = page.locator(".rapid-query-field textarea");
  await query.fill("concrete strength");
  await page.getByRole("button", { name: "Find answer in sources" }).click();
  await expect(page.locator(".rapid-results")).toContainText("C35");
  await expect(page.locator(".rapid-results")).toContainText("requirements.pdf · page 1");
  await query.fill("cafe anchors");
  await expect(page.locator(".rapid-results article")).toHaveCount(0);
  await page.getByRole("button", { name: "Find answer in sources" }).click();
  await expect(page.locator(".rapid-results")).toContainText("Café anchors");
  await page.getByRole("button", { name: "Remove same-name.txt" }).first().click();
  await expect(page.locator(".rapid-results article")).toHaveCount(0);
  await page.getByRole("button", { name: "Find answer in sources" }).click();
  await expect(page.locator(".rapid-conclusion")).toContainText("Insufficient evidence");
  await page.getByRole("tab", { name: "Compare specification" }).click();
  await query.fill("concrete cover 40 mm");
  await page.getByRole("button", { name: "Verify against sources" }).click();
  await expect(page.locator(".rapid-results")).toContainText("40 mm");
  await page.screenshot({ path: info.outputPath("rapid-verify.png"), fullPage: true });
  await page.reload();
  await expect(page.locator(".rapid-source-list article")).toHaveCount(0);
});

test("Dictation appends final results, preserves typed text on failure and aborts on leaving", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { starts: 0, aborts: 0, instance: null as unknown };
    class Recognition {
      onresult: ((event: unknown) => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;
      start() { state.starts += 1; state.instance = this; }
      stop() { this.onend?.(); }
      abort() { state.aborts += 1; }
    }
    Object.assign(window, { SpeechRecognition: Recognition, testSpeech: state });
  });
  await open(page, "verify");
  const query = page.locator(".rapid-query-field textarea");
  await query.fill("Typed field");
  await page.getByRole("button", { name: "Dictate", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop dictation" })).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => {
    const state = (window as unknown as { testSpeech: { instance: { onresult: (event: unknown) => void } } }).testSpeech;
    state.instance.onresult({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: "ignored" } }, { isFinal: true, 0: { transcript: "final words" } }] });
  });
  await expect(query).toHaveValue("Typed field final words");
  await page.evaluate(() => (window as unknown as { testSpeech: { instance: { onerror: () => void } } }).testSpeech.instance.onerror());
  await expect(query).toHaveValue("Typed field final words");
  await expect(page.getByRole("button", { name: "Dictate", exact: true })).toHaveAttribute("title", /unavailable/);
  await page.getByRole("button", { name: "Dictate", exact: true }).click();
  await page.getByRole("tab", { name: "Compare specification" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { testSpeech: { aborts: number } }).testSpeech.aborts)).toBeGreaterThan(0);
});


test("Two agreement signatures survive resize, save, refresh and correction", async ({ page }, info) => {
  if (info.project.name === "desktop-office") await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "project", "tools");
  await expect(page.locator(".field-tools-grid")).toBeVisible();
  await page.getByRole("combobox", { name: "Record type", exact: true }).selectOption("agreement");
  const title = `LOCAL QA agreement ${info.project.name} ${Date.now()}`;
  await page.getByLabel("Agreement subject", { exact: true }).fill(title);
  await page.locator(".note-tool-card textarea").fill("Synthetic test agreement. No real commitment.");
  await page.getByRole("combobox", { name: "Agreement between", exact: true }).selectOption({ index: 1 });
  await page.getByRole("combobox", { name: "and", exact: true }).selectOption({ index: 1 });
  for (const [index, name] of ["QA First", "QA Second"].entries()) {
    await page.locator(".agreement-signature-column").nth(index).getByRole("button", { name: "Sign now" }).click();
    const dialog = page.locator(".signature-modal");
    await dialog.getByLabel("Name of the signatory").fill(name);
    await expect(dialog.getByRole("button", { name: "Sign the document" })).toBeDisabled();
    const canvas = dialog.locator("canvas");
    const bounds = (await canvas.boundingBox())!;
    await page.mouse.move(bounds.x + 20, bounds.y + 40);
    await page.mouse.down();
    await page.mouse.move(bounds.x + Math.min(180, bounds.width - 20), bounds.y + 80, { steps: 12 });
    await page.mouse.up();
    const old = page.viewportSize()!;
    await page.setViewportSize({ width: old.width === 390 ? 820 : 390, height: 900 });
    await expect.poll(() => canvas.evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 150 && pixels[i+1] < 150 && pixels[i+2] < 150) ink += 1;
      return ink;
    })).toBeGreaterThan(20);
    await dialog.getByRole("button", { name: "Sign the document" }).click();
    await page.setViewportSize(old);
  }
  await expect(page.locator(".agreement-signatures img")).toHaveCount(2);
  const before = await page.locator(".agreement-signatures img").evaluateAll((images) => images.map((image) => image.getAttribute("src")));
  await page.getByRole("button", { name: "Save agreement", exact: true }).click();
  const saved = page.locator(".saved-notes-card article").filter({ hasText: title });
  await expect(saved).toBeVisible();
  await page.reload();
  await page.locator(".saved-notes-card article").filter({ hasText: title }).getByRole("button", { name: "Open and edit" }).click();
  await expect(page.locator(".agreement-signatures img")).toHaveCount(2);
  expect(await page.locator(".agreement-signatures img").evaluateAll((images) => images.map((image) => image.getAttribute("src")))).toEqual(before);
  await expect(page.getByRole("combobox", { name: "Record type", exact: true })).toBeDisabled();
  await page.locator(".note-tool-card textarea").fill("Synthetic correction only. Signers remain separate.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.reload();
  await page.locator(".saved-notes-card article").filter({ hasText: title }).getByRole("button", { name: "Open and edit" }).click();
  expect(await page.locator(".agreement-signatures img").evaluateAll((images) => images.map((image) => image.getAttribute("src")))).toEqual(before);
  await page.screenshot({ path: info.outputPath("agreement-signatures.png"), fullPage: true });
});
