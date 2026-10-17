import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  getTriggerDamageByOverlimitId,
  getTriggerDamageByPerkSlug,
  TRIGGER_DAMAGE_ENTRIES,
  TRIGGER_DAMAGE_GROUPS,
} from "@/lib/trigger-damage";

test("触发伤害按 S4 状态分组", () => {
  assert.equal(TRIGGER_DAMAGE_GROUPS.current.length, 14);
  assert.equal(TRIGGER_DAMAGE_GROUPS.overlimit.length, 12);
  assert.equal(TRIGGER_DAMAGE_GROUPS.offline.length, 14);
  assert.equal(TRIGGER_DAMAGE_GROUPS.prototype.length, 21);
  assert.equal(TRIGGER_DAMAGE_GROUPS.historical.length, 1);
  assert.equal(TRIGGER_DAMAGE_ENTRIES.length, 62);
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
