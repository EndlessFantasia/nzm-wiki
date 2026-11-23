import rawHuntingTacticalSkills from "@/data/guides/hunting-tactical-skills.json";

export type HuntingTacticalSkillAvailability = "permanent" | "limited";

type TacticalCatalogEntry = {
  id: number;
  name: string;
  description: string;
  icon: string;
};

export type HuntingTacticalSkill = TacticalCatalogEntry & {
  availability: HuntingTacticalSkillAvailability;
};

type StarshipTacticalItem = TacticalCatalogEntry & {
  slug: string;
};

type RawHuntingTacticalSkillData = {
  schemaVersion: 1;
  skills: HuntingTacticalSkill[];
  starshipItems: StarshipTacticalItem[];
};

function assertHuntingTacticalSkillData(
  value: unknown,
): asserts value is RawHuntingTacticalSkillData {
  if (!value || typeof value !== "object") {
    throw new Error("猎场战术技能数据无效");
  }

  const data = value as Partial<RawHuntingTacticalSkillData>;
  if (
    data.schemaVersion !== 1 ||
    !Array.isArray(data.skills) ||
    !Array.isArray(data.starshipItems)
  ) {
    throw new Error("猎场战术技能顶层数据无效");
  }

  const ids = new Set<number>();
  const names = new Set<string>();

  for (const entry of [...data.skills, ...data.starshipItems]) {
    if (
      !entry ||
      !Number.isInteger(entry.id) ||
      ids.has(entry.id) ||
      typeof entry.name !== "string" ||
      entry.name.length === 0 ||
      names.has(entry.name) ||
      typeof entry.description !== "string" ||
      entry.description.length === 0 ||
      typeof entry.icon !== "string" ||
      !entry.icon.startsWith("/")
    ) {
      throw new Error("猎场战术技能条目无效");
    }

    ids.add(entry.id);
    names.add(entry.name);
  }

  if (
    data.skills.some(
      ({ availability }) =>
        availability !== "permanent" && availability !== "limited",
    )
  ) {
    throw new Error("猎场战术技能解锁数据无效");
  }

  const slugs = new Set<string>();
  for (const { slug } of data.starshipItems) {
    if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slugs.has(slug)) {
      throw new Error("星舰战术道具详情路径无效");
    }
    slugs.add(slug);
  }
}

assertHuntingTacticalSkillData(rawHuntingTacticalSkills);

export const HUNTING_TACTICAL_SKILLS: readonly HuntingTacticalSkill[] =
  rawHuntingTacticalSkills.skills;

export const STARSHIP_TACTICAL_ITEMS: readonly StarshipTacticalItem[] =
  rawHuntingTacticalSkills.starshipItems;

export const HUNTING_TACTICAL_SKILLS_PATH = "/posts/hunting-tactical-skills";
