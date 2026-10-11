import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import { checkModifierRuntimeProjections, generateModifierIndexRuntime, generateMultiplierProviderRuntime } from "./project";
import { getProviderResolver } from "./provider-resolver";
import { NUM_MODIFIER_LOCK, NUM_MODIFIER_SEMANTICS } from "../../lib/num-modifier-data";
import { createNumModifierResolver } from "../../lib/num-modifier";
import { parseModifierProviderRegistry } from "../../lib/modifier-provider-registry";
import providerRegistry from "../../data/modifier-providers.json";

test("promoted weapon providers use the live resolver and reject retired preview selection", () => {
  const provider = parseModifierProviderRegistry(providerRegistry).providers.find(
    entry => entry.id === "weapon:极地夜曲:冷凝超载",
  );
  assert.ok(provider);
  const expression = provider.applications![0].expression;
  // A distinct live value proves the retired snapshot cannot override a promoted source.
  const formalLock = structuredClone(NUM_MODIFIER_LOCK);
  formalLock.rows.lc[expression.row.slice(3)].raw.BaseValue = 0.125;
  const formalResolver = createNumModifierResolver(formalLock, NUM_MODIFIER_SEMANTICS);
  const resolver = getProviderResolver(provider.source, formalResolver);
  assert.equal(resolver.getRow(expression.row).baseValue, 0.125);
  assert.throws(() => getProviderResolver({ ...provider.source, season: "s4-preview" }, formalResolver), /Missing matching preview/);
  assert.equal(formalResolver.getRow(expression.row).baseValue, 0.125);
  assert.equal(getProviderResolver({
    type: "weapon", slug: "极地夜曲", skillName: "冷凝超载", component: "ActiveSkill",
  }, formalResolver), formalResolver);
});

test("projection freshness ignores audit notes and formatting but detects published data changes", (t) => {
  const modifier = generateModifierIndexRuntime();
  const multiplier = generateMultiplierProviderRuntime(modifier);
  const readFile = fs.readFileSync;
  for (const changeLabel of [false, true]) {
    const read = t.mock.method(fs, "readFileSync", (...args: Parameters<typeof fs.readFileSync>) => {
      const content = readFile(...args);
      if (typeof args[0] !== "string") return content;
      if (args[0].endsWith("modifier-index-runtime.json")) return JSON.stringify(modifier);
      if (args[0].endsWith("multiplier-providers-runtime.json")) return JSON.stringify(multiplier);
      if (!args[0].endsWith("modifier-providers.json")) return content;
      const registry = JSON.parse(content.toString());
      registry.evidencePriority.push("audit-only note");
      if (changeLabel) registry.providers[0].label += " updated";
      return JSON.stringify(registry, null, 4).replace(/\n/g, "\r\n");
    });
    try {
      const issues = checkModifierRuntimeProjections();
      if (changeLabel) {
        assert.equal(issues.length, 2);
        assert.ok(issues.every(issue => issue.includes("is stale")));
      } else {
        assert.deepEqual(generateModifierIndexRuntime(), modifier);
        assert.deepEqual(generateMultiplierProviderRuntime(), multiplier);
        assert.deepEqual(issues, []);
      }
    } finally { read.mock.restore(); }
  }
});
