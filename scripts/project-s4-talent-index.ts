import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { NUM_MODIFIER_RESOLVER } from "../lib/num-modifier-data";
import { parseModifierProviderRegistry, type ModifierProviderRegistry } from "../lib/modifier-provider-registry";
import type { ModifierRecipient } from "../lib/num-modifier-semantics";
import type { SeasonTalentNodeData, SeasonTalentPassiveData, SeasonTalentTreeData } from "../lib/season-talent-builder";
import { loadModifierProviderRegistry, MODIFIER_PROVIDER_REGISTRY_PATH } from "./num-modifier/provider-registry";

type Row = Record<string, unknown>;
type Application = NonNullable<ModifierProviderRegistry["providers"][number]["applications"]>[number];
const slugs = ["dual-star", "matrix-symbiosis", "black-hole"] as const;
const contentRoot = "refs/Exports/NZM/Content";
const skillRoot = "Abilities/Skills/Season/S5/";
const snapshots = [
  "kismet/live/20261013T110925Z-daa46394cacb44a7bb6bce9ccc96c9b9",
  "kismet/live/20261013T111217Z-d545579530564b2ca7bd8e75b9a65de8",
  "kismet/live/20261013T111705Z-88ab483fa208473c87774ebfd72de879",
] as const;

function json<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

/** One talent identity publishes only its highest-level attribute rows. */
export function highestLevelApplications(modifierId: number, talentLevel: number, recipient: ModifierRecipient): Application[] {
  const rows = NUM_MODIFIER_RESOLVER.getRowsById("lc", modifierId);
  assert.ok(rows.length, `Missing S4 Modifier ${modifierId}`);
  // A modifier with a single configured level is independent of talent rank.
  const level = rows.every(row => row.level === rows[0].level) ? rows[0].level : talentLevel;
  const selected = rows.filter(row => row.level === level);
  assert.ok(selected.length, `Missing S4 Modifier ${modifierId} level ${level}`);
  return selected.flatMap(row => {
    const application: Application = {
      expression: { row: row.key, field: row.baseValue !== 0 ? "base" : "coefficient" },
      context: { recipient },
    };
    const effect = NUM_MODIFIER_RESOLVER.resolveEffect(application.expression, application.context);
    // Keep the common Resolver authoritative, including scoped correction parameters.
    return effect.facets.some(facet => facet.consumer === "damage" || facet.id === "correction-parameter") ? [application] : [];
  });
}

export function buildS4TalentProviders(localContentRoot = contentRoot) {
  const table = (file: string) => json<{ Rows: Record<string, Row> }[]>(path.join(localContentRoot, `${file}.json`))[0].Rows;
  const basic = table("DataTables/SeasonTalent/SeasonTalentBasicTable");
  const passiveNodes = table("DataTables/SeasonTalent/SeasonTalentPassiveConfigTable");
  const passives = table("DataTables/MGE/MGEPassive_Season");
  const mges = table("DataTables/MGE/GPModularGameplayEffectTable");
  const buffs = table("DataTables/Buff/BuffConfigDatatableNew");
  const basisRoot = localContentRoot.replaceAll("\\", "/");
  const asset = (file: string) => json<{ Name: string; Properties?: Row }[]>(path.join(localContentRoot, `${skillRoot}${file}.json`));
  const defaults = (file: string) => asset(file).find(item => item.Name.startsWith("Default__"))?.Properties ?? {};
  const proof = (snapshot: 0 | 1 | 2, file: string, functionName: string, offset: number, expected: string[]) => {
    const filePath = `${snapshots[snapshot]}/json/NZM/Content/${skillRoot}${file}.uasset.json`;
    const manifest = json<{ dataset: string; status: string; excludedContainers: string[]; files: { path: string; sha256: string }[] }>(`${snapshots[snapshot]}/manifest.json`);
    assert.equal(manifest.dataset, "live");
    assert.equal(manifest.status, "exported");
    assert.ok(manifest.excludedContainers.includes("P_1.0.50.485.0_Patch_Season_4261608_P.pak"));
    const relativePath = filePath.slice(snapshots[snapshot].length + 1);
    const recordedFile = manifest.files.find(entry => entry.path === relativePath);
    assert.ok(recordedFile, `${filePath} is not recorded in its manifest`);
    assert.equal(createHash("sha256").update(readFileSync(filePath)).digest("hex"), recordedFile.sha256.toLowerCase(), `${filePath} hash drift`);
    const functions = json<{ Name: string; ScriptBytecode?: Row[] }[]>(filePath);
    const statement = functions.find(item => item.Name === functionName)?.ScriptBytecode?.find(item => item.StatementIndex === offset);
    assert.ok(statement, `${filePath}:${functionName}@${offset}`);
    for (const token of expected) assert.ok(JSON.stringify(statement).includes(token), `${filePath}@${offset}: ${token}`);
    return `${filePath}:${functionName}@${offset}；${expected.join(" / ")}`;
  };
  type Review = { modifiers: number[]; recipient: ModifierRecipient; basis: string[] };
  const reviewed = new Map<number, Review>();
  const register = (skill: number, modifiers: number[], recipient: ModifierRecipient, basis: string[]) => reviewed.set(skill, { modifiers, recipient, basis });
  const buffBasis = (name: string, expected: number[]) => {
    assert.deepEqual(buffs[name]?.GPModifyIDs, expected);
    return `${basisRoot}/DataTables/Buff/BuffConfigDatatableNew.json:${name}.GPModifyIDs=${expected.join(",")}`;
  };

  register(1379040030, [111053010], "damage-event", [proof(0, "Normal/MGE/MGE_1379040030", "ExecuteUbergraph_MGE_1379040030", 1457, ["CreateAsyncAddScopedModifier", "111053010", "NumericalEffectAppliedEvent"])]);
  register(1379040040, [111053004], "self", [proof(0, "Normal/MGE/MGE_1379040040", "ExecuteUbergraph_MGE_1379040040", 1069, ["MGEAddBuff", "SeasonTalent_S5_Normal_00602"]), buffBasis("SeasonTalent_S5_Normal_00602", [111053004])]);
  register(1379040120, [111053005], "damage-event", [proof(0, "Normal/MGE/MGE_1379040120", "ExecuteUbergraph_MGE_1379040120", 1553, ["CreateAsyncAddScopedModifier", "111053005", "NumericalEffectAppliedEvent"])]);
  assert.equal(defaults("Normal/MGE/MGE_1379040140").ModifierID, 111053011);
  register(1379040140, [111053011], "damage-event", [
    `${basisRoot}/${skillRoot}Normal/MGE/MGE_1379040140.json:Default__.ModifierID=111053011`,
    proof(1, "Normal/MGE/MGE_1379040140", "ExecuteUbergraph_MGE_1379040140", 1636, ["ApplyModifiers", "ModifierID"]),
    proof(1, "Normal/MGE/MGE_1379040140", "ExecuteUbergraph_MGE_1379040140", 3016, ["AddScopedModifierForActivatedSkill", "ModifierID"]),
  ]);
  register(1379040180, [111053009], "damage-event", [proof(0, "Normal/MGE/MGE_1379040180", "ExecuteUbergraph_MGE_1379040180", 315, ["AddScopedModifierForActivatedSkill", "111053009", "MGELevel"])]);
  register(1379040310, [111053013], "damage-event", [proof(0, "Normal/MGE/MGE_1379040310", "ExecuteUbergraph_MGE_1379040310", 890, ["ApplyModifiers", "111053013"])]);

  for (const [skill, actor, modifier, offset, snapshot] of [
    [6005101, "BP_WH_Out_Left", 160401001, 3239, 0],
    [1319051001, "BP_WH_Floating", 160401002, 3047, 2],
    [1319051003, "BP_WH_Out_Right", 160401003, 3090, 2],
  ] as const) {
    assert.equal(defaults(`Wormhole/${actor}`).WormHoleModifierId, modifier);
    const spawn = skill === 1319051001
      ? proof(1, "Wormhole/Talents/MGE_1319051001_AutoWormHole", "ExecuteUbergraph_MGE_1319051001_AutoWormHole", 2094, ["BeginDeferredActorSpawnFromClass", actor])
      : proof(1, "Wormhole/SK_ChongDongAbility", "ExecuteUbergraph_SK_ChongDongAbility", skill === 6005101 ? 345 : 2042, ["BeginDeferredActorSpawnFromClass", actor]);
    register(skill, [modifier], "damage-event", [spawn,
      `${basisRoot}/${skillRoot}Wormhole/${actor}.json:Default__.WormHoleModifierId=${modifier}`,
      proof(snapshot, `Wormhole/${actor}`, `ExecuteUbergraph_${actor}`, offset, ["ModifierID", "WormHoleModifierId"]),
      "复制弹道的 ExecutionRatio 仅登记单次修正参数；B5 方向及最终因子仍未知，不显示为正向增伤百分比。",
      ...(skill === 1319051003 ? [
        proof(2, "Wormhole/Talents/MGE_1319051003_KJTS", "ExecuteUbergraph_MGE_1319051003_KJTS", 165, ["MGEAddMGEContextForTarget", "MGE_1319051003_ImplInternal"]),
        proof(1, "Wormhole/Talents/MGE_1319051003_ImplInternal", "ExecuteUbergraph_MGE_1319051003_ImplInternal", 197, ["SpawnOrRefreshTheNewWormHole"]),
      ] : []),
    ]);
  }

  assert.equal(defaults("Wormhole/Talents/MGE_1319051004_ImplInternal")["ModifierID空间共振"], 160401004);
  register(1319051004, [160401004], "damage-event", [
    proof(2, "Wormhole/Talents/MGE_1319051004_KJGZ", "ExecuteUbergraph_MGE_1319051004_KJGZ", 616, ["MGEAddMGEContextForTarget", "MGE_1319051004_ImplInternal"]),
    `${basisRoot}/${skillRoot}Wormhole/Talents/MGE_1319051004_ImplInternal.json:Default__.ModifierID空间共振=160401004`,
    proof(0, "Wormhole/Talents/MGE_1319051004_ImplInternal", "ExecuteUbergraph_MGE_1319051004_ImplInternal", 141, ["AddScopeModiferForSettlement", "GetSeasonTalentLevel", "NumericalEffectAppliedEvent"]),
  ]);
  assert.equal(defaults("Wormhole/Talents/MGE_1319051006_ImplInternal")["BuffName空间共鸣"], "S4Talent0102");
  register(1319051006, [160401005], "self", [
    proof(2, "Wormhole/Talents/MGE_1319051006_KJGM", "ExecuteUbergraph_MGE_1319051006_KJGM", 165, ["MGEAddMGEContextForTarget", "MGE_1319051006_ImplInternal"]),
    `${basisRoot}/${skillRoot}Wormhole/Talents/MGE_1319051006_ImplInternal.json:Default__.BuffName空间共鸣=S4Talent0102`,
    proof(0, "Wormhole/Talents/MGE_1319051006_ImplInternal", "ExecuteUbergraph_MGE_1319051006_ImplInternal", 467, ["MGEAddBuff", "TalentLevel"]), buffBasis("S4Talent0102_3", [160401005]),
  ]);
  assert.equal(defaults("Wormhole/BP_WH_Out_Left").ZuBiaoSuoDingShangHaiXiuZhengID, 160401006);
  register(1319051007, [160401006], "damage-event", [
    `${basisRoot}/${skillRoot}Wormhole/BP_WH_Out_Left.json:Default__.ZuBiaoSuoDingShangHaiXiuZhengID=160401006`,
    proof(0, "Wormhole/BP_WH_Out_Left", "ExecuteUbergraph_BP_WH_Out_Left", 3370, ["SelectInt", "ZuBiaoSuoDingShangHaiXiuZhengID"]),
    "锁定分支的伴星结算属性；不是施加给玩家的全局增伤。",
  ]);
  for (const [skill, modifier, offset, buff] of [
    [1319052002, 111031066, 481, "SeasonTalent_S5_Blackhole_001"],
    [1319052007, 111031067, 92, "SeasonTalent_S5_Blackhole_002"],
  ] as const) register(skill, [modifier], "enemy", [proof(0, `BlackHole/MGE/MGE_${skill}`, `ExecuteUbergraph_MGE_${skill}`, offset, ["MGEAddBuff", buff, "Target"]), buffBasis(buff, [modifier])]);

  const matrix = "XJHH/MGE/MGE_1319051016";
  const matrixDefaults = defaults(matrix);
  assert.equal(matrixDefaults.AttackUpTalentID, 1319053002);
  assert.equal(matrixDefaults.AttackBuffName, "SeasonTalent_S5_XJHHHuge_NotHitState");
  register(1319053002, [130040036], "unknown", [
    `${basisRoot}/${skillRoot}${matrix}.json:Default__.AttackUpTalentID=1319053002; AttackBuffName=SeasonTalent_S5_XJHHHuge_NotHitState`,
    proof(0, matrix, "ExecuteUbergraph_MGE_1319051016", 6937, ["HasTalent", "AttackUpTalentID"]),
    proof(0, matrix, "ExecuteUbergraph_MGE_1319051016", 7759, ["BuffName", "AttackBuffName"]),
    proof(1, "XJHH/MGE/MGE_1319051009", "ExecuteUbergraph_MGE_1319051009", 1137, ["AddBuffByName", "AttackBuffName", "TargetActor"]), buffBasis("SeasonTalent_S5_XJHHHuge_NotHitState", [130040036]),
    "领域给玩家与召唤物的条件分支；索引仅发布武器伤害属性，不把 unknown 接收者解释为全局效果。",
  ]);
  assert.equal(matrixDefaults.HugeTalentID, 1319053003);
  register(1319053003, [130040033, 130040038], "ally", [
    `${basisRoot}/${skillRoot}${matrix}.json:Default__.HugeTalentID=1319053003`,
    proof(0, matrix, "ExecuteUbergraph_MGE_1319051016", 11546, ["HasTalent", "HugeTalentID"]),
    proof(0, matrix, "ExecuteUbergraph_MGE_1319051016", 5270, ["AddBuffByName", "SeasonTalent_S5_XJHHHuge_Huge_gungpm_huoshen"]),
    proof(0, matrix, "ExecuteUbergraph_MGE_1319051016", 5499, ["AddBuffByName", "SeasonTalent_S5_XJHHHuge_Huge_gungpm"]),
    buffBasis("SeasonTalent_S5_XJHHHuge_Huge_gungpm", [130040033]), buffBasis("SeasonTalent_S5_XJHHHuge_Huge_gungpm_huoshen", [130040038]),
    "普通召唤物与火神变体同属武器伤害分面；仅登记伤害行，不将射速视为伤害乘区。",
  ]);

  const nonDamage = new Map<number, string>([
    ...[1379040050, 1379040060, 1379040070, 1379040080, 1379040100, 1379040110, 1379040250, 1379040260, 1379040270, 1379040280, 1379040290, 1379040160, 1379040320].map(id => [id, "能量球获取、能量层数或触发条件，不直接修改伤害属性。"] as const),
    [1379040090, "能量球拾取范围，不修改伤害属性。"],
    ...[1379040170, 1379040190, 1379040200, 1379040220, 1319051005, 1319053007].map(id => [id, "技能充能速度或充能量，不属于伤害乘区。"] as const),
    ...[1379040210, 1319051002, 1319053005, 1319052003, 1319052009].map(id => [id, "技能持续时间，不属于伤害乘区。"] as const),
    ...[1319053004, 1319052006].map(id => [id, "技能范围，不属于伤害乘区。"] as const),
    [1319053006, "移速加成，不属于伤害乘区。"], [1319053001, "射速/攻击速度加成，不属于伤害乘区。"],
    [1319052005, "黑洞伤害频率，不属于伤害乘区。"], [1379040010, "改变弱点结算概率，没有直接增伤属性行。"],
    [1379040230, "金币获取，不属于伤害乘区。"], [1379040240, "特殊弹药恢复/过充，不属于伤害乘区。"],
  ]);
  const independent = new Set([6005101, 6005201, 1319051001, 1319051003, 1319052001, 1319052004, 1379040020, 1379040130, 1379040150]);
  const providers: ModifierProviderRegistry["providers"] = [];
  const exclusions: ModifierProviderRegistry["exclusions"] = [];
  const passiveData = json<{ trees: Record<string, { light: SeasonTalentPassiveData[]; dark: SeasonTalentPassiveData[] }> }>("data/season-talents/s4/passives.json");
  for (const [treeIndex, slug] of slugs.entries()) {
    const tree = json<SeasonTalentTreeData>(`data/season-talents/s4/${slug}.json`);
    const entries = [
      ...tree.nodes.map(node => ({ node, isPassive: false })),
      ...[...passiveData.trees[slug].light, ...passiveData.trees[slug].dark].map(node => ({ node, isPassive: true })),
    ];
    for (const { node, isPassive } of entries) {
      const candidates = Object.entries(isPassive ? passiveNodes : basic).filter(([, row]) => row.SeasonID === 4 && String(row.TalentID) === node.id &&
        (isPassive ? row.PassiveSkillType === treeIndex + 1 : row.TalentType === treeIndex + 1));
      candidates.sort((a, b) => Number(b[1].TalentILevel ?? 1) - Number(a[1].TalentILevel ?? 1));
      assert.ok(candidates.length, `Missing S4 identity ${slug}/${node.id}`);
      const [rowKey, row] = candidates[0];
      const level = isPassive ? 1 : (node as SeasonTalentNodeData).maxLevel;
      assert.equal(Number(row.TalentILevel ?? 1), level);
      const skill = Number(isPassive ? row.PassiveSkillsID : row.SeasonSkill || row.TalentSkillsID || row.AttributeSkillsID);
      const identity = {
        id: `season:s4:${slug}:${isPassive ? "passive:" : ""}${node.id}`,
        label: `S4 ${tree.name}·${node.name}`,
        source: { type: "season-talent" as const, season: "s4", tree: slug, ...(isPassive ? { passiveId: node.id } : { nodeId: node.id }) },
      };
      const basis = [`${basisRoot}/DataTables/SeasonTalent/${isPassive ? "SeasonTalentPassiveConfigTable" : "SeasonTalentBasicTable"}.json:${rowKey} -> Skill=${skill}，最高天赋等级=${level}；所有等级共用此来源身份。`];
      if (!row.SeasonSkill) {
        const passiveKey = `${skill}_${level}`;
        const passive = passives[passiveKey];
        assert.ok(passive, `Missing S4 passive ${passiveKey}`);
        const mgeId = (passive.MGE as { Id: string }).Id;
        const configId = (passive.MGEConfig as { Id: string }).Id;
        basis.push(`${basisRoot}/DataTables/MGE/MGEPassive_Season.json:${passiveKey}.MGE.Id=${mgeId}; MGEConfig.Id=${configId}`);
        assert.ok(mges[mgeId]);
        basis.push(`${basisRoot}/DataTables/MGE/GPModularGameplayEffectTable.json:${mgeId}.MGEClass=${(mges[mgeId].MGEClass as { AssetPathName: string }).AssetPathName}`);
      }
      const review = reviewed.get(skill);
      if (review) {
        const applications = review.modifiers.flatMap(id => highestLevelApplications(id, level, review.recipient));
        assert.ok(applications.length, `No S4 damage facets for ${skill}`);
        providers.push({ ...identity, applications, evidence: { kind: "reviewed-chain", passiveSkillId: String(skill), basis: [...basis, ...review.basis, "最高等级 Numerical 只用于属性归类；不以描述值覆盖 Numerical，不额外发布叠层、运行时增伤值或其他等级数值。"] } });
      } else if (skill === 1379040300) {
        // Native extra attack levels have no fixed per-talent Num expression.
        // Index the reviewed mechanism without pretending it grants a fixed value.
        assert.equal(defaults("Normal/MGE/MGE_1379040300").AddLevel, 1);
        providers.push({ ...identity, reviewedFacetIds: ["game-mode"], evidence: {
          kind: "reviewed-override", passiveSkillId: String(skill), basis: [...basis,
            `${basisRoot}/${skillRoot}Normal/MGE/MGE_1379040300.json:Default__.AddLevel=1`,
            proof(0, "Normal/MGE/MGE_1379040300", "Change Attack Level", 71, ["MetropolisPlayerAttackComponent:AddExtraAttackLevel", "LevelUpNum"]),
            "Native 额外猎场攻击等级机制归入游戏模式乘区；效果依赖当前攻击等级，没有固定的天赋 Modifier 表达式，不发布固定增伤值或将其他等级的 Numerical 冒充本天赋数值。Native 内部等级应用实现未导出。",
          ],
        } });
      } else {
        const reason = nonDamage.get(skill);
        exclusions.push({ ...identity,
          reasonCode: reason || skill === 6005301 ? "not-damage-multiplier" : independent.has(skill) ? "independent-damage-event" : "unverified-evidence",
          reason: reason ?? (skill === 6005301 ? "矩阵共生基础领域提供射速加成，不属于伤害乘区。" : independent.has(skill) ? "独立伤害来源；基础伤害不作为增伤属性登记。" : "当前尚未连通可发布的增伤属性链，不按描述推定乘区。"),
          evidence: { passiveSkillId: String(skill), basis },
        });
      }
    }
  }
  return { providers, exclusions };
}

export function projectS4TalentProviders(write = false, localContentRoot = contentRoot) {
  const generated = buildS4TalentProviders(localContentRoot);
  const registry = loadModifierProviderRegistry();
  const isS4 = (entry: { source: { type: string; season?: string } }) => entry.source.type === "season-talent" && entry.source.season === "s4";
  if (write) {
    registry.providers = [...registry.providers.filter(entry => !isS4(entry)), ...generated.providers];
    registry.exclusions = [...registry.exclusions.filter(entry => !isS4(entry)), ...generated.exclusions];
    parseModifierProviderRegistry(registry);
    writeFileSync(MODIFIER_PROVIDER_REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
  } else {
    assert.deepEqual(registry.providers.filter(isS4), generated.providers, "S4 talent provider registry drift");
    assert.deepEqual(registry.exclusions.filter(isS4), generated.exclusions, "S4 talent exclusion registry drift");
  }
  console.log(`S4 talents: ${generated.providers.length} multiplier sources; ${generated.exclusions.length} explicit exclusions.`);
  return generated;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const index = process.argv.indexOf("--content-root");
  projectS4TalentProviders(process.argv.includes("--write"), index >= 0 ? process.argv[index + 1] : contentRoot);
}
