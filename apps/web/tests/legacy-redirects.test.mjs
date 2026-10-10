import assert from "node:assert/strict";
import test from "node:test";

// Imports the real Next.js config so the map under test is the one that ships.
const { default: config } = await import("../next.config.ts");

test("every content page of the previous site has a permanent redirect to its section", async () => {
  const redirects = await config.redirects();
  const bySource = new Map(redirects.map((entry) => [entry.source, entry]));
  const expected = {
    "/about-us": "/#about",
    "/core-values": "/#values",
    "/our-clients": "/#clients",
    "/engineering": "/#services",
    "/consulting": "/#services",
    "/project-management": "/#services",
    "/contracting": "/#services",
    "/projects": "/#work",
    "/portfolio/:slug*": "/#work",
    "/contact": "/#contact",
  };
  for (const [source, destination] of Object.entries(expected)) {
    assert.equal(bySource.get(source)?.destination, destination, source);
    assert.equal(bySource.get(source)?.permanent, true, `${source} must be permanent`);
  }
  for (const demo of ["/icons", "/pricing-and-plans", "/landing-page", "/faq", "/:path*"]) {
    assert.equal(bySource.has(demo), false, `${demo} must not be redirected blindly`);
  }
});
