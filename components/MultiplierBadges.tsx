import Link from "next/link";
import { ArrowUpRight, Layers3 } from "lucide-react";
import { getMultiplierFactorStyle } from "@/components/multiplier-badge-styles";
import { MultiplierBadgeStack } from "@/components/MultiplierBadgeStack";
import {
  getApplicableModifierTypes,
  getProviderRelationsForSource,
  getRelationsByFactor,
  resolveMultiplierFactorHref,
  type DamageProfile,
  type MultiplierRelation,
  type MultiplierSource,
} from "@/lib/multiplier-data";

type MultiplierBadgeVariant =
  | "default"
  | "catalog-overlay"
  | "catalog-compact"
  | "catalog-stacked"
  | "catalog-inline";

export function MultiplierBadges({
  relations,
  className = "",
  id,
  variant = "default",
  showOperation = false,
}: {
  relations: readonly MultiplierRelation[];
  className?: string;
  id?: string;
  variant?: MultiplierBadgeVariant;
  showOperation?: boolean;
}) {
  const groups = getRelationsByFactor(relations);
  if (groups.length === 0) return null;
  if (variant === "catalog-stacked" && groups.length > 1) {
    const front = groups.find(group => group.factorId === "dilution") ?? groups[0];
    const back = groups.filter(group => group !== front);

    return (
      <MultiplierBadgeStack id={id} className={className}>
        <summary
          aria-label={`展开乘区：${[front, ...back].map(group => group.factorLabel).join("、")}`}
          className="relative grid h-6 touch-manipulation cursor-pointer list-none pr-2 outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] [&::-webkit-details-marker]:hidden"
        >
          {back.map(({ factorId, factorLabel }, index) => (
            <span
              key={factorId}
              aria-hidden="true"
              className="col-start-1 row-start-1 rounded bg-zinc-900"
              style={{ transform: `translate(3px, ${index % 2 === 0 ? -4 : 4}px)` }}
            >
              <span className={`flex h-6 whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-medium leading-4 ${getMultiplierFactorStyle(factorId)}`}>
                <span className="invisible">{factorLabel}</span>
              </span>
            </span>
          ))}
          <span className="relative col-start-1 row-start-1 rounded bg-zinc-900">
            <span className={`flex h-6 items-center justify-center whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-medium leading-4 ${getMultiplierFactorStyle(front.factorId)}`}>
              {front.factorLabel}
            </span>
          </span>
        </summary>
        <div className="multiplier-badge-preview absolute right-0 top-full z-20 pt-2">
          <div className="rounded-md border border-zinc-700 bg-zinc-900 p-2 shadow-lg">
            <MultiplierBadges relations={relations} showOperation={showOperation} className="w-max flex-col items-stretch" />
          </div>
        </div>
      </MultiplierBadgeStack>
    );
  }
  const isCatalogOverlay = variant === "catalog-overlay";
  const isCatalogCompact = variant === "catalog-compact" || variant === "catalog-stacked";
  const isCatalogInline = variant === "catalog-inline";
  const isCompact = isCatalogOverlay || isCatalogCompact || isCatalogInline;
  const isSplitCatalogOverlay = isCatalogOverlay && groups.length === 2;
  const Root = isCatalogInline ? "span" : "div";
  const rootLayoutClass = isSplitCatalogOverlay
    ? "flex-nowrap items-start justify-between gap-1"
    : isCatalogOverlay
      ? "flex-wrap items-center justify-end gap-1.5"
      : "flex-wrap items-center gap-1.5";

  return (
    <Root
      id={id}
      className={`flex ${rootLayoutClass} ${isCatalogInline ? "float-right mt-1 mr-0.5 ml-2" : ""} ${className}`}
    >
      {groups.map(({ factorId, factorLabel, relations: factorRelations }, index) => {
        const modifierLabels = [...new Set(
          factorRelations.map((relation) => relation.modifierTypeLabel),
        )];
        const operations = showOperation
          ? [...new Set(factorRelations.flatMap((relation) => relation.operations ?? []))]
          : [];
        const displayLabel = `${operations.length > 0 ? `${operations.join("/")}` : ""}${factorLabel}`;
        const href = resolveMultiplierFactorHref(factorId, {
          view: factorRelations.some((relation) => relation.kind === "provider")
            ? "providers"
            : "targets",
          modifierTypeId:
            factorRelations.length === 1
              ? factorRelations[0].modifierTypeId
              : undefined,
        });
        const description = `${displayLabel}：${modifierLabels.join("、")}；点击查看乘区说明`;
        const catalogOverlayClass = isSplitCatalogOverlay
          ? `${index === 0 ? "rounded-br-md rounded-tl-md" : "rounded-bl-md rounded-tr-md"} min-h-7 shrink-0 whitespace-nowrap justify-center px-1 py-0.5 text-center text-[9px] font-medium leading-4 after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']`
          : "min-h-7 rounded-bl-md rounded-br-none rounded-tl-none rounded-tr-md px-2 py-0.5 text-[11px] font-medium leading-4 after:absolute after:-inset-x-1 after:-inset-y-2 after:content-['']";

        return (
          <Link
            key={factorId}
            href={href}
            prefetch={false}
            title={description}
            aria-label={description}
            className={`relative inline-flex touch-manipulation items-center border transition-colors duration-200 hover:brightness-125 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none ${isCatalogOverlay ? catalogOverlayClass : isCatalogInline ? "min-h-5 rounded px-2 text-[11px] font-medium leading-4 after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']" : isCatalogCompact ? "min-h-6 rounded px-2 py-0.5 text-[11px] font-medium leading-4 after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-['']" : "min-h-11 gap-1 rounded px-2 py-1 text-xs font-semibold leading-5 sm:min-h-7"} ${getMultiplierFactorStyle(factorId)}`}
          >
            {!isCompact && (
              <Layers3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{displayLabel}</span>
            {!isCompact && (
              <ArrowUpRight aria-hidden="true" className="h-3 w-3 shrink-0 opacity-70" />
            )}
          </Link>
        );
      })}
    </Root>
  );
}

export function MultiplierSourceBadges({
  source,
  className,
  id,
  variant,
}: {
  source: MultiplierSource;
  className?: string;
  id?: string;
  variant?: MultiplierBadgeVariant;
}) {
  return (
    <MultiplierBadges
      id={id}
      relations={getProviderRelationsForSource(source)}
      className={className}
      variant={variant}
    />
  );
}

export function MultiplierProviderRows({
  relations,
  framed = false,
}: {
  relations: readonly MultiplierRelation[];
  framed?: boolean;
}) {
  const groups = new Map<string, MultiplierRelation[]>();
  for (const relation of relations) {
    const key = relation.effectId ?? relation.modifierTypeId;
    const group = groups.get(key) ?? [];
    group.push(relation);
    groups.set(key, group);
  }

  return (
    <div className="space-y-2">
      {[...groups.values()].map((effectRelations) => {
        const placementSource = effectRelations[0].source;
        return (
          <div
            key={effectRelations[0].effectId ?? effectRelations[0].modifierTypeId}
            id={placementSource?.anchor}
            className={
              framed
                ? "detail-inset grid gap-3 rounded-lg border border-white/10 bg-black/10 px-3 py-3 sm:grid-cols-[minmax(9rem,1fr)_auto] sm:items-center"
                : "flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
            }
          >
            <span className="text-sm text-zinc-200">
              {effectRelations[0].effectLabel ??
                effectRelations[0].modifierTypeLabel}
            </span>
            <MultiplierBadges relations={effectRelations} />
          </div>
        );
      })}
    </div>
  );
}

export function MultiplierProviderPanel({
  source,
  className = "",
}: {
  source: MultiplierSource;
  className?: string;
}) {
  const relations = getProviderRelationsForSource(source);
  if (relations.length === 0) return null;

  return (
    <section
      aria-label="提供的增伤类型"
      className={`border-t border-white/10 px-4 py-4 sm:px-6 ${className}`}
    >
      <h2 className="detail-heading mb-3 text-sm font-medium text-zinc-400">
        提供的增伤类型
      </h2>
      <MultiplierProviderRows relations={relations} />
    </section>
  );
}

export function DamageSourceMultiplierBadges({
  profile,
  className,
}: {
  profile: DamageProfile;
  className?: string;
}) {
  return (
    <MultiplierBadges
      relations={getApplicableModifierTypes(profile)}
      className={className}
    />
  );
}
