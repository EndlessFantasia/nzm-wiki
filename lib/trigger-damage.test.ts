import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { getOverlimitCatalog } from "@/lib/overlimit";
import {
  getTriggerDamageByOverlimitId,
  getTriggerDamageByPerkSlug,
  TRIGGER_DAMAGE_ENTRIES,
  TRIGGER_DAMAGE_GROUPS,
} from "@/lib/trigger-damage";

test("触发伤害按 S4 状态分组", () => {
  assert.equal(TRIGGER_DAMAGE_GROUPS.current.length, 17);
  assert.equal(TRIGGER_DAMAGE_GROUPS.overlimit.length, 14);
  assert.equal(TRIGGER_DAMAGE_GROUPS.bonds.length, 2);
  assert.equal(TRIGGER_DAMAGE_GROUPS.offline.length, 15);
  assert.equal(TRIGGER_DAMAGE_GROUPS.prototype.length, 21);
  assert.equal(TRIGGER_DAMAGE_GROUPS.historical.length, 1);
  assert.equal(TRIGGER_DAMAGE_GROUPS.unassigned.length, 31);
  assert.equal(TRIGGER_DAMAGE_ENTRIES.length, 101);
});

test("全部明确关联的触发伤害发布至超限快照，保留各项证据缺口", () => {
  const catalog = getOverlimitCatalog();
  const entries = TRIGGER_DAMAGE_ENTRIES.filter(entry => entry.overlimitId);
  assert.equal(entries.length, 15);
  for (const entry of entries) {
    assert.deepEqual(catalog.independentDamage[entry.overlimitId!], [entry], entry.name);
  }
  const sniper = catalog.bonds?.find(bond => bond.name === "狙击")?.effects.find(effect => effect.count === 4);
  assert.match(sniper?.description ?? "", /达到5个.*20秒/);
});

test("未归属配置不凭名称关联普通插件或超限卡片", () => {
  for (const entry of TRIGGER_DAMAGE_GROUPS.unassigned) {
    assert.equal(entry.perkSlug, undefined);
    assert.equal(entry.overlimitId, undefined);
    assert.equal(entry.href, undefined);
    assert.ok(entry.pending);
  }
  assert.equal(getTriggerDamageByPerkSlug("slot-3/泡爆增伤"), undefined);
  assert.equal(getTriggerDamageByPerkSlug("slot-3/捡货炸环"), undefined);
});

test("输入型伤害不折算为固定攻击力白值，区域元素服从Numerical", () => {
  assert.equal(getTriggerDamageByPerkSlug("slot-3/爆破强化")?.damageValue, "原伤害 × 33%");
  assert.equal(getTriggerDamageByOverlimitId("1317129001")?.damageValue, "原伤害作为结算输入");
  assert.ok(getTriggerDamageByOverlimitId("1317129001")?.pending);
  assert.equal(getTriggerDamageByPerkSlug("slot-3/瘟疫之源")?.element, "物理");
  assert.equal(getTriggerDamageByPerkSlug("slot-3/疾风残影")?.element, "物理");
  assert.equal(getTriggerDamageByOverlimitId("20703040473")?.interval, "0.1 秒");
});

test("普通插件映射唯一且全部指向现有详情页", () => {
  const entries = TRIGGER_DAMAGE_ENTRIES.filter((entry) => entry.perkSlug);
  const slugs = entries.map((entry) => entry.perkSlug!);

  assert.equal(new Set(slugs).size, slugs.length);
  for (const slug of slugs) {
    assert.equal(
      existsSync(path.join(process.cwd(), "data", "perks", `${slug}.mdx`)),
      true,
      `缺少插件详情页：${slug}`,
    );
    assert.equal(getTriggerDamageByPerkSlug(slug)?.perkSlug, slug);
  }
});

test("超限触发伤害可按当期卡片 ID 查询", () => {
  const entries = TRIGGER_DAMAGE_GROUPS.overlimit;

  assert.equal(new Set(entries.map((entry) => entry.overlimitId)).size, entries.length);
  for (const entry of entries) {
    assert.equal(
      getTriggerDamageByOverlimitId(entry.overlimitId)?.numericalId,
      entry.numericalId,
    );
  }
});

test("S4正式触发伤害采用已核验的配置，普通插件能按正式slug读取", () => {
  const poison = getTriggerDamageByPerkSlug("slot-4/爆毒蚀域")!;
  assert.equal(poison.damageValue, "350/秒");
  assert.equal(poison.toughness, 0.7);
  const impact = getTriggerDamageByPerkSlug("slot-4/近战冲击")!;
  assert.equal(impact.numericalId, "121800080");
  assert.equal(impact.damageValue, "1250");
  assert.equal(impact.toughness, 2.5);
  assert.equal(getTriggerDamageByOverlimitId("1317229001")?.numericalId, "121800050");
  assert.equal(getTriggerDamageByOverlimitId("1317232001")?.numericalId, "121800052");
  const electric = getTriggerDamageByPerkSlug("slot-4/连锁电环")!;
  assert.equal(electric.numericalId, "11010085");
  assert.equal(electric.damageValue, "50");
  assert.equal(electric.interval, "5 秒");
  assert.equal(getTriggerDamageByPerkSlug("slot-4/释能火环")?.damageValue, "170");
});
