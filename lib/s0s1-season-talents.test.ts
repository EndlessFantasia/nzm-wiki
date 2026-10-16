import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getLegacyTalentCatalog, getLegacyTalentTree, resolveLegacyTalentCatalog, resolveLegacyTalentFact, type LegacyTalentFact, type LegacyTalentLevel, type LegacyTalentTree } from "./s0s1-season-talents";
import { buildTrees, sanitizeDescription, auditActiveSkill, extract, UNVERIFIED, type Evidence } from "../scripts/s0s1-season-talents/extract";
import { checkProjection } from "../scripts/s0s1-season-talents/check";
import { NUM_MODIFIER_LOCK, NUM_MODIFIER_RESOLVER, NUM_MODIFIER_SEMANTICS } from "./num-modifier-data";
import { createNumModifierResolver } from "./num-modifier";
import { summarizeSemanticReview } from "../scripts/s0s1-season-talents/semantic-conflicts";

const evidence = (season: string): Evidence => JSON.parse(readFileSync(`data/season-talents/${season}/audit.json`, "utf8"));
const emptyLevel = (level = 1): LegacyTalentLevel => ({ level, description: "", modifierRows: [], facts: [], warnings: [] });

test("refresh without the reviewed script export cannot discard execution evidence", () => {
  assert.ok(evidence("s1").valueEvidence?.s1?.taboo);
  const files = ["s0", "s1"].flatMap(season => ["audit", "trees"].map(name => `data/season-talents/${season}/${name}.json`));
  const before = files.map(file => readFileSync(file, "utf8"));
  assert.throws(() => extract(), /S1_BLUEPRINT_REQUIRED/);
  assert.deepEqual(files.map(file => readFileSync(file, "utf8")), before);
});

test("catalog identity, node counts, branch status and video boundary", () => {
  assert.deepEqual(getLegacyTalentCatalog("s0").map((tree) => [tree.id, tree.nodeCount]), [["frost-barrage", 26], ["destruction-dream", 26], ["mechanical-dance", 26]]);
  assert.deepEqual(getLegacyTalentCatalog("s1").map((tree) => [tree.id, tree.nodeCount]), [["kunlun-wood", 31], ["phantom-form", 30], ["forbidden-eye", 30]]);
  const s0 = getLegacyTalentCatalog("s0");
  assert.equal(s0.filter((tree) => tree.historicalStatus === "video-confirmed").length, 2);
  assert.equal(getLegacyTalentTree("s0", "destruction-dream")?.historicalStatus, "unconfirmed");
  assert.equal(getLegacyTalentTree("s0", "mechanical-dance")?.nodes.find((node) => node.isRoot)?.name, "机械之舞");
  assert.ok(s0.every((tree) => tree.evidenceNotes.some((note) => note.includes("节点、连线与录像尚未逐项核对"))));
  assert.deepEqual(getLegacyTalentCatalog("../../refs"), []);
  assert.equal(getLegacyTalentTree("s1", "frost-barrage"), undefined);
});

test("extra Basic node is excluded, not silently added", () => {
  const audit = evidence("s0");
  assert.deepEqual(audit.excluded.map((node) => node.id), ["1003606"]);
  assert.ok(buildTrees(audit).every((tree) => tree.nodes.every((node) => node.id !== "1003606")));
});

test("literal numbers and unsupported tokens are masked, semantic wording remains", () => {
  const level = emptyLevel();
  const text = sanitizeDescription("<T002>命中</>后增加40%伤害，持续3秒，释放一枚飞弹；{Passive:123:1:Count}", level, "fixture");
  assert.equal(text, `命中后增加${UNVERIFIED}伤害，持续${UNVERIFIED}秒，释放${UNVERIFIED}枚飞弹；${UNVERIFIED}`);
  assert.ok(level.warnings.some((warning) => warning.startsWith("UNRESOLVED_TOKEN")));
  assert.equal(level.modifierRows.length, 0);
});

test("GP tokens use exact Resolver identity and never silently assume talent level", () => {
  const level = emptyLevel(3);
  const text = sanitizeDescription("提升{GPModifier:160201010:BaseValue:0:13}，持续99秒", level, "fixture");
  assert.ok(level.modifierRows.length);
  assert.ok(level.facts.every((fact) => fact.value.includes("Level=1")));
  assert.ok(level.warnings.some((warning) => warning.startsWith("TOKEN_DEFAULT_LEVEL")));
  assert.ok(!text.includes("99"));
  const missing = emptyLevel();
  assert.equal(sanitizeDescription("{GPModifier:999999999999:BaseValue:0:13}", missing, "fixture"), UNVERIFIED);
  assert.ok(missing.warnings.length);
});

test("missing Main config is not replaced by same-ID historical table or guessed values", () => {
  const audit = evidence("s0");
  delete audit.tables.params["1318103001"];
  const levels = buildTrees(audit).find((tree) => tree.id === "mechanical-dance")!.nodes.find((node) => node.skillIds.includes(1318103001))!.levels;
  assert.ok(levels.every((level) => level.warnings.some((warning) => warning.startsWith("MISSING_CURRENT_CONFIG"))));
  assert.ok(levels.every((level) => !level.facts.some((fact) => fact.source.includes("DT_MGEParamConfig_Main.json#1318103001"))));
});

test("missing exact Modifier levels do not fall back to level one", () => {
  const level = getLegacyTalentTree("s0", "mechanical-dance")!.nodes.find((node) => node.skillIds.includes(1318103001))!.levels[1];
  assert.ok(level.warnings.some((warning) => warning.startsWith("MISSING_MODIFIER:") && warning.includes("Level=2")));
  assert.ok(!level.facts.some((fact) => fact.source.includes("Parameters[0]") && fact.source.includes(" -> lc:")));
});

test("missing structure and Basic levels fail rather than inventing nodes", () => {
  const audit = evidence("s0");
  delete audit.tables.structure1[Object.keys(audit.tables.structure1)[0]];
  assert.throws(() => buildTrees(audit), /seven structure phases/);
  const missingLevel = evidence("s0");
  delete missingLevel.tables.basic["10011061"];
  assert.throws(() => buildTrees(missingLevel), /missing or inconsistent Basic levels/);
});

test("runtime uses only the existing server Numerical adapter, never refs or direct Lock JSON", () => {
  const reader = readFileSync("lib/s0s1-season-talents.ts", "utf8");
  assert.doesNotMatch(reader, /(?:from|import\s*\()[^\n]*(?:num-modifier-lock\.json|refs|scripts)/);
  assert.match(reader, /from "@\/lib\/num-modifier-data"/);
});

test("reviewed description bindings resolve dynamically without copying Numerical values", () => {
  const input = rawCatalog("s0");
  const level = input[0].nodes[0].levels[0];
  level.descriptionTemplate = "近距离伤害提高{{num:damage|percent}}。";
  level.descriptionBindings = { damage: { row: "lc:1701000105_1_0", field: "base" } };
  const lock = structuredClone(NUM_MODIFIER_LOCK);
  lock.rows.lc["1701000105_1_0"].raw.BaseValue = .42;
  const resolver = createNumModifierResolver(lock, NUM_MODIFIER_SEMANTICS);
  assert.equal(resolveLegacyTalentCatalog(input, resolver)[0].nodes[0].levels[0].description, "近距离伤害提高42%。");
  delete lock.rows.lc["1701000105_1_0"];
  assert.throws(() => resolveLegacyTalentCatalog(input, createNumModifierResolver(lock, NUM_MODIFIER_SEMANTICS)), /MISSING_ROW/);
});

const rawCatalog = (season: string): LegacyTalentTree[] => JSON.parse(readFileSync(`data/season-talents/${season}/trees.json`, "utf8"));
const modifierFact: LegacyTalentFact = { label: "stale", value: "stale", source: "opaque provenance (not a row reference)", modifierRow: "lc:160201010_1_0" };
const driftedResolver = (fields: Record<string, string | number>) => {
  const lock = structuredClone(NUM_MODIFIER_LOCK);
  Object.assign(lock.rows.lc["160201010_1_0"].raw, fields);
  return createNumModifierResolver(lock, NUM_MODIFIER_SEMANTICS);
};

test("live Modifier facts recompute Base, Coef and operation from explicit row identity", () => {
  const changed = driftedResolver({ AttributeName: "GPAttributeSetCritical.CriticalRatio", BaseValue: 0.77, CoefValue: 0.13, GPModifierOp: "B1" });
  const fact = resolveLegacyTalentFact(modifierFact, changed);
  assert.match(fact.value, /BaseValue=0.77; CoefValue=0.13; GPModifierOp=B1/);
  assert.match(fact.displayValue!, /Base \+77%.*Coef \+13%/);
  assert.notEqual(fact.label, "stale");
  assert.equal(fact.source, modifierFact.source);
  assert.equal(modifierFact.value, "stale");
});

test("B1 without a registered quantity stays raw instead of guessing a percentage", () => {
  const fact = resolveLegacyTalentFact(modifierFact, driftedResolver({ GPModifierOp: "B1", BaseValue: 0.77 }));
  assert.match(fact.displayValue!, /^原值 Base=0.77;/);
  assert.doesNotMatch(fact.displayValue!, /%/);
});

test("attribute changes use canonical labels and quantity rather than stale labels", () => {
  const resolver = driftedResolver({ AttributeName: "GPAttributeSetCritical.CriticalRatio", GPModifierOp: "B1", BaseValue: 0.2, CoefValue: 0 });
  const fact = resolveLegacyTalentFact(modifierFact, resolver);
  assert.equal(fact.label, "暴击率 (B1)");
  assert.equal(fact.displayValue, "加法 Base +20%");
});

for (const operation of ["B2", "B3", "B4", "B5", "F", "O"]) {
  test(`${operation} remains raw: no percentage, factor or inferred formula`, () => {
    const fact = resolveLegacyTalentFact(modifierFact, driftedResolver({ GPModifierOp: operation, BaseValue: 0.2 }));
    assert.match(fact.displayValue!, /^原值 Base=0.2;/);
    assert.ok(fact.displayValue!.endsWith(`op=${operation}`));
    assert.doesNotMatch(fact.displayValue!, /%|加法|乘以|×/);
  });
}

test("source text never becomes a runtime row key, with or without an explicit reference", () => {
  const literal = { label: "literal", value: "12 秒", source: "lc:160201010_1_0" };
  assert.deepEqual(resolveLegacyTalentFact(literal), literal);
  assert.equal(resolveLegacyTalentFact({ ...modifierFact, source: "lc:999999999_1_0" }).modifierRow, modifierFact.modifierRow);
  assert.throws(() => resolveLegacyTalentFact({ ...modifierFact, modifierRow: "lc:999999999_1_0", source: "lc:160201010_1_0" }), /MISSING_ROW/);
});

test("live catalog recalculates both facts and bound prose after a Lock value change", () => {
  const raw = rawCatalog("s1");
  const changed = driftedResolver({ BaseValue: 0.77, CoefValue: 0.13 });
  const live = resolveLegacyTalentCatalog(raw, changed);
  const tokenLevels = live.flatMap((tree) => tree.nodes.flatMap((node) => node.levels)).filter((level) => Object.values(level.descriptionBindings ?? {}).some(binding => binding.row === "lc:160201010_1_0"));
  assert.ok(tokenLevels.length);
  for (const level of tokenLevels) {
    assert.ok(level.descriptionTemplate && level.descriptionBindings);
    const expected = changed.resolveGameModifierTokens(changed.resolveTemplate(level.descriptionTemplate, level.descriptionBindings)).text;
    assert.equal(level.description, expected);
    assert.ok(level.facts.some((fact) => fact.modifierRow === modifierFact.modifierRow && fact.value.includes("BaseValue=0.77")));
  }
  assert.notDeepEqual(live, raw);
  assert.deepEqual(raw, rawCatalog("s1"), "read-time resolution must not mutate stored input");
});

test("removed live row or unresolved live GPToken fails instead of serving cached values", () => {
  const lock = structuredClone(NUM_MODIFIER_LOCK);
  delete lock.rows.lc["160201010_1_0"];
  const resolver = createNumModifierResolver(lock, NUM_MODIFIER_SEMANTICS);
  assert.throws(() => resolveLegacyTalentFact(modifierFact, resolver), /MISSING_ROW/);
  assert.throws(() => resolveLegacyTalentCatalog(rawCatalog("s1"), resolver), /MISSING_ROW|Unresolved legacy talent tokens/);
});

test("offline projection check detects stale JSON even when live reader would repair it", () => {
  const raw = rawCatalog("s1");
  const level = raw.flatMap((tree) => tree.nodes.flatMap((node) => node.levels)).find((level) => Object.values(level.descriptionBindings ?? {}).some(binding => binding.row === "lc:160201010_1_0"))!;
  level.description = "stale rendered prose";
  const fact = level.facts.find((fact) => fact.modifierRow)!;
  fact.label = "stale label";
  fact.value = "stale fact";
  fact.displayValue = "stale display";
  assert.deepEqual(resolveLegacyTalentCatalog(raw), buildTrees(evidence("s1")));
  assert.throws(() => checkProjection(raw, evidence("s1")), /projection or Numerical facts drifted/);
  const checker = readFileSync("scripts/s0s1-season-talents/check.ts", "utf8");
  assert.doesNotMatch(checker, /getLegacyTalentCatalog|resolveLegacyTalentCatalog/);
});

test("all Modifier facts have typed references and match the current server Resolver", () => {
  for (const season of ["s0", "s1"]) for (const tree of getLegacyTalentCatalog(season)) for (const node of tree.nodes) for (const level of node.levels) {
    for (const key of level.modifierRows) assert.ok(level.facts.some((fact) => fact.modifierRow === key));
    for (const fact of level.facts.filter((fact) => fact.modifierRow)) assert.deepEqual(fact, resolveLegacyTalentFact(fact, NUM_MODIFIER_RESOLVER));
  }
});

test("all six SeasonSkill roots record exact GPActive Duration and CooldownDuration", () => {
  for (const season of ["s0", "s1"]) {
    const audit = evidence(season);
    for (const tree of buildTrees(audit)) {
      const level = tree.nodes.find((node) => node.isRoot)!.levels[0];
      const id = Number(level.facts.find((fact) => fact.label === "SeasonSkill")!.value);
      const active = audit.tables.activeSkills[String(id)] as { AbilityID: number; Duration: number; CooldownDuration: number };
      assert.equal(active.AbilityID, id);
      for (const field of ["Duration", "CooldownDuration"] as const) assert.ok(level.facts.some((fact) => fact.source.endsWith(`GPActiveSkillDataTable.json#${id}.${field}`) && fact.value === `${active[field]} 秒`));
    }
  }
});

test("reviewed cooldown binding uses structured value even when description disagrees", () => {
  const result = emptyLevel();
  const text = auditActiveSkill(6001301, { AbilityID: 6001301, Duration: 5, CooldownDuration: 91 }, "· 冷却：70秒。", result, "fixture");
  assert.equal(text, "· 冷却：91秒。");
  assert.ok(result.warnings.some((warning) => warning.includes("描述原值=70，采用结构值=91")));
  assert.ok(result.facts.some((fact) => fact.source.endsWith("#6001301.CooldownDuration") && fact.value === "91 秒"));
  assert.equal(result.descriptionTemplate, text);
});

test("active missing table row and missing scalar fields remain explicit", () => {
  for (const raw of [undefined, { AbilityID: 6001301 }]) {
    const result = emptyLevel();
    const text = auditActiveSkill(6001301, raw, "· 冷却：70秒。", result, "fixture");
    assert.ok(text.includes(UNVERIFIED));
    assert.ok(result.warnings.some((warning) => warning.startsWith("MISSING_ACTIVE_SKILL")));
    assert.equal(result.facts.length, 0);
  }
});

test("zero Duration is retained as a raw fact, never equated to described effect duration", () => {
  const result = emptyLevel();
  const text = auditActiveSkill(6002101, { AbilityID: 6002101, Duration: 0, CooldownDuration: 80 }, "空间持续10秒。", result, "fixture");
  assert.equal(text, `空间持续${UNVERIFIED}秒。`);
  assert.ok(result.facts.some((fact) => fact.value === "0 秒" && fact.source.endsWith(".Duration")));
  assert.ok(result.warnings.some((warning) => warning.startsWith("ACTIVE_DURATION_SCOPE")));
});

test("ambiguous, unreviewed and higher-level cooldown text cannot bind accidentally", () => {
  for (const [id, description, level] of [[6001301, "冷却：70秒。\n冷却：40秒。", 1], [6002101, "冷却：70秒。", 1], [6001301, "冷却：70秒。", 2]] as const) {
    const result = emptyLevel(level);
    const text = auditActiveSkill(id, { AbilityID: id, Duration: 0, CooldownDuration: 91 }, description, result, "fixture");
    assert.ok(text.includes(UNVERIFIED));
    assert.doesNotMatch(text, /91/);
    assert.ok(!result.warnings.some((warning) => warning.startsWith("BOUND_ACTIVE_COOLDOWN")));
  }
});

test("active skill identity mismatch and invalid scalar data are rejected", () => {
  assert.throws(() => auditActiveSkill(6001301, { AbilityID: 6001401, Duration: 5, CooldownDuration: 70 }, "", emptyLevel(), "fixture"), /identity mismatch/);
  for (const Duration of [-1, NaN, Infinity, "5"]) assert.throws(() => auditActiveSkill(6001301, { AbilityID: 6001301, Duration, CooldownDuration: 70 }, "", emptyLevel(), "fixture"));
});

test("blood-eye echo explicitly separates current reload B1 .15 from historical weakness semantics", () => {
  const node = getLegacyTalentTree("s1", "forbidden-eye")!.nodes.find((node) => node.id === "1013207")!;
  assert.equal(node.levels.length, 3);
  for (const level of node.levels) {
    const conflict = level.semanticConflicts![0];
    assert.equal(conflict.mgeId, 1319022011);
    assert.ok(conflict.summary.includes("角色全武器换弹速度提高"));
    assert.ok(conflict.summary.includes("按赤瞳提高弱点伤害增幅"));
    assert.ok(conflict.summary.includes("不能认定为旧节点效果"));
    const fact = level.facts.find((fact) => fact.modifierRow === `lc:160202006_${level.level}_0`)!;
    assert.equal(fact.historicalEffectStatus, "semantic-conflict");
    assert.equal(fact.evidenceKind, "current-same-id");
    assert.deepEqual(fact.conflictIds, [conflict.id]);
    assert.ok(level.warnings.some((warning) => warning.startsWith("CURRENT_ID_SEMANTIC_CONFLICT:")));
  }
  const fact = node.levels[2].facts.find((fact) => fact.modifierRow)!;
  assert.match(fact.value, /BaseValue=0.15; CoefValue=0; GPModifierOp=B1; Level=3/);
  assert.equal(resolveLegacyTalentFact(fact).historicalEffectStatus, "semantic-conflict");
});

test("spot-check evidence covers multiple trees without pretending to be exhaustive", () => {
  const s0 = summarizeSemanticReview(rawCatalog("s0"));
  const s1 = summarizeSemanticReview(rawCatalog("s1"));
  assert.equal(s0.reviewedNodeIds.length + s1.reviewedNodeIds.length, 11);
  assert.equal(s0.conflicts.length + s1.conflicts.length, 22);
  assert.equal(s1.coverage, "targeted-spot-check");
  for (const id of ["1013305", "1013505", "1013409", "1012709"]) assert.ok(s1.reviewedNodeIds.includes(id));
  assert.ok(s0.reviewedNodeIds.includes("1001308"));
  assert.deepEqual(evidence("s0").semanticReview, s0);
  assert.deepEqual(evidence("s1").semanticReview, s1);
});

test("matching numeric identities do not mark unreviewed facts as historical effects", () => {
  for (const tree of getLegacyTalentCatalog("s0")) for (const node of tree.nodes) for (const level of node.levels) {
    assert.ok(level.warnings.some((warning) => warning.startsWith("CURRENT_IDENTITY_NOT_HISTORICAL:")));
    for (const fact of level.facts) assert.ok(["unverified", "semantic-conflict"].includes(fact.historicalEffectStatus!));
  }
  const level = getLegacyTalentTree("s0", "frost-barrage")!.nodes.find((node) => node.id === "1001201")!.levels[0];
  assert.equal(level.facts.find((fact) => fact.modifierRow)!.historicalEffectStatus, "unverified");
});

test("description Token and Main parameter conflicts retain separate provenance", () => {
  const level = getLegacyTalentTree("s1", "forbidden-eye")!.nodes.find((node) => node.id === "1013305")!.levels[0];
  const current = level.facts.find((fact) => fact.modifierRow === "lc:160202006_1_0")!;
  const token = level.facts.find((fact) => fact.modifierRow === "lc:160202010_1_0")!;
  assert.equal(current.evidenceKind, "current-same-id");
  assert.equal(current.historicalEffectStatus, "semantic-conflict");
  assert.equal(token.evidenceKind, "current-description-token");
  assert.equal(token.historicalEffectStatus, "unverified");
  assert.equal(token.conflictIds, undefined);
  assert.deepEqual(level.semanticConflicts![0].modifierRows, [current.modifierRow]);
});

test("semantic review cannot silently survive changed parameter or description evidence", () => {
  const parameterDrift = evidence("s1");
  const config = parameterDrift.tables.params["1319022011"] as { Parameters: Array<{ Value: string }> };
  config.Parameters[0].Value = "160202004";
  assert.throws(() => buildTrees(parameterDrift), /SEMANTIC_REVIEW_DRIFT/);
  const descriptionDrift = evidence("s1");
  const row = descriptionDrift.tables.mgeDescriptions["1319022011_3"] as { MGEDescription: { LocalizedString: string } };
  row.MGEDescription.LocalizedString = "换弹速度提高";
  assert.throws(() => buildTrees(descriptionDrift), /SEMANTIC_REVIEW_DRIFT/);
});

test("missing exact Numerical level remains missing within a reviewed semantic conflict", () => {
  const level = getLegacyTalentTree("s0", "frost-barrage")!.nodes.find((node) => node.id === "1001308")!.levels[1];
  assert.deepEqual(level.semanticConflicts![0].modifierRows, []);
  assert.ok(level.warnings.some((warning) => warning.startsWith("MISSING_MODIFIER:")));
  assert.ok(level.warnings.some((warning) => warning.startsWith("CURRENT_ID_SEMANTIC_CONFLICT:")));
  assert.ok(!level.facts.some((fact) => fact.modifierRow));
});
