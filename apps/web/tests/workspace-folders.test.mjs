import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { workspaceFolders } from "../lib/records/workspace-folders.ts";

// Records & Photos has a folder for every Workspace item, with the same name, in the same order.
test("Records & Photos folders are the Workspace items, same names and order", async () => {
  const home = await readFile(new URL("../app/project-workspace-home.tsx", import.meta.url), "utf8");
  const tiles = [...home.matchAll(/id: "([a-z-]+)",\s*(?:\/\*[\s\S]*?\*\/\s*)?(?:\/\/[^\n]*\n\s*)*label: (?:text\("([^"]+)", "([^"]+)"\)|"([^"]+)")/g)]
    .map((match) => ({ id: match[1], en: match[2] ?? match[4], nl: match[3] ?? match[4] }));
  assert.ok(tiles.length >= 15, `found ${tiles.length} workspace tiles`);
  assert.deepEqual(workspaceFolders.map(({ id, en, nl }) => ({ id, en, nl })), tiles);
});

test("every folder but Photos names a form type the archive can filter on", () => {
  for (const folder of workspaceFolders) assert.ok(folder.id === "photos" ? folder.kind === null : /^(register:[a-z_]+|hse:incident|hse|finding|ncr|inspection|workforce)$/.test(folder.kind), folder.id);
});
