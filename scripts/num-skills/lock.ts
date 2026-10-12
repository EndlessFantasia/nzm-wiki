import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { numSkillDefinitionsSchema, numSkillLockSchema, skillVariantCatalogSchema, type NumSkillDefinition, type NumSkillLock } from "../../lib/num-skill";

const file = "data/num-skill-lock.json";
/** Read selected rows in place; never refresh another channel implicitly. */
export function prepareSkillRows(contentRoot: string, channel: string, input: NumSkillLock, definitions: readonly NumSkillDefinition[]): NumSkillLock {
  const references = new Set<string>();
  const gpChargeReferences = new Set<string>();
  for (const skill of definitions) for (const expression of Object.values(skill.parameters ?? {})) {
    if ("row" in expression && expression.row.split(":")[0] === channel) {
      references.add(expression.row);
      if (expression.row.includes(":gp:") && ["CooldownDuration", "MaxChargeStackCount"].includes(expression.field)) gpChargeReferences.add(expression.row);
    }
  }
  const lock = numSkillLockSchema.parse(structuredClone(input));
  const tables = new Map<string, { rows: Record<string, NumSkillLock["rows"][string]["raw"]>; source: { path: string; sha256: string } }>();
  for (const key of [...references].sort()) {
    const [, kind, rowName] = key.split(":");
    const sourcePath = kind === "gp" ? "DataTables/GPActiveSkillDataTable.json" : "DataTables/SkillConfigTable_Weapon_PVE.json";
    if (!tables.has(kind)) {
      const bytes = fs.readFileSync(path.join(contentRoot, sourcePath));
      const exports: unknown = JSON.parse(bytes.toString("utf8"));
      if (!Array.isArray(exports)) throw new Error(`Invalid table ${sourcePath}`);
      const table = exports.filter(entry => entry?.Rows);
      if (table.length !== 1) throw new Error(`Ambiguous table ${sourcePath}`);
      tables.set(kind, { rows: table[0].Rows, source: { path: sourcePath, sha256: createHash("sha256").update(bytes).digest("hex") } });
    }
    const table = tables.get(kind)!;
    if (!table.rows[rowName]) throw new Error(`Missing ${sourcePath}#${rowName}`);
    lock.rows[key] = { row_name: rowName, raw: table.rows[rowName], source: table.source };
    if (gpChargeReferences.has(key)) {
      const pvePath = "DataTables/SkillConfigTable_Weapon_PVE.json";
      const pveBytes = fs.readFileSync(path.join(contentRoot, pvePath));
      const pveTables = JSON.parse(pveBytes.toString("utf8")).filter((entry: { Rows?: unknown }) => entry?.Rows);
      if (pveTables.length !== 1) throw new Error(`Ambiguous PVE table for ${key}`);
      const pveRow = `${rowName}_1`;
      if (pveTables[0].Rows[pveRow]) throw new Error(`${key}: PVE ${pveRow} exists; use its charge reference`);
      lock.rows[key].pve_absence = { row_name: pveRow, source_path: pvePath, sha256: createHash("sha256").update(pveBytes).digest("hex") };
    }
  }
  for (const key of Object.keys(lock.rows)) if (key.startsWith(`${channel}:`) && !references.has(key)) delete lock.rows[key];
  lock.rows = Object.fromEntries(Object.entries(lock.rows).sort(([a], [b]) => a.localeCompare(b, "en")));
  return numSkillLockSchema.parse(lock);
}

export function refreshSkillRows(contentRoot: string, channel: string) {
  const definitions = fs.readdirSync("data/weapons").filter(name => name.endsWith(".mdx")).flatMap(name => {
    const source = matter(fs.readFileSync(path.join("data/weapons", name), "utf8"));
    return numSkillDefinitionsSchema.parse(source.data.skills ?? []);
  });
  const variants = skillVariantCatalogSchema.parse(JSON.parse(fs.readFileSync("data/num-skill-variants.json", "utf8")));
  definitions.push(...variants.variants.map(entry => entry.skill));
  const lock = prepareSkillRows(contentRoot, channel, JSON.parse(fs.readFileSync(file, "utf8")), definitions);
  fs.writeFileSync(file, JSON.stringify(lock, null, 2) + "\n");
  console.log(`Locked ${Object.keys(lock.rows).filter(key => key.startsWith(`${channel}:`)).length} selected skill rows for ${channel}; other namespaces preserved.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const channel = args[args.indexOf("--channel") + 1];
  const contentRoot = args[args.indexOf("--content-root") + 1];
  if (!args.includes("--channel") || !args.includes("--content-root") || !channel || !contentRoot) throw new Error("Usage: tsx scripts/num-skills/lock.ts --channel <weapons|current|season-preview> --content-root <Content>");
  refreshSkillRows(contentRoot, channel);
}
