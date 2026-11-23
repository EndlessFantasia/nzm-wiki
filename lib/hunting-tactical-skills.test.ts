import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  HUNTING_TACTICAL_SKILLS,
  HUNTING_TACTICAL_SKILLS_PATH,
  STARSHIP_TACTICAL_ITEMS,
} from "./hunting-tactical-skills";
import { getMDXDetail } from "./mdx";

const EXPECTED_SKILL_IDS = [
  30200101,
  30200201,
  30200301,
  30200401,
  30200501,
  40000300,
  40000400,
  40000401,
  40000402,
  40000500,
  40000501,
  40000502,
  30100301,
];

const DISABLED_SKILL_IDS = [
  40000301,
  40000302,
  40000600,
  40000601,
  40000602,
];

test("收录十二个当前可用技能和一个限时技能", () => {
  assert.deepEqual(
    HUNTING_TACTICAL_SKILLS.map((skill) => skill.id),
    EXPECTED_SKILL_IDS,
  );
  assert.equal(new Set(EXPECTED_SKILL_IDS).size, HUNTING_TACTICAL_SKILLS.length);

  const limitedSkills = HUNTING_TACTICAL_SKILLS.filter(
    (skill) => skill.availability === "limited",
  );
  assert.deepEqual(limitedSkills.map((skill) => skill.id), [30100301]);

  for (const id of DISABLED_SKILL_IDS) {
    assert.equal(
      HUNTING_TACTICAL_SKILLS.some((skill) => skill.id === id),
      false,
    );
  }
});

test("四件星舰战术道具均有对应详情页", () => {
  assert.deepEqual(
    STARSHIP_TACTICAL_ITEMS.map(({ id }) => id),
    [40000407, 40000408, 40000409, 40000410],
  );
  const prefix = HUNTING_TACTICAL_SKILLS_PATH.replace("/posts/", "");
  for (const { name, slug } of STARSHIP_TACTICAL_ITEMS) {
    const page = getMDXDetail("posts", `${prefix}/${slug}`);
    assert.equal(page.metadata.title, name);
    assert.ok(page.content.includes(`<StarshipTacticalItemIntro slug="${slug}" />`));
  }
});

test("全部猎场战术技能和星舰战术道具图标均已发布", () => {
  for (const skill of [...HUNTING_TACTICAL_SKILLS, ...STARSHIP_TACTICAL_ITEMS]) {
    assert.equal(path.extname(skill.icon), ".webp");

    const iconPath = path.join(
      process.cwd(),
      "public",
      skill.icon.replace(/^\//, ""),
    );
    assert.equal(fs.existsSync(iconPath), true, `${skill.name} 缺少图标`);
  }
});
