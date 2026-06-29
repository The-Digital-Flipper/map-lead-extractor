import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeName,
  duplicateName,
  dedupeIds,
  filterCollections,
  sortCollections,
  reorder,
  type Collection,
} from "../collections.ts";

const make = (over: Partial<Collection>): Collection => ({
  id: 1, name: "X", color: null, archived: false, sortOrder: 0,
  createdAt: null, updatedAt: null, leadCount: 0, ...over,
});

test("sanitizeName trims, clamps, rejects empty", () => {
  assert.equal(sanitizeName("  Hot Leads  "), "Hot Leads");
  assert.equal(sanitizeName("   "), null);
  assert.equal(sanitizeName("a".repeat(200))!.length, 80);
});

test("duplicateName appends (copy) within length limit", () => {
  assert.equal(duplicateName("Roofers"), "Roofers (copy)");
  assert.equal(duplicateName("a".repeat(80)).length, 80);
});

test("dedupeIds keeps unique positive integers", () => {
  assert.deepEqual(dedupeIds([1, 1, 2, -3, 0, 4, 4]), [1, 2, 4]);
});

test("filterCollections is case-insensitive and trims", () => {
  const list = [make({ id: 1, name: "Roofers" }), make({ id: 2, name: "Plumbers" })];
  assert.equal(filterCollections(list, "  ROOF ").length, 1);
  assert.equal(filterCollections(list, "")?.length, 2);
});

test("sortCollections orders by sortOrder then name", () => {
  const list = [
    make({ id: 1, name: "B", sortOrder: 1 }),
    make({ id: 2, name: "A", sortOrder: 1 }),
    make({ id: 3, name: "C", sortOrder: 0 }),
  ];
  assert.deepEqual(sortCollections(list).map((c) => c.id), [3, 2, 1]);
});

test("reorder swaps and respects bounds", () => {
  assert.deepEqual(reorder([1, 2, 3], 0, 1), [2, 1, 3]);
  assert.deepEqual(reorder([1, 2, 3], 2, 1), [1, 2, 3]); // down at end = no-op
  assert.deepEqual(reorder([1, 2, 3], 0, -1), [1, 2, 3]); // up at start = no-op
});
