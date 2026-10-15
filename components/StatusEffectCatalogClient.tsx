"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BookOpenText,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { getMultiplierFactorStyle } from "@/components/multiplier-badge-styles";
import { getAssetPath } from "@/lib/path";
import { revealLocatedTarget } from "@/lib/locate-target";
import type {
  StatusEffectCatalogViewEntry,
  StatusEffectModifierReference,
  StatusEffectNumericalReference,
  StatusEffectPolarity,
  StatusEffectRelatedContent,
  StatusEffectRelatedContentType,
  StatusEffectTarget,
  StatusEffectVariant,
} from "@/types";

const PRACTICAL_PAGE_SIZE = 30;
const CONFIG_PAGE_SIZE = 60;

const CATEGORY_LABELS: Record<string, string> = {
  PositiveModifier: "属性增益",
  NegativeModifier: "属性减益",
  Independence: "独立状态",
  SpeedDown: "减速",
  DotDamage: "持续伤害",
  Recovery: "恢复",
  TemporaryShield: "临时护盾",
  Frozen: "冰冻",
  Invincible: "无敌",
  NoInjured: "免伤",
  Unknown: "未分类",
};

const POLARITY_LABELS: Record<StatusEffectPolarity, string> = {
  positive: "增益",
  negative: "减益",
};

const RELATED_TYPE_LABELS: Partial<Record<StatusEffectRelatedContentType, string>> = {
  perk: "插件",
  "overlimit-card": "超限卡片",
  "season-talent": "S3 天赋",
  weapon: "武器技能",
};

type CatalogView = "practical" | "config";
type PolarityFilter = "all" | StatusEffectPolarity;
type RelatedFilter =
  | "all"
  | "confirmed"
  | "multiplier"
  | StatusEffectRelatedContentType;

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function formatDuration(value: number) {
  if (value < 0) return "持续存在";
  if (value <= 0.1) return "瞬时";
  return `${formatNumber(value)} 秒`;
}

function formatDurationSet(variants: StatusEffectVariant[]) {
  const values = [...new Set(variants.map((variant) => formatDuration(variant.duration)))];
  return values.length > 3 ? `${values.slice(0, 3).join(" / ")} 等` : values.join(" / ");
}

function formatStackSet(variants: StatusEffectVariant[]) {
  const values = [...new Set(variants.map((variant) => variant.stackLimit))];
  return values.length === 1 ? `${values[0]} 层` : `${values.slice(0, 3).join(" / ")} 层`;
}

function subscribeToLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("status-effect-query-change", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("status-effect-query-change", callback);
  };
}

function getLocationSnapshot() {
  return `${window.location.search}${window.location.hash}`;
}

function getServerLocationSnapshot() {
  return "";
}

function updateCatalogQuery(
  updates: Record<string, string | null>,
  options: { keepBuff?: boolean } = {},
) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (!value || value === "all" || (key === "view" && value === "practical")) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }
  if (!options.keepBuff) {
    url.searchParams.delete("buff");
    url.hash = "";
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new Event("status-effect-query-change"));
}

function ModifierReference({
  id,
  references,
}: {
  id: number;
  references: Record<string, StatusEffectModifierReference[]>;
}) {
  const rows = references[String(id)];
  if (!rows) {
    return <span className="text-amber-300">{id}（未解析，已保留原始 ID）</span>;
  }

  return (
    <span>
      {id}：{rows.map((row) => {
        const description = row.attributeLabel || row.description || row.attributeName || "未命名属性";
        return `${description} [Lv.${row.level} ${row.operation} ${formatNumber(row.baseValue)} + ${formatNumber(row.coefficient)}×系数]`;
      }).join("；")}
    </span>
  );
}

function NumericalReference({
  id,
  references,
}: {
  id: number;
  references: Record<string, StatusEffectNumericalReference[]>;
}) {
  const rows = references[String(id)];
  if (!rows) {
    return <span className="text-amber-300">{id}（未解析，已保留原始 ID）</span>;
  }

  return (
    <span>
      {id}：{rows.map((row) => {
        const parts = [
          `Lv.${row.level}`,
          row.elementType || null,
          row.description || null,
          row.fleshDamageBase ? `基础伤害 ${formatNumber(row.fleshDamageBase)}` : null,
          row.hpScale ? `生命系数 ${formatNumber(row.hpScale)}` : null,
          row.hpBase ? `生命基数 ${formatNumber(row.hpBase)}` : null,
          row.settlements.length ? `结算 ${row.settlements.join("、")}` : null,
        ].filter(Boolean);
        return parts.join(" · ");
      }).join("；")}
    </span>
  );
}

function StatusEffectTechnicalDetails({
  entry,
  modifiers,
  numericals,
}: {
  entry: StatusEffectCatalogViewEntry;
  modifiers: Record<string, StatusEffectModifierReference[]>;
  numericals: Record<string, StatusEffectNumericalReference[]>;
}) {
  return (
    <details className="mt-3 border-t border-zinc-800 pt-2">
      <summary className="flex min-h-11 w-fit cursor-pointer select-none items-center text-xs font-medium text-zinc-400 hover:text-zinc-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4">
        原始配置 · {entry.variants.length} 个变体
      </summary>
      <div className="space-y-3 pb-1 text-xs leading-5 text-zinc-400">
        <p className="m-0 break-all">
          <span className="text-zinc-500">BuffID：</span>{entry.buffId}
        </p>
        {entry.variants.map((variant, index) => (
          <section
            key={`${variant.rowName}-${index}`}
            className="min-w-0 rounded border border-zinc-800 bg-zinc-950/60 p-3"
          >
            <div className="grid min-w-0 gap-x-6 gap-y-1 md:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)]">
              <p className="m-0 min-w-0 break-all text-zinc-200">
                {variant.rowName}
              </p>
              <p className="m-0 break-words">
                {POLARITY_LABELS[variant.polarity]} · {categoryLabel(variant.category)} · 显示位 {variant.displayMask}
              </p>
              <p className="m-0">
                持续 {formatDuration(variant.duration)} · 周期 {formatNumber(variant.period)} 秒 · 上限 {variant.stackLimit} 层
              </p>
              <p className="m-0 break-words">
                等级持续：{variant.levelDuration || "未配置"}
              </p>
            </div>
            {variant.modifierIds.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-zinc-800 pt-2">
                <p className="m-0 text-zinc-500">属性修正</p>
                {variant.modifierIds.map((id) => (
                  <p key={id} className="m-0 break-words">
                    <ModifierReference id={id} references={modifiers} />
                  </p>
                ))}
              </div>
            )}
            {variant.numericalId !== null && (
              <p className="m-0 mt-2 break-words border-t border-zinc-800 pt-2">
                <span className="text-zinc-500">伤害配置：</span>{" "}
                <NumericalReference id={variant.numericalId} references={numericals} />
              </p>
            )}
          </section>
        ))}
      </div>
    </details>
  );
}

function RelatedContentList({ items }: { items: StatusEffectRelatedContent[] }) {
  if (items.length === 0) return null;
  const confirmed = items.filter((item) => item.relation === "confirmed-source");
  const sameMultiplier = items.filter((item) => item.relation === "same-multiplier");

  const renderItems = (values: StatusEffectRelatedContent[]) => (
    <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
      {values.map((item) => (
        <li key={`${item.id}:${item.href}`} className="min-w-0 rounded border border-zinc-800 bg-zinc-950/45 p-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-medium text-zinc-500">
                {item.typeLabel}{item.season ? ` · ${item.season}` : ""}
              </p>
              <Link
                href={item.href}
                className="mt-1 inline-flex min-h-6 max-w-full items-center gap-1 break-words text-sm font-medium text-cyan-300 hover:text-cyan-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
              >
                {item.title}
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              </Link>
            </div>
            <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
              item.relation === "confirmed-source"
                ? "border-emerald-800 bg-emerald-950/50 text-emerald-300"
                : "border-zinc-700 bg-zinc-900 text-zinc-400"
            }`}>
              {item.relationLabel}
            </span>
          </div>
          <p className="m-0 mt-2 text-xs leading-5 text-zinc-500">{item.note}</p>
          {item.factorLabels.length > 0 && (
            <p className="m-0 mt-1 text-[11px] text-violet-300">
              {item.factorLabels.join(" · ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mt-4 space-y-4">
      {confirmed.length > 0 && (
        <section>
          <h4 className="m-0 mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            确认施加来源
          </h4>
          {renderItems(confirmed)}
        </section>
      )}
      {sameMultiplier.length > 0 && (
        <section>
          <h4 className="m-0 mb-1 text-xs font-semibold text-zinc-300">
            同乘区内容参考
          </h4>
          <p className="m-0 mb-2 text-xs leading-5 text-zinc-500">
            这些内容使用同一伤害通道，方便继续查增伤机制；它们不一定会施加当前 Buff。
          </p>
          {renderItems(sameMultiplier)}
        </section>
      )}
    </div>
  );
}

function StatusEffectRow({
  entry,
  view,
  modifiers,
  numericals,
}: {
  entry: StatusEffectCatalogViewEntry;
  view: CatalogView;
  modifiers: Record<string, StatusEffectModifierReference[]>;
  numericals: Record<string, StatusEffectNumericalReference[]>;
}) {
  const icon = entry.icon;
  const confirmedCount = entry.relatedContent.filter(
    (item) => item.relation === "confirmed-source",
  ).length;
  const otherDescriptions = entry.descriptions.filter(
    (description) => description !== entry.descriptions[0],
  );

  return (
    <article
      id={`status-effect-${entry.buffId}`}
      aria-labelledby={`buff-label-${entry.buffId}`}
      className="scroll-mt-24 min-w-0 px-3 py-3 target:bg-cyan-950/20 sm:px-4 lg:py-2.5"
    >
      <div className="grid min-w-0 gap-2.5 lg:grid-cols-[2.5rem_minmax(10rem,0.85fr)_minmax(16rem,2fr)_6rem_6rem] lg:items-start lg:gap-3">
        <div className="flex items-start gap-3 lg:contents">
          {icon ? (
            <Image
              src={getAssetPath(icon)}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded border border-zinc-700 bg-zinc-950 object-contain"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-zinc-800 bg-zinc-950 text-zinc-600">
              <CircleDashed aria-hidden="true" size={19} />
            </div>
          )}
          <div className="min-w-0 lg:col-start-2">
            <p
              id={`buff-label-${entry.buffId}`}
              className="m-0 break-words text-sm font-semibold leading-5 text-zinc-100"
            >
              {entry.name}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className="rounded border border-cyan-900/80 bg-cyan-950/30 px-1.5 py-0.5 text-[11px] text-cyan-300">
                {entry.group.label}
              </span>
              {entry.polarities.map((polarity) => (
                <span
                  key={polarity}
                  className={`rounded border px-1.5 py-0.5 text-[11px] ${
                    polarity === "positive"
                      ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                      : "border-rose-800 bg-rose-950/40 text-rose-300"
                  }`}
                >
                  {POLARITY_LABELS[polarity]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 lg:col-start-3">
          <p className="m-0 break-words text-sm leading-5 text-zinc-200">
            {entry.summary}
          </p>
          {entry.multiplierRelations.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {entry.multiplierRelations.map((relation) => (
                <Link
                  key={relation.modifierTypeId}
                  href={relation.href}
                  className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors duration-200 hover:brightness-125 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none ${getMultiplierFactorStyle(relation.factorId)}`}
                >
                  {relation.displayLabel}
                </Link>
              ))}
            </div>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-1.5 text-xs lg:contents">
          <div className="rounded bg-zinc-950/55 px-2 py-1.5 lg:col-start-4">
            <dt className="text-zinc-500">持续</dt>
            <dd className="m-0 mt-1 text-zinc-200">{formatDurationSet(entry.variants)}</dd>
          </div>
          <div className="rounded bg-zinc-950/55 px-2 py-1.5 lg:col-start-5">
            <dt className="text-zinc-500">最多叠加</dt>
            <dd className="m-0 mt-1 text-zinc-200">{formatStackSet(entry.variants)}</dd>
          </div>
        </dl>
      </div>

      <details className="mt-2 border-t border-zinc-800/80">
        <summary className="flex min-h-11 w-fit cursor-pointer select-none items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 lg:min-h-9">
          <BookOpenText aria-hidden="true" className="h-4 w-4" />
          效果与关联内容
          {(confirmedCount > 0 || entry.multiplierRelations.length > 0) && (
            <span className="text-zinc-600">
              · {confirmedCount > 0 ? `${confirmedCount} 个确认来源` : `${entry.multiplierRelations.length} 个乘区`}
            </span>
          )}
        </summary>
        <div className="pb-1 pt-1">
          {otherDescriptions.length > 0 && (
            <div className="mb-3 rounded border border-zinc-800 bg-zinc-950/40 p-3 text-xs leading-5 text-zinc-400">
              <p className="m-0 mb-1 font-medium text-zinc-300">其他配置描述</p>
              {otherDescriptions.slice(0, 6).map((description) => (
                <p key={description} className="m-0 break-words">{description}</p>
              ))}
            </div>
          )}
          <RelatedContentList items={entry.relatedContent} />
          {view === "config" && (
            <StatusEffectTechnicalDetails
              entry={entry}
              modifiers={modifiers}
              numericals={numericals}
            />
          )}
        </div>
      </details>
    </article>
  );
}

function relatedFilterMatches(
  entry: StatusEffectCatalogViewEntry,
  filter: RelatedFilter,
) {
  if (filter === "all") return true;
  if (filter === "confirmed") {
    return entry.relatedContent.some((item) => item.relation === "confirmed-source");
  }
  if (filter === "multiplier") return entry.multiplierRelations.length > 0;
  return entry.relatedContent.some((item) => item.type === filter);
}

export function StatusEffectCatalogClient({
  entries,
  modifiers,
  numericals,
}: {
  target: StatusEffectTarget;
  entries: StatusEffectCatalogViewEntry[];
  modifiers: Record<string, StatusEffectModifierReference[]>;
  numericals: Record<string, StatusEffectNumericalReference[]>;
}) {
  const locationSnapshot = useSyncExternalStore(
    subscribeToLocation,
    getLocationSnapshot,
    getServerLocationSnapshot,
  );
  const params = useMemo(
    () => new URLSearchParams(locationSnapshot.split("#")[0]),
    [locationSnapshot],
  );
  const search = params.get("q") ?? "";
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());
  const view: CatalogView = params.get("view") === "config" ? "config" : "practical";
  const polarityValue = params.get("polarity");
  const polarity: PolarityFilter =
    polarityValue === "positive" || polarityValue === "negative"
      ? polarityValue
      : "all";
  const group = params.get("group") ?? "all";
  const category = params.get("category") ?? "all";
  const relatedValue = params.get("source") ?? "all";
  const related: RelatedFilter = [
    "confirmed",
    "multiplier",
    "perk",
    "overlimit-card",
    "season-talent",
    "weapon",
    "overlimit-bond",
    "post",
  ].includes(relatedValue)
    ? relatedValue as RelatedFilter
    : "all";
  const linkedBuffId = Number(params.get("buff")) || null;
  const pageSize = view === "practical" ? PRACTICAL_PAGE_SIZE : CONFIG_PAGE_SIZE;
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    if (!linkedBuffId) return;
    const frame = requestAnimationFrame(() => {
      revealLocatedTarget(`status-effect-${linkedBuffId}`);
    });
    return () => cancelAnimationFrame(frame);
  }, [linkedBuffId]);

  const availableEntries = useMemo(
    () => view === "practical"
      ? entries.filter((entry) => entry.practical || entry.buffId === linkedBuffId)
      : entries,
    [entries, linkedBuffId, view],
  );
  const categories = useMemo(
    () => [...new Set(availableEntries.flatMap((entry) => entry.categories))].sort(
      (left, right) => categoryLabel(left).localeCompare(categoryLabel(right), "zh-CN"),
    ),
    [availableEntries],
  );
  const availablePolarities = useMemo(
    () => [...new Set(availableEntries.flatMap((entry) => entry.polarities))],
    [availableEntries],
  );
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of availableEntries) {
      counts.set(entry.group.id, (counts.get(entry.group.id) ?? 0) + 1);
    }
    return counts;
  }, [availableEntries]);
  const groups = useMemo(
    () => [...new Map(availableEntries.map((entry) => [entry.group.id, entry.group])).values()],
    [availableEntries],
  );
  const filteredEntries = useMemo(
    () => availableEntries.filter((entry) => {
      if (linkedBuffId && !deferredSearch && entry.buffId !== linkedBuffId) return false;
      if (
        deferredSearch &&
        !entry.searchTerms.some((term) => term.toLocaleLowerCase().includes(deferredSearch))
      ) return false;
      if (polarity !== "all" && !entry.polarities.includes(polarity)) return false;
      if (group !== "all" && entry.group.id !== group) return false;
      if (view === "config" && category !== "all" && !entry.categories.includes(category)) {
        return false;
      }
      return relatedFilterMatches(entry, related);
    }),
    [
      availableEntries,
      category,
      deferredSearch,
      group,
      linkedBuffId,
      polarity,
      related,
      view,
    ],
  );
  const visibleEntries = filteredEntries.slice(0, visibleCount);
  const activeAdvancedFilters = [
    polarity !== "all",
    related !== "all",
    view === "config" && category !== "all",
  ].filter(Boolean).length;

  const resetVisible = (nextPageSize = pageSize) => setVisibleCount(nextPageSize);
  const setFilter = (key: string, value: string | null, nextPageSize = pageSize) => {
    updateCatalogQuery({ [key]: value });
    resetVisible(nextPageSize);
  };
  const resetFilters = () => {
    updateCatalogQuery({
      q: null,
      group: null,
      polarity: null,
      category: null,
      source: null,
    });
    resetVisible();
  };

  return (
    <div className="not-prose my-6 min-w-0">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/65 p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(18rem,1.4fr)] lg:items-end">
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-xs font-medium text-zinc-400">查看方式</legend>
            <div className="grid grid-cols-2 gap-1 rounded border border-zinc-800 bg-zinc-950 p-1">
              {([
                ["practical", "玩家视图", "按战斗用途整理"],
                ["config", "完整配置", "查看全部内部记录"],
              ] as const).map(([value, label, description]) => {
                const selected = view === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      updateCatalogQuery({ view: value });
                      resetVisible(value === "practical" ? PRACTICAL_PAGE_SIZE : CONFIG_PAGE_SIZE);
                    }}
                    className={`min-h-11 rounded border px-3 py-1 text-left focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                      selected
                        ? "border-cyan-700 bg-cyan-950/50 text-white"
                        : "border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                    }`}
                  >
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="hidden text-[10px] text-zinc-500 sm:block">{description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">搜索状态与关联内容</span>
            <span className="relative block">
              <Search
                aria-hidden="true"
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  updateCatalogQuery({ q: event.target.value || null });
                  resetVisible();
                }}
                placeholder="例如：易伤、武器伤害、插件名、S3 天赋或 BuffID"
                className="h-11 w-full rounded border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-11 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:border-zinc-400 focus-visible:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setFilter("q", null)}
                  aria-label="清空搜索"
                  title="清空搜索"
                  className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
                >
                  <span className="sr-only">清空</span>
                  <X aria-hidden="true" size={17} />
                </button>
              )}
            </span>
          </label>
        </div>

        <div className="mt-4">
          <p className="m-0 mb-1.5 text-xs font-medium text-zinc-400">按战斗用途浏览</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4">
            <button
              type="button"
              aria-pressed={group === "all"}
              onClick={() => setFilter("group", null)}
              className={`min-h-11 rounded border px-3 py-2 text-left text-xs focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                group === "all"
                  ? "border-cyan-700 bg-cyan-950/50 text-cyan-100"
                  : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              <span className="font-medium">全部用途</span>
              <span className="ml-1 text-zinc-600">{availableEntries.length}</span>
            </button>
            {groups.map((item) => {
              const selected = group === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  title={item.description}
                  onClick={() => setFilter("group", item.id)}
                  className={`min-h-11 rounded border px-3 py-2 text-left text-xs focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                    selected
                      ? "border-cyan-700 bg-cyan-950/50 text-cyan-100"
                      : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                  }`}
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="ml-1 text-zinc-600">{groupCounts.get(item.id) ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        <details className="mt-3 rounded border border-zinc-800 bg-zinc-950/30 px-3">
          <summary className="flex min-h-11 cursor-pointer select-none items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4">
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            更多筛选{activeAdvancedFilters > 0 ? ` · 已选 ${activeAdvancedFilters} 项` : ""}
          </summary>
          <div
            className={`grid gap-3 border-t border-zinc-800 py-3 ${
              view === "config" ? "md:grid-cols-3" : "md:grid-cols-2"
            }`}
          >
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs text-zinc-500">增益 / 减益</span>
              <select
                value={polarity}
                onChange={(event) => setFilter("polarity", event.target.value)}
                className="h-11 w-full rounded border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 focus-visible:border-zinc-400 focus-visible:outline-none"
              >
                <option value="all">全部</option>
                {availablePolarities.map((value) => (
                  <option key={value} value={value}>{POLARITY_LABELS[value]}</option>
                ))}
              </select>
            </label>

            <label className="min-w-0">
              <span className="mb-1.5 block text-xs text-zinc-500">关联内容</span>
              <select
                value={related}
                onChange={(event) => setFilter("source", event.target.value)}
                className="h-11 w-full rounded border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 focus-visible:border-zinc-400 focus-visible:outline-none"
              >
                <option value="all">全部</option>
                <option value="confirmed">有确认施加来源</option>
                <option value="multiplier">有增伤乘区</option>
                {Object.entries(RELATED_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            {view === "config" ? (
              <label className="min-w-0">
                <span className="mb-1.5 block text-xs text-zinc-500">原始配置分类</span>
                <select
                  value={category}
                  onChange={(event) => setFilter("category", event.target.value)}
                  className="h-11 w-full rounded border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 focus-visible:border-zinc-400 focus-visible:outline-none"
                >
                  <option value="all">全部分类</option>
                  {categories.map((value) => (
                    <option key={value} value={value}>{categoryLabel(value)}（{value}）</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </details>

        <div className="mt-3 text-xs text-zinc-500" aria-live="polite">
          <p className="m-0">
            找到 <span className="font-medium text-zinc-300">{filteredEntries.length}</span> 项，当前显示 {visibleEntries.length} 项
          </p>
        </div>

        {linkedBuffId && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-cyan-900/70 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-200">
            <span>已定位 BuffID {linkedBuffId}</span>
            <button
              type="button"
              onClick={() => {
                updateCatalogQuery({ buff: null });
                resetVisible();
              }}
              className="min-h-8 px-2 font-medium hover:text-white focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
            >
              显示全部
            </button>
          </div>
        )}
      </div>

      {visibleEntries.length > 0 ? (
        <div className="mt-3 divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
          {visibleEntries.map((entry) => (
            <StatusEffectRow
              key={entry.buffId}
              entry={entry}
              view={view}
              modifiers={modifiers}
              numericals={numericals}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-zinc-700 px-4 py-12 text-center">
          <Filter aria-hidden="true" className="mx-auto h-6 w-6 text-zinc-600" />
          <p className="m-0 mt-3 text-sm text-zinc-400">没有符合当前条件的状态</p>
          <p className="m-0 mt-1 text-xs text-zinc-600">可以换一个关键词，或清空用途与高级筛选。</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 min-h-11 rounded border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-300 hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
          >
            重置筛选
          </button>
        </div>
      )}

      {visibleEntries.length < filteredEntries.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + pageSize)}
          className="mt-4 min-h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
        >
          继续加载（剩余 {filteredEntries.length - visibleEntries.length} 项）
        </button>
      )}
    </div>
  );
}
