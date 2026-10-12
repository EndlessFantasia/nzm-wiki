import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { parseModifierProviderRegistry, type ModifierProviderRegistry, type ModifierProviderRegistryEntry, type ModifierProviderRegistryExclusion } from "../../lib/modifier-provider-registry";
import { numSkillLockSchema, skillVariantCatalogSchema } from "../../lib/num-skill";
import type { OverlimitCatalog } from "../../lib/overlimit-catalog";
import { readRelease, releaseSchema } from "./release";

const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";

/** Import candidates intentionally omit the shared registry's policy metadata. */
export function readPromotionProviders(file: string, evidencePriority: string[]) {
  return parseModifierProviderRegistry({ evidencePriority, ...JSON.parse(fs.readFileSync(file, "utf8")) });
}

export function planSharedPromotion(root: string, season: string, catalog: OverlimitCatalog,
  overlimit: ModifierProviderRegistry, extraPerks?: ModifierProviderRegistry) {
  const key = `${season}-preview`;
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  const registry = parseModifierProviderRegistry(read("data/modifier-providers.json"));
  const linkedPerks = new Set(catalog.cards.flatMap(card => card.perkItemId ? [card.perkItemId] : []));
  const identities = new Map<string, string>();
  const allAdditions = [...overlimit.providers, ...overlimit.exclusions, ...(extraPerks?.providers ?? []), ...(extraPerks?.exclusions ?? [])];
  const replacements = new Set(allAdditions.map(entry => entry.id));
  assert.equal(replacements.size, allAdditions.length, "Duplicate candidate source identity");
  for (const entry of [...registry.providers, ...registry.exclusions]) {
    if ("season" in entry.source && entry.source.season === key) identities.set(entry.id, entry.id.split(`:${key}:`).join(":"));
  }
  const promote = <T extends ModifierProviderRegistryEntry | ModifierProviderRegistryExclusion>(entries: T[], additions: T[]): T[] => {
    entries = entries.filter(entry => {
      const source = entry.source;
      return !(["overlimit-card", "overlimit-bond"].includes(source.type) && !("season" in source && source.season && source.season !== key));
    });
    for (const entry of entries) {
      if ("season" in entry.source && entry.source.season === key) {
        delete entry.source.season;
        const before = entry.id;
        entry.id = identities.get(before)!;
        assert.notEqual(before, entry.id, `Missing preview channel in source identity ${before}`);
      }
      if (entry.source.type === "perk" && !entry.source.season) entry.source.overlimitCard = linkedPerks.has(entry.source.itemId);
    }
    const merged = new Map<string, T>();
    for (const entry of [...entries.filter(entry => !replacements.has(entry.id)), ...additions]) {
      const existing = merged.get(entry.id);
      assert.ok(!existing || isDeepStrictEqual(existing, entry), `Current source conflict ${entry.id}; provide a reviewed replacement`);
      if (!existing) merged.set(entry.id, entry);
    }
    return [...merged.values()];
  };
  registry.providers = promote(registry.providers, [...overlimit.providers, ...(extraPerks?.providers ?? [])]);
  registry.exclusions = promote(registry.exclusions, [...overlimit.exclusions, ...(extraPerks?.exclusions ?? [])]);
  const validatedRegistry = parseModifierProviderRegistry(registry);
  const variants = skillVariantCatalogSchema.parse(read("data/num-skill-variants.json"));
  const promoted = variants.variants.filter(variant => variant.channel === key).map(input => {
    const variant = structuredClone(input);
    assert.ok(variant.key.startsWith(`${key}:`), `Variant channel/key mismatch ${variant.key}`);
    variant.channel = "current";
    variant.key = `current:${variant.key.slice(key.length + 1)}`;
    for (const expression of Object.values(variant.skill.parameters ?? {})) {
      if ("row" in expression || "runtime" in expression) {
        const field = "row" in expression ? "row" : "runtime";
        const value = "row" in expression ? expression.row : expression.runtime;
        assert.ok(value.startsWith(`${key}:`), `Cross-channel skill reference ${value}`);
        if (field === "row" && "row" in expression) expression.row = `current:${value.slice(key.length + 1)}`;
        else if ("runtime" in expression) expression.runtime = `current:${value.slice(key.length + 1)}`;
      }
    }
    variant.skill.modifier_sources = variant.skill.modifier_sources?.map(id => identities.get(id) ?? id);
    const existing = variants.variants.find(entry => entry.channel === "current" && entry.key === variant.key);
    assert.ok(!existing || isDeepStrictEqual(existing, variant), `Current skill variant conflict ${variant.key}`);
    return variant;
  });
  const promotedKeys = new Set(promoted.map(variant => variant.key));
  variants.variants = [...variants.variants.filter(variant => variant.channel !== key && !promotedKeys.has(variant.key)), ...promoted];
  skillVariantCatalogSchema.parse(variants);
  const lock = numSkillLockSchema.parse(read("data/num-skill-lock.json"));
  for (const row of Object.keys(lock.rows)) if (row.startsWith(`${key}:`)) delete lock.rows[row];
  for (const runtime of Object.keys(lock.runtime ?? {})) if (runtime.startsWith(`${key}:`)) delete lock.runtime![runtime];
  const release = readRelease(root);
  assert.equal(release.season, season, "Candidate release season mismatch");
  if (release.preview?.season === season) delete release.preview;
  release.phase = "candidate";
  releaseSchema.parse(release);
  return {
    registry: validatedRegistry, variants, lock, release, promotedKeys: [...promotedKeys],
    writes: {
      "data/modifier-providers.json": json(validatedRegistry),
      "data/num-skill-variants.json": json(variants),
      "data/num-skill-lock.json": json(lock),
      "config/content-version.json": json(release),
    },
  };
}

export function applySharedPromotion(root: string, plan: ReturnType<typeof planSharedPromotion>): void {
  for (const [file, text] of Object.entries(plan.writes)) fs.writeFileSync(path.join(root, file), text);
}
