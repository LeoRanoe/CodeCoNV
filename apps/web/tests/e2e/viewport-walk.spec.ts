import { expect, type Page, test } from "@playwright/test";

/**
 * Every main module of the signed-in app at every width the client uses, with real project
 * data on screen. The rule that is checked is the one a user notices first: the page itself
 * never scrolls sideways, and no control is pushed out of the viewport.
 *
 * Browser zoom is a narrower viewport in CSS pixels, so 125 % and 150 % on a 1280 px laptop
 * are walked as 1024 px and 853 px.
 *
 * Runs against the local fixture stack (tests/e2e/seed-local-fixtures.mjs).
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";

if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the release gate.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

const viewports = [
  { name: "phone 360", width: 360, height: 800 },
  { name: "phone 390", width: 390, height: 844 },
  { name: "phone 430", width: 430, height: 932 },
  { name: "tablet portrait 820", width: 820, height: 1180 },
  { name: "laptop at 150% zoom (853)", width: 853, height: 533 },
  { name: "tablet landscape 1024", width: 1024, height: 768 },
  { name: "laptop at 125% zoom (1024x640)", width: 1024, height: 640 },
  { name: "desktop 1280", width: 1280, height: 800 },
  { name: "desktop 1440", width: 1440, height: 900 },
  { name: "desktop 1920", width: 1920, height: 1080 },
];

const moduleNames = ["Overview", "Workspace", "Actions", "Project Docs", "Issues", "Rapid Verify", "Reports", "Management"];

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

/** What sticks out of the viewport, by how much, and what it is. */
function measure(page: Page) {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewport;
    const offenders: string[] = [];
    if (overflow > 1) {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        const box = element.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        if (box.right > viewport + 1 && getComputedStyle(element).position !== "fixed") {
          // Something inside its own horizontal scroller is allowed to be wider than the page.
          let scroller = element.parentElement;
          let insideScroller = false;
          while (scroller && scroller !== document.body) {
            const style = getComputedStyle(scroller);
            if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { insideScroller = true; break; }
            scroller = scroller.parentElement;
          }
          if (!insideScroller) offenders.push(`${element.tagName.toLowerCase()}.${String(element.className).split(" ")[0]} right=${Math.round(box.right)}`);
        }
        if (offenders.length >= 5) break;
      }
    }
    return { viewport, overflow, offenders };
  });
}

test("no module scrolls sideways at any supported width or zoom", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "This test sets its own viewports.");
  test.setTimeout(420_000);
  await signIn(page);

  // Collect the address of every module once, through the navigation a user clicks.
  const addresses: Array<{ module: string; search: string }> = [];
  for (const name of moduleNames) {
    await page.locator(".sidebar").getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(600);
    addresses.push({ module: name, search: new URL(page.url()).search });
  }
  expect(new Set(addresses.map((address) => address.search)).size, "every module has its own address").toBe(moduleNames.length);

  const problems: string[] = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const address of addresses) {
      await page.goto(`/supervisie${address.search}`, { waitUntil: "domcontentloaded" });
      // The deep link restores the module; wait until project content is on screen.
      // The app keeps live connections open, so "network idle" never comes; wait for the
      // signed-in screen with content instead.
      await page.waitForFunction(
        () => !document.querySelector(".access-form") && (document.querySelector("main")?.textContent?.length ?? 0) > 200,
        null,
        { timeout: 20_000 },
      );
      await page.waitForTimeout(350);
      const seen = await measure(page);
      if (seen.overflow > 1) {
        problems.push(`${viewport.name} · ${address.module}: page is ${seen.overflow}px wider than the viewport (${seen.offenders.join("; ") || "no single offender"})`);
      }
    }
  }
  expect(problems, problems.join("\n")).toEqual([]);
});
