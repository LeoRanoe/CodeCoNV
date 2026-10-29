import { expect, type Page, test } from "@playwright/test";

/**
 * QA sweep M24. At 400% zoom a 1280 px window is 320 CSS px wide. Middelen and Management ran
 * past the edge there (349 px and 412 px), so a reader had to scroll sideways to reach buttons.
 * Nothing on these screens may be wider than the viewport.
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

/** The widest thing on the page that sticks out past the right edge, for the failure message. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const wide: string[] = [];
    for (const element of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const box = element.getBoundingClientRect();
      if (box.width > 0 && box.right > limit + 1 && getComputedStyle(element).position !== "fixed") {
        wide.push(`${element.tagName.toLowerCase()}.${String(element.className).split(" ")[0]} ${Math.round(box.right)}px`);
      }
    }
    // The chain above the first wide element shows which container is not shrinking.
    const first = Array.from(document.body.querySelectorAll<HTMLElement>("*")).find((element) => element.getBoundingClientRect().right > limit + 1 && getComputedStyle(element).position !== "fixed");
    const chain: string[] = [];
    for (let node: HTMLElement | null = first ?? null; node && node !== document.body; node = node.parentElement) {
      const box = node.getBoundingClientRect();
      chain.push(`${node.tagName.toLowerCase()}.${String(node.className).split(" ")[0]}[${Math.round(box.left)}-${Math.round(box.right)}|${getComputedStyle(node).display}]`);
    }
    return { scrollWidth: document.documentElement.scrollWidth, limit, wide: [...wide.slice(0, 3), ...chain.slice(0, 8)] };
  });
}

test("the main screens fit a 320 px wide window", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The width is set by the test.");
  test.setTimeout(180_000);
  await signIn(page);
  const project = new URL(page.url()).searchParams.get("project");
  await page.setViewportSize({ width: 320, height: 700 });
  const screens = ["nav=project&tab=assets", "nav=meer", "nav=vandaag", "nav=project", "nav=project&tab=findings", "nav=project&tab=ncr", "nav=project&tab=hse", "nav=project&tab=inspections", "nav=project&tab=registers", "nav=project&tab=documents", "nav=project&tab=files", "nav=project&tab=drawings", "nav=acties", "nav=rapporten"];
  const failures: string[] = [];
  for (const address of screens.map((screen) => `/supervisie?project=${project}&${screen}`)) {
    await page.goto(address);
    await expect(page.locator("main")).toBeVisible();
    await page.waitForTimeout(1200);
    const measured = await overflow(page);
    if (measured.scrollWidth > measured.limit) failures.push(`${address.split("&").slice(1).join("&")}: ${measured.scrollWidth}px ${JSON.stringify(measured.wide)}`);
  }
  expect(failures).toEqual([]);
});
