import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the required CODECO project entry point", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Vandaag \| CODECO Supervisie<\/title>/i);
  assert.match(html, /CODECO N\.V\./);
  assert.match(html, /Mijn projecten/);
  assert.match(html, /Waar ga je vandaag werken\?/);
  assert.match(html, /Kwattaweg Residence/);
  assert.match(html, /Commewijne Port Facility/);
  assert.doesNotMatch(html, /Sitezicht|codex-preview|Building your site|react-loading-skeleton/i);
});

test("keeps the MVP interaction and accessibility hooks in source", async () => {
  const [app, page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/codeco-supervision-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(app, /aria-modal="true"/);
  assert.match(app, /event\.key === "Escape"/);
  assert.match(app, /timeZone: "America\/Paramaribo"/);
  assert.match(app, /WorkspaceStage/);
  assert.match(app, /Projectstart openen/);
  assert.match(app, /Aanwezigheid vandaag/);
  assert.match(app, /setEntries/);
  assert.match(page, /CodecoSupervisionApp/);
  assert.match(layout, /<html lang="nl">/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("tracks product-plan and CODECO compliance explicitly", async () => {
  const compliance = await readFile(
    new URL("../../../docs/product/product-plan-compliance.md", import.meta.url),
    "utf8",
  );
  const clientProfile = await readFile(
    new URL("../../../docs/product/client-profile-codeco.md", import.meta.url),
    "utf8",
  );

  assert.match(compliance, /WF-01/);
  assert.match(compliance, /MVP-01/);
  assert.match(compliance, /TA-01/);
  assert.match(compliance, /Open klantbesluiten/);
  assert.match(clientProfile, /Kwaliteit/);
  assert.match(clientProfile, /Transparantie/);
  assert.match(clientProfile, /projectspecifieke inspectie- en kwaliteitschecklists/i);
});
