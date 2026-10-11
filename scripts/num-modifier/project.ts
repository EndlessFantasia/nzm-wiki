import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  createNumModifierResolver,
  type NumModifierValueExpression,
} from "../../lib/num-modifier";
import { parseNumModifierSemantics } from "../../lib/num-modifier-semantics";
import { readNumModifierDataLock } from "./lock";
import { getProviderResolver } from "./provider-resolver";
import { loadModifierProviderRegistry } from "./provider-registry";

type JsonObject = Record<string, unknown>;

const root = process.cwd();
export const MODIFIER_INDEX_RUNTIME_PATH = path.join(
  root,
  "data",
  "modifier-index-runtime.json",
);
export const MULTIPLIER_PROVIDER_RUNTIME_PATH = path.join(
  root,
  "data",
  "guides",
  "multiplier-providers-runtime.json",
);
const SEMANTICS_PATH = path.join(root, "data", "num-modifier-semantics.json");
const MULTIPLIER_DATA_PATH = path.join(root, "data", "guides", "multiplier.json");

function readJson(filePath: string): JsonObject {
  const value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected JSON object: ${filePath}`);
  }
  return value as JsonObject;
}

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)];
}

type RuntimeEffect = {
  row: string;
  operation: string;
  attributeTypeId: string;
  attributeLabel: string;
  direction: string;
  recipient: string;
  facetIds: string[];
  reviewed: boolean;
};

export function generateModifierIndexRuntime(): JsonObject {
  const registry = loadModifierProviderRegistry();
  const lock = readNumModifierDataLock();
  const semantics = parseNumModifierSemantics(readJson(SEMANTICS_PATH));
  const resolver = createNumModifierResolver(lock, semantics);
  const knownFacetIds = new Set(
    Object.values(semantics.attribute_types).flatMap((type) =>
      Object.values(type.facets).flatMap((facet) => (facet ? [facet.id] : [])),
    ),
  );

  const providers = registry.providers.map((provider) => {
    const providerResolver = getProviderResolver(provider.source, resolver);
    const effects: RuntimeEffect[] = [];
    for (const [index, application] of (provider.applications ?? []).entries()) {
      const resolved = providerResolver.resolveEffect(
        application.expression as NumModifierValueExpression,
        application.context,
        `data/modifier-providers.json#${provider.id}.applications[${index}]`,
      );
      if (!resolved.attribute.typeId) {
        throw new Error(
          `${provider.id} application ${application.expression.row} is not indexed`,
        );
      }
      effects.push({
        row: application.expression.row,
        operation: resolved.operation.code,
        attributeTypeId: resolved.attribute.typeId,
        attributeLabel: resolved.attribute.label,
        direction: resolved.direction,
        recipient: resolved.context.recipient,
        facetIds: resolved.facets.map((facet) => facet.id),
        reviewed: resolved.reviewed,
      });
    }
    const reviewedFacetIds = provider.reviewedFacetIds ?? [];
    for (const facetId of reviewedFacetIds) {
      if (!knownFacetIds.has(facetId)) {
        throw new Error(`${provider.id} uses unknown reviewed facet ${facetId}`);
      }
    }
    const facetIds = unique([
      ...effects.flatMap((effect) => effect.facetIds),
      ...reviewedFacetIds,
    ]);
    if (facetIds.length === 0) {
      throw new Error(`${provider.id} resolves to no index facet`);
    }
    return {
      id: provider.id,
      label: provider.label,
      source: provider.source,
      facetIds,
      effects,
      reviewedOverride: provider.evidence.kind === "reviewed-override",
    };
  });

  return {
    schemaVersion: 1,
    attributeTypes: Object.entries(semantics.attribute_types).map(
      ([id, type]) => ({ id, ...type }),
    ),
    attributes: Object.entries(semantics.attributes).flatMap(
      ([attributeName, attribute]) =>
        attribute.status === "indexed"
          ? [
              {
                attributeName,
                attributeTypeId: attribute.attribute_type,
                scope: attribute.scope,
                ...(attribute.qualifier
                  ? { qualifier: attribute.qualifier }
                  : {}),
              },
            ]
          : [],
    ),
    providers,
    exclusions: registry.exclusions.map((exclusion) => ({
      id: exclusion.id,
      label: exclusion.label,
      source: exclusion.source,
      reasonCode: exclusion.reasonCode,
      reason: exclusion.reason,
    })),
  };
}

export function generateMultiplierProviderRuntime(
  modifierRuntime = generateModifierIndexRuntime(),
): JsonObject {
  const multiplierData = readJson(MULTIPLIER_DATA_PATH);
  const matrix = multiplierData.damageChannelMatrix as JsonObject;
  const channels = matrix.channels;
  if (!Array.isArray(channels)) {
    throw new Error("damageChannelMatrix.channels must be an array");
  }
  const damageFacets = new Set(
    (channels as JsonObject[]).map((channel) => String(channel.facetId ?? "")),
  );
  const providers = (modifierRuntime.providers as JsonObject[]).map((provider) => {
    const modifierTypeIds = unique(
      (provider.facetIds as string[]).filter((facetId) => damageFacets.has(facetId)),
    );
    if (modifierTypeIds.length === 0) {
      throw new Error(`${String(provider.id)} has no multiplier facet`);
    }
    return {
      id: provider.id,
      label: provider.label,
      source: provider.source,
      modifierTypeIds,
    };
  });
  return {
    schemaVersion: 1,
    providers,
    exclusions: modifierRuntime.exclusions,
  };
}

export function serializeRuntime(value: JsonObject): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function writeModifierRuntimeProjections(): void {
  const modifierRuntime = generateModifierIndexRuntime();
  writeFileSync(
    MODIFIER_INDEX_RUNTIME_PATH,
    serializeRuntime(modifierRuntime),
    "utf8",
  );
  writeFileSync(
    MULTIPLIER_PROVIDER_RUNTIME_PATH,
    serializeRuntime(generateMultiplierProviderRuntime(modifierRuntime)),
    "utf8",
  );
}

export function checkModifierRuntimeProjections(): string[] {
  const issues: string[] = [];
  const modifierRuntime = generateModifierIndexRuntime();
  const expected = [
    [MODIFIER_INDEX_RUNTIME_PATH, serializeRuntime(modifierRuntime)],
    [
      MULTIPLIER_PROVIDER_RUNTIME_PATH,
      serializeRuntime(generateMultiplierProviderRuntime(modifierRuntime)),
    ],
  ] as const;
  for (const [filePath, content] of expected) {
    if (!existsSync(filePath)) {
      issues.push(`missing ${path.relative(root, filePath)}`);
    } else if (serializeRuntime(readJson(filePath)) !== content) {
      issues.push(`${path.basename(filePath)} is stale; run pnpm num-modifier:project`);
    }
  }
  return issues;
}
