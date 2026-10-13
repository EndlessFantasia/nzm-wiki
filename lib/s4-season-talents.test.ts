import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import dualStar from "../data/season-talents/s4/dual-star.json";
import matrixSymbiosis from "../data/season-talents/s4/matrix-symbiosis.json";
import blackHole from "../data/season-talents/s4/black-hole.json";
import passives from "../data/season-talents/s4/passives.json";
import registry from "../data/modifier-providers.json";
import { parseModifierProviderRegistry } from "./modifier-provider-registry";
import { NUM_MODIFIER_RESOLVER } from "./num-modifier-data";
import { getProviderRelationsForSource, getSourcesForModifierType, resolveMultiplierSourceHref } from "./multiplier-data";
import { highestLevelApplications } from "../scripts/project-s4-talent-index";

const trees = [dualStar, matrixSymbiosis, blackHole];
const s4Registry = parseModifierProviderRegistry(registry);

test("S4 正式天赋树与被动可发布，全部节点和图标引用闭合", () => {
  assert.equal(passives.draft, false);
  for (const tree of trees) {
    assert.equal(tree.draft, false);
    assert.equal(tree.nodes.filter((node) => node.isRoot).length, 1);
    const ids = new Set(tree.nodes.map((node) => node.id));
    assert.equal(ids.size, tree.nodes.length);
    for (const node of tree.nodes) {
      assert.ok(node.maxLevel > 0);
      assert.ok(node.descriptions.length > 0);
      assert.ok(node.descriptions.every((description) => description && description !== "暂无技能说明"));
      assert.ok(node.prerequisites.every((id) => ids.has(id)), `${tree.id}/${node.id} prerequisite`);
      assert.ok(fs.existsSync(path.join(process.cwd(), "public", node.icon)), node.icon);
    }
  }
});

test("S4 每个节点和被动有唯一的来源审计，最高等级索引覆盖所有等级", () => {
  for (const tree of trees) {
    const options = passives.trees[tree.id as keyof typeof passives.trees];
    const entries = [
      ...tree.nodes.map(node => ({ node, passive: false, maxLevel: node.maxLevel })),
      ...[...options.light, ...options.dark].map(node => ({ node, passive: true, maxLevel: 1 })),
    ];
    for (const { node, passive, maxLevel } of entries) {
      const id = `season:s4:${tree.id}:${passive ? "passive:" : ""}${node.id}`;
      const reviews = [...s4Registry.providers, ...s4Registry.exclusions].filter(entry => entry.id === id);
      assert.equal(reviews.length, 1, id);
      const review = reviews[0];
      assert.deepEqual(review.source, { type: "season-talent", season: "s4", tree: tree.id, ...(passive ? { passiveId: node.id } : { nodeId: node.id }) });
      if (!("applications" in review)) continue;
      for (const application of review.applications ?? []) {
        const row = NUM_MODIFIER_RESOLVER.getRow(application.expression.row);
        const levels = new Set(NUM_MODIFIER_RESOLVER.getRowsById("lc", row.id).map(item => item.level));
        assert.equal(row.level, levels.size === 1 ? [...levels][0] : maxLevel, `${id}/${row.key}`);
      }
      const relations = getProviderRelationsForSource(review.source);
      assert.ok(relations.length > 0, id);
      for (const relation of relations) {
        assert.ok(getSourcesForModifierType(relation.modifierTypeId).includes(relation));
        assert.equal(relation.effectId, id);
      }
      assert.ok(resolveMultiplierSourceHref(review.source).includes(`?${passive ? "passive" : "node"}=${node.id}`));
    }
  }
});

test("S4 最高等级采用精确行；零基础值保留系数，纯射速不进乘区", () => {
  assert.deepEqual(highestLevelApplications(160401004, 3, "damage-event").map(item => item.expression), [{ row: "lc:160401004_3_2", field: "coefficient" }]);
  assert.deepEqual(highestLevelApplications(111031067, 3, "enemy").map(item => item.expression), [{ row: "lc:111031067_3_0", field: "base" }]);
  assert.deepEqual(highestLevelApplications(111053009, 5, "damage-event").map(item => item.expression), [{ row: "lc:111053009_5_0", field: "base" }]);
  assert.equal(highestLevelApplications(130040033, 1, "ally").length, 1);
  assert.throws(() => highestLevelApplications(111053009, 6, "self"), /Missing S4 Modifier/);
});

test("S4 多乘区被动与特殊修正保留作用范围，不复制其他赛季来源", () => {
  const byId = new Map(s4Registry.providers.map(entry => [entry.id, entry]));
  const dark = byId.get("season:s4:dual-star:passive:2040111")!;
  assert.deepEqual(getProviderRelationsForSource(dark.source).map(item => item.factorId).sort(), ["dilution", "weakness"]);
  const correction = byId.get("season:s4:dual-star:4010102")!;
  assert.equal(getProviderRelationsForSource(correction.source)[0].modifierTypeId, "correction-parameter");
  assert.equal(correction.applications![0].context.recipient, "damage-event");
  const hunter = byId.get("season:s4:dual-star:passive:2040115")!;
  assert.equal(hunter.evidence.kind, "reviewed-override");
  assert.equal(hunter.applications, undefined);
  assert.deepEqual(hunter.reviewedFacetIds, ["game-mode"]);
});

test("S4 各树的光暗被动各有唯一默认项，资源和身份完整", () => {
  for (const tree of Object.values(passives.trees)) {
    for (const energy of ["light", "dark"] as const) {
      const options = tree[energy];
      assert.equal(options.filter((passive) => passive.isDefault).length, 1);
      assert.equal(new Set(options.map((passive) => passive.id)).size, options.length);
      assert.ok(options.every((passive) => passive.energy === energy));
      for (const passive of options) {
        assert.ok(passive.description && passive.description !== "暂无技能说明");
        assert.ok(fs.existsSync(path.join(process.cwd(), "public", passive.icon)), passive.icon);
      }
    }
  }
});
