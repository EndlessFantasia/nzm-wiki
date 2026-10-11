import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import rawCatalog from "@/data/overlimit/current.json";
import links from "@/data/overlimit/links.json";
import { parseOverlimitCatalog } from "./overlimit-catalog";
import { getOverlimitCatalog, parseOverlimitPreview } from "./overlimit";
import { getAllOverlimitCards, getOverlimitCardById } from "./overlimit-cards";
import { projectOverlimitLinks } from "./overlimit-links";
import { modifierProviderSourceSchema } from "./modifier-provider-registry";

const minimal = () => ({
  schemaVersion: 1,
  season: { id: "s5", label: "S5", status: "preload", updatedAt: "2027-01-01" },
  provenance: { contentRoot: "fixture/Content", note: "Synthetic evidence", files: [{ path: "fixture.json", sha256: "a".repeat(64) }] },
  cards: [{ id: "1315204001", name: "独立卡", description: "审定的卡片说明", icon: "/icons/card.png", quality: 4,
    applicabilityKnown: false, weaponType: [], weaponItems: [], weaponNames: [], tags: [] }],
  independentDamage: {}, bonds: null, levels: null, mapRotation: null,
});

test("reviewed ordinary cards drop stale warnings while real formula and independent damage gaps remain", () => {
  const cards = getOverlimitCatalog().cards;
  for (const id of ["20703040524", "20703040085", "20703040405", "20703040522"]) {
    const card = cards.find(card => card.id === id)!;
    assert.ok(card.effectValues?.length, id);
    assert.equal(card.verification, undefined, id);
    assert.equal(card.applicabilityKnown, false, "numeric verification does not imply known weapon applicability");
  }
  assert.match(cards.find(card => card.id === "20703040472")!.verification!.note, /冲击波基础伤害/);
  assert.equal(cards.find(card => card.id === "1317100001")!.verification, undefined);
  assert.match(cards.find(card => card.id === "20703040406")!.verification!.note, /恢复的生命值/);
});

test("published cards and damage are complete projections, not current perk joins", () => {
  const catalog = getOverlimitCatalog();
  for (const card of catalog.cards) assert.equal(getOverlimitCardById(card.id), card);
  assert.deepEqual(catalog, rawCatalog);
  assert.deepEqual(getAllOverlimitCards(), rawCatalog.cards);
  assert.deepEqual(links, projectOverlimitLinks(catalog));
  assert.equal(getOverlimitCardById("missing"), undefined);
  for (const file of ["lib/overlimit.ts", "lib/overlimit-cards.ts", "app/(pages)/overlimit/[id]/page.overlimit.tsx"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /from ["'][^"']*(?:\/perks|perk-preview-damage|\/num-modifier-data|\/independent-damage)["']/);
  }
});

test("preview requires registered identity and never replaces current same-ID data", () => {
  const current = getOverlimitCatalog();
  const value = minimal();
  value.season.id = "s5-preview";
  value.cards[0].id = current.cards[0]?.id ?? value.cards[0].id;
  const active = { season: "s5", version: "s5-preview", label: "S5 Preview" };
  assert.equal(parseOverlimitPreview(value, active)?.cards[0].description, "审定的卡片说明");
  assert.equal(getOverlimitCatalog(), current);
  assert.deepEqual(current, rawCatalog);
  assert.throws(() => parseOverlimitPreview(value, undefined));
  assert.throws(() => parseOverlimitPreview(value, { ...active, version: "s6-preview" }));
  assert.throws(() => parseOverlimitPreview({ ...value, season: { ...value.season, status: "current" } }, active));
  assert.equal(parseOverlimitPreview(null, active), null);
});

test("next season can contain independent cards without fabricated slot, weight, or rules", () => {
  const catalog = parseOverlimitCatalog(minimal());
  assert.equal(catalog.cards[0].perkItemId, undefined);
  assert.equal(catalog.cards[0].weight, undefined);
  assert.equal(catalog.cards[0].slot, undefined);
  assert.equal(catalog.cards[0].applicabilityKnown, false);
  assert.equal(catalog.levels, null);
  assert.equal(catalog.mapRotation, null);
  assert.equal(projectOverlimitLinks(catalog).cards[0].perkItemId, null);
});

test("identity collisions, dangling damage, and contradictory applicability fail", () => {
  const duplicate = minimal();
  duplicate.cards.push({ ...duplicate.cards[0] });
  assert.throws(() => parseOverlimitCatalog(duplicate), /重复卡片/);
  const unknown = minimal();
  Object.assign(unknown.cards[0], { weaponNames: ["未知限制"] });
  assert.throws(() => parseOverlimitCatalog(unknown), /未确认适用范围/);
  const wrongDamage = minimal();
  const entry = [{ name: "测试", trigger: "测试", interval: "无", numericalId: "1", damageType: "测试", damageValue: "1", toughness: 0, element: "无", critical: false, weakpoint: false }];
  Object.assign(wrongDamage.independentDamage, { "999999999": entry });
  assert.throws(() => parseOverlimitCatalog(wrongDamage), /非当前卡片/);
});

test("withdrawal allows only an empty current catalog, never an empty published or preview pool", () => {
  const candidate = { ...minimal(), cards: [] };
  assert.throws(() => parseOverlimitCatalog(candidate), /已发布卡池不能为空/);
  assert.throws(() => parseOverlimitCatalog({ ...candidate, withdrawn: true }), /撤下的正式版/);
  const withdrawn = { ...candidate, withdrawn: true, season: { ...candidate.season, status: "current" } };
  assert.equal(parseOverlimitCatalog(withdrawn).cards.length, 0);
  assert.throws(() => parseOverlimitCatalog({ ...withdrawn, cards: minimal().cards }), /撤下的正式版/);
});

test("new bond thresholds and replacement semantics survive parsing", () => {
  const candidate = { ...minimal(), bonds: [{ name: "未来赛季的新羁绊", effects: [
    { count: 2, description: "基础效果" },
    { count: 5, description: "替代效果", mergeType: "Override", overrides: [1] },
    { count: 8, description: "最高效果", mergeType: "Override", overrides: [1, 2] },
  ] }] };
  assert.deepEqual(parseOverlimitCatalog(candidate).bonds, candidate.bonds);
  assert.equal(modifierProviderSourceSchema.safeParse({ type: "overlimit-bond", name: "未来赛季的新羁绊", count: 5 }).success, true);
  assert.equal(modifierProviderSourceSchema.safeParse({ type: "overlimit-card", id: "1315204001" }).success, true);
});

test("unreviewed inspection output cannot be activated as published data", () => {
  assert.throws(() => parseOverlimitCatalog({ ...minimal(), publicationStatus: "unreviewed", rawDescription: "增伤999%" }));
});
