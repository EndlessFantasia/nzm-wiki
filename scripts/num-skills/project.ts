import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { numSkillDefinitionsSchema, skillVariantReferenceSchema, type NumSkillDefinition, type ResolvedSkillVariant } from "../../lib/num-skill";
import { resolveWeaponSkills, resolvePerkSkillVariants } from "../../lib/num-skill-data";
import { parseModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import type { NumSkillIndex, IndexedSkillVariant, IndexedWeaponSkill } from "../../lib/num-skill-index";

export const SKILL_INDEX_PATH = "data/num-skill-index.json";

/** Reject silent migration omissions, duplicate rendering and legacy display props. */
export function validateSkillMarkup(content: string, skills: readonly NumSkillDefinition[], label: string) {
  const seen = new Set<string>();
  const opening = /<(ActiveSkill|PassiveSkill)\b([^>]*?)>/g;
  for (const match of content.matchAll(opening)) {
    const reference = match[2].match(/^\s+skill\s*=\s*["']([a-z0-9]+(?:-[a-z0-9]+)*)["']\s*\/?\s*$/);
    if (!reference) throw new Error(`${label}: ${match[1]} must contain only a static skill reference`);
    const id = reference[1];
    const definition = skills.find(skill => skill.id === id);
    if (!definition || definition.display === false) throw new Error(`${label}: missing or hidden skill ${id}`);
    if (definition.kind !== (match[1] === "ActiveSkill" ? "active" : "passive")) throw new Error(`${label}: skill kind mismatch ${id}`);
    if (seen.has(id)) throw new Error(`${label}: duplicate rendered skill ${id}`);
    seen.add(id);
  }
  for (const skill of skills) {
    if (skill.display !== false && !seen.has(skill.id)) throw new Error(`${label}: visible skill not rendered ${skill.id}`);
  }
  return seen.size;
}

type Registry = ReturnType<typeof parseModifierProviderRegistry>;

export function validateSkillProviders(skills: readonly IndexedWeaponSkill[], registry: Registry) {
  const providers = new Map(registry.providers.map(provider => [provider.id, provider]));
  for (const skill of skills) {
    for (const id of skill.modifierSources) {
      const source = providers.get(id)?.source;
      if (!source || source.type !== "weapon" || source.slug !== skill.weaponSlug || source.skillName !== skill.name ||
          source.component !== (skill.kind === "active" ? "ActiveSkill" : "PassiveSkill")) throw new Error(`${skill.weaponSlug}/${skill.id}: invalid modifier provider ${id}`);
    }
  }
  for (const provider of registry.providers) {
    const source = provider.source;
    if (source.type !== "weapon") continue;
    const matched = skills.filter(skill => skill.weaponSlug === source.slug && skill.name === source.skillName &&
      source.component === (skill.kind === "active" ? "ActiveSkill" : "PassiveSkill"));
    if (!matched.length || matched.some(skill => !skill.modifierSources.includes(provider.id))) throw new Error(`Unreferenced weapon modifier provider: ${provider.id}`);
  }
  for (const exclusion of registry.exclusions) {
    const source = exclusion.source;
    if (source.type !== "weapon") continue;
    const matched = skills.filter(skill => skill.weaponSlug === source.slug && skill.name === source.skillName &&
      source.component === (skill.kind === "active" ? "ActiveSkill" : "PassiveSkill"));
    if (!matched.length) throw new Error(`Orphan weapon modifier exclusion: ${exclusion.id}`);
  }
}

function collectMdx(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? collectMdx(file) : entry.name.endsWith(".mdx") ? [file] : [];
  }).sort();
}

export function projectSkillVariants(
  input: readonly ResolvedSkillVariant[],
  context: { perkItemId: string; perkSlug: string; channel: string },
  skills: readonly IndexedWeaponSkill[],
): IndexedSkillVariant[] {
  const seen = new Set<string>();
  return input.map(variant => {
    const reference = skillVariantReferenceSchema.parse(variant.reference);
    const baseKey = "scope" in reference ? reference.scope : `${reference.weapon_slug}/${reference.base_skill}`;
    if (seen.has(baseKey)) throw new Error(`Duplicate perk replacement: ${context.perkSlug}/${baseKey}`);
    seen.add(baseKey);
    const original = variant.original;
    if (variant.skill.kind !== "active" || !variant.skill.gameSkillId || ("scope" in reference) !== ("scope" in original)) throw new Error(`Invalid perk replacement base: ${context.perkSlug}/${baseKey}`);
    if (!("scope" in reference)) {
      const bases = skills.filter(skill => skill.weaponSlug === reference.weapon_slug && skill.id === reference.base_skill);
      if (!("id" in original) || !bases.length || bases.some(base => base.kind !== "active" || base.gameSkillId !== original.id) ||
          (reference.operation === "modify") !== (variant.skill.gameSkillId === original.id)) throw new Error(`Invalid perk replacement base: ${context.perkSlug}/${baseKey}`);
    }
    for (const expression of Object.values(variant.skill.provenance)) {
      if (expression && (("row" in expression && expression.row.split(":")[0] !== context.channel) || ("runtime" in expression && expression.runtime.split(":")[0] !== context.channel))) throw new Error(`Cross-channel published skill: ${context.perkSlug}`);
    }
    if ("scope" in reference) return { ...variant.skill, ...context, scope: reference.scope, variantKey: reference.variant, operation: reference.operation };
    if (!("id" in original)) throw new Error(`Invalid perk replacement base: ${context.perkSlug}/${baseKey}`);
    return {
      ...variant.skill, ...context, weaponSlug: reference.weapon_slug,
      baseSkillId: reference.base_skill, originalId: original.id, variantKey: reference.variant, operation: reference.operation,
    };
  });
}

export function createSkillIndex(): NumSkillIndex {
  const root = process.cwd();
  const skills: IndexedWeaponSkill[] = [];
  for (const file of collectMdx(path.join(root, "data/weapons"))) {
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    if (!Object.hasOwn(data, "skills")) throw new Error(`${file}: missing migrated skills field`);
    const definitions = numSkillDefinitionsSchema.parse(data.skills);
    validateSkillMarkup(content, definitions, file);
    const slug = path.basename(file, ".mdx");
    if (!Array.isArray(data.game_modes) || !data.game_modes.length) throw new Error(`${file}: missing game modes`);
    for (const mode of data.game_modes) {
      if (mode !== "lc" && mode !== "td") throw new Error(`${file}: invalid game mode`);
      skills.push(...resolveWeaponSkills(data, slug, mode).map(skill => ({ ...skill, weaponSlug: slug, mode, draft: data.draft === true })));
    }
  }
  const registry = parseModifierProviderRegistry(JSON.parse(fs.readFileSync(path.join(root, "data/modifier-providers.json"), "utf8")));
  validateSkillProviders(skills, registry);
  const variants: IndexedSkillVariant[] = [];
  for (const file of collectMdx(path.join(root, "data/perks"))) {
    const { data } = matter(fs.readFileSync(file, "utf8"));
    if (data.skill_variants === undefined) continue;
    if (data.draft === true) continue;
    const slug = path.relative(path.join(root, "data/perks"), file).replaceAll("\\", "/").replace(/\.mdx$/, "");
    variants.push(...projectSkillVariants(resolvePerkSkillVariants(data.skill_variants, data.season), {
      perkItemId: String(data.id), perkSlug: slug, channel: "current",
    }, skills));
  }
  // Preview variants are frozen alongside published perks. Never re-resolve them
  // against current raw rows or unpublished preview MDX during index generation.
  const preview = JSON.parse(fs.readFileSync(path.join(root, "data/perk-preview/preview.json"), "utf8"));
  for (const entry of preview?.entries ?? []) {
    const references = entry.metadata?.skill_variants;
    const published: ResolvedSkillVariant[] | undefined = entry.perk?.skillVariants;
    if (references === undefined && published === undefined) continue;
    if (!Array.isArray(references) || !Array.isArray(published) || references.length !== published.length) throw new Error(`Unpublished preview skill variants: ${entry.perk?.slug}`);
    references.forEach((reference: unknown, position: number) => {
      if (JSON.stringify(skillVariantReferenceSchema.parse(reference)) !== JSON.stringify(skillVariantReferenceSchema.parse(published[position].reference))) throw new Error(`Preview skill reference mismatch: ${entry.perk.slug}`);
    });
    if (entry.perk.season !== preview.season.key) throw new Error(`Preview skill season mismatch: ${entry.perk.slug}`);
    variants.push(...projectSkillVariants(published, {
      perkItemId: String(entry.perk.itemId), perkSlug: entry.perk.slug, channel: preview.season.key,
    }, skills));
  }
  return {
    schema_version: 1,
    skills,
    variants,
  };
}

export function writeSkillIndex() {
  const index = createSkillIndex();
  fs.writeFileSync(SKILL_INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

export function checkSkillIndex() {
  const expected = JSON.stringify(createSkillIndex());
  if (!fs.existsSync(SKILL_INDEX_PATH) || JSON.stringify(JSON.parse(fs.readFileSync(SKILL_INDEX_PATH, "utf8"))) !== expected) throw new Error("Num skill index is stale; run pnpm num-skills:project");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] === "write") {
      const index = writeSkillIndex();
      console.log(`Num skill index: ${index.skills.length} mode skills, ${index.variants.length} variants.`);
    } else if (process.argv[2] === "check") {
      checkSkillIndex();
      console.log("Num skill index is current; all weapon skill references and providers are covered.");
    } else throw new Error("Usage: tsx scripts/num-skills/project.ts <write|check>");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
