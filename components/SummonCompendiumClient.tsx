"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BookOpenText,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  ExternalLink,
  ListFilter,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { MultiplierBadges } from "@/components/MultiplierBadges";
import { getMultiplierFactorStyle } from "@/components/multiplier-badge-styles";
import { getAssetPath } from "@/lib/path";
import { revealLocatedTarget } from "@/lib/locate-target";
import {
  HEALTH_SETTLEMENT_PREFIX,
  getHealthSettlementDefinition,
  isWeaponHealthSettlementType,
} from "@/lib/weapon-health-settlement";
import type {
  SummonBuffView,
  SummonCatalogEntryView,
  SummonCatalogView,
  SummonDamageView,
  SummonKind,
  SummonMechanicDefinition,
  SummonMechanicView,
  SummonPerkView,
  SummonTalentView,
} from "@/types";

type KindFilter = "all" | SummonKind;

const KIND_OPTIONS: Array<{ value: KindFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "deployable", label: "架设" },
  { value: "companion", label: "自动伙伴" },
  { value: "season-servant", label: "赛季仆从" },
];

const KIND_STYLES: Record<SummonKind, string> = {
  deployable: "border-amber-500/35 bg-amber-500/10 text-amber-200",
  companion: "border-cyan-500/35 bg-cyan-500/10 text-cyan-200",
  "season-servant": "border-violet-500/35 bg-violet-500/10 text-violet-200",
};

const EVIDENCE_LABELS = {
  published: "站内公开数据",
  "config-verified": "配置交叉确认",
  partial: "部分配置",
} as const;

function formatNumber(value: number, digits = 2): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(digits)));
}

function formatCoefficient(
  value: number | undefined,
  attackStatLabel: SummonDamageView["attackStatLabel"],
): string {
  return value === undefined
    ? "未公开"
    : `${formatNumber(value * 100, 2)}% ${attackStatLabel}`;
}

function formatBaseDamage(value: number | undefined): string {
  return value === undefined ? "未公开" : value.toFixed(1);
}

function settlementLabel(settlements: readonly string[]): string {
  const settlement = settlements.find((item) =>
    item.startsWith(HEALTH_SETTLEMENT_PREFIX),
  );
  if (!settlement) return "未标注结算类型";

  const type = settlement.slice(HEALTH_SETTLEMENT_PREFIX.length);
  return isWeaponHealthSettlementType(type)
    ? getHealthSettlementDefinition(type).label
    : type;
}

function subscribeToLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("summon-query-change", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("summon-query-change", callback);
  };
}

function getLocationSnapshot() {
  return `${window.location.search}${window.location.hash}`;
}

function getServerLocationSnapshot() {
  return "";
}

function updateQuery(updates: Record<string, string | string[] | null>, hash?: string) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (Array.isArray(value)) {
      url.searchParams.delete(key);
      value.forEach((item) => {
        if (item && item !== "all") url.searchParams.append(key, item);
      });
    } else if (!value || value === "all") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }
  if (hash !== undefined) url.hash = hash;
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new Event("summon-query-change"));
}

function AssetIcon({
  src,
  alt,
  size = 48,
  className = "",
}: {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-600 ${className}`}
        style={{ width: size, height: size }}
      >
        <CircleDashed className="h-5 w-5" />
      </div>
    );
  }
  return (
    <Image
      src={getAssetPath(src)}
      alt={alt}
      width={size}
      height={size}
      className={`shrink-0 rounded border border-zinc-700 bg-zinc-950 object-contain ${className}`}
    />
  );
}

function DamageRow({ damage }: { damage: SummonDamageView }) {
  const rateText = damage.roundsPerMinute
    ? `${formatNumber(damage.roundsPerMinute, 1)} RPM`
    : damage.intervalSeconds
      ? `${formatNumber(damage.intervalSeconds, 3)} 秒/动作`
      : damage.rate?.label ?? "事件触发";
  const shotIntervalText =
    damage.roundsPerMinute &&
    damage.intervalSeconds &&
    damage.attacksPerAction === 1
      ? `${formatNumber(damage.intervalSeconds, 3)} 秒/发`
      : undefined;

  return (
    <div className="grid min-w-0 gap-2 border-t border-zinc-800/80 px-3 py-2 first:border-t-0 lg:grid-cols-[minmax(8.5rem,1.15fr)_minmax(7rem,0.8fr)_minmax(7.5rem,0.8fr)_minmax(7.5rem,0.8fr)_minmax(18rem,2fr)] lg:items-start lg:gap-3 lg:px-4">
      <div className="min-w-0">
        <p className="m-0 text-sm font-semibold leading-5 text-zinc-100">{damage.name}</p>
        <p className="m-0 mt-0.5 text-xs leading-4 text-zinc-500">
          {settlementLabel(damage.settlements)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 lg:block">
        <div className="rounded bg-zinc-950/55 px-2 py-1.5 lg:bg-transparent lg:p-0">
          <span className="text-[11px] text-zinc-500 lg:hidden">单次白值</span>
          <p className="m-0 text-base font-semibold leading-5 tabular-nums text-zinc-100">
            {formatBaseDamage(damage.baseDamage)}
          </p>
          {damage.coefficient !== undefined && (
            <p className="m-0 text-[11px] leading-4 text-zinc-500">
              {formatCoefficient(damage.coefficient, damage.attackStatLabel)}
            </p>
          )}
        </div>
        <div className="rounded bg-zinc-950/55 px-2 py-1.5 lg:hidden">
          <span className="text-[11px] text-zinc-500">节奏</span>
          <p className="m-0 text-xs font-medium leading-5 text-zinc-200">{rateText}</p>
          {shotIntervalText && (
            <p className="m-0 text-[11px] leading-4 text-zinc-500">{shotIntervalText}</p>
          )}
        </div>
      </div>

      <div className="hidden min-w-0 lg:block">
        <p className="m-0 text-xs font-medium leading-5 text-zinc-200">{rateText}</p>
        {shotIntervalText && (
          <p className="m-0 text-[11px] leading-4 text-zinc-500">{shotIntervalText}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-xs lg:block">
        <div>
          <span className="text-zinc-500">元素 </span>
          <span className="text-zinc-200">{damage.element ?? "未知"}</span>
        </div>
        <div>
          <span className="text-zinc-500">暴击/弱点 </span>
          <span className="text-zinc-200">
            {damage.enableCritical ? "可" : "不可"} / {damage.enableWeakness ? "可" : "不可"}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-zinc-400">
        <MultiplierBadges relations={damage.multiplierRelations} variant="catalog-compact" />
        {damage.multiplierRelations.length === 0 && (
          <span className="text-zinc-600">暂无可确定乘区</span>
        )}
        {damage.note && <span>{damage.note}</span>}
        {damage.rate?.note && <span className="text-zinc-500">{damage.rate.note}</span>}
        {damage.sourceHref && (
          <Link
            href={damage.sourceHref}
            className="inline-flex shrink-0 items-center gap-1 text-cyan-400 hover:text-cyan-300 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
          >
            {damage.sourceLabel}
            <ExternalLink aria-hidden="true" className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function DamageSection({ entry }: { entry: SummonCatalogEntryView }) {
  return (
    <section aria-labelledby={`damage-title-${entry.id}`} className="mt-4">
      <h3 id={`damage-title-${entry.id}`} className="m-0 mb-2 text-sm font-semibold text-zinc-100">
        伤害与攻击节奏
      </h3>
      <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/35">
        <div className="hidden grid-cols-[minmax(8.5rem,1.15fr)_minmax(7rem,0.8fr)_minmax(7.5rem,0.8fr)_minmax(7.5rem,0.8fr)_minmax(18rem,2fr)] gap-3 bg-zinc-950/70 px-4 py-2 text-[11px] font-medium text-zinc-500 lg:grid">
          <span>伤害</span>
          <span>单次白值</span>
          <span>间隔 / 射速</span>
          <span>结算许可</span>
          <span>适用乘区 / 说明</span>
        </div>
        {entry.damageSources.map((damage) => (
          <DamageRow key={damage.id} damage={damage} />
        ))}
      </div>
    </section>
  );
}

function MechanicCard({
  entryId,
  hideHeading = false,
  mechanic,
}: {
  entryId: string;
  hideHeading?: boolean;
  mechanic: SummonMechanicDefinition | SummonMechanicView;
}) {
  const hasMore = Boolean(mechanic.details?.length || mechanic.facts?.length);
  return (
    <article
      id={`summon-${entryId}-${mechanic.id}`}
      className="scroll-mt-24 rounded-md border border-zinc-800 bg-zinc-950/35 p-3 target:border-cyan-700/70 target:bg-cyan-950/15"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {mechanic.icon && (
            <AssetIcon src={mechanic.icon} alt="" size={36} className="h-9 w-9" />
          )}
          <div className="min-w-0">
          {!hideHeading && (
            <h4 className="m-0 text-sm font-semibold leading-5 text-zinc-100">{mechanic.name}</h4>
          )}
          <p className={`m-0 text-xs leading-5 text-zinc-300 ${hideHeading ? "" : "mt-1"}`}>{mechanic.summary}</p>
          </div>
        </div>
        {mechanic.link && (
          <Link
            href={mechanic.link.href}
            title={mechanic.link.label}
            aria-label={mechanic.link.label}
            className="relative inline-flex min-h-8 shrink-0 items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 text-[11px] text-zinc-300 after:absolute after:-inset-2 after:content-[''] hover:border-cyan-700 hover:text-cyan-300 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
          >
            详情
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
          </Link>
        )}
      </div>
      {hasMore && (
        <details className="mt-2 border-t border-zinc-800/80 pt-1">
          <summary className="flex min-h-9 w-fit cursor-pointer select-none items-center text-[11px] text-zinc-500 hover:text-zinc-300 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4">
            数值与补充
          </summary>
          {mechanic.facts && mechanic.facts.length > 0 && (
            <dl className="grid grid-cols-2 gap-1.5 pb-2 sm:grid-cols-4">
              {mechanic.facts.map((fact) => (
                <div key={`${fact.label}:${fact.value}`} className="rounded bg-zinc-900/70 px-2 py-1.5">
                  <dt className="text-[10px] leading-4 text-zinc-500">{fact.label}</dt>
                  <dd className="m-0 text-xs font-medium leading-5 text-zinc-200">{fact.value}</dd>
                  {fact.note && <p className="m-0 text-[10px] leading-4 text-zinc-600">{fact.note}</p>}
                </div>
              ))}
            </dl>
          )}
          {mechanic.details?.map((detail) => (
            <p key={detail} className="m-0 border-t border-zinc-800/60 py-1.5 text-xs leading-5 text-zinc-500 first:border-t-0">
              {detail}
            </p>
          ))}
        </details>
      )}
    </article>
  );
}

function BuffCard({ buff }: { buff: SummonBuffView }) {
  const hasMultiplierRelations = buff.multiplierRelations.length > 0;
  return (
    <Link
      href={buff.href}
      className="group relative flex min-w-0 gap-2.5 rounded-md border border-zinc-800 bg-zinc-950/35 p-2.5 hover:border-cyan-800 hover:bg-cyan-950/10 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
    >
      <AssetIcon src={buff.icon} alt="" size={36} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <div className={`-mt-0.5 min-w-0 leading-4 ${hasMultiplierRelations ? "pr-20" : ""}`}>
          <span className="text-xs font-semibold leading-4 text-zinc-200 group-hover:text-cyan-200">{buff.name}</span>
        </div>
        <p className="m-0 line-clamp-2 text-[11px] leading-4 text-zinc-500">{buff.note ?? buff.summary}</p>
        <span className="mt-1 block text-[10px] text-zinc-600">{buff.durationLabel}</span>
      </div>
      {hasMultiplierRelations && (
        <div className="absolute right-2.5 top-2.5 flex flex-wrap items-center justify-end gap-1">
          {buff.multiplierRelations.map((relation) => (
            <span
              key={`${buff.buffId}:${relation.modifierTypeId}`}
              className={`rounded border px-1.5 py-0.5 text-[10px] ${getMultiplierFactorStyle(relation.factorId)}`}
            >
              {relation.factorLabel}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function PerkCard({ perk }: { perk: SummonPerkView }) {
  return (
    <article className="group flex min-w-0 gap-2.5 rounded-md border border-zinc-800 bg-zinc-950/35 p-2.5 hover:border-violet-800 hover:bg-violet-950/10 lg:h-full">
      <AssetIcon src={perk.icon} alt="" size={36} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Link
              href={perk.href}
              className="inline-flex min-w-0 items-center text-xs font-semibold leading-4 text-zinc-200 group-hover:text-violet-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
            >
              {perk.name}
            </Link>
            <span className="shrink-0 text-[10px] text-zinc-600">{perk.slot} 号槽</span>
          </div>
          <MultiplierBadges relations={perk.multiplierRelations} variant="catalog-compact" className="shrink-0 justify-end" />
        </div>
        {perk.description && (
          <p className="m-0 line-clamp-2 text-[11px] leading-4 text-zinc-500">{perk.description}</p>
        )}
      </div>
    </article>
  );
}

function TalentRow({ talent }: { talent: SummonTalentView }) {
  return (
    <Link
      href={talent.href}
      className="group flex min-w-0 items-start gap-2.5 border-t border-zinc-800/70 py-2 first:border-t-0 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
    >
      <AssetIcon src={talent.icon} alt="" size={32} className="h-8 w-8" />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-xs font-medium leading-5 text-zinc-300 group-hover:text-violet-200">{talent.name}</p>
        <p className="m-0 line-clamp-2 text-[11px] leading-4 text-zinc-600">{talent.descriptions[0]}</p>
      </div>
      <span className="mt-1 text-[10px] text-zinc-700">{talent.id}</span>
    </Link>
  );
}

function RelatedSection({ entry }: { entry: SummonCatalogEntryView }) {
  const hasRelated = entry.buffs.length > 0 || entry.perks.length > 0 || entry.talents.length > 0;
  const hasCards = entry.buffs.length > 0 || entry.perks.length > 0;
  if (!hasRelated) return null;
  return (
    <section className={`mt-4 grid min-w-0 gap-3 ${hasCards && entry.talents.length > 0 ? "lg:grid-cols-2" : "grid-cols-1"}`}>
      {hasCards && (
        <div className="min-w-0">
          <h3 className="m-0 mb-2 text-sm font-semibold text-zinc-100">
            Buff 与专属插件
          </h3>
          {entry.perkSelectionNote && (
            <p className="m-0 mb-2 text-xs leading-4 text-amber-300/80">
              {entry.perkSelectionNote}
            </p>
          )}
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            {entry.buffs.map((buff) => <BuffCard key={`${buff.target}:${buff.buffId}`} buff={buff} />)}
            {entry.perks.map((perk) => <PerkCard key={perk.slug} perk={perk} />)}
          </div>
        </div>
      )}
      {entry.talents.length > 0 && (
        <div className="min-w-0">
          <h3 className="m-0 mb-2 text-sm font-semibold text-zinc-100">
            S3 天赋链
          </h3>
          <details className="rounded-md border border-zinc-800 bg-zinc-950/35 px-3">
            <summary className="flex min-h-10 cursor-pointer select-none items-center justify-between gap-2 text-xs font-medium text-zinc-300 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4">
              查看 {entry.talents.length} 个已发布节点
              <span className="text-[10px] text-zinc-600">S3</span>
            </summary>
            <div className="pb-2">
              {entry.talents.map((talent) => <TalentRow key={`${talent.kind}:${talent.id}`} talent={talent} />)}
            </div>
          </details>
        </div>
      )}
    </section>
  );
}

function SummonEntry({
  entry,
  linked,
  expanded,
  onToggle,
}: {
  entry: SummonCatalogEntryView;
  linked: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const facts = [
    { label: "召唤方式", value: entry.deployment },
    { label: "操控", value: entry.control },
    { label: "索敌", value: entry.targeting },
    { label: "生命周期", value: entry.lifetime },
    { label: "数量", value: entry.count },
    { label: "攻击节奏", value: entry.rateSummary },
  ];
  return (
    <article
      id={`summon-${entry.id}`}
      className={`scroll-mt-24 overflow-hidden rounded-lg border bg-zinc-900/30 transition-colors duration-200 target:border-cyan-600/70 target:bg-cyan-950/10 motion-reduce:transition-none ${
        linked ? "border-cyan-700/70 bg-cyan-950/10" : "border-zinc-800"
      }`}
    >
      <header className={`flex min-w-0 flex-col gap-3 border-b bg-zinc-950/45 p-3 transition-colors duration-200 sm:flex-row sm:items-start sm:p-4 motion-reduce:transition-none ${expanded ? "border-zinc-800" : "border-transparent"}`}>
        <div className="flex min-w-0 items-start gap-3">
          <AssetIcon src={entry.icon} alt={entry.name} size={64} className="h-14 w-14 sm:h-16 sm:w-16" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="m-0 text-base font-bold leading-6 text-zinc-50 sm:text-lg">{entry.name}</h2>
              <span className={`rounded border px-2 py-0.5 text-[11px] ${KIND_STYLES[entry.kind]}`}>
                {entry.kindLabel}
              </span>
            </div>
            <p className="m-0 mt-1.5 max-w-4xl text-sm leading-5 text-zinc-300">{entry.summary}</p>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            href={entry.source.href}
            className="relative inline-flex min-h-11 items-center justify-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-300 after:absolute after:-inset-1 after:content-[''] hover:border-cyan-700 hover:text-cyan-300 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 lg:min-h-9"
          >
            {entry.source.label}
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={`summon-details-${entry.id}`}
            className={`inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded border px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 lg:min-h-9 motion-reduce:transition-none ${
              expanded
                ? "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-cyan-700 hover:text-cyan-200"
                : "border-cyan-500/75 bg-cyan-950/80 text-cyan-100 hover:border-cyan-400 hover:bg-cyan-900/60"
            }`}
          >
            <BookOpenText aria-hidden="true" className="h-3.5 w-3.5" />
            {expanded ? "收起完整详情" : "展开完整详情"}
            <ChevronDown
              aria-hidden="true"
              className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </header>

      <div
        id={`summon-details-${entry.id}`}
        aria-hidden={!expanded}
        inert={!expanded}
        className={`grid overflow-hidden transition-[grid-template-rows,opacity] motion-reduce:transition-none ${
          expanded
            ? "grid-rows-[1fr] opacity-100 duration-300 ease-out"
            : "pointer-events-none grid-rows-[0fr] opacity-0 duration-200 ease-in"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={`p-3 transition-transform duration-300 sm:p-4 motion-reduce:transform-none motion-reduce:transition-none ${expanded ? "translate-y-0" : "-translate-y-1"}`}>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-zinc-800 bg-zinc-800 sm:grid-cols-3 lg:grid-cols-6">
          {facts.map(({ label, value }) => (
            <div key={label} className="min-w-0 bg-zinc-950/75 px-2.5 py-2">
              <dt className="text-[10px] leading-4 text-zinc-600">{label}</dt>
              <dd className="m-0 mt-0.5 break-words text-xs leading-5 text-zinc-300">{value}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-4" aria-labelledby={`mechanics-title-${entry.id}`}>
          <h3 id={`mechanics-title-${entry.id}`} className="m-0 mb-2 text-sm font-semibold text-zinc-100">
            技能与机制
          </h3>
          <div className="grid min-w-0 gap-2 lg:grid-cols-2">
            {entry.mechanics.map((mechanic) => (
              <MechanicCard key={mechanic.id} entryId={entry.id} mechanic={mechanic} />
            ))}
          </div>
        </section>

        <DamageSection entry={entry} />
        <RelatedSection entry={entry} />

        <details className="mt-4 border-t border-zinc-800/80">
          <summary className="flex min-h-10 w-fit cursor-pointer select-none items-center text-xs text-zinc-500 hover:text-zinc-300 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4">
            证据边界与配置说明
          </summary>
          <ul className="m-0 space-y-1 pb-1 pl-5 text-xs leading-5 text-zinc-500">
            <li>数据状态：{EVIDENCE_LABELS[entry.evidenceLevel]}</li>
            {entry.evidenceNotes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </details>
          </div>
        </div>
      </div>
    </article>
  );
}

function SharedSystems({ catalog }: { catalog: SummonCatalogView }) {
  return (
    <section id="summon-shared-systems" aria-label="召唤流搭配" className="scroll-mt-24 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 sm:p-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-stretch">
        <div className="grid min-w-0 gap-4">
          <div className="grid gap-2">
            {catalog.sharedSystems.map((system) => (
              <div key={system.id}>
                <h3 className="m-0 mb-2 text-sm font-semibold text-zinc-100">
                  {system.name}
                </h3>
                <MechanicCard entryId="shared" hideHeading mechanic={system} />
              </div>
            ))}
          </div>
          <div className="min-w-0">
            <h3 className="m-0 mb-2 text-sm font-semibold text-zinc-100">
              通用 Buff
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {catalog.sharedBuffs.map((buff) => <BuffCard key={`${buff.target}:${buff.buffId}`} buff={buff} />)}
            </div>
            {catalog.sharedTalents.length > 0 && (
              <details className="mt-2 rounded-md border border-zinc-800 bg-zinc-950/35 px-3">
                <summary className="flex min-h-10 cursor-pointer select-none items-center justify-between gap-2 text-xs font-medium text-zinc-300 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4">
                  相关 S3 联动
                </summary>
                <div className="pb-2">{catalog.sharedTalents.map((talent) => <TalentRow key={`${talent.kind}:${talent.id}`} talent={talent} />)}</div>
              </details>
            )}
          </div>
        </div>
        <div className="min-w-0 lg:flex lg:flex-col">
          <h3 className="m-0 mb-2 text-sm font-semibold text-zinc-100">
            通用召唤插件
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:flex-1 lg:auto-rows-fr">
            {catalog.sharedPerks.map((perk) => <PerkCard key={perk.slug} perk={perk} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SummonCompendiumClient({ catalog }: { catalog: SummonCatalogView }) {
  const locationSnapshot = useSyncExternalStore(
    subscribeToLocation,
    getLocationSnapshot,
    getServerLocationSnapshot,
  );
  const params = useMemo(
    () => new URLSearchParams(locationSnapshot.split("#")[0]),
    [locationSnapshot],
  );
  const search = params.get("sq") ?? "";
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());
  const kindValue = params.get("summon-kind");
  const kind: KindFilter = KIND_OPTIONS.some((option) => option.value === kindValue)
    ? kindValue as KindFilter
    : "all";
  const linkedSummon = params.get("summon");
  const summonFilters = useMemo(() => {
    const validIds = new Set(catalog.entries.map((entry) => entry.id));
    return new Set(params.getAll("summon-filter").filter((id) => validIds.has(id)));
  }, [catalog.entries, params]);
  const expandedIds = useMemo(() => {
    const validIds = new Set(catalog.entries.map((entry) => entry.id));
    return new Set(params.getAll("summon-open").filter((id) => validIds.has(id)));
  }, [catalog.entries, params]);
  const section = params.get("section");

  useEffect(() => {
    if (!linkedSummon) return;
    const targetId = section
      ? `summon-${linkedSummon}-${section}`
      : `summon-${linkedSummon}`;
    const frame = requestAnimationFrame(() => {
      revealLocatedTarget(targetId);
    });
    return () => cancelAnimationFrame(frame);
  }, [linkedSummon, section]);

  function toggleEntry(entryId: string) {
    const isExpanded = expandedIds.has(entryId) || linkedSummon === entryId;
    const next = new Set(expandedIds);
    if (isExpanded) next.delete(entryId);
    else next.add(entryId);

    const updates: Record<string, string | string[] | null> = {
      "summon-open": catalog.entries
        .filter((entry) => next.has(entry.id))
        .map((entry) => entry.id),
    };
    if (linkedSummon === entryId) {
      updates.summon = null;
      updates.section = null;
    }
    updateQuery(updates, linkedSummon === entryId ? "" : undefined);
  }

  const visibleEntries = useMemo(() => catalog.entries.filter((entry) => {
    if (summonFilters.size > 0 && !summonFilters.has(entry.id)) return false;
    if (kind !== "all" && entry.kind !== kind) return false;
    if (!deferredSearch) return true;
    const searchable = [
      entry.name,
      ...entry.aliases,
      entry.summary,
      entry.rateSummary,
      ...entry.searchTerms,
      ...entry.mechanics.flatMap((mechanic) => [
        mechanic.name,
        mechanic.summary,
        ...(mechanic.details ?? []),
        ...(mechanic.searchTerms ?? []),
      ]),
      ...entry.damageSources.flatMap((damage) => [damage.name, damage.role, damage.note ?? ""]),
      ...entry.buffs.flatMap((buff) => [String(buff.buffId), buff.name, buff.summary]),
      entry.perkSelectionNote ?? "",
      ...entry.perks.flatMap((perk) => [perk.name, perk.description ?? ""]),
      ...entry.talents.flatMap((talent) => [talent.name, ...talent.descriptions]),
    ].join(" ").toLocaleLowerCase();
    return searchable.includes(deferredSearch);
  }), [catalog.entries, deferredSearch, kind, summonFilters]);

  return (
    <div className="not-prose my-6 min-w-0 text-zinc-200">
      <nav
        aria-label="按召唤物筛选"
        className="flex min-w-0 flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/55 p-2 sm:flex-row sm:items-center"
      >
        <div className="flex shrink-0 items-center px-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <ListFilter aria-hidden="true" className="h-4 w-4 text-cyan-400" />
            召唤物筛选
          </span>
        </div>
        <div className="flex min-w-0 gap-2 overflow-x-auto pb-0.5 sm:pb-0 [scrollbar-width:thin]">
          {catalog.entries.map((entry) => {
            const selected = summonFilters.has(entry.id);
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  const next = new Set(summonFilters);
                  if (selected) next.delete(entry.id);
                  else next.add(entry.id);
                  updateQuery({
                    "summon-filter": catalog.entries
                      .filter((item) => next.has(item.id))
                      .map((item) => item.id),
                    summon: null,
                    section: null,
                  }, "");
                }}
                className={`inline-flex min-h-10 shrink-0 touch-manipulation items-center gap-2 rounded border px-2.5 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none ${
                  selected
                    ? "border-cyan-600 bg-cyan-950/45 text-cyan-200"
                    : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <AssetIcon src={entry.icon} alt="" size={24} className="h-6 w-6 border-zinc-800" />
                {entry.name}
              </button>
            );
          })}
        </div>
      </nav>

      <section aria-label="筛选召唤物" className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/55 p-2.5 sm:p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            <input
              type="search"
              value={search}
              onChange={(event) => updateQuery({ sq: event.target.value, summon: null, section: null }, "")}
              placeholder="搜名称、射速、技能、Buff、插件或乘区…"
              className="h-11 w-full rounded border border-zinc-700 bg-zinc-900 pl-9 pr-9 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-700 focus:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 lg:h-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => updateQuery({ sq: null }, "")}
                aria-label="清除搜索"
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-zinc-500 hover:text-zinc-200 focus-visible:outline-none focus-visible:underline"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </label>
          <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5 lg:pb-0">
            {KIND_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateQuery({ "summon-kind": option.value, summon: null, section: null }, "")}
                className={`min-h-10 shrink-0 rounded border px-3 text-xs font-medium focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 lg:min-h-9 ${
                  kind === option.value
                    ? "border-cyan-600 bg-cyan-950/45 text-cyan-200"
                    : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {(search || kind !== "all" || summonFilters.size > 0) && (
            <span className="shrink-0 text-xs text-zinc-600">{visibleEntries.length} / {catalog.entries.length}</span>
          )}
        </div>
      </section>

      <div className="mt-3 space-y-3">
        {visibleEntries.map((entry) => (
          <SummonEntry
            key={entry.id}
            entry={entry}
            linked={linkedSummon === entry.id}
            expanded={expandedIds.has(entry.id) || linkedSummon === entry.id}
            onToggle={() => toggleEntry(entry.id)}
          />
        ))}
        {visibleEntries.length === 0 && (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 px-4 text-center">
            <Search aria-hidden="true" className="h-6 w-6 text-zinc-700" />
            <p className="m-0 mt-2 text-sm font-medium text-zinc-300">没有匹配的召唤物</p>
            <button
              type="button"
              onClick={() => updateQuery({ sq: null, "summon-kind": null, "summon-filter": null, summon: null, section: null }, "")}
              className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-300 hover:border-cyan-700 hover:text-cyan-300 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              重置筛选
            </button>
          </div>
        )}
      </div>

      <div className="mt-3">
        <SharedSystems catalog={catalog} />
      </div>
    </div>
  );
}
