import assert from "node:assert/strict";
import test from "node:test";
import overlimitCatalog from "@/data/overlimit/current.json";
import {
  NUM_MODIFIER_LOCK,
  NUM_MODIFIER_RESOLVER,
  getPerkModifierResolver,
} from "@/lib/num-modifier-data";
import {
  NumModifierError,
  createNumModifierResolver,
} from "@/lib/num-modifier";
import type { NumModifierDataLock } from "@/lib/num-modifier-data-lock";

test("multi-shot uses its reviewed coefficient as damage per extra projectile", () => {
  const expression = { row: "lc:130000001_1_0", field: "coefficient" } as const;
  const effect = NUM_MODIFIER_RESOLVER.resolveEffect(expression, { recipient: "damage-event" });
  assert.equal(effect.value.value, 1);
  assert.equal(effect.reviewed, true);
  assert.equal(effect.factor, 2);
  assert.equal(effect.direction, "increase");
  assert.deepEqual(effect.facets.map(facet => [facet.id, facet.consumer]), [["correction", "damage"]]);
  assert.equal(NUM_MODIFIER_RESOLVER.resolveValue(expression, "signed-percent").text, "+100%");
  assert.throws(() => NUM_MODIFIER_RESOLVER.resolveEffect(expression, { recipient: "self" }), NumModifierError);
  const card = overlimitCatalog.cards.find(card => card.id === "1317100001")!;
  assert.equal(card.description, "单次开火每多1个弹道，伤害提升100%。");
  assert.deepEqual(card.effectValues, [{ kind: "damage", modifierTypeId: "correction", label: "伤害增加",
    stages: [{ condition: "单次开火每多1个弹道", value: "+100%" }] }]);
  assert.equal("verification" in card, false);
});

test("last shot uses its explicit reviewed correction rule", () => {
  const effect = getPerkModifierResolver("s4").resolveEffect(
    { row: "lc:130008001_1_0", field: "base" }, { recipient: "damage-event" },
  );
  assert.equal(effect.value.value, 6);
  assert.equal(effect.reviewed, true);
  assert.equal(effect.factor, 7);
  assert.deepEqual(effect.facets.map(facet => facet.id), ["correction"]);
});

test("locks the complete LC modifier table", () => {
  assert.equal(NUM_MODIFIER_LOCK.sources.lc.modifiers.row_count, Object.keys(NUM_MODIFIER_LOCK.rows.lc).length);
  assert.equal(
    NUM_MODIFIER_LOCK.sources.lc.attribute_descriptions.row_count,
    Object.keys(NUM_MODIFIER_LOCK.attribute_descriptions.lc).length,
  );
});

test("uses exact row names and retains multiple rows for one modifier ID", () => {
  const rows = NUM_MODIFIER_RESOLVER.getRowsById("lc", 111010076);
  assert.deepEqual(
    rows.map((row) => row.key),
    ["lc:111010076_1_0", "lc:111010076_1_1"],
  );
  assert.equal(rows[0].attributeName, "GPAttributeSetCritical.CriticalRatio");
  assert.equal(rows[1].attributeName, "GPAttributeSetCritical.CriticalDamageRatio");
});

test("locks AttributeDescMapTable and resolves canonical attribute semantics", () => {
  const attribute = NUM_MODIFIER_RESOLVER.describeAttribute(
    "GPAttributeSetCritical.CriticalRatio",
  );
  assert.equal(attribute.typeId, "critical-rate");
  assert.equal(attribute.label, "暴击率");
  assert.equal(attribute.disposition, "indexed");
  assert.equal(attribute.descriptor?.attr_realname, attribute.attributeName);
});

test("resolves direction, facets, scopes, and reviewed row semantics", () => {
  const toughness = NUM_MODIFIER_RESOLVER.resolveEffect({
    row: "lc:111010083_1_0",
    field: "base",
  });
  assert.equal(toughness.value.value, 0.125);
  assert.equal(toughness.direction, "increase");
  assert.deepEqual(toughness.facets.map((facet) => facet.id), [
    "toughness-efficiency",
  ]);

  const slow = NUM_MODIFIER_RESOLVER.resolveEffect(
    { row: "lc:100200001_1_0", field: "base" },
    { recipient: "enemy" },
  );
  assert.equal(slow.direction, "decrease");
  assert.deepEqual(slow.facets.map((facet) => facet.id), ["slow"]);

  const unknown = NUM_MODIFIER_RESOLVER.resolveEffect(
    { row: "lc:100000002_1_0", field: "base" },
    { recipient: "enemy" },
  );
  assert.equal(unknown.operation.model, "unknown");
  assert.equal(unknown.direction, "unknown");
  assert.deepEqual(unknown.facets, []);

  const slug = NUM_MODIFIER_RESOLVER.resolveEffect(
    { row: "lc:111031014_1_0", field: "base" },
    { recipient: "damage-event" },
  );
  assert.equal(slug.reviewed, true);
  assert.equal(slug.factor, 7);
  assert.deepEqual(slug.facets.map((facet) => facet.id), ["correction"]);
});

test("uses row_name as the authoritative modifier identity", () => {
  assert.deepEqual(
    NUM_MODIFIER_RESOLVER.getRowsById("lc", 111010094).map((row) => row.key),
    ["lc:111010094_1_0", "lc:111010094_1_1"],
  );
  assert.equal(NUM_MODIFIER_RESOLVER.getRow("lc:111010094_1_1").id, 111010094);
  assert.equal(
    NUM_MODIFIER_RESOLVER.getRowsById("lc", 111010096).some(
      (row) => row.key === "lc:111010094_1_1",
    ),
    false,
  );
});

test("resolves base, coefficient and scaled percentages", () => {
  assert.equal(
    NUM_MODIFIER_RESOLVER.resolveValue(
      { row: "lc:111010054_1_0", field: "base" },
      "percent",
    ).text,
    "2.5%",
  );
  assert.equal(
    NUM_MODIFIER_RESOLVER.resolveValue(
      { row: "lc:111010062_1_0", field: "coefficient", scale: 80 },
      "signed-percent",
    ).text,
    "+32%",
  );
  assert.throws(
    () =>
      NUM_MODIFIER_RESOLVER.resolveValue(
        { row: "lc:111010062_1_0", field: "coefficient", scale: -1 },
        "percent",
      ),
    /INVALID_EXPRESSION/,
  );
});

test("resolves strict project templates", () => {
  const result = NUM_MODIFIER_RESOLVER.resolveTemplate(
    "每层**{{num:weakness-per-stack|percent}}**，六层**{{num:weakness-max|percent}}**。",
    {
      "weakness-per-stack": {
        row: "lc:111010061_1_0",
        field: "base",
      },
      "weakness-max": {
        row: "lc:111010061_1_0",
        field: "base",
        scale: 6,
      },
    },
  );
  assert.equal(result, "每层**7%**，六层**42%**。");
  assert.throws(
    () => NUM_MODIFIER_RESOLVER.resolveTemplate("{{num:missing|percent}}", {}),
    (error) => error instanceof NumModifierError && error.code === "INVALID_TEMPLATE",
  );
});

test("resolves original game GPModifier tokens through the same Lock", () => {
  const result = NUM_MODIFIER_RESOLVER.resolveGameModifierTokens(
    "获得{GPModifier:111010054:BaseValue:0:2:1}的增伤。",
  );
  assert.equal(result.text, "获得2.5%的增伤。");
  assert.deepEqual(result.unresolvedTokens, []);
});

test("original GPModifier tokens default to level one", () => {
  assert.deepEqual(
    NUM_MODIFIER_RESOLVER.resolveGameModifierTokens(
      "{GPModifier:111010061:BaseValue:0:2}",
    ),
    {
      text: "7%",
      unresolvedTokens: [],
    },
  );
});

test("original GPModifier tokens honor an explicit level", () => {
  assert.deepEqual(
    NUM_MODIFIER_RESOLVER.resolveGameModifierTokens(
      "{GPModifier:100200001:BaseValue:1:2:2}",
    ),
    {
      text: "-15%",
      unresolvedTokens: [],
    },
  );
});

test("invalid value fields and missing or ambiguous game tokens fail closed", () => {
  assert.throws(
    () =>
      NUM_MODIFIER_RESOLVER.resolveValue(
        {
          row: "lc:111010061_1_0",
          field: "description" as "base",
        },
        "percent",
        "test#invalid-field",
      ),
    /INVALID_EXPRESSION.*test#invalid-field/,
  );
  assert.deepEqual(
    NUM_MODIFIER_RESOLVER.resolveGameModifierTokens(
      "{GPModifier:999999999:BaseValue:0:2}",
    ).unresolvedTokens,
    ["{GPModifier:999999999:BaseValue:0:2}"],
  );

  const source = NUM_MODIFIER_LOCK.rows.lc["111010061_1_0"];
  const duplicateRowName = "111010061_1_00";
  const ambiguousResolver = createNumModifierResolver({
    ...NUM_MODIFIER_LOCK,
    sources: {
      lc: {
        ...NUM_MODIFIER_LOCK.sources.lc,
        modifiers: {
          ...NUM_MODIFIER_LOCK.sources.lc.modifiers,
          row_count: NUM_MODIFIER_LOCK.sources.lc.modifiers.row_count + 1,
        },
      },
    },
    rows: {
      lc: {
        ...NUM_MODIFIER_LOCK.rows.lc,
        [duplicateRowName]: {
          row_name: duplicateRowName,
          raw: source.raw,
        },
      },
    },
  } as NumModifierDataLock);
  assert.deepEqual(
    ambiguousResolver.resolveGameModifierTokens(
      "{GPModifier:111010061:BaseValue:0:2}",
    ).unresolvedTokens,
    ["{GPModifier:111010061:BaseValue:0:2}"],
  );
});
