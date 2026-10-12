import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import matter from "gray-matter";
import { parseModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import { createNumModifierResolver } from "../../lib/num-modifier";
import { parseNumModifierDataLock } from "../../lib/num-modifier-data-lock";
import { parseNumModifierSemantics } from "../../lib/num-modifier-semantics";
import { numSkillDefinitionsSchema, resolveNumSkill } from "../../lib/num-skill";
import { planPerkPromotion, perkFiles, type PerkPromotionOptions } from "../perks/promotion";
import { prepareSkillRows } from "../num-skills/lock";
import { archiveCatalog, checkCatalog, readCatalog, reviewedCatalog, sha256, verifyArchive } from "../overlimit/catalog";
import { runContentSync } from "../sync-content";
import { planSharedPromotion, readPromotionProviders } from "./shared-promotion";
import { readRelease, releaseSchema } from "./release";
import { verifyVersion } from "./store";

export interface PromotionOptions extends PerkPromotionOptions {
  version: string; candidate: string; review: string; perkProviders?: string;
}
type Writes = Record<string, Buffer | null>;
const json = (value: unknown) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const read = (root: string, file: string) => JSON.parse(fs.readFileSync(path.resolve(root, file), "utf8"));
const bytesAt = (root: string, file: string): Buffer | null => fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file)) : null;
const sameBytes = (left: Buffer | null, right: Buffer | null) => left === null ? right === null : right !== null && left.equals(right);

// These are the only outputs of the existing sync pipeline. Checkpoints follow each command.
const SYNC_OUTPUTS: Record<string, string[]> = {
  "pnpm overlimit project": ["data/overlimit/links.json", "data/overlimit/preview-links.json"],
  "pnpm num-modifier:project": ["data/modifier-index-runtime.json", "data/guides/multiplier-providers-runtime.json"],
  "pnpm num-skills:project": ["data/num-skill-index.json"],
  "pnpm index": ["public/search-index.json", "public/weapon-stats.json"],
  "pnpm exec tsx scripts/generate-sitemap.ts": ["public/sitemap.xml"],
};

/** Complete source and destination checks before touching active content. */
export function planPromotion(options: PromotionOptions) {
  const { root, season, version } = options;
  const release = readRelease(root);
  releaseSchema.parse({ ...release, season, version });
  assert.equal(release.season, season, "Candidate release season mismatch");
  assert.equal(release.version, version, "Candidate release version mismatch");
  const archived = verifyVersion(options.archive);
  verifyVersion(options.baseline);
  assert.equal(archived.identity.season, season, "Preview archive season mismatch");
  assert.equal((archived.summary as { channel?: string } | undefined)?.channel, "preview", "Expected a published preview archive");
  assert.equal(readRelease(path.join(options.archive, "files")).preview?.season, season, "Preview archive target mismatch");
  const baselineRelease = readRelease(path.join(options.baseline, "files"));
  assert.equal(baselineRelease.phase, "current", "Baseline must be a finalized official release");
  if (release.basedOn) assert.equal(baselineRelease.version, release.basedOn, "Baseline release version mismatch");
  const { bytes, catalog } = reviewedCatalog(root, path.join(options.candidate, "catalog.json"), options.review);
  assert.equal(catalog.season.id, version, "Candidate catalog version mismatch");
  assert.equal(catalog.season.status, "current", "Expected a reviewed official catalog");
  const evidence = read(root, path.join(options.candidate, "evidence.json"));
  assert.equal(evidence.schemaVersion, 1, "Invalid candidate evidence schema");
  assert.equal(evidence.season, season, "Candidate evidence season mismatch");
  const priority = parseModifierProviderRegistry(read(root, "data/modifier-providers.json")).evidencePriority;
  const providers = readPromotionProviders(path.join(options.candidate, "providers.json"), priority);
  for (const entry of [...providers.providers, ...providers.exclusions]) {
    assert.ok(["overlimit-card", "overlimit-bond", "perk"].includes(entry.source.type), `Unrelated catalog provider ${entry.id}`);
    assert.ok(!("season" in entry.source && entry.source.season), `Preview candidate provider ${entry.id}`);
  }
  const current = readCatalog(path.join(root, "data/overlimit/current.json"));
  checkCatalog(current, root);
  const previewFiles = perkFiles(root, "data/perk-preview").filter(file => matter.read(path.join(root, file)).data.season === `${season}-preview`);
  if (!release.preview && !previewFiles.length && bytes.equals(fs.readFileSync(path.join(root, "data/overlimit/current.json"))) &&
      read(root, "data/perk-preview/preview.json") === null && read(root, "data/overlimit/preview.json") === null &&
      isDeepStrictEqual(read(root, "data/overlimit/current-evidence.json"), evidence)) {
    const registry = parseModifierProviderRegistry(read(root, "data/modifier-providers.json"));
    assert.ok(![...registry.providers, ...registry.exclusions].some(entry => "season" in entry.source && entry.source.season === `${season}-preview`), "Remaining preview providers");
    assert.ok(!read(root, "data/num-skill-variants.json").variants.some((entry: { channel: string }) => entry.channel === `${season}-preview`), "Remaining preview variants");
    return { status: "already-promoted" as const, writes: {} as Writes, blockers: [] as string[], report: { season, version, status: "already-promoted" } };
  }
  assert.equal(release.phase, "candidate", "Prepare a candidate workspace before promotion");
  assert.equal(release.preview?.season, season, `No registered ${season} preview to promote`);
  assert.equal(readRelease(path.join(options.archive, "files")).preview?.version, release.preview.version, "Preview archive version mismatch");
  const previewCatalog = read(root, "data/overlimit/preview.json");
  if (previewCatalog !== null) assert.equal(previewCatalog.season.id, release.preview.version, "Active overlimit preview mismatch");
  const previewPerks = read(root, "data/perk-preview/preview.json");
  assert.ok(previewPerks, "No published perk preview");
  assert.equal(previewPerks.season.key, `${season}-preview`, "Published perk preview mismatch");
  const perks = planPerkPromotion(options);
  const extra = options.perkProviders ? readPromotionProviders(options.perkProviders, priority) : undefined;
  if (extra) for (const entry of [...extra.providers, ...extra.exclusions]) {
    assert.equal(entry.source.type, "perk", `Unrelated perk replacement ${entry.id}`);
    assert.ok(!("season" in entry.source && entry.source.season), `Preview perk replacement ${entry.id}`);
    const itemId = entry.source.type === "perk" ? entry.source.itemId : undefined;
    assert.ok(perks.entries.some(perk => perk.id === itemId), `Replacement outside promoted perks ${entry.id}`);
  }
  const shared = planSharedPromotion(root, season, catalog, providers, extra);
  const sourceIds = new Set([...shared.registry.providers, ...shared.registry.exclusions].map(entry => entry.id));
  for (const card of catalog.cards.filter(card => card.effectValues?.length)) {
    assert.ok([...shared.registry.providers, ...shared.registry.exclusions].some(entry =>
      entry.source.type === "overlimit-card" && !entry.source.season && entry.source.id === card.id ||
      entry.source.type === "perk" && !entry.source.season && entry.source.itemId === card.perkItemId), `Missing reviewed card source ${card.id}`);
  }
  for (const variant of shared.variants.variants.filter(entry => entry.channel === "current")) {
    for (const id of variant.skill.modifier_sources ?? []) assert.ok(sourceIds.has(id), `Missing official skill source ${variant.key}/${id}`);
  }
  for (const perk of perks.entries) {
    for (const reference of matter(perk.text).data.skill_variants ?? []) {
      assert.ok(shared.variants.variants.some(variant => variant.channel === "current" && variant.key === reference.variant), `Missing official variant ${perk.id}/${reference.variant}`);
    }
  }
  const definitions = fs.existsSync(path.join(root, "data/weapons")) ? fs.readdirSync(path.join(root, "data/weapons"))
    .filter(file => file.endsWith(".mdx")).flatMap(file => numSkillDefinitionsSchema.parse(matter.read(path.join(root, "data/weapons", file)).data.skills ?? [])) : [];
  definitions.push(...shared.variants.variants.map(variant => variant.skill));
  shared.lock = prepareSkillRows(options.contentRoot, "current", shared.lock, definitions);
  for (const variant of shared.variants.variants.filter(entry => entry.channel === "current")) {
    for (const expression of Object.values(variant.skill.parameters ?? {})) if ("runtime" in expression) {
      const binding = shared.lock.runtime?.[expression.runtime];
      assert.ok(binding?.dataset === "live", `Missing audited official runtime binding ${expression.runtime}`);
      for (const flow of [binding.flow, ...binding.modifiers.map(modifier => modifier.flow)]) {
        const relative = flow.asset.replace(/^NZM\/Content\//, "");
        assert.equal(sha256(fs.readFileSync(path.join(options.contentRoot, relative))), flow.sha256, `Stale runtime flow ${expression.runtime}`);
      }
      if (binding.source.kind !== "weapon_parameter") {
        assert.equal(sha256(fs.readFileSync(path.join(options.contentRoot, binding.source.asset.replace(/^NZM\/Content\//, "")))), binding.source.sha256, `Stale runtime source ${expression.runtime}`);
      }
    }
    // PVE weapon-parameter runtimes require separately reviewed weapon context; never invent it.
    resolveNumSkill(variant.skill, { channel: "current", lock: shared.lock });
  }
  const resolver = createNumModifierResolver(parseNumModifierDataLock(read(root, "data/num-modifier-lock.json")),
    parseNumModifierSemantics(read(root, "data/num-modifier-semantics.json")));
  const numericalTables = read(options.contentRoot, "Attributes/AutoGenerate/numerical_modifier_config.json").filter((table: { Rows?: unknown }) => table.Rows);
  assert.equal(numericalTables.length, 1, "Ambiguous official Numerical table");
  for (const entry of [...shared.registry.providers, ...shared.registry.exclusions]) {
    if (!(entry.source.type === "perk" || entry.source.type === "overlimit-card" || entry.source.type === "overlimit-bond")) continue;
    if (entry.source.season) continue;
    const applications = "evidence" in entry && entry.evidence && "applications" in entry.evidence ? entry.evidence.applications : "applications" in entry ? entry.applications : undefined;
    for (const application of applications ?? []) {
      const resolved = resolver.resolveEffect(application.expression, application.context);
      const row = resolver.getRow(application.expression.row);
      const live = numericalTables[0].Rows[row.key.slice(3)];
      assert.ok(live, `Missing official provider row ${entry.id}/${row.key}`);
      for (const field of ["ID", "Level", "AttributeName", "GPModifierOp", "BaseValue", "CoefValue"]) {
        assert.deepEqual(live[field], row.raw[field], `Stale provider Lock ${entry.id}/${row.key}/${field}`);
      }
      assert.ok(resolved, `Invalid provider ${entry.id}`);
    }
  }
  const writes: Writes = {};
  for (const perk of perks.entries) {
    if (!perk.unchanged) writes[perk.target] = Buffer.from(perk.text);
  }
  writes["data/overlimit/current.json"] = bytes;
  writes["data/overlimit/current-evidence.json"] = json(evidence);
  writes["data/modifier-providers.json"] = json(shared.registry);
  writes["data/num-skill-variants.json"] = json(shared.variants);
  writes["data/num-skill-lock.json"] = json(shared.lock);
  for (const perk of perks.entries) writes[perk.source] = null;
  writes["data/perk-preview/preview.json"] = Buffer.from("null\n");
  writes["data/overlimit/preview.json"] = Buffer.from("null\n");
  writes["config/content-version.json"] = json(shared.release);
  const changed = Object.entries(writes).filter(([file, bytes]) => !sameBytes(bytesAt(root, file), bytes)).map(([file]) => file);
  const before = Object.fromEntries([...new Set([...Object.keys(writes), ...Object.values(SYNC_OUTPUTS).flat()])].map(file => [file, bytesAt(root, file)]));
  return { status: "ready" as const, writes, before, blockers: perks.conflicts,
    report: { season, version, status: perks.conflicts.length ? "blocked" : "ready", changed,
      perks: perks.entries.map(({ id, source, target, unchanged, snapshotRemoved }) => ({ id, source, target, unchanged, snapshotRemoved })),
      changedBindings: perks.changedBindings, providers: shared.registry.providers.length,
      exclusions: shared.registry.exclusions.length, skillVariants: shared.promotedKeys, phase: "candidate" } };
}

export type PromotionPlan = ReturnType<typeof planPromotion>;

/** Selected site files only. The expected bytes protect edits made after our own write. */
export function applyPromotion(options: PromotionOptions, plan: PromotionPlan,
  execute: (command: string, root: string) => void = (command, root) => execSync(command, { cwd: root, stdio: "inherit", windowsHide: true })) {
  if (plan.status === "already-promoted") return { status: plan.status };
  assert.equal(plan.blockers.length, 0, plan.blockers.join("\n"));
  const { root } = options;
  const before = plan.before!;
  for (const [file, bytes] of Object.entries(before)) assert.ok(sameBytes(bytesAt(root, file), bytes), `File changed since preflight: ${file}`);
  const backup = path.join(root, "MD/_local/content-versions/promotions", `${options.version}-${randomUUID()}`);
  fs.mkdirSync(backup, { recursive: true });
  const manifest = Object.entries(before).map(([file, bytes]) => ({ file, sha256: bytes === null ? null : sha256(bytes) }));
  for (const [file, bytes] of Object.entries(before)) if (bytes !== null) {
    const target = path.join(backup, "files", file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: "wx" });
  }
  fs.writeFileSync(path.join(backup, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
  const owned = new Map<string, Buffer | null>();
  const uncertain = new Set<string>();
  const write = (file: string, bytes: Buffer | null) => {
    const expected = owned.has(file) ? owned.get(file)! : before[file];
    assert.ok(sameBytes(bytesAt(root, file), expected), `Concurrent edit: ${file}`);
    const target = path.join(root, file);
    if (bytes === null) {
      if (fs.existsSync(target)) fs.unlinkSync(target);
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const pending = `${target}.promotion-${randomUUID()}`;
      try {
        fs.writeFileSync(pending, bytes, { flag: "wx" });
        assert.ok(sameBytes(bytesAt(root, file), expected), `Concurrent edit: ${file}`);
        fs.renameSync(pending, target);
      } finally { if (fs.existsSync(pending)) fs.unlinkSync(pending); }
    }
    owned.set(file, bytes);
  };
  try {
    if (!sameBytes(before["data/overlimit/current.json"], plan.writes["data/overlimit/current.json"])) {
      const archive = path.join(root, "MD/_local/overlimit/archives", `promotion-${randomUUID()}`);
      archiveCatalog(root, archive);
      verifyArchive(archive);
    }
    for (const [file, bytes] of Object.entries(plan.writes)) write(file, bytes);
    runContentSync(command => {
      const outputs = SYNC_OUTPUTS[command] ?? [];
      for (const file of outputs) assert.ok(sameBytes(bytesAt(root, file), owned.has(file) ? owned.get(file)! : before[file]), `Concurrent edit: ${file}`);
      try { execute(command, root); }
      catch (error) {
        // An interrupted child may have written only part of its outputs. Ownership is unknown.
        for (const file of outputs) if (!sameBytes(bytesAt(root, file), owned.has(file) ? owned.get(file)! : before[file])) uncertain.add(file);
        throw error;
      }
      for (const file of outputs) owned.set(file, bytesAt(root, file));
    });
    fs.writeFileSync(path.join(backup, "result.json"), json({ status: "promoted", season: options.season, version: options.version }));
    return { status: "promoted", backup, phase: "candidate" };
  } catch (error) {
    const conflicts = [...uncertain];
    for (const [file, expected] of [...owned.entries()].reverse()) {
      if (uncertain.has(file)) continue;
      if (!sameBytes(bytesAt(root, file), expected)) { conflicts.push(file); continue; }
      try { write(file, before[file]); }
      catch { conflicts.push(file); }
    }
    fs.writeFileSync(path.join(backup, "result.json"), json({ status: "failed", conflicts }));
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nBackup: ${backup}\n${conflicts.length ? `Recovery conflicts (preserved): ${conflicts.join(", ")}` : "All promotion writes restored."}`);
  }
}
