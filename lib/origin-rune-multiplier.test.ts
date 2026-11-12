import assert from "node:assert/strict";
import test from "node:test";
import runes from "@/data/origin/runes.json";
import {
  MULTIPLIER_PROVIDERS,
  MULTIPLIER_PROVIDER_EXCLUSIONS,
  getProviderRelationsForSource,
  getSourcesForModifierType,
  resolveMultiplierSourceHref,
} from "@/lib/multiplier-data";

test("every origin rune has one indexed source or an explicit exclusion", () => {
  const entries = [...MULTIPLIER_PROVIDERS, ...MULTIPLIER_PROVIDER_EXCLUSIONS]
    .flatMap((entry) => entry.source.type === "origin-rune" ? [entry.source.id] : []);
  assert.equal(entries.length, runes.runes.length);
  assert.deepEqual(new Set(entries),
    new Set(runes.runes.map((rune) => rune.id)));
});

test("origin rune factors preserve distinct Numerical attributes and reverse links", () => {
  const cases = [
    ["1378042010", ["independent-amplification"]],
    ["1378044210", ["independent-amplification"]],
    ["1378045110", ["independent-amplification"]],
    ["1378044380", ["critical", "dilution"]],
    ["1378044410", ["dilution"]],
    ["1378045120", ["dilution"]],
    ["1378042430", ["super-critical"]],
    ["1378044920", ["dilution"]],
  ] as const;
  for (const [id, expected] of cases) {
    const source = { type: "origin-rune" as const, id };
    const relations = getProviderRelationsForSource(source);
    assert.deepEqual([...new Set(relations.map((relation) => relation.factorId))].sort(), [...expected].sort(), id);
    assert.equal(resolveMultiplierSourceHref(source), `/origin/runes/${id}`);
    for (const relation of relations) {
      assert.ok(getSourcesForModifierType(relation.modifierTypeId).includes(relation), id);
    }
  }
  assert.deepEqual(getProviderRelationsForSource({ type: "origin-rune", id: "1378042160" }), []);
  assert.deepEqual(getProviderRelationsForSource({ type: "origin-rune", id: "1378044310" }), []);
  assert.deepEqual([...new Set(getProviderRelationsForSource({ type: "overlimit-card", id: "1317107001" })
    .map((relation) => relation.factorId))], ["game-mode"]);
  assert.deepEqual([...new Set(getProviderRelationsForSource({ type: "overlimit-card", id: "1317109001" })
    .map((relation) => relation.factorId))], ["game-mode"]);
});
