import rawIndex from "@/data/num-skill-index.json";
import type { ResolvedNumSkill } from "@/lib/num-skill";

export interface IndexedWeaponSkill extends ResolvedNumSkill {
  weaponSlug: string;
  mode: "lc" | "td";
  draft: boolean;
}

interface IndexedSkillVariantBase extends ResolvedNumSkill {
  perkItemId: string;
  perkSlug: string;
  channel: string;
  variantKey: string;
}
export type IndexedSkillVariant = IndexedSkillVariantBase & (
  { weaponSlug: string; baseSkillId: string; originalId: number; operation: "replace" | "modify" } |
  { scope: "all-weapons-active"; operation: "replace" }
);

export interface NumSkillIndex {
  schema_version: 1;
  skills: IndexedWeaponSkill[];
  variants: IndexedSkillVariant[];
}

/** Lightweight projection only: no raw game tables or server resolver imports. */
export function createSkillIndexQueries(index: NumSkillIndex) {
  if (index.schema_version !== 1) throw new Error("Unsupported Num skill index");
  const byIdentity = new Map<string, IndexedWeaponSkill>();
  const byModifier = new Map<string, IndexedWeaponSkill[]>();
  for (const skill of index.skills) {
    const key = `${skill.weaponSlug}/${skill.mode}/${skill.id}`;
    if (byIdentity.has(key)) throw new Error(`Duplicate indexed skill: ${key}`);
    if (skill.mode !== "lc" && skill.mode !== "td") throw new Error(`Invalid indexed mode: ${key}`);
    byIdentity.set(key, skill);
    for (const provider of skill.modifierSources) {
      const previous = byModifier.get(provider) ?? [];
      if (previous.includes(skill)) throw new Error(`Duplicate indexed modifier relation: ${key}/${provider}`);
      previous.push(skill);
      byModifier.set(provider, previous);
    }
  }
  const variantKeys = new Set<string>();
  for (const variant of index.variants) {
    const target = "scope" in variant ? variant.scope : `${variant.weaponSlug}/${variant.baseSkillId}`;
    const key = `${variant.channel}/${variant.perkItemId}/${target}`;
    if (variantKeys.has(key)) throw new Error(`Duplicate indexed replacement: ${key}`);
    variantKeys.add(key);
    if ("scope" in variant) {
      if (variant.scope !== "all-weapons-active" || variant.operation !== "replace" || variant.kind !== "active" || !variant.gameSkillId ||
          "weaponSlug" in variant || "baseSkillId" in variant || "originalId" in variant) throw new Error(`Invalid indexed replacement scope: ${key}`);
      continue;
    }
    const bases = index.skills.filter(skill => skill.weaponSlug === variant.weaponSlug && skill.id === variant.baseSkillId);
    if (!["replace", "modify"].includes(variant.operation) || variant.kind !== "active" || !variant.gameSkillId || !bases.length ||
        bases.some(base => base.kind !== "active" || base.gameSkillId !== variant.originalId || (variant.operation === "modify") !== (base.gameSkillId === variant.gameSkillId))) {
      throw new Error(`Invalid indexed replacement base: ${key}`);
    }
  }
  return {
    getWeaponSkill(slug: string, mode: "lc" | "td", id: string) {
      return byIdentity.get(`${slug}/${mode}/${id}`);
    },
    getSkillVariantsForWeapon(slug: string, mode?: "lc" | "td", skillId?: string, channel?: string) {
      return index.variants.filter(variant => "scope" in variant
        ? (channel === undefined || variant.channel === channel) && index.skills.some(skill => skill.weaponSlug === slug && skill.kind === "active" &&
          (mode === undefined || skill.mode === mode) && (skillId === undefined || skill.id === skillId))
        : variant.weaponSlug === slug &&
        (skillId === undefined || variant.baseSkillId === skillId) &&
        (channel === undefined || variant.channel === channel) &&
        (mode === undefined || byIdentity.has(`${slug}/${mode}/${variant.baseSkillId}`)));
    },
    getSkillsForModifier(providerId: string) {
      return [...(byModifier.get(providerId) ?? [])];
    },
  };
}

const queries = createSkillIndexQueries(rawIndex as NumSkillIndex);
export const getWeaponSkill = queries.getWeaponSkill;
export const getSkillVariantsForWeapon = queries.getSkillVariantsForWeapon;
export const getSkillsForModifier = queries.getSkillsForModifier;
