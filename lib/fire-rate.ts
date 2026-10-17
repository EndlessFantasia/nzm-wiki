import { getAllOverlimitCards } from "@/lib/overlimit-cards";
import { getAllPerks } from "@/lib/perks";
import { getPerkAvailability } from "@/lib/perk-release";
import { NUM_MODIFIER_RESOLVER } from "@/lib/num-modifier-data";
import type { NumModifierValueExpression } from "@/lib/num-modifier";
import { getResolvedFieldValue } from "@/lib/weapon-consumers";
import { getResolvedWeaponBySlug } from "@/lib/weapons";
import type {
  EffectValueStage,
  OverlimitCard,
  Perk,
  PerkEffectValue,
} from "@/types";

export const FIRE_RATE_STAT_ID = "fire-rate" as const;

type MechanicFireRateGroup = "talents" | "origin" | "limits";
export type FireRateCatalogGroup = "weapons" | "perks" | "overlimit" | "base" | MechanicFireRateGroup;

interface MechanicFireRateSource {
  id: string;
  name: string;
  href: string;
  icon: string;
  sourceLabel: string;
  stages: {
    condition: string;
    expression: NumModifierValueExpression;
    percentagePoints?: boolean;
  }[];
}

const MECHANIC_FIRE_RATE_SOURCES: Record<MechanicFireRateGroup, MechanicFireRateSource[]> = {
  talents: [
    {
      id: "season:s4:matrix-symbiosis:4020102",
      name: "矩阵共生",
      href: "/guides/season-talents/s4/matrix-symbiosis?node=4020102",
      icon: "/webp/images/season-talents/s4/details/T_Talent_S4_XJHH_1.webp",
      sourceLabel: "S4天赋 · 玩家枪械部分",
      stages: [{ condition: "自身处于狂暴领域内", expression: { row: "lc:130040034_1_1", field: "base" } }],
    },
    {
      id: "season:s4:matrix-symbiosis:4020202",
      name: "阵列共鸣",
      href: "/guides/season-talents/s4/matrix-symbiosis?node=4020202",
      icon: "/webp/images/season-talents/s4/details/T_Talent_S4_XJHH_02.webp",
      sourceLabel: "S4天赋 · 玩家枪械部分",
      stages: [
        { condition: "领域内每个友方单位", expression: { row: "lc:130040035_1_1", field: "base" } },
        { condition: "6层上限", expression: { row: "lc:130040035_1_1", field: "base", scale: 6 } },
      ],
    },
  ],
  origin: [
    {
      id: "origin-rune:1378042240",
      name: "怒战狂暴",
      href: "/origin#rune-1378042240",
      icon: "/icons/origin/runes/T_Icons_S4_Rouge_SPRunes04_01.webp",
      sourceLabel: "原点强化 · 叠层数值未计射速上限",
      stages: [
        { condition: "受损叠层，每层", expression: { row: "lc:130042240_1_0", field: "base" } },
        { condition: "20层合计（截断前）", expression: { row: "lc:130042240_1_0", field: "base", scale: 20 } },
      ],
    },
    {
      id: "origin-rune:1378044250",
      name: "狂战之力",
      href: "/origin#rune-1378044250",
      icon: "/icons/origin/runes/T_Icons_S4_Rouge_SPRunes04_03.webp",
      sourceLabel: "原点强化 · 玩家枪械部分",
      stages: [{ condition: "获得强化后", expression: { row: "lc:130044250_1_2", field: "base" } }],
    },
    {
      id: "origin-affix:10015",
      name: "复合弓·备弹",
      href: "/origin#affix-10015",
      icon: "/icons/weapons/normal/超级复合弓.png",
      sourceLabel: "原点武器词条",
      stages: [{ condition: "使用武器技能后8秒内", expression: { row: "lc:130040150_1_0", field: "base" } }],
    },
    {
      id: "origin-affix:10006",
      name: "纯白·狂热",
      href: "/origin#affix-10006",
      icon: "/icons/weapons/normal/纯白至上.png",
      sourceLabel: "原点武器词条 · 换弹清除叠层",
      stages: [
        { condition: "初始减益", expression: { row: "lc:130040062_1_0", field: "base" } },
        { condition: "持续射击每秒叠1层", expression: { row: "lc:130040061_1_0", field: "base" } },
        { condition: "4层叠加部分（未扣初始减益）", expression: { row: "lc:130040061_1_0", field: "base", scale: 4 } },
      ],
    },
  ],
  limits: [
    {
      id: "origin-affix:10006:fire-rate-limit",
      name: "纯白·狂热",
      href: "/origin#affix-10006",
      icon: "/icons/weapons/normal/纯白至上.png",
      sourceLabel: "原点武器词条 · 上限修正",
      stages: [{ condition: "射速加成上限增加", expression: { row: "lc:130040060_1_1", field: "base" }, percentagePoints: true }],
    },
  ],
};

export function getMechanicFireRateSources(group: MechanicFireRateGroup) {
  return MECHANIC_FIRE_RATE_SOURCES[group].map((source) => ({
    ...source,
    stages: source.stages.map((stage): EffectValueStage => {
      const value = NUM_MODIFIER_RESOLVER.resolveValue(stage.expression, "signed-percent", source.id).text;
      return {
        condition: stage.condition,
        value: stage.percentagePoints ? value.replace(/%$/, " 个百分点") : value,
      };
    }),
  }));
}

export interface WeaponFireRateSource {
  id: string;
  slug: string;
  name: string;
  skillName: string;
  stages: EffectValueStage[];
}

export const WEAPON_FIRE_RATE_SOURCES: readonly WeaponFireRateSource[] = [
  {
    id: "weapon:星海狂想:深寒冲击",
    slug: "星海狂想",
    name: "星海狂想",
    skillName: "深寒冲击",
    stages: [{ condition: "主动技能期间（8秒）", value: "+50%" }],
  },
  {
    id: "weapon:死亡猎手:急速狂热",
    slug: "死亡猎手",
    name: "死亡猎手",
    skillName: "急速狂热",
    stages: [{ condition: "主动技能期间", value: "+50%" }],
  },
  {
    id: "weapon:元宵来袭:吃汤圆咯",
    slug: "元宵来袭",
    name: "元宵来袭",
    skillName: "吃汤圆咯",
    stages: [{ condition: "拾取橙汤圆", value: "+40%" }],
  },
  {
    id: "weapon:死神猎手:穿射充能",
    slug: "死神猎手",
    name: "死神猎手",
    skillName: "穿射充能",
    stages: [{ condition: "主动技能充能满", value: "+40%" }],
  },
  {
    id: "weapon:爆星:齐射爆星",
    slug: "爆星",
    name: "爆星",
    skillName: "齐射爆星",
    stages: [{ condition: "主动技能期间", value: "+30%" }],
  },
  {
    id: "weapon:维和者:狂热射击",
    slug: "维和者",
    name: "维和者",
    skillName: "狂热射击",
    stages: [{ condition: "主动技能期间（8秒）", value: "+30%" }],
  },
  {
    id: "weapon:黄沙风暴:狂热射击",
    slug: "黄沙风暴",
    name: "黄沙风暴",
    skillName: "狂热射击",
    stages: [{ condition: "主动技能期间（8秒）", value: "+30%" }],
  },
  {
    id: "weapon:裁决之眼:过载暴击",
    slug: "裁决之眼",
    name: "裁决之眼",
    skillName: "过载暴击",
    stages: [{ condition: "造成暴击后（2秒）", value: "+30%" }],
  },
  {
    id: "weapon:超级复合弓:主动技能",
    slug: "超级复合弓",
    name: "超级复合弓",
    skillName: "主动技能",
    stages: [{ condition: "技能持续期间（8秒）", value: "+30%" }],
  },
  {
    id: "weapon:钢铁游隼:游隼之击",
    slug: "钢铁游隼",
    name: "钢铁游隼",
    skillName: "游隼之击",
    stages: [{ condition: "主动技能期间（10秒）", value: "+20%" }],
  },
  {
    id: "weapon:振弦:急速杀戮",
    slug: "振弦",
    name: "振弦",
    skillName: "急速杀戮",
    stages: [
      { condition: "每层", value: "+3%" },
      { condition: "5层", value: "+15%" },
    ],
  },
];

export const FIRE_RATE_EXCLUSIONS = [
  {
    id: "weapon:哈士奇好友:加油，哈士奇！",
    category: "summon-fire-rate",
    reason: "提升召唤物攻击频率，不是玩家枪械射速。",
  },
  {
    id: "category:melee-attack-speed",
    category: "melee-attack-speed",
    reason: "近战攻速不属于枪械射速。",
  },
  {
    id: "category:fixed-action-cadence",
    category: "fixed-action-cadence",
    reason: "固定动作或召唤物攻击间隔不属于枪械射速加成。",
  },
  {
    id: "resource:121200031",
    category: "obsolete",
    reason: "振弦旧版 +20% 配置，不是现行急速杀戮。",
  },
  {
    id: "resource:120600290",
    category: "no-public-entity",
    reason: "火神暴君没有站内正式武器实体。",
  },
  {
    id: "resource:121400010",
    category: "no-public-entity",
    reason: "层流冷焰没有站内正式武器实体。",
  },
  {
    id: "resource:120100200",
    category: "unverified-current-link",
    reason:
      "雷霆999 的正式主动技能描述不含射速；旧效果与现行充能被动的运行时关联尚未证实。",
  },
  {
    id: "resource:120700070",
    category: "unverified-current-link",
    reason:
      "乘风快递的正式主动技能描述不含射速，空中专线与现行技能的运行时关联尚未证实。",
  },
] as const;

interface BaseFireRateDefinition {
  slug: string;
  baseSourceId: string;
  maxSourceId: string;
  activeBonusPercent?: number;
}

const BASE_FIRE_RATE_DEFINITIONS: readonly BaseFireRateDefinition[] = [
  {
    slug: "星海狂想",
    baseSourceId: "primary-fire",
    maxSourceId: "passive-max-rate",
    activeBonusPercent: 50,
  },
  {
    slug: "纯白至上",
    baseSourceId: "pu-tong-she-ji",
    maxSourceId: "bei-dong-she-su",
  },
  {
    slug: "冥河之矛",
    baseSourceId: "pu-tong-she-ji",
    maxSourceId: "bei-dong-she-su",
  },
];

export interface BaseFireRateEntry {
  slug: string;
  name: string;
  baseInterval: number;
  baseRpm: number;
  maxInterval: number;
  maxRpm: number;
  multiplier: number;
  activeBonusPercent?: number;
  combinedMaxRpm?: number;
}

export function getFireRateEffect(
  effects: readonly PerkEffectValue[] | undefined,
): Extract<PerkEffectValue, { kind: "stat" }> | undefined {
  return effects?.find(
    (effect): effect is Extract<PerkEffectValue, { kind: "stat" }> =>
      effect.kind === "stat" && effect.statId === FIRE_RATE_STAT_ID,
  );
}

export function toWeaponFireRateEffect(
  source: WeaponFireRateSource,
): Extract<PerkEffectValue, { kind: "stat" }> {
  return {
    kind: "stat",
    statId: FIRE_RATE_STAT_ID,
    label: "射速",
    stages: source.stages,
  };
}

export function getWeaponFireRateSources(slug?: string): WeaponFireRateSource[] {
  return WEAPON_FIRE_RATE_SOURCES.filter(
    (source) => slug === undefined || source.slug === decodeURIComponent(slug),
  );
}

export function getPerkFireRateSources(): Array<{
  perk: Perk;
  effect: Extract<PerkEffectValue, { kind: "stat" }>;
}> {
  return getAllPerks()
    .flatMap((perk) => {
      const effect = getFireRateEffect(perk.effectValues);
      return effect ? [{ perk, effect }] : [];
    })
    .sort((left, right) =>
      Number(getPerkAvailability(left.perk) === "offline") -
        Number(getPerkAvailability(right.perk) === "offline") ||
      left.perk.name.localeCompare(right.perk.name, "zh-CN"),
    );
}

export function getOverlimitFireRateSources(): Array<{
  card: OverlimitCard;
  effect: Extract<PerkEffectValue, { kind: "stat" }>;
}> {
  return getAllOverlimitCards()
    .flatMap((card) => {
      const effect = getFireRateEffect(card.effectValues);
      return effect ? [{ card, effect }] : [];
    })
    .sort((left, right) => left.card.name.localeCompare(right.card.name, "zh-CN"));
}

function requireFireRateValue(
  value: number | undefined,
  slug: string,
  sourceId: string,
  field: "interval" | "rpm",
): number {
  if (value === undefined) {
    throw new Error(`射速来源 ${slug}/${sourceId} 缺少 ${field}`);
  }
  return value;
}

export async function getBaseFireRateEntries(): Promise<BaseFireRateEntry[]> {
  return Promise.all(
    BASE_FIRE_RATE_DEFINITIONS.map(async (definition) => {
      const weapon = await getResolvedWeaponBySlug(definition.slug, "lc");
      if (!weapon) throw new Error(`基础射速武器不存在: ${definition.slug}`);

      const base = weapon.damageSources.find(
        (source) => source.id === definition.baseSourceId,
      );
      const max = weapon.damageSources.find(
        (source) => source.id === definition.maxSourceId,
      );
      if (!base || !max) {
        throw new Error(`基础射速来源不存在: ${definition.slug}`);
      }

      const baseInterval = requireFireRateValue(
        getResolvedFieldValue(base.fire.interval),
        definition.slug,
        definition.baseSourceId,
        "interval",
      );
      const baseRpm = requireFireRateValue(
        getResolvedFieldValue(base.fire.rpm),
        definition.slug,
        definition.baseSourceId,
        "rpm",
      );
      const maxInterval = requireFireRateValue(
        getResolvedFieldValue(max.fire.interval),
        definition.slug,
        definition.maxSourceId,
        "interval",
      );
      const maxRpm = requireFireRateValue(
        getResolvedFieldValue(max.fire.rpm),
        definition.slug,
        definition.maxSourceId,
        "rpm",
      );
      const activeBonusPercent = definition.activeBonusPercent;

      return {
        slug: definition.slug,
        name: weapon.title,
        baseInterval,
        baseRpm,
        maxInterval,
        maxRpm,
        multiplier: maxRpm / baseRpm,
        ...(activeBonusPercent === undefined
          ? {}
          : {
              activeBonusPercent,
              combinedMaxRpm: maxRpm * (1 + activeBonusPercent / 100),
            }),
      };
    }),
  );
}
