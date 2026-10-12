import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import matter from "gray-matter";
import { runtimeBindingSchema, runtimeBindingsSchema, resolveRuntimeDuration } from "../../lib/num-skill-runtime";
import { NUM_SKILL_LOCK } from "../../lib/num-skill-lock";
import { resolveNumSkill, resolvedNumSkillSchema } from "../../lib/num-skill";
import { resolveWeaponSkills } from "../../lib/num-skill-data";
import { auditRuntimeBinding } from "./audit-runtime";

const key = "weapons:5102001:duration";
const binding = NUM_SKILL_LOCK.runtime![key];
const context = { channel: "weapons", gameSkillId: 5102001, bindings: NUM_SKILL_LOCK.runtime };

test("audited blueprint source wins over the unrelated PVE25, conditional branch yields30", () => {
  assert.equal(resolveRuntimeDuration({ runtime: key }, { ...context, pveParameters: [{ Name: "BuffDuration", Value: 25 }] }), 20);
  assert.equal(resolveRuntimeDuration({ runtime: key, with_mge: 1312049001 }, context), 30);
  assert.throws(() => resolveRuntimeDuration({ runtime: key, with_mge: 1 }, context), /Unaudited/);
  assert.throws(() => resolveRuntimeDuration({ runtime: key }, { ...context, channel: "current" }), /channel/);
  assert.throws(() => resolveRuntimeDuration({ runtime: key }, { ...context, gameSkillId: 5001401 }), /identity/);
  assert.throws(() => resolveRuntimeDuration({ runtime: key }, { ...context, bindings: {} }), /Missing/);
});

test("runtime source requires evidence and unambiguous identities", () => {
  assert.equal(runtimeBindingSchema.safeParse({ ...binding, flow: undefined }).success, false);
  assert.equal(runtimeBindingSchema.safeParse({ ...binding, flow: { ...binding.flow, sha256: "unknown" } }).success, false);
  assert.equal(runtimeBindingSchema.safeParse({ ...binding, modifiers: [...binding.modifiers, ...binding.modifiers] }).success, false);
  assert.equal(runtimeBindingsSchema.safeParse({ [key]: { ...binding, game_skill_id: 5001401 } }).success, false);
  const skill = { id: "active-1", kind: "active", name: "浮游模式", icon: "/test.png", game_skill_id: 5102001, parameters: { duration: { runtime: key } } };
  assert.throws(() => resolveNumSkill({ ...skill, parameters: { cooldown: { runtime: key } } }, { ...context, lock: NUM_SKILL_LOCK }), /duration/);
  const resolved = resolveNumSkill(skill, { ...context, lock: NUM_SKILL_LOCK });
  assert.equal(resolvedNumSkillSchema.safeParse({ ...resolved, gameSkillId: 5001401 }).success, false);
});

test("audited PVE source fails when table evidence changes, even with matching names", () => {
  const pve = runtimeBindingSchema.parse({ ...binding, source: { kind: "weapon_parameter", row_name: "5102001_1", name: "BuffDuration", sha256: "a".repeat(64) }, modifiers: [] });
  const ctx = { ...context, bindings: { [key]: pve }, pveSourceHash: "a".repeat(64), pveParameters: [{ Name: "BuffDuration", Value: "20", Tags: ["SkillParamConfig.EffectDuration"] }] };
  assert.equal(resolveRuntimeDuration({ runtime: key }, ctx), 20);
  assert.throws(() => resolveRuntimeDuration({ runtime: key }, { ...ctx, pveSourceHash: "b".repeat(64) }), /stale/);
  assert.throws(() => resolveRuntimeDuration({ runtime: key }, { ...ctx, pveParameters: [...ctx.pveParameters, ...ctx.pveParameters] }), /Invalid/);
  assert.throws(() => resolveNumSkill({ id: "active-1", kind: "active", name: "test", icon: "/test.png", game_skill_id: 5102001, parameters: { duration: { runtime: key } } }, { ...ctx, gameSkillId: 5001401, lock: { schema_version: 1, rows: {}, runtime: { [key]: pve } } }), /context identity/);
});

test("snapshot audit rejects a same-valued foreign skill and unrelated valid read offsets", () => {
  assert.equal(binding.source.kind, "blueprint_default");
  if (binding.source.kind !== "blueprint_default") throw new Error("fixture source changed");
  const source = binding.source;
  const exports = [
    { Name: source.object, Properties: { Duration: 20, SkillID: 5102001 } },
    { Name: "GetDuration", ScriptBytecode: [
      { StatementIndex: 162, Token: "EX_InstanceVariable", Variable: { Owner: { ObjectName: "SMBlueprintGeneratedClass'SKT_FloatingMode_C'" }, Property: { Name: "Duration" } } },
      { StatementIndex: 189, Token: "EX_Return" },
    ] },
    { Name: "ExecuteUbergraph_SKT_FloatingMode", ScriptBytecode: [{ StatementIndex: 951, Token: "EX_FinalFunction" }] },
  ];
  const evidence = new Map([[source.asset, { sha256: source.sha256, exports }]]);
  const input = { ...binding, modifiers: [] };
  auditRuntimeBinding(input, evidence);
  assert.throws(() => auditRuntimeBinding({ ...input, game_skill_id: 5001401 }, evidence), /identity/);
  assert.throws(() => auditRuntimeBinding({ ...input, flow: { ...input.flow, read: { function: "GetDuration", statement: 189 } } }, evidence), /consume/);
  assert.throws(() => auditRuntimeBinding({ ...input, flow: { ...input.flow, apply: { function: "ExecuteUbergraph_SKT_FloatingMode", statement: 957 } } }, evidence), /execution location/);
});

test("天鹅之舞面板与正文12秒；心有凌兮增益保留40秒，不采用PVE27", () => {
  for (const mode of ["lc", "td"] as const) {
    const swan = resolveWeaponSkills(matter(readFileSync("data/weapons/天鹅之舞.mdx", "utf8")).data, "天鹅之舞", mode)[0];
    assert.equal(swan.parameters.duration, 12);
    assert.equal(swan.parameters.panel_duration, 12);
    assert.deepEqual(swan.provenance.duration, { runtime: "weapons:5001401:duration" });
    const dance = resolveWeaponSkills(matter(readFileSync("data/weapons/心有凌兮.mdx", "utf8")).data, "心有凌兮", mode)[0];
    assert.equal(dance.parameters.duration, 40);
  }
});

test("法阵与扩充装填使用已审计蓝图绑定，不采用未核验的同名PVE覆写", () => {
  for (const [slug, gameSkillId, duration] of [
    ["密林杀机", 5000201, 12],
    ["幽冥毒王", 5001301, 12],
    ["收割者", 5000701, 10],
  ] as const) {
    const runtime = `weapons:${gameSkillId}:duration`;
    assert.equal(NUM_SKILL_LOCK.runtime![runtime].source.kind, "blueprint_default");
    // A conflicting PVE field is not an audited input to these bindings.
    assert.equal(resolveRuntimeDuration({ runtime }, {
      channel: "weapons", gameSkillId, bindings: NUM_SKILL_LOCK.runtime,
      pveParameters: [{ Name: "BuffDuration", Value: "999" }, { Name: "FieldDuration", Value: "999" }],
    }), duration);
    const data = matter(readFileSync(`data/weapons/${slug}.mdx`, "utf8")).data;
    for (const mode of ["lc", "td"] as const) {
      const skill = resolveWeaponSkills(data, slug, mode).find(entry => entry.id === "active-1")!;
      assert.equal(skill.parameters.duration, duration);
      assert.equal(skill.parameters.panel_duration, duration);
      assert.deepEqual(skill.provenance.duration, { runtime });
      assert.deepEqual(skill.provenance.panel_duration, { runtime });
    }
  }
});
