import assert from "node:assert/strict";
import test from "node:test";
import {
  getIndependentDamageByOverlimitId,
  getIndependentDamageByPerkSlug,
} from "./independent-damage";
import { getAllPerks, getPerkBySlug } from "./perks";
import { getPerkPreviewCatalog } from "./perk-preview";
import { getOverlimitCatalog } from "./overlimit";

const EXPECTED_REFERENCES = new Map([
  ["slot-4/强袭", ["能源之影", "qiang-xi-ji-guang"]],
  ["slot-4/恶鬼眷顾", ["鬼铜蚀", "d-o-t-chi-shang-hai-jian-su-cha-jian"]],
  ["slot-4/索命龙炎", ["飓风之龙", "seeking-dragon-flame"]],
  ["slot-4/自动龙炎", ["飓风之龙", "automatic-dragon-flame"]],
  ["slot-4/腾焰", ["炼狱蝎王", "teng-yan"]],
  ["slot-4/蝎刺", ["炼狱蝎王", "xie-ci"]],
  ["slot-4/贯长虹", ["夜影之逝", "guan-chang-hong-jian-qi"]],
  ["slot-4/霜华", ["星海狂想", "frost-ice-spike"]],
]);

test("专属插件显式引用全部独立武器伤害来源", () => {
  const actual = getAllPerks().flatMap((perk) =>
    (perk.independentDamageSources ?? []).map(
      (reference) =>
        [
          perk.slug,
          [reference.weaponSlug, reference.damageSourceId],
        ] as const,
    ),
  );
  const expected = [
    ...EXPECTED_REFERENCES,
    ["slot-4/腐蚀飞弹", ["幽冥毒皇", "corrosive-missile-explosion"]],
    ["slot-4/腐蚀飞弹", ["幽冥毒皇", "corrosive-missile-hit"]],
    ["slot-4/极寒领域", ["极寒冰神", "cold-field"]],
    ["slot-4/极寒之触", ["极寒冰神", "cryo-touch"]],
    ["slot-4/极寒之痕", ["极寒冰神", "ice-orb"]],
  ];
  const byReference = (a: unknown, b: unknown) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b));
  assert.deepEqual(actual.sort(byReference), expected.sort(byReference));
});

test("腐蚀飞弹替换白值，不能把未调用的500% Modifier叠入伤害", async () => {
  const damage = await getIndependentDamageByPerkSlug("slot-4/腐蚀飞弹");
  assert.deepEqual(damage.map(entry => [entry.numericalId, entry.damageValue]), [
    ["120600064", "900"],
    ["120600065", "15"],
  ]);
  const perk = getPerkBySlug("slot-4/腐蚀飞弹")!;
  assert.equal(getPerkBySlug("preview/slot-4/腐蚀飞弹"), undefined);
  assert.deepEqual(await getIndependentDamageByPerkSlug("preview/slot-4/腐蚀飞弹"), []);
  assert.doesNotMatch(perk.description!, /\{GPNumericalID:|\{\{num:/);
});

test("S4正式独立伤害使用明确武器引用，旧预览入口不再返回数据", async () => {
  const catalog = getPerkPreviewCatalog();
  assert.equal(catalog, null);
  for (const [name, sourceId] of [
    ["极寒领域", "cold-field"],
    ["极寒之触", "cryo-touch"],
    ["极寒之痕", "ice-orb"],
  ]) {
    const perk = getPerkBySlug(`slot-4/${name}`);
    assert.ok(perk);
    assert.deepEqual(perk.independentDamageSources?.map(reference => [reference.weaponSlug, reference.damageSourceId]), [["极寒冰神", sourceId]]);
    assert.equal(getPerkBySlug(`preview/slot-4/${name}`), undefined);
    assert.deepEqual(await getIndependentDamageByPerkSlug(`preview/slot-4/${name}`), []);
  }
});

test("武器来源解析为插件详情页独立伤害表格", async () => {
  const rainbow = await getIndependentDamageByPerkSlug("slot-4/贯长虹");
  assert.deepEqual(rainbow, [
    {
      name: "贯长虹",
      trigger: "切出本武器时向前发射剑气",
      interval: "10秒",
      numericalId: "120300245",
      damageType: "近战伤害",
      damageValue: "4500",
      toughness: "56.5",
      element: "电弧",
      critical: true,
      weakpoint: true,
      weakpointMultiplier: 1.2,
    },
  ]);

  const automatic = await getIndependentDamageByPerkSlug("slot-4/自动龙炎");
  assert.equal(automatic[0]?.numericalId, "120300114");
  assert.equal(automatic[0]?.damageValue, "75");

  const seeking = await getIndependentDamageByPerkSlug("slot-4/索命龙炎");
  assert.equal(seeking[0]?.numericalId, "120300113");
  assert.equal(seeking[0]?.damageValue, "90");
});

test("超限独立伤害完全服从当前发布快照", async () => {
  const catalog = getOverlimitCatalog();
  const cardIds = new Set(catalog.cards.map(card => card.id));
  for (const [id, entries] of Object.entries(catalog.independentDamage)) {
    assert.ok(cardIds.has(id), `孤立独立伤害条目 ${id}`);
    const actual = await getIndependentDamageByOverlimitId(id);
    assert.deepEqual(actual, entries, id);
    for (const entry of actual) {
      assert.ok(entry.numericalId && entry.damageValue && entry.trigger, id);
    }
  }
  for (const card of catalog.cards) {
    if (!Object.hasOwn(catalog.independentDamage, card.id)) {
      assert.deepEqual(await getIndependentDamageByOverlimitId(card.id), [],
        `未发布独立伤害的卡片不能从普通插件回填：${card.id}`);
    }
  }
});

test("致命爆炸的正式超限词条与插件、触发伤害记录一致", async () => {
  const damage = await getIndependentDamageByOverlimitId("20703040437");
  assert.equal(damage.length, 1);
  assert.deepEqual(damage, await getIndependentDamageByPerkSlug("slot-4/致命爆炸"));
  assert.equal(damage[0].interval, "0.1 秒");
  assert.match(damage[0].trigger, /5%.*8 米/);
  assert.equal(damage[0].numericalId, "130103014");
  assert.equal(damage[0].damageValue, "5000");
  assert.equal(damage[0].toughness, 10);
  assert.equal(damage[0].critical, true);
  assert.equal(damage[0].weakpoint, false);
  assert.match(getPerkBySlug("slot-4/致命爆炸")!.description!, /<strong>0\.1<\/strong>秒/);
});

test("退出卡池的插件与未知ID不能泄漏到超限独立伤害", async () => {
  const catalog = getOverlimitCatalog();
  const cardIds = new Set(catalog.cards.map(card => card.id));
  const absentPerks = getAllPerks().filter(perk =>
    !cardIds.has(perk.itemId) && perk.independentDamageSources?.length);
  for (const perk of absentPerks) {
    assert.ok((await getIndependentDamageByPerkSlug(perk.slug)).length > 0,
      `普通插件仍有独立伤害：${perk.slug}`);
    assert.deepEqual(await getIndependentDamageByOverlimitId(perk.itemId), [],
      `超限不继承未发布的普通插件：${perk.slug}`);
  }
  const missingId = "unpublished-overlimit-card";
  assert.equal(cardIds.has(missingId), false);
  assert.deepEqual(await getIndependentDamageByOverlimitId(missingId), []);
});
