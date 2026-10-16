// ============================================================
// 逆战未来 Wiki - 数据类型定义
// ============================================================

// ------------------------------------------------------------
// 武器相关类型
// ------------------------------------------------------------

// prettier-ignore
export type WeaponType =
  | "突击步枪"
  | "狙击步枪"
  | "霰弹枪"
  | "火箭发射器"
  | "冲锋枪"
  | "机枪"
  | "手枪"
  | "单发榴弹"
  | "弓箭"
  | "喷射器"
  | "射手步枪"
  | "连发榴弹"
  | "暗器"
  | "近战武器"
  | "激光武器";

export type ElementType = "物理" | "火焰" | "寒冷" | "电弧" | "腐蚀";

export type WeaponTag = "高倍镜" | "穿透" | "破甲" | "爆炸" | "连发" | "三连发" | "自瞄" | "快速连发";

export type Rarity = "稀有" | "史诗" | "传说";

export type ScopeType = "低倍镜" | "中倍镜" | "高倍镜";

export type ToughnessType = "冲击" | "贯穿" | "爆炸";

/**
 * 武器伤害数据（来自 frontmatter）
 */
export interface WeaponDamage {
  base: number;
  impulse: number;
  toughness: number;
  flesh: number;
  hurtable: number;
}

/**
 * 射击模式 — 表示一种射击模式（普通射击 / 技能射击 / 技能改造后）
 */
export interface DamageMode {
  name: string;
  damage: WeaponDamage;
  element: ElementType;
  elementAddRate: number;
  weaknessMultiplier: number;
  enableWeakness: boolean;
  enableCritical: boolean;
  fireIntervalBase: number;
  fireIntervalBase2?: number;
  pellets?: number;
  toughnessType: ToughnessType;
  ignoreShield: boolean;
  /** 伤害类型标签，默认"命中伤害"，可覆盖为"爆炸伤害"等 */
  damageLabel?: string;
}

/**
 * 换弹时间数据
 * 换弹动画 = timeBase（WeaponChangeClipTimeBase）
 * 换弹后摇 = reloadRecovery（EarlyExitFromReloadAnim_C LinkValue）
 * 完整换弹 = timeBase + reloadRecovery
 */
export interface WeaponChangeClip {
  timeBase: number;
  reloadRecovery: number;
}

export interface WeaponMeleeDamage {
  light?: number;
  heavy?: number;
}

/**
 * 完整武器数据接口
 */
export interface Weapon {
  slug: string;
  title: string;
  use_type?: string;
  weapon_type?: WeaponType;
  weaponTypeId?: number;
  rarity?: Rarity;
  tags?: WeaponTag[];
  scope?: ScopeType | string;
  game_mode?: "lc" | "td"; // 猎场(lc) / 塔防(td)，未标注按猎场处理

  // 通用属性
  magazine?: number;
  totalAmmo?: number;
  accuracy?: number;
  stability?: number;
  range?: number;
  explosionRange?: number;
  attenuation_begin?: number | string | null;
  attenuation_end?: number | string | null;
  attenuation_scale?: number | string | null;
  skillCooldown?: number;
  skillDuration?: number;
  skillBlocking?: boolean;
  showDuration?: boolean;
  shootingEnergy?: boolean;
  shootingEnergyCount?: number;

  // 换弹
  changeClip?: WeaponChangeClip;

  // 射击模式
  damageModes: DamageMode[];

  // 近战轻/重击倍率
  meleeDamage?: WeaponMeleeDamage;

  // 额外射击模式（如技能切换）
  extraModes?: DamageMode[];

  draft?: boolean;
}

// ------------------------------------------------------------
// 插件 (Perk) 相关类型
// ------------------------------------------------------------

export type PerkSlot = 1 | 2 | 3 | 4;

// prettier-ignore
export type PerkCategory =
  | "装填类"
  | "伤害类"
  | "生存类"
  | "辅助类";

export interface PerkEffect {
  slot: PerkSlot;
  description: string;
  values?: {
    [key: string]: number;
  };
}

export interface EffectValueStage {
  condition?: string;
  value: string;
}

export type PerkEffectValue =
  | {
      kind: "damage";
      modifierTypeId: string;
      label: string;
      stages: EffectValueStage[];
    }
  | {
      kind: "stat";
      statId: string;
      label: string;
      stages: EffectValueStage[];
    };

export interface PerkIndependentDamageSourceReference {
  weaponSlug: string;
  damageSourceId: string;
  trigger: string;
  interval: string;
}

export type PerkPreviewChange = "new" | "changed" | "existing";

export interface Perk {
  skillVariants?: import("@/lib/num-skill").ResolvedSkillVariant[];
  id: string;
  itemId: string;
  slug: string;
  name: string;
  season?: string;
  previewChange?: PerkPreviewChange;
  slot: PerkSlot;
  rarity: Rarity;
  category: PerkCategory;
  icon?: string;
  weaponType?: number[];
  weaponNames?: string[];
  effects: PerkEffect[];
  description?: string;
  effectValues?: PerkEffectValue[];
  independentDamageSources?: PerkIndependentDamageSourceReference[];
  collectModItem?: 0 | 1;
  makeModItem?: 0 | 1;
  isCooked?: boolean;
  releaseDate?: string;
}

// ------------------------------------------------------------
// 超限卡片相关类型
// ------------------------------------------------------------

export interface OverlimitCardTag {
  id: string;
  name: string;
  icon: string;
  tone: string;
}

export interface OverlimitCard {
  id: string;
  /** Optional, explicit association; independent skill cards are not ordinary perks. */
  perkItemId?: string;
  name: string;
  description: string;
  icon: string;
  quality: number;
  weight?: number;
  slot?: PerkSlot;
  applicabilityKnown?: boolean;
  verification?: { status: "partial"; note: string };
  weaponType: number[];
  weaponItems: number[];
  weaponNames: string[];
  tags: OverlimitCardTag[];
  effectValues?: PerkEffectValue[];
}

export type OverlimitCardQuality = 3 | 4 | 5;

export interface OverlimitLevelEntry {
  level: number;
  qualityWeights: Record<OverlimitCardQuality, number>;
}

export interface OverlimitRerollCost {
  time: number;
  cost: number;
}

export interface OverlimitLevelCatalog {
  levels: OverlimitLevelEntry[];
  slot4: {
    baseProbability: number;
    guaranteedLevels: number[];
    bonusPerObtainedSlot4: number;
    mixedPoolWeights: {
      nonSlot4: number;
      slot4: number;
    };
  };
  criticalProbability: number;
  rerollCosts: OverlimitRerollCost[];
}

export type OverlimitBondName = string;

export interface OverlimitBondStageEffect {
  count: number;
  description: string;
  mergeType?: string;
  overrides?: number[];
}

export interface OverlimitBondEffect {
  name: OverlimitBondName;
  effects: OverlimitBondStageEffect[];
}

export type OverlimitBondCatalog = OverlimitBondEffect[];

export interface OverlimitMapRotationMap {
  name: string;
  activeBonds: OverlimitBondName[];
}

export interface OverlimitMapRotationPeriod {
  startDate: string;
  endDate: string | null;
  endLabel?: string;
  maps: OverlimitMapRotationMap[];
}

export interface OverlimitMapRotationSchedule {
  season: number;
  timezone: "Asia/Shanghai";
  periods: OverlimitMapRotationPeriod[];
}

// ------------------------------------------------------------
// 伤害计算器相关类型
// ------------------------------------------------------------

export interface DamageCalculation {
  weapon: Weapon;
  equippedPerks: {
    slot1?: Perk;
    slot2?: Perk;
    slot3?: Perk;
    slot4?: Perk;
  };
  targetType: "普通" | "精英" | "Boss";
  distance: number;
  isHeadshot: boolean;
  isBackstab: boolean;
}

// prettier-ignore
export interface DamageResult {
  baseDamage: number
  finalDamage: number
  dps: number
  ttk: number
  modifiers: {
    name: string
    value: number
    type: "add" | "multiply"
  }[]
}

// ------------------------------------------------------------
// 猎场首领 (Boss) 相关类型
// ------------------------------------------------------------

export type BossDifficulty = "overlimit" | "torment" | "inferno" | "heroic";

export type BossHealthValue = number[] | "unsupported";

export interface Boss {
  slug: string;
  title: string;
  nickname?: string;
  map: string | string[];
  phaseNames?: string[];
  health?: Partial<Record<BossDifficulty, BossHealthValue>>;
  hp?: string | number;
  hp2?: string | number;
  description?: string;
}

// ------------------------------------------------------------
// 陷阱 (Trap) 相关类型
// ------------------------------------------------------------

export type TrapType = "地面" | "墙壁" | "天花板";

export interface Trap {
  slug: string;
  title: string;
  position?: TrapType;
  attack?: number | string;
  range?: number | string;
  hp?: number | string;
  price?: number | string;
  area?: number | string;
  description?: string;
}

// ------------------------------------------------------------
// 统一敌人类型
// ------------------------------------------------------------

export type EnemyType = "normal" | "elite" | "boss";

export interface Enemy {
  slug: string;
  title: string;
  nickname?: string;
  type: EnemyType;
  iconPrefix: string;
  linkPrefix: string;
  hp?: string | number;
  hp2?: string | number;
  attack?: string | number;
  map?: string | string[];
  description?: string;
  hitback_hp?: string | number;
  hardstraight_hp?: string | number;
  weight?: string | number;
  speed?: string | number;
  kill_money?: number;
  attack_range?: string | number;
  search_range?: string | number;
}

// ------------------------------------------------------------
// 塔防敌人 (TDEnemy) 相关类型
// ------------------------------------------------------------

export type TDEnemyType = "normal" | "elite" | "boss";

export interface TDEnemy {
  slug: string;
  title: string;
  nickname?: string;
  type: TDEnemyType;
  attack?: number | string;
  hp?: number | string;
  hitback_hp?: number | string;
  hardstraight_hp?: number | string;
  weight?: number | string;
  speed?: number | string;
  kill_money?: number;
  attack_range?: number | string;
  search_range?: number | string;
  description?: string;
}

export type {
  AscOverrides,
  AttenuationOverride,
  DamageSourceOverrides,
  DamageSection,
  DamageSourceV2,
  NumericalOverrides,
  NumericalReference,
  NumericalTable,
  WeaponDataSourceRef,
  WeaponSourceV2,
} from "../lib/weapon-source-v2";

export type {
  WeaponDataLock,
  WeaponDataLockActiveSkill,
  WeaponDataLockKind,
  WeaponDataLockRow,
  WeaponDataLockSource,
} from "../lib/weapon-data-lock";

export type {
  AttenuationTraceValue,
  FieldProvenance,
  FieldState,
  OverrideTrace,
  PreparedWeaponResolver,
  ProvenanceKind,
  ResolvedAttackBehavior,
  ResolutionDiagnostic,
  ResolutionDiagnosticCode,
  ResolvedActiveSkill,
  ResolvedAmmoBehavior,
  ResolvedAttenuation,
  ResolvedDamageSource,
  ResolvedFeelBehavior,
  ResolvedField,
  ResolvedFireBehavior,
  ResolvedMovementBehavior,
  ResolvedToughnessType,
  ResolvedWeapon,
  ResolvedWeaponSnapshot,
  WeaponResolutionErrorCode,
} from "../lib/weapon-resolver";

export type {
  ElementStatusSummary,
  ElementStatusViewSummary,
  StatusEffectCatalogEntry,
  StatusEffectCatalogViewEntry,
  StatusEffectDataLock,
  StatusEffectMultiplierRelation,
  StatusEffectModifierReference,
  StatusEffectNumericalReference,
  StatusEffectPolarity,
  StatusEffectRelatedContent,
  StatusEffectRelatedContentRelation,
  StatusEffectRelatedContentType,
  StatusEffectSearchDocument,
  StatusEffectSemanticGroup,
  StatusEffectSemanticGroupId,
  StatusEffectTarget,
  StatusEffectVariant,
} from "./status-effects";

export type {
  SummonBuffReference,
  SummonBuffView,
  SummonCatalogEntryView,
  SummonCatalogView,
  SummonDamageDefinition,
  SummonDamageLock,
  SummonDamageLockEntry,
  SummonDamageLockRow,
  SummonDamageView,
  SummonDataLock,
  SummonDefinition,
  SummonEvidenceLevel,
  SummonElement,
  SummonFact,
  SummonKind,
  SummonMechanicDefinition,
  SummonMechanicKind,
  SummonMechanicView,
  SummonNumericalRowView,
  SummonPerkView,
  SummonSearchDocument,
  SummonSourceLink,
  SummonTalentReference,
  SummonTalentView,
} from "./summons";
