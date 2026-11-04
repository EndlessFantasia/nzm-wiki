import rawSurvivalCodex from "@/data/survival/codex.json";

export type SurvivalEffectType = "AddMGE" | "LevelUpRogueLikeBuff" | "ExpRateModifier" | "TempLevelBoost";
export type SurvivalPrerequisiteType = "HaveBuff" | "HaveAnyBuff";
export type SurvivalSpecialKind = "tempBoost" | "trigger" | "allMaxReward";
export type SurvivalAtlasKind = "skill" | "passive" | "special";

export interface SurvivalEffect {
  type: SurvivalEffectType;
  params: string[];
}

export interface SurvivalPrerequisite {
  type: SurvivalPrerequisiteType;
  ids: number[];
}

export interface SurvivalAttributeDisplay {
  label: string;
  value: number;
}

export interface SurvivalTag {
  text: string;
  /** NZSlateColorStyleInfoDataTable 样式名，如 E008。 */
  style: string;
  /** 样式对应的 #RRGGBB。 */
  color: string;
}

export interface SurvivalAtlasSlot {
  id: number;
  sortOrder: number;
}

export interface SurvivalBuffNode {
  id: number;
  name: string;
  description: string;
  currentLevelDescription: string;
  icon: string;
  attributeDisplays: SurvivalAttributeDisplay[];
  effect: SurvivalEffect;
  prerequisites: SurvivalPrerequisite[];
  weight: number;
  reduceWeight: number;
}

export interface SurvivalMge {
  id: string;
  blueprint: string;
}

export type SurvivalDamageScope = "base" | "ultimate";

/** 蓝图引用的一行伤害 Numerical（numerical_config_composite），不含升级与被动加成。 */
export interface SurvivalDamageSource {
  label: string;
  scope: SurvivalDamageScope;
  /** 引用该 Numerical 的资产（相对 Content，不含扩展名）与配置键。 */
  asset: string;
  key: string;
  numericalId: number;
  level: number;
  /** Numerical.SettlementType.Health.* 后缀。 */
  settlement: string;
  hpCalScale: number;
  /** 未挂 Toughness.Base 结算时为 null。 */
  toughness: number | null;
  element: string;
  critical: boolean;
  weakpoint: boolean;
  /** 伤害在运行时计算，HpCalScale 不能按基础攻击换算。 */
  dynamic: boolean;
  pending: string | null;
}

export interface SurvivalSkill {
  id: number;
  name: string;
  /** 源表 ETacticalSkillTag 枚举名（去前缀），与 tags 一一对应。 */
  tagKeys: string[];
  tags: SurvivalTag[];
  mge: SurvivalMge;
  /** 下标 + 1 即等级；第 1 项是基础技能，其余来自 UpgradeTree。 */
  levels: SurvivalBuffNode[];
  ultimate: SurvivalBuffNode;
  passiveId: number;
  damageSources: SurvivalDamageSource[];
  atlas: SurvivalAtlasSlot;
}

export interface SurvivalPassive {
  id: number;
  name: string;
  tags: SurvivalTag[];
  mge: SurvivalMge | null;
  levels: SurvivalBuffNode[];
  /** 与该被动组合后触发终极进化的主动技能；独立被动为 null。 */
  combinesWithSkillId: number | null;
  atlas: SurvivalAtlasSlot | null;
}

export interface SurvivalSpecial {
  id: number;
  name: string;
  kind: SurvivalSpecialKind;
  tags: SurvivalTag[];
  node: SurvivalBuffNode;
  mge: SurvivalMge | null;
  /** 仅 tempBoost：被临时进化的主动技能。 */
  targetSkillIds: number[];
  damageSources: SurvivalDamageSource[];
  atlas: SurvivalAtlasSlot | null;
}

export interface SurvivalCodexRules {
  maxActiveSkillTypes: number;
  maxPassiveBuffTypes: number;
  allMaxLevelSpecialBuffId: number;
  drawUltimateWeaponPercents: number[];
  treasureBoxUltimateWeaponPercents: number[];
  ultimateWeaponPercentAdditions: number[];
  ultimateWeaponAccumulateStartCount: number;
}

export interface SurvivalCodex {
  schemaVersion: 1;
  /** 描述与属性展示值来自源表展示层，未沿 MGE → Numerical 核验；damageSources 除外。 */
  numericalStatus: "display-only";
  skills: SurvivalSkill[];
  passives: SurvivalPassive[];
  specials: SurvivalSpecial[];
  rules: SurvivalCodexRules;
}

export interface SurvivalAtlasEntry {
  kind: SurvivalAtlasKind;
  id: number;
  name: string;
  sortOrder: number;
}

const EFFECT_TYPES: readonly SurvivalEffectType[] = ["AddMGE", "LevelUpRogueLikeBuff", "ExpRateModifier", "TempLevelBoost"];
const SPECIAL_KINDS: readonly SurvivalSpecialKind[] = ["tempBoost", "trigger", "allMaxReward"];

function fail(message: string): never {
  throw new Error(`生存战图鉴数据无效：${message}`);
}

function assertNode(node: SurvivalBuffNode, owner: string) {
  if (
    !Number.isInteger(node.id) ||
    !node.name ||
    !node.description ||
    !node.icon.startsWith("/") ||
    !EFFECT_TYPES.includes(node.effect.type) ||
    !Array.isArray(node.effect.params) ||
    !Array.isArray(node.attributeDisplays) ||
    !Array.isArray(node.prerequisites)
  ) {
    fail(`节点 ${owner}`);
  }
}

function assertSurvivalCodex(value: unknown): asserts value is SurvivalCodex {
  const data = value as Partial<SurvivalCodex> | null;
  if (
    !data ||
    data.schemaVersion !== 1 ||
    data.numericalStatus !== "display-only" ||
    !Array.isArray(data.skills) ||
    !Array.isArray(data.passives) ||
    !Array.isArray(data.specials) ||
    !data.rules
  ) {
    fail("顶层结构");
  }

  const nodeIds = new Set<number>();
  const track = (node: SurvivalBuffNode, owner: string) => {
    assertNode(node, owner);
    if (nodeIds.has(node.id)) fail(`节点 ID 重复 ${node.id}`);
    nodeIds.add(node.id);
  };

  const assertDamage = (sources: SurvivalDamageSource[], owner: string) => {
    if (!Array.isArray(sources) || sources.some((source) =>
      !source.label || !Number.isInteger(source.numericalId) || !Number.isFinite(source.hpCalScale) || !source.element)) {
      fail(`伤害来源 ${owner}`);
    }
  };

  const skillIds = new Set<number>();
  const passiveIds = new Set<number>();
  for (const skill of data.skills) {
    if (skillIds.has(skill.id) || skill.levels.length < 2 || skill.tagKeys.length !== skill.tags.length) {
      fail(`技能 ${skill.id}`);
    }
    assertDamage(skill.damageSources, `技能 ${skill.id}`);
    skillIds.add(skill.id);
    skill.levels.forEach((node) => track(node, `技能 ${skill.id}`));
    track(skill.ultimate, `技能 ${skill.id} 终极`);
  }
  for (const passive of data.passives) {
    if (passiveIds.has(passive.id) || passive.levels.length < 2) fail(`被动 ${passive.id}`);
    passiveIds.add(passive.id);
    passive.levels.forEach((node) => track(node, `被动 ${passive.id}`));
  }
  for (const skill of data.skills) {
    if (!passiveIds.has(skill.passiveId)) fail(`技能 ${skill.id} 的配套被动 ${skill.passiveId} 不存在`);
  }
  for (const passive of data.passives) {
    if (passive.combinesWithSkillId !== null && !skillIds.has(passive.combinesWithSkillId)) {
      fail(`被动 ${passive.id} 的配套技能不存在`);
    }
  }
  for (const special of data.specials) {
    if (!SPECIAL_KINDS.includes(special.kind) || special.targetSkillIds.some((id) => !skillIds.has(id))) {
      fail(`特殊增益 ${special.id}`);
    }
    assertDamage(special.damageSources, `特殊增益 ${special.id}`);
    track(special.node, `特殊增益 ${special.id}`);
  }
}

assertSurvivalCodex(rawSurvivalCodex);

export const SURVIVAL_CODEX: SurvivalCodex = rawSurvivalCodex;

export function getSurvivalSkill(id: number, codex: SurvivalCodex = SURVIVAL_CODEX): SurvivalSkill | undefined {
  return codex.skills.find((skill) => skill.id === id);
}

export function getSurvivalPassive(id: number, codex: SurvivalCodex = SURVIVAL_CODEX): SurvivalPassive | undefined {
  return codex.passives.find((passive) => passive.id === id);
}

export function filterSurvivalSkillsByTag(tagKey: string, codex: SurvivalCodex = SURVIVAL_CODEX): SurvivalSkill[] {
  return codex.skills.filter((skill) => skill.tagKeys.includes(tagKey));
}

/** 游戏内图鉴顺序（Survival_BuffShow.SortOrder），主动技能在前，被动与特殊随后。 */
export function listSurvivalAtlas(codex: SurvivalCodex = SURVIVAL_CODEX): SurvivalAtlasEntry[] {
  const entries: SurvivalAtlasEntry[] = [];
  for (const skill of codex.skills) {
    entries.push({ kind: "skill", id: skill.id, name: skill.name, sortOrder: skill.atlas.sortOrder });
  }
  for (const passive of codex.passives) {
    if (passive.atlas) entries.push({ kind: "passive", id: passive.id, name: passive.name, sortOrder: passive.atlas.sortOrder });
  }
  for (const special of codex.specials) {
    if (special.atlas) entries.push({ kind: "special", id: special.id, name: special.name, sortOrder: special.atlas.sortOrder });
  }
  return entries.sort((a, b) => a.sortOrder - b.sortOrder);
}
