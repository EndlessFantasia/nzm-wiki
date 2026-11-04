import assert from "node:assert/strict";
import test from "node:test";
import {
  SURVIVAL_CODEX, filterSurvivalSkillsByTag, getSurvivalPassive, getSurvivalSkill, listSurvivalAtlas,
  resolveSurvivalBuffEffects,
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

test("buff effects resolve through the Num Modifier Lock, not the description", () => {
  const triple = SURVIVAL_CODEX.specials.find((special) => special.id === 6065)!;
  assert.match(triple.node.description, /×5/);
  assert.deepEqual(resolveSurvivalBuffEffects(triple.buff!), [
    { modifierKey: "lc:191810016_1_0", label: "游戏模式乘区", value: "+500%" },
  ]);
  assert.throws(() => resolveSurvivalBuffEffects({ name: "Missing", duration: 1, modifierIds: [404] }), /不在 Lock 中/);
});
