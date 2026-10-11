import assert from "node:assert/strict";
import test from "node:test";
import { getAllPerks } from "@/lib/perks";
import { getWeaponExclusivePerks } from "./weapon-perks";
import type { Perk } from "@/types";

function perk(name: string, overrides: Partial<Perk> = {}): Perk {
  return {
    id: name,
    itemId: name,
    slug: `slot-4/${name}`,
    name,
    slot: 4,
    rarity: "传说",
    category: "伤害类",
    effects: [],
    collectModItem: 1,
    weaponNames: ["层流冷焰"],
    ...overrides,
  };
}

test("matches only explicit, exact weapon names, including shared exclusives", () => {
  const shared = perk("共享专插", { weaponNames: ["层流冷焰", "飓风之龙"] });
  const perks = [
    shared,
    perk("通用插件", { weaponNames: [] }),
    perk("类型插件", { weaponNames: undefined, weaponType: [1] }),
    perk("描述提及", { weaponNames: undefined, description: "层流冷焰" }),
    perk("相似名称", { weaponNames: ["层流冷焰改"] }),
  ];
  assert.deepEqual(getWeaponExclusivePerks(perks, "层流冷焰"), {
    online: [shared], offline: [],
  });
  assert.deepEqual(getWeaponExclusivePerks(perks, "飓风之龙").online, [shared]);
  assert.deepEqual(getWeaponExclusivePerks(perks, "冷焰"), { online: [], offline: [] });
});

test("partitions availability without treating manufacture or packaging as release", () => {
  const online = perk("已上线");
  const offline = perk("未上线", { collectModItem: 0, makeModItem: 1, isCooked: true });
  const unknown = perk("未声明", { collectModItem: undefined });
  const result = getWeaponExclusivePerks([offline, online, unknown], "层流冷焰");
  assert.deepEqual(result.online, [online]);
  assert.deepEqual(new Set(result.offline), new Set([offline, unknown]));
  assert.deepEqual(getWeaponExclusivePerks([online], "层流冷焰"), { online: [online], offline: [] });
  assert.deepEqual(getWeaponExclusivePerks([offline], "层流冷焰"), { online: [], offline: [offline] });
});

test("excludes next-season previews even when their collection flag is enabled", () => {
  const previews = [
    perk("赛季预览", { season: "s5-preview" }),
    perk("预览通道", { slug: "preview/slot-4/预览通道" }),
  ];
  assert.deepEqual(getWeaponExclusivePerks(previews, "层流冷焰"), { online: [], offline: [] });
});

test("sorts each group by slot then Chinese name without reordering the catalog", () => {
  const entries = [
    perk("丙", { slot: 4 }),
    perk("乙", { slot: 1 }),
    perk("甲", { slot: 1 }),
    perk("未上线乙", { slot: 4, collectModItem: 0 }),
    perk("未上线甲", { slot: 2, collectModItem: 0 }),
  ];
  const original = [...entries];
  const { online, offline } = getWeaponExclusivePerks(entries, "层流冷焰");
  assert.deepEqual(online.map(({ name }) => name), ["甲", "乙", "丙"]);
  assert.deepEqual(offline.map(({ slot }) => slot), [2, 4]);
  assert.deepEqual(entries, original);
});

test("current catalog resolves a known exclusive and never returns general perks", () => {
  const { online, offline } = getWeaponExclusivePerks(getAllPerks(), "层流冷焰");
  const result = [...online, ...offline];
  assert.ok(result.some(({ name }) => name === "冷焰爆破"));
  assert.ok(result.every(({ weaponNames }) => weaponNames?.includes("层流冷焰")));
});
