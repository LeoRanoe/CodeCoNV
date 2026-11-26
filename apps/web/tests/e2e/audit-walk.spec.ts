import { mkdirSync, writeFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

/**
 * A review aid, not a regression test (opt-in with UX_WALK=1): every screen of the supervision app, in every
 * viewport and role asked for, is photographed into tmp/audit/<viewport>/<role>/ together with a measurement of
 * the screen (sideways scroll, covered or clipped controls, small targets and text, sidebar footer in view).
 *   UX_WALK=1 AUDIT_SIZES=1366x768,390x844 AUDIT_ROLES=supervisor npx playwright test audit-walk --project=desktop-office
 * It reads; it creates nothing (forms are opened, never saved).
 */
const supabaseUrl = process.env.CODECO_E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const projectName = process.env.CODECO_E2E_PROJECT ?? "Paramaribo Field Readiness Demo";
const lang = process.env.AUDIT_LANG === "nl" ? "nl" : "en";
const out = process.env.AUDIT_OUT ?? "D:/CodeCoNV/tmp/audit";

test.skip(!process.env.UX_WALK, "A review aid: set UX_WALK=1 to run it.");
test.skip(!["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname), "Local Supabase only.");

const sizes = (process.env.AUDIT_SIZES ?? "1920x1080,1440x900,1366x768,1280x720,1024x768,820x1180,390x844,844x390")
  .split(",").map((size) => { const [width, height] = size.split("x").map(Number); return { name: size, width, height }; });
const roles = (process.env.AUDIT_ROLES ?? "supervisor,contractor,client").split(",");
const accounts: Record<string, { email?: string; password?: string }> = {
  supervisor: { email: process.env.CODECO_E2E_EMAIL, password: process.env.CODECO_E2E_PASSWORD },
  contractor: { email: process.env.CODECO_E2E_CONTRACTOR_EMAIL, password: process.env.CODECO_E2E_CONTRACTOR_PASSWORD },
  client: { email: process.env.CODECO_E2E_CLIENT_EMAIL, password: process.env.CODECO_E2E_CLIENT_PASSWORD },
  clientportal: { email: process.env.CODECO_E2E_CLIENT_PORTAL_EMAIL, password: process.env.CODECO_E2E_CLIENT_PORTAL_PASSWORD },
};

const forms = ["photos", "works-ongoing", "works-completed", "workforce", "delay-report", "issues", "hse", "materials-delivery", "inspections",
  "technical-instructions", "change-order", "ncr", "lessons-learned", "hse-incident", "agreements-made"];

/** Runs in the page: what a person would see as broken. */
function measure() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const touch = vw < 1024;
  const describe = (el: Element) => {
    const label = (el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 40);
    const cls = typeof el.className === "string" ? el.className.split(" ").filter(Boolean).slice(0, 2).join(".") : "";
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${label ? ` "${label}"` : ""}`;
  };
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
  };
  const inScroller = (el: Element) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };
  const controls = [...document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], summary")]
    .filter(visible).filter((el) => !el.closest(".visually-hidden, .sr-only, nextjs-portal"));
  const covered: string[] = [];
  const clipped: string[] = [];
  const small: string[] = [];
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh) continue;
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el)) clipped.push(`${describe(el)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    const cx = Math.min(Math.max(r.left + r.width / 2, 0), vw - 1);
    const cy = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
    const hit = document.elementFromPoint(cx, cy);
    if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
      const label = el.closest("label");
      if (!(label && label.contains(hit))) covered.push(`${describe(el)} under ${describe(hit)}`);
    }
    const isText = el.tagName === "A" && getComputedStyle(el).display === "inline";
    const isCheck = el instanceof HTMLInputElement && ["checkbox", "radio"].includes(el.type);
    if (touch && !isText && !isCheck && (r.height < 43.5 || r.width < 24)) small.push(`${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  const tinyText: string[] = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
    if (!visible(el) || el.closest(".sr-only, .visually-hidden, nextjs-portal, svg")) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 12) tinyText.push(`${describe(el)} ${size}px`);
  }
  const sidebar = document.querySelector(".sidebar");
  let sidebarFooter = "n/a";
  if (sidebar && visible(sidebar)) {
    const card = sidebar.querySelector(".user-card");
    const r = card?.getBoundingClientRect();
    sidebarFooter = r ? (r.bottom <= vh + 1 ? "in view" : `OFF SCREEN by ${Math.round(r.bottom - vh)}px`) : "missing";
  }
  const scrollers = [...document.querySelectorAll("*")].filter((el) => {
    const s = getComputedStyle(el);
    return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 100 && el !== document.documentElement && el !== document.body;
  }).map(describe);
  return {
    sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    pageHeight: document.documentElement.scrollHeight,
    sidebarFooter,
    covered: [...new Set(covered)].slice(0, 12), coveredCount: covered.length,
    clipped: [...new Set(clipped)].slice(0, 12), clippedCount: clipped.length,
    small: [...new Set(small)].slice(0, 12), smallCount: small.length,
    tinyText: [...new Set(tinyText)].slice(0, 8), tinyTextCount: tinyText.length,
    scrollers: scrollers.slice(0, 6),
  };
}

async function signIn(page: Page, role: string) {
  const account = accounts[role];
  await page.addInitScript(([language]) => {
    for (const key of ["codeco-field-guide-seen-v3", "codeco-portal-guide-seen-v1-contractor", "codeco-portal-guide-seen-v1-client"]) localStorage.setItem(key, "yes");
    localStorage.setItem("codeco-language-choice", language);
    const style = document.createElement("style");
    style.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
  }, [lang]);
  await page.goto("/supervisie");
  const form = page.locator(".access-form");
  await form.waitFor({ state: "visible" });
  await form.locator("input[type='email']").fill(account.email!);
  await form.locator("input[type='password']").fill(account.password!);
  await form.locator("button[type='submit']").click();
  if (role === "supervisor") {
    await page.getByRole("button", { name: new RegExp(projectName) }).first().click();
    await expect(page.locator(".sidebar, .mobile-bottom-nav").first()).toBeAttached({ timeout: 30_000 });
    await page.waitForURL(/project=/, { timeout: 30_000 });
    return new URL(page.url()).searchParams.get("project")!;
  }
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(2500);
  const pick = page.getByRole("button", { name: new RegExp(projectName) }).first();
  if (await pick.isVisible().catch(() => false)) await pick.click();
  await page.waitForTimeout(1500);
  return new URL(page.url()).searchParams.get("project") ?? "";
}

for (const role of roles) {
  for (const size of sizes) {
    test(`audit walk ${role} ${size.name}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-office", "Sets the viewport itself.");
      test.skip(!accounts[role]?.email, `No account for ${role}.`);
      test.setTimeout(1_200_000);
      const dir = `${out}/${lang}/${size.name}/${role}`;
      mkdirSync(dir, { recursive: true });
      await page.setViewportSize({ width: size.width, height: size.height });
      page.setDefaultTimeout(15_000);
      const project = await signIn(page, role);
      const report: Record<string, unknown> = {};

      const shoot = async (name: string, full = false) => {
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${dir}/${name}.png`, fullPage: full });
        report[name] = await page.evaluate(measure);
      };
      const step = async (name: string, body: () => Promise<void>) => {
        try { await body(); } catch (error) { report[name] = { error: String((error as Error).message).split("\n")[0].slice(0, 160) }; }
      };
      const nav = async (id: string) => {
        await page.goto(`/supervisie?project=${project}&nav=${id}`);
        await page.waitForLoadState("networkidle").catch(() => undefined);
        await page.waitForTimeout(600);
        const back = page.locator(".workspace-back-button");
        if (await back.isVisible().catch(() => false)) await back.click();
      };

      if (role !== "supervisor") {
        await step("portal-home", async () => { await shoot("01-portal-home"); await shoot("01-portal-home-full", true); });
        const tabs = page.locator(".portal-shell nav button, .portal-nav button, [role=tablist] [role=tab]");
        const count = Math.min(await tabs.count(), 10);
        for (let index = 0; index < count; index++) {
          await step(`portal-tab-${index}`, async () => {
            const tab = tabs.nth(index);
            if (!(await tab.isVisible())) return;
            await tab.click();
            await shoot(`02-portal-tab-${index}`);
          });
        }
      } else {
        await step("overview", async () => { await nav("vandaag"); await shoot("01-overview"); await shoot("01-overview-full", true); });
        await step("workspace", async () => { await nav("project"); await shoot("02-workspace"); await shoot("02-workspace-full", true); });
        for (const [index, destination] of forms.entries()) {
          await step(destination, async () => {
            await nav("project");
            await page.locator(`[data-workspace-destination="${destination}"]`).click();
            await page.waitForTimeout(1500);
            const create = page.locator("main").getByRole("button", { name: /^(New|Nieuw|\+ New|Add|Take a picture)/i }).first();
            await shoot(`03-${String(index + 1).padStart(2, "0")}-${destination}-list`);
            if (await create.isVisible().catch(() => false) && destination !== "photos") {
              await create.click();
              await page.waitForTimeout(1500);
              await shoot(`03-${String(index + 1).padStart(2, "0")}-${destination}-form`);
              await shoot(`03-${String(index + 1).padStart(2, "0")}-${destination}-form-full`, true);
            }
          });
        }
        for (const [name, id] of [["04-actions", "acties"], ["05-rapid-verify", "verify"], ["06-project-documents", "projectdocs"], ["07-records", "records"],
          ["08-reports", "rapporten"], ["09-contractor-portal", "contractorportal"], ["10-client-portal", "clientportal"], ["11-management", "meer"]] as const) {
          await step(name, async () => { await nav(id); await shoot(name); await shoot(`${name}-full`, true); });
        }
        if (size.width < 1024) {
          await step("more-sheet", async () => {
            await nav("vandaag");
            await page.locator(".mobile-bottom-nav button[aria-controls='mobile-module-menu']").click();
            await shoot("12-more-sheet");
          });
        }
        await step("switch-project", async () => {
          await nav("vandaag");
          await page.locator(".breadcrumb-project").click();
          await shoot("13-switch-project");
          await page.keyboard.press("Escape");
        });
        await step("notifications", async () => {
          await nav("vandaag");
          await page.getByRole("button", { name: /^(Notifications|Meldingen)/ }).first().click();
          await shoot("14-notifications");
          await page.keyboard.press("Escape");
        });
      }
      writeFileSync(`${dir}/measure.json`, JSON.stringify(report, null, 2));
    });
  }
}
