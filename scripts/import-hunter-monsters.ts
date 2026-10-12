/** Import all classic hunter maps by identity; missing plans never imply a multiplier of 1. */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import sharp from "sharp";
import manifest from "../data/enemies/lc/monsters/import-sources.json";
import { BOSS_DIFFICULTIES } from "../lib/boss-health";
import { LC_MAPS } from "../lib/lc-maps";
import { MONSTER_KINDS, type HunterMonster, type MonsterAppearance } from "../lib/hunter-monster-health";
import type { BossDifficulty } from "../types";

type Text = { LocalizedString?: string; SourceString?: string };
type Mode = { map_name: Text; dungeonid_list: string };
type Entrance = { quest_id: number; attribute_type: number; dungeon_monster_level: number; dungeon_difficulty_des: Text; monster_tips_id: string };
type Quest = { DungeonID: number; MonsterPlanID: number; OrderID: number; AreaDisplayName: Text };
type Plan = { MonsterPlanID: number; UniqueMonsterID: number; Health: number };
type Identity = { Name: string; MonsterType: number; NarrativeContent: string; bShouldCook: boolean; MonsterIcon?: { AssetPathName: string } };
type Attribute = { AttributeType: number; MonsterType: number; MonsterLevel: number; MaxHealth: number };
type RecordEvidence = { map: string; difficulty: BossDifficulty; area: string; plan_id: number; plan_health: number; max_health: number; health: number };
type Scope = { map: string; difficulty: BossDifficulty; entranceId: number; entrance: Entrance; tasks: Quest[]; tipIds: number[] };
type Gap = { map: string; difficulty?: BossDifficulty; monster_id?: number; reason: string; kind?: "missing-health"; area?: string; quest_id?: number; plan_ids?: number[] };
const root = process.cwd();
const output = path.join(root, "data/enemies/lc/monsters");
const contentDir = path.join(root, "refs/Exports/NZM/Content");
const kinds = { 3: "normal", 4: "captain", 5: "elite" } as const;
function readRows<T>(file: string): Record<string, T> {
  const value = JSON.parse(fs.readFileSync(path.join(contentDir, "DataTables", `${file}.json`), "utf8"));
  const rows = (Array.isArray(value) ? value[0] : value).Rows;
  if (!rows) throw new Error(`Missing table rows: ${file}`);
  return rows;
}
const localized = (text?: Text) => text?.LocalizedString ?? text?.SourceString ?? "";

export function explicitHealth(base: number, matches: Plan[], maxHealth: number): number | undefined {
  if (!matches.length) return undefined;
  if (matches.length !== 1) throw new Error("Ambiguous monster plan rows");
  if (![base, matches[0].Health, maxHealth].every(value => Number.isFinite(value) && value > 0)) throw new Error("Invalid monster health factor");
  return Math.round(base * matches[0].Health * maxHealth);
}

/** Region names may repeat across maps. Never merge them without the map identity. */
export function appearanceKey(map: string, area: string) { return JSON.stringify([map, area]); }

export function collect() {
  const modes = Object.values(readRows<Mode>("LuaDataTable/HunterModeinfoTable"));
  const entrances = readRows<Entrance>("System/Dungeon/NewEntranceInfoTable");
  const tips = readRows<{ monster_ids: string; elite_ids: string }>("System/Dungeon/DungeonMonsterTipsTable");
  const quests = Object.values(readRows<Quest>("HunterIntraquestTable"));
  const plans = Object.values(readRows<Plan>("HunterIntraMonsterTable"));
  const unique = readRows<Identity>("MonsterUniqueIDTable");
  const base = readRows<{ Health: number }>("HunterBaseMonsterTable");
  const attrs = Object.values(readRows<Attribute>("MonsterAttrTypeConfig"));
  const scopes: Scope[] = [];
  const gaps: Gap[] = [];
  const knownMaps = new Set(LC_MAPS.map(m => m.name));
  for (const mode of modes) if (!knownMaps.has(localized(mode.map_name))) throw new Error(`Unreviewed hunter map: ${localized(mode.map_name)}`);
  for (const { name: map } of LC_MAPS) {
    const ids = [...new Set(modes.filter(m => localized(m.map_name) === map).flatMap(m => m.dungeonid_list.split(";").filter(Boolean)))];
    for (const id of ids) if (!entrances[id]) throw new Error(`Missing entrance ${id}`);
    for (const { value: difficulty, label } of BOSS_DIFFICULTIES) {
      const matches = ids.filter(id => localized(entrances[id].dungeon_difficulty_des) === label);
      if (!matches.length && difficulty === "overlimit") {
        gaps.push({ map, difficulty, reason: "地图没有该难度入口，未生成血量" });
        continue;
      }
      if (matches.length !== 1) throw new Error(`${map}/${label}: ${matches.length} entrances`);
      const entrance = entrances[matches[0]];
      const tasks = quests.filter(q => q.DungeonID === entrance.quest_id).sort((a, b) => a.OrderID - b.OrderID);
      if (!tasks.length) throw new Error(`${map}/${label}: no quest plans`);
      const tip = tips[entrance.monster_tips_id];
      if (!tip) gaps.push({ map, difficulty, reason: `缺少入口提示表 ${entrance.monster_tips_id}` });
      const tipIds = tip ? [...new Set(`${tip.monster_ids}|${tip.elite_ids}`.split("|").filter(Boolean).map(Number))] : [];
      scopes.push({ map, difficulty, entranceId: Number(matches[0]), entrance, tasks, tipIds });
    }
  }
  const planIds = new Set(scopes.flatMap(s => s.tasks.map(q => q.MonsterPlanID)));
  const candidateIds = [...new Set([...plans.filter(p => planIds.has(p.MonsterPlanID)).map(p => p.UniqueMonsterID), ...scopes.flatMap(s => s.tipIds), ...manifest.monsters.map(m => m.id)])].sort((a, b) => a - b);
  const exclusions: { monster_id: number; name: string; reason: string }[] = [];
  const published = candidateIds.filter(id => {
    const identity = unique[id];
    const manual = manifest.exclusions.find(m => m.id === id);
    const reason = manual?.reason ?? (!identity ? "身份表缺行，不能推断名称与类型" : !identity.bShouldCook ? "身份未启用烹饪，暂不发布" : !identity.Name || identity.Name === "None" ? "身份名称为空，暂不发布" : !(identity.MonsterType in kinds) ? `MonsterType=${identity.MonsterType}，不属于普通/队长/精英图鉴` : undefined);
    if (reason) { exclusions.push({ monster_id: id, name: identity?.Name ?? "", reason }); return false; }
    return true;
  });
  const entries: { file: string; data: HunterMonster; body: string }[] = [];
  const images: { source: string; target: string }[] = [];
  const evidence = {
    schema_version: 2,
    scope: "九张经典猎场地图；区域计划与入口提示清单，加已审核脚本身份。未记录不代表不出现，实际波次完整性尚未确认。",
    formula: "Math.round(base_health * plan_health * max_health)",
    sources: { identity: "MonsterUniqueIDTable", base_health: "HunterBaseMonsterTable", plan_health: "HunterIntraMonsterTable", max_health: "MonsterAttrTypeConfig", entrance: "NewEntranceInfoTable", area: "HunterIntraquestTable", map_roster: "DungeonMonsterTipsTable" },
    entrances: scopes.map(s => ({ map: s.map, difficulty: s.difficulty, id: s.entranceId, quest_id: s.entrance.quest_id, attribute_type: s.entrance.attribute_type, monster_level: s.entrance.dungeon_monster_level, tips_id: s.entrance.monster_tips_id })),
    exclusions, gaps,
    monsters: [] as { monster_id: number; title: string; monster_type: number; base_health: number | null; appearances: { map: string; area: string; source: string }[]; records: RecordEvidence[] }[],
  };
  const usedSlugs = new Set<string>();
  for (const id of published) {
    const identity = unique[id];
    const item = manifest.monsters.find(m => m.id === id);
    const kind = kinds[identity.MonsterType as keyof typeof kinds];
    const slug = item?.slug ?? `${identity.Name}-${id}`;
    if (usedSlugs.has(slug) || /[/\\]/.test(slug)) throw new Error(`Unsafe or duplicate slug: ${slug}`);
    usedSlugs.add(slug);
    const title = item?.title ?? identity.Name;
    const baseHealth = base[id]?.Health;
    const records: RecordEvidence[] = [];
    const byArea = new Map<string, MonsterAppearance>();
    const appearanceSources = new Map<string, string>();
    const addArea = (map: string, area: string, source: string) => {
      const key = appearanceKey(map, area);
      if (!byArea.has(key)) byArea.set(key, { map, area, health: {}, source_plans: {} });
      appearanceSources.set(key, source);
      return byArea.get(key)!;
    };
    for (const scope of scopes) {
      for (const q of scope.tasks) {
        const matches = plans.filter(p => p.MonsterPlanID === q.MonsterPlanID && p.UniqueMonsterID === id);
        if (!matches.length) continue;
        const area = localized(q.AreaDisplayName).trim() || `未命名区域（${q.OrderID}）`;
        const row = addArea(scope.map, area, "HunterIntraquestTable + HunterIntraMonsterTable 专属计划行");
        const multipliers = attrs.filter(a => a.AttributeType === scope.entrance.attribute_type && a.MonsterLevel === scope.entrance.dungeon_monster_level && a.MonsterType === identity.MonsterType);
        if (!Number.isFinite(baseHealth) || baseHealth <= 0 || multipliers.length !== 1) {
          gaps.push({ map: scope.map, difficulty: scope.difficulty, monster_id: id, reason: "基础血量缺失或属性倍率不唯一，保留区域记录但不计算血量" });
          continue;
        }
        const health = explicitHealth(baseHealth, matches, multipliers[0].MaxHealth)!;
        if (row.health[scope.difficulty] !== undefined) throw new Error(`Duplicate area ${id}/${scope.map}/${scope.difficulty}/${area}`);
        row.health[scope.difficulty] = health;
        row.source_plans[scope.difficulty] = q.MonsterPlanID;
        records.push({ map: scope.map, difficulty: scope.difficulty, area, plan_id: q.MonsterPlanID, plan_health: matches[0].Health, max_health: multipliers[0].MaxHealth, health });
      }
    }
    if (item && "appearances" in item) {
      for (const appearance of item.appearances ?? []) {
        if (!knownMaps.has(appearance.map) || !appearance.area || !appearance.source) throw new Error(`Invalid reviewed appearance ${id}`);
        addArea(appearance.map, appearance.area, appearance.source);
      }
    }
    for (const scope of scopes) {
      if (scope.tipIds.includes(id) && ![...byArea.values()].some(r => r.map === scope.map)) addArea(scope.map, "区域待核实", "DungeonMonsterTipsTable 入口提示，仅证明地图归属");
    }
    if (item && "unknown_area" in item && item.unknown_area && ![...byArea.values()].some(r => r.map === manifest.map)) addArea(manifest.map, item.unknown_area, item.appearance_source!);
    const appearances = [...byArea.values()].sort((a, b) => LC_MAPS.findIndex(m => m.name === a.map) - LC_MAPS.findIndex(m => m.name === b.map));
    if (!appearances.length) throw new Error(`No evidenced appearances ${id}`);
    for (const row of appearances) {
      for (const scope of scopes.filter(scope => scope.map === row.map)) {
        if (row.health[scope.difficulty] !== undefined) continue;
        const tasks = scope.tasks.filter(q => row.area === "区域待核实" || (localized(q.AreaDisplayName).trim() || `未命名区域（${q.OrderID}）`) === row.area);
        // An area absent from this difficulty is not a missing health calculation.
        if (!tasks.length) continue;
        const planIds = [...new Set(tasks.map(q => q.MonsterPlanID))];
        const hasPlan = plans.some(plan => planIds.includes(plan.MonsterPlanID) && plan.UniqueMonsterID === id);
        gaps.push({
          kind: "missing-health", map: row.map, area: row.area, difficulty: scope.difficulty,
          monster_id: id, quest_id: scope.entrance.quest_id, plan_ids: planIds,
          reason: hasPlan
            ? "已找到专属计划，但基础血量、属性倍率或区域关联未完整解析"
            : "缺少怪物专属计划行；尚未确认原生难度系统的缺行处理，不能假定计划倍率为1",
        });
      }
    }
    let image: string | undefined = `/webp/icons/enemies/npc-${id}.webp`;
    if (!fs.existsSync(path.join(root, "public", image))) {
      const assetPath = identity.MonsterIcon?.AssetPathName?.split(".")[0];
      const source = assetPath?.startsWith("/Game/") ? path.join(contentDir, `${assetPath.slice(6)}.png`) : "";
      if (source && fs.existsSync(source)) images.push({ source, target: path.join(root, "public", image) });
      else {
        gaps.push({ map: [...new Set(appearances.map(r => r.map))].join("、"), monster_id: id, reason: "缺少已导出头像，使用占位图" });
        image = undefined;
      }
    }
    const file = path.join(output, `${slug}.mdx`);
    const existing = fs.existsSync(file) ? matter(fs.readFileSync(file, "utf8")) : null;
    const narrative = identity.NarrativeContent;
    const data: HunterMonster = { ...existing?.data, slug, title, monster_id: id, kind, description: narrative && narrative !== "None" ? narrative : `猎场${MONSTER_KINDS[kind]}怪物`, appearances };
    if (image) data.image = image; else delete data.image;
    const body = existing?.content ?? "\n血量按地图、难度与区域分别列出。\n";
    entries.push({ file, data, body });
    evidence.monsters.push({ monster_id: id, title, monster_type: identity.MonsterType, base_health: baseHealth ?? null, appearances: appearances.map(r => ({ map: r.map, area: r.area, source: appearanceSources.get(appearanceKey(r.map, r.area))! })), records });
  }
  const layout = scopes.map(s => ({ map: s.map, difficulty: s.difficulty, areas: s.tasks.map(q => localized(q.AreaDisplayName).trim()), orders: s.tasks.map(q => q.OrderID) }));
  return { entries, evidence, images, layout };
}

async function main() {
  const mode = process.argv[2] ?? "--dry-run";
  if (!["--dry-run", "--check", "--audit", "--write"].includes(mode)) throw new Error("Use --dry-run, --check, --audit or --write");
  const { entries, evidence, images, layout } = collect();
  // Serialize everything before writing, so validation/serialization errors cannot leave partial MDX.
  const writes: { file: string; content: string }[] = [];
  const layoutFile = path.join(output, "map-layout.json");
  const layoutContent = `${JSON.stringify(layout, null, 2)}\n`;
  if (!fs.existsSync(layoutFile) || fs.readFileSync(layoutFile, "utf8") !== layoutContent) writes.push({ file: layoutFile, content: layoutContent });
  for (const entry of entries) {
    const previous = fs.existsSync(entry.file) ? matter(fs.readFileSync(entry.file, "utf8")).data : null;
    const data: Partial<HunterMonster> = { ...entry.data };
    delete data.slug;
    if (JSON.stringify(previous) !== JSON.stringify(data)) writes.push({ file: entry.file, content: matter.stringify(entry.body, data) });
  }
  const evidenceFile = path.join(output, "evidence.json");
  const previous = fs.existsSync(evidenceFile) ? JSON.parse(fs.readFileSync(evidenceFile, "utf8")) : null;
  if (JSON.stringify(previous) !== JSON.stringify(evidence)) writes.push({ file: evidenceFile, content: `${JSON.stringify(evidence, null, 2)}\n` });
  for (const map of LC_MAPS) console.log(`${map.name}: ${entries.filter(e => e.data.appearances.some(a => a.map === map.name)).length} monsters; ${evidence.monsters.reduce((n, m) => n + m.records.filter(r => r.map === map.name).length, 0)} health values`);
  console.log(`Exclusions: ${JSON.stringify(evidence.exclusions)}`);
  console.log(`Gaps: ${JSON.stringify(evidence.gaps.filter(gap => gap.kind !== "missing-health"))}`);
  const missingHealth = evidence.gaps.filter(gap => gap.kind === "missing-health");
  console.log(`Missing health: ${missingHealth.length}; ${entries.filter(entry => !entry.data.appearances.some(row => Object.keys(row.health).length)).length} monsters have no health values. Details: data/enemies/lc/monsters/evidence.json (after --write).`);
  console.log(`${mode}: ${entries.length} unique monsters; ${writes.length} changed files; ${images.length} new portraits; ${evidence.monsters.reduce((n, m) => n + m.records.length, 0)} health values.`);
  if (mode === "--write") {
    const converted = await Promise.all(images.map(async img => ({ file: img.target, content: await sharp(img.source).webp({ quality: 85 }).toBuffer() })));
    for (const item of [...converted, ...writes]) fs.writeFileSync(item.file, item.content);
  }
  if (mode === "--check" && (writes.length || images.length)) process.exitCode = 1;
  if (mode === "--audit" && (missingHealth.length || writes.length || images.length)) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error); process.exitCode = 1; });
