import {
  MultiplierBadges,
  MultiplierProviderRows,
} from "@/components/MultiplierBadges";
import type { MultiplierRelation } from "@/lib/multiplier-data";
import type { EffectValueStage, PerkEffectValue } from "@/types";
import type { ResolvedSkillVariant } from "@/lib/num-skill";

function effectKey(effect: PerkEffectValue): string {
  return effect.kind === "damage"
    ? `damage:${effect.modifierTypeId}`
    : `stat:${effect.statId}`;
}

function getCatalogStages(stages: EffectValueStage[]): EffectValueStage[] {
  if (stages.length <= 2) return stages;
  return [stages[0], stages[stages.length - 1]];
}

function CatalogEffect({ effect }: { effect: PerkEffectValue }) {
  const stages = getCatalogStages(effect.stages);

  return (
    <p className="break-words text-center text-[11px] font-medium leading-4 text-[#e2c38b] tabular-nums sm:text-xs">
      <span className="text-zinc-300">{effect.label}</span>{" "}
      {stages.map((stage, index) => (
        <span key={`${stage.condition ?? "base"}:${stage.value}`}>
          {index > 0 && <span className="px-1 text-zinc-600">·</span>}
          {index > 0 && stage.condition && (
            <span className="text-zinc-400">{stage.condition} </span>
          )}
          <strong className="font-semibold">{stage.value}</strong>
        </span>
      ))}
    </p>
  );
}

function DetailEffect({
  effect,
  relations,
}: {
  effect: PerkEffectValue;
  relations: readonly MultiplierRelation[];
}) {
  const facetId = effect.kind === "damage" ? effect.modifierTypeId : effect.statId;
  const matchingRelations = relations.filter(relation => relation.modifierTypeId === facetId);

  return (
    <div className="detail-inset grid gap-3 rounded border border-white/10 bg-black/10 px-3 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center">
      <p className="text-sm font-medium text-zinc-200">{effect.label}</p>
      <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1.5">
        {effect.stages.map((stage) => (
          <p
            key={`${stage.condition ?? "base"}:${stage.value}`}
            className="detail-muted min-w-0 text-sm leading-6 text-zinc-400"
          >
            {stage.condition && <span>{stage.condition} </span>}
            <strong className="font-semibold text-[#e2c38b] tabular-nums">
              {stage.value}
            </strong>
          </p>
        ))}
      </div>
      {matchingRelations.length > 0 && (
        <MultiplierBadges relations={matchingRelations} />
      )}
    </div>
  );
}

export function EffectValuesCatalog({
  effects,
  columns = 1,
}: {
  effects: readonly PerkEffectValue[];
  columns?: 1 | 2;
}) {
  if (effects.length === 0) return null;
  return (
    <div className={`w-full ${columns === 2 ? "grid grid-cols-2 gap-x-2 gap-y-0.5" : ""}`} aria-label="效果数值">
      {effects.map((effect) => (
        <CatalogEffect key={effectKey(effect)} effect={effect} />
      ))}
    </div>
  );
}

export function EffectValuesPanel({
  effects,
  skillVariants,
  relations = [],
  title = "效果数值",
  id,
  flush = false,
  className = "",
}: {
  effects: readonly PerkEffectValue[];
  skillVariants?: readonly ResolvedSkillVariant[];
  relations?: readonly MultiplierRelation[];
  title?: string;
  id?: string;
  flush?: boolean;
  className?: string;
}) {
  const damageEffects = effects.filter((effect) => effect.kind === "damage");
  const statEffects = effects.filter((effect) => effect.kind === "stat");
  const representedModifierTypes = new Set(
    effects.map(effect => effect.kind === "damage" ? effect.modifierTypeId : effect.statId),
  );
  const unmatchedRelations = relations.filter(
    (relation) => !representedModifierTypes.has(relation.modifierTypeId),
  );
  if (effects.length === 0 && unmatchedRelations.length === 0 && !skillVariants?.length) return null;

  const layoutClass = flush
    ? "border-t border-white/10 px-4 py-5 sm:px-6"
    : "overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-4 sm:px-5";

  return (
    <section
      id={id}
      aria-label={title}
      className={`${flush ? "" : "detail-panel "}${layoutClass} ${className}`.trim()}
    >
      <h2 className="detail-heading mb-3 text-sm font-medium text-zinc-400">{title}</h2>
      <div className="space-y-2">
        {skillVariants?.map(({ reference, skill }) => (
          <dl key={reference.variant} aria-label={skill.name} className="grid grid-cols-3 gap-2 text-sm">
            {[
              ["CD", skill.parameters.cooldown === undefined ? "未核验" : `${skill.parameters.cooldown}S`],
              ["持续时间", skill.parameters.duration === undefined ? "未核验" : skill.parameters.duration === 0 ? "瞬时" : `${skill.parameters.duration}S${skill.durationIsBase ? "起" : ""}`],
              ["阻回", skill.parameters.blocking === undefined ? "未核验" : skill.parameters.blocking ? "是" : "否"],
            ].map(([label, value]) => (
              <div key={label} className="flex min-w-0 items-center justify-between gap-1 whitespace-nowrap rounded border border-white/10 bg-black/10 px-2 py-2 text-xs sm:px-3 sm:text-sm">
                <dt className="text-zinc-400">{label}</dt>
                <dd className="text-zinc-100 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ))}
        {damageEffects.map((effect) => (
          <DetailEffect
            key={effectKey(effect)}
            effect={effect}
            relations={relations}
          />
        ))}
        {unmatchedRelations.length > 0 && (
          <MultiplierProviderRows relations={unmatchedRelations} framed />
        )}
        {statEffects.map((effect) => (
          <DetailEffect
            key={effectKey(effect)}
            effect={effect}
            relations={relations}
          />
        ))}
      </div>
    </section>
  );
}
