import { mkdirSync, writeFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

/**
 * A QA sweep, not a gate: it walks every module and every workspace tile at the five widths
 * of the live audit and writes what it saw to test-results/audit-sweep/report.json plus one
 * screenshot per screen. It records problems instead of failing on the first one, so a single
 * run shows the whole picture.
 *
 *   CODECO_AUDIT_SWEEP=1 npx playwright test audit-sweep --project=desktop-office
 *
 * Looks for: runtime errors, failed requests, sideways scrolling, controls without an
 * accessible name, touch targets that are too small, images without alt text, duplicate ids,
 * text below 11px and pages without exactly one h1.
 */
const email = process.env.CODECO_E2E_EMAIL;
const password = process.env.CODECO_E2E_PASSWORD;
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
test.skip(process.env.CODECO_AUDIT_SWEEP !== "1" || !email || !password, "Opt-in: CODECO_AUDIT_SWEEP=1 with a fixture account.");

const viewports = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1280", width: 1280, height: 800 },
  { name: "820", width: 820, height: 1180 },
  { name: "390", width: 390, height: 844 },
  { name: "360", width: 360, height: 780 },
];

const modules = ["Overview", "Workspace", "Actions", "Project Docs", "Issues", "Rapid Verify", "Reports", "Management"];
const tiles = [
  "Photos", "Works ongoing", "Works completed", "Workforce", "Project Delay Report", "Issues", "HSE", "Materials delivery",
  "Inspections", "Technical instructions", "Change order", "NCR", "Lessons Learned", "HSE incident", "Agreements Made",
  "Rapid Verify", "Project Docs", "Assets & folders", "Drawings & pins", "Deadlines", "Reports", "Submissions & management",
];

type Finding = { screen: string; viewport: string; kind: string; detail: string };

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

function inspect(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const nameOf = (element: Element): string => {
      const aria = element.getAttribute("aria-label")?.trim();
      if (aria) return aria;
      const labelledby = element.getAttribute("aria-labelledby");
      if (labelledby) {
        const text = labelledby.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
        if (text) return text;
      }
      const html = element as HTMLInputElement;
      if (html.labels && html.labels.length) {
        const text = Array.from(html.labels).map((label) => label.textContent ?? "").join(" ").trim();
        if (text) return text;
      }
      const wrapper = element.closest("label");
      if (wrapper?.textContent?.trim()) return wrapper.textContent.trim();
      const title = element.getAttribute("title")?.trim();
      if (title) return title;
      const text = (element.textContent ?? "").trim();
      if (text) return text;
      const img = element.querySelector("img[alt]");
      if (img?.getAttribute("alt")?.trim()) return img.getAttribute("alt")!.trim();
      return "";
    };
    const out: Array<{ kind: string; detail: string }> = [];
    const describe = (element: Element) => `${element.tagName.toLowerCase()}${element.className && typeof element.className === "string" ? "." + element.className.split(" ")[0] : ""}`;

    const viewport = document.documentElement.clientWidth;
    const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewport;
    if (overflow > 1) out.push({ kind: "overflow", detail: `${overflow}px wider than the viewport` });

    const hiddenInput = (element: Element) => element.matches("input.visually-hidden, input[type=file]") || (element.getBoundingClientRect().width <= 2 && element.getBoundingClientRect().height <= 2);
    const unnamed = Array.from(document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]"))
      .filter((element) => visible(element) && !hiddenInput(element) && !nameOf(element));
    for (const element of unnamed.slice(0, 6)) out.push({ kind: "unnamed-control", detail: describe(element) + (element.getAttribute("type") ? `[type=${element.getAttribute("type")}]` : "") });

    const small = Array.from(document.querySelectorAll("button, a[href], select, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), [role=button], [role=tab]"))
      .filter((element) => {
        if (!visible(element) || hiddenInput(element)) return false;
        // A text field inside a larger label is as tall as its label.
        const wrapper = element.closest("label");
        if (wrapper && wrapper !== element && Math.min(wrapper.getBoundingClientRect().width, wrapper.getBoundingClientRect().height) >= 32) return false;
        // A link inside running text is allowed to be as small as the line.
        if (element.tagName === "A" && element.closest("p, li, small")) return false;
        const box = element.getBoundingClientRect();
        return Math.min(box.width, box.height) < 24;
      });
    for (const element of small.slice(0, 6)) {
      const box = element.getBoundingClientRect();
      out.push({ kind: "tiny-target", detail: `${describe(element)} ${Math.round(box.width)}x${Math.round(box.height)} "${nameOf(element).slice(0, 30)}"` });
    }
    if (viewport <= 820) {
      const short = Array.from(document.querySelectorAll("button, select, [role=tab]")).filter((element) => visible(element) && Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height) < 36 && Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height) >= 24);
      if (short.length) out.push({ kind: "touch-target-under-36", detail: `${short.length} controls, e.g. ${describe(short[0])} "${nameOf(short[0]).slice(0, 30)}"` });
    }

    const noAlt = Array.from(document.querySelectorAll("img")).filter((image) => visible(image) && !image.hasAttribute("alt"));
    if (noAlt.length) out.push({ kind: "img-without-alt", detail: `${noAlt.length} images` });

    const ids = new Map<string, number>();
    for (const element of Array.from(document.querySelectorAll("[id]"))) ids.set(element.id, (ids.get(element.id) ?? 0) + 1);
    const duplicates = Array.from(ids).filter(([, count]) => count > 1).map(([id]) => id);
    if (duplicates.length) out.push({ kind: "duplicate-id", detail: duplicates.slice(0, 5).join(", ") });

    const tiny = Array.from(document.querySelectorAll("body *")).filter((element) => {
      if (!visible(element)) return false;
      const own = Array.from(element.childNodes).some((node) => node.nodeType === 3 && (node.textContent ?? "").trim().length > 1);
      return own && parseFloat(getComputedStyle(element).fontSize) < 11;
    });
    if (tiny.length) out.push({ kind: "text-under-11px", detail: `${tiny.length} elements, e.g. ${describe(tiny[0])}` });

    const h1 = Array.from(document.querySelectorAll("h1")).filter(visible).length;
    if (h1 !== 1) out.push({ kind: "h1-count", detail: `${h1} visible h1` });

    return out;
  });
}

test("sweep every module and workspace tile at five widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-office", "The sweep sets its own viewports.");
  test.setTimeout(1_800_000);
  const outDir = "test-results/audit-sweep";
  mkdirSync(outDir, { recursive: true });
  const findings: Finding[] = [];
  const reached: string[] = [];
  let screen = "sign-in";
  let viewportName = "1440";

  page.on("pageerror", (error) => findings.push({ screen, viewport: viewportName, kind: "page-error", detail: error.message.slice(0, 200) }));
  page.on("console", (message) => {
    if (message.type() === "error") findings.push({ screen, viewport: viewportName, kind: "console-error", detail: message.text().slice(0, 200) });
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon|\/_next\/static/.test(response.url())) {
      findings.push({ screen, viewport: viewportName, kind: `http-${response.status()}`, detail: `${response.request().method()} ${response.url().replace(/\?.*/, "").slice(0, 140)}` });
    }
  });

  // The Next.js development indicator sits over the bottom-left tab of a phone layout; it does
  // not exist in a production build and would only make every click there time out.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
    });
  });
  await page.setViewportSize({ width: viewports[0].width, height: viewports[0].height });
  await signIn(page);

  const writeReport = () => {
    const unique = new Map<string, Finding & { count: number }>();
    for (const finding of findings) {
      const key = `${finding.screen}|${finding.viewport}|${finding.kind}|${finding.detail}`;
      const seen = unique.get(key);
      if (seen) seen.count += 1; else unique.set(key, { ...finding, count: 1 });
    }
    writeFileSync(`${outDir}/report.json`, JSON.stringify({ reached: reached.length, findings: Array.from(unique.values()) }, null, 1));
  };
  const mobile = (width: number) => width <= 820;
  const projectUrl = page.url();
  /** Reloads the project so a screen left in an odd state by the previous step cannot hide the navigation. */
  const reload = async () => {
    await page.goto(projectUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector(".access-form") && (document.querySelector("main")?.textContent?.length ?? 0) > 200, null, { timeout: 25_000 }).catch(() => undefined);
    await page.waitForTimeout(500);
  };
  const goModuleOnce = async (name: string, width: number) => {
    if (mobile(width)) {
      // On a phone the destinations live in the bottom bar and the "more" drawer.
      const direct = page.locator("nav, .mobile-nav, .bottom-bar").getByRole("button", { name: new RegExp(`^${name}`) }).first();
      if (await direct.isVisible().catch(() => false)) { await direct.click({ timeout: 6000 }); return true; }
      const more = page.getByRole("button", { name: /^(More|Menu)/ }).first();
      if (await more.isVisible().catch(() => false)) {
        await more.click({ timeout: 6000 });
        const inDrawer = page.getByRole("button", { name: new RegExp(`^${name}`) }).first();
        if (await inDrawer.isVisible().catch(() => false)) { await inDrawer.click({ timeout: 6000 }); return true; }
        await page.keyboard.press("Escape");
      }
      return false;
    }
    await page.locator(".sidebar").getByRole("button", { name, exact: true }).click({ timeout: 8000 });
    return true;
  };

  const goModule = async (name: string, width: number) => {
    const first = await goModuleOnce(name, width).catch(() => false);
    if (first) return true;
    await reload();
    return goModuleOnce(name, width).catch(() => false);
  };

  for (const viewport of viewports) {
    viewportName = viewport.name;
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await reload();

    for (const name of modules) {
      screen = `module:${name}`;
      console.log(`[sweep] ${viewport.name} ${screen}`);
      const ok = await goModule(name, viewport.width).catch(() => false);
      if (!ok) { findings.push({ screen, viewport: viewport.name, kind: "unreachable", detail: `no navigation entry for ${name} at ${viewport.width}px` }); continue; }
      await page.waitForTimeout(900);
      reached.push(`${viewport.name}:${screen}`);
      for (const item of await inspect(page)) findings.push({ screen, viewport: viewport.name, ...item });
      await page.screenshot({ path: `${outDir}/${viewport.name}-module-${name.replace(/\W+/g, "_")}.png` });
    }

    writeReport();
    for (const tile of tiles) {
      screen = `tile:${tile}`;
      console.log(`[sweep] ${viewport.name} ${screen}`);
      if (!(await goModule("Workspace", viewport.width).catch(() => false))) { findings.push({ screen, viewport: viewport.name, kind: "unreachable", detail: "workspace not reachable" }); continue; }
      await page.waitForTimeout(500);
      const button = page.locator("main").getByRole("button", { name: new RegExp(`^(\\d+\\s*)?${tile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).first();
      if (!(await button.isVisible().catch(() => false))) {
        findings.push({ screen, viewport: viewport.name, kind: "tile-missing", detail: `"${tile}" not found on the workspace at ${viewport.width}px` });
        continue;
      }
      try {
        await button.click({ timeout: 8000 });
      } catch (error) {
        findings.push({ screen, viewport: viewport.name, kind: "click-failed", detail: String(error).slice(0, 160) });
        await page.keyboard.press("Escape").catch(() => undefined);
        continue;
      }
      await page.waitForTimeout(1100);
      reached.push(`${viewport.name}:${screen}`);
      for (const item of await inspect(page)) findings.push({ screen, viewport: viewport.name, ...item });
      await page.screenshot({ path: `${outDir}/${viewport.name}-tile-${tile.replace(/\W+/g, "_")}.png` });
    }
  }

  writeReport();
  console.log(`sweep reached ${reached.length} screens`);
});
