"use client";

import Image from "next/image";
import { RotateCcw, Search, X } from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { OverlimitMapRotation } from "@/components/OverlimitMapRotation";
import { OverlimitLevelCatalog } from "@/components/OverlimitLevelCatalog";
import { OverlimitBondCatalog } from "@/components/OverlimitBondCatalog";
import { OverlimitVersionNavigation } from "@/components/OverlimitVersionNavigation";
import {
  matchesWeaponApplicability,
  WeaponApplicabilityFilterSection,
  type WeaponApplicabilityFilter,
} from "@/components/WeaponApplicabilityFilter";
import {
  OVERLIMIT_QUALITY_STYLES,
  getOverlimitBondForegroundColor,
  getOverlimitBondSurfaceStyle,
  OverlimitBondIcon,
  OverlimitTagBadge,
} from "@/components/OverlimitCardMeta";
import { OverlimitHoverPreview } from "@/components/OverlimitHoverPreview";
import { getOverlimitCatalogEffects, OverlimitEffectValues } from "@/components/OverlimitEffectValues";
import { MultiplierBadges } from "@/components/MultiplierBadges";
import { getProviderRelationsForSource } from "@/lib/multiplier-data";
import { renderInlineDescription } from "@/components/InlineDescription";
import { WEAPON_TYPE_ID_MAP } from "@/constants/weapons";
import { useSelection, useSessionValue } from "@/hooks/useSelection";
import { restoreCatalogNavigation } from "@/lib/catalog-navigation";
import { getAssetPath } from "@/lib/path";
import type {
  OverlimitCard,
  OverlimitCardTag,
  OverlimitBondCatalog as OverlimitBondCatalogData,
  OverlimitBondName,
  OverlimitLevelCatalog as OverlimitLevelCatalogData,
  OverlimitMapRotationSchedule,
  PerkSlot,
} from "@/types";

interface OverlimitPageClientProps {
  initialCards: OverlimitCard[];
  bondCatalog: OverlimitBondCatalogData | null;
  levelCatalog: OverlimitLevelCatalogData | null;
  mapRotation: OverlimitMapRotationSchedule | null;
  season: { id: string; label: string; status: "current" | "preload"; updatedAt: string };
  basePath?: string;
  sourceSeason?: string;
  /** Current-release IDs for preview comparison; bond/effect changes do not create a new card. */
  existingCardIds?: string[];
  versions?: { href: string; label: string }[];
}

type OverlimitModule = "cards" | "bonds" | "levels" | "map-rotation";
type OverlimitSlotFilter = PerkSlot | "unknown";

const OVERLIMIT_MODULES: readonly {
  id: OverlimitModule;
  label: string;
}[] = [
  { id: "cards", label: "卡片图鉴" },
  { id: "map-rotation", label: "地图轮换" },
  { id: "levels", label: "等级图鉴" },
  { id: "bonds", label: "羁绊效果" },
];

const OVERLIMIT_MODULE_IDS = new Set<OverlimitModule>(
  OVERLIMIT_MODULES.map((module) => module.id),
);

function getModuleFromHash(): OverlimitModule {
  const queryModule = new URLSearchParams(window.location.search).get("module");
  if (queryModule && OVERLIMIT_MODULE_IDS.has(queryModule as OverlimitModule)) {
    return queryModule as OverlimitModule;
  }
  const moduleId = window.location.hash.slice(1) as OverlimitModule;
  if (moduleId.startsWith("bond-")) return "bonds";
  return OVERLIMIT_MODULE_IDS.has(moduleId) ? moduleId : "cards";
}

const QUALITY_OPTIONS = [5, 4, 3] as const;

function OverlimitCardItem({
  card,
  eager,
  basePath,
  sourceSeason,
}: {
  card: OverlimitCard;
  eager?: boolean;
  basePath: string;
  sourceSeason?: string;
}) {
  const qualityStyle =
    OVERLIMIT_QUALITY_STYLES[card.quality] ?? OVERLIMIT_QUALITY_STYLES[4];
  const hasThreeEffectRows = getOverlimitCatalogEffects(card).length >= 3;
  const relations = getProviderRelationsForSource({ type: "overlimit-card", id: card.id,
    ...(sourceSeason ? { season: sourceSeason } : {}) });
  const factorLabels = [
    ...new Map(relations.map(relation => [relation.factorId, relation.factorLabel])).values(),
  ];

  return (
    <div className="catalog-card relative min-w-0">
      <OverlimitHoverPreview card={card} href={`${basePath}/${card.id}`}>
        <article
          className={`catalog-card-frame flex min-h-[290px] flex-col overflow-hidden rounded-lg border-2 ${qualityStyle.border} ${qualityStyle.bg} sm:min-h-[344px]`}
        >
        <span className="sr-only">品质：{qualityStyle.label}</span>
        <div aria-hidden="true" className={`h-1 w-full ${qualityStyle.bar}`} />
        <div
          className="flow-root min-h-11 border-b border-zinc-700/80 px-2 py-2"
        >
          {/* Reserve the badges' intrinsic size without nesting links inside the card link. */}
          {factorLabels.length > 0 && (
            <div aria-hidden="true" className={`invisible float-right ml-1 grid ${factorLabels.length > 1 ? "pr-2" : ""}`}>
              {factorLabels.map(label => (
                <span key={label} className="col-start-1 row-start-1 min-h-6 whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-medium leading-4">
                  {label}
                </span>
              ))}
            </div>
          )}
          <div className="flex min-h-6 flex-wrap content-start gap-1">
            {card.tags.map((tag) => (
              <OverlimitTagBadge
                key={tag.id}
                tag={tag}
                compactOnMobile={relations.length > 0}
              />
            ))}
          </div>
        </div>

        <div className={`relative flex flex-1 flex-col items-center px-3 pb-4 sm:px-2 ${hasThreeEffectRows ? "pt-9" : "pt-5"}`}>
          <div className="pointer-events-none absolute inset-x-2 top-1 z-10">
            <OverlimitEffectValues card={card} variant="catalog" />
          </div>

          <div className="flex h-24 w-24 items-center justify-center sm:h-32 sm:w-32">
            <Image
              src={getAssetPath(card.icon)}
              alt=""
              width={128}
              height={128}
              loading={eager ? "eager" : "lazy"}
              sizes="(max-width: 639px) 96px, 128px"
              className="h-full w-full object-contain"
              style={{ filter: qualityStyle.iconFilter }}
            />
          </div>

          <h3 className={`text-center text-base font-semibold leading-6 text-white sm:text-lg ${hasThreeEffectRows ? "mt-0" : "mt-4"}`}>
            {card.name}
          </h3>
          <p className="mt-2 whitespace-pre-line break-words text-center text-[13px] leading-5 text-zinc-300">
            {renderInlineDescription(card.description)}
          </p>
        </div>
        </article>
      </OverlimitHoverPreview>
      {relations.length > 0 && <MultiplierBadges relations={relations} variant="catalog-stacked"
        className="absolute right-2 top-4 z-20 justify-end" />}
    </div>
  );
}

export default function OverlimitPageClient({
  initialCards,
  bondCatalog,
  levelCatalog,
  mapRotation,
  basePath = "/overlimit",
  sourceSeason,
  existingCardIds,
  versions = [],
}: OverlimitPageClientProps) {
  useEffect(() => {
    restoreCatalogNavigation();
  }, []);

  const [activeModule, setActiveModule] =
    useState<OverlimitModule>("cards");
  const [query, setQuery] = useSessionValue("query");
  const [cardOrigin, setCardOrigin] = useSessionValue("card-origin", "all");
  const existingIds = useMemo(() => existingCardIds ? new Set(existingCardIds) : null, [existingCardIds]);
  const newCardCount = existingIds ? initialCards.filter(card => !existingIds.has(card.id)).length : 0;
  const qualityState = useSelection<number>("quality", undefined, Number);
  const slotState = useSelection<OverlimitSlotFilter>(
    "slot",
    undefined,
    value => value === "unknown" ? value : Number(value) as PerkSlot,
  );
  const weightState = useSelection<number>("weight", undefined, Number);
  const weaponApplicabilityState = useSelection<WeaponApplicabilityFilter>("weapon-applicability");
  const tagState = useSelection<string>("tag");
  const selectedQualities = qualityState.selected;
  const selectedSlots = slotState.selected;
  const selectedWeights = weightState.selected;
  const selectedWeaponApplicability = weaponApplicabilityState.selected;
  const selectedTags = tagState.selected;
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("zh-CN"));

  const modules = useMemo(() => OVERLIMIT_MODULES.filter(module =>
    module.id === "cards" ||
    (module.id === "bonds" && bondCatalog !== null) ||
    (module.id === "levels" && levelCatalog !== null) ||
    (module.id === "map-rotation" && mapRotation !== null)
  ), [bondCatalog, levelCatalog, mapRotation]);
  const slotOptions = [...new Set(initialCards.flatMap(card => card.slot === undefined ? [] : [card.slot]))].sort();
  const hasUnknownSlots = initialCards.some(card => card.slot === undefined);
  const weightOptions = [...new Set(initialCards.flatMap(card => card.weight === undefined ? [] : [card.weight]))].sort((a, b) => a - b);

  useEffect(() => {
    const syncModuleFromHash = () => {
      const requested = getModuleFromHash();
      setActiveModule(modules.some(module => module.id === requested) ? requested : "cards");
    };
    const initialSyncFrame = window.requestAnimationFrame(syncModuleFromHash);

    window.addEventListener("hashchange", syncModuleFromHash);
    window.addEventListener("popstate", syncModuleFromHash);
    return () => {
      window.cancelAnimationFrame(initialSyncFrame);
      window.removeEventListener("hashchange", syncModuleFromHash);
      window.removeEventListener("popstate", syncModuleFromHash);
    };
  }, [modules]);

  useEffect(() => {
    if (activeModule !== "bonds") return;
    let targetId: string;
    try { targetId = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
    if (!targetId.startsWith("bond-")) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeModule]);

  const tagOptions = useMemo(() => {
    const tags = new Map<string, OverlimitCardTag>();
    for (const card of initialCards) {
      for (const tag of card.tags) {
        if (!tags.has(tag.id)) tags.set(tag.id, tag);
      }
    }
    return [...tags.values()].sort((a, b) => Number(a.id) - Number(b.id));
  }, [initialCards]);

  const availableWeaponApplicability = useMemo(() => {
    const available = new Set<WeaponApplicabilityFilter>();

    for (const card of initialCards) {
      if (card.applicabilityKnown === false) continue;
      if (card.weaponItems.length > 0) {
        available.add("专属插件");
      } else if (card.weaponType.length === 0) {
        available.add("全部武器类型");
      }

      for (const weaponTypeId of card.weaponType) {
        const weaponType = WEAPON_TYPE_ID_MAP[weaponTypeId];
        if (weaponType) available.add(weaponType);
      }
    }

    return available;
  }, [initialCards]);

  const filteredCards = useMemo(() => {
    return initialCards
      .filter((card) => {
        if (existingIds && cardOrigin !== "all" && existingIds.has(card.id) !== (cardOrigin === "existing")) return false;
        const matchesQuality =
          selectedQualities.size === 0 || selectedQualities.has(card.quality);
        if (!matchesQuality) return false;

        const matchesSlot =
          selectedSlots.size === 0 ||
          (card.slot !== undefined && selectedSlots.has(card.slot)) ||
          (card.slot === undefined && selectedSlots.has("unknown"));
        if (!matchesSlot) return false;

        const matchesWeight =
          selectedWeights.size === 0 || (card.weight !== undefined && selectedWeights.has(card.weight));
        if (!matchesWeight) return false;

        const matchesWeaponType = (selectedWeaponApplicability.size === 0 || card.applicabilityKnown !== false) && matchesWeaponApplicability(
          selectedWeaponApplicability,
          card.weaponType,
          card.weaponItems.length > 0,
        );
        if (!matchesWeaponType) return false;

        const matchesTags =
          selectedTags.size === 0 ||
          card.tags.some((tag) => selectedTags.has(tag.id));
        if (!matchesTags) return false;
        if (!deferredQuery) return true;

        const searchText = [
          card.name,
          card.description,
          ...card.weaponNames,
          ...card.tags.map((tag) => tag.name),
          ...(card.effectValues ?? []).flatMap((effect) => [
            effect.label,
            ...effect.stages.flatMap((stage) => [
              stage.condition ?? "",
              stage.value,
            ]),
          ]),
        ]
          .join(" ")
          .toLocaleLowerCase("zh-CN");
        return searchText.includes(deferredQuery);
      })
      .sort((a, b) => b.quality - a.quality);
  }, [
    deferredQuery,
    initialCards,
    existingIds,
    cardOrigin,
    selectedQualities,
    selectedSlots,
    selectedWeights,
    selectedTags,
    selectedWeaponApplicability,
  ]);

  const filteredCardsTotalWeight = useMemo(
    () => filteredCards.length > 0 && filteredCards.every(card => card.weight !== undefined)
      ? filteredCards.reduce((total, card) => total + (card.weight ?? 0), 0) : undefined,
    [filteredCards],
  );

  const hasFilters =
    cardOrigin !== "all" ||
    query.length > 0 ||
    selectedQualities.size > 0 ||
    selectedSlots.size > 0 ||
    selectedWeights.size > 0 ||
    selectedWeaponApplicability.size > 0 ||
    selectedTags.size > 0;
  const eagerIcons = new Set(
    filteredCards.slice(0, 5).map((card) => card.icon),
  );

  const resetFilters = () => {
    setCardOrigin("all");
    setQuery("");
    qualityState.clear();
    slotState.clear();
    weightState.clear();
    weaponApplicabilityState.clear();
    tagState.clear();
  };

  const selectModule = (module: OverlimitModule) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("module");
    url.hash = module;
    if (url.href !== window.location.href) window.history.pushState(null, "", url);
    setActiveModule(module);
  };

  const searchCardsByBonds = (activeBonds: OverlimitBondName[]) => {
    resetFilters();
    const bondNames = new Set<string>(activeBonds);
    tagState.update(
      new Set(
        tagOptions
          .filter((tag) => bondNames.has(tag.name))
          .map((tag) => tag.id),
      ),
    );
    selectModule("cards");
    window.requestAnimationFrame(() => {
      const cardCatalog = document.getElementById("overlimit-card-catalog");
      cardCatalog?.focus({ preventScroll: true });
      cardCatalog?.scrollIntoView({ block: "start" });
    });
  };

  const searchCardsByBond = (bondName: OverlimitBondName) => {
    searchCardsByBonds([bondName]);
  };

  return (
    <>
      <OverlimitVersionNavigation versions={versions} activePath={basePath} />
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">超限图鉴</h1>
      </header>

      <nav
        aria-label="超限图鉴模块"
        className="mb-6 flex flex-wrap items-center gap-2"
      >
        {modules.map((module) => {
          const active = activeModule === module.id;

          return (
            <button
              key={module.id}
              type="button"
              aria-pressed={active}
              onClick={() => void selectModule(module.id)}
              className={`min-h-11 touch-manipulation rounded border px-4 py-2 text-base font-semibold transition-colors outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                active
                  ? "border-zinc-400 bg-zinc-600 text-white"
                  : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {module.label}
            </button>
          );
        })}
      </nav>

      {activeModule === "cards" && (
          <section
            id="overlimit-card-catalog"
            aria-label="卡片图鉴"
            tabIndex={-1}
            className="outline-none"
          >
        <h2 className="sr-only">卡片图鉴</h2>
        <div className="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
          <div role="search" className="relative mb-6 max-w-xl">
            <label htmlFor="overlimit-search" className="sr-only">
              搜索超限卡片
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            />
            <input
              id="overlimit-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索卡片名称、效果或词条"
              className="min-h-11 w-full rounded border border-zinc-700 bg-zinc-900/80 py-2 pl-10 pr-11 text-base text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus-visible:border-zinc-400 focus-visible:underline"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="清空搜索"
                title="清空搜索"
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
              >
                <X aria-hidden="true" className="h-4 w-4" /><span className="sr-only">清空搜索</span>
              </button>
            )}
          </div>

          <div className="mb-5 grid gap-x-6 gap-y-4 lg:grid-cols-3">
          <fieldset>
            <legend className="mb-3 text-lg font-semibold text-zinc-300">
              卡片品质
            </legend>
            <div className="grid max-w-md grid-cols-3 gap-2">
              {QUALITY_OPTIONS.map((quality) => {
                const style = OVERLIMIT_QUALITY_STYLES[quality];
                const selected = selectedQualities.has(quality);
                return (
                  <button
                    key={quality}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => qualityState.toggle(quality)}
                    className={`flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded border px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                      selected
                        ? style.selected
                        : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/70 hover:text-white"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-3 w-3 shrink-0 ${style.bar}`}
                    />
                    <span>{style.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {slotOptions.length > 0 && <fieldset>
            <legend className="mb-3 text-lg font-semibold text-zinc-300">
              卡片槽位
            </legend>
            <div className="grid max-w-lg grid-cols-5 gap-2">
              {slotOptions.map((slot) => {
                const selected = selectedSlots.has(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => slotState.toggle(slot)}
                    className={`flex min-h-11 touch-manipulation items-center justify-center rounded border px-3 py-2 text-sm font-medium tabular-nums transition-colors outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                      selected
                        ? "border-zinc-400 bg-zinc-600 text-white"
                        : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/70 hover:text-white"
                    }`}
                  >
                    {slot}插
                  </button>
                );
              })}
              {hasUnknownSlots && (
                <button
                  key="unknown"
                  type="button"
                  aria-pressed={selectedSlots.has("unknown")}
                  onClick={() => slotState.toggle("unknown")}
                  className={`flex min-h-11 touch-manipulation items-center justify-center whitespace-nowrap rounded border px-1.5 py-2 text-sm font-medium transition-colors outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                    selectedSlots.has("unknown")
                      ? "border-zinc-400 bg-zinc-600 text-white"
                      : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/70 hover:text-white"
                  }`}
                >
                  无法确认
                </button>
              )}
            </div>
          </fieldset>}

          {existingIds && <fieldset>
            <legend className="mb-3 text-lg font-semibold text-zinc-300">卡片来源</legend>
            <div className="grid max-w-md grid-cols-3 gap-2">
              {([
                { id: "all", label: "全部", count: initialCards.length },
                { id: "new", label: "新卡", count: newCardCount },
                { id: "existing", label: "老卡", count: initialCards.length - newCardCount },
              ] as const).map(option => (
                <button key={option.id} type="button" aria-pressed={cardOrigin === option.id}
                  onClick={() => setCardOrigin(option.id)}
                  className={`flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded border px-2 py-2 text-sm font-medium transition-colors outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${cardOrigin === option.id
                    ? "border-zinc-400 bg-zinc-600 text-white"
                    : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/70 hover:text-white"}`}>
                  {option.label}<span className="text-xs tabular-nums opacity-70">{option.count}</span>
                </button>
              ))}
            </div>
          </fieldset>}

          {weightOptions.length > 0 && <fieldset>
            <legend className="mb-3 text-lg font-semibold text-zinc-300">
              抽取权重
            </legend>
            <div className="grid max-w-sm gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(weightOptions.length, 6)}, minmax(0, 1fr))` }}>
              {weightOptions.map((weight) => {
                const selected = selectedWeights.has(weight);
                return (
                  <button
                    key={weight}
                    type="button"
                    aria-label={`抽取权重 ${weight}`}
                    aria-pressed={selected}
                    onClick={() => weightState.toggle(weight)}
                    className={`flex min-h-10 touch-manipulation items-center justify-center rounded border px-1 py-1.5 text-xs font-medium tabular-nums transition-colors outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                      selected
                        ? "border-zinc-400 bg-zinc-600 text-white"
                        : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/70 hover:text-white"
                    }`}
                  >
                    {weight}
                  </button>
                );
              })}
            </div>
          </fieldset>}

          </div>
          {availableWeaponApplicability.size > 0 && <WeaponApplicabilityFilterSection
            selected={selectedWeaponApplicability}
            onToggle={weaponApplicabilityState.toggle}
            available={availableWeaponApplicability}
          />}

          <fieldset>
            <legend className="mb-3 text-lg font-semibold text-zinc-300">
              套装词条
            </legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {tagOptions.map((tag) => {
                const selected = selectedTags.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => tagState.toggle(tag.id)}
                    style={
                      selected
                        ? getOverlimitBondSurfaceStyle(tag.name)
                        : { color: getOverlimitBondForegroundColor(tag.name) }
                    }
                    className={`flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded border px-2 py-2 text-sm font-medium transition-colors outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                      selected
                        ? "shadow-sm"
                        : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/70 hover:text-white"
                    }`}
                  >
                    <OverlimitBondIcon name={tag.name} className="h-4 w-4" />
                    <span>{tag.name}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-3">
          <div aria-live="polite" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
            <p>共 {filteredCards.length} 张卡片</p>
            {filteredCardsTotalWeight !== undefined && <p className="tabular-nums">
              当前筛选总权重：{filteredCardsTotalWeight}
            </p>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex min-h-11 items-center gap-1.5 rounded px-3 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                <span>重置筛选</span>
              </button>
            )}
          </div>
        </div>

        {filteredCards.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredCards.map((card) => (
              <OverlimitCardItem
                key={card.id}
                card={card}
                basePath={basePath}
                sourceSeason={sourceSeason}
                eager={eagerIcons.has(card.icon)}
              />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-zinc-500">
            没有符合条件的卡片
          </div>
        )}
          </section>

      )}
      {activeModule === "bonds" && bondCatalog && (
            <OverlimitBondCatalog
              catalog={bondCatalog}
              sourceSeason={sourceSeason}
              onSearchBond={searchCardsByBond}
            />
      )}
      {activeModule === "levels" && levelCatalog && (
          <OverlimitLevelCatalog catalog={levelCatalog} />
      )}
      {activeModule === "map-rotation" && mapRotation && (
            <OverlimitMapRotation
              schedule={mapRotation}
              onSearchBonds={searchCardsByBonds}
            />
      )}
    </>
  );
}
