import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import type { Perk } from "../types";
import { parseOverlimitCatalog } from "../lib/overlimit-catalog";
import {
  createOverlimitCardSearchItem,
  createOverlimitPreviewSearchItems,
  createPerkSearchItem,
  createSeasonTalentSearchItem,
  createStatusEffectSearchItem,
  createSummonSearchItem,
  getBuildGuideSearchKeywords,
  generateSearchIndex,
  type SearchItem,
} from "./generate-search-index";
import { getOverlimitCatalog } from "../lib/overlimit";
import { ORIGIN_RUNE_CATALOG } from "../lib/origin-rune-catalog";

// Historical S3 examples remain fixed even after the active release is withdrawn.
const archiveRoot = path.resolve("archives/content-versions/s3/s3.2-final-20260922/files");
const archivedPerks: { perks: Perk[] } = JSON.parse(fs.readFileSync(path.join(archiveRoot, "frozen/perks.json"), "utf8"));
const archivedOverlimit = parseOverlimitCatalog(JSON.parse(fs.readFileSync(path.join(archiveRoot, "data/overlimit/current.json"), "utf8")));

test("perk search separates same-item current and preview editions", () => {
  const perk = archivedPerks.perks.find(perk => perk.itemId === "20703040082");
  assert.ok(perk);
  const current = createPerkSearchItem(perk, { keywords: ["自定义别名"] });
  const preview = createPerkSearchItem({
    ...perk,
    slug: `preview/${perk.slug}`,
    season: "s4-preview",
  });
  assert.equal(current.title, perk.name);
  assert.ok(current.keywords.includes("自定义别名"));
  assert.equal(preview.title, `${perk.name} · s4-preview`);
  assert.equal(preview.path, `/perks/preview/${perk.slug}`);
  assert.notEqual(current.path, preview.path);
  assert.ok(preview.keywords.includes("预览"));
  assert.ok(preview.pinyin.length > 0);
});

test("preview search scopes identical IDs and available modules to the preview route", () => {
  const catalog = structuredClone(archivedOverlimit);
  catalog.season = { id: "s5-preview", label: "S5 Preview", status: "preload", updatedAt: "2027-01-01" };
  catalog.levels = null;
  const items = createOverlimitPreviewSearchItems(catalog);
  assert.ok(items.every(item => item.path.startsWith("/overlimit/preview") && item.title.includes("S5 Preview")));
  assert.ok(items.some(item => item.path.endsWith(`#bonds`)));
  assert.ok(items.some(item => item.path.endsWith(`#map-rotation`)));
  assert.ok(!items.some(item => item.path.endsWith(`#levels`)));
  assert.notEqual(items[0].path, createOverlimitCardSearchItem(catalog.cards[0]).path);
});

test("overlimit search keeps the card summary and structured values", () => {
  const card = archivedOverlimit.cards.find(card => card.id === "20703040082");
  assert.ok(card);
  const item = createOverlimitCardSearchItem(card);

  assert.ok(item.keywords.includes("命中弱点可提升7%伤害，叠加6层。"));
  assert.ok(item.keywords.includes("+7%"));
  assert.ok(item.keywords.includes("+42%"));
  assert.ok(!item.keywords.some((keyword) => keyword.includes("**")));

  const fatalExplosion = archivedOverlimit.cards.find(card => card.id === "20703040437");
  assert.ok(fatalExplosion);
  const fatalExplosionItem = createOverlimitCardSearchItem(fatalExplosion);
  assert.ok(
    fatalExplosionItem.keywords.includes(
      "武器命中有 5% 概率产生爆炸伤害（CD2秒）",
    ),
  );
  assert.ok(!fatalExplosionItem.keywords.some((keyword) => keyword.includes("8%")));
});

test("S4 official content replaces archived S3 and removes preview search routes", (t) => {
  const catalog = getOverlimitCatalog();
  assert.equal(catalog.season.id, "s4");
  assert.equal(catalog.withdrawn, undefined);
  let captured: SearchItem[] | undefined;
  t.mock.method(fs, "writeFileSync", (file: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView) => {
    assert.equal(file, path.resolve("public/search-index.json"));
    captured = JSON.parse(String(data));
  });
  generateSearchIndex([]);
  assert.ok(captured);
  const paths = new Set(captured.map(item => item.path));
  const currentIds = new Set(catalog.cards.map(card => card.id));
  for (const card of archivedOverlimit.cards) if (!currentIds.has(card.id)) {
    assert.ok(!paths.has(`/overlimit/${card.id}`), card.id);
  }
  assert.ok(paths.has("/perks/slot-4/极寒领域"));
  assert.ok(paths.has("/overlimit#bonds"));
  assert.ok(paths.has("/origin#runes"));
  const runeItems = captured.filter((item) => item.path.startsWith("/origin/runes/"));
  assert.equal(runeItems.length, ORIGIN_RUNE_CATALOG.runes.length);
  for (const rune of ORIGIN_RUNE_CATALOG.runes) {
    const item = runeItems.find((item) => item.path === `/origin/runes/${rune.id}`);
    assert.ok(item, rune.id);
    assert.equal(item.title, rune.name);
    assert.ok(item.keywords.includes(rune.id));
    assert.ok(item.keywords.includes(rune.category === "special" ? "特殊强化" : "普通强化"));
    assert.ok(!item.keywords.some((keyword) => keyword.includes("**")));
    assert.ok(item.pinyin.length > 0);
    for (const tag of ORIGIN_RUNE_CATALOG.tags.filter((tag) => rune.tagIds.includes(tag.id))) {
      assert.ok(item.keywords.includes(tag.name), `${rune.id}: ${tag.name}`);
    }
  }
  assert.ok(runeItems.some((item) => item.title === "迅射叠伤" && item.pinyin.includes("xsds")));
  assert.ok(paths.has("/origin#talents"));
  assert.ok(captured.some(item => item.path === "/origin#affixes" && item.keywords.includes("武器词条") && item.pinyin.includes("cttj")));
  assert.ok(captured.some(item => item.path === "/origin#talents" && item.keywords.includes("天赋树") && item.pinyin.includes("ydtf")));
  assert.ok(captured.some(item => item.path === "/origin#runes" && item.keywords.includes("原点猎场") && item.pinyin.includes("qhtj")));
  assert.ok(!captured.some(item => item.path.startsWith("/perks/preview") || item.path.startsWith("/overlimit/preview")));
  assert.ok(!captured.some(item => item.path.includes("archives/content-versions")));
});

test("collects structured S3 build guide keywords", () => {
  const keywords = getBuildGuideSearchKeywords({
    summary: "稳定输出示例",
    source: "小小米河",
    weapons: {
      primary: "精绝兽神",
      secondary: "暗夜之殇",
      melee: "冰点双峰",
    },
    perks: {
      primary: {
        1: "slot-1/万钧过载",
        2: "slot-2/出其不意",
      },
      secondary: {
        3: "slot-3/危险膛压",
        4: "slot-4/冲刺得速",
      },
    },
    talent: { tree: "zero", passive: "2030101", route: "43211" },
  });

  for (const keyword of [
    "精绝兽神",
    "小小米河",
    "暗夜之殇",
    "冰点双峰",
    "万钧过载",
    "危险膛压",
    "零点",
    "爆射扭蛋机",
    "43211",
  ]) {
    assert.ok(keywords.includes(keyword), `missing search keyword: ${keyword}`);
  }
});

test("creates an enemy status-effect search item with a stable deep link", () => {
  const item = createStatusEffectSearchItem({
    buffId: 100300001,
    title: "感电",
    target: "enemy",
    keywords: ["电弧", "易伤", "感电"],
  });

  assert.deepEqual(
    {
      title: item.title,
      slug: item.slug,
      path: item.path,
      category: item.category,
      keywords: item.keywords,
    },
    {
      title: "感电",
      slug: "status-effects/enemy/100300001",
      path: "/posts/enemy-buffs?buff=100300001#status-effect-100300001",
      category: "状态效果",
      keywords: ["100300001", "电弧", "易伤", "感电"],
    },
  );
  assert.ok(item.pinyin.includes("gandian"));
  assert.ok(item.pinyin.includes("gd"));
});

test("creates a player status-effect search item and removes duplicate keywords", () => {
  const item = createStatusEffectSearchItem({
    buffId: 110100085,
    title: "渐入佳境",
    target: "player",
    keywords: ["武器伤害", "110100085", "武器伤害"],
  });

  assert.equal(
    item.path,
    "/posts/player-buffs?buff=110100085#status-effect-110100085",
  );
  assert.equal(item.slug, "status-effects/player/110100085");
  assert.deepEqual(item.keywords, ["110100085", "武器伤害"]);
});

test("creates an S3 talent deep link", () => {
  const item = createSeasonTalentSearchItem({
    season: "s3",
    tree: "zero",
    treeName: "零点",
    id: "2030105",
    title: "轰炸扭蛋机",
    kind: "passive",
    keywords: ["爆炸伤害", "扭蛋"],
  });

  assert.equal(item.title, "轰炸扭蛋机");
  assert.equal(item.slug, "season-talents/s3/zero/passive/2030105");
  assert.equal(
    item.path,
    "/guides/season-talents/s3/zero?passive=2030105#multiplier-provider-passive-2030105",
  );
  assert.equal(item.category, "赛季天赋");
  assert.ok(item.keywords.includes("S3"));
  assert.ok(item.keywords.every((keyword) => !/^S[012]$/i.test(keyword)));
});

test("creates an S4 talent deep link with the interactive builder anchor", () => {
  const item = createSeasonTalentSearchItem({
    season: "s4",
    tree: "dual-star",
    treeName: "双星",
    id: "4010202",
    title: "双星齐射",
    kind: "node",
    keywords: ["伴星", "武器伤害"],
  });

  assert.equal(item.slug, "season-talents/s4/dual-star/node/4010202");
  assert.equal(
    item.path,
    "/guides/season-talents/s4/dual-star?node=4010202#season-talent-node-4010202",
  );
  assert.ok(item.keywords.includes("S4"));
});

test("creates a summon mechanic deep link with Buff and multiplier keywords", () => {
  const item = createSummonSearchItem({
    id: "s3-iron-fist:iron-fist-shockwave",
    title: "S3 铁拳狂徒 · 地裂波与冲击",
    summonId: "s3-iron-fist",
    section: "iron-fist-shockwave",
    kind: "mechanic",
    keywords: ["160403101", "冲击", "易伤乘区"],
  });

  assert.equal(item.category, "召唤物");
  assert.equal(
    item.path,
    "/posts/summons?summon=s3-iron-fist&section=iron-fist-shockwave#summon-s3-iron-fist-iron-fist-shockwave",
  );
  assert.equal(
    item.slug,
    "summons/s3-iron-fist/mechanics/iron-fist-shockwave",
  );
  assert.ok(item.keywords.includes("160403101"));
  assert.ok(item.keywords.includes("易伤乘区"));
});
