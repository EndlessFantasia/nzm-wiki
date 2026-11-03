import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import type {
  SurvivalAtlasSlot, SurvivalBuffNode, SurvivalCodex, SurvivalCodexRules, SurvivalEffect, SurvivalEffectType,
  SurvivalMge, SurvivalPassive, SurvivalPrerequisite, SurvivalSkill, SurvivalSpecial, SurvivalTag,
} from "../../lib/survival-codex";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "refs/Exports/NZM/Content");
const TABLES = path.join(SOURCE, "DataTables/TimeTravelHunt");
const MGE_DIR = path.join(SOURCE, "Blueprints/Affixes/MGE/SurvivalMode");
const TARGET = path.join(ROOT, "data/survival/codex.json");
const ICONS = path.join(ROOT, "public/icons/survival");
const ICON_PREFIX = "/Game/UI/UI_Textures/";

interface TextValue { LocalizedString?: string; SourceString?: string }
interface RawBuff {
  ID: number;
  Type: number;
  Name: TextValue;
  OutsideName: TextValue;
  Description: TextValue;
  CurrentLevelDescription: TextValue;
  AttributeDisplays: { TagText: TextValue; Value: number }[];
  IconPath: { AssetPathName: string };
  Buffs: { Key: string; Value: { Params: string[] } }[];
  Prerequisites: { Key: string; Value: { Params: string[] } }[];
  Weight: number;
  ReduceWeight: number;
  UpgradeTree: number[];
  UltimateCombineBuff: number;
  UltimateUpgradeBuff: number;
  Tags: string[];
  TagDisplays: { TagText: TextValue; TagColor: string }[];
}
interface RawShow { Id: number; AtlasType: number; BuffId: number; PassiveBuffId: number; ProductBuffId: number; SortOrder: number }
interface RawLimits {
  MaxActiveSkillTypes: number;
  MaxPassiveBuffTypes: number;
  AllMaxLevelSpecialBuffID: number;
  DrawUltimateWeaponPercents: number[];
  TreasureBoxUltimateWeaponPercents: number[];
  UltimateWeaponPercentAdditions: number[];
  UltimateWeaponAccumulateStartCount: number;
}

export interface SurvivalSourceTables {
  buffs: Record<string, RawBuff>;
  show: Record<string, RawShow>;
  limits: Record<string, RawLimits>;
  /** MGE ID → 蓝图资产名（不含扩展名）。 */
  mgeBlueprints: Record<string, string>;
  /** NZSlateColorStyleInfoDataTable 样式名 → 十六进制颜色（不含 #）。 */
  colorStyles: Record<string, string>;
}

// STH_RoguelikeBuffTable.Type
const TYPE_SKILL = 1;
const TYPE_SKILL_UPGRADE = 2;
const TYPE_ULTIMATE = 3;
const TYPE_PASSIVE = 6;
const TYPE_PASSIVE_UPGRADE = 7;
const TYPE_TRIGGER = 8;
const TYPE_TEMP_BOOST = 9;
const ATLAS_ACTIVE = 1;
const ATLAS_OTHER = 2;
const EFFECT_PREFIX = "Class'/Script/GameModes.STHTreasureBuff_";
const PREREQUISITE_PREFIX = "ESTHBuffPrerequisitesType::";
const TAG_PREFIX = "ETacticalSkillTag::";

function text(value: TextValue | undefined, field: string): string {
  const result = value?.LocalizedString || value?.SourceString;
  if (!result?.trim()) throw new Error(`Missing ${field}`);
  return result.trim();
}

function optionalText(value: TextValue | undefined): string {
  return (value?.LocalizedString || value?.SourceString || "").trim();
}

function iconName(assetPath: string): { name: string; source: string } {
  const match = /^\/Game\/UI\/UI_Textures\/([A-Za-z0-9_/]+)\/([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)$/.exec(assetPath);
  if (!assetPath.startsWith(ICON_PREFIX) || !match || match[2] !== match[3]) throw new Error(`Invalid survival icon: ${assetPath}`);
  return { name: match[2], source: `UI/UI_Textures/${match[1]}/${match[2]}.png` };
}

function effectOf(row: RawBuff): SurvivalEffect {
  if (row.Buffs.length !== 1) throw new Error(`Expected exactly one effect: ${row.ID}`);
  const [buff] = row.Buffs;
  if (!buff.Key.startsWith(EFFECT_PREFIX)) throw new Error(`Unexpected effect class: ${row.ID} ${buff.Key}`);
  const type = buff.Key.slice(EFFECT_PREFIX.length).replace(/'$/, "") as SurvivalEffectType;
  if (!["AddMGE", "LevelUpRogueLikeBuff", "ExpRateModifier", "TempLevelBoost"].includes(type)) {
    throw new Error(`Unexpected effect type: ${row.ID} ${type}`);
  }
  return { type, params: buff.Value.Params.map(String) };
}

function prerequisitesOf(row: RawBuff): SurvivalPrerequisite[] {
  return row.Prerequisites.map((item) => {
    if (!item.Key.startsWith(PREREQUISITE_PREFIX)) throw new Error(`Unexpected prerequisite: ${row.ID} ${item.Key}`);
    const type = item.Key.slice(PREREQUISITE_PREFIX.length);
    if (type !== "HaveBuff" && type !== "HaveAnyBuff") throw new Error(`Unexpected prerequisite type: ${row.ID} ${type}`);
    const ids = item.Value.Params.flatMap((param) => param.split(",")).map((id) => Number(id.trim()));
    if (!ids.length || ids.some((id) => !Number.isInteger(id))) throw new Error(`Invalid prerequisite ids: ${row.ID}`);
    return { type, ids };
  });
}

export function projectSurvivalCodex(source: SurvivalSourceTables): SurvivalCodex {
  const { buffs, show, mgeBlueprints, colorStyles } = source;
  const tagsOf = (raw: RawBuff): SurvivalTag[] => raw.TagDisplays.map((tag) => {
    const hex = colorStyles[tag.TagColor];
    if (!hex || !/^[0-9A-F]{6}$/i.test(hex)) throw new Error(`Unknown tag color: ${raw.ID} ${tag.TagColor}`);
    return { text: text(tag.TagText, `tag of ${raw.ID}`), style: tag.TagColor, color: `#${hex.toUpperCase()}` };
  });
  const used = new Set<number>();
  const row = (id: number, type?: number | number[]): RawBuff => {
    const result = buffs[String(id)];
    if (!result || result.ID !== id) throw new Error(`Missing buff row: ${id}`);
    const allowed = type === undefined ? undefined : [type].flat();
    if (allowed && !allowed.includes(result.Type)) throw new Error(`Buff ${id} has type ${result.Type}, expected ${allowed.join("/")}`);
    return result;
  };
  const claim = (id: number) => {
    if (used.has(id)) throw new Error(`Buff row used twice: ${id}`);
    used.add(id);
  };
  const node = (raw: RawBuff): SurvivalBuffNode => {
    claim(raw.ID);
    const icon = iconName(raw.IconPath.AssetPathName);
    const attributeDisplays = raw.AttributeDisplays.map((item) => ({ label: text(item.TagText, `attribute of ${raw.ID}`), value: item.Value }));
    return {
      id: raw.ID,
      name: text(raw.Name, `name of ${raw.ID}`),
      description: text(raw.Description, `description of ${raw.ID}`),
      currentLevelDescription: optionalText(raw.CurrentLevelDescription),
      icon: `/icons/survival/${icon.name}.webp`,
      attributeDisplays,
      effect: effectOf(raw),
      prerequisites: prerequisitesOf(raw),
      weight: raw.Weight,
      reduceWeight: raw.ReduceWeight,
    };
  };
  const mge = (raw: RawBuff): SurvivalMge | null => {
    const effect = effectOf(raw);
    if (effect.type !== "AddMGE" && effect.type !== "LevelUpRogueLikeBuff") return null;
    const id = effect.params[0];
    const blueprint = mgeBlueprints[id];
    if (!blueprint) throw new Error(`Missing MGE blueprint: ${raw.ID} ${id}`);
    return { id, blueprint };
  };
  // 升级链：每一级只能以前一级为前置，避免静默吞掉分叉或断链。
  const chain = (base: RawBuff, upgradeType: number): SurvivalBuffNode[] => {
    const levels = [node(base)];
    let previous = base.ID;
    for (const id of base.UpgradeTree) {
      const upgrade = row(id, upgradeType);
      const [requirement, ...rest] = prerequisitesOf(upgrade);
      if (rest.length || requirement?.type !== "HaveBuff" || requirement.ids.length !== 1 || requirement.ids[0] !== previous) {
        throw new Error(`Upgrade chain break: ${base.ID} -> ${id}`);
      }
      levels.push(node(upgrade));
      previous = id;
    }
    return levels;
  };

  const atlas = new Map<number, { slot: SurvivalAtlasSlot; show: RawShow }>();
  for (const [key, entry] of Object.entries(show)) {
    if (String(entry.Id) !== key || atlas.has(entry.BuffId)) throw new Error(`Atlas identity collision: ${key}`);
    atlas.set(entry.BuffId, { slot: { id: entry.Id, sortOrder: entry.SortOrder }, show: entry });
  }

  const skills: SurvivalSkill[] = [];
  for (const entry of [...atlas.values()].filter((item) => item.show.AtlasType === ATLAS_ACTIVE)) {
    const base = row(entry.show.BuffId, TYPE_SKILL);
    const passive = row(entry.show.PassiveBuffId, TYPE_PASSIVE);
    const ultimate = row(entry.show.ProductBuffId, TYPE_ULTIMATE);
    if (base.UltimateCombineBuff !== passive.ID || base.UltimateUpgradeBuff !== ultimate.ID || passive.UltimateCombineBuff !== base.ID) {
      throw new Error(`Skill / passive / ultimate links disagree: ${base.ID}`);
    }
    if (base.Tags.length !== base.TagDisplays.length || base.Tags.some((tag) => !tag.startsWith(TAG_PREFIX))) {
      throw new Error(`Skill tags do not line up: ${base.ID}`);
    }
    const levels = chain(base, TYPE_SKILL_UPGRADE);
    const ultimateNode = node(ultimate);
    const [requirement, ...rest] = ultimateNode.prerequisites;
    const lastLevel = levels.at(-1)!.id;
    if (rest.length || requirement?.type !== "HaveBuff" || requirement.ids.join() !== [lastLevel, passive.ID].join()) {
      throw new Error(`Ultimate prerequisites do not match the upgrade chain: ${ultimate.ID}`);
    }
    const skillMge = mge(base);
    if (!skillMge) throw new Error(`Skill without MGE: ${base.ID}`);
    skills.push({
      id: base.ID,
      name: text(base.OutsideName, `outside name of ${base.ID}`),
      tagKeys: base.Tags.map((tag) => tag.slice(TAG_PREFIX.length)),
      tags: tagsOf(base),
      mge: skillMge,
      levels,
      ultimate: ultimateNode,
      passiveId: passive.ID,
      atlas: entry.slot,
    });
  }

  const skillByMge = new Map(skills.map((skill) => [skill.mge.id, skill.id]));
  const passives: SurvivalPassive[] = [];
  for (const raw of Object.values(buffs).filter((item) => item.Type === TYPE_PASSIVE)) {
    const combinesWithSkillId = raw.UltimateCombineBuff || null;
    if (combinesWithSkillId !== null && !skills.some((skill) => skill.id === combinesWithSkillId && skill.passiveId === raw.ID)) {
      throw new Error(`Passive combines with an unknown skill: ${raw.ID}`);
    }
    const levels = chain(raw, TYPE_PASSIVE_UPGRADE);
    passives.push({
      id: raw.ID,
      name: text(raw.OutsideName, `outside name of ${raw.ID}`),
      tags: tagsOf(raw),
      mge: mge(raw),
      levels,
      combinesWithSkillId,
      atlas: atlas.get(raw.ID)?.slot ?? null,
    });
  }

  const limits = Object.values(source.limits);
  if (limits.length !== 1) throw new Error("Expected a single limits row");
  const limit = limits[0];
  const rules: SurvivalCodexRules = {
    maxActiveSkillTypes: limit.MaxActiveSkillTypes,
    maxPassiveBuffTypes: limit.MaxPassiveBuffTypes,
    allMaxLevelSpecialBuffId: limit.AllMaxLevelSpecialBuffID,
    drawUltimateWeaponPercents: limit.DrawUltimateWeaponPercents,
    treasureBoxUltimateWeaponPercents: limit.TreasureBoxUltimateWeaponPercents,
    ultimateWeaponPercentAdditions: limit.UltimateWeaponPercentAdditions,
    ultimateWeaponAccumulateStartCount: limit.UltimateWeaponAccumulateStartCount,
  };

  const specials: SurvivalSpecial[] = [];
  const specialRows = Object.values(buffs).filter((item) =>
    item.Type === TYPE_TRIGGER || item.Type === TYPE_TEMP_BOOST || item.ID === rules.allMaxLevelSpecialBuffId);
  for (const raw of specialRows) {
    const effect = effectOf(raw);
    const isTempBoost = raw.Type === TYPE_TEMP_BOOST;
    if (isTempBoost !== (effect.type === "TempLevelBoost")) throw new Error(`Special type and effect disagree: ${raw.ID}`);
    const targetSkillIds = isTempBoost
      ? effect.params[0].split(",").map((id) => {
        const skillId = skillByMge.get(id.trim());
        if (skillId === undefined) throw new Error(`Temporary boost targets an unknown skill MGE: ${raw.ID} ${id}`);
        return skillId;
      })
      : [];
    specials.push({
      id: raw.ID,
      name: optionalText(raw.OutsideName) || text(raw.Name, `name of ${raw.ID}`),
      kind: isTempBoost ? "tempBoost" : raw.ID === rules.allMaxLevelSpecialBuffId ? "allMaxReward" : "trigger",
      tags: tagsOf(raw),
      node: node(raw),
      mge: mge(raw),
      targetSkillIds,
      atlas: atlas.get(raw.ID)?.slot ?? null,
    });
  }

  for (const [buffId, entry] of atlas) {
    const placed = skills.some((item) => item.id === buffId) || passives.some((item) => item.id === buffId) ||
      specials.some((item) => item.id === buffId);
    if (!placed) throw new Error(`Atlas entry ${entry.slot.id} was not projected: ${buffId}`);
    if (entry.show.AtlasType !== ATLAS_ACTIVE && entry.show.AtlasType !== ATLAS_OTHER) throw new Error(`Unknown atlas type: ${entry.slot.id}`);
  }
  const unclaimed = Object.keys(buffs).filter((id) => !used.has(Number(id)));
  if (unclaimed.length) throw new Error(`Buff rows were not projected: ${unclaimed.join(", ")}`);
  if (skills.length !== 8 || passives.length !== 12 || specials.length !== 6 || used.size !== 114 || atlas.size !== 17) {
    throw new Error(`Unexpected catalog size: ${skills.length} skills, ${passives.length} passives, ${specials.length} specials, ${used.size} buffs, ${atlas.size} atlas`);
  }

  const bySort = <T extends { atlas: SurvivalAtlasSlot | null; id: number }>(a: T, b: T) =>
    (a.atlas?.sortOrder ?? Infinity) - (b.atlas?.sortOrder ?? Infinity) || a.id - b.id;
  return {
    schemaVersion: 1,
    numericalStatus: "display-only",
    skills: skills.sort(bySort),
    passives: passives.sort(bySort),
    specials: specials.sort(bySort),
    rules,
  };
}

function readRows<T>(name: string): Record<string, T> {
  const table = JSON.parse(fs.readFileSync(path.join(TABLES, `${name}.json`), "utf8")) as { Rows: Record<string, T> }[];
  if (table.length !== 1 || !table[0]?.Rows) throw new Error(`Invalid table: ${name}`);
  return table[0].Rows;
}

function readColorStyles(): Record<string, string> {
  const file = path.join(SOURCE, "DataTables/UMGStyle/NZSlateColorStyleInfoDataTable.json");
  const table = JSON.parse(fs.readFileSync(file, "utf8")) as {
    Rows: Record<string, { ColorStyle: { SpecifiedColor: { Hex: string } } }>;
  }[];
  return Object.fromEntries(Object.entries(table[0].Rows).map(([name, row]) => [name, row.ColorStyle.SpecifiedColor.Hex]));
}

function readMgeBlueprints(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const file of fs.readdirSync(MGE_DIR)) {
    const match = /^(MGE_(1511\d+)_[A-Za-z0-9]+)\.json$/.exec(file);
    if (match) result[match[2]] = match[1];
  }
  return result;
}

export function collectIconNames(catalog: SurvivalCodex): string[] {
  const nodes = [
    ...catalog.skills.flatMap((skill) => [...skill.levels, skill.ultimate]),
    ...catalog.passives.flatMap((passive) => passive.levels),
    ...catalog.specials.map((special) => special.node),
  ];
  return [...new Set(nodes.map((item) => path.basename(item.icon, ".webp")))].sort();
}

function iconSource(buffs: Record<string, RawBuff>): Map<string, string> {
  const result = new Map<string, string>();
  for (const buff of Object.values(buffs)) {
    const icon = iconName(buff.IconPath.AssetPathName);
    result.set(icon.name, path.join(SOURCE, icon.source));
  }
  return result;
}

async function main() {
  const check = process.argv.includes("--check");
  const buffs = readRows<RawBuff>("STH_RoguelikeBuffTable");
  const catalog = projectSurvivalCodex({
    buffs,
    show: readRows<RawShow>("Survival_BuffShow"),
    limits: readRows<RawLimits>("STH_RoguelikeBuffLimitTable"),
    mgeBlueprints: readMgeBlueprints(),
    colorStyles: readColorStyles(),
  });
  const output = `${JSON.stringify(catalog, null, 2)}\n`;
  if (check) {
    if (!fs.existsSync(TARGET) || fs.readFileSync(TARGET, "utf8") !== output) {
      throw new Error("Survival codex projection is stale; run pnpm survival-codex:project");
    }
  } else {
    fs.mkdirSync(path.dirname(TARGET), { recursive: true });
    fs.writeFileSync(TARGET, output);
  }
  const summary = `${catalog.skills.length} skills, ${catalog.passives.length} passives, ${catalog.specials.length} specials`;
  if (process.argv.includes("--data-only")) {
    console.log(`Survival codex: ${summary} (${check ? "checked" : "projected"}; data only)`);
    return;
  }
  const names = collectIconNames(catalog);
  const sources = iconSource(buffs);
  if (!check) fs.mkdirSync(ICONS, { recursive: true });
  for (const name of names) {
    const source = sources.get(name);
    if (!source || !fs.existsSync(source)) throw new Error(`Missing survival icon: ${name}`);
    const target = path.join(ICONS, `${name}.webp`);
    const image = await sharp(source).webp({ quality: 90 }).toBuffer();
    if (check) {
      if (!fs.existsSync(target) || !fs.readFileSync(target).equals(image)) throw new Error(`Stale survival icon: ${target}`);
    } else {
      fs.writeFileSync(target, image);
    }
  }
  if (check) {
    const stale = fs.existsSync(ICONS) ? fs.readdirSync(ICONS).filter((file) => !names.includes(path.basename(file, ".webp"))) : [];
    if (stale.length) throw new Error(`Unreferenced survival icons: ${stale.join(", ")}`);
  }
  console.log(`Survival codex: ${summary}, ${names.length} icons (${check ? "checked" : "projected"})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
