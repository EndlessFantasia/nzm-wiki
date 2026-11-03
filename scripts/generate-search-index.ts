import fs from "fs";
import path from "path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { pinyin } from "pinyin-pro";
import {
  getFullReloadTime,
  getMainDamageSource,
  getResolvedFieldValue,
} from "../lib/weapon-consumers";
import type { ResolvedWeapon } from "../lib/weapon-resolver";
import { getAllOverlimitCards } from "../lib/overlimit-cards";
import { getOverlimitCatalog, getOverlimitPreviewCatalog } from "../lib/overlimit";
import type { OverlimitCatalog } from "../lib/overlimit-catalog";
import { getStatusEffectSearchDocuments } from "../lib/status-effects";
import { getSummonSearchDocuments } from "../lib/summons";
import { SURVIVAL_CODEX } from "../lib/survival-codex";
import { getAllResolvedWeapons } from "../lib/weapons";
import { getAllPublishedPerks, getPerkDocument } from "../lib/perks";
import { getPerkPreviewCatalog } from "../lib/perk-preview";
import { getActivePreview, isPreviewSeason } from "../lib/content-preview";
import { getS2TalentTree, S2_TALENT_IDS } from "../lib/s2-season-talents";
import { getLegacyTalentCatalog } from "../lib/s0s1-season-talents";
import type { OverlimitCard, Perk } from "../types";

export interface SearchItem {
  title: string;
  slug: string;
  path: string;
  category: string;
  keywords: string[];
  pinyin: string[];  // 预计算的拼音
}

const baseDir = path.join(process.cwd(), "data");

// 分类映射
const categoryMap: Record<string, string> = {
  weapons: "武器",
  perks: "特性",
  traps: "陷阱",
  "enemies/lc/boss": "首领",
  "enemies/lc/monsters": "猎场怪物",
  "enemies/td": "塔防敌人",
  cards: "卡牌",
  posts: "文章",
  builds: "搭配攻略",
};

// 路径映射（用于生成实际的访问路径）
const pathMap: Record<string, string> = {
  weapons: "/weapons",
  perks: "/perks",
  traps: "/traps",
  "enemies/lc/boss": "/bosses",
  "enemies/lc/monsters": "/enemies/lc/monsters",
  "enemies/td": "/enemies/td",
  cards: "/cards",
  posts: "/posts",
  builds: "/builds",
};

export function getBuildGuideSearchKeywords(data: Record<string, unknown>): string[] {
  const weapons = data.weapons as
    | { primary?: unknown; secondary?: unknown; melee?: unknown }
    | undefined;
  const perks = data.perks as
    | {
        primary?: Record<string, unknown>;
        secondary?: Record<string, unknown>;
      }
    | undefined;
  const talent = data.talent as
    | { tree?: unknown; passive?: unknown; route?: unknown }
    | undefined;
  const treeNames: Record<string, string> = {
    zero: "零点",
    "grappling-hook": "劫掠钩锁",
    "iron-fist": "铁拳狂徒",
  };
  const passiveFile = path.join(
    baseDir,
    "season-talents",
    "s3",
    "passives.json",
  );
  const passiveNames = fs.existsSync(passiveFile)
    ? new Map(
        (
          JSON.parse(fs.readFileSync(passiveFile, "utf8")) as {
            passives: Array<{ id: string; name: string }>;
          }
        ).passives.map((passive) => [passive.id, passive.name]),
      )
    : new Map<string, string>();
  const perkSlugs = [
    ...Object.values(perks?.primary ?? {}),
    ...Object.values(perks?.secondary ?? {}),
  ].filter((value): value is string => typeof value === "string");
  const tree = typeof talent?.tree === "string" ? talent.tree : "";
  const passive = typeof talent?.passive === "string" ? talent.passive : "";

  return [
    "S3",
    typeof data.summary === "string" ? data.summary : "",
    typeof data.source === "string" ? data.source : "",
    typeof weapons?.primary === "string" ? weapons.primary : "",
    typeof weapons?.secondary === "string" ? weapons.secondary : "",
    typeof weapons?.melee === "string" ? weapons.melee : "",
    ...perkSlugs,
    ...perkSlugs.map((slug) => slug.split("/").at(-1) ?? slug),
    tree,
    treeNames[tree] ?? "",
    passive,
    passiveNames.get(passive) ?? "",
    typeof talent?.route === "string" ? talent.route : "",
  ].filter(Boolean);
}

export function scanDirectory(dirPath: string, relativePath: string = ""): SearchItem[] {
  const results: SearchItem[] = [];

  if (!fs.existsSync(dirPath)) {
    return results;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // 武器及插件从发布服务注入，预览编辑草稿不生成路由。
      if (["weapons", "perks", "perk-preview"].includes(entry.name)) continue;
      // 路由组目录（以括号开头）不包含在 slug 中
      if (entry.name.startsWith("(")) {
        results.push(...scanDirectory(fullPath, relativePath));
      } else {
        const currentRelativePath = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;
        results.push(...scanDirectory(fullPath, currentRelativePath));
      }
    } else if (entry.name.endsWith(".mdx")) {
      const fileContent = fs.readFileSync(fullPath, "utf-8");
      const { data } = matter(fileContent);

      // draft 文章不加入搜索索引
      if (data.draft) continue;

      const fileName = entry.name.replace(/\.mdx$/, "");
      const slug = relativePath ? `${relativePath}/${fileName}` : fileName;

      // 猎场精英敌人尚未有公开路由，不生成失效的旧前缀链接。
      if (slug.startsWith("enemies/lc/elite/")) continue;
      // 猎场怪物血量链路尚未补全，暂时关闭搜索入口。
      if (slug.startsWith("enemies/lc/monsters/")) continue;

      // 确定分类
      let category = "其他";
      let urlPath = "";

      for (const [prefix, cat] of Object.entries(categoryMap)) {
        if (slug.startsWith(prefix)) {
          category = cat;
          break;
        }
      }

      // 确定 URL 路径
      for (const [prefix, p] of Object.entries(pathMap)) {
        if (slug.startsWith(prefix)) {
          const remainder = slug.slice(prefix.length);
          urlPath = p + remainder;
          break;
        }
      }

      if (!urlPath) {
        urlPath = `/${slug}`;
      }

      // 收集关键词
      const keywords: string[] = [];

      if (relativePath === "enemies/lc/monsters") {
        const kinds: Record<string, string> = { normal: "普通", captain: "队长", elite: "精英" };
        keywords.push(kinds[data.kind] ?? "", "猎场怪物");
        for (const appearance of data.appearances ?? []) {
          keywords.push(appearance.map, appearance.area);
        }
      }

      // 添加文件名作为关键词
      keywords.push(fileName);

      // 添加 title
      if (data.title) {
        keywords.push(data.title);
      }

      // 添加 nickname（陷阱、敌人等有此字段）
      if (data.nickname) {
        keywords.push(data.nickname);
      }

      // 添加自定义 keywords 字段
      if (data.keywords) {
        if (Array.isArray(data.keywords)) {
          keywords.push(...data.keywords);
        } else if (typeof data.keywords === "string") {
          keywords.push(data.keywords);
        }
      }

      // 添加 tags（武器有此字段）
      if (data.tags && Array.isArray(data.tags)) {
        keywords.push(...data.tags);
      }

      // 添加 weapon_type
      if (data.weapon_type) {
        keywords.push(data.weapon_type);
      }

      // 添加 element
      if (data.element) {
        keywords.push(data.element);
      }

      // 添加 rarity
      if (data.rarity) {
        keywords.push(data.rarity);
      }

      // 添加 tag（文章有此字段）
      if (data.tag) {
        if (Array.isArray(data.tag)) {
          keywords.push(...data.tag);
        } else {
          keywords.push(data.tag);
        }
      }

      if (slug.startsWith("builds/")) {
        keywords.push(...getBuildGuideSearchKeywords(data));
      }

      // 生成拼音索引（全拼和首字母）
      const allText = [data.title || fileName, ...keywords].filter(Boolean);
      const pinyinSet = new Set<string>();
      for (const text of allText) {
        // 全拼
        const fullPinyin = pinyin(String(text), { toneType: "none", type: "array" }).join("");
        if (fullPinyin) pinyinSet.add(fullPinyin.toLowerCase());
        // 首字母
        const initials = pinyin(String(text), { pattern: "first", toneType: "none", type: "array" }).join("");
        if (initials) pinyinSet.add(initials.toLowerCase());
      }

      results.push({
        title: data.title || fileName,
        slug,
        path: urlPath,
        category,
        keywords: [...new Set(keywords.filter(Boolean).map(String))],
        pinyin: [...pinyinSet],
      });
    }
  }

  return results;
}

function buildPinyin(texts: readonly string[]): string[] {
  const values = new Set<string>();
  for (const text of texts) {
    const full = pinyin(text, { toneType: "none", type: "array" }).join("");
    if (full) values.add(full.toLowerCase());
    const initials = pinyin(text, {
      pattern: "first",
      toneType: "none",
      type: "array",
    }).join("");
    if (initials) values.add(initials.toLowerCase());
  }
  return [...values];
}

function cleanSearchText(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/\*\*/g, "");
}

export function createPerkSearchItem(
  perk: Perk,
  metadata: Record<string, unknown> = {},
): SearchItem {
  const label = isPreviewSeason(perk.season)
    ? getActivePreview()?.label ?? perk.season
    : undefined;
  const extraKeywords = [metadata.keywords, metadata.tag, metadata.tags]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === "string");
  const keywords = [...new Set([
    perk.name,
    perk.id,
    perk.itemId,
    `${perk.slot}号槽位`,
    String(perk.rarity),
    ...(perk.weaponNames ?? []),
    ...extraKeywords,
    ...(label ? [label, "预览"] : []),
  ])];
  return {
    title: label ? `${perk.name} · ${label}` : perk.name,
    slug: `perks/${perk.slug}`,
    path: `/perks/${perk.slug}`,
    category: "特性",
    keywords,
    pinyin: buildPinyin([perk.name, ...keywords]),
  };
}

export function createOverlimitCardSearchItem(card: OverlimitCard, edition?: { basePath: string; label: string }): SearchItem {
  const keywords = [
    card.id,
    cleanSearchText(card.description),
    `${card.quality}品质`,
    ...(card.weight !== undefined ? [`权重${card.weight}`] : []),
    ...(card.slot !== undefined ? [`${card.slot}号槽位`] : []),
    ...card.weaponNames,
    ...card.tags.map((tag) => tag.name),
    ...(card.effectValues ?? []).flatMap((effect) => [
      effect.label,
      ...effect.stages.flatMap((stage) => [
        stage.condition ?? "",
        stage.value,
      ]),
    ]),
  ];
  return {
    title: edition ? `${card.name} · ${edition.label}` : card.name,
    slug: `${edition?.basePath.slice(1) ?? "overlimit"}/${card.id}`,
    path: `${edition?.basePath ?? "/overlimit"}/${card.id}`,
    category: "超限卡片",
    keywords: [...new Set(keywords)],
    pinyin: buildPinyin([card.name, ...keywords]),
  };
}

export function createOverlimitPreviewSearchItems(catalog: OverlimitCatalog): SearchItem[] {
  const basePath = "/overlimit/preview";
  const label = catalog.season.label;
  const cards = catalog.cards.map(card => createOverlimitCardSearchItem(card, { basePath, label }));
  const modules = [
    { id: "cards", title: "超限图鉴", values: catalog.cards.map(card => card.name) },
    ...(catalog.bonds ? [{ id: "bonds", title: "羁绊效果", values: catalog.bonds.flatMap(bond =>
      [bond.name, ...bond.effects.flatMap(effect => [`x${effect.count}`, effect.description])]) }] : []),
    ...(catalog.mapRotation ? [{ id: "map-rotation", title: "地图轮换", values: catalog.mapRotation.periods.flatMap(period =>
      [period.startDate, ...period.maps.flatMap(map => [map.name, ...map.activeBonds])]) }] : []),
    ...(catalog.levels ? [{ id: "levels", title: "等级图鉴", values: ["重抽费用", "升级概率"] }] : []),
  ];
  return [...cards, ...modules.map(module => ({
    title: `${label} ${module.title}`, slug: `overlimit/preview/${module.id}`,
    path: `${basePath}#${module.id}`, category: "超限图鉴",
    keywords: [label, "预览", ...module.values], pinyin: buildPinyin([label, module.title, ...module.values]),
  }))];
}

type StatusEffectSearchDocument = ReturnType<
  typeof getStatusEffectSearchDocuments
>[number];

export function createStatusEffectSearchItem(
  document: StatusEffectSearchDocument,
): SearchItem {
  const route =
    document.target === "enemy" ? "enemy-buffs" : "player-buffs";
  const keywords = [
    String(document.buffId),
    ...document.keywords,
  ].filter(
    (value, index, values) =>
      value.length > 0 && values.indexOf(value) === index,
  );

  return {
    title: document.title,
    slug: `status-effects/${document.target}/${document.buffId}`,
    path: `/posts/${route}?buff=${document.buffId}#status-effect-${document.buffId}`,
    category: "状态效果",
    keywords,
    pinyin: buildPinyin([document.title, ...keywords]),
  };
}

type SummonSearchDocument = ReturnType<typeof getSummonSearchDocuments>[number];

export function createSummonSearchItem(
  document: SummonSearchDocument,
): SearchItem {
  const params = new URLSearchParams({ summon: document.summonId });
  if (document.section) params.set("section", document.section);
  const anchor = document.section
    ? `summon-${document.summonId}-${document.section}`
    : `summon-${document.summonId}`;
  const keywords = [
    "召唤物",
    document.summonId,
    ...document.keywords,
  ].filter(
    (value, index, values) => value.length > 0 && values.indexOf(value) === index,
  );
  return {
    title: document.title,
    slug: document.section
      ? `summons/${document.summonId}/mechanics/${document.section}`
      : `summons/${document.summonId}`,
    path: `/posts/summons?${params.toString()}#${anchor}`,
    category: "召唤物",
    keywords,
    pinyin: buildPinyin([document.title, ...keywords]),
  };
}

type SeasonTalentSearchDocument = {
  season: "s0" | "s1" | "s2" | "s3" | "s4";
  tree: string;
  treeName: string;
  id: string;
  title: string;
  kind: "node" | "passive";
  keywords: string[];
};

export function createSeasonTalentSearchItem(
  document: SeasonTalentSearchDocument,
): SearchItem {
  const queryKey = document.kind === "node" ? "node" : "passive";
  const anchor =
    document.season !== "s3"
      ? `season-talent-${queryKey}-${document.id}`
      : `multiplier-provider-${queryKey}-${document.id}`;
  const seasonLabel = document.season.toUpperCase();
  const keywords = [
    seasonLabel,
    "赛季天赋",
    document.treeName,
    document.id,
    ...document.keywords,
  ].filter(
    (value, index, values) =>
      value.length > 0 && values.indexOf(value) === index,
  );
  return {
    title: document.title,
    slug: `season-talents/${document.season}/${document.tree}/${queryKey}/${document.id}`,
    path: `/guides/season-talents/${document.season}/${document.tree}?${queryKey}=${document.id}#${anchor}`,
    category: "赛季天赋",
    keywords,
    pinyin: buildPinyin([document.title, ...keywords]),
  };
}

export function createWeaponSearchItem(weapon: ResolvedWeapon): SearchItem {
  const weaponType = getResolvedFieldValue(weapon.weaponType);
  const element = getResolvedFieldValue(weapon.element);
  const rarity = getResolvedFieldValue(weapon.rarity);
  const keywords = [
    weapon.slug,
    weapon.title,
    weapon.nickname,
    ...weapon.keywords,
    ...weapon.tags,
    weaponType,
    element,
    rarity,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  return {
    title: weapon.title,
    slug: `weapons/${weapon.slug}`,
    path: `/weapons/${weapon.slug}`,
    category: "武器",
    keywords: [...new Set(keywords)],
    pinyin: buildPinyin([weapon.title, ...keywords]),
  };
}

export function generateSearchIndex(weapons: readonly ResolvedWeapon[]) {
  console.log("Generating search index...");

  const items = scanDirectory(baseDir);
  items.push(...getAllPublishedPerks().map((perk) =>
    createPerkSearchItem(perk, getPerkDocument(perk.slug).metadata)));
  const perkPreview = getPerkPreviewCatalog();
  if (perkPreview) {
    const title = `${perkPreview.season.label} 插件图鉴`;
    const keywords = [perkPreview.season.label, "插件", "特性", "预览"];
    items.push({ title, slug: "perks/preview", path: "/perks/preview", category: "特性", keywords, pinyin: buildPinyin([title, ...keywords]) });
  }
  const damageSourceKeywords = [
    "伤害来源",
    "射击伤害",
    "原子伤害",
    "WeaponDamage",
    "WeaponExplosionDamage",
    "SettlementType",
    "增伤范围",
    "游戏乘区 Part 2",
  ];
  items.push({
    title: "伤害来源分类",
    slug: "multiplier?part=damage-sources",
    path: "/multiplier?part=damage-sources",
    category: "攻略机制",
    keywords: damageSourceKeywords,
    pinyin: buildPinyin(["伤害来源分类", ...damageSourceKeywords]),
  });
  items.push(...weapons.map(createWeaponSearchItem));
  items.push(
    ...getStatusEffectSearchDocuments().map(createStatusEffectSearchItem),
  );
  items.push(...getSummonSearchDocuments().map(createSummonSearchItem));
  const shootingRangeKeywords = ["靶场", "敌人图鉴", "生命", "护盾", "变异丧尸男", "冲锋工程师", "衣之枢"];
  items.push({ title: "靶场", slug: "enemies/lc/shooting-range", path: "/enemies/lc/shooting-range", category: "敌人图鉴", keywords: shootingRangeKeywords, pinyin: buildPinyin(["靶场", ...shootingRangeKeywords]) });
  const s3TalentSlugs = ["iron-fist", "zero", "grappling-hook"];
  for (const season of ["s0", "s1"] as const) {
    for (const tree of getLegacyTalentCatalog(season)) {
      const keywords = [season.toUpperCase(), "赛季天赋", tree.name, tree.subtitle];
      items.push({ title: `${tree.name}天赋树（${season.toUpperCase()}）`, slug: `season-talents/${season}/${tree.id}`, path: `/guides/season-talents/${season}/${tree.id}`, category: "赛季天赋", keywords, pinyin: buildPinyin(keywords) });
      for (const node of tree.nodes) items.push(createSeasonTalentSearchItem({ season, tree: tree.id, treeName: tree.name, id: node.id, title: node.name, kind: "node", keywords: node.levels.map(level => level.description) }));
    }
  }
  for (const id of S2_TALENT_IDS) {
    const tree = getS2TalentTree(id)!;
    const keywords = ["S2", "赛季天赋", tree.name, tree.subtitle, tree.applicableWeapons];
    items.push({ title: `${tree.name}天赋树（S2）`, slug: `season-talents/s2/${id}`, path: `/guides/season-talents/s2/${id}`, category: "赛季天赋", keywords, pinyin: buildPinyin(keywords) });
    for (const node of tree.nodes) items.push(createSeasonTalentSearchItem({ season: "s2", tree: id, treeName: tree.name, id: node.id, title: node.name, kind: "node", keywords: node.descriptions }));
    for (const passive of tree.passives) items.push(createSeasonTalentSearchItem({ season: "s2", tree: id, treeName: tree.name, id: passive.id, title: passive.name, kind: "passive", keywords: [passive.description] }));
  }
  for (const slug of s3TalentSlugs) {
    const talentFile = path.join(baseDir, "season-talents", "s3", `${slug}.json`);
    if (!fs.existsSync(talentFile)) continue;

    const talent = JSON.parse(fs.readFileSync(talentFile, "utf-8")) as {
      id: string;
      name: string;
      subtitle: string;
      applicableWeapons: string[];
      nodes: Array<{ id: string; name: string; descriptions: string[] }>;
    };
    const keywords = [
      "S3",
      "赛季天赋",
      ...(talent.id === "iron-fist" ? ["铁拳狂战"] : []),
      talent.subtitle,
      ...talent.applicableWeapons,
      ...talent.nodes.map((node) => node.name),
      ...talent.nodes.flatMap((node) => node.descriptions),
    ];
    const pinyinSet = new Set<string>();
    for (const text of [talent.name, ...keywords]) {
      const fullPinyin = pinyin(String(text), {
        toneType: "none",
        type: "array",
      }).join("");
      if (fullPinyin) pinyinSet.add(fullPinyin.toLowerCase());
      const initials = pinyin(String(text), {
        pattern: "first",
        toneType: "none",
        type: "array",
      }).join("");
      if (initials) pinyinSet.add(initials.toLowerCase());
    }

    items.push({
      title: `${talent.name}天赋树（S3）`,
      slug: `season-talents/s3/${slug}`,
      path: `/guides/season-talents/s3/${slug}`,
      category: "赛季天赋",
      keywords: [...new Set(keywords)],
      pinyin: [...pinyinSet],
    });

    items.push(
      ...talent.nodes.map((node) =>
        createSeasonTalentSearchItem({
          season: "s3",
          tree: slug,
          treeName: talent.name,
          id: node.id,
          title: node.name,
          kind: "node",
          keywords: [
            talent.subtitle,
            ...talent.applicableWeapons,
            ...node.descriptions.map((description) =>
              description.replace(/<[^>]+>/g, ""),
            ),
          ],
        }),
      ),
    );
  }


  const s3PassivesFile = path.join(baseDir, "season-talents", "s3", "passives.json");
  if (fs.existsSync(s3PassivesFile)) {
    const passiveData = JSON.parse(fs.readFileSync(s3PassivesFile, "utf-8")) as {
      passives: Array<{
        id: string;
        name: string;
        unlockLevel: number;
        tags: string[];
        description: string;
      }>;
    };
    items.push(
      ...passiveData.passives.map((passive) =>
        createSeasonTalentSearchItem({
          season: "s3",
          tree: "zero",
          treeName: "零点",
          id: passive.id,
          title: passive.name,
          kind: "passive",
          keywords: [
            `等级 ${passive.unlockLevel}`,
            ...passive.tags,
            passive.description.replace(/<[^>]+>/g, ""),
          ],
        }),
      ),
    );
  }

  const s4TalentSlugs = [
    "dual-star",
    "matrix-symbiosis",
    "black-hole",
  ] as const;
  const s4PassivesFile = path.join(
    baseDir,
    "season-talents",
    "s4",
    "passives.json",
  );
  const s4PassiveData = fs.existsSync(s4PassivesFile)
    ? (JSON.parse(fs.readFileSync(s4PassivesFile, "utf-8")) as {
        draft?: boolean;
        trees: Record<
          string,
          {
            light: Array<{
              id: string;
              name: string;
              description: string;
              tags: string[];
            }>;
            dark: Array<{
              id: string;
              name: string;
              description: string;
              tags: string[];
            }>;
          }
        >;
      })
    : null;

  for (const slug of s4TalentSlugs) {
    const talentFile = path.join(
      baseDir,
      "season-talents",
      "s4",
      `${slug}.json`,
    );
    if (!fs.existsSync(talentFile)) continue;
    const talent = JSON.parse(fs.readFileSync(talentFile, "utf-8")) as {
      draft?: boolean;
      name: string;
      subtitle: string;
      applicableWeapons: string;
      nodes: Array<{ id: string; name: string; descriptions: string[] }>;
    };
    if (talent.draft === true || s4PassiveData?.draft === true) continue;

    const clean = (value: string) => value.replace(/<[^>]+>/g, "");
    const keywords = [
      "S4",
      "赛季天赋",
      talent.subtitle,
      clean(talent.applicableWeapons),
      ...talent.nodes.map((node) => node.name),
    ];
    items.push({
      title: `${talent.name}天赋树（S4）`,
      slug: `season-talents/s4/${slug}`,
      path: `/guides/season-talents/s4/${slug}`,
      category: "赛季天赋",
      keywords: [...new Set(keywords)],
      pinyin: buildPinyin([talent.name, ...keywords]),
    });
    items.push(
      ...talent.nodes.map((node) =>
        createSeasonTalentSearchItem({
          season: "s4",
          tree: slug,
          treeName: talent.name,
          id: node.id,
          title: node.name,
          kind: "node",
          keywords: [
            talent.subtitle,
            clean(talent.applicableWeapons),
            ...node.descriptions.map(clean),
          ],
        }),
      ),
    );

    const treePassives = s4PassiveData?.trees[slug];
    if (!treePassives) continue;
    items.push(
      ...[...treePassives.light, ...treePassives.dark].map((passive) =>
        createSeasonTalentSearchItem({
          season: "s4",
          tree: slug,
          treeName: talent.name,
          id: passive.id,
          title: passive.name,
          kind: "passive",
          keywords: [...passive.tags, clean(passive.description)],
        }),
      ),
    );
  }
  const originKeywords = ["原点猎场", "原点图鉴", "强化", "强化图鉴", "特殊强化", "普通强化"];
  const originPinyin = new Set<string>();
  for (const text of originKeywords) {
    for (const pattern of ["pinyin", "first"] as const) {
      const value = pinyin(text, { pattern, toneType: "none", type: "array" }).join("").toLowerCase();
      if (value) originPinyin.add(value);
    }
  }
  items.push({ title: "强化图鉴", slug: "origin/runes", path: "/origin#runes",
    category: "原点图鉴", keywords: originKeywords, pinyin: [...originPinyin] });

  const affixKeywords = ["原点猎场", "原点图鉴", "词条", "词条图鉴", "武器词条", "特殊词条", "普通词条"];
  items.push({ title: "词条图鉴", slug: "origin/affixes", path: "/origin#affixes",
    category: "原点图鉴", keywords: affixKeywords,
    pinyin: [...new Set(affixKeywords.flatMap((text) =>
      (["pinyin", "first"] as const).map((pattern) =>
        pinyin(text, { pattern, toneType: "none", type: "array" }).join("").toLowerCase())))] });

  const talentKeywords = ["原点猎场", "原点天赋", "天赋树", "战斗", "幸运", "技巧", "终极天赋", "强化预载"];
  items.push({ title: "原点天赋", slug: "origin/talents", path: "/origin#talents",
    category: "原点图鉴", keywords: talentKeywords,
    pinyin: [...new Set(talentKeywords.flatMap((text) =>
      (["pinyin", "first"] as const).map((pattern) =>
        pinyin(text, { pattern, toneType: "none", type: "array" }).join("").toLowerCase())))] });

  const survivalKeywords = ["生存战", "生存战图鉴", "时空猎场", "战术技能", "终极进化"];
  items.push({ title: "生存战图鉴", slug: "survival", path: "/survival",
    category: "生存战图鉴", keywords: survivalKeywords, pinyin: buildPinyin(survivalKeywords) });
  const survivalEntries = [
    ...SURVIVAL_CODEX.skills.map((skill) => ({ kind: "skill", id: skill.id, name: skill.name,
      keywords: [skill.ultimate.name, ...skill.tags.map((tag) => tag.text)] })),
    ...SURVIVAL_CODEX.passives.map((passive) => ({ kind: "passive", id: passive.id, name: passive.name,
      keywords: passive.tags.map((tag) => tag.text) })),
    ...SURVIVAL_CODEX.specials.map((special) => ({ kind: "special", id: special.id, name: special.name,
      keywords: special.tags.map((tag) => tag.text) })),
  ];
  for (const entry of survivalEntries) {
    const keywords = ["生存战", entry.name, ...entry.keywords];
    items.push({ title: entry.name, slug: `survival/${entry.kind}-${entry.id}`, path: `/survival#${entry.kind}-${entry.id}`,
      category: "生存战图鉴", keywords, pinyin: buildPinyin(keywords) });
  }

  items.push(...getAllOverlimitCards().map(card => createOverlimitCardSearchItem(card)));
  const overlimitPreview = getOverlimitPreviewCatalog();
  if (overlimitPreview) items.push(...createOverlimitPreviewSearchItems(overlimitPreview));

  const overlimit = getOverlimitCatalog();
  if (overlimit.levels) {
    const keywords = [
      "超限猎场",
      "升级概率",
      "品质概率",
      "紫卡",
      "金卡",
      "橙卡",
      "4插",
      "4插卡池",
      "4插概率加成",
      "2x",
      "暴击升级",
      "重抽费用",
    ];
    const pinyinSet = new Set<string>();
    for (const text of ["等级图鉴", ...keywords]) {
      const fullPinyin = pinyin(text, {
        toneType: "none",
        type: "array",
      }).join("");
      if (fullPinyin) pinyinSet.add(fullPinyin.toLowerCase());
      const initials = pinyin(text, {
        pattern: "first",
        toneType: "none",
        type: "array",
      }).join("");
      if (initials) pinyinSet.add(initials.toLowerCase());
    }

    items.push({
      title: "等级图鉴",
      slug: "overlimit/levels",
      path: "/overlimit#levels",
      category: "超限图鉴",
      keywords,
      pinyin: [...pinyinSet],
    });
  }

  if (overlimit.bonds) {
    const bonds = overlimit.bonds;
    const keywords = [
      "超限猎场",
      "羁绊效果",
      "套装词条",
      ...new Set(bonds.flatMap((bond) => bond.effects.map((effect) => `x${effect.count}`))),
      ...bonds.flatMap((bond) => [
        bond.name,
        ...bond.effects.map((effect) => effect.description),
      ]),
    ];
    const pinyinSet = new Set<string>();
    for (const text of ["羁绊效果", ...keywords]) {
      const fullPinyin = pinyin(text, {
        toneType: "none",
        type: "array",
      }).join("");
      if (fullPinyin) pinyinSet.add(fullPinyin.toLowerCase());
      const initials = pinyin(text, {
        pattern: "first",
        toneType: "none",
        type: "array",
      }).join("");
      if (initials) pinyinSet.add(initials.toLowerCase());
    }

    items.push({
      title: "羁绊效果",
      slug: "overlimit/bonds",
      path: "/overlimit#bonds",
      category: "超限图鉴",
      keywords,
      pinyin: [...pinyinSet],
    });
  }

  if (overlimit.mapRotation) {
    const schedule = overlimit.mapRotation;
    const mapNames = new Set<string>();
    const bondNames = new Set<string>();

    for (const period of schedule.periods) {
      for (const map of period.maps) {
        mapNames.add(map.name);
        for (const bond of map.activeBonds) bondNames.add(bond);
      }
    }

    const keywords = [
      `${schedule.season}赛季`,
      "超限猎场",
      "地图羁绊",
      "羁绊档期",
      ...mapNames,
      ...bondNames,
    ];
    const pinyinSet = new Set<string>();
    for (const text of ["地图轮换", ...keywords]) {
      const fullPinyin = pinyin(text, {
        toneType: "none",
        type: "array",
      }).join("");
      if (fullPinyin) pinyinSet.add(fullPinyin.toLowerCase());
      const initials = pinyin(text, {
        pattern: "first",
        toneType: "none",
        type: "array",
      }).join("");
      if (initials) pinyinSet.add(initials.toLowerCase());
    }

    items.push({
      title: "地图轮换",
      slug: "overlimit/map-rotation",
      path: "/overlimit#map-rotation",
      category: "超限图鉴",
      keywords,
      pinyin: [...pinyinSet],
    });
  }

  // 按分类排序
  items.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category, "zh-CN");
    }
    return a.title.localeCompare(b.title, "zh-CN");
  });

  const outputPath = path.join(process.cwd(), "public", "search-index.json");

  // 确保目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(items, null, 2), "utf-8");

  console.log(`Generated search index with ${items.length} items`);
  console.log(`Output: ${outputPath}`);
}

export interface WeaponStat {
  title: string;
  use_type: string | null;
  weapon_type: string | null;
  element: string | null;
  rarity: string | null;
  damage_base: number | null;
  weakness_multiplier: number | null;
  rpm: number | null;
  magazine: number | null;
  reload_time: number | null;
  enable_critical: boolean | null;
  game_mode: "lc";
  pinyin: string[];
}

export function createWeaponStat(weapon: ResolvedWeapon): WeaponStat | null {
  if (weapon.table !== "lc") {
    throw new Error(
      `weapon-stats only accepts LC ResolvedWeapon: ${weapon.slug}`,
    );
  }
  if (weapon.useType === "近战武器") return null;
  const source = getMainDamageSource(weapon);
  return {
    title: weapon.title,
    use_type: weapon.useType ?? null,
    weapon_type: getResolvedFieldValue(weapon.weaponType) ?? null,
    element: getResolvedFieldValue(weapon.element) ?? null,
    rarity: getResolvedFieldValue(weapon.rarity) ?? null,
    damage_base: source
      ? (getResolvedFieldValue(source.damage.base) ?? null)
      : null,
    weakness_multiplier: source
      ? (getResolvedFieldValue(source.weaknessMultiplier) ?? null)
      : null,
    rpm: source ? (getResolvedFieldValue(source.fire.rpm) ?? null) : null,
    magazine: getResolvedFieldValue(weapon.magazine) ?? null,
    reload_time: getFullReloadTime(weapon.changeClip) ?? null,
    enable_critical: source
      ? (getResolvedFieldValue(source.enableCritical) ?? null)
      : null,
    game_mode: "lc",
    pinyin: buildPinyin([weapon.title]),
  };
}

export function buildWeaponStats(
  resolvedWeapons: readonly ResolvedWeapon[],
): WeaponStat[] {
  const weapons = resolvedWeapons.flatMap((weapon) => {
    const stat = createWeaponStat(weapon);
    return stat ? [stat] : [];
  });
  const rarityOrder: Record<string, number> = {
    传说: 3,
    史诗: 2,
    稀有: 1,
  };
  return weapons.sort((left, right) => {
    const rarityDifference =
      (rarityOrder[right.rarity ?? ""] ?? 0) -
      (rarityOrder[left.rarity ?? ""] ?? 0);
    if (rarityDifference !== 0) return rarityDifference;
    const leftUseType = left.use_type === "主武器" ? 0 : 1;
    const rightUseType = right.use_type === "主武器" ? 0 : 1;
    if (leftUseType !== rightUseType) return leftUseType - rightUseType;
    return left.title.localeCompare(right.title, "zh-CN");
  });
}

export function generateWeaponStats(resolvedWeapons: readonly ResolvedWeapon[]) {
  console.log("Generating weapon stats...");
  const weapons = buildWeaponStats(resolvedWeapons);
  const outputPath = path.join(process.cwd(), "public", "weapon-stats.json");
  fs.writeFileSync(outputPath, JSON.stringify(weapons, null, 2), "utf-8");
  console.log(`Generated weapon stats with ${weapons.length} items`);
  console.log(`Output: ${outputPath}`);
}

export async function generateIndexes() {
  const weapons = await getAllResolvedWeapons("lc");
  generateSearchIndex(weapons);
  generateWeaponStats(weapons);
}

const entryPath = process.argv[1];
if (
  entryPath &&
  import.meta.url === pathToFileURL(path.resolve(entryPath)).href
) {
  void generateIndexes().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
