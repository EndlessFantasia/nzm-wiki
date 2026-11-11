import { z } from "zod";
import type { OverlimitCard, OverlimitBondCatalog, OverlimitLevelCatalog, OverlimitMapRotationSchedule } from "@/types";
import type { TriggerDamageEntry } from "@/lib/trigger-damage";

const text = z.string().trim().min(1);
const id = z.string().regex(/^\d+$/);
const date = z.iso.date();
const asset = z.string().regex(/^\/(?!\/)(?!.*\.\.)[^?#]+$/);
const effectStage = z.strictObject({ condition: text.optional(), value: text });
export const resolvedPerkEffectSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("damage"), modifierTypeId: text, label: text, stages: z.array(effectStage).min(1) }),
  z.strictObject({ kind: z.literal("stat"), statId: text, label: text, stages: z.array(effectStage).min(1) }),
]);
const cardSchema = z.strictObject({
  id, perkItemId: id.optional(), name: text, description: text, icon: asset,
  quality: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  weight: z.number().positive().optional(),
  slot: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  applicabilityKnown: z.boolean().optional(),
  verification: z.strictObject({ status: z.literal("partial"), note: text }).optional(),
  weaponType: z.array(z.number().int()), weaponItems: z.array(z.number().int()), weaponNames: z.array(text),
  tags: z.array(z.strictObject({ id, name: text, icon: z.union([asset, z.literal("")]), tone: z.string() })),
  effectValues: z.array(resolvedPerkEffectSchema).min(1).optional(),
}) satisfies z.ZodType<OverlimitCard>;
const permission = z.union([z.boolean(), z.literal("不适用"), z.null()]);
export const independentDamageEntrySchema = z.strictObject({
  name: text, href: text.optional(), perkSlug: text.optional(), overlimitId: id.optional(),
  trigger: text, interval: text, numericalId: text, damageType: text, damageValue: text,
  toughness: z.union([z.number(), text]), element: text,
  critical: permission, weakpoint: permission,
  weakpointMultiplier: z.union([z.number(), text, z.null()]).optional(), note: text.optional(), pending: text.optional(),
}) satisfies z.ZodType<TriggerDamageEntry>;
const bondName = text;
const bonds = z.array(z.strictObject({ name: bondName, effects: z.array(z.strictObject({
  count: z.number().int().positive(), description: text,
  mergeType: text.optional(), overrides: z.array(z.number().int().positive()).optional(),
})).min(1) })).min(1) satisfies z.ZodType<OverlimitBondCatalog>;
const weights = z.strictObject({ 3: z.number().nonnegative(), 4: z.number().nonnegative(), 5: z.number().nonnegative() });
const probability = z.number().min(0).max(1);
const levels = z.strictObject({
  levels: z.array(z.strictObject({ level: z.number().int().positive(), qualityWeights: weights })).min(1),
  slot4: z.strictObject({ baseProbability: probability, guaranteedLevels: z.array(z.number().int().positive()),
    bonusPerObtainedSlot4: z.number().finite(), mixedPoolWeights: z.strictObject({ nonSlot4: z.number().nonnegative(), slot4: z.number().nonnegative() }) }),
  criticalProbability: probability,
  rerollCosts: z.array(z.strictObject({ time: z.number().int().nonnegative(), cost: z.number().nonnegative() })),
}) satisfies z.ZodType<OverlimitLevelCatalog>;
const rotation = z.strictObject({
  season: z.number().int(), timezone: z.literal("Asia/Shanghai"),
  periods: z.array(z.strictObject({ startDate: date, endDate: date.nullable(), endLabel: text.optional(),
    maps: z.array(z.strictObject({ name: text, activeBonds: z.array(bondName) })) })),
}) satisfies z.ZodType<OverlimitMapRotationSchedule>;

export const overlimitCatalogSchema = z.strictObject({
  schemaVersion: z.literal(1),
  season: z.strictObject({ id: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/), label: text,
    status: z.enum(["current", "preload"]), updatedAt: date }),
  provenance: z.strictObject({ contentRoot: text, note: text,
    files: z.array(z.strictObject({ path: text, sha256: z.string().regex(/^[a-f0-9]{64}$/) })).min(1) }),
  withdrawn: z.literal(true).optional(),
  cards: z.array(cardSchema),
  independentDamage: z.record(id, z.array(independentDamageEntrySchema).min(1)),
  bonds: bonds.nullable(), levels: levels.nullable(), mapRotation: rotation.nullable(),
}).superRefine((catalog, ctx) => {
  if (!catalog.withdrawn && catalog.cards.length === 0) {
    ctx.addIssue({ code: "custom", message: "已发布卡池不能为空", path: ["cards"] });
  }
  if (catalog.withdrawn && (catalog.season.status !== "current" || catalog.cards.length ||
      Object.keys(catalog.independentDamage).length || catalog.bonds || catalog.levels || catalog.mapRotation)) {
    ctx.addIssue({ code: "custom", message: "撤下的正式版不得保留展示内容", path: ["withdrawn"] });
  }
  const ids = new Set<string>();
  for (const [index, card] of catalog.cards.entries()) {
    if (ids.has(card.id)) ctx.addIssue({ code: "custom", message: `重复卡片 ID: ${card.id}`, path: ["cards", index, "id"] });
    ids.add(card.id);
    if (card.applicabilityKnown === false && (card.weaponType.length || card.weaponItems.length || card.weaponNames.length)) {
      ctx.addIssue({ code: "custom", message: "未确认适用范围时不得填写武器限制", path: ["cards", index] });
    }
  }
  for (const key of Object.keys(catalog.independentDamage)) {
    if (!ids.has(key)) ctx.addIssue({ code: "custom", message: `独立伤害指向非当前卡片: ${key}`, path: ["independentDamage", key] });
  }
});

export type OverlimitCatalog = z.infer<typeof overlimitCatalogSchema>;

/** A published projection: no refs, current perks, clock-based activation, or preview resolver. */
export function parseOverlimitCatalog(value: unknown): OverlimitCatalog {
  return overlimitCatalogSchema.parse(value);
}
