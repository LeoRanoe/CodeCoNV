import test from "node:test";
import assert from "node:assert/strict";
import { undoableMarkups } from "../lib/drawings/markup-geometry.mjs";

const markup = (id, created_at, extra = {}) => ({ id, drawing_file_id: "d1", page_number: 1, status: "active", created_at, ...extra });

test("Undo steps back through every markup on the page, newest first (image 2)", () => {
  const stored = [
    markup("b", "2026-11-21T10:02:00Z"),
    markup("a", "2026-11-21T10:01:00Z"),
    markup("c", "2026-11-21T10:03:00Z"),
    markup("other-page", "2026-11-21T10:04:00Z", { page_number: 2 }),
    markup("other-drawing", "2026-11-21T10:05:00Z", { drawing_file_id: "d2" }),
    markup("erased", "2026-11-21T10:06:00Z", { status: "void" }),
  ];
  const hidden = [];
  const undone = [];
  for (let press = 0; press < 4; press += 1) {
    const list = undoableMarkups(stored, "d1", 1, hidden);
    const last = list[list.length - 1];
    if (!last) break;
    undone.push(last.id);
    hidden.push(last.id);
  }
  assert.deepEqual(undone, ["c", "b", "a"]);
  assert.deepEqual(undoableMarkups(stored, "d1", 1, hidden), []);
  assert.deepEqual(undoableMarkups(stored, "d1", 2, []).map((m) => m.id), ["other-page"]);
});
