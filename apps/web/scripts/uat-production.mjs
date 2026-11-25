import { execFileSync } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

const { values } = parseArgs({ options: { ref: { type: "string", default: "HEAD" } } });
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const origin = "https://code-co-nv.vercel.app";
const output = join(repo, "apps/web/test-results/uat-production");
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const candidate = git("rev-parse", "--verify", "--end-of-options", `${values.ref}^{commit}`);
const ignored = [":(exclude)docs/**", ":(exclude)apps/web/scripts/uat-*", ":(exclude)apps/web/tests/e2e/fake-blob/run-stack.mjs"];
const latestMigration = (files) => files.map((file) => /^([0-9]{12})_.+\.sql$/.exec(file)?.[1]).filter(Boolean).sort().at(-1);

const report = {
  checkedAt: new Date().toISOString(),
  origin,
  candidate,
  candidateMigration: latestMigration(git("ls-tree", "--name-only", `${candidate}:supabase/migrations`).split(/\r?\n/)),
  workingTreeMigration: latestMigration(await readdir(join(repo, "supabase/migrations"))),
  workingTreeChanges: git("status", "--porcelain", "--untracked-files=all", "--", "apps/web", "supabase", "vercel.json", ...ignored),
  release: null,
  sourceParity: "unverified",
  differingFiles: [],
  database: "Requires separate applied-migration evidence",
  checks: [],
};

async function check(name, run) {
  try {
    report.checks.push({ name, status: "pass", evidence: await run() });
  } catch (error) {
    report.checks.push({ name, status: "fail", evidence: error.message });
  }
}

await mkdir(output, { recursive: true });
let browser;
try {
  browser = await chromium.launch({ channel: process.env.CODECO_UAT_CHANNEL || undefined });
  const context = await browser.newContext({ serviceWorkers: "block", locale: "en-US" });
  // Fresh account-free context. Requests that could change application state are never sent.
  await context.route("**/*", (route) => {
    const request = route.request();
    return ["GET", "HEAD", "OPTIONS"].includes(request.method()) && (!request.isNavigationRequest() || new URL(request.url()).origin === origin)
      ? route.continue()
      : route.abort("blockedbyclient");
  });
  await check("Production release identity and source parity", async () => {
    const response = await context.request.get(`${origin}/api/release`, { maxRedirects: 0, timeout: 20_000 });
    if (!response.ok()) throw new Error(`Release endpoint returned HTTP ${response.status()}`);
    const release = await response.json();
    report.release = Object.fromEntries(["commit", "branch", "environment", "deployment", "expectedSchemaVersion"].map((key) => [key, release[key]]));
    if (release.environment !== "production" || !/^[a-f0-9]{12}$/.test(release.commit)) throw new Error("The endpoint did not identify a production Git revision");
    if (candidate.startsWith(release.commit)) report.sourceParity = "same-commit";
    else {
      let deployed;
      try { deployed = git("rev-parse", "--verify", `${release.commit}^{commit}`); }
      catch { throw new Error(`Deployed revision ${release.commit} is absent locally. Fetch the release ref and rerun.`); }
      report.differingFiles = git("diff", "--name-only", deployed, candidate, "--", ".", ...ignored).split(/\r?\n/).filter(Boolean);
      report.sourceParity = report.differingFiles.length ? "different" : "matching-source";
    }
    if (report.sourceParity === "different") throw new Error(`Candidate and deployed revision differ in ${report.differingFiles.length} file(s)`);
    if (report.workingTreeChanges) throw new Error("The working tree contains changes outside the UAT harness. Compare the candidate in a clean checkout before claiming parity.");
    if (release.expectedSchemaVersion !== report.candidateMigration) throw new Error("The production app expects a different schema version than the candidate");
    return `${report.sourceParity}, ${release.commit}, expected migration ${release.expectedSchemaVersion}`;
  });

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const page = await context.newPage();
    await page.setViewportSize(viewport);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.name));
    await check(`Public sign-in at ${viewport.width}px`, async () => {
      const response = await page.goto(`${origin}/supervisie`, { waitUntil: "domcontentloaded", timeout: 25_000 });
      if (!response?.ok()) throw new Error(`Sign-in route returned HTTP ${response?.status() ?? "unknown"}`);
      const signIn = page.locator(".access-form");
      await signIn.locator('input[type="email"]').waitFor({ state: "visible", timeout: 15_000 });
      await signIn.locator('input[type="password"]').waitFor({ state: "visible", timeout: 15_000 });
      await signIn.locator('button[type="submit"]').waitFor({ state: "visible", timeout: 15_000 });
      const screenshot = `sign-in-${viewport.width}.png`;
      await page.screenshot({ path: join(output, screenshot), animations: "disabled", timeout: 10_000 });
      if (errors.length) throw new Error(`Public sign-in raised ${errors.length} unhandled page error(s)`);
      return `HTTP ${response.status()}, email, password and submit visible. ${screenshot}`;
    });
    await page.close();
  }
} catch (error) {
  report.checks.push({ name: "Browser setup", status: "fail", evidence: error.message });
} finally {
  await browser?.close();
  await writeFile(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

for (const item of report.checks) console.log(`${item.status.toUpperCase()} ${item.name} · ${item.evidence}`);
console.log(`Report ${join(output, "report.json")}`);
if (report.checks.some((item) => item.status === "fail")) process.exitCode = 1;
