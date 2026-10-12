import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import matter from "gray-matter";
import YAML from "yaml";
import { verifyVersion } from "../content-versions/store";
import { readRelease } from "../content-versions/release";

export interface PerkPromotionOptions {
  root: string; contentRoot: string; archive: string; baseline: string; season: string;
}
export interface PerkPromotionEntry {
  source: string; target: string; text: string; id: string; unchanged: boolean; snapshotRemoved: boolean;
}
export interface PerkPromotionPlan {
  entries: PerkPromotionEntry[];
  changedBindings: { id: string; row: string; field: string }[];
  conflicts: string[];
}

export function perkFiles(root: string, directory: string): string[] {
  return [1, 2, 3, 4].flatMap(slot => {
    const relative = `${directory}/slot-${slot}`;
    const absolute = path.join(root, relative);
    return fs.existsSync(absolute) ? fs.readdirSync(absolute).filter(file => file.endsWith(".mdx"))
      .sort().map(file => `${relative}/${file}`) : [];
  });
}

/** A preview channel is never an introduction season. Compare identities before any writes. */
export function planPerkPromotion(options: PerkPromotionOptions): PerkPromotionPlan {
  const { root, contentRoot, archive, baseline, season } = options;
  const previewManifest = verifyVersion(archive);
  const baselineManifest = verifyVersion(baseline);
  assert.equal(previewManifest.identity.season, season, "Preview archive season mismatch");
  const summary = previewManifest.summary as { channel?: string } | undefined;
  assert.equal(summary?.channel, "preview", "Expected a published preview archive");
  assert.equal(readRelease(path.join(archive, "files")).preview?.season, season, "Preview archive target mismatch");
  assert.notEqual(baselineManifest.summary && (baselineManifest.summary as { channel?: string }).channel,
    "preview", "Baseline must be an official archive");
  const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
  const rows = (file: string) => {
    const tables = read(path.join(contentRoot, file)).filter((entry: { Rows?: unknown }) => entry.Rows);
    assert.equal(tables.length, 1, `Ambiguous live table ${file}`);
    return tables[0].Rows;
  };
  const mods = rows("DataTables/LuaDataTable/WeaponModItemData.json");
  const numerical = rows("Attributes/AutoGenerate/numerical_modifier_config.json");
  const locked = read(path.join(root, "data/num-modifier-lock.json")).rows.lc;
  const previewNumerical = read(path.join(archive, "files/evidence/data/perk-preview-modifiers.json"));
  assert.equal(previewNumerical.season, season, "Archived Numerical season mismatch");
  const previous = new Map(perkFiles(path.join(baseline, "files"), "data/perks").map(file => {
    const data = matter.read(path.join(baseline, "files", file)).data;
    return [String(data.id), data] as const;
  }));
  const existing = new Map<string, string>();
  for (const file of perkFiles(root, "data/perks")) {
    const id = String(matter.read(path.join(root, file)).data.id);
    assert.ok(!existing.has(id), `Duplicate current ItemID ${id}`);
    existing.set(id, file);
  }
  const result: PerkPromotionPlan = { entries: [], changedBindings: [], conflicts: [] };
  const ids = new Set<string>();
  const fields = ["ID", "Level", "AttributeName", "GPModifierOp", "BaseValue", "CoefValue"];
  for (const source of perkFiles(root, "data/perk-preview")) {
    const entry = matter.read(path.join(root, source));
    if (entry.data.season !== `${season}-preview`) continue;
    const data = structuredClone(entry.data);
    const id = String(data.id);
    assert.ok(!ids.has(id), `Duplicate preview ItemID ${id}`);
    ids.add(id);
    const slot = Number(source.split("/")[2].slice(5));
    assert.ok(mods[id], `Missing live ItemID ${id}`);
    assert.ok(mods[id].MODSlotIndex.Values.includes(slot), `Slot drift ${id}`);
    for (const expression of Object.values(data.num_modifier_values ?? {}) as { row: string }[]) {
      assert.match(expression.row, /^lc:/, `Invalid Numerical reference ${id}`);
      const key = expression.row.slice(3);
      assert.ok(numerical[key] && locked[key] && previewNumerical.rows[key], `Missing Numerical evidence ${id}/${key}`);
      for (const field of fields) {
        assert.deepEqual(numerical[key][field], locked[key].raw[field], `Stale live Lock ${id}/${key}/${field}`);
        if (!isDeepStrictEqual(numerical[key][field], previewNumerical.rows[key][field])) result.changedBindings.push({ id, row: key, field });
      }
    }
    const before = previous.get(id);
    if (before?.season) data.season = before.season;
    else if (before) delete data.season;
    else data.season = season;
    delete data.preview_change;
    delete data.draft;
    const snapshotRemoved = data.independent_damage_snapshot !== undefined;
    delete data.independent_damage_snapshot;
    for (const field of ["CollectMODItem", "MakeMODItem", "IsCooked"]) data[field] = mods[id][field];
    for (const reference of data.skill_variants ?? []) {
      assert.ok(reference.variant.startsWith(`${season}-preview:`), `Cross-channel variant ${id}`);
      reference.variant = `current:${reference.variant.slice(`${season}-preview:`.length)}`;
    }
    const target = existing.get(id) ?? source.replace("data/perk-preview/", "data/perks/");
    assert.equal(Number(target.split("/")[2].slice(5)), slot, `Current slot conflict ${id}`);
    let unchanged = false;
    if (fs.existsSync(path.join(root, target))) {
      const current = matter.read(path.join(root, target));
      unchanged = isDeepStrictEqual(current.data, data) && current.content === entry.content;
      if (!unchanged) result.conflicts.push(`ItemID ${id}: ${source} conflicts with ${target}`);
    }
    result.entries.push({ source, target, id, unchanged, snapshotRemoved,
      text: `---\n${YAML.stringify(data, { version: "1.1", lineWidth: 0 })}---\n${entry.content}` });
  }
  assert.ok(result.entries.length, `No ${season}-preview perk sources to promote`);
  return result;
}

/** Standalone compatibility entrypoint; the unified release command adds transactional recovery. */
export function applyPerkPromotion(root: string, plan: PerkPromotionPlan): void {
  assert.equal(plan.conflicts.length, 0, plan.conflicts.join("\n"));
  for (const entry of plan.entries.filter(entry => !entry.unchanged)) {
    fs.mkdirSync(path.dirname(path.join(root, entry.target)), { recursive: true });
    fs.writeFileSync(path.join(root, entry.target), entry.text, { flag: "wx" });
  }
  for (const entry of plan.entries) fs.unlinkSync(path.join(root, entry.source));
  fs.writeFileSync(path.join(root, "data/perk-preview/preview.json"), "null\n");
}
