import assert from "node:assert/strict";
import test from "node:test";
import { createMgeDescriptionLookup } from "./description-source";

test("finds a full description whose row name retains an unrelated identity", () => {
  const row = { MGEId: 1312071002, TextID: 1, MGEDescription: "full description" };
  const find = createMgeDescriptionLookup({ "1312045001_2": row });
  assert.deepEqual(find("1312071002_1"), { rowKey: "1312045001_2", row });
  assert.equal(find("1312045001_2"), undefined);
});

test("does not select a canonical-looking row that belongs to another skill or text version", () => {
  const right = { MGEId: 123, TextID: 1, description: "right" };
  const find = createMgeDescriptionLookup({
    "123_1": { MGEId: 456, TextID: 1, description: "wrong skill" },
    old_name: right,
    second: { MGEId: 123, TextID: 2, description: "other text version" },
  });
  assert.deepEqual(find("123_1"), { rowKey: "old_name", row: right });
  assert.equal(find("123_2")?.row.description, "other text version");
});

test("rejects ambiguous identities instead of choosing by row order", () => {
  const find = createMgeDescriptionLookup({
    first: { MGEId: 123, TextID: 1 },
    second: { MGEId: 123, TextID: 1 },
  });
  assert.throws(() => find("123_1"), /Ambiguous MGE description identity/);
  assert.equal(find("456_1"), undefined);
});
