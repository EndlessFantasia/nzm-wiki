import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createSkillIndexQueries, type IndexedWeaponSkill, type NumSkillIndex } from "../../lib/num-skill-index";
import type { NumSkillDefinition, ResolvedSkillVariant } from "../../lib/num-skill";
import { parseModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import { checkSkillIndex, createSkillIndex, projectSkillVariants, validateSkillMarkup, validateSkillProviders } from "./project";

test("skill index ignores prose, unrelated weapon metadata and checkout line endings", (t) => {
  const snapshot = createSkillIndex();
  const readFile = fs.readFileSync;
  function project(lineEnding: string, changeContent = false) {
    const read = t.mock.method(fs, "readFileSync", (...args: Parameters<typeof fs.readFileSync>) => {
      const content = readFile(...args);
      if (typeof args[0] !== "string" || !/\.(mdx|json)$/.test(args[0])) return content;
      if (args[0].endsWith("num-skill-index.json")) return JSON.stringify(snapshot);
      let text = content.toString().replace(/\r\n/g, "\n").replace(/\n/g, lineEnding);
      if (changeContent && args[0].endsWith("Bully.mdx")) {
        text = text.replace("accuracy: 75", "accuracy: 76").replace("召唤一台无人机", "召唤无人机");
        text += `${lineEnding}<!-- changed -->${lineEnding}`;
      }
      return typeof content === "string" ? text : Buffer.from(text);
    });
    try {
      checkSkillIndex();
      return createSkillIndex();
    }
    finally { read.mock.restore(); }
  }
  const lf = project("\n");
  assert.deepEqual(project("\r\n"), lf);
  assert.deepEqual(project("\n", true), lf);
  assert.deepEqual(project("\r\n", true), lf);
});

test("skill index still rejects changed skill parameters and invalid body references", (t) => {
  const snapshot = createSkillIndex();
  const readFile = fs.readFileSync;
  for (const [before, after, error] of [
    ["literal: -1", "literal: 5", /index is stale/],
    ['<ActiveSkill skill="active-1">', '<ActiveSkill skill="missing">', /missing or hidden skill/],
  ] as const) {
    const read = t.mock.method(fs, "readFileSync", (...args: Parameters<typeof fs.readFileSync>) => {
      const content = readFile(...args);
      if (typeof args[0] !== "string") return content;
      if (args[0].endsWith("num-skill-index.json")) return JSON.stringify(snapshot);
      if (!args[0].endsWith("Bully.mdx")) return content;
      const text = content.toString().replace(before, after);
      assert.notEqual(text, content.toString());
      return typeof content === "string" ? text : Buffer.from(text);
    });
    try { assert.throws(() => checkSkillIndex(), error); }
    finally { read.mock.restore(); }
  }
});

const active: NumSkillDefinition = { id: "active", kind: "active", name: "力场", icon: "/icon.png", game_skill_id: 1001 };
const passive: NumSkillDefinition = { id: "passive", kind: "passive", name: "充能", icon: "/icon.png" };
const base: IndexedWeaponSkill = {
  id: "active", kind: "active", name: "力场", icon: "/icon.png", gameSkillId: 1001,
  display: true, parameters: { cooldown: 40 }, modifierSources: ["weapon:test:力场"],
  provenance: {}, weaponSlug: "test", mode: "lc", draft: false,
};
const replacement: ResolvedSkillVariant = {
  reference: { weapon_slug: "test", base_skill: "active", variant: "s4-replacement", operation: "replace" },
  original: { id: 1001, name: "力场" },
  skill: {
    id: "replacement", kind: "active", name: "强化力场", gameSkillId: 1002,
    display: true, parameters: { cooldown: 30, blocking: false }, modifierSources: [],
    provenance: { cooldown: { row: "s4-preview:pve:1002_1", field: "ChargeNeedTime" } },
  },
};
const context = { perkItemId: "2001", perkSlug: "preview/slot-4/强化", channel: "s4-preview" };

test("migration validates every visible skill while preserving nested mode-specific bodies", () => {
  const body = '<ActiveSkill skill="active"><GameMode only="lc">150%</GameMode><GameMode only="td">105%</GameMode></ActiveSkill>\n<PassiveSkill skill="passive">充能</PassiveSkill>';
  assert.equal(validateSkillMarkup(body, [active, passive], "weapon"), 2);
  assert.equal(validateSkillMarkup("", [{ ...active, display: false }], "weapon"), 0);
  for (const broken of [
    '<ActiveSkill skill="active" duration={10}>旧值</ActiveSkill>',
    '<ActiveSkill name="力场">旧名称</ActiveSkill>',
    '<ActiveSkill skill={"active"}>动态引用</ActiveSkill>',
    '<ActiveSkill skill="missing" />',
    '<PassiveSkill skill="active" />',
    '<ActiveSkill skill="active" /><ActiveSkill skill="active" />',
    "",
  ]) assert.throws(() => validateSkillMarkup(broken, [active], "weapon"));
  assert.throws(() => validateSkillMarkup('<ActiveSkill skill="active" />', [{ ...active, display: false }], "weapon"), /hidden/);
});

test("provider migration cannot silently lose an existing source or attach it to another skill", () => {
  const registry = parseModifierProviderRegistry({
    schemaVersion: 1, evidencePriority: ["identity"],
    providers: [{ id: "weapon:test:力场", label: "test·力场", source: { type: "weapon", slug: "test", skillName: "力场", component: "ActiveSkill" },
      applications: [{ expression: { row: "lc:1_1_0", field: "base" }, context: { recipient: "self" } }], evidence: { kind: "gp-modifier" } }],
    exclusions: [],
  });
  validateSkillProviders([base, { ...base, mode: "td" }], registry);
  assert.throws(() => validateSkillProviders([{ ...base, modifierSources: [] }], registry), /Unreferenced/);
  assert.throws(() => validateSkillProviders([{ ...base, name: "另一技能" }], registry), /invalid modifier provider/);
  assert.throws(() => validateSkillProviders([base, { ...base, mode: "td", modifierSources: [] }], registry), /Unreferenced/);
});

test("published replacement projection rejects channel leakage, missing bases and repeated replacements", () => {
  const result = projectSkillVariants([replacement], context, [base]);
  assert.equal(result[0].parameters.cooldown, 30);
  assert.equal(result[0].channel, "s4-preview");
  assert.throws(() => projectSkillVariants([replacement], { ...context, channel: "current" }, [base]), /Cross-channel/);
  assert.throws(() => projectSkillVariants([replacement], context, []), /base/);
  assert.throws(() => projectSkillVariants([replacement, replacement], context, [base]), /Duplicate/);
  assert.throws(() => projectSkillVariants([{ ...replacement, original: { id: 999, name: "错绑" } }], context, [base]), /base/);
});

test("explicit current and preview fixtures stay isolated without configured preview", () => {
  const current: ResolvedSkillVariant = {
    ...replacement,
    skill: { ...replacement.skill, provenance: { cooldown: { row: "current:pve:1002_1", field: "ChargeNeedTime" } } },
  };
  const currentContext = { ...context, perkSlug: "slot-4/强化", channel: "current" };
  const query = createSkillIndexQueries({
    schema_version: 1, skills: [base],
    variants: [...projectSkillVariants([current], currentContext, [base]), ...projectSkillVariants([replacement], context, [base])],
  });
  assert.equal(query.getSkillVariantsForWeapon("test", "lc", "active", "current").length, 1);
  assert.equal(query.getSkillVariantsForWeapon("test", "lc", "active", "s4-preview").length, 1);
  assert.throws(() => projectSkillVariants([current], context, [base]), /Cross-channel/);
});

test("reverse queries retain both modes and diagnose broken index relationships", () => {
  const index: NumSkillIndex = {
    schema_version: 1,
    skills: [base, { ...base, mode: "td", parameters: { cooldown: 50 } }],
    variants: projectSkillVariants([replacement], context, [base]),
  };
  const query = createSkillIndexQueries(index);
  assert.equal(query.getWeaponSkill("test", "td", "active")?.parameters.cooldown, 50);
  assert.equal(query.getWeaponSkill("missing", "lc", "active"), undefined);
  assert.equal(query.getSkillsForModifier("weapon:test:力场").length, 2);
  assert.equal(query.getSkillVariantsForWeapon("test", "td", "active").length, 1);
  assert.equal(query.getSkillVariantsForWeapon("test", "lc", "passive").length, 0);
  assert.equal(query.getSkillVariantsForWeapon("test", "lc", "active", "current").length, 0);
  assert.throws(() => createSkillIndexQueries({ ...index, skills: [base, base] }), /Duplicate/);
  assert.throws(() => createSkillIndexQueries({ ...index, skills: [] }), /replacement base/);
  assert.throws(() => createSkillIndexQueries({ ...index, variants: [...index.variants, ...index.variants] }), /Duplicate/);
});

test("generic replacement stays one edge and only applies to real active skills", () => {
  const generic: ResolvedSkillVariant = {
    ...replacement,
    reference: { scope: "all-weapons-active", variant: "s4-generic", operation: "replace" },
    original: { scope: "all-weapons-active", name: "武器主动技能" },
  };
  const projected = projectSkillVariants([generic], context, [base]);
  assert.equal(projected.length, 1);
  assert.ok("scope" in projected[0]);
  assert.equal("weaponSlug" in projected[0], false);
  const query = createSkillIndexQueries({ schema_version: 1, skills: [base, { ...base, id: "passive", kind: "passive" }], variants: projected });
  assert.equal(query.getSkillVariantsForWeapon("test", "lc", "active", "s4-preview").length, 1);
  for (const args of [["missing"], ["test", "td"], ["test", "lc", "passive"], ["test", "lc", "active", "current"]] as const) {
    assert.equal(query.getSkillVariantsForWeapon(...args).length, 0);
  }
  assert.throws(() => projectSkillVariants([generic, generic], context, [base]), /Duplicate/);
  assert.throws(() => projectSkillVariants([{ ...generic, original: { id: 1001, name: "力场" } }], context, [base]), /base/);
});

test("modify keeps skill identity and replace must change it", () => {
  const modified: ResolvedSkillVariant = { ...replacement, reference: { weapon_slug: "test", base_skill: "active", variant: "modified", operation: "modify" }, skill: { ...replacement.skill, gameSkillId: 1001, provenance: {} } };
  const variants = projectSkillVariants([modified], context, [base]);
  const index: NumSkillIndex = { schema_version: 1, skills: [base], variants };
  assert.equal(createSkillIndexQueries(index).getSkillVariantsForWeapon("test").length, 1);
  assert.throws(() => projectSkillVariants([{ ...modified, skill: replacement.skill }], context, [base]), /base/);
  assert.throws(() => createSkillIndexQueries({ ...index, variants: [{ ...variants[0], operation: "replace" }] }), /base/);
});
