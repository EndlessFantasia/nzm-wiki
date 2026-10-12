import fs from "node:fs";
import path from "node:path";

import statusEffects from "../../data/status-effects.json";
import { pathToFileURL } from "node:url";
import { getPerkSourceEntries } from "../perks/source";
import { createNumModifierResolver } from "../../lib/num-modifier";
import { parseNumModifierSemantics } from "../../lib/num-modifier-semantics";
import { checkNumModifierDataLock, readNumModifierDataLock } from "./lock";
import { checkModifierRuntimeProjections } from "./project";
import { loadModifierProviderRegistry } from "./provider-registry";
import { getProviderResolver } from "./provider-resolver";
import { checkSkillIndex } from "../num-skills/project";
import type { NumModifierDataLock } from "../../lib/num-modifier-data-lock";
import type { NumModifierSemantics } from "../../lib/num-modifier-semantics";

const root = process.cwd();
const errors: string[] = [];

function addError(message: string): void {
  errors.push(message);
}

function walkFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(filePath) : [filePath];
  });
}

function checkStaticBoundaries(): void {
  const sourceRoots = ["app", "components", "data", "lib", "scripts", "types"];
  const files = sourceRoots
    .flatMap((directory) => walkFiles(path.join(root, directory)))
    .filter((filePath) => /\.(?:json|mdx?|[cm]?[jt]sx?)$/.test(filePath));
  const rawSourcePath = "Attributes/AutoGenerate/numerical_modifier_config.json";
  const rawAttributeDescriptionPath = "DataTables/AttributeDescMapTable.json";
  const rawSourceAllowlist = new Set([
    path.join(root, "data", "num-modifier-lock.json"),
    // Selected preview evidence records provenance without reading local sources at runtime.
    path.join(root, "data", "perk-preview-modifiers.json"),
    // Offline overlimit import/review ledgers; runtime consumes only frozen projections.
    ...["preview-cards.ts", "preview-cards.test.ts", "preview-card-source-lock.json", "preview-native-review.json", "preview-rules.ts", "preview-rules.test.ts", "preview-rules-review.json", "current-card-source-lock.json", "current-rules-review.json", "current-source-review.json"]
      .map(file => path.join(root, "scripts", "overlimit", file)),
    ...["preview.json", "preview-evidence.json", "current.json", "current-evidence.json"].map(file => path.join(root, "data", "overlimit", file)),
    path.join(root, "scripts", "perks", "promote-release.ts"),
    path.join(root, "scripts", "perks", "promotion.ts"),
    path.join(root, "scripts", "content-versions", "promotion.ts"),
    path.join(root, "scripts", "content-versions", "promotion.test.ts"),
    path.join(root, "data", "modifier-providers.json"),
    // Maintenance-only local review records provenance; no runtime raw-table reads.
    path.join(root, "scripts", "s4-perk-index-review.json"),
    path.join(root, "scripts", "num-modifier", "lock.ts"),
    // Historical S2 is isolated from the current-season lock; only its offline
    // extractor and evidence ledger may name the archived Numerical source.
    path.join(root, "scripts", "s2-season-talents", "extract.ts"),
    path.join(root, "data", "season-talents", "s2", "evidence.json"),
    path.join(root, "data", "season-talents", "s2", "provider-evidence.json"),
    path.join(root, "scripts", "s2-season-talents", "providers.ts"),
  ]);
  const directLockImport = /(?:from\s+|require\s*\(\s*)["'][^"']*num-modifier-lock\.json["']/;
  const directLockAllowlist = new Set([
    path.join(root, "lib", "num-modifier-data.ts"),
  ]);
  const directRuntimeImport =
    /(?:from\s+|require\s*\(\s*)["'][^"']*modifier-index-runtime\.json["']/;
  const directRuntimeAllowlist = new Set([
    path.join(root, "lib", "modifier-index.ts"),
  ]);
  const thisFile = path.resolve(__filename);
  const searchIndexFile = path.join(root, "scripts", "generate-search-index.ts");

  for (const filePath of files) {
    if (path.resolve(filePath) === thisFile) continue;
    const source = fs.readFileSync(filePath, "utf8");
    if (source.includes(rawSourcePath) && !rawSourceAllowlist.has(filePath)) {
      addError(
        `${path.relative(root, filePath)} directly references the raw Num Modifier table`,
      );
    }
    if (
      source.includes(rawAttributeDescriptionPath) &&
      !rawSourceAllowlist.has(filePath)
    ) {
      addError(
        `${path.relative(root, filePath)} directly references AttributeDescMapTable`,
      );
    }
    if (
      source.includes("data/guides/multiplier-providers.json") &&
      !filePath.endsWith("migrate-provider-registry.ts")
    ) {
      addError(`${path.relative(root, filePath)} references the retired provider registry`);
    }
    if (directLockImport.test(source) && !directLockAllowlist.has(filePath)) {
      addError(
        `${path.relative(root, filePath)} directly imports num-modifier-lock.json`,
      );
    }
    if (
      directRuntimeImport.test(source) &&
      !directRuntimeAllowlist.has(filePath)
    ) {
      addError(
        `${path.relative(root, filePath)} bypasses the modifier-index interface`,
      );
    }
    if (
      filePath === searchIndexFile &&
      source.includes('overlimit-cards.json')
    ) {
      addError(
        "generate-search-index.ts bypasses the composed overlimit card projection",
      );
    }
  }

  const multiplierData = JSON.parse(
    fs.readFileSync(path.join(root, "data", "guides", "multiplier.json"), "utf8"),
  ) as { factorDetails?: Record<string, unknown> };
  for (const [factorId, detail] of Object.entries(
    multiplierData.factorDetails ?? {},
  )) {
    if (
      detail &&
      typeof detail === "object" &&
      Object.hasOwn(detail, "attributeFields")
    ) {
      addError(
        `multiplier factorDetails.${factorId} copies Num Modifier attributeFields`,
      );
    }
  }
}

function checkPerkConsumers(): void {
  const entries = [...getPerkSourceEntries("current"), ...getPerkSourceEntries("preview")];
  const perks = entries.map(entry => entry.perk);
  let referencedEffects = 0;
  let referencedStages = 0;
  let literalStages = 0;
  let legacyStages = 0;
  let manualSemanticFields = 0;

  for (const { metadata: data } of entries) {
    for (const effect of Array.isArray(data.effect_values)
      ? (data.effect_values as Array<Record<string, unknown>>)
      : []) {
      if (
        Object.hasOwn(effect, "kind") ||
        Object.hasOwn(effect, "statId") ||
        Object.hasOwn(effect, "modifierTypeId")
      ) {
        manualSemanticFields += 1;
      }
      let hasNumReference = false;
      for (const stage of Array.isArray(effect.stages)
        ? (effect.stages as Array<Record<string, unknown>>)
        : []) {
        if (typeof stage.value === "string") legacyStages += 1;
        else if (
          stage.value &&
          typeof stage.value === "object" &&
          "ref" in stage.value
        ) {
          referencedStages += 1;
          hasNumReference = true;
        } else if (
          stage.value &&
          typeof stage.value === "object" &&
          "literal" in stage.value
        ) {
          literalStages += 1;
        }
      }
      if (hasNumReference) referencedEffects += 1;
    }
  }

  if (legacyStages > 0) {
    addError(`${legacyStages} perk effect stages still use legacy string values`);
  }
  if (manualSemanticFields > 0) {
    addError(`${manualSemanticFields} perk effects still copy semantic classification fields`);
  }
  console.log(
    `Perk Num effects: ${referencedEffects}; referenced stages: ${referencedStages}; ` +
      `justified literals: ${literalStages}; perks loaded: ${perks.length}.`,
  );
}

function checkStatusEffects(): void {
  const data = statusEffects as unknown as {
    schemaVersion?: number;
    source?: Record<string, unknown>;
    effects?: Array<{ variants?: Array<{ modifierIds?: number[] }> }>;
    references?: Record<string, unknown>;
  };
  if (data.schemaVersion !== 2) addError("status-effects.json must use schemaVersion 2");
  if (data.source && "modifierTable" in data.source) {
    addError("status-effects.json still copies source.modifierTable");
  }
  if (data.references && "modifiers" in data.references) {
    addError("status-effects.json still copies references.modifiers");
  }
}

export function checkSemanticCoverage(lock: NumModifierDataLock, semantics: NumModifierSemantics): string[] {
  const issues = [...checkNumModifierDataLock(lock).issues];
  const resolver = createNumModifierResolver(lock, semantics);
  const lockedAttributeNames = new Set(
    Object.values(lock.rows.lc).map((row) => String(row.raw.AttributeName ?? "")),
  );
  for (const attributeName of lockedAttributeNames) {
    if (!Object.hasOwn(semantics.attributes, attributeName)) {
      issues.push(`attribute ${attributeName || "<empty>"} has no semantic disposition`);
    }
  }
  const descriptorNames = new Set(
    Object.values(lock.attribute_descriptions.lc).map((row) =>
      String(row.raw.attr_realname ?? ""),
    ),
  );
  const joined = [...lockedAttributeNames].filter(
    (attributeName) => attributeName && descriptorNames.has(attributeName),
  ).length;
  const missing = [...lockedAttributeNames].filter(
    (attributeName) => attributeName && !descriptorNames.has(attributeName),
  ).length;
  console.log(`Attribute connections: total=${lockedAttributeNames.size}, joined=${joined}, missing=${missing}.`);
  for (const [row, reviewed] of Object.entries(semantics.reviewed_semantics)) {
    // Every audited exception must match its declared signature, even if unused today.
    resolver.resolveEffect({ row: row as `lc:${string}`, field: "base" }, { recipient: reviewed.recipient });
  }
  return issues;
}

function run(): void {
  const lock = readNumModifierDataLock();
  const semantics = parseNumModifierSemantics(JSON.parse(
    fs.readFileSync(path.join(root, "data", "num-modifier-semantics.json"), "utf8"),
  ));
  errors.push(...checkSemanticCoverage(lock, semantics));
  const resolver = createNumModifierResolver(lock, semantics);
  const registry = loadModifierProviderRegistry();

  for (const entry of registry.providers) {
    for (const [index, application] of (entry.applications ?? []).entries()) {
      getProviderResolver(entry.source, resolver).resolveEffect(
        application.expression,
        application.context,
        `data/modifier-providers.json#${entry.id}.applications[${index}]`,
      );
    }
  }
  for (const entry of registry.exclusions) {
    for (const [index, application] of (entry.evidence?.applications ?? []).entries()) {
      getProviderResolver(entry.source, resolver).resolveEffect(
        application.expression,
        application.context,
        `data/modifier-providers.json#${entry.id}.evidence.applications[${index}]`,
      );
    }
  }
  errors.push(...checkModifierRuntimeProjections());
  checkPerkConsumers();
  checkStatusEffects();
  checkStaticBoundaries();
  checkSkillIndex();

  if (errors.length > 0) {
    throw new Error(
      `Num Modifier V2 check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }
  console.log(
    `Num Modifier V2 check passed: ${lock.sources.lc.modifiers.row_count} locked rows, ` +
      `${lock.sources.lc.attribute_descriptions.row_count} attribute descriptions, ` +
      `${registry.providers.length} providers, ${registry.exclusions.length} exclusions.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { run(); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
