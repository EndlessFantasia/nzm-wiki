import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { isPreviewSeason } from "@/lib/content-preview";
import { getOverlimitCatalog, getOverlimitPreviewCatalog } from "@/lib/overlimit";
import { getActivePreview, getPreviewSeasonKey } from "@/lib/content-preview";
import { getOverlimitLink, getOverlimitLinksForPerk, getOverlimitMultiplierFacets, hasOverlimitBondStage } from "@/lib/overlimit-links";
import passives from "@/data/season-talents/s3/passives.json";
import grapplingHook from "@/data/season-talents/s3/grappling-hook.json";
import ironFist from "@/data/season-talents/s3/iron-fist.json";
import zero from "@/data/season-talents/s3/zero.json";
import s4DualStar from "@/data/season-talents/s4/dual-star.json";
import s4Matrix from "@/data/season-talents/s4/matrix-symbiosis.json";
import s4BlackHole from "@/data/season-talents/s4/black-hole.json";
import s4Passives from "@/data/season-talents/s4/passives.json";
import huntingSpeedrun from "@/data/guides/hunting-speedrun.json";
import originRunes from "@/data/origin/runes.json";
import originAffixes from "@/data/origin/affixes.json";
import originTalents from "@/data/origin/talents.json";
import { getAllOverlimitCards } from "@/lib/overlimit-cards";
import {
  MODIFIER_TYPES,
  MULTIPLIER_FACTORS,
  MULTIPLIER_PROVIDERS,
  MULTIPLIER_PROVIDER_EXCLUSIONS,
  PROVIDER_RELATIONS,
  getProviderRelationsForSource,
  getSourcesForModifierType,
  resolveMultiplierSourceHref,
  type MultiplierSource,
} from "@/lib/multiplier-data";
import { loadModifierProviderRegistry } from "./num-modifier/provider-registry";
import { syncLegacyProviders } from "./s0s1-season-talents/providers";
import { syncS2Providers } from "./s2-season-talents/providers";
import { getS2TalentTree, S2_TALENT_IDS } from "../lib/s2-season-talents";

const root = process.cwd();
const { cards: overlimitCards } = getOverlimitCatalog();
const errors: string[] = [];
const sourceRegistry = loadModifierProviderRegistry();
syncLegacyProviders();
syncS2Providers();
const sourceProvidersById = new Map(
  sourceRegistry.providers.map((provider) => [provider.id, provider]),
);
const linkedPerkIds = new Set(overlimitCards.flatMap(card => card.perkItemId ? [card.perkItemId] : []));
const modifierTypeIds = new Set(MODIFIER_TYPES.map((modifier) => modifier.id));
const factorIds = new Set(MULTIPLIER_FACTORS.map((factor) => factor.id));
const coveredIds = new Set([
  ...MULTIPLIER_PROVIDERS.map((provider) => provider.id),
  ...MULTIPLIER_PROVIDER_EXCLUSIONS.map((exclusion) => exclusion.id),
]);
const speedrunCardsById = new Map(
  huntingSpeedrun.cards.map((card) => [card.cardId, card]),
);
const hydratedOverlimitCards = getAllOverlimitCards();
const overlimitProviders = MULTIPLIER_PROVIDERS.filter(
  (provider) =>
    provider.source.type === "perk" && !isPreviewSeason(provider.source.season) && linkedPerkIds.has(provider.source.itemId),
);
const overlimitProviderByItemId = new Map(
  overlimitProviders.map((provider) => [provider.source.itemId, provider]),
);
const standaloneProviders = new Map(MULTIPLIER_PROVIDERS.flatMap(provider =>
  provider.source.type === "overlimit-card" && !provider.source.season ? [[provider.source.id, provider] as const] : []));
const overlimitStatSourceCount = hydratedOverlimitCards.filter((card) =>
  card.effectValues?.some((effect) => effect.kind === "stat"),
).length;

function requireFile(relativePath: string, label: string) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`${label} 指向不存在的文件：${relativePath}`);
  }
}

function runtimeSourcesForProvider(provider: (typeof MULTIPLIER_PROVIDERS)[number]) {
  const source = provider.source;
  const result: MultiplierSource[] = [];
  switch (source.type) {
    case "perk":
      result.push({ type: "perk", slot: source.slot, slug: source.slug, season: source.season });
      for (const card of getOverlimitLinksForPerk(source.itemId, source.season)) {
        result.push({ type: "overlimit-card", id: card.id, ...(source.season ? { season: source.season } : {}) });
      }
      break;
    case "weapon":
      result.push({ type: "weapon", slug: source.slug });
      break;
    case "card":
      result.push({ type: "card", slug: source.slug });
      break;
    case "overlimit-bond":
      if (hasOverlimitBondStage(source.name, source.count, source.season)) result.push(source);
      break;
    case "overlimit-card":
      if (getOverlimitLink(source.id, source.season)) result.push(source);
      break;
    case "origin-rune":
    case "origin-affix":
      result.push(source);
      break;
    case "origin-talent":
      result.push(source);
      break;
    case "season-talent":
    case "post":
      result.push(source);
      break;
  }
  return result;
}

for (const provider of MULTIPLIER_PROVIDERS) {
  const sourceProvider = sourceProvidersById.get(provider.id);
  if (!sourceProvider) {
    errors.push(`${provider.id} 缺少 Schema V2 来源注册项`);
    continue;
  }
  if (provider.modifierTypeIds.some((id) => !modifierTypeIds.has(id))) {
    errors.push(`${provider.id} 使用不存在的 modifier type`);
  }
  if (
    sourceProvider.evidence.kind === "reviewed-override" &&
    (sourceProvider.evidence.basis?.length ?? 0) === 0
  ) {
    errors.push(`${provider.id} 的 reviewed-override 缺少依据`);
  }

  const source = provider.source;
  switch (source.type) {
    case "perk":
      requireFile(`data/${isPreviewSeason(source.season) ? "perk-preview" : "perks"}/slot-${source.slot}/${source.slug}.mdx`, provider.id);
      break;
    case "weapon":
      requireFile(`data/weapons/${source.slug}.mdx`, provider.id);
      break;
    case "card": {
      requireFile(`data/cards/${source.slug}.mdx`, provider.id);
      const card = speedrunCardsById.get(source.cardId);
      if (!card || card.slug !== source.slug) {
        errors.push(`${provider.id} 指向的卡牌不在当前 38 张卡池`);
      }
      if (
        sourceProvider.evidence.kind === "reviewed-override" ||
        !sourceProvider.applications ||
        sourceProvider.applications.length === 0
      ) {
        errors.push(`${provider.id} 的卡牌来源缺少真实 Numerical 证据`);
      }
      break;
    }
    case "overlimit-bond":
      // Old provider evidence may remain; only published stages receive links.
      break;
    case "overlimit-card":
      if (provider.id !== `overlimit-card:${source.season ? `${source.season}:` : ""}${source.id}`) errors.push(`${provider.id} 的超限来源身份不匹配`);
      break;
    case "origin-rune":
      if (provider.id !== `origin-rune:${source.id}` ||
        !originRunes.runes.some((rune) => rune.id === source.id)) {
        errors.push(`${provider.id} 的原点强化来源身份不匹配`);
      }
      break;
    case "origin-affix":
      if (provider.id !== `origin-affix:${source.id}` ||
        !originAffixes.affixes.some((affix) => affix.id === source.id)) {
        errors.push(`${provider.id} 的原点词条来源身份不匹配`);
      }
      break;
    case "origin-talent":
      if (provider.id !== `origin-talent:${source.id}` ||
        !originTalents.talents.some((talent) => talent.id === source.id)) {
        errors.push(`${provider.id} 的原点天赋来源身份不匹配`);
      }
      break;
    case "post":
      requireFile(`data/posts/${source.slug}.mdx`, provider.id);
      break;
    case "season-talent": {
      const href = resolveMultiplierSourceHref(source);
      if (source.nodeId && !href.includes(`?node=${source.nodeId}`)) {
        errors.push(`${provider.id} 的节点深链未使用 ?node=`);
      }
      if (source.passiveId && !href.includes(`?passive=${source.passiveId}`)) {
        errors.push(`${provider.id} 的被动深链未使用 ?passive=`);
      }
      break;
    }
  }

  const expectedRelations = runtimeSourcesForProvider(provider).reduce((sum, placement) => sum +
    provider.modifierTypeIds.filter(facet => placement.type !== "overlimit-card" ||
      getOverlimitLink(placement.id, placement.season)?.damageFacets.includes(facet)).length, 0);
  const actualRelations = PROVIDER_RELATIONS.filter(
    (relation) => relation.effectId === provider.id,
  );
  if (actualRelations.length !== expectedRelations) {
    errors.push(`${provider.id} 预期 ${expectedRelations} 条关系，实际 ${actualRelations.length} 条`);
  }
  for (const relation of actualRelations) {
    if (!factorIds.has(relation.factorId)) {
      errors.push(`${provider.id} 生成了不存在的 factor`);
    }
    if (!getSourcesForModifierType(relation.modifierTypeId).includes(relation)) {
      errors.push(`${provider.id} 无法从 modifier type 反查`);
    }
    if (
      relation.source &&
      !getProviderRelationsForSource(relation.source).includes(relation)
    ) {
      errors.push(`${provider.id} 无法从来源正查`);
    }
  }
}

for (const exclusion of MULTIPLIER_PROVIDER_EXCLUSIONS) {
  if (!exclusion.reason.trim()) errors.push(`${exclusion.id} 缺少排除理由`);
}

for (const rune of originRunes.runes) {
  if (!coveredIds.has(`origin-rune:${rune.id}`)) {
    errors.push(`原点强化缺少来源审计：${rune.id} ${rune.name}`);
  }
}

for (const affix of originAffixes.affixes) {
  if (!coveredIds.has(`origin-affix:${affix.id}`)) {
    errors.push(`原点词条缺少来源审计：${affix.id} ${affix.name}`);
  }
}

const perkCandidates = new Map<string, string>();
const coveredPerks = new Set([...sourceRegistry.providers, ...sourceRegistry.exclusions].flatMap(({ source }) =>
  source.type === "perk" ? [`perk:${isPreviewSeason(source.season) ? `${source.season}:` : ""}${source.itemId}`] : []));
for (const directory of ["perks", "perk-preview"]) {
  const perkRoot = path.join(root, "data", directory);
  if (!fs.existsSync(perkRoot)) continue;
  for (const slotDirectory of fs.readdirSync(perkRoot, { withFileTypes: true })) {
    if (!slotDirectory.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(perkRoot, slotDirectory.name))) {
      if (!file.endsWith(".mdx")) continue;
      const parsed = matter(
        fs.readFileSync(path.join(perkRoot, slotDirectory.name, file), "utf8"),
      );
      const itemId = String(parsed.data.id);
      if (
        Number(parsed.data.CollectMODItem) === 1 || isPreviewSeason(parsed.data.season) ||
        linkedPerkIds.has(itemId)
      ) {
        perkCandidates.set(`perk:${isPreviewSeason(parsed.data.season) ? `${parsed.data.season}:` : ""}${itemId}`, String(parsed.data.title));
      }
    }
  }
}
for (const [id, label] of perkCandidates) {
  if (!coveredPerks.has(id)) errors.push(`插件/卡片候选未处理：${id} ${label}`);
}
for (const itemId of linkedPerkIds) {
  if (!perkCandidates.has(`perk:${itemId}`)) {
    errors.push(`超限卡片显式关联了不存在的插件实体：${itemId}`);
  }
}

for (const card of hydratedOverlimitCards) {
  // An explicit card exclusion is also a reviewed result; a same-ID perk must not override it.
  const hasCardReview = coveredIds.has(`overlimit-card:${card.id}`);
  const provider = hasCardReview
    ? standaloneProviders.get(card.id)
    : card.perkItemId ? overlimitProviderByItemId.get(card.perkItemId) : undefined;
  if (!card.perkItemId && !coveredIds.has(`overlimit-card:${card.id}`)) {
    errors.push(`独立超限卡片缺少来源审计或有依据的排除项：${card.id} ${card.name}`);
  }
  const damageEffects = getOverlimitMultiplierFacets(card);

  if (!provider && damageEffects.length > 0) {
    errors.push(`超限卡片 ${card.id} ${card.name} 存在孤立 effect_values`);
    continue;
  }
  if (!provider) continue;

  const expected = [...new Set(provider.modifierTypeIds)].sort();
  const actual = damageEffects.sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(
      `超限卡片 ${card.id} ${card.name} 的 effect_values 类型不匹配：期望 ${expected.join(", ")}，实际 ${actual.join(", ") || "无"}`,
    );
  }
}

const weaponCandidates = new Map<string, string>();
const previewCatalog = getOverlimitPreviewCatalog();
const previewRelease = getActivePreview();
if (previewCatalog && previewRelease) {
  const season = getPreviewSeasonKey(previewRelease);
  for (const card of previewCatalog.cards) {
    const id = `overlimit-card:${season}:${card.id}`;
    if (!coveredIds.has(id)) errors.push(`预览超限卡片缺少独立版本的来源审计：${id} ${card.name}`);
    const provider = MULTIPLIER_PROVIDERS.find(entry => entry.id === id);
    const expected = [...new Set(provider?.modifierTypeIds ?? [])].sort();
    const actual = getOverlimitMultiplierFacets(card).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) errors.push(`预览超限卡片增伤分面不一致：${id}`);
  }
}
for (const file of fs.readdirSync(path.join(root, "data", "weapons"))) {
  if (!file.endsWith(".mdx")) continue;
  const slug = file.slice(0, -4);
  const parsed = matter(fs.readFileSync(path.join(root, "data", "weapons", file), "utf8"));
  if (parsed.data.draft === true) continue;
  if (Array.isArray(parsed.data.skills)) {
    for (const skill of parsed.data.skills) {
      if (skill.display === false) continue;
      weaponCandidates.set(`weapon:${slug}:${skill.name}`, `${slug}·${skill.name}`);
    }
    continue;
  }
  const pattern = /<(ActiveSkill|PassiveSkill)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(parsed.content)) !== null) {
    const skillName = match[2].match(/\bname\s*=\s*["']([^"']+)["']/)?.[1];
    if (!skillName) continue;
    weaponCandidates.set(`weapon:${slug}:${skillName}`, `${slug}·${skillName}`);
  }
}
for (const [id, label] of weaponCandidates) {
  if (!coveredIds.has(id)) errors.push(`武器技能候选未处理：${id} ${label}`);
}

for (const treeId of S2_TALENT_IDS) {
  const tree = getS2TalentTree(treeId)!;
  for (const entry of [...tree.nodes, ...tree.passives]) {
    const covered = [...sourceRegistry.providers, ...sourceRegistry.exclusions].some(({ source }) =>
      source.type === "season-talent" && source.season === "s2" && source.tree === tree.id &&
      ("descriptions" in entry ? source.nodeId === entry.id : source.passiveId === entry.id));
    if (!covered) errors.push(`S2 天赋未处理：${tree.id} ${entry.id} ${entry.name}`);
  }
}

for (const tree of [zero, ironFist, grapplingHook]) {
  for (const node of tree.nodes) {
    const id = `season:s3:${tree.id}:${node.id}`;
    if (!coveredIds.has(id)) errors.push(`S3 节点未处理：${id} ${node.name}`);
  }
}
for (const passive of passives.passives) {
  const id = `season:s3:passive:${passive.id}`;
  if (!coveredIds.has(id)) errors.push(`S3 被动未处理：${id} ${passive.name}`);
}

const relationKeys = new Set<string>();
for (const tree of [s4DualStar, s4Matrix, s4BlackHole]) {
  const options = s4Passives.trees[tree.id as keyof typeof s4Passives.trees];
  const entries = [
    ...tree.nodes.map(node => ({ id: node.id, name: node.name, passive: false })),
    ...[...options.light, ...options.dark].map(passive => ({ id: passive.id, name: passive.name, passive: true })),
  ];
  for (const entry of entries) {
    const id = `season:s4:${tree.id}:${entry.passive ? "passive:" : ""}${entry.id}`;
    if (!coveredIds.has(id)) errors.push(`S4 天赋未处理：${id} ${entry.name}`);
  }
}

for (const relation of PROVIDER_RELATIONS) {
  const key = `${relation.effectId}:${relation.modifierTypeId}:${relation.sourceHref}`;
  if (relationKeys.has(key)) errors.push(`重复关系：${key}`);
  relationKeys.add(key);
}

const regressions = [
  "独弹强化",
  "冥河送葬",
  "致命节拍",
  "腐蚀榴弹",
  "腐蚀狂热",
  "解构增幅",
  "近距增幅",
  "过载膛压",
  "递进膛压",
  "霰弹增伤",
  "Z型步枪·神射心流",
  "射击属性",
  "技能属性",
  "弱点属性",
  "伤害属性",
  "狂轰乱炸",
];
for (const label of regressions) {
  if (!MULTIPLIER_PROVIDERS.some((provider) => provider.label.includes(label))) {
    errors.push(`首批回归来源缺失：${label}`);
  }
}

if (errors.length > 0) {
  throw new Error(`乘区索引校验失败：\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

console.log(
  `乘区索引校验通过：${MODIFIER_TYPES.length} 个增伤类型，${MULTIPLIER_PROVIDERS.length} 个来源，${MULTIPLIER_PROVIDER_EXCLUSIONS.length} 个排除项，${PROVIDER_RELATIONS.length} 条双向关系；覆盖 ${perkCandidates.size} 个插件/卡片身份、${overlimitStatSourceCount} 个属性数值来源、${weaponCandidates.size} 个武器技能组件。`,
);
