import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import committed from "../../data/survival/codex.json";
import { collectIconNames, projectSurvivalCodex, readDamageInputs, type SurvivalSourceTables } from "./project-codex";

const content = path.join(process.cwd(), "refs/Exports/NZM/Content");
const rows = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(content, "DataTables/TimeTravelHunt", `${name}.json`), "utf8"))[0].Rows;

function load(): SurvivalSourceTables {
  const mgeBlueprints: Record<string, string> = {};
  for (const file of fs.readdirSync(path.join(content, "Blueprints/Affixes/MGE/SurvivalMode"))) {
    const match = /^(MGE_(1511\d+)_[A-Za-z0-9]+)\.json$/.exec(file);
    if (match) mgeBlueprints[match[2]] = match[1];
  }
  const colors = JSON.parse(fs.readFileSync(path.join(content, "DataTables/UMGStyle/NZSlateColorStyleInfoDataTable.json"), "utf8"))[0].Rows;
  return {
    buffs: rows("STH_RoguelikeBuffTable"),
    show: rows("Survival_BuffShow"),
    limits: rows("STH_RoguelikeBuffLimitTable"),
    mgeBlueprints,
    colorStyles: Object.fromEntries(Object.entries(colors).map(([name, row]) =>
      [name, (row as { ColorStyle: { SpecifiedColor: { Hex: string } } }).ColorStyle.SpecifiedColor.Hex])),
    ...readDamageInputs(content, mgeBlueprints),
  };
}

test("the committed survival codex matches the source tables and ships every icon", () => {
  const projected = projectSurvivalCodex(load());
  assert.deepEqual(projected, committed);
  assert.deepEqual(projected.skills.map((skill) => skill.id), [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008]);
  assert.ok(projected.skills.every((skill) => skill.levels.length === 5));
  assert.ok(projected.passives.every((passive) => passive.levels.length === 5));
  assert.equal(projected.specials.filter((special) => special.atlas).length, 5);
  for (const name of collectIconNames(projected)) {
    assert.ok(fs.existsSync(path.join(process.cwd(), "public/icons/survival", `${name}.webp`)), name);
  }
});

test("temporary boosts resolve to the skills whose MGE they name", () => {
  const projected = projectSurvivalCodex(load());
  const boost = projected.specials.find((special) => special.id === 6062);
  assert.deepEqual(boost?.targetSkillIds, [1001, 1002]);
  assert.equal(boost?.node.effect.params[2], "60");
});

test("damage sources follow the blueprint numerical configs", () => {
  const projected = projectSurvivalCodex(load());
  const strike = projected.skills.find((skill) => skill.id === 1008)!.damageSources;
  assert.deepEqual(strike.map((source) => [source.scope, source.key, source.numericalId, source.level, source.toughness]), [
    ["base", "DirectDamage", 191810003, 1, 14.4],
    ["base", "SplashDamage", 191810004, 1, null],
    ["ultimate", "DirectDamage", 191810003, 6, 43.2],
  ]);
  const frenzy = projected.specials.find((special) => special.id === 6064)!.damageSources;
  assert.deepEqual(frenzy.map((source) => [source.settlement, source.dynamic]), [["CustomDamage", true]]);
  assert.ok(projected.skills.every((skill) => skill.damageSources.some((source) => source.scope === "base")));
});

test("damage drift in blueprints or numerical rows fails the projection", () => {
  const missingRow = load();
  delete missingRow.numericals["191810010_1"];
  assert.throws(() => projectSurvivalCodex(missingRow), /Missing damage numerical: 191810010_1/);

  const renamedKey = load();
  const boomerang = renamedKey.damageAssets["Blueprints/Affixes/MGE/SurvivalMode/Spawnable/BP_Projectile_Boomerang"];
  for (const item of boomerang) {
    for (const config of (item.Properties?.DefaultNumericalConfigs ?? []) as { Key: string }[]) config.Key = "Renamed";
  }
  assert.throws(() => projectSurvivalCodex(renamedKey), /Damage numerical not unique: .*BP_Projectile_Boomerang Damage/);

  const levelDrift = load();
  levelDrift.numericals["191810009_2"] = { ...levelDrift.numericals["191810009_1"], Level: 2, HpCalScale: 9 };
  assert.throws(() => projectSurvivalCodex(levelDrift), /varies by level without an explicit mapping: 191810009_2/);
});

test("broken links in the source tables fail the projection", () => {
  const brokenChain = load();
  brokenChain.buffs["2002"].Prerequisites[0].Value.Params = ["1001"];
  assert.throws(() => projectSurvivalCodex(brokenChain), /Upgrade chain break: 1001 -> 2002/);

  const unknownBlueprint = load();
  delete unknownBlueprint.mgeBlueprints["1511003001"];
  assert.throws(() => projectSurvivalCodex(unknownBlueprint), /Missing MGE blueprint: 1001/);

  const missingRow = load();
  delete missingRow.buffs["2005"];
  assert.throws(() => projectSurvivalCodex(missingRow), /Missing buff row: 2005/);

  const wrongUltimate = load();
  wrongUltimate.show["1"].ProductBuffId = 2015;
  assert.throws(() => projectSurvivalCodex(wrongUltimate), /links disagree: 1001/);

  const unknownColor = load();
  delete unknownColor.colorStyles.E008;
  assert.throws(() => projectSurvivalCodex(unknownColor), /Unknown tag color: 1001 E008/);

  const orphan = load();
  orphan.buffs["9000"] = { ...orphan.buffs["6064"], ID: 9000, Type: 5 };
  assert.throws(() => projectSurvivalCodex(orphan), /Buff rows were not projected: 9000/);
});
