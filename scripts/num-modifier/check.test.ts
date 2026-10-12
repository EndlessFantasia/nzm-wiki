import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { readNumModifierDataLock } from "./lock";
import { checkSemanticCoverage } from "./check";
import { parseNumModifierSemantics } from "../../lib/num-modifier-semantics";
import semantics from "../../data/num-modifier-semantics.json";
import { createNumModifierResolver } from "../../lib/num-modifier";
import { parseNumModifierDataLock } from "../../lib/num-modifier-data-lock";

test("semantic checks allow legitimate row/attribute count changes but reject undeclared attributes", () => {
  const lock = structuredClone(readNumModifierDataLock());
  const source = Object.values(lock.rows.lc).find(row => row.raw.AttributeName === "GPAttributeSetCritical.CriticalRatio")!;
  lock.rows.lc["999999999_1_0"] = { row_name: "999999999_1_0", raw: { ...source.raw, ID: 999999999 } };
  lock.sources.lc.modifiers.row_count++;
  assert.deepEqual(checkSemanticCoverage(lock, parseNumModifierSemantics(semantics)), []);
  lock.rows.lc["999999999_1_0"].raw.AttributeName = "Fixture.NewAttribute";
  assert.match(checkSemanticCoverage(lock, parseNumModifierSemantics(semantics)).join("\n"), /Fixture.NewAttribute.*no semantic disposition/);
});

test("every declared reviewed signature is validated, including currently unused rows", () => {
  const lock = structuredClone(readNumModifierDataLock());
  const key = Object.keys(semantics.reviewed_semantics)[0];
  lock.rows.lc[key.slice(3)].raw.CoefValue = 12345;
  assert.throws(() => checkSemanticCoverage(lock, parseNumModifierSemantics(semantics)), /reviewed semantic signature/);
  delete lock.rows.lc[key.slice(3)];
  lock.sources.lc.modifiers.row_count--;
  assert.throws(() => checkSemanticCoverage(lock, parseNumModifierSemantics(semantics)), /not found|missing|Unknown/i);
});

test("historical coefficient and damage-reduction samples live in frozen regression evidence", () => {
  const base = "archives/content-versions/s4/s4-final-20260922/files/evidence/data";
  const resolver = createNumModifierResolver(
    parseNumModifierDataLock(JSON.parse(fs.readFileSync(`${base}/num-modifier-lock.json`, "utf8"))),
    parseNumModifierSemantics(JSON.parse(fs.readFileSync(`${base}/num-modifier-semantics.json`, "utf8"))),
  );
  for (const [row, field, facet] of [
    ["lc:111010076_1_0", "coefficient", "critical-rate"],
    ["lc:110003101_1_1", "base", "damage-reduction"],
  ] as const) {
    const effect = resolver.resolveEffect({ row, field }, { recipient: "self" });
    assert.equal(effect.direction, "increase");
    assert.ok(effect.facets.some(entry => entry.id === facet));
  }
});
