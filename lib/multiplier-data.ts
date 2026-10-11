import rawMultiplierData from "@/data/guides/multiplier.json";
import rawProviderRuntime from "@/data/guides/multiplier-providers-runtime.json";
import { WEAPON_TYPE_SPRITES } from "@/constants/sprites";
import { isPreviewSeason } from "@/lib/content-preview";
import { getModifierAttributesForFacet, getModifierProvider } from "@/lib/modifier-index";
import { getOverlimitLink, getOverlimitLinksForPerk, hasOverlimitBondStage } from "@/lib/overlimit-links";
import type { ElementType, WeaponType } from "@/types";

const MULTIPLIER_FACTOR_IDS = [
  "base",
  "weakpoint-multiplier",
  "game-mode",
  "independent-amplification",
  "dilution",
  "element",
  "weakness",
  "critical",
  "super-critical",
  "correction",
  "vulnerability",
  "element-vulnerability",
] as const;

const DAMAGE_CHANNEL_GROUPS = ["factor", "dilution", "correction"] as const;
const DAMAGE_CHANNEL_STATUSES = ["applies", "conditional", "none"] as const;

export type MultiplierFactorId = (typeof MULTIPLIER_FACTOR_IDS)[number];
export type DilutionIconKey =
  | "target"
  | "swords"
  | "sparkles"
  | "locate-fixed"
  | "telescope"
  | "crosshair"
  | "bomb";
export type DamageChannelGroup = (typeof DAMAGE_CHANNEL_GROUPS)[number];
export type DamageChannelStatus = (typeof DAMAGE_CHANNEL_STATUSES)[number];

export type MultiplierSource =
  | { type: "weapon"; slug: string; anchor?: string }
  | { type: "perk"; slot: 1 | 2 | 3 | 4; slug: string; season?: string; anchor?: string }
  | { type: "card"; slug: string; anchor?: string }
  | { type: "overlimit-card"; id: string; season?: string; anchor?: string }
  | { type: "origin-rune"; id: string; anchor?: string }
  | { type: "origin-affix"; id: string; anchor?: string }
  | { type: "origin-talent"; id: string; anchor?: string }
  | {
      type: "overlimit-bond";
      season?: string;
      name: string;
      count: number;
      anchor?: string;
    }
  | { type: "post"; slug: string; anchor?: string }
  | {
      type: "season-talent";
      season: string;
      tree?: string;
      nodeId?: string;
      passiveId?: string;
      anchor?: string;
    };

export type MultiplierFactor = {
  id: MultiplierFactorId;
  label: string;
};

export type BaseDamageMode = {
  id: "lc" | "td";
  label: string;
  baseAttack: number;
};

export type BaseDamageData = {
  formula: string;
  modes: readonly BaseDamageMode[];
};

type DilutionExample = {
  id: string;
  label: string;
  href: string;
  image?: string;
};

export type DilutionCategory = {
  id: string;
  target: string;
  attributeField: string;
  icon: DilutionIconKey;
  examples: readonly DilutionExample[];
};

type WeakpointMultiplierGroup = {
  multiplier: number;
  weaponTypes: readonly WeaponType[];
};

type WeakpointSpecialSource = {
  id: string;
  label: string;
  image: string;
  href: string;
};

export type WeakpointMultiplierData = {
  groups: readonly WeakpointMultiplierGroup[];
  specialSources: {
    multiplier: number;
    note: string;
    items: readonly WeakpointSpecialSource[];
  };
  scaleField: string;
  enableField: string;
  formula: string;
};

type FactorDetailExample = {
  id: string;
  label: string;
  href?: string;
  image?: string;
  selectionId?: string;
};

export type MultiplierExampleArtwork = {
  href?: string;
  image?: string;
};

export function resolveMultiplierExampleImage({
  href,
  image,
}: MultiplierExampleArtwork): string | undefined {
  if (image) return image;
  if (!href?.startsWith("/weapons/")) return undefined;

  const encodedSlug = href.slice("/weapons/".length).split(/[?#]/, 1)[0];
  if (!encodedSlug) return undefined;

  let slug = encodedSlug;
  try {
    slug = decodeURIComponent(encodedSlug);
  } catch {
    // Keep the original slug when the route contains a literal percent sign.
  }

  return `/webp/icons/weapons/normal/${slug}.webp`;
}

type FactorAttributeField = {
  name: string;
  note?: string;
  selection?: { id: string; label: string };
};

export type FactorDetailData = {
  summary: string;
  rulesHeading: string;
  rules: readonly string[];
  target: string;
  targetNote: string;
  attributeFields: readonly FactorAttributeField[];
  examples: readonly FactorDetailExample[];
  notice: string;
};

type RawFactorDetailData = Omit<FactorDetailData, "attributeFields">;

export type DamageType = { id: string; label: string };

type DamageChannelEffect = {
  damageTypeId: string;
  status: DamageChannelStatus;
  label?: string;
};

export type DamageChannel = {
  id: string;
  facetId: string;
  label: string;
  group: DamageChannelGroup;
  summary: string;
  effects: readonly DamageChannelEffect[];
};

export type DamageChannelMatrixData = {
  damageTypes: readonly DamageType[];
  channels: readonly DamageChannel[];
};

export type ModifierType = DamageChannel & {
  factorId: MultiplierFactorId;
  attributeFields: readonly string[];
};

export type MultiplierProvider = {
  id: string;
  label: string;
  source: ProviderRegistrySource;
  modifierTypeIds: readonly string[];
};

type ProviderRegistrySource =
  | {
      type: "perk";
      itemId: string;
      slot: 1 | 2 | 3 | 4;
      slug: string;
      overlimitCard: boolean;
      season?: string;
    }
  | {
      type: "weapon";
      slug: string;
      skillName: string;
      component: "ActiveSkill" | "PassiveSkill";
    }
  | {
      type: "card";
      cardId: number;
      slug: string;
    }
  | Extract<MultiplierSource, { type: "overlimit-card" | "overlimit-bond" | "origin-rune" | "origin-affix" | "origin-talent" | "post" | "season-talent" }>;

export type MultiplierProviderExclusion = {
  id: string;
  label: string;
  source: ProviderRegistrySource;
  reasonCode: "independent-damage-event" | "not-damage-multiplier" | "unverified-evidence";
  reason: string;
};

export type MultiplierRelation = {
  kind: "provider" | "target";
  factorId: MultiplierFactorId;
  factorLabel: string;
  modifierTypeId: string;
  modifierTypeLabel: string;
  operations?: readonly string[];
  effectId?: string;
  effectLabel?: string;
  source?: MultiplierSource;
  sourceHref?: string;
};

export type DamageProfile = {
  damageTypeIds: readonly string[];
  damageTags: readonly string[];
  element?: ElementType;
  enableCritical: boolean;
  enableWeakness: boolean;
};

type DamageProfileInput = {
  section?: string;
  settlements: readonly string[];
  element?: ElementType | { state?: string; value?: ElementType };
  enableCritical?: boolean | { state?: string; value?: boolean };
  enableWeakness?: boolean | { state?: string; value?: boolean };
};

type RawMultiplierData = {
  schemaVersion: 12;
  defaultFactorId: MultiplierFactorId;
  factors: readonly MultiplierFactor[];
  baseDamage: BaseDamageData;
  damageChannelMatrix: DamageChannelMatrixData;
  weakpointMultiplier: WeakpointMultiplierData;
  dilutionCategories: readonly DilutionCategory[];
  factorDetails: Partial<Record<MultiplierFactorId, RawFactorDetailData>>;
};

type RawProviderRegistry = {
  schemaVersion: 1;
  providers: readonly MultiplierProvider[];
  exclusions: readonly MultiplierProviderExclusion[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertMultiplierData(value: unknown): asserts value is RawMultiplierData {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 12 ||
    typeof value.defaultFactorId !== "string" ||
    !Array.isArray(value.factors) ||
    !isRecord(value.baseDamage) ||
    !isRecord(value.damageChannelMatrix) ||
    !isRecord(value.weakpointMultiplier) ||
    !Array.isArray(value.dilutionCategories) ||
    !isRecord(value.factorDetails)
  ) {
    throw new Error("乘区数据顶层结构无效");
  }

  const factorIds = new Set<string>();
  for (const factor of value.factors) {
    if (
      !isRecord(factor) ||
      typeof factor.id !== "string" ||
      !MULTIPLIER_FACTOR_IDS.includes(factor.id as MultiplierFactorId) ||
      typeof factor.label !== "string" ||
      factorIds.has(factor.id)
    ) {
      throw new Error("乘区节点存在无效或重复字段");
    }
    factorIds.add(factor.id);
  }

  const baseDamage = value.baseDamage;
  if (
    typeof baseDamage.formula !== "string" ||
    baseDamage.formula.length === 0 ||
    !Array.isArray(baseDamage.modes)
  ) {
    throw new Error("基础伤害配置无效");
  }
  const baseDamageModeIds = new Set<string>();
  for (const mode of baseDamage.modes) {
    if (
      !isRecord(mode) ||
      (mode.id !== "lc" && mode.id !== "td") ||
      typeof mode.label !== "string" ||
      mode.label.length === 0 ||
      typeof mode.baseAttack !== "number" ||
      !Number.isFinite(mode.baseAttack) ||
      mode.baseAttack <= 0 ||
      baseDamageModeIds.has(mode.id)
    ) {
      throw new Error("基础伤害模式配置无效");
    }
    baseDamageModeIds.add(mode.id);
  }
  if (!baseDamageModeIds.has("lc") || !baseDamageModeIds.has("td")) {
    throw new Error("基础伤害模式配置不完整");
  }

  const matrix = value.damageChannelMatrix;
  if (!Array.isArray(matrix.damageTypes) || !Array.isArray(matrix.channels)) {
    throw new Error("增幅通道矩阵数据结构无效");
  }
  const damageTypeIds = new Set<string>();
  for (const damageType of matrix.damageTypes) {
    if (
      !isRecord(damageType) ||
      typeof damageType.id !== "string" ||
      typeof damageType.label !== "string" ||
      damageTypeIds.has(damageType.id)
    ) {
      throw new Error("伤害类型存在无效或重复字段");
    }
    damageTypeIds.add(damageType.id);
  }

  const modifierTypeIds = new Set<string>();
  for (const channel of matrix.channels) {
    if (
      !isRecord(channel) ||
      typeof channel.id !== "string" ||
      typeof channel.facetId !== "string" ||
      typeof channel.label !== "string" ||
      !DAMAGE_CHANNEL_GROUPS.includes(channel.group as DamageChannelGroup) ||
      !Array.isArray(channel.effects) ||
      modifierTypeIds.has(channel.id)
    ) {
      throw new Error("增幅通道存在无效或重复字段");
    }
    modifierTypeIds.add(channel.id);
    for (const effect of channel.effects) {
      if (
        !isRecord(effect) ||
        typeof effect.damageTypeId !== "string" ||
        !damageTypeIds.has(effect.damageTypeId) ||
        !DAMAGE_CHANNEL_STATUSES.includes(effect.status as DamageChannelStatus)
      ) {
        throw new Error("增幅通道适用范围无效");
      }
    }
  }

  for (const [factorId, detail] of Object.entries(value.factorDetails)) {
    if (
      !MULTIPLIER_FACTOR_IDS.includes(factorId as MultiplierFactorId) ||
      !isRecord(detail) ||
      Object.hasOwn(detail, "attributeFields") ||
      typeof detail.summary !== "string" ||
      typeof detail.rulesHeading !== "string" ||
      !Array.isArray(detail.rules) ||
      typeof detail.target !== "string" ||
      typeof detail.targetNote !== "string" ||
      !Array.isArray(detail.examples) ||
      typeof detail.notice !== "string"
    ) {
      throw new Error("乘区详情存在无效字段或复制的属性字段映射");
    }
  }

  const validWeaponTypes = new Set(Object.keys(WEAPON_TYPE_SPRITES));
  const weakpoint = value.weakpointMultiplier as Record<string, unknown>;
  if (!Array.isArray(weakpoint.groups)) throw new Error("弱点倍率数据无效");
  const seenWeaponTypes = new Set<string>();
  for (const group of weakpoint.groups) {
    if (!isRecord(group) || !Array.isArray(group.weaponTypes)) {
      throw new Error("弱点倍率分组无效");
    }
    for (const weaponType of group.weaponTypes) {
      if (
        typeof weaponType !== "string" ||
        !validWeaponTypes.has(weaponType) ||
        seenWeaponTypes.has(weaponType)
      ) {
        throw new Error("弱点倍率武器类型无效");
      }
      seenWeaponTypes.add(weaponType);
    }
  }
}

assertMultiplierData(rawMultiplierData);
const data = rawMultiplierData as unknown as RawMultiplierData;

function assertProviderRegistry(value: unknown): asserts value is RawProviderRegistry {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.providers) ||
    !Array.isArray(value.exclusions)
  ) {
    throw new Error("增伤来源注册表顶层结构无效");
  }
  const modifierTypeIds = new Set(data.damageChannelMatrix.channels.map((item) => item.id));
  const ids = new Set<string>();
  for (const provider of value.providers) {
    if (
      !isRecord(provider) ||
      typeof provider.id !== "string" ||
      typeof provider.label !== "string" ||
      ids.has(provider.id) ||
      !isRecord(provider.source) ||
      !Array.isArray(provider.modifierTypeIds) ||
      provider.modifierTypeIds.length === 0 ||
      provider.modifierTypeIds.some(
        (id) => typeof id !== "string" || !modifierTypeIds.has(id),
      )
    ) {
      throw new Error("增伤来源注册项存在无效或重复字段");
    }
    ids.add(provider.id);
  }
  for (const exclusion of value.exclusions) {
    if (
      !isRecord(exclusion) ||
      typeof exclusion.id !== "string" ||
      typeof exclusion.label !== "string" ||
      ids.has(exclusion.id) ||
      !isRecord(exclusion.source) ||
      typeof exclusion.reason !== "string" ||
      exclusion.reason.length === 0
    ) {
      throw new Error("增伤来源排除项存在无效、重复或缺少理由的字段");
    }
    ids.add(exclusion.id);
  }
}

assertProviderRegistry(rawProviderRuntime);
const providerRegistry = rawProviderRuntime as unknown as RawProviderRegistry;

function attributesForFacet(facetId: string) {
  return [...getModifierAttributesForFacet(facetId)].sort((left, right) => {
      const orderDifference =
        (left.qualifier?.order ?? Number.MAX_SAFE_INTEGER) -
        (right.qualifier?.order ?? Number.MAX_SAFE_INTEGER);
      return (
        orderDifference || left.attributeName.localeCompare(right.attributeName, "en")
      );
  });
}

function attributeFieldsForFacet(facetId: string): string[] {
  return attributesForFacet(facetId).map((attribute) => attribute.attributeName);
}

function factorIdForModifier(channel: DamageChannel): MultiplierFactorId {
  if (channel.group === "dilution") return "dilution";
  if (channel.id === "game-mode") return "game-mode";
  if (channel.id === "independent-amplification") {
    return "independent-amplification";
  }
  if (channel.id === "element") return "element";
  if (channel.id === "element-vulnerability") return "element-vulnerability";
  if (channel.id === "critical") return "critical";
  if (channel.id === "super-critical-rate") return "super-critical";
  if (channel.id === "weakness") return "weakness";
  if (channel.id === "vulnerability") return "vulnerability";
  return "correction";
}

export const MULTIPLIER_DATA = data;
export const MULTIPLIER_FACTORS = data.factors;
export const BASE_DAMAGE_DATA = data.baseDamage;
export const DAMAGE_CHANNEL_MATRIX = data.damageChannelMatrix;
export const WEAKPOINT_MULTIPLIER_DATA = data.weakpointMultiplier;
export const DILUTION_CATEGORIES = data.dilutionCategories;
export const DAMAGE_TYPES = data.damageChannelMatrix.damageTypes;
export const MODIFIER_TYPES: readonly ModifierType[] =
  data.damageChannelMatrix.channels.map((channel) => ({
    ...channel,
    factorId: factorIdForModifier(channel),
    attributeFields: attributeFieldsForFacet(channel.facetId),
  }));

function buildMultiplierFactorDetails(): Partial<
  Record<MultiplierFactorId, FactorDetailData>
> {
  const result: Partial<Record<MultiplierFactorId, FactorDetailData>> = {};
  for (const [factorId, detail] of Object.entries(data.factorDetails) as Array<
    [MultiplierFactorId, RawFactorDetailData]
  >) {
    const selectableIds = new Set(
      detail.examples.flatMap(({ selectionId }) =>
        selectionId === undefined ? [] : [selectionId],
      ),
    );
    const fields = data.damageChannelMatrix.channels
      .filter((channel) => factorIdForModifier(channel) === factorId)
      .flatMap((channel) => attributesForFacet(channel.facetId));
    const uniqueFields = [
      ...new Map(
        fields.map((attribute) => [attribute.attributeName, attribute]),
      ).values(),
    ];
    if (uniqueFields.length === 0) {
      throw new Error(`${factorId} 乘区详情无法从 Modifier 语义投影解析属性字段`);
    }
    result[factorId] = {
      ...detail,
      attributeFields: uniqueFields.map((attribute) => ({
        name: attribute.attributeName,
        ...(attribute.qualifier?.dimension === "element" &&
        selectableIds.has(attribute.qualifier.id)
          ? {
              selection: {
                id: attribute.qualifier.id,
                label: attribute.qualifier.label,
              },
            }
          : {}),
      })),
    };
  }
  return result;
}

export const MULTIPLIER_FACTOR_DETAILS = buildMultiplierFactorDetails();
export const MULTIPLIER_PROVIDERS = providerRegistry.providers;
export const MULTIPLIER_PROVIDER_EXCLUSIONS = providerRegistry.exclusions;

const factorById = new Map(MULTIPLIER_FACTORS.map((factor) => [factor.id, factor]));
const modifierTypeById = new Map(MODIFIER_TYPES.map((modifier) => [modifier.id, modifier]));

const defaultMultiplierFactor = factorById.get(data.defaultFactorId);
if (!defaultMultiplierFactor) throw new Error("默认乘区数据读取失败");
export const DEFAULT_MULTIPLIER_FACTOR = defaultMultiplierFactor;

function withAnchor(path: string, anchor?: string): string {
  return anchor ? `${path}#${encodeURIComponent(anchor)}` : path;
}

export function resolveMultiplierSourceHref(source: MultiplierSource): string {
  switch (source.type) {
    case "weapon":
      return withAnchor(`/weapons/${encodeURIComponent(source.slug)}`, source.anchor);
    case "perk":
      return withAnchor(
        `/perks/${isPreviewSeason(source.season) ? "preview/" : ""}slot-${source.slot}/${encodeURIComponent(source.slug)}`,
        source.anchor,
      );
    case "card":
      return withAnchor(`/cards/${encodeURIComponent(source.slug)}`, source.anchor);
    case "overlimit-card":
      return withAnchor(`/overlimit/${source.season ? "preview/" : ""}${encodeURIComponent(source.id)}`, source.anchor);
    case "origin-rune":
      return `/origin#rune-${encodeURIComponent(source.id)}`;
    case "origin-affix":
      return `/origin#affix-${encodeURIComponent(source.id)}`;
    case "origin-talent":
      return `/origin#talent-${encodeURIComponent(source.id)}`;
    case "overlimit-bond":
      return withAnchor(`/overlimit${source.season ? "/preview" : ""}?module=bonds`, source.anchor);
    case "post":
      return withAnchor(`/posts/${encodeURIComponent(source.slug)}`, source.anchor);
    case "season-talent": {
      const suffix = [source.season, source.tree]
        .filter(Boolean)
        .map((part) => encodeURIComponent(part as string))
        .join("/");
      const params = new URLSearchParams();
      if (source.nodeId) params.set("node", source.nodeId);
      if (source.passiveId) params.set("passive", source.passiveId);
      const query = params.size > 0 ? `?${params.toString()}` : "";
      return withAnchor(`/guides/season-talents/${suffix}${query}`, source.anchor);
    }
  }
}

export function resolveMultiplierFactorHref(
  factorId: MultiplierFactorId,
  options: { view?: "providers" | "targets"; modifierTypeId?: string } = {},
): string {
  const params = new URLSearchParams({ factor: factorId });
  if (options.view) params.set("view", options.view);
  if (options.modifierTypeId) params.set("modifier", options.modifierTypeId);
  return `/multiplier?${params.toString()}`;
}

function sourceIndexKey(source: MultiplierSource): string {
  switch (source.type) {
    case "weapon":
      return `weapon:${source.slug}`;
    case "perk":
      return `perk:${isPreviewSeason(source.season) ? `${source.season}:` : ""}${source.slot}:${source.slug}`;
    case "card":
      return `card:${source.slug}`;
    case "overlimit-card":
      return `overlimit-card:${source.season ? `${source.season}:` : ""}${source.id}`;
    case "origin-rune":
      return `origin-rune:${source.id}`;
    case "origin-affix":
      return `origin-affix:${source.id}`;
    case "origin-talent":
      return `origin-talent:${source.id}`;
    case "overlimit-bond":
      return `overlimit-bond:${source.season ? `${source.season}:` : ""}${source.name}:${source.count}`;
    case "post":
      return `post:${source.slug}`;
    case "season-talent":
      return `season-talent:${source.season}:${source.tree ?? ""}:node:${source.nodeId ?? ""}:passive:${source.passiveId ?? ""}`;
  }
}

function relationFor(
  modifierTypeId: string,
  values: Partial<MultiplierRelation>,
): MultiplierRelation | undefined {
  const modifier = modifierTypeById.get(modifierTypeId);
  if (!modifier) return undefined;
  const factor = factorById.get(modifier.factorId);
  if (!factor) return undefined;
  return {
    kind: values.kind ?? "provider",
    factorId: factor.id,
    factorLabel: factor.label,
    modifierTypeId: modifier.id,
    modifierTypeLabel: modifier.label,
    operations: values.operations,
    effectId: values.effectId,
    effectLabel: values.effectLabel,
    source: values.source,
    sourceHref: values.sourceHref,
  };
}

function operationsForProvider(
  providerId: string,
  modifierTypeId: string,
): readonly string[] | undefined {
  const provider = getModifierProvider(providerId);
  if (!provider) return undefined;

  const operations = new Set<string>();
  for (const effect of provider.effects) {
    if (!effect.facetIds.includes(modifierTypeId)) continue;
    if (effect.operation) operations.add(effect.operation);
  }
  return operations.size > 0 ? [...operations] : undefined;
}

function buildProviderRelations(): MultiplierRelation[] {
  const relations: MultiplierRelation[] = [];
  for (const provider of MULTIPLIER_PROVIDERS) {
    const placements: MultiplierSource[] = [];
    const source = provider.source;
    switch (source.type) {
      case "perk":
        placements.push({
          type: "perk",
          slot: source.slot,
          slug: source.slug,
          ...(source.season ? { season: source.season } : {}),
          anchor: "multiplier-provider",
        });
        for (const card of getOverlimitLinksForPerk(source.itemId, source.season)) {
          placements.push({
            type: "overlimit-card",
            id: card.id,
            ...(source.season ? { season: source.season } : {}),
            anchor: "multiplier-provider",
          });
        }
        break;
      case "weapon":
        placements.push({
          type: "weapon",
          slug: source.slug,
          anchor: `multiplier-provider-${provider.id}`,
        });
        break;
      case "card":
        placements.push({
          type: "card",
          slug: source.slug,
          anchor: "multiplier-provider",
        });
        break;
      case "overlimit-bond":
        if (!hasOverlimitBondStage(source.name, source.count, source.season)) break;
        placements.push({
          ...source,
          anchor: `bond-${source.name}-${source.count}`,
        });
        break;
      case "overlimit-card":
        if (getOverlimitLink(source.id, source.season)) placements.push({ ...source, anchor: "multiplier-provider" });
        break;
      case "origin-rune":
      case "origin-affix":
        placements.push(source);
        break;
      case "origin-talent":
        placements.push(source);
        break;
      case "season-talent":
        placements.push({
          ...source,
          anchor: source.passiveId
            ? `multiplier-provider-passive-${source.passiveId}`
            : `multiplier-provider-node-${source.nodeId}`,
        });
        break;
      case "post":
        placements.push(source);
        break;
    }

    for (const placement of placements) {
      for (const modifierTypeId of provider.modifierTypeIds) {
        if (placement.type === "overlimit-card" &&
          !getOverlimitLink(placement.id, placement.season)?.damageFacets.includes(modifierTypeId)) continue;
        const relation = relationFor(modifierTypeId, {
          kind: "provider",
          effectId: provider.id,
          effectLabel: provider.label,
          operations: operationsForProvider(provider.id, modifierTypeId),
          source: placement,
          sourceHref: resolveMultiplierSourceHref(placement),
        });
        if (relation) relations.push(relation);
      }
    }
  }

  const seen = new Set<string>();
  return relations.filter((relation) => {
    if (!relation.source || !relation.effectId) return false;
    const key = `${sourceIndexKey(relation.source)}:${relation.effectId}:${relation.modifierTypeId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const PROVIDER_RELATIONS = buildProviderRelations();

export function getProviderRelationsForSource(
  source: MultiplierSource,
): readonly MultiplierRelation[] {
  const key = sourceIndexKey(source);
  return PROVIDER_RELATIONS.filter(
    (relation) => relation.source && sourceIndexKey(relation.source) === key,
  );
}

export function getSourcesForModifierType(
  modifierTypeId: string,
): readonly MultiplierRelation[] {
  return PROVIDER_RELATIONS.filter(
    (relation) => relation.modifierTypeId === modifierTypeId,
  );
}

function fieldValue<T>(value: T | { state?: string; value?: T } | undefined): T | undefined {
  return isRecord(value) ? (value.value as T | undefined) : value;
}

const SETTLEMENT_TO_DAMAGE_TYPE: Readonly<Record<string, string>> = {
  "Numerical.SettlementType.Health.WeaponDamage": "hit-damage",
  "Numerical.SettlementType.Health.MeleeWeaponDamage": "hit-damage",
  "Numerical.SettlementType.Health.WeaponExplosionDamage": "explosion-damage",
  "Numerical.SettlementType.Health.WeaponSkillDamage": "weapon-skill-damage",
  "Numerical.SettlementType.Health.SkillDamage": "non-weapon-skill-damage",
  "Numerical.SettlementType.Health.DebuffDamage": "element-dot-damage",
  "Numerical.SettlementType.Health.IndirectDamage": "extra-trigger-damage",
  "Numerical.SettlementType.Health.EnvironmentDamage": "extra-trigger-damage",
  "Numerical.SettlementType.Health.CustomDamage": "extra-trigger-damage",
  "Numerical.SettlementType.Health.DeathExecute": "extra-trigger-damage",
  "Numerical.SettlementType.Health.DropEnvironmentDamage": "extra-trigger-damage",
};

export function buildDamageProfile(input: DamageProfileInput): DamageProfile {
  const damageTypeIds = new Set<string>();
  for (const settlement of input.settlements) {
    const damageTypeId = SETTLEMENT_TO_DAMAGE_TYPE[settlement];
    if (damageTypeId) damageTypeIds.add(damageTypeId);
  }
  if (damageTypeIds.size === 0 && input.section) {
    if (input.section === "dot") damageTypeIds.add("element-dot-damage");
    else if (input.section === "skill") damageTypeIds.add("weapon-skill-damage");
    else if (input.section === "special") damageTypeIds.add("extra-trigger-damage");
    else damageTypeIds.add("hit-damage");
  }

  const element = fieldValue(input.element);
  const enableCritical = fieldValue(input.enableCritical) === true;
  const enableWeakness = fieldValue(input.enableWeakness) === true;
  const damageTags = [
    ...input.settlements,
    ...(element ? [`element:${element}`] : []),
    ...(enableCritical ? ["critical-enabled"] : []),
    ...(enableWeakness ? ["weakness-enabled"] : []),
  ];
  return {
    damageTypeIds: [...damageTypeIds],
    damageTags,
    element,
    enableCritical,
    enableWeakness,
  };
}

export function getApplicableModifierTypes(
  profileOrInput: DamageProfile | DamageProfileInput,
): readonly MultiplierRelation[] {
  const profile = "damageTypeIds" in profileOrInput
    ? profileOrInput
    : buildDamageProfile(profileOrInput);
  const relations: MultiplierRelation[] = [];
  for (const modifier of MODIFIER_TYPES) {
    // ExecutionRatio belongs to a concrete event context and cannot be inferred
    // from a weapon Settlement profile alone.
    if (modifier.id === "correction") continue;
    const debuffElement: Partial<Record<string, ElementType>> = {
      "fire-debuff-damage": "火焰", "corossive-debuff-damage": "腐蚀",
      "cryo-debuff-damage": "寒冷", "shock-debuff-damage": "电弧",
    };
    if (debuffElement[modifier.id] && profile.element !== debuffElement[modifier.id]) continue;
    if (modifier.id === "critical" && !profile.enableCritical) continue;
    if (modifier.id === "weakness" && !profile.enableWeakness) continue;
    if (
      (modifier.id === "element" || modifier.id === "element-vulnerability") &&
      !profile.element
    ) continue;
    const matchingEffects = modifier.effects.filter(
      (effect) =>
        profile.damageTypeIds.includes(effect.damageTypeId) &&
        effect.status !== "none",
    );
    if (matchingEffects.length === 0) continue;
    const relation = relationFor(modifier.id, { kind: "target" });
    if (relation) relations.push(relation);
  }
  return relations;
}

export function getRelationsByFactor(
  relations: readonly MultiplierRelation[],
): readonly {
  factorId: MultiplierFactorId;
  factorLabel: string;
  relations: readonly MultiplierRelation[];
}[] {
  const groups = new Map<MultiplierFactorId, MultiplierRelation[]>();
  for (const relation of relations) {
    const group = groups.get(relation.factorId) ?? [];
    group.push(relation);
    groups.set(relation.factorId, group);
  }
  return [...groups.entries()].map(([factorId, groupedRelations]) => ({
    factorId,
    factorLabel: groupedRelations[0].factorLabel,
    relations: groupedRelations,
  }));
}
