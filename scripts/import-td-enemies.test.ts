import assert from "node:assert/strict";
import test from "node:test";
import {
  mapMonsterType,
  mergeFrontmatter,
  normalizeNarrative,
} from "./import-td-enemies";

test("塔防敌人类型映射保持现有图鉴约定", () => {
  assert.equal(mapMonsterType(3), "normal");
  assert.equal(mapMonsterType(4), "normal");
  assert.equal(mapMonsterType(5), "elite");
  assert.equal(mapMonsterType(7), "boss");
  assert.equal(mapMonsterType(6), null);
});

test("描述清理移除 Unreal 换行标签和无效 None", () => {
  assert.equal(normalizeNarrative("第一句。<br><br>第二句。"), "第一句。第二句。");
  assert.equal(normalizeNarrative("None"), "");
});

test("frontmatter 合并保留昵称、射程和其他人工字段", () => {
  const merged = mergeFrontmatter(
    {
      title: "测试",
      nickname: "别名",
      attack_range: 3,
      search_range: 5,
      custom: "manual",
    },
    {
      title: "测试",
      type: "normal",
      attack: 10,
      hp: 100,
      hitback_hp: -1,
      hardstraight_hp: -1,
      weight: 1,
      speed: 5,
      kill_money: 20,
      description: "描述",
    },
  );

  assert.equal(merged.nickname, "别名");
  assert.equal(merged.attack_range, 3);
  assert.equal(merged.search_range, 5);
  assert.equal(merged.custom, "manual");
});
