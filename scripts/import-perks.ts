/**
 * 从 refs 审计并导入武器插件。
 *
 * 默认只输出差异，不修改文件：
 *   pnpm exec tsx scripts/import-perks.ts
 *   pnpm exec tsx scripts/import-perks.ts 肾上腺素
 *   pnpm exec tsx scripts/import-perks.ts --ids 20703040432 --json
 *   pnpm exec tsx scripts/import-perks.ts --all --sync-status --write
 *   pnpm exec tsx scripts/import-perks.ts --all --sync-status --release-date 2026-07-24 --write
 *   pnpm exec tsx scripts/import-perks.ts --all --sync-ids --write
 *   pnpm exec tsx scripts/import-perks.ts --all --sync-descriptions --write
 *
 * 显式写入时会：
 * - 为缺失插件创建 draft MDX
 * - 补齐已有 MDX 中为空的 id、icon、weaponType、weaponNames
 * - 使用 --sync-status 同步所有现有插件的来源状态字段（跳过 availability_override）
 * - 使用 --release-date 为新建的已上线插件或状态同步中的上线转换记录日期
 * - 使用 --sync-ids 仅同步所有现有插件的缺失 ID
 * - 使用 --sync-descriptions 保守修复为空或含占位符的 description
 * - 使用 --sync-icons 按同一 ItemID 的 CommonItem 图标纠正已有页面和本地图标资产
 * - 使用 --sync-applicability 同步武器类型与具体专属武器
 * - 复制缺失的插件图标
 *
 * 具体描述漂移只审计；description_override: true 的描述永远不会被覆盖。
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import matter from "gray-matter";
import { isValidDateKey } from "../lib/date-key";
import { getActivePreview, getPreviewSeasonKey, isPreviewSeason } from "../lib/content-preview";
import { NUM_MODIFIER_RESOLVER } from "../lib/num-modifier-data";
import { createMgeDescriptionLookup } from "./perks/description-source";

const ROOT_DIR = process.cwd();
let REFS_DIR = path.join(ROOT_DIR, "refs/Exports/NZM/Content");
let PERKS_DIR = path.join(ROOT_DIR, "data/perks");
const ICONS_DIR = path.join(ROOT_DIR, "public/icons/perks");
const BULK_IMPORT_REPORT = path.join(
  ROOT_DIR,
  "MD/NEW-PERKS-IMPORT-2026-07-14.md",
);

const REF_FILES = {
  mods: "DataTables/LuaDataTable/WeaponModItemData.json",
  items: "DataTables/System/Items/CommonItemDataTable.json",
  descriptions: "DataTables/MGE/DT_GPMGESkillDesConfigTable_Main.json",
  overrides:
    "DataTables/HuntingGroundRoguelike/HuntingGroundRoguelikeWeaponModTable.json",
  attributeDescriptions: "DataTables/AttributeChannelDescriptionTable.json",
  tags: "DataTables/LuaDataTable/WeaponModItemTagData.json",
  sets: "DataTables/LuaDataTable/WeaponModSetTable.json",
} as const;

const NUMERICAL_FILES = [
  "DataTables/numerical_config_composite.json",
  "DataTables/numerical_config_equip.json",
  "DataTables/numerical_config_playerskill.json",
];

interface KnownDescriptionConflict {
  reason: string;
  sources: string[];
}

const KNOWN_DESCRIPTION_CONFLICTS: Record<string, KnownDescriptionConflict> = {
  "20703040035": {
    reason: "MGE 文案只写造成伤害，没有可展示的伤害数值",
    sources: ["DataTables/MGE/DT_GPMGESkillDesConfigTable_Main.json"],
  },
  "20703040109": {
    reason: "MGE 文案的持续时间仍为未定值“一定时间”",
    sources: ["DataTables/MGE/DT_GPMGESkillDesConfigTable_Main.json"],
  },
  "20703040110": {
    reason: "MGE 文案写持续8秒，但 Buff 为6秒，且作用范围数据存在漂移",
    sources: [
      "DataTables/MGE/DT_GPMGESkillDesConfigTable_Main.json",
      "DataTables/Buff/BuffConfigDatatableNew.json",
    ],
  },
  "20703040151": {
    reason: "MGE 文案的切出该武器与实际切换到/切换离开语义存在冲突",
    sources: ["DataTables/MGE/DT_GPMGESkillDesConfigTable_Main.json"],
  },
  "20703040160": {
    reason: "MGE 文案的伤害数值10缺少单位",
    sources: ["DataTables/MGE/DT_GPMGESkillDesConfigTable_Main.json"],
  },
  "20703040164": {
    reason: "MGE 文案的伤害数值34缺少单位",
    sources: ["DataTables/MGE/DT_GPMGESkillDesConfigTable_Main.json"],
  },
  "20703040212": {
    reason: "MGE 文案写持续20秒，但运行时 Buff Weapon_20106000017_1 的 Duration 为5秒",
    sources: [
      "DataTables/MGE/DT_GPMGESkillDesConfigTable_Main.json#1312053001_1",
      "DataTables/Buff/BuffConfigDatatableNew.json#Weapon_20106000017_1",
    ],
  },
};

const DESCRIPTION_ID_ALIASES: Record<string, string> = {
  "1316133001": "1312033001",
};

const SUPPORTED_ATTR_DESCRIPTIONS: Record<
  string,
  { expectedName: string; displayName: string }
> = {
  "104507": { expectedName: "换弹速度", displayName: "换弹速度" },
  "104509": { expectedName: "弹夹容量", displayName: "弹匣容量" },
};

interface LocalizedText {
  LocalizedString?: string;
  SourceString?: string;
}

interface ValueList {
  Values?: number[];
}

interface AssetRef {
  AssetPathName?: string;
}

interface ModRow {
  MODItemID?: number;
  MODName?: LocalizedText;
  MODSlotIndex?: ValueList;
  PassiveSkill_ID?: string;
  AttrList?: string;
  SuitableWeaponType?: ValueList;
  SuitableWeaponTypeList?: ValueList;
  SuittableWeaponItem?: ValueList;
  TagList?: ValueList;
  ModSets?: string;
  CollectMODItem?: number;
  MakeMODItem?: number;
  IsCooked?: boolean;
}

interface ItemRow {
  ItemID?: number;
  Name?: LocalizedText;
  Quality?: number;
  IconPath?: {
    NormalIcon?: AssetRef;
  };
}

interface DescriptionRow {
  MGEId?: number;
  TextID?: number;
  MGEDescription?: LocalizedText;
}

interface OverrideRow {
  OverrideDesc?: LocalizedText;
  IsShow?: boolean;
}

interface AttributeDescriptionRow {
  Attr_Id?: number;
  Attr_Name?: LocalizedText;
  Description?: LocalizedText;
}

interface TagRow {
  TagID?: number;
  TagName?: LocalizedText;
}

interface SetRow {
  SetId?: number;
  SetName?: LocalizedText;
}

interface ExistingPerk {
  filePath: string;
  content: string;
  data: Record<string, unknown>;
  id: string;
  name: string;
}

interface PerkRecord {
  id: string;
  name: string;
  internalName: string;
  slot: number;
  rarity: number;
  icon: string;
  iconAssetPath: string;
  iconSourcePath: string;
  weaponType: number[];
  weaponItems: number[];
  weaponNames: string[];
  unresolvedWeaponItems: number[];
  tags: string[];
  sets: string[];
  passiveSkillId: string;
  mgeDescriptionKey: string;
  mgeDescription: string;
  mgeUnresolvedTokens: string[];
  overrideDescription: string;
  overrideUnresolvedTokens: string[];
  attrList: string;
  attrDescription: string;
  attrWarnings: string[];
  description: string;
  unresolvedTokens: string[];
  collectable: boolean;
  craftable: boolean;
  isCooked: boolean;
}

interface Options {
  write: boolean;
  includeHidden: boolean;
  json: boolean;
  season: string;
  releaseDate: string;
  ids: Set<string>;
  names: Set<string>;
  limit: number;
  syncStatus: boolean;
  syncIds: boolean;
  syncDescriptions: boolean;
  syncIcons: boolean;
  syncApplicability: boolean;
  allWithIcons: boolean;
  help: boolean;
}

interface BulkImportPlan {
  record: PerkRecord;
  filePath: string;
  fileName: string;
  icon: string;
  iconDestination: string;
  copyIcon: boolean;
}

type DescriptionCategory =
  | "identity-conflict"
  | "manual-override"
  | "missing-source"
  | "unresolved"
  | "source-conflict"
  | "empty"
  | "placeholder"
  | "match"
  | "drift";

interface DescriptionAudit {
  id: string;
  name: string;
  filePath: string;
  local: string;
  mgeKey: string;
  mge: string;
  override: string;
  attr: string;
  attrList: string;
  attrWarnings: string[];
  candidate: string;
  candidateSource: "override" | "mge" | "attr-list" | "none";
  category: DescriptionCategory;
  unresolvedTokens: string[];
  mgeUnresolvedTokens: string[];
  overrideUnresolvedTokens: string[];
  sourceConflict: boolean;
  knownConflict: KnownDescriptionConflict | null;
  runtimeConflict: KnownDescriptionConflict | null;
  sourceNumbers: {
    mge: string[];
    override: string[];
  };
  descriptionOverride: boolean;
  syncEligible: boolean;
  syncBlockedReason: string;
}

interface FieldPatch {
  key: string;
  value: unknown;
}

function refPath(relativePath: string): string {
  return path.join(REFS_DIR, ...relativePath.split("/"));
}

function loadRows<T>(relativePath: string): Record<string, T> {
  const filePath = refPath(relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`缺少 refs 文件: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Array<{
    Rows?: Record<string, T>;
  }>;
  return data[0]?.Rows ?? {};
}

function textValue(value?: LocalizedText): string {
  return (value?.LocalizedString ?? value?.SourceString ?? "").trim();
}

function mgeDescriptionKey(passiveSkillId: string): string {
  if (!passiveSkillId) return "";
  const [rawId, rawTextId] = passiveSkillId.split(":");
  if (!rawId) return "";
  const descriptionId = DESCRIPTION_ID_ALIASES[rawId] ?? rawId;
  return `${descriptionId}_${rawTextId || "1"}`;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    write: false,
    includeHidden: false,
    json: false,
    season: "pending",
    releaseDate: "",
    ids: new Set(),
    names: new Set(),
    limit: 30,
    syncStatus: false,
    syncIds: false,
    syncDescriptions: false,
    syncIcons: false,
    syncApplicability: false,
    allWithIcons: false,
    help: false,
  };

  const addList = (target: Set<string>, raw: string) => {
    for (const value of raw.split(/[，,]/).map((item) => item.trim())) {
      if (value) target.add(value);
    }
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--write") {
      options.write = true;
    } else if (arg === "--include-hidden" || arg === "--all") {
      options.includeHidden = true;
    } else if (arg === "--all-with-icons") {
      options.allWithIcons = true;
      options.includeHidden = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--sync-status") {
      options.syncStatus = true;
    } else if (arg === "--sync-ids") {
      options.syncIds = true;
    } else if (arg === "--sync-descriptions") {
      options.syncDescriptions = true;
    } else if (arg === "--sync-icons") {
      options.syncIcons = true;
    } else if (arg === "--sync-applicability") {
      options.syncApplicability = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--ids" || arg === "--id") {
      addList(options.ids, argv[++index] ?? "");
    } else if (arg.startsWith("--ids=") || arg.startsWith("--id=")) {
      addList(options.ids, arg.slice(arg.indexOf("=") + 1));
    } else if (arg === "--content-root") {
      const contentRoot = argv[++index];
      if (!contentRoot || contentRoot.startsWith("--")) {
        throw new Error("--content-root 必须提供 Content 目录");
      }
      REFS_DIR = path.resolve(ROOT_DIR, contentRoot);
    } else if (arg === "--season") {
      options.season = argv[++index] ?? options.season;
    } else if (arg.startsWith("--season=")) {
      options.season = arg.slice("--season=".length) || options.season;
    } else if (arg === "--release-date") {
      options.releaseDate = argv[++index] ?? "";
    } else if (arg.startsWith("--release-date=")) {
      options.releaseDate = arg.slice("--release-date=".length);
    } else if (arg === "--limit") {
      options.limit = Number(argv[++index] ?? options.limit);
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.slice("--limit=".length));
    } else if (arg.startsWith("-")) {
      throw new Error(`未知参数: ${arg}`);
    } else {
      addList(options.names, arg);
    }
  }

  if (!Number.isFinite(options.limit) || options.limit < 0) {
    throw new Error("--limit 必须是大于或等于 0 的数字");
  }

  if (options.releaseDate && !isValidDateKey(options.releaseDate)) {
    throw new Error("--release-date 必须是有效的 YYYY-MM-DD 日期");
  }

  if (
    options.allWithIcons &&
    (options.ids.size > 0 ||
      options.names.size > 0 ||
      options.syncStatus ||
      options.syncIds ||
      options.syncDescriptions ||
      options.syncIcons ||
      options.syncApplicability ||
      options.releaseDate)
  ) {
    throw new Error("--all-with-icons 不能与选择器或 --sync-* 参数同时使用");
  }

  return options;
}

function printHelp() {
  console.log(`插件 refs 导入器

用法:
  pnpm exec tsx scripts/import-perks.ts
  pnpm exec tsx scripts/import-perks.ts 插件名 [插件名...]
  pnpm exec tsx scripts/import-perks.ts --ids 20703040432 --write --season s2

参数:
  --write            创建缺失草稿，并补齐已有页面为空的 id、icon、weaponType、weaponNames
  --include-hidden   包含 refs 中未标记为可收集的测试、旧版或隐藏插件
  --all-with-icons   按 ItemID 导入所有本地缺失且 refs PNG 图标源存在的插件
  --ids <id,...>     按插件 ID 筛选
  --season <value>   新草稿的 season，默认 pending
  --content-root <path>  原地读取指定 Content 目录，默认 refs/Exports/NZM/Content
  --release-date <YYYY-MM-DD> 新建已上线插件或同步上线转换时写入最近上线日期
  --sync-status      同步已有 MDX 的 CollectMODItem、MakeMODItem、IsCooked（跳过 availability_override）
  --sync-ids         同步已有 MDX 的缺失 id，不修改其它字段
  --sync-descriptions 保守修复为空、含独立大写 X 或连续问号的 description（跳过 description_override）
  --sync-icons       按同一 ItemID 的 CommonItem IconPath 同步 icon，并校正 PNG 资产
  --sync-applicability 同步 SuitableWeaponType 与 SuittableWeaponItem 对应的 weaponNames
  --json             输出完整 JSON 报告
  --limit <number>   文本报告每组最多显示多少项，默认 30
`);
}

function loadNumericalRows(): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  for (const relativePath of NUMERICAL_FILES) {
    const filePath = refPath(relativePath);
    if (!fs.existsSync(filePath)) continue;
    const rows = loadRows<Record<string, unknown>>(relativePath);
    for (const [key, row] of Object.entries(rows)) {
      if (!result.has(key)) result.set(key, row);
    }
  }
  return result;
}

function getCaseInsensitive(row: Record<string, unknown>, key: string): unknown {
  const actualKey = Object.keys(row).find(
    (candidate) => candidate.toLowerCase() === key.toLowerCase(),
  );
  return actualKey ? row[actualKey] : undefined;
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 10000) / 10000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function resolveSupportedAttrDescription(
  rawAttrList: string,
  descriptions: Record<string, AttributeDescriptionRow>,
): { description: string; warnings: string[] } {
  if (!rawAttrList.trim()) return { description: "", warnings: [] };

  const warnings: string[] = [];
  const parts: string[] = [];
  for (const entry of rawAttrList.split(";").filter(Boolean)) {
    const match = entry.trim().match(/^(\d+):(-?\d+(?:\.\d+)?)$/);
    if (!match) {
      warnings.push(`无法解析 AttrList 项: ${entry}`);
      continue;
    }

    const [, attrId, rawValue] = match;
    const supported = SUPPORTED_ATTR_DESCRIPTIONS[attrId];
    if (!supported) {
      warnings.push(`未支持属性 ID: ${attrId}`);
      continue;
    }

    const row = descriptions[attrId];
    const attrName = textValue(row?.Attr_Name);
    const template = textValue(row?.Description);
    if (
      row?.Attr_Id !== Number(attrId) ||
      attrName !== supported.expectedName ||
      !template.includes("{1%.0f}")
    ) {
      warnings.push(`属性表定义与已确认规则不一致: ${attrId}`);
      continue;
    }

    const value = Number(rawValue);
    const direction = value >= 0 ? "提升" : "降低";
    parts.push(
      `${supported.displayName}${direction}${formatNumber(Math.abs(value) * 100)}%`,
    );
  }

  if (warnings.length > 0 || parts.length === 0) {
    return { description: "", warnings };
  }
  return { description: `${parts.join("，")}。`, warnings: [] };
}

function formatNumericalValue(value: number, format: string): string {
  if (format === "2") return formatNumber(value * 100);
  if (format === "13") return `${formatNumber(value * 100)}%`;
  return formatNumber(value);
}

function convertGameEmphasisTags(raw: string): string {
  let depth = 0;
  const converted = raw.replace(
    /<(?:qiangdiao|emphasize|Shock|T\d+)>|<\/>/gi,
    (tag) => {
      if (tag.startsWith("</")) {
        if (depth === 0) return "";
        depth -= 1;
        return depth === 0 ? "</strong>" : "";
      }

      depth += 1;
      return depth === 1 ? "<strong>" : "";
    },
  );

  return depth > 0 ? `${converted}</strong>` : converted;
}

function normalizeCooldownStyle(description: string): string {
  return description
    .replace(
      /[（(]\s*CD\s*(\d+(?:\.\d+)?)\s*秒?\s*[)）]/gi,
      "，冷却时间<strong>$1</strong>秒",
    )
    .replace(/\bCD\s*(\d+(?:\.\d+)?)\s*秒?/gi, "冷却时间<strong>$1</strong>秒");
}

function resolveDescription(
  raw: string,
  numericals: Map<string, Record<string, unknown>>,
): { description: string; unresolvedTokens: string[] } {
  let description = NUM_MODIFIER_RESOLVER.resolveGameModifierTokens(raw).text;

  description = description.replace(
    /\{GPNumericalID:(\d+):([^:}]+):([^:}]+)(?::[^}]+)?\}/gi,
    (token, id: string, field: string, format: string) => {
      const row = numericals.get(`${id}_1`);
      const value = row ? getCaseInsensitive(row, field) : undefined;
      return typeof value === "number" ? formatNumericalValue(value, format) : token;
    },
  );

  description = normalizeCooldownStyle(
    convertGameEmphasisTags(description.replace(/<br\s*\/?\s*>/gi, "\n")),
  )
    .replace(/<(?!\/?strong(?:\s|>))[^>]+>/gi, "")
    .replace(/\*{4,}/g, "**")
    .replace(/[\u200B\uFEFF]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const unresolvedTokens = Array.from(new Set(description.match(/\{[^}]+\}/g) ?? []));
  return { description, unresolvedTokens };
}

function hasDescriptionPlaceholder(description: string): boolean {
  return (
    /(^|[^A-Za-z0-9])X(?=$|[^A-Za-z0-9])/.test(description) ||
    /[?？]{2,}/.test(description)
  );
}

function normalizeDescription(description: string): string {
  return description
    .normalize("NFKC")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*/g, "")
    .replace(/[\s`_~，。,.、；;：:！？!?（）()\[\]【】“”"'《》<>]/g, "")
    .trim();
}

function extractDescriptionNumbers(description: string): string[] {
  const withoutTokens = description.replace(/\{[^}]+\}/g, "");
  return Array.from(withoutTokens.matchAll(/-?\d+(?:\.\d+)?%?/g), (match) => match[0]).sort(
    (left, right) => left.localeCompare(right, undefined, { numeric: true }),
  );
}

function buildDescriptionAudit(
  record: PerkRecord,
  local: ExistingPerk,
  hasIdentityConflict: boolean,
): DescriptionAudit {
  const localDescription = String(local.data.description ?? "").trim();
  const mgeComplete = Boolean(
    record.mgeDescription &&
      record.mgeUnresolvedTokens.length === 0 &&
      !hasDescriptionPlaceholder(record.mgeDescription),
  );
  const overrideComplete = Boolean(
    record.overrideDescription &&
      record.overrideUnresolvedTokens.length === 0 &&
      !hasDescriptionPlaceholder(record.overrideDescription),
  );
  const candidateSource = mgeComplete
    ? "mge"
    : overrideComplete
      ? "override"
      : record.mgeDescription
        ? "mge"
        : record.overrideDescription
          ? "override"
          : record.attrDescription
            ? "attr-list"
            : "none";
  const candidate =
    candidateSource === "override"
      ? record.overrideDescription
      : candidateSource === "mge"
        ? record.mgeDescription
        : candidateSource === "attr-list"
          ? record.attrDescription
          : "";
  const unresolvedTokens =
    candidateSource === "override"
      ? record.overrideUnresolvedTokens
      : candidateSource === "mge"
        ? record.mgeUnresolvedTokens
        : [];
  const mgeNumbers = extractDescriptionNumbers(record.mgeDescription);
  const overrideNumbers = extractDescriptionNumbers(record.overrideDescription);
  const hasBothSources = Boolean(record.mgeDescription && record.overrideDescription);
  const directSourceConflict =
    hasBothSources &&
    (record.mgeUnresolvedTokens.length > 0 ||
      record.overrideUnresolvedTokens.length > 0 ||
      JSON.stringify(mgeNumbers) !== JSON.stringify(overrideNumbers));
  const knownConflict = KNOWN_DESCRIPTION_CONFLICTS[record.id] ?? null;
  const runtimeConflict =
    knownConflict?.sources.some((source) => /Buff|Ability|Blueprint/.test(source))
      ? knownConflict
      : null;
  const sourceConflict = directSourceConflict || knownConflict !== null;
  const descriptionOverride = local.data.description_override === true;
  const localIsBlank = isBlank(local.data.description);
  const localHasPlaceholder = hasDescriptionPlaceholder(localDescription);
  const candidateHasPlaceholder = hasDescriptionPlaceholder(candidate);
  const localMatchesCandidate =
    Boolean(candidate) &&
    normalizeDescription(localDescription) === normalizeDescription(candidate);

  let category: DescriptionCategory;
  if (hasIdentityConflict) category = "identity-conflict";
  else if (descriptionOverride) category = "manual-override";
  else if (!candidate) category = "missing-source";
  else if (unresolvedTokens.length > 0 || candidateHasPlaceholder) category = "unresolved";
  else if (sourceConflict) category = "source-conflict";
  else if (localIsBlank) category = "empty";
  else if (localHasPlaceholder) category = "placeholder";
  else if (localMatchesCandidate) category = "match";
  else {
    category = "drift";
  }

  let syncBlockedReason = "";
  if (hasIdentityConflict) syncBlockedReason = "identity-conflict";
  else if (descriptionOverride) syncBlockedReason = "description-override";
  else if (!candidate) syncBlockedReason = "missing-source";
  else if (unresolvedTokens.length > 0 || candidateHasPlaceholder) {
    syncBlockedReason = "incomplete-candidate";
  } else if (sourceConflict) syncBlockedReason = "source-conflict";
  else if (localMatchesCandidate) syncBlockedReason = "already-current";
  else if (!localIsBlank && !localHasPlaceholder) {
    syncBlockedReason = "specific-drift-review";
  }

  return {
    id: record.id,
    name: record.name,
    filePath: local.filePath,
    local: localDescription,
    mgeKey: record.mgeDescriptionKey,
    mge: record.mgeDescription,
    override: record.overrideDescription,
    attr: record.attrDescription,
    attrList: record.attrList,
    attrWarnings: record.attrWarnings,
    candidate,
    candidateSource,
    category,
    unresolvedTokens,
    mgeUnresolvedTokens: record.mgeUnresolvedTokens,
    overrideUnresolvedTokens: record.overrideUnresolvedTokens,
    sourceConflict,
    knownConflict,
    runtimeConflict,
    sourceNumbers: {
      mge: mgeNumbers,
      override: overrideNumbers,
    },
    descriptionOverride,
    syncEligible: syncBlockedReason === "",
    syncBlockedReason,
  };
}

function iconInfo(assetPath: string): {
  icon: string;
  sourcePath: string;
} {
  if (!assetPath || assetPath === "None") return { icon: "", sourcePath: "" };

  const packagePath = assetPath.split(".")[0];
  const baseName = path.posix.basename(packagePath);
  const icon =
    baseName.match(/MGE_(\d+(?:_\d+)*)$/i)?.[1] ??
    baseName.match(/(\d+(?:_\d+)*)$/)?.[1] ??
    "";
  const relativePath = packagePath.startsWith("/Game/")
    ? `${packagePath.slice("/Game/".length)}.png`
    : "";

  return {
    icon,
    sourcePath: relativePath ? refPath(relativePath) : "",
  };
}

function splitNumberList(value?: ValueList): number[] {
  return Array.from(new Set(value?.Values ?? []));
}

function indexRecordsByName(
  records: PerkRecord[],
  getName: (record: PerkRecord) => string,
): Map<string, PerkRecord[]> {
  const index = new Map<string, PerkRecord[]>();
  for (const record of records) {
    const name = getName(record);
    if (!name) continue;
    const matches = index.get(name) ?? [];
    matches.push(record);
    index.set(name, matches);
  }
  return index;
}

function findRecordsByName(
  name: string,
  recordsByName: Map<string, PerkRecord[]>,
  recordsByInternalName: Map<string, PerkRecord[]>,
): PerkRecord[] {
  const officialMatches = recordsByName.get(name) ?? [];
  const matches =
    officialMatches.length > 0 ? officialMatches : recordsByInternalName.get(name) ?? [];
  const collectableMatches = matches.filter((record) => record.collectable);
  return collectableMatches.length > 0 ? collectableMatches : matches;
}

function findUniqueRecordByName(
  name: string,
  recordsByName: Map<string, PerkRecord[]>,
  recordsByInternalName: Map<string, PerkRecord[]>,
): PerkRecord | undefined {
  const matches = findRecordsByName(name, recordsByName, recordsByInternalName);
  return matches.length === 1 ? matches[0] : undefined;
}

function buildRecords(): PerkRecord[] {
  const mods = loadRows<ModRow>(REF_FILES.mods);
  const items = loadRows<ItemRow>(REF_FILES.items);
  const descriptions = loadRows<DescriptionRow>(REF_FILES.descriptions);
  const findDescription = createMgeDescriptionLookup(descriptions);
  const overrides = loadRows<OverrideRow>(REF_FILES.overrides);
  const attributeDescriptions = loadRows<AttributeDescriptionRow>(
    REF_FILES.attributeDescriptions,
  );
  const tags = loadRows<TagRow>(REF_FILES.tags);
  const sets = loadRows<SetRow>(REF_FILES.sets);
  const numericals = loadNumericalRows();

  const tagNames = new Map<number, string>();
  for (const row of Object.values(tags)) {
    if (row.TagID) tagNames.set(row.TagID, textValue(row.TagName));
  }

  const setNames = new Map<number, string>();
  for (const row of Object.values(sets)) {
    if (row.SetId) setNames.set(row.SetId, textValue(row.SetName));
  }

  const records: PerkRecord[] = [];
  for (const row of Object.values(mods)) {
    const id = String(row.MODItemID ?? "");
    const slot = row.MODSlotIndex?.Values?.[0] ?? 0;
    const item = items[id];
    const internalName = textValue(row.MODName);
    const name = textValue(item?.Name) || internalName;
    const quality = item?.Quality ?? 0;

    if (!id || !name || name === "占位符" || slot < 1 || slot > 4 || !item) continue;

    const passiveSkillId = row.PassiveSkill_ID ?? "";
    const expectedDescriptionKey = mgeDescriptionKey(passiveSkillId);
    const descriptionEntry = findDescription(expectedDescriptionKey);
    const descriptionKey = descriptionEntry?.rowKey ?? expectedDescriptionKey;
    const rawMgeDescription = textValue(descriptionEntry?.row.MGEDescription);
    const mgeResolved = resolveDescription(rawMgeDescription, numericals);
    const rawOverrideDescription = textValue(overrides[id]?.OverrideDesc);
    const overrideResolved = resolveDescription(
      rawOverrideDescription,
      numericals,
    );
    const attrList = row.AttrList ?? "";
    const attrResolved = resolveSupportedAttrDescription(
      attrList,
      attributeDescriptions,
    );
    const mgeComplete = Boolean(
      mgeResolved.description &&
        mgeResolved.unresolvedTokens.length === 0 &&
        !hasDescriptionPlaceholder(mgeResolved.description),
    );
    const overrideComplete = Boolean(
      overrideResolved.description &&
        overrideResolved.unresolvedTokens.length === 0 &&
        !hasDescriptionPlaceholder(overrideResolved.description),
    );
    const candidate = mgeComplete
      ? mgeResolved.description
      : overrideComplete
        ? overrideResolved.description
        : mgeResolved.description || overrideResolved.description || attrResolved.description;
    const candidateTokens =
      candidate === mgeResolved.description
        ? mgeResolved.unresolvedTokens
        : candidate === overrideResolved.description
          ? overrideResolved.unresolvedTokens
          : [];
    const assetPath = item.IconPath?.NormalIcon?.AssetPathName ?? "";
    const icon = iconInfo(assetPath);
    const primaryWeaponTypes = splitNumberList(row.SuitableWeaponType);
    const fallbackWeaponTypes = splitNumberList(row.SuitableWeaponTypeList);
    const weaponItems = splitNumberList(row.SuittableWeaponItem);
    const weaponNames = weaponItems
      .map((weaponItemId) => textValue(items[String(weaponItemId)]?.Name))
      .filter(Boolean);
    const unresolvedWeaponItems = weaponItems.filter(
      (weaponItemId) => !textValue(items[String(weaponItemId)]?.Name),
    );

    records.push({
      id,
      name,
      internalName,
      slot,
      rarity: Math.max(0, quality - 1),
      icon: icon.icon,
      iconAssetPath: assetPath,
      iconSourcePath: icon.sourcePath,
      weaponType: primaryWeaponTypes.length > 0 ? primaryWeaponTypes : fallbackWeaponTypes,
      weaponItems,
      weaponNames,
      unresolvedWeaponItems,
      tags: splitNumberList(row.TagList)
        .map((tagId) => tagNames.get(tagId) ?? String(tagId))
        .filter(Boolean),
      sets: (row.ModSets ?? "")
        .split(";")
        .map(Number)
        .filter(Boolean)
        .map((setId) => setNames.get(setId) ?? String(setId)),
      passiveSkillId,
      mgeDescriptionKey: descriptionKey,
      mgeDescription: mgeResolved.description,
      mgeUnresolvedTokens: mgeResolved.unresolvedTokens,
      overrideDescription: overrideResolved.description,
      overrideUnresolvedTokens: overrideResolved.unresolvedTokens,
      attrList,
      attrDescription: attrResolved.description,
      attrWarnings: attrResolved.warnings,
      description: candidate,
      unresolvedTokens: candidateTokens,
      collectable: row.CollectMODItem === 1,
      craftable: row.MakeMODItem === 1,
      isCooked: row.IsCooked === true,
    });
  }

  return records.sort((a, b) => Number(a.id) - Number(b.id));
}

function loadExistingPerks(): ExistingPerk[] {
  const result: ExistingPerk[] = [];
  for (let slot = 1; slot <= 4; slot++) {
    const slotDir = path.join(PERKS_DIR, `slot-${slot}`);
    if (!fs.existsSync(slotDir)) continue;

    for (const file of fs.readdirSync(slotDir).filter((name) => name.endsWith(".mdx"))) {
      const filePath = path.join(slotDir, file);
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = matter(content);
      result.push({
        filePath,
        content,
        data: parsed.data,
        id: String(parsed.data.id ?? ""),
        name: String(parsed.data.title ?? file.replace(/\.mdx$/, "")),
      });
    }
  }
  return result;
}

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function comparableArray(value: unknown): string {
  return JSON.stringify(Array.isArray(value) ? value.map(Number).sort((a, b) => a - b) : []);
}

function comparableStringArray(value: unknown): string {
  return JSON.stringify(
    Array.isArray(value) ? value.map(String).sort((a, b) => a.localeCompare(b, "zh-CN")) : [],
  );
}

function yamlValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  return JSON.stringify(value);
}

function patchFrontmatter(content: string, patches: FieldPatch[]): string {
  const frontmatterMatch = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!frontmatterMatch) return content;

  let frontmatter = frontmatterMatch[2];
  for (const patch of patches) {
    const fieldPattern = new RegExp(`^${patch.key}:.*$`, "m");
    const line = `${patch.key}: ${yamlValue(patch.value)}`;
    if (fieldPattern.test(frontmatter)) {
      frontmatter = frontmatter.replace(fieldPattern, line);
    } else {
      frontmatter = `${frontmatter.replace(/\s*$/, "")}\n${line}`;
    }
  }

  return `${frontmatterMatch[1]}${frontmatter}${frontmatterMatch[3]}${content.slice(frontmatterMatch[0].length)}`;
}

function safeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "-").replace(/[. ]+$/g, "");
}

function fileHash(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function buildBulkImportPlans(
  records: PerkRecord[],
  existing: ExistingPerk[],
): BulkImportPlan[] {
  const sorted = [...records].sort((left, right) => Number(left.id) - Number(right.id));
  const existingPaths = new Set(
    existing.map((perk) => path.resolve(perk.filePath).toLowerCase()),
  );
  const baseGroups = new Map<string, PerkRecord[]>();

  for (const record of sorted) {
    if (!record.icon || !record.iconSourcePath || !fs.existsSync(record.iconSourcePath)) {
      throw new Error(`批量导入候选缺少实际图标源: ${record.id} ${record.name}`);
    }
    const basePath = path.join(
      PERKS_DIR,
      `slot-${record.slot}`,
      `${safeFileName(record.name)}.mdx`,
    );
    const key = path.resolve(basePath).toLowerCase();
    const group = baseGroups.get(key) ?? [];
    group.push(record);
    baseGroups.set(key, group);
  }

  const plannedPaths = new Set<string>();
  const plannedIcons = new Map<string, { hash: string; destination: string }>();
  const plans: BulkImportPlan[] = [];

  for (const record of sorted) {
    const slotDir = path.join(PERKS_DIR, `slot-${record.slot}`);
    const safeName = safeFileName(record.name);
    const basePath = path.join(slotDir, `${safeName}.mdx`);
    const baseKey = path.resolve(basePath).toLowerCase();
    const needsIdSuffix =
      (baseGroups.get(baseKey)?.length ?? 0) > 1 || existingPaths.has(baseKey);
    const fileName = needsIdSuffix ? `${safeName}-${record.id}.mdx` : `${safeName}.mdx`;
    const filePath = path.join(slotDir, fileName);
    const fileKey = path.resolve(filePath).toLowerCase();

    if (existingPaths.has(fileKey) || plannedPaths.has(fileKey) || fs.existsSync(filePath)) {
      throw new Error(`批量导入目标冲突: ${filePath}`);
    }
    plannedPaths.add(fileKey);

    const sourceHash = fileHash(record.iconSourcePath);
    const iconCandidates = [record.icon, `${record.icon}_${record.id}`];
    let icon = "";
    let iconDestination = "";
    let copyPlannedIcon = false;

    for (const candidate of iconCandidates) {
      const destination = path.join(ICONS_DIR, `${candidate}.png`);
      const iconKey = path.resolve(destination).toLowerCase();
      const planned = plannedIcons.get(iconKey);
      if (planned) {
        if (planned.hash === sourceHash) {
          icon = candidate;
          iconDestination = planned.destination;
          break;
        }
        continue;
      }

      if (fs.existsSync(destination)) {
        if (fileHash(destination) !== sourceHash) continue;
        plannedIcons.set(iconKey, { hash: sourceHash, destination });
        icon = candidate;
        iconDestination = destination;
        break;
      }

      plannedIcons.set(iconKey, { hash: sourceHash, destination });
      icon = candidate;
      iconDestination = destination;
      copyPlannedIcon = true;
      break;
    }

    if (!icon || !iconDestination) {
      throw new Error(`无法为不同内容的图标分配稳定名称: ${record.id} ${record.name}`);
    }

    plans.push({
      record,
      filePath,
      fileName,
      icon,
      iconDestination,
      copyIcon: copyPlannedIcon,
    });
  }

  return plans;
}

function writeBulkImportReport(plans: BulkImportPlan[]): void {
  const slotCounts = new Map<number, number>();
  for (const plan of plans) {
    slotCounts.set(plan.record.slot, (slotCounts.get(plan.record.slot) ?? 0) + 1);
  }

  const lines = [
    "# 新增插件导入报告",
    "",
    `总数：${plans.length}。Slot 1：${slotCounts.get(1) ?? 0}；Slot 2：${slotCounts.get(2) ?? 0}；Slot 3：${slotCounts.get(3) ?? 0}；Slot 4：${slotCounts.get(4) ?? 0}。`,
    "",
  ];

  for (let slot = 1; slot <= 4; slot++) {
    const items = plans.filter((plan) => plan.record.slot === slot);
    lines.push(`## Slot ${slot}（${items.length}）`, "", "| Title | ItemID | 文件名 | 上线状态 |", "|---|---:|---|---|");
    for (const item of items) {
      const title = item.record.name.replace(/\|/g, "\\|");
      const status = item.record.collectable ? "已上线" : "未上线";
      lines.push(`| ${title} | ${item.record.id} | \`${item.fileName}\` | ${status} |`);
    }
    lines.push("");
  }

  fs.mkdirSync(path.dirname(BULK_IMPORT_REPORT), { recursive: true });
  fs.writeFileSync(BULK_IMPORT_REPORT, `${lines.join("\n")}\n`, "utf8");
}

function createMdx(
  record: PerkRecord,
  season: string,
  releaseDate = "",
): string {
  const lines = [
    "---",
    `title: ${yamlValue(record.name)}`,
    `id: ${yamlValue(record.id)}`,
    `slot: ${record.slot}`,
    `rarity: ${record.rarity}`,
    `icon: ${yamlValue(record.icon)}`,
    `weaponType: ${yamlValue(record.weaponType)}`,
  ];

  if (record.weaponNames.length > 0) {
    lines.push(`weaponNames: ${yamlValue(record.weaponNames)}`);
  }

  lines.push(
    `CollectMODItem: ${Number(record.collectable)}`,
    `MakeMODItem: ${Number(record.craftable)}`,
    `IsCooked: ${record.isCooked}`,
  );

  if (record.collectable && releaseDate) {
    lines.push(`release_date: ${yamlValue(releaseDate)}`);
  }

  lines.push(
    `season: ${yamlValue(season)}`,
    `description: ${yamlValue(record.description)}`,
    "draft: true",
  );

  if (record.tags.length > 0) {
    lines.push("keywords:", ...record.tags.map((tag) => `  - ${yamlValue(tag)}`));
  }

  lines.push("---", "");
  return lines.join("\n");
}

function copyIcon(
  record: PerkRecord,
  overwriteMismatch = false,
): "copied" | "updated" | "existing" | "conflict" | "missing" | "none" {
  if (!record.icon) return "none";
  if (!record.iconSourcePath || !fs.existsSync(record.iconSourcePath)) return "missing";

  fs.mkdirSync(ICONS_DIR, { recursive: true });
  const destination = path.join(ICONS_DIR, `${record.icon}.png`);
  if (fs.existsSync(destination)) {
    if (fileHash(destination) === fileHash(record.iconSourcePath)) return "existing";
    if (!overwriteMismatch) return "conflict";
    fs.copyFileSync(record.iconSourcePath, destination);
    return "updated";
  }
  fs.copyFileSync(record.iconSourcePath, destination);
  return "copied";
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (isPreviewSeason(options.season)) {
    PERKS_DIR = path.join(ROOT_DIR, "data/perk-preview");
    const preview = getActivePreview();
    if (options.write && (!preview || options.season !== getPreviewSeasonKey(preview))) {
      throw new Error("Preview imports must match config/content-version.json");
    }
    if (options.write && options.syncIcons) {
      throw new Error("Use prepare-perk-preview.ts for preview icons; shared current icons must not be overwritten");
    }
  }
  if (options.help) {
    printHelp();
    return;
  }

  const allRecords = buildRecords();
  const existing = loadExistingPerks();
  const recordsById = new Map(allRecords.map((record) => [record.id, record]));
  const recordsByName = indexRecordsByName(allRecords, (record) => record.name);
  const recordsByInternalName = indexRecordsByName(
    allRecords,
    (record) => record.internalName,
  );
  const existingById = new Map(existing.filter((perk) => perk.id).map((perk) => [perk.id, perk]));
  const existingByName = new Map(existing.map((perk) => [perk.name, perk]));
  const hasSelector = options.ids.size > 0 || options.names.size > 0;

  const unknownIds = Array.from(options.ids).filter((id) => !recordsById.has(id));
  const unknownNames = Array.from(options.names).filter(
    (name) => findRecordsByName(name, recordsByName, recordsByInternalName).length === 0,
  );
  if (unknownIds.length > 0 || unknownNames.length > 0) {
    throw new Error(
      `refs 中未找到: ${[...unknownIds, ...unknownNames].join(", ")}`,
    );
  }

  const ambiguousNames = Array.from(options.names)
    .map((name) => ({
      name,
      matches: findRecordsByName(name, recordsByName, recordsByInternalName),
    }))
    .filter(({ matches }) => matches.length > 1);
  if (ambiguousNames.length > 0) {
    throw new Error(
      `名称对应多个插件，请改用 --ids: ${ambiguousNames
        .map(({ name, matches }) => `${name} -> ${matches.map((record) => record.id).join(",")}`)
        .join("; ")}`,
    );
  }

  const selectedNameIds = new Set(
    Array.from(options.names).flatMap((name) =>
      findRecordsByName(name, recordsByName, recordsByInternalName).map((record) => record.id),
    ),
  );

  const selected = allRecords.filter((record) => {
    if (options.allWithIcons) {
      return Boolean(
        record.icon &&
          record.iconSourcePath &&
          fs.existsSync(record.iconSourcePath),
      );
    }
    if (hasSelector) return options.ids.has(record.id) || selectedNameIds.has(record.id);
    if (options.includeHidden) return true;
    return record.collectable;
  });

  const identityConflicts = options.allWithIcons
    ? []
    : existing.flatMap((local) => {
        if (!local.id) return [];
        const officialRecord = findUniqueRecordByName(
          local.name,
          recordsByName,
          recordsByInternalName,
        );
        if (!officialRecord || officialRecord.id === local.id) return [];
        return [{
          name: local.name,
          localId: local.id,
          refsId: officialRecord.id,
          filePath: local.filePath,
        }];
      });
  const identityConflictFiles = new Set(
    identityConflicts.map((conflict) => conflict.filePath),
  );

  const missing: PerkRecord[] = [];
  const matchedByName: Array<{ record: PerkRecord; existing: ExistingPerk }> = [];
  const patches: Array<{ record: PerkRecord; existing: ExistingPerk; fields: FieldPatch[] }> = [];
  const descriptionAudit: DescriptionAudit[] = [];
  const drifts: Array<{
    id: string;
    name: string;
    filePath: string;
    fields: Record<string, { local: unknown; refs: unknown }>;
  }> = [];

  for (const record of selected) {
    if (options.allWithIcons) {
      if (!existingById.has(record.id)) missing.push(record);
      continue;
    }
    let byId = existingById.get(record.id);
    if (byId && identityConflictFiles.has(byId.filePath)) {
      const preferredRecord = findUniqueRecordByName(
        byId.name,
        recordsByName,
        recordsByInternalName,
      );
      if (preferredRecord && preferredRecord.id !== record.id) byId = undefined;
    }
    const preferredNameMatches = findRecordsByName(
      record.name,
      recordsByName,
      recordsByInternalName,
    );
    const byName =
      preferredNameMatches.length === 1 && preferredNameMatches[0].id === record.id
        ? existingByName.get(record.name)
        : undefined;
    const local = byId ?? byName;
    if (!local) {
      missing.push(record);
      continue;
    }
    if (!byId && byName) matchedByName.push({ record, existing: byName });
    const hasIdentityConflict =
      identityConflictFiles.has(local.filePath) && local.id !== record.id;
    const description = buildDescriptionAudit(record, local, hasIdentityConflict);
    descriptionAudit.push(description);

    const fields: FieldPatch[] = [];
    if (
      !hasIdentityConflict &&
      !options.syncStatus &&
      !options.syncIds &&
      !options.syncDescriptions &&
      !options.syncIcons &&
      !options.syncApplicability
    ) {
      if (isBlank(local.data.id)) fields.push({ key: "id", value: record.id });
      if (isBlank(local.data.icon) && record.icon) fields.push({ key: "icon", value: record.icon });
      if (isBlank(local.data.weaponType) && record.weaponType.length > 0) {
        fields.push({ key: "weaponType", value: record.weaponType });
      }
      if (isBlank(local.data.weaponNames) && record.weaponNames.length > 0) {
        fields.push({ key: "weaponNames", value: record.weaponNames });
      }
    }
    if (
      options.syncIcons &&
      record.icon &&
      String(local.data.icon ?? "") !== record.icon
    ) {
      fields.push({ key: "icon", value: record.icon });
    }
    if (options.syncApplicability) {
      if (
        comparableArray(local.data.weaponType) !== comparableArray(record.weaponType) &&
        (!isBlank(local.data.weaponType) || record.weaponType.length > 0)
      ) {
        fields.push({ key: "weaponType", value: record.weaponType });
      }
      if (
        comparableStringArray(local.data.weaponNames) !==
          comparableStringArray(record.weaponNames) &&
        (!isBlank(local.data.weaponNames) || record.weaponNames.length > 0)
      ) {
        fields.push({ key: "weaponNames", value: record.weaponNames });
      }
    }
    if (
      options.syncDescriptions &&
      description.syncEligible &&
      description.local !== description.candidate
    ) {
      fields.push({ key: "description", value: description.candidate });
    }
    if (fields.length > 0) patches.push({ record, existing: local, fields });

    const driftFields: Record<string, { local: unknown; refs: unknown }> = {};
    if (hasIdentityConflict) {
      driftFields.id = { local: local.id, refs: record.id };
    }
    if (local.name !== record.name) {
      driftFields.title = { local: local.name, refs: record.name };
    }
    if (Number(local.data.slot) !== record.slot) {
      driftFields.slot = { local: local.data.slot, refs: record.slot };
    }
    if (Number(local.data.rarity) !== record.rarity) {
      driftFields.rarity = { local: local.data.rarity, refs: record.rarity };
    }
    if (record.icon && String(local.data.icon ?? "") !== record.icon) {
      driftFields.icon = { local: local.data.icon, refs: record.icon };
    }
    if (
      comparableArray(local.data.weaponType) !== comparableArray(record.weaponType)
    ) {
      driftFields.weaponType = { local: local.data.weaponType, refs: record.weaponType };
    }
    if (
      comparableStringArray(local.data.weaponNames) !== comparableStringArray(record.weaponNames)
    ) {
      driftFields.weaponNames = { local: local.data.weaponNames, refs: record.weaponNames };
    }
    if (Object.keys(driftFields).length > 0) {
      drifts.push({
        id: record.id,
        name: record.name,
        filePath: local.filePath,
        fields: driftFields,
      });
    }
  }

  const orphanExisting = existing.filter(
    (perk) =>
      !recordsById.has(perk.id) &&
      findRecordsByName(perk.name, recordsByName, recordsByInternalName).length === 0,
  );
  const hiddenExisting = existing.filter((perk) => {
    if (identityConflictFiles.has(perk.filePath)) return false;
    const record =
      recordsById.get(perk.id) ??
      findUniqueRecordByName(perk.name, recordsByName, recordsByInternalName);
    return record ? !record.collectable : false;
  });
  const unresolved = selected.filter((record) => record.unresolvedTokens.length > 0);
  const unresolvedWeaponMappings = selected.filter(
    (record) => record.unresolvedWeaponItems.length > 0,
  );
  const iconAssetDrifts = selected.flatMap((record) => {
    const local = existingById.get(record.id);
    if (!local || identityConflictFiles.has(local.filePath)) return [];
    if (!record.icon || !record.iconSourcePath || !fs.existsSync(record.iconSourcePath)) return [];
    const destination = path.join(ICONS_DIR, `${record.icon}.png`);
    if (!fs.existsSync(destination)) {
      return [{
        id: record.id,
        name: record.name,
        icon: record.icon,
        status: "missing" as const,
        sourcePath: record.iconSourcePath,
        destination,
      }];
    }
    if (fileHash(destination) === fileHash(record.iconSourcePath)) return [];
    return [{
      id: record.id,
      name: record.name,
      icon: record.icon,
      status: "content-mismatch" as const,
      sourcePath: record.iconSourcePath,
      destination,
    }];
  });
  const nameConflicts = selected.filter(
    (record) => record.internalName && record.internalName !== record.name,
  );
  const iconSkillMismatches = selected.filter((record) => {
    const passiveSkillAssetId = record.passiveSkillId.split(":")[0];
    return record.icon && passiveSkillAssetId && record.icon !== passiveSkillAssetId;
  });

  if (options.syncStatus) {
    for (const local of existing) {
      if (identityConflictFiles.has(local.filePath)) continue;
      const record =
        recordsById.get(local.id) ??
        findUniqueRecordByName(local.name, recordsByName, recordsByInternalName);
      if (!record) continue;

      const fields: FieldPatch[] = [];
      if (
        local.data.availability_override !== true &&
        local.data.CollectMODItem !== Number(record.collectable)
      ) {
        fields.push({ key: "CollectMODItem", value: Number(record.collectable) });
        if (
          options.releaseDate &&
          Number(local.data.CollectMODItem) !== 1 &&
          record.collectable
        ) {
          fields.push({ key: "release_date", value: options.releaseDate });
        }
      }
      if (local.data.MakeMODItem !== Number(record.craftable)) {
        fields.push({ key: "MakeMODItem", value: Number(record.craftable) });
      }
      if (local.data.IsCooked !== record.isCooked) {
        fields.push({ key: "IsCooked", value: record.isCooked });
      }
      if (fields.length === 0) continue;

      const existingPatch = patches.find(
        (patch) => patch.existing.filePath === local.filePath,
      );
      if (existingPatch) {
        existingPatch.fields.push(...fields);
      } else {
        patches.push({ record, existing: local, fields });
      }
    }
  }

  if (options.syncIds) {
    for (const local of existing) {
      if (!isBlank(local.data.id)) continue;
      const record = findUniqueRecordByName(
        local.name,
        recordsByName,
        recordsByInternalName,
      );
      if (!record) continue;

      const field = { key: "id", value: record.id };
      const existingPatch = patches.find(
        (patch) => patch.existing.filePath === local.filePath,
      );
      if (existingPatch) existingPatch.fields.push(field);
      else patches.push({ record, existing: local, fields: [field] });
    }
  }

  const patchesByFile = new Map<
    string,
    { record: PerkRecord; existing: ExistingPerk; fields: FieldPatch[] }
  >();
  for (const patch of patches) {
    const merged = patchesByFile.get(patch.existing.filePath);
    if (!merged) {
      patchesByFile.set(patch.existing.filePath, {
        ...patch,
        fields: [...patch.fields],
      });
      continue;
    }
    for (const field of patch.fields) {
      const index = merged.fields.findIndex((item) => item.key === field.key);
      if (index === -1) merged.fields.push(field);
      else merged.fields[index] = field;
    }
  }
  const effectivePatches = Array.from(patchesByFile.values());
  const bulkImportPlans = options.allWithIcons
    ? buildBulkImportPlans(missing, existing)
    : [];

  const writeResult = {
    created: [] as string[],
    patched: [] as Array<{ filePath: string; fields: string[] }>,
    copiedIcons: [] as string[],
    updatedIcons: [] as string[],
    conflictingIcons: [] as string[],
    missingIcons: [] as string[],
    reportPath: "",
  };

  if (options.write) {
    if (options.allWithIcons) {
      fs.mkdirSync(ICONS_DIR, { recursive: true });
      for (const plan of bulkImportPlans) {
        if (!plan.copyIcon) continue;
        fs.copyFileSync(plan.record.iconSourcePath, plan.iconDestination);
        writeResult.copiedIcons.push(plan.icon);
      }

      for (const plan of bulkImportPlans) {
        fs.mkdirSync(path.dirname(plan.filePath), { recursive: true });
        const record = { ...plan.record, icon: plan.icon };
        fs.writeFileSync(plan.filePath, createMdx(record, options.season), {
          encoding: "utf8",
          flag: "wx",
        });
        writeResult.created.push(plan.filePath);
      }
      if (bulkImportPlans.length > 0) writeBulkImportReport(bulkImportPlans);
      if (fs.existsSync(BULK_IMPORT_REPORT)) {
        writeResult.reportPath = BULK_IMPORT_REPORT;
      }
    } else {
      for (const item of effectivePatches) {
        const updated = patchFrontmatter(item.existing.content, item.fields);
        if (updated !== item.existing.content) {
          fs.writeFileSync(item.existing.filePath, updated, "utf8");
          writeResult.patched.push({
            filePath: item.existing.filePath,
            fields: item.fields.map((field) => field.key),
          });
        }

        if (
          !options.syncStatus &&
          !options.syncIds &&
          !options.syncDescriptions &&
          !options.syncIcons &&
          !options.syncApplicability
        ) {
          const iconStatus = copyIcon(item.record);
          if (iconStatus === "copied") writeResult.copiedIcons.push(item.record.icon);
          if (iconStatus === "conflict") writeResult.conflictingIcons.push(item.record.icon);
          if (iconStatus === "missing") writeResult.missingIcons.push(item.record.iconAssetPath);
        }
      }

      if (options.syncIcons) {
        for (const record of selected) {
          const local = existingById.get(record.id);
          if (!local || identityConflictFiles.has(local.filePath)) continue;
          const iconStatus = copyIcon(record, true);
          if (iconStatus === "copied") writeResult.copiedIcons.push(record.icon);
          if (iconStatus === "updated") writeResult.updatedIcons.push(record.icon);
          if (iconStatus === "missing") writeResult.missingIcons.push(record.iconAssetPath);
        }
      }

      for (const record of
        options.syncStatus ||
        options.syncIds ||
        options.syncDescriptions ||
        options.syncIcons ||
        options.syncApplicability
          ? []
          : missing) {
        const slotDir = path.join(PERKS_DIR, `slot-${record.slot}`);
        const preferredPath = path.join(slotDir, `${safeFileName(record.name)}.mdx`);
        const filePath = fs.existsSync(preferredPath)
          ? path.join(slotDir, `${safeFileName(record.name)}-${record.id}.mdx`)
          : preferredPath;
        fs.mkdirSync(slotDir, { recursive: true });
        if (fs.existsSync(filePath)) {
          throw new Error(`拒绝覆盖已有文件: ${filePath}`);
        }
        fs.writeFileSync(
          filePath,
          createMdx(record, options.season, options.releaseDate),
          "utf8",
        );
        writeResult.created.push(filePath);

        const iconStatus = copyIcon(record);
        if (iconStatus === "copied") writeResult.copiedIcons.push(record.icon);
        if (iconStatus === "conflict") writeResult.conflictingIcons.push(record.icon);
        if (iconStatus === "missing") writeResult.missingIcons.push(record.iconAssetPath);
      }
    }
  }

  const descriptionCategoryCounts = descriptionAudit.reduce<Record<string, number>>(
    (counts, item) => {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
      return counts;
    },
    {},
  );

  const report = {
    mode: options.write ? "write" : "audit",
    scope: options.allWithIcons
      ? "all-with-icons"
      : hasSelector
        ? "selected"
        : options.includeHidden
          ? "all"
          : "collectable",
    refs: {
      total: allRecords.length,
      selected: selected.length,
      collectable: allRecords.filter((record) => record.collectable).length,
      craftable: allRecords.filter((record) => record.craftable).length,
    },
    identityWarnings: {
      idConflicts: identityConflicts,
      nameConflicts: nameConflicts.map((record) => ({
        id: record.id,
        name: record.name,
        internalName: record.internalName,
      })),
      iconSkillMismatches: iconSkillMismatches.map((record) => ({
        id: record.id,
        name: record.name,
        icon: record.icon,
        passiveSkillId: record.passiveSkillId,
      })),
    },
    applicabilityWarnings: {
      unresolvedWeaponItems: unresolvedWeaponMappings.map((record) => ({
        id: record.id,
        name: record.name,
        weaponItems: record.weaponItems,
        unresolvedWeaponItems: record.unresolvedWeaponItems,
      })),
    },
    iconAssetDrifts,
    local: {
      total: existing.length,
      orphan: orphanExisting.map((perk) => ({
        id: perk.id,
        name: perk.name,
        filePath: perk.filePath,
      })),
      hidden: hiddenExisting.map((perk) => ({
        id: perk.id,
        name: perk.name,
        filePath: perk.filePath,
      })),
    },
    missing: missing.map((record) => ({
      id: record.id,
      name: record.name,
      slot: record.slot,
      rarity: record.rarity,
      description: record.description,
      unresolvedTokens: record.unresolvedTokens,
    })),
    bulkImport: {
      enabled: options.allWithIcons,
      candidateCount: bulkImportPlans.length,
      reportPath: options.allWithIcons ? BULK_IMPORT_REPORT : "",
      plans: bulkImportPlans.map((plan) => ({
        id: plan.record.id,
        name: plan.record.name,
        slot: plan.record.slot,
        filePath: plan.filePath,
        icon: plan.icon,
        iconSourcePath: plan.record.iconSourcePath,
        iconDestination: plan.iconDestination,
        copyIcon: plan.copyIcon,
      })),
    },
    matchedByName: matchedByName.map(({ record, existing: local }) => ({
      id: record.id,
      name: record.name,
      filePath: local.filePath,
    })),
    patchable: effectivePatches.map(({ record, existing: local, fields }) => ({
      id: record.id,
      name: record.name,
      filePath: local.filePath,
      fields: fields.map((field) => field.key),
    })),
    drifts,
    descriptionSummary: {
      total: descriptionAudit.length,
      categories: descriptionCategoryCounts,
      sourceConflicts: descriptionAudit.filter((item) => item.sourceConflict).length,
      knownConflicts: descriptionAudit.filter((item) => item.knownConflict !== null).length,
      runtimeConflicts: descriptionAudit.filter((item) => item.runtimeConflict !== null).length,
      syncEligible: descriptionAudit.filter((item) => item.syncEligible).length,
      manualOverrides: descriptionAudit.filter((item) => item.descriptionOverride).length,
    },
    descriptionAudit,
    unresolved: unresolved.map((record) => ({
      id: record.id,
      name: record.name,
      tokens: record.unresolvedTokens,
    })),
    writeResult,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const printItems = <T>(title: string, items: T[], format: (item: T) => string) => {
    console.log(`\n${title}: ${items.length}`);
    for (const item of items.slice(0, options.limit)) console.log(`  ${format(item)}`);
    if (items.length > options.limit) console.log(`  ... 其余 ${items.length - options.limit} 项`);
  };

  console.log(
    `refs 插件 ${allRecords.length}，当前范围 ${selected.length}，本地 MDX ${existing.length}`,
  );
  if (options.allWithIcons) {
    console.log(`图标全量导入候选 ${bulkImportPlans.length}，已完成全部目标预检`);
  }
  console.log(
    `缺失 ${missing.length}，可补空字段 ${effectivePatches.length}，字段漂移 ${drifts.length}，图标资产漂移 ${iconAssetDrifts.length}，未解析描述 ${unresolved.length}，未解析专属武器 ${unresolvedWeaponMappings.length}`,
  );
  console.log(
    `本地 ID 冲突 ${identityConflicts.length}，正式名/内部名冲突 ${nameConflicts.length}，图标号/技能号不一致 ${iconSkillMismatches.length}`,
  );
  console.log(
    `描述审计 ${descriptionAudit.length}，来源冲突 ${report.descriptionSummary.sourceConflicts}（已知 ${report.descriptionSummary.knownConflicts}，运行时 ${report.descriptionSummary.runtimeConflicts}），可保守同步 ${report.descriptionSummary.syncEligible}`,
  );

  printItems(
    "本地 ID 冲突",
    report.identityWarnings.idConflicts,
    (item) => `${item.name}: local=${item.localId}, refs=${item.refsId}`,
  );

  printItems(
    "正式名/内部名冲突",
    report.identityWarnings.nameConflicts,
    (item) => `${item.id} ${item.name} <- ${item.internalName}`,
  );
  printItems(
    "图标号/技能号不一致",
    report.identityWarnings.iconSkillMismatches,
    (item) => `${item.id} ${item.name}: icon=${item.icon}, passive=${item.passiveSkillId}`,
  );
  printItems(
    "图标资产漂移",
    report.iconAssetDrifts,
    (item) => `${item.id} ${item.name}: ${item.icon} ${item.status}`,
  );
  printItems(
    "未解析专属武器",
    report.applicabilityWarnings.unresolvedWeaponItems,
    (item) => `${item.id} ${item.name}: ${item.unresolvedWeaponItems.join(", ")}`,
  );

  printItems("待创建", report.missing, (item) => `${item.id} [${item.slot}] ${item.name}`);
  printItems(
    "待补字段",
    report.patchable,
    (item) => `${item.id} ${item.name}: ${item.fields.join(", ")}`,
  );
  printItems(
    "需人工判断的漂移",
    report.drifts,
    (item) => `${item.id} ${item.name}: ${Object.keys(item.fields).join(", ")}`,
  );
  printItems(
    "未解析描述",
    report.unresolved,
    (item) => `${item.id} ${item.name}: ${item.tokens.join(", ")}`,
  );
  printItems(
    "描述问题",
    report.descriptionAudit.filter((item) => item.category !== "match"),
    (item) =>
      `${item.id} ${item.name}: ${item.category}, source=${item.candidateSource}${item.syncEligible ? ", 可同步" : ""}`,
  );

  if (options.write) {
    console.log(
      `\n已创建 ${writeResult.created.length}，已补字段 ${writeResult.patched.length}，已复制图标 ${writeResult.copiedIcons.length}，已更新图标 ${writeResult.updatedIcons.length}`,
    );
    if (writeResult.conflictingIcons.length > 0) {
      console.log(`图标内容冲突 ${writeResult.conflictingIcons.length}`);
    }
    if (writeResult.missingIcons.length > 0) {
      console.log(`缺失图标 ${writeResult.missingIcons.length}`);
    }
  } else {
    console.log("\n当前为审计模式；确认范围后加 --write 才会修改文件。");
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
