import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { stringify } from "yaml";
import { parseWeaponDataLock, type WeaponDataLock } from "../../lib/weapon-data-lock";
import { resolveWeapon } from "../../lib/weapon-resolver";
import { getActiveSkillDisplay, toWeaponDetailData } from "../../lib/weapon-consumers";

type Mode = "lc" | "td";
type Props = Record<string, string | number | boolean>;
type Expression = { weapon_charge: "time" | "count" } | { row: string; field: string } | { literal: number | boolean; reason: string; evidence: string };
export interface MigratedSkill {
  id: string;
  kind: "active" | "passive";
  name: string;
  icon?: string;
  tag?: string;
  game_skill_id?: number;
  display?: boolean;
  parameters?: Record<string, Expression>;
  modifier_sources?: string[];
}
export interface Provider {
  id: string;
  source: { type: string; slug?: string; skillName?: string };
}
export interface WeaponSkillBaseline {
  slug: string;
  sha256: string;
  originalHeader?: string;
  body: string;
  frontmatter: Record<string, unknown>;
  activeSkillByMode: Partial<Record<Mode, { cooldown?: number; count?: number }>>;
  skills: Array<{ id: string; kind: "active" | "passive"; opening: string; props: Props; expectedByMode: Partial<Record<Mode, Props>> }>;
}
export interface ExpectedChange { slug: string; skillId: string; parameter: string; before: number; after: number; evidence: string }
export interface BodyChange { slug: string; before: string; after: string; reason: string }
export interface MigrationBaseline { version: 1; weapons: WeaponSkillBaseline[]; expectedChanges: ExpectedChange[]; expectedBodyChanges: BodyChange[] }
export const reviewedBodyChanges: BodyChange[] = [
  { slug: "心有凌兮", before: "持续<Yellow>40秒</Yellow>", after: '持续<Yellow><SkillValue skill="active-1" field="duration" />秒</Yellow>', reason: "正文统一引用协议，保留原持续时间" },
  { slug: "能源之影", before: "主动技能伤害为 **350**, 持续时间 **20** 秒，冷却时间 **45** 秒。期间射击 **30**次，射速约为 **90** 每分钟，折合 **1.5** 发每秒", after: '主动技能伤害为 **350**，持续时间 <SkillValue skill="active-1" field="duration" /> 秒，冷却时间 <SkillValue skill="active-1" field="cooldown" /> 秒。射速约为 **90** 每分钟，折合 **1.5** 发每秒', reason: "持续与冷却引用协议；删除基于旧持续时间且未重新验证的射击次数" },
  { slug: "能源之影", before: "使用 <Yellow>超频</Yellow> 插件，浮游模式持续时间增加 **50%** 后，总持续时间为 **30** 秒，射击次数 **46** 次", after: '使用 <Yellow>超频</Yellow> 插件，浮游模式持续时间增加 **50%** 后，总持续时间为 <SkillValue skill="active-1" field="duration" mge={1312049001} /> 秒。', reason: "持续派生值引用协议；删除基于旧持续时间且未重新验证的射击次数" },
];

export const skillOpenings = /<(ActiveSkill|PassiveSkill)\b([^>]*?)>/g;

/** Fail closed on expressions/spreads: migration must never silently drop a prop. */
function parseProps(attributes: string): Props {
  const result: Props = {};
  const remainder = attributes.replace(/([a-zA-Z_]\w*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(-?\d+(?:\.\d+)?|true|false)\s*\})/g,
    (_, key: string, double: string | undefined, single: string | undefined, scalar: string | undefined) => {
      if (!["name", "icon", "tag", "duration", "cooldown", "count"].includes(key)) throw new Error(`Unsupported skill prop ${key}`);
      if (key in result) throw new Error(`Duplicate skill prop ${key}`);
      result[key] = double ?? single ?? (scalar === "true" ? true : scalar === "false" ? false : Number(scalar));
      return "";
    });
  if (remainder.trim()) throw new Error(`Unsupported skill attributes: ${remainder}`);
  if (typeof result.name !== "string" || typeof result.icon !== "string") throw new Error("Skill name/icon missing");
  return result;
}

export function inventoryLegacyWeapon(source: string, slug: string, lock: WeaponDataLock): WeaponSkillBaseline {
  const { data, content } = matter(source);
  const activeSkillByMode: WeaponSkillBaseline["activeSkillByMode"] = {};
  for (const mode of data.game_modes as Mode[]) {
    const resolved = toWeaponDetailData(resolveWeapon(data, { slug, expectedTable: mode, lock }));
    activeSkillByMode[mode] = Object.fromEntries(Object.entries(getActiveSkillDisplay(resolved.activeSkill)).filter(([, value]) => value !== undefined));
  }
  const count = { active: 0, passive: 0 };
  const skills = [...content.matchAll(skillOpenings)].map((match) => {
    const kind = match[1] === "ActiveSkill" ? "active" : "passive";
    const props = parseProps(match[2]);
    const expectedByMode: Partial<Record<Mode, Props>> = {};
    for (const mode of data.game_modes as Mode[]) {
      const expected = { ...props };
      if (kind === "active") {
        delete expected.cooldown;
        delete expected.count;
        const charge = activeSkillByMode[mode]!;
        if (charge.cooldown !== undefined) expected.cooldown = charge.cooldown;
        if (charge.count !== undefined || props.count !== undefined) expected.count = charge.count ?? props.count;
      }
      expectedByMode[mode] = expected;
    }
    return { id: `${kind}-${++count[kind]}`, kind, opening: match[0], props, expectedByMode };
  });
  return { slug, sha256: createHash("sha256").update(source).digest("hex"), originalHeader: source.slice(0, source.length - content.length), body: content, frontmatter: data, activeSkillByMode, skills };
}

export function migrateWeaponSource(source: string, slug: string, lock: WeaponDataLock, gpRows: Record<string, Record<string, unknown>>, providers: readonly Provider[]) {
  const parsed = matter(source);
  if (Object.hasOwn(parsed.data, "skills")) return { source, changed: false };
  const baseline = inventoryLegacyWeapon(source, slug, lock);
  const skillId = typeof parsed.data.active_skill_id === "number" && parsed.data.active_skill_id > 0 ? parsed.data.active_skill_id : undefined;
  const gp = skillId ? gpRows[String(skillId)] : undefined;
  const selected = skillId ? lock.active_skills[`${skillId}_1`] : undefined;
  const pve = selected?.source === "weapon_pve" ? lock.rows["skill-pve"][selected.source_key]?.raw : undefined;
  const expectedChanges: ExpectedChange[] = [];
  const literal = (value: number | boolean, field: string, id: string): Expression => ({
    literal: value,
    reason: field === "skill_blocking" ? "技能期间暂停充能的展示设置。"
      : field.includes("duration") && value === -1 ? "技能卡不展示持续时间。"
      : field === "skill_duration" ? "属性面板持续时间的展示设置。"
      : field === "duration" ? "技能效果持续时间，依据见来源记录。"
      : "技能参数的独立展示设置。",
    evidence: `data/weapons/${slug}.mdx#${id}.${field}`,
  });
  // Even equal values do not prove that a same-named table field is consumed.
  // Audited runtime bindings are adopted separately, after execution-chain review.
  const duration = literal;
  const skills: MigratedSkill[] = baseline.skills.map((entry) => {
    const { props, kind, id } = entry;
    const parameters: Record<string, Expression> = {};
    for (const field of ["duration", "cooldown", "count"] as const) {
      const value = props[field];
      if (kind === "active" && field !== "duration") parameters[field] = { weapon_charge: field === "cooldown" ? "time" : "count" };
      else if (typeof value === "number") parameters[field] = kind === "active" ? duration(value, field, id) : literal(value, field, id);
    }
    const modifierSources = providers.filter((provider) => provider.source.type === "weapon" && provider.source.slug === slug && provider.source.skillName === props.name).map((provider) => provider.id);
    return { id, kind, name: String(props.name), icon: String(props.icon), ...(typeof props.tag === "string" ? { tag: props.tag } : {}), ...(kind === "active" && skillId ? { game_skill_id: skillId } : {}), ...(Object.keys(parameters).length ? { parameters } : {}), ...(modifierSources.length ? { modifier_sources: modifierSources } : {}) };
  });
  if (skillId && !skills.some((skill) => skill.kind === "active")) {
    const name = pve?.SkillName ?? gp?.AbilityName;
    if (typeof name !== "string" || !name) throw new Error(`${slug}: hidden active skill name missing`);
    skills.push({ id: "active-1", kind: "active", name, game_skill_id: skillId, display: false, parameters: { cooldown: { weapon_charge: "time" }, count: { weapon_charge: "count" } } });
  }
  for (const skill of skills.filter((entry) => entry.kind === "active")) {
    const parameters = skill.parameters!;
    if (typeof parsed.data.skill_duration === "number") parameters.panel_duration = duration(parsed.data.skill_duration, "skill_duration", skill.id);
    if (typeof parsed.data.skill_blocking === "boolean") parameters.blocking = gp?.bPauseChargeDuringActivation === parsed.data.skill_blocking
      ? { row: `weapons:gp:${skillId}`, field: "bPauseChargeDuringActivation" }
      : literal(parsed.data.skill_blocking, "skill_blocking", "frontmatter");
  }
  let openingIndex = 0;
  let content = parsed.content.replace(skillOpenings, (_, component: string) => `<${component} skill="${baseline.skills[openingIndex++].id}">`);
  for (const change of reviewedBodyChanges.filter((entry) => entry.slug === slug)) {
    if (content.split(change.before).length !== 2) throw new Error(`${slug}: reviewed body replacement not unique`);
    content = content.replace(change.before, change.after);
  }
  const header = source.slice(0, source.length - parsed.content.length);
  const newline = header.includes("\r\n") ? "\r\n" : "\n";
  const addition = stringify({ skills }, { lineWidth: 0 }).replace(/\n/g, newline);
  const migratedHeader = header.replace(/---(\r?\n)$/, `${addition}---$1`);
  if (header === migratedHeader) throw new Error(`${slug}: unsupported frontmatter delimiters`);
  return { source: migratedHeader + content, baseline, expectedChanges, changed: true };
}

export function runMigration(write = false) {
  const root = process.cwd();
  const lock = parseWeaponDataLock(JSON.parse(readFileSync(path.join(root, "data/weapon-data-lock.json"), "utf8")));
  const gpRows = JSON.parse(readFileSync(path.join(root, "refs/Exports/NZM/Content/DataTables/GPActiveSkillDataTable.json"), "utf8"))[0].Rows;
  const providers: Provider[] = JSON.parse(readFileSync(path.join(root, "data/modifier-providers.json"), "utf8")).providers;
  const directory = path.join(root, "data/weapons");
  const files = readdirSync(directory).filter((file) => file.endsWith(".mdx")).sort();
  const results = files.map((file) => ({ file, ...migrateWeaponSource(readFileSync(path.join(directory, file), "utf8"), file.slice(0, -4), lock, gpRows, providers) }));
  const changed = results.filter((result) => result.changed);
  if (write && changed.length) {
    const baselinePath = path.join(root, "data/weapon-skill-migration-baseline.json");
    if (existsSync(baselinePath)) throw new Error("Baseline already exists; refusing to overwrite migration evidence");
    if (changed.length !== files.length) throw new Error("Mixed migrated/legacy inventory; refusing incomplete baseline");
    const baseline: MigrationBaseline = { version: 1, weapons: changed.map((result) => result.baseline!), expectedChanges: changed.flatMap((result) => result.expectedChanges!), expectedBodyChanges: reviewedBodyChanges };
    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
    for (const result of changed) writeFileSync(path.join(directory, result.file), result.source);
  }
  console.log(JSON.stringify({ weapons: files.length, changed: changed.length, write }));
}

export function freezeBaselineHeaders() {
  const baselinePath = path.join(process.cwd(), "data/weapon-skill-migration-baseline.json");
  const baseline: MigrationBaseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  let changed = false;
  for (const weapon of baseline.weapons) {
    if (weapon.originalHeader !== undefined) continue;
    const source = readFileSync(path.join(process.cwd(), "data/weapons", `${weapon.slug}.mdx`), "utf8");
    const { content } = matter(source);
    const header = source.slice(0, source.length - content.length).replace(/^skills:[\s\S]*?(?=^---\r?$)/m, "");
    if (createHash("sha256").update(header + weapon.body).digest("hex") !== weapon.sha256) throw new Error(`${weapon.slug}: cannot recover original header; SHA mismatch`);
    weapon.originalHeader = header;
    changed = true;
  }
  if (changed) writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
  console.log(JSON.stringify({ headers: baseline.weapons.length, changed }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.includes("--freeze-headers")) freezeBaselineHeaders();
  else runMigration(process.argv.includes("--write"));
}
