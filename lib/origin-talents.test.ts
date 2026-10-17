import assert from "node:assert/strict";
import test from "node:test";
import runeCatalog from "@/data/origin/runes.json";
import talentCatalog from "@/data/origin/talents.json";
import type { OriginRuneCatalog } from "@/lib/origin-runes";
import {
  getOriginTalentCost,
  getOriginTalentTotals,
  getOriginTalentUnlockedRuneNames,
  isOriginTalentUnlocked,
  resolveOriginTalentUnlockedRunes,
  restoreOriginTalentLevels,
  setOriginTalentLevel,
  type OriginTalentCatalog,
} from "@/lib/origin-talents";

const { talents } = talentCatalog as OriginTalentCatalog;
const byId = new Map(talents.map((talent) => [talent.id, talent]));

function maxAll(ids: readonly string[]) {
  return ids.reduce((levels, id) => setOriginTalentLevel(talents, levels, id, byId.get(id)!.maxLevel), {});
}

test("requires every prerequisite before a talent can be leveled", () => {
  const levels = maxAll(["10011", "10021", "10031", "10032", "10041"]);
  assert.equal(isOriginTalentUnlocked(byId.get("10051")!, levels), false);
  assert.deepEqual(setOriginTalentLevel(talents, levels, "10051", 1), levels);
  const unlocked = setOriginTalentLevel(talents, levels, "10042", 1);
  assert.equal(setOriginTalentLevel(talents, unlocked, "10051", 2)["10051"], 2);
});

test("lowering a prerequisite removes dependent levels", () => {
  const levels = maxAll(["10011", "10021", "10031", "10032"]);
  const lowered = setOriginTalentLevel(talents, levels, "10011", 0);
  assert.deepEqual(lowered, {});
});

test("ultimate talent unlocks after every branch talent is maxed", () => {
  const branchIds = talents.filter((talent) => talent.branchId !== 4)
    .sort((a, b) => a.row - b.row).map((talent) => talent.id);
  const levels = maxAll(branchIds);
  const totals = getOriginTalentTotals(talents, levels);
  assert.equal(totals.level, 66);
  assert.equal(isOriginTalentUnlocked(byId.get("40091")!, levels), true);
  const withUltimate = setOriginTalentLevel(talents, levels, "40091", 1);
  assert.equal(getOriginTalentTotals(talents, withUltimate).cost, getOriginTalentTotals(talents, withUltimate).maxCost);
  assert.equal(setOriginTalentLevel(talents, withUltimate, "30081", 0)["40091"], undefined);
});

test("restores saved levels in tree order and drops invalid entries", () => {
  const restored = restoreOriginTalentLevels(talents, { version: 1, levels: { "10021": 1, "10011": 9, "10051": 1, bogus: 2 } });
  assert.deepEqual(restored, { "10011": 3, "10021": 1 });
  assert.deepEqual(restoreOriginTalentLevels(talents, { version: 2, levels: { "10011": 1 } }), {});
});

test("sums per-level upgrade cost", () => {
  assert.equal(getOriginTalentCost(byId.get("10031")!, 2), 9);
  assert.equal(getOriginTalentTotals(talents, {}).maxCost, 603);
});

test("every limited rune unlocked by a talent resolves to one origin rune", () => {
  const resolved = resolveOriginTalentUnlockedRunes(talents, (runeCatalog as OriginRuneCatalog).runes);
  for (const talent of talents) {
    const names = getOriginTalentUnlockedRuneNames(talent);
    assert.deepEqual(resolved[talent.id]?.map((rune) => rune.name) ?? [], names, talent.name);
  }
  assert.equal(Object.values(resolved).flat().length, 17);
});
