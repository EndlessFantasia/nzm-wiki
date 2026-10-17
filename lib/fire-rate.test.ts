import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  FIRE_RATE_EXCLUSIONS,
  WEAPON_FIRE_RATE_SOURCES,
  getBaseFireRateEntries,
  getMechanicFireRateSources,
  getOverlimitFireRateSources,
  getPerkFireRateSources,
} from "./fire-rate";

const expectedWeapons = new Map([
  ["星海狂想", ["+50%"]],
  ["死亡猎手", ["+50%"]],
  ["元宵来袭", ["+40%"]],
  ["死神猎手", ["+40%"]],
  ["爆星", ["+30%"]],
  ["维和者", ["+30%"]],
  ["黄沙风暴", ["+30%"]],
  ["裁决之眼", ["+30%"]],
  ["超级复合弓", ["+30%"]],
  ["钢铁游隼", ["+20%"]],
  ["振弦", ["+3%", "+15%"]],
]);

test("weapon fire-rate registry has exact reviewed sources and valid links", () => {
  const actual = new Map(
    WEAPON_FIRE_RATE_SOURCES.map((source) => [
      source.slug,
      source.stages.map((stage) => stage.value),
    ]),
  );
  assert.deepEqual(actual, expectedWeapons);

  for (const source of WEAPON_FIRE_RATE_SOURCES) {
    assert.ok(source.stages.length > 0, source.id);
    assert.ok(
      fs.existsSync(path.join(process.cwd(), "data/weapons", `${source.slug}.mdx`)),
      source.slug,
    );
  }

});

test("perk fire-rate sources include S4 and offline entries", () => {
  const perks = getPerkFireRateSources();
  assert.deepEqual(
    new Set(perks.map(({ perk }) => perk.name)),
    new Set([
      "不死狂热",
      "反哺",
      "哈士奇支援",
      "哈士奇鼓舞",
      "光暗死神",
      "绝境雷霆",
      "幸运龙炎",
      "狂热兽魂",
      "狂轰乱炸",
      "腐蚀狂热",
      "霜华",
    ]),
  );
  assert.deepEqual(
    new Set(
      perks
        .filter(({ perk }) => perk.collectModItem === 0)
        .map(({ perk }) => perk.name),
    ),
    new Set(["不死狂热", "狂轰乱炸", "幸运龙炎"]),
  );
  const firstOffline = perks.findIndex(({ perk }) => perk.collectModItem !== 1);
  assert.ok(firstOffline >= 0);
  assert.ok(perks.slice(firstOffline).every(({ perk }) => perk.collectModItem !== 1));

  for (const { effect } of perks) {
    assert.equal(effect.statId, "fire-rate");
    assert.ok(effect.stages.length > 0);
  }
});

test("S4 fire-rate stages resolve Numerical values with reviewed conditions", () => {
  const perks = getPerkFireRateSources();
  const byName = new Map(perks.map(({ perk, effect }) => [perk.name, effect]));
  assert.deepEqual(byName.get("哈士奇鼓舞")?.stages, [
    { condition: "位于增幅区域内", value: "+10%" },
  ]);
  assert.deepEqual(byName.get("光暗死神")?.stages, [
    { condition: "光能量每层（替代满充能加成）", value: "+5%" },
    { condition: "5层（持续15秒）", value: "+25%" },
  ]);
  assert.deepEqual(byName.get("绝境雷霆")?.stages, [
    { condition: "每消耗1%主弹匣弹药", value: "+0.6%" },
    { condition: "主弹匣剩余不高于30%", value: "+42%" },
  ]);
  const thunder = perks.find(({ perk }) => perk.name === "绝境雷霆")?.perk;
  assert.ok(thunder?.description?.includes("0.6%"));
  assert.ok(thunder?.description?.includes("42%"));
  assert.doesNotMatch(thunder?.description ?? "", /0\.3%|21%/);
});

test("overlimit fire-rate sources retain current published values independently of perks", () => {
  const cards = getOverlimitFireRateSources();
  assert.deepEqual(
    new Set(cards.map(({ card }) => card.name)),
    new Set(["哈士奇支援"]),
  );

  for (const { effect } of cards) {
    assert.equal(effect.statId, "fire-rate");
    assert.ok(effect.stages.length > 0);
  }

  assert.deepEqual(
    cards.find(({ card }) => card.name === "哈士奇支援")?.effect.stages,
    [{ condition: "每层", value: "+7%" }],
  );
});

test("S4 talents use player fire-rate rows and preserve the six-stack limit", () => {
  const sources = getMechanicFireRateSources("talents");
  assert.deepEqual(sources.map((source) => source.name), ["矩阵共生", "阵列共鸣"]);
  assert.deepEqual(sources.map((source) => source.stages.map((stage) => stage.value)), [
    ["+9%"],
    ["+1.7%", "+10.2%"],
  ]);
});

test("origin sources keep stack totals, initial penalties and cap corrections separate", () => {
  const sources = getMechanicFireRateSources("origin");
  const values = new Map(sources.map((source) => [source.name, source.stages.map((stage) => stage.value)]));
  assert.deepEqual(values.get("怒战狂暴"), ["+5%", "+100%"]);
  assert.deepEqual(values.get("狂战之力"), ["+20%"]);
  assert.deepEqual(values.get("复合弓·备弹"), ["+30%"]);
  assert.deepEqual(values.get("纯白·狂热"), ["-20%", "+20%", "+80%"]);
  const limits = getMechanicFireRateSources("limits");
  assert.deepEqual(limits.map((source) => source.stages.map((stage) => stage.value)), [["+30 个百分点"]]);
  assert.equal(limits[0].name, "纯白·狂热");
  assert.ok(!limits.some((source) => source.name === "怒战狂暴"));

  for (const source of [...sources, ...limits, ...getMechanicFireRateSources("talents")]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), "public", source.icon)), source.icon);
  }
});

test("base fire-rate entries are resolved from weapon sources", async () => {
  const entries = await getBaseFireRateEntries();
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));

  assert.equal(bySlug.get("星海狂想")?.baseRpm, 375);
  assert.ok(Math.abs((bySlug.get("星海狂想")?.maxRpm ?? 0) - 825.3095) < 0.001);
  assert.ok(
    Math.abs((bySlug.get("星海狂想")?.combinedMaxRpm ?? 0) - 1237.9642) <
      0.001,
  );
  assert.equal(bySlug.get("纯白至上")?.baseRpm, 300);
  assert.ok(Math.abs((bySlug.get("纯白至上")?.maxRpm ?? 0) - 660.066) < 0.001);
  assert.ok(Math.abs((bySlug.get("冥河之矛")?.baseRpm ?? 0) - 285.7143) < 0.001);
  assert.ok(Math.abs((bySlug.get("冥河之矛")?.maxRpm ?? 0) - 857.1429) < 0.001);
});

test("fire-rate exclusions cover non-player and unavailable sources", () => {
  assert.deepEqual(
    new Set(FIRE_RATE_EXCLUSIONS.map((entry) => entry.category)),
    new Set([
      "summon-fire-rate",
      "melee-attack-speed",
      "fixed-action-cadence",
      "obsolete",
      "no-public-entity",
      "unverified-current-link",
    ]),
  );
  assert.ok(FIRE_RATE_EXCLUSIONS.some((entry) => entry.id === "resource:121200031"));
  assert.ok(FIRE_RATE_EXCLUSIONS.some((entry) => entry.id === "resource:120600290"));
  assert.ok(FIRE_RATE_EXCLUSIONS.some((entry) => entry.id === "resource:121400010"));
  assert.ok(FIRE_RATE_EXCLUSIONS.some((entry) => entry.id === "resource:120100200"));
  assert.ok(FIRE_RATE_EXCLUSIONS.some((entry) => entry.id === "resource:120700070"));
});
