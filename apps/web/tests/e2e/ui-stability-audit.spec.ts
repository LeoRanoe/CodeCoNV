import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

/**
 * Walks every module and every workspace destination at phone, tablet and desktop width and records what makes a screen
 * feel unstable: content that jumps after it has first been drawn (layout shift), sideways scrolling, text cut off by its
 * own box, controls on top of each other, targets too small for a thumb, and fixed bars that cover the last control.
 * The findings are written to test-results/ui-stability/findings.json (ONLY="Overview,Issues" narrows the walk, SHOTS=1
 * adds a full-page screenshot per screen). The test fails on any finding or on a layout shift above 0.05, so a regression
 * shows up the day it is made.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
if (process.env.CODECO_E2E_REQUIRED === "1" && !(email && password)) {
  throw new Error("CODECO_E2E_EMAIL and CODECO_E2E_PASSWORD are required for the UI stability audit.");
}
test.skip(!email || !password, "A fixture account is required (tests/e2e/seed-local-fixtures.mjs).");

const viewports = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;
const modules = ["Overview", "Workspace", "Actions", "Rapid Verify", "Reports", "Management"] as const;
const tiles = [
  "Photos", "Works ongoing", "Works completed", "Workforce", "Project Delay Report", "Issues", "HSE", "Materials delivery",
  "Inspections", "Technical instructions", "Change order", "NCR", "Lessons Learned", "HSE incident", "Agreements Made",
  "Project Docs", "Assets & folders", "Drawings & pins",
] as const;

type Finding = { kind: string; detail: string };

const measure = (page: Page, touch: boolean) => page.evaluate((touchScreen) => {
  const found: Array<{ kind: string; detail: string }> = [];
  const label = (element: Element) => {
    const html = element as HTMLElement;
    const name = (html.getAttribute("aria-label") || html.innerText || html.getAttribute("title") || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return `${element.tagName.toLowerCase()}${html.className && typeof html.className === "string" ? `.${html.className.trim().split(/\s+/)[0]}` : ""} "${name}"`;
  };
  const visible = (element: Element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0;
  };
  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    found.push({ kind: "sideways-scroll", detail: `${document.documentElement.scrollWidth}px wide in a ${window.innerWidth}px window` });
  }
  // Text cut off by its own box. An ellipsis or a line clamp is a decision, a plain clip is not.
  for (const element of Array.from(document.querySelectorAll<HTMLElement>("main *, .sidebar *, .topbar *"))) {
    if (!visible(element) || !element.childNodes.length) continue;
    const style = getComputedStyle(element);
    const clips = style.overflowX === "hidden" || style.overflowX === "clip";
    if (!clips || style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none" || element.classList.contains("sr-only") || element.classList.contains("record-severity")) continue;
    // A 1 px box is the visually-hidden pattern for screen readers.
    if (element.getBoundingClientRect().width <= 2) continue;
    if (element.scrollWidth > element.clientWidth + 2 && element.textContent && element.textContent.trim().length) {
      const edge = element.getBoundingClientRect().right;
      const wide = Array.from(element.querySelectorAll<HTMLElement>("*")).find((child) => child.getBoundingClientRect().right > edge + 1 && child.getBoundingClientRect().width > 2);
      found.push({ kind: "clipped-text", detail: `${label(element)} ${element.scrollWidth}>${element.clientWidth}${wide ? ` because of ${label(wide)}` : ""}` });
    }
  }
  const all = Array.from(document.querySelectorAll<HTMLElement>("button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]"))
    .filter((element) => visible(element) && !element.closest("[aria-hidden=true]") && !element.closest("nextjs-portal") && !element.closest("details:not([open])"));
  // Fixed and sticky bars sit over whatever scrolls under them; that is what they are for.
  const isFixed = (element: HTMLElement) => { for (let node: HTMLElement | null = element; node; node = node.parentElement) { const position = getComputedStyle(node).position; if (position === "fixed" || position === "sticky") return true; } return false; };
  const interactive = all.filter((element) => !isFixed(element));
  // Controls on top of each other: two boxes that overlap by a real amount and are not nested.
  const boxes = interactive.map((element) => ({ element, rect: element.getBoundingClientRect() }));
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]; const b = boxes[j];
      if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
      const width = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
      const height = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
      if (width <= 2 || height <= 2) continue;
      const smaller = Math.min(a.rect.width * a.rect.height, b.rect.width * b.rect.height);
      if ((width * height) / smaller < 0.25) continue;
      // The tick that selects a photo is drawn on its thumbnail on purpose.
      if ((a.element.classList.contains("media-card-open") || b.element.classList.contains("media-card-open")) && (a.element instanceof HTMLInputElement || b.element instanceof HTMLInputElement)) continue;
      // A checkbox drawn inside its own label is one control.
      if (a.element.closest("label") && a.element.closest("label") === b.element.closest("label")) continue;
      found.push({ kind: "controls-overlap", detail: `${label(a.element)} over ${label(b.element)} (${Math.round(width)}x${Math.round(height)})` });
    }
  }
  // Targets too small for a thumb or a pointer.
  const minimum = touchScreen ? 44 : 32;
  for (const { element, rect } of boxes) {
    if (element instanceof HTMLInputElement && element.closest("label") && element.closest("label")!.getBoundingClientRect().height >= minimum) continue;
    if (element.classList.contains("record-severity")) continue;
    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      const target = element.closest("label") ?? element;
      const targetRect = target.getBoundingClientRect();
      if (targetRect.height < minimum - 4) found.push({ kind: "small-target", detail: `${label(element)} ${Math.round(targetRect.width)}x${Math.round(targetRect.height)}` });
      continue;
    }
    if (element.closest("p, li, td, span")?.contains(element) && element.tagName === "A" && element.closest("p")) continue;
    if (rect.height < minimum || rect.width < minimum - 8) {
      found.push({ kind: "small-target", detail: `${label(element)} ${Math.round(rect.width)}x${Math.round(rect.height)}` });
    }
  }
  // A fixed bar must not cover the last control once the page is scrolled to the end.
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
  const fixed = Array.from(document.querySelectorAll<HTMLElement>("body *")).filter((element) => getComputedStyle(element).position === "fixed" && visible(element) && !element.closest("nextjs-portal") && !element.closest("[role=dialog], [role=alertdialog]") && !element.classList.contains("skip-link"));
  for (const bar of fixed) {
    const barRect = bar.getBoundingClientRect();
    const covered = interactive.filter((element) => !bar.contains(element) && getComputedStyle(element).position !== "fixed" && element.getBoundingClientRect().bottom > barRect.top && element.getBoundingClientRect().top < barRect.bottom && element.getBoundingClientRect().right > barRect.left && element.getBoundingClientRect().left < barRect.right);
    for (const element of covered) found.push({ kind: "covered-by-fixed", detail: `${label(element)} under ${label(bar)}` });
  }
  window.scrollTo({ top: 0, behavior: "instant" });
  document.documentElement.style.scrollBehavior = "";
  return found;
}, touch);

async function signIn(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number; __shifts: string[] };
    w.__cls = 0;
    w.__shifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean; sources?: Array<{ node?: Element; previousRect: DOMRect; currentRect: DOMRect }> }>) {
        if (entry.hadRecentInput) continue;
        w.__cls += entry.value;
        const source = entry.sources?.[0];
        const node = source?.node as HTMLElement | undefined;
        const box = (rect: DOMRect) => `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
        if (node && source && entry.value > 0.005) w.__shifts.push(`${entry.value.toFixed(3)} ${node.tagName.toLowerCase()}.${String(node.className).split(" ")[0]} [${box(source.previousRect)} -> ${box(source.currentRect)}]`);
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  // The weather chip is on every screen; 72 screens would use up the weather limit of the specs that run after this one.
  await page.route("**/api/weather/current*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      condition: "clear", temperatureC: 29, apparentTemperatureC: 32, windCondition: "calm", windSpeedKph: 12, windGustKph: 18, precipitationMm: 0,
      relativeHumidityPercent: 80, weatherCode: 0, observedAt: new Date().toISOString(), resolvedLocation: "Paramaribo, Suriname", latitude: 5.85, longitude: -55.2, source: "Open-Meteo",
    }),
  }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/supervisie");
  await page.evaluate(() => {
    localStorage.setItem("codeco-field-guide-seen-v3", "yes");
    localStorage.setItem("codeco-language-choice", "en");
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  const form = page.locator(".access-form");
  await expect(form).toBeVisible();
  await form.locator("input[type='email']").fill(email!);
  await form.locator("input[type='password']").fill(password!);
  await form.locator("button[type='submit']").click();
  await expect(page.locator(".project-selection-grid")).toBeVisible();
  await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole("region", { name: "Project command center" })).toBeVisible();
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}

test("every screen holds still and nothing sits on top of anything else", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "This test sets all three widths itself.");
  test.setTimeout(900_000);
  await signIn(page);

  const addresses: Array<{ name: string; search: string }> = [];
  for (const name of modules) {
    const button = page.locator(".sidebar").getByRole("button", { name, exact: true });
    await button.click();
    await expect(button).toHaveClass(/active/);
    await page.waitForTimeout(400);
    addresses.push({ name, search: new URL(page.url()).search });
  }
  const workspace = addresses.find(({ name }) => name === "Workspace")!.search;

  const report: Record<string, Finding[]> = {};
  const shift: Record<string, number> = {};
  const shiftSources: Record<string, string[]> = {};
  const consoleByScreen: Record<string, string[]> = {};
  const only = process.env.ONLY ?? "";
  const messages: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" || message.type() === "warning") messages.push(`${message.type()}: ${message.text().slice(0, 220)}`); });
  page.on("pageerror", (error) => messages.push(`pageerror: ${String(error).slice(0, 220)}`));
  page.on("response", (response) => { if (response.status() >= 400 && !/ensure-daily/.test(response.url())) messages.push(`${response.status()} ${response.url().replace(/\?.*$/, "").slice(0, 160)}`); });
  const visit = async (key: string, viewport: (typeof viewports)[number], open: () => Promise<void>) => {
    if (only && !only.split(",").some((name) => key.startsWith(name))) return;
    await page.setViewportSize(viewport);
    await page.evaluate(() => { const w = window as unknown as { __cls: number; __shifts: string[] }; w.__cls = 0; w.__shifts = []; });
    await open();
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.waitForTimeout(1_200);
    shift[key] = Math.round(((await page.evaluate(() => (window as unknown as { __cls: number }).__cls)) as number) * 1000) / 1000;
    consoleByScreen[key] = messages.splice(0);
    shiftSources[key] = await page.evaluate(() => (window as unknown as { __shifts: string[] }).__shifts);
    report[key] = await measure(page, viewport.width <= 1024);
    if (process.env.SHOTS) {
      await mkdir(join(process.cwd(), "test-results", "ui-stability", "shots"), { recursive: true });
      await page.screenshot({ path: join(process.cwd(), "test-results", "ui-stability", "shots", `${key.replace(/[^a-z0-9]+/gi, "-")}.jpg`), type: "jpeg", quality: 60, fullPage: true, animations: "disabled" });
    }
  };

  for (const viewport of viewports) {
    for (const item of addresses) {
      await visit(`${item.name} · ${viewport.name}`, viewport, async () => {
        await page.goto(`/supervisie${item.search}`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => !document.querySelector(".access-form") && (document.querySelector("main")?.textContent?.length ?? 0) > 200, null, { timeout: 20_000 });
      });
    }
    for (const tile of tiles) {
      await visit(`${tile} · ${viewport.name}`, viewport, async () => {
        await page.goto(`/supervisie${workspace}`, { waitUntil: "domcontentloaded" });
        const entry = page.locator("main").getByRole("button", { name: new RegExp(`^(\\d+\\s*)?${tile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).first();
        await expect(entry, `${tile} should be on Workspace`).toBeVisible();
        await entry.click();
      });
    }
  }

  const directory = join(process.cwd(), "test-results", "ui-stability");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "findings.json"), JSON.stringify({ report, shift, shiftSources, consoleByScreen }, null, 2));
  const findings = Object.entries(report).flatMap(([screen, list]) => list.map((finding) => `${screen}: ${finding.kind} ${finding.detail}`));
  const worst = Math.max(...Object.values(shift));
  console.log(`UI stability audit: ${Object.keys(report).length} screens, ${findings.length} findings, worst layout shift ${worst}`);
  expect(findings, "a screen has something on top of something else, cut off, too small or sideways").toEqual([]);
  // 0.1 is the "good" limit for a whole page load; a screen of this app should be well inside it.
  expect(worst, `the worst screen shifted by ${worst}: ${JSON.stringify(shiftSources)}`).toBeLessThan(0.05);
});
