import assert from "node:assert/strict";
import test from "node:test";
import {
  SURVIVAL_CODEX, filterSurvivalSkillsByTag, getSurvivalPassive, getSurvivalSkill, listSurvivalAtlas,
} from "./survival-codex";

test("the atlas lists active skills first, then passives and specials in game order", () => {
  const atlas = listSurvivalAtlas();
  assert.equal(atlas.length, 17);
  assert.deepEqual(atlas.slice(0, 8).map((entry) => entry.kind), Array(8).fill("skill"));
  assert.deepEqual(atlas.slice(8, 12).map((entry) => entry.name), ["自愈", "铁壁", "潜能激发", "狂暴"]);
  assert.deepEqual(atlas.slice(12).map((entry) => entry.id), [6061, 6062, 6063, 6064, 6065]);
  assert.deepEqual(atlas.map((entry) => entry.sortOrder), [...atlas.map((entry) => entry.sortOrder)].sort((a, b) => a - b));
});

test("each skill pairs with a passive that points back at it", () => {
  for (const skill of SURVIVAL_CODEX.skills) {
    const passive = getSurvivalPassive(skill.passiveId);
    assert.equal(passive?.combinesWithSkillId, skill.id);
    assert.deepEqual(skill.ultimate.prerequisites[0].ids, [skill.levels.at(-1)!.id, skill.passiveId]);
  }
  assert.equal(getSurvivalSkill(1001)?.name, "机枪哨卫");
  assert.equal(getSurvivalSkill(404), undefined);
});

test("tag lookup uses the source enum, not the display text", () => {
  assert.deepEqual(filterSurvivalSkillsByTag("Summon").map((skill) => skill.id), [1001, 1002]);
  assert.deepEqual(filterSurvivalSkillsByTag("Nope"), []);
});
