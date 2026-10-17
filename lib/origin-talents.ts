export type OriginTalentBranchId = 1 | 2 | 3 | 4;

export interface OriginTalent {
  id: string;
  name: string;
  description: string;
  branchId: OriginTalentBranchId;
  row: number;
  icon: string;
  maxLevel: number;
  prerequisites: { id: string; level: number }[];
  requiredTotalLevels: number;
  levels: { level: number; description: string; cost: number; sourceRow: string; affixId: number }[];
}

export interface OriginTalentCatalog {
  schemaVersion: 1;
  branches: { id: Exclude<OriginTalentBranchId, 4>; name: string }[];
  talents: OriginTalent[];
}

export type OriginTalentLevels = Record<string, number>;

export interface OriginTalentUnlockedRune {
  id: string;
  name: string;
  quality: 3 | 4 | 5;
  icon: string;
}

function countOtherLevels(talentId: string, levels: OriginTalentLevels) {
  return Object.entries(levels).reduce((sum, [id, level]) => id === talentId ? sum : sum + level, 0);
}

export function isOriginTalentUnlocked(talent: OriginTalent, levels: OriginTalentLevels) {
  return talent.prerequisites.every((prerequisite) => (levels[prerequisite.id] ?? 0) >= prerequisite.level) &&
    countOtherLevels(talent.id, levels) >= talent.requiredTotalLevels;
}

function removeInvalidLevels(talents: readonly OriginTalent[], levels: OriginTalentLevels) {
  const next = { ...levels };
  let changed = true;
  while (changed) {
    changed = false;
    for (const talent of talents) {
      if (!next[talent.id] || isOriginTalentUnlocked(talent, next)) continue;
      delete next[talent.id];
      changed = true;
    }
  }
  return next;
}

export function setOriginTalentLevel(talents: readonly OriginTalent[], levels: OriginTalentLevels, id: string, level: number) {
  const talent = talents.find((item) => item.id === id);
  if (!talent || !Number.isInteger(level)) return levels;
  const target = Math.min(Math.max(level, 0), talent.maxLevel);
  if (target === (levels[id] ?? 0)) return levels;
  if (target > 0 && !isOriginTalentUnlocked(talent, levels)) return levels;
  const next = { ...levels };
  if (target === 0) delete next[id];
  else next[id] = target;
  return removeInvalidLevels(talents, next);
}

export function restoreOriginTalentLevels(talents: readonly OriginTalent[], saved: unknown): OriginTalentLevels {
  if (!saved || typeof saved !== "object" || (saved as { version?: unknown }).version !== 1) return {};
  const raw = (saved as { levels?: unknown }).levels;
  if (!raw || typeof raw !== "object") return {};
  const ordered = [...talents].sort((a, b) => a.row - b.row || Number(a.id) - Number(b.id));
  return ordered.reduce<OriginTalentLevels>((levels, talent) => {
    const level = (raw as Record<string, unknown>)[talent.id];
    return typeof level === "number" ? setOriginTalentLevel(talents, levels, talent.id, level) : levels;
  }, {});
}

export function getOriginTalentCost(talent: OriginTalent, level: number) {
  return talent.levels.reduce((sum, item) => item.level <= level ? sum + item.cost : sum, 0);
}

export function getOriginTalentTotals(talents: readonly OriginTalent[], levels: OriginTalentLevels) {
  return talents.reduce((totals, talent) => {
    const level = levels[talent.id] ?? 0;
    return {
      level: totals.level + level,
      cost: totals.cost + getOriginTalentCost(talent, level),
      maxLevel: totals.maxLevel + talent.maxLevel,
      maxCost: totals.maxCost + getOriginTalentCost(talent, talent.maxLevel),
    };
  }, { level: 0, cost: 0, maxLevel: 0, maxCost: 0 });
}

const unlockPattern = /^解锁限定强化[:：](.+)$/;

export function getOriginTalentUnlockedRuneNames(talent: OriginTalent) {
  const match = unlockPattern.exec(talent.description.trim());
  return match ? match[1].split(/[、,，]/).map((name) => name.trim()).filter(Boolean) : [];
}

export function resolveOriginTalentUnlockedRunes(talents: readonly OriginTalent[],
  runes: readonly OriginTalentUnlockedRune[]): Record<string, OriginTalentUnlockedRune[]> {
  const byName = new Map<string, OriginTalentUnlockedRune[]>();
  for (const rune of runes) byName.set(rune.name, [...byName.get(rune.name) ?? [], rune]);
  return Object.fromEntries(talents.flatMap((talent) => {
    const resolved = getOriginTalentUnlockedRuneNames(talent).flatMap((name) => {
      const matches = byName.get(name);
      return matches?.length === 1 ? [{ id: matches[0].id, name, quality: matches[0].quality, icon: matches[0].icon }] : [];
    });
    return resolved.length ? [[talent.id, resolved]] : [];
  }));
}
