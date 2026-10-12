import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { planPromotion, applyPromotion, type PromotionOptions } from "./promotion";
import { saveVersion } from "./store";
import { sha256 } from "../overlimit/catalog";
import semantics from "../../data/num-modifier-semantics.json";

const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const row = { ID: 111010083, Level: 1, AttributeName: "GPAttributeSetToughness.ToughnessRatio", GPModifierOp: "B1", BaseValue: 0.125, CoefValue: 0, Description: "Fixture" };
function write(root: string, file: string, value: string | Buffer) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), value);
}
function catalog(version: string) {
  return { schemaVersion: 1, season: { id: version, label: version, status: "current", updatedAt: "2026-10-12" },
    provenance: { contentRoot: "fixture/Content", note: "Synthetic audit", files: [{ path: "cards.json", sha256: "a".repeat(64) }] },
    cards: [{ id: "100", name: "Card", description: "Reviewed", icon: "/icons/card.svg", quality: 4, weaponType: [], weaponItems: [], weaponNames: [], tags: [] }],
    independentDamage: {}, bonds: null, levels: null, mapRotation: null };
}
function fixture(t: { after: (callback: () => void) => void }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "content-promotion-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const release = { schemaVersion: 1, season: "s5", version: "s5", phase: "candidate", basedOn: "s4",
    preview: { season: "s5", version: "s5-preview", label: "S5 Preview" } };
  write(root, "config/content-version.json", json(release));
  write(root, "data/overlimit/current.json", json(catalog("s4")));
  write(root, "data/overlimit/preview.json", json({ ...catalog("s5-preview"), season: { ...catalog("s5-preview").season, status: "preload" } }));
  write(root, "public/icons/card.svg", "<svg />");
  const source = "---\ntitle: Fixture\nid: '200'\nseason: s5-preview\nslot: 1\nrarity: 1\npreview_change: existing\nnum_modifier_values:\n  value: { row: 'lc:111010083_1_0', field: base }\nskill_variants:\n  - { scope: all-weapons-active, variant: 's5-preview:variant', operation: replace }\n---\nBody\n";
  write(root, "data/perk-preview/slot-1/Fixture.mdx", source);
  write(root, "data/perk-preview/preview.json", json({ season: { key: "s5-preview" } }));
  const modifier = { schema_version: 2, sources: { lc: { modifiers: { source_path: "Attributes/AutoGenerate/numerical_modifier_config.json", sha256: "a".repeat(64), row_count: 1 },
    attribute_descriptions: { source_path: "DataTables/AttributeDescMapTable.json", sha256: "b".repeat(64), row_count: 0 } } },
    rows: { lc: { "111010083_1_0": { row_name: "111010083_1_0", raw: row } } }, attribute_descriptions: { lc: {} } };
  write(root, "data/num-modifier-lock.json", json(modifier));
  write(root, "data/num-modifier-semantics.json", json(semantics));
  const registry = { schemaVersion: 1, evidencePriority: ["Numerical"], providers: [{ id: "perk:s5-preview:200", label: "Fixture", source: { type: "perk", itemId: "200", slot: 1, slug: "Fixture", overlimitCard: false, season: "s5-preview" },
    applications: [{ expression: { row: "lc:111010083_1_0", field: "base" }, context: { recipient: "self" } }], evidence: { kind: "gp-modifier" } }], exclusions: [] };
  write(root, "data/modifier-providers.json", json(registry));
  const variants = { schema_version: 1, variants: [{ key: "s5-preview:variant", channel: "s5-preview", scope: "all-weapons-active", operation: "replace", evidence: ["Do not rewrite s5-preview:inside-evidence"],
    skill: { id: "variant", kind: "active", name: "s5-preview:in-name", game_skill_id: 123, display: false,
      modifier_sources: ["perk:s5-preview:200"], parameters: { cooldown: { row: "s5-preview:pve:123_1", field: "ChargeNeedTime" } } } }] };
  write(root, "data/num-skill-variants.json", json(variants));
  write(root, "data/num-skill-lock.json", json({ schema_version: 1, rows: {} }));
  const contentRoot = path.join(root, "live");
  write(contentRoot, "DataTables/LuaDataTable/WeaponModItemData.json", json([{ Rows: { "200": { MODSlotIndex: { Values: [1] }, CollectMODItem: 1, MakeMODItem: 1, IsCooked: true } } }]));
  write(contentRoot, "Attributes/AutoGenerate/numerical_modifier_config.json", json([{ Rows: { "111010083_1_0": row } }]));
  write(contentRoot, "DataTables/SkillConfigTable_Weapon_PVE.json", json([{ Rows: { "123_1": { SkillID: 123, Level: 1, ChargeNeedTime: 42, SkillCount: 1 } } }]));
  const archive = saveVersion(root, { season: "s5", version: "s5-preview" }, { summary: { channel: "preview" }, files: {
    "config/content-version.json": Buffer.from(json(release)),
    "data/perk-preview/slot-1/Fixture.mdx": Buffer.from(source),
    "evidence/data/perk-preview-modifiers.json": Buffer.from(json({ schema_version: 1, season: "s5", rows: { "111010083_1_0": row } })),
  } });
  const baseline = saveVersion(root, { season: "s4", version: "s4" }, { summary: { channel: "current" }, files: {
    "config/content-version.json": Buffer.from(json({ schemaVersion: 1, season: "s4", version: "s4", phase: "current" })),
    "data/perks/slot-1/Fixture.mdx": Buffer.from("---\ntitle: Fixture\nid: '200'\nseason: s2\n---\nOld\n"),
  } });
  const candidate = path.join(root, "candidate");
  const bytes = json(catalog("s5"));
  write(candidate, "catalog.json", bytes);
  write(candidate, "evidence.json", json({ schemaVersion: 1, season: "s5", cards: {}, rules: {} }));
  write(candidate, "providers.json", json({ schemaVersion: 1, providers: [], exclusions: [] }));
  const review = path.join(candidate, "review.json");
  write(candidate, "review.json", json({ status: "approved", catalogSha256: sha256(bytes), basis: "Synthetic formal audit" }));
  const options: PromotionOptions = { root, contentRoot, archive, baseline, candidate, review, season: "s5", version: "s5" };
  return { root, options, source, variants, modifier, read: (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8")) };
}

test("read-only promotion plans all migrations without touching files, and writes once", t => {
  const f = fixture(t);
  const before = fs.readFileSync(path.join(f.root, "config/content-version.json"));
  const plan = planPromotion(f.options);
  assert.equal(plan.status, "ready");
  assert.deepEqual(plan.blockers, []);
  assert.deepEqual(fs.readFileSync(path.join(f.root, "config/content-version.json")), before);
  assert.equal(fs.existsSync(path.join(f.root, "MD")), false);
  const commands: string[] = [];
  const result = applyPromotion(f.options, plan, command => { commands.push(command); });
  assert.equal(result.status, "promoted");
  assert.equal(commands.length, 11);
  assert.equal(commands.includes("pnpm build"), false);
  const official = matter.read(path.join(f.root, "data/perks/slot-1/Fixture.mdx"));
  assert.equal(official.data.season, "s2");
  assert.equal(official.data.preview_change, undefined);
  assert.equal(official.content, "Body\n");
  assert.equal(fs.existsSync(path.join(f.root, "data/perk-preview/slot-1/Fixture.mdx")), false);
  assert.equal(f.read("data/perk-preview/preview.json"), null);
  assert.equal(f.read("data/overlimit/preview.json"), null);
  assert.equal(f.read("config/content-version.json").phase, "candidate");
  assert.equal(f.read("config/content-version.json").preview, undefined);
  const variant = f.read("data/num-skill-variants.json").variants[0];
  assert.equal(variant.key, "current:variant");
  assert.equal(variant.skill.name, "s5-preview:in-name");
  assert.equal(variant.evidence[0], "Do not rewrite s5-preview:inside-evidence");
  assert.deepEqual(variant.skill.modifier_sources, ["perk:200"]);
  assert.equal(f.read("data/num-skill-lock.json").rows["current:pve:123_1"].raw.ChargeNeedTime, 42);
  assert.deepEqual(f.read("data/num-modifier-lock.json"), f.modifier);
  const repeated = planPromotion(f.options);
  assert.equal(repeated.status, "already-promoted");
  const count = fs.readdirSync(path.join(f.root, "MD/_local/content-versions/promotions")).length;
  applyPromotion(f.options, repeated, () => { assert.fail("Repeated promotion must not execute sync"); });
  assert.equal(fs.readdirSync(path.join(f.root, "MD/_local/content-versions/promotions")).length, count);
});

test("existing identical ItemID is preserved despite filename and YAML formatting differences", t => {
  const f = fixture(t);
  const plan = planPromotion(f.options);
  const text = plan.writes["data/perks/slot-1/Fixture.mdx"]!.toString().replace("season: s2", "season: 's2'");
  write(f.root, "data/perks/slot-1/ExistingName.mdx", text);
  const second = planPromotion(f.options);
  assert.equal(second.report.perks?.[0].target, "data/perks/slot-1/ExistingName.mdx");
  assert.equal(second.report.perks?.[0].unchanged, true);
  assert.equal("data/perks/slot-1/ExistingName.mdx" in second.writes, false);
});

test("different existing ItemID blocks the whole write and reports both paths", t => {
  const f = fixture(t);
  write(f.root, "data/perks/slot-1/UserWork.mdx", "---\nid: '200'\n---\nUser work\n");
  const plan = planPromotion(f.options);
  assert.match(plan.blockers.join("\n"), /UserWork.*|Fixture/);
  assert.throws(() => applyPromotion(f.options, plan), /conflicts/);
  assert.equal(fs.existsSync(path.join(f.root, "MD")), false);
  assert.equal(fs.readFileSync(path.join(f.root, "data/perks/slot-1/UserWork.mdx"), "utf8").endsWith("User work\n"), true);
});

test("wrong release or preview season and empty preview fail before any writes", t => {
  const f = fixture(t);
  assert.throws(() => planPromotion({ ...f.options, season: "s6" }), /season mismatch/);
  assert.throws(() => planPromotion({ ...f.options, version: "s5.1" }), /version mismatch/);
  const release = f.read("config/content-version.json");
  delete release.preview;
  write(f.root, "config/content-version.json", json(release));
  assert.throws(() => planPromotion(f.options), /No registered/);
  write(f.root, "config/content-version.json", json({ ...release, preview: { season: "s5", version: "s5-preview", label: "Preview" } }));
  fs.unlinkSync(path.join(f.root, "data/perk-preview/slot-1/Fixture.mdx"));
  assert.throws(() => planPromotion(f.options), /No s5-preview perk sources/);
});

test("corrupted archives, stale approvals and drifted live Lock are rejected without backup creation", t => {
  const f = fixture(t);
  fs.appendFileSync(f.options.review, " "); // Valid JSON whitespace does not alter the approved catalog.
  assert.doesNotThrow(() => planPromotion(f.options));
  fs.appendFileSync(path.join(f.options.candidate, "catalog.json"), "\n");
  assert.throws(() => planPromotion(f.options), /exact catalogSha256/);
  write(f.options.candidate, "catalog.json", json(catalog("s5")));
  f.modifier.rows.lc["111010083_1_0"].raw.BaseValue = 7;
  write(f.root, "data/num-modifier-lock.json", json(f.modifier));
  assert.throws(() => planPromotion(f.options), /Stale live Lock/);
  f.modifier.rows.lc["111010083_1_0"].raw.BaseValue = 0.125;
  write(f.root, "data/num-modifier-lock.json", json(f.modifier));
  fs.appendFileSync(path.join(f.options.archive, "files/data/perk-preview/slot-1/Fixture.mdx"), "changed");
  assert.throws(() => planPromotion(f.options), /checksum mismatch/);
  assert.equal(fs.existsSync(path.join(f.root, "MD")), false);
});

test("formal skill rows, source identities and audited runtime bindings are required", t => {
  const f = fixture(t);
  write(f.options.contentRoot, "DataTables/SkillConfigTable_Weapon_PVE.json", json([{ Rows: {} }]));
  assert.throws(() => planPromotion(f.options), /Missing.*123_1/);
  const runtime = { ...f.variants.variants[0].skill, parameters: { duration: { runtime: "s5-preview:123:duration" } } };
  write(f.root, "data/num-skill-variants.json", json({ schema_version: 1, variants: [{ ...f.variants.variants[0], skill: runtime }] }));
  assert.throws(() => planPromotion(f.options), /Missing audited official runtime binding/);
  const missing = f.read("data/modifier-providers.json");
  missing.providers[0].id = "invalid-source-identity";
  write(f.root, "data/modifier-providers.json", json(missing));
  assert.throws(() => planPromotion(f.options), /Missing preview channel/);
});

test("live audited runtime bindings succeed only while their source and flow hashes match", t => {
  const f = fixture(t);
  const asset = "Skill/Fixture.uasset";
  write(f.options.contentRoot, asset, "formal fixture bytes");
  const digest = sha256("formal fixture bytes");
  const binding = { game_skill_id: 123, dataset: "live", modifiers: [],
    source: { kind: "blueprint_default", asset: `NZM/Content/${asset}`, sha256: digest, object: "Default", field: "Duration", value: 3 },
    flow: { asset: `NZM/Content/${asset}`, sha256: digest, read: { function: "Read", statement: 0 },
      apply: { function: "Apply", statement: 1 }, boundary: "blueprint", evidence: "Reviewed fixture chain" } };
  write(f.root, "data/num-skill-lock.json", json({ schema_version: 1, rows: {}, runtime: { "current:123:duration": binding } }));
  write(f.root, "data/num-skill-variants.json", json({ schema_version: 1, variants: [{ ...f.variants.variants[0],
    skill: { ...f.variants.variants[0].skill, parameters: { duration: { runtime: "s5-preview:123:duration" } } } }] }));
  assert.doesNotThrow(() => planPromotion(f.options));
  write(f.options.contentRoot, asset, "changed formal source");
  assert.throws(() => planPromotion(f.options), /Stale runtime flow/);
});

test("existing source duplicates merge only if identical and reviewed replacements can switch disposition", t => {
  const f = fixture(t);
  const registry = f.read("data/modifier-providers.json");
  const current = structuredClone(registry.providers[0]);
  current.id = "perk:200";
  delete current.source.season;
  registry.providers.push(current);
  write(f.root, "data/modifier-providers.json", json(registry));
  assert.doesNotThrow(() => planPromotion(f.options));
  registry.providers[1].label = "Different reviewed description";
  write(f.root, "data/modifier-providers.json", json(registry));
  assert.throws(() => planPromotion(f.options), /Current source conflict/);
  const replacement = path.join(f.root, "replacement.json");
  write(f.root, "replacement.json", json({ schemaVersion: 1, providers: [], exclusions: [{ id: "perk:200", label: "Fixture", source: current.source,
    reasonCode: "not-damage-multiplier", reason: "Reviewed fixture disposition", evidence: { basis: ["Reviewed"], applications: current.applications } }] }));
  const plan = planPromotion({ ...f.options, perkProviders: replacement });
  const result = JSON.parse(plan.writes["data/modifier-providers.json"]!.toString());
  assert.equal(result.providers.length, 0);
  assert.equal(result.exclusions.length, 1);
});

test("unresolved card sources block preflight and other preview channels are preserved", t => {
  const f = fixture(t);
  const candidate = catalog("s5");
  const enriched = { ...candidate, cards: candidate.cards.map(card => ({ ...card,
    effectValues: [{ kind: "stat", statId: "fixture", label: "Fixture", stages: [{ value: "1" }] }] })) };
  const bytes = json(enriched);
  write(f.options.candidate, "catalog.json", bytes);
  write(f.options.candidate, "review.json", json({ status: "approved", catalogSha256: sha256(bytes), basis: "Reviewed" }));
  assert.throws(() => planPromotion(f.options), /Missing reviewed card source 100/);
  write(f.options.candidate, "catalog.json", json(candidate));
  write(f.options.candidate, "review.json", json({ status: "approved", catalogSha256: sha256(json(candidate)), basis: "Reviewed" }));
  const registry = f.read("data/modifier-providers.json");
  registry.exclusions.push({ id: "overlimit-card:s6-preview:999", label: "Future", source: { type: "overlimit-card", season: "s6-preview", id: "999" },
    reasonCode: "unverified-evidence", reason: "Unrelated future evidence" });
  write(f.root, "data/modifier-providers.json", json(registry));
  const plan = planPromotion(f.options);
  assert.equal(JSON.parse(plan.writes["data/modifier-providers.json"]!.toString()).exclusions[0].source.season, "s6-preview");
});

test("child failure restores our files and completed sync outputs, preserving unrelated edits", t => {
  const f = fixture(t);
  write(f.root, "public/search-index.json", "original index");
  const plan = planPromotion(f.options);
  assert.throws(() => applyPromotion(f.options, plan, command => {
    if (command === "pnpm overlimit project") write(f.root, "data/overlimit/links.json", "generated links");
    if (command === "pnpm perks:check") throw new Error("fixture failure");
  }), /All promotion writes restored/);
  assert.equal(fs.existsSync(path.join(f.root, "data/perks/slot-1/Fixture.mdx")), false);
  assert.equal(fs.readFileSync(path.join(f.root, "data/perk-preview/slot-1/Fixture.mdx"), "utf8"), f.source);
  assert.equal(fs.existsSync(path.join(f.root, "data/overlimit/links.json")), false);
  assert.equal(fs.readFileSync(path.join(f.root, "public/search-index.json"), "utf8"), "original index");
  assert.deepEqual(f.read("data/num-modifier-lock.json"), f.modifier);
});

test("concurrent changes are preserved and reported during recovery", t => {
  const f = fixture(t);
  const plan = planPromotion(f.options);
  assert.throws(() => applyPromotion(f.options, plan, () => {
    write(f.root, "data/perks/slot-1/Fixture.mdx", "new human edit");
    throw new Error("stop");
  }), /Recovery conflicts.*Fixture.mdx/);
  assert.equal(fs.readFileSync(path.join(f.root, "data/perks/slot-1/Fixture.mdx"), "utf8"), "new human edit");
  assert.equal(fs.readFileSync(path.join(f.root, "data/perk-preview/slot-1/Fixture.mdx"), "utf8"), f.source);
});

test("files changed after preflight prevent writes and interrupted child outputs are preserved", t => {
  const f = fixture(t);
  const plan = planPromotion(f.options);
  write(f.root, "config/content-version.json", "changed after plan");
  assert.throws(() => applyPromotion(f.options, plan), /File changed since preflight/);
  write(f.root, "config/content-version.json", plan.before!["config/content-version.json"]!);
  assert.throws(() => applyPromotion(f.options, plan, command => {
    if (command === "pnpm overlimit project") {
      write(f.root, "data/overlimit/links.json", "interrupted output");
      throw new Error("interrupted");
    }
  }), /Recovery conflicts.*links.json/);
  assert.equal(fs.readFileSync(path.join(f.root, "data/overlimit/links.json"), "utf8"), "interrupted output");
});

test("CLI promote defaults to read-only and reports blockers with nonzero exit status", t => {
  const f = fixture(t);
  const args = ["--import", pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href, "scripts/content-versions/cli.ts", "promote", "--season", "s5", "--version", "s5", "--content-root", f.options.contentRoot,
    "--archive", f.options.archive, "--baseline", f.options.baseline, "--candidate", f.options.candidate, "--review", f.options.review];
  // CLI roots are cwd; run the real script by absolute path against the isolated fixture.
  args[2] = path.resolve(args[2]);
  const output = execFileSync(process.execPath, args, { cwd: f.root, encoding: "utf8", windowsHide: true,
    env: { ...process.env, TSX_TSCONFIG_PATH: path.resolve("tsconfig.json") } });
  assert.match(output, /"status": "ready"/);
  assert.equal(fs.existsSync(path.join(f.root, "MD")), false);
  const failedArgs = [...args];
  failedArgs[failedArgs.indexOf("--season") + 1] = "s6";
  const failed = spawnSync(process.execPath, failedArgs, { cwd: f.root, encoding: "utf8", windowsHide: true,
    env: { ...process.env, TSX_TSCONFIG_PATH: path.resolve("tsconfig.json") } });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /"status": "blocked"/);
  assert.match(failed.stderr, /Candidate release season mismatch/);
});
