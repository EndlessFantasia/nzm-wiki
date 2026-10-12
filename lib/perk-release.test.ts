import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { getShanghaiDateKey, isValidDateKey } from "./date-key";
import { getPerkAvailability, getPerkConfiguredAvailability, getS4PerkLaunchGroup, isPerkRecent } from "./perk-release";
import { getAllPerks } from "./perks";
import s4NewPerks from "../data/s4-new-perks.json";

const ONLINE_PERK = {
  collectModItem: 1 as const,
  releaseDate: "2026-07-24",
};

test("S4 上新名单精确对应已归档的新插件，按正式服状态分组", () => {
  const archived = JSON.parse(fs.readFileSync(s4NewPerks.source, "utf8")) as {
    entries: { perk: { itemId: string; previewChange: string } }[];
  };
  assert.deepEqual(s4NewPerks.itemIds, archived.entries
    .filter(entry => entry.perk.previewChange === "new")
    .map(entry => entry.perk.itemId).sort());
  const perks = getAllPerks();
  const grouped = perks.filter(perk => getS4PerkLaunchGroup(perk) !== undefined);
  for (const perk of grouped) {
    assert.ok(s4NewPerks.itemIds.includes(perk.itemId));
    assert.equal(getS4PerkLaunchGroup(perk), perk.collectModItem === 1 ? "season-new" : "midseason-new");
  }
  for (const id of s4NewPerks.superItemIds) {
    assert.ok(s4NewPerks.itemIds.includes(id));
    const perk = { itemId: id, season: "s4" };
    assert.equal(getS4PerkLaunchGroup({ ...perk, collectModItem: 0 }), undefined);
    assert.equal(getS4PerkLaunchGroup({ ...perk, collectModItem: 1 }), "season-new");
  }
  for (const id of ["20703040160", "20703040164"]) {
    assert.equal(getS4PerkLaunchGroup({ itemId: id, season: "s4", collectModItem: 1 }), undefined);
  }
});

test("S4 上新只认新插件身份，正式服状态更新覆盖历史分组", () => {
  const perk = { itemId: s4NewPerks.itemIds[0], season: "s4", collectModItem: 1 as const };
  assert.equal(getS4PerkLaunchGroup(perk), "season-new");
  assert.equal(getS4PerkLaunchGroup({ ...perk, collectModItem: 0 }), "midseason-new");
  assert.equal(getS4PerkLaunchGroup({ ...perk, season: "s3" }), undefined);
  assert.equal(getS4PerkLaunchGroup({ ...perk, season: "s4-preview" }), undefined);
  assert.equal(getS4PerkLaunchGroup({ ...perk, itemId: "20703040160" }), undefined);
  assert.equal(getS4PerkLaunchGroup({ ...perk, itemId: "20703040164" }), undefined);
  assert.equal(getS4PerkLaunchGroup({ ...perk, itemId: "" }), undefined);
});

test("上线当天属于近期上新", () => {
  assert.equal(isPerkRecent(ONLINE_PERK, "2026-07-24"), true);
});

test("各赛季预览与正式上线、未上线状态独立，不受收集开关和日期影响", () => {
  for (const season of ["s4-preview", "s5-preview"]) {
    for (const collectModItem of [0, 1] as const) {
      const perk = { ...ONLINE_PERK, season, collectModItem };
      assert.equal(getPerkAvailability(perk), "preview");
      assert.equal(getPerkConfiguredAvailability(perk), collectModItem === 1 ? "online" : "offline");
      assert.equal(isPerkRecent(perk, "2026-07-24"), false);
    }
  }
});

test("configured availability only treats CollectMODItem=1 as online", () => {
  assert.equal(getPerkConfiguredAvailability({ collectModItem: 1 }), "online");
  assert.equal(getPerkConfiguredAvailability({ collectModItem: 0 }), "offline");
  assert.equal(getPerkConfiguredAvailability({}), "offline");
});

test("正式赛季插件按实际投放状态分类，正式上线后可进入近期上线", () => {
  assert.equal(getPerkAvailability({ ...ONLINE_PERK, season: "s5" }), "online");
  assert.equal(
    getPerkAvailability({ collectModItem: 0, season: "s5" }),
    "offline",
  );
  assert.equal(isPerkRecent({ ...ONLINE_PERK, season: "s5" }, "2026-07-24"), true);
});

test("上线后的第 7 个自然日仍属于近期上新", () => {
  assert.equal(isPerkRecent(ONLINE_PERK, "2026-07-30"), true);
});

test("上线后的第 8 个自然日起失效", () => {
  assert.equal(isPerkRecent(ONLINE_PERK, "2026-07-31"), false);
});

test("未来日期、缺失日期和未上线插件不属于近期上新", () => {
  assert.equal(isPerkRecent(ONLINE_PERK, "2026-07-23"), false);
  assert.equal(
    isPerkRecent({ collectModItem: 1, releaseDate: undefined }, "2026-07-24"),
    false,
  );
  assert.equal(
    isPerkRecent({ collectModItem: 0, releaseDate: "2026-07-24" }, "2026-07-24"),
    false,
  );
});

test("日期键必须是有效的 YYYY-MM-DD 日历日期", () => {
  assert.equal(isValidDateKey("2026-07-24"), true);
  assert.equal(isValidDateKey("2026-02-29"), false);
  assert.equal(isValidDateKey("2026-7-24"), false);
  assert.equal(isValidDateKey("invalid"), false);
});

test("北京时间日期键正确处理 UTC 日期边界", () => {
  assert.equal(
    getShanghaiDateKey(new Date("2026-07-23T15:59:59Z")),
    "2026-07-23",
  );
  assert.equal(
    getShanghaiDateKey(new Date("2026-07-23T16:00:00Z")),
    "2026-07-24",
  );
});
