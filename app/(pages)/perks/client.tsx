"use client";

import { useEffect, useMemo, useState } from "react";
import { FadeInImage } from "@/components/FadeInImage";
import { getAssetPath } from "@/lib/path";
import { getShanghaiDateKey } from "@/lib/date-key";
import { getPerkAvailability, getPerkConfiguredAvailability, getS4PerkLaunchGroup, isPerkRecent } from "@/lib/perk-release";
import { isPreviewSeason } from "@/lib/content-preview";
import contentVersion from "@/config/content-version.json";
import { OverlimitVersionNavigation } from "@/components/OverlimitVersionNavigation";
import { restoreCatalogNavigation } from "@/lib/catalog-navigation";
import type { Perk, PerkPreviewChange, PerkSlot, Rarity } from "@/types";
import { useSelection } from "@/hooks/useSelection";
import { FilterSection } from "@/components/Filter";
import { PerkHoverPreview } from "@/components/PerkHoverPreview";
import { PerkGuideDialog } from "@/components/PerkGuideDialog";
import { MultiplierSourceBadges } from "@/components/MultiplierBadges";
import {
  matchesWeaponApplicability,
  WeaponApplicabilityFilterSection,
  type WeaponApplicabilityFilter,
} from "@/components/WeaponApplicabilityFilter";
import {
  RARITY_KEY_MAP,
  RARITY_CARD_STYLES,
  RARITY_NUM_MAP,
  SLOT_OPTIONS,
  RARITY_OPTIONS,
} from "@/constants/perks";

type QuickFilter = "online" | "recent" | "offline" | "super" | "season-new" | "midseason-new" | "season-unreleased";

const PREVIEW_CHANGE_OPTIONS: { type: PerkPreviewChange; label: string }[] = [
  { type: "new", label: "新插件" },
  { type: "changed", label: "改动插件" },
  { type: "existing", label: "老插件" },
];

function parseQuickFilter(value: string): QuickFilter {
  switch (value) {
    case "online":
    case "recent":
    case "offline":
    case "super":
    case "season-new":
    case "midseason-new":
    case "season-unreleased":
      return value;
    default:
      return "online";
  }
}

const BASE_QUICK_FILTER_OPTIONS: {
  type: QuickFilter;
  label: string;
}[] = [
  { type: "online", label: "已上线" },
  { type: "offline", label: "未上线" },
  { type: "super", label: "超级插件" },
];

const RECENT_QUICK_FILTER_OPTION = {
  type: "recent" as const,
  label: "近期上线",
  highlighted: true,
};

const SUPER_PERK_NAMES = new Set([
  "切换手法",
  "技能魔术",
  "永动核心",
  "哑枪",
  "弱肉强食",
  "我只射击",
  "暴走永动",
  "武器穿透",
  "物法兼得",
  "不死狂热",
  "反弹转化",
  "弹道过载",
  "狂战",
  "狂暴连击",
  "狂轰乱炸",
  "致命爆炸",
  "连发",
  "游击飞弹",
  "超强技能",
  "弱点必暴",
  "暴击飞弹",
  "爆炸直击",
  "飞弹狂射",
  "暴力切换",
  "隐匿出击",
  "爆发",
  "近战冲击",
]);

const PREVIEW_SUPER_PERK_NAMES = new Set([
  ...SUPER_PERK_NAMES,
  "弹链供给",
  "战术速装",
  "积光成辉",
  "余烬积势",
  "换弹引爆",
  "驰射淬锋",
  "近战衔接",
]);

const DEFAULT_RARITIES: Rarity[] = ["传说"];
const DEFAULT_QUICK_FILTER: QuickFilter[] = ["online"];
const DEFAULT_PREVIEW_CHANGE: PerkPreviewChange[] = ["new"];
const PREVIEW_AVAILABILITY_OPTIONS: { type: "online" | "offline"; label: string }[] = [
  { type: "online", label: "已上线" },
  { type: "offline", label: "已下线" },
];

const FILTER_STORAGE_KEYS = {
  slot: "perk-slot",
  rarity: "perk-rarity",
  quickFilter: "perk-availability",
  weaponApplicability: "perk-weapon-applicability",
  previewChange: "perk-preview-change",
  previewAvailability: "perk-preview-availability",
} as const;

function PerkCard({ perk }: { perk: Perk }) {
  // 处理数字或字符串格式的稀有度
  const rarityStr =
    typeof perk.rarity === "number"
      ? RARITY_NUM_MAP[perk.rarity] || "普通"
      : perk.rarity;
  const rarityKey = RARITY_KEY_MAP[rarityStr] || "common";
  const rarityStyle = RARITY_CARD_STYLES[rarityKey];
  const href = `/perks/${perk.slug.split("/").map(encodeURIComponent).join("/")}`;

  return (
    <div className="catalog-card relative min-w-0">
      <PerkHoverPreview perk={perk} href={href}>
        <div
          className={`catalog-card-frame flex flex-col items-center rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-3 pb-4`}
        >
          {perk.icon ? (
            <FadeInImage
              src={getAssetPath(`/icons/perks/${perk.icon}.png`)}
              alt={perk.name}
              width={80}
              height={80}
              className="h-20 w-20 translate-y-[3px] object-contain"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center bg-zinc-700 text-zinc-400">
              ?
            </div>
          )}
          <h3 className="mt-2 text-center text-sm font-medium leading-tight text-white">
            {perk.name}
          </h3>
        </div>
      </PerkHoverPreview>
      <MultiplierSourceBadges
        source={{
          type: "perk",
          slot: perk.slot,
          slug: perk.slug.split("/").at(-1) ?? perk.name,
          ...(isPreviewSeason(perk.season) ? { season: perk.season } : {}),
        }}
        variant="catalog-overlay"
        className="absolute inset-x-0 top-0 z-10 max-w-full"
      />
    </div>
  );
}

interface PerksPageClientProps {
  initialPerks: Perk[];
  initialDateKey: string;
  channel?: "current" | "preview";
  previewLabel?: string;
}

function useShanghaiDateKey(initialDateKey: string) {
  const [dateKey, setDateKey] = useState(initialDateKey);

  useEffect(() => {
    const updateDateKey = () => setDateKey(getShanghaiDateKey());
    const initialUpdate = window.setTimeout(updateDateKey, 0);
    const interval = window.setInterval(updateDateKey, 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

  return dateKey;
}

export default function PerksPageClient({
  initialPerks,
  initialDateKey,
  channel = "current",
  previewLabel,
}: PerksPageClientProps) {
  const isPreview = channel === "preview";
  const previewChangeState = useSelection<PerkPreviewChange>(
    FILTER_STORAGE_KEYS.previewChange,
    isPreview ? DEFAULT_PREVIEW_CHANGE : undefined,
  );
  const previewAvailabilityState = useSelection<"online" | "offline">(
    FILTER_STORAGE_KEYS.previewAvailability,
  );
  useEffect(() => {
    restoreCatalogNavigation();
  }, []);

  const todayKey = useShanghaiDateKey(initialDateKey);
  const slotState = useSelection<PerkSlot>(
    FILTER_STORAGE_KEYS.slot,
    undefined,
    Number as (v: string) => PerkSlot,
  );
  const rarityState = useSelection<Rarity>(
    FILTER_STORAGE_KEYS.rarity,
    DEFAULT_RARITIES,
  );
  const quickFilterState = useSelection<QuickFilter>(
    FILTER_STORAGE_KEYS.quickFilter,
    isPreview ? undefined : DEFAULT_QUICK_FILTER,
    parseQuickFilter,
  );
  const quickFilterSelected = quickFilterState.selected;
  const selectQuickFilterOnly = quickFilterState.selectOnly;
  const weaponApplicabilityState = useSelection<WeaponApplicabilityFilter>(
    FILTER_STORAGE_KEYS.weaponApplicability,
  );

  const recentPerkCount = useMemo(
    () => initialPerks.filter((perk) => isPerkRecent(perk, todayKey)).length,
    [initialPerks, todayKey],
  );
  const quickFilterOptions = useMemo(
    () => isPreview ? [...PREVIEW_CHANGE_OPTIONS, BASE_QUICK_FILTER_OPTIONS[2]] : [
      BASE_QUICK_FILTER_OPTIONS[0],
      BASE_QUICK_FILTER_OPTIONS[1],
      ...(recentPerkCount > 0 ? [RECENT_QUICK_FILTER_OPTION] : []),
      BASE_QUICK_FILTER_OPTIONS[2],
      ...(contentVersion.season === "s4" ? [
        { type: "season-new" as const, label: "赛季上新" },
        { type: "midseason-new" as const, label: "季中上新" },
        { type: "season-unreleased" as const, label: "赛季未上线" },
      ] : []),
    ],
    [recentPerkCount, isPreview],
  );
  const hasUnavailableSelection =
    (recentPerkCount === 0 && quickFilterSelected.has("recent")) ||
    (isPreview && [...quickFilterSelected].some(filter => filter !== "super"));
  const effectiveQuickFilter = useMemo(() => {
    if (hasUnavailableSelection) {
      return new Set<QuickFilter>(isPreview ? [] : ["online"]);
    }
    return quickFilterSelected;
  }, [quickFilterSelected, hasUnavailableSelection, isPreview]);

  useEffect(() => {
    if (hasUnavailableSelection) {
      selectQuickFilterOnly(isPreview ? undefined : "online");
    }
  }, [hasUnavailableSelection, selectQuickFilterOnly, isPreview]);

  const filteredPerks = useMemo(() => {
    return initialPerks.filter((perk) => {
      const availability = getPerkAvailability(perk);
      const launchGroup = !isPreview ? getS4PerkLaunchGroup(perk) : undefined;
      const slotMatch =
        slotState.selected.size === 0 || slotState.selected.has(perk.slot);
      // 处理数字或字符串格式的稀有度
      const perkRarity =
        typeof perk.rarity === "number"
          ? RARITY_NUM_MAP[perk.rarity]
          : perk.rarity;
      const rarityMatch =
        rarityState.selected.size === 0 || rarityState.selected.has(perkRarity);
      const quickFilterMatch =
        effectiveQuickFilter.size === 0 ||
        (availability !== "preview" && effectiveQuickFilter.has(availability)) ||
        (effectiveQuickFilter.has("recent") && isPerkRecent(perk, todayKey)) ||
        (launchGroup !== undefined && effectiveQuickFilter.has(launchGroup)) ||
        (effectiveQuickFilter.has("super") &&
          (isPreview ? PREVIEW_SUPER_PERK_NAMES : SUPER_PERK_NAMES).has(perk.name));
      const weaponApplicabilityMatch = matchesWeaponApplicability(
        weaponApplicabilityState.selected,
        perk.weaponType,
        (perk.weaponNames?.length ?? 0) > 0,
      );
      return (
        (!isPreview || previewAvailabilityState.selected.size === 0 ||
          previewAvailabilityState.selected.has(getPerkConfiguredAvailability(perk))) &&
        (!isPreview || previewChangeState.selected.size === 0 ||
          (perk.previewChange !== undefined && previewChangeState.selected.has(perk.previewChange))) &&
        slotMatch &&
        rarityMatch &&
        quickFilterMatch &&
        weaponApplicabilityMatch
      );
    });
  }, [
    effectiveQuickFilter,
    initialPerks,
    isPreview,
    previewChangeState.selected,
    previewAvailabilityState.selected,
    rarityState.selected,
    slotState.selected,
    todayKey,
    weaponApplicabilityState.selected,
  ]);

  const groupedBySlot = useMemo(() => {
    const groups: Record<PerkSlot, Perk[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const perk of filteredPerks) {
      groups[perk.slot].push(perk);
    }
    return groups;
  }, [filteredPerks]);

  const showGrouped = slotState.selected.size === 0;

  return (
    <>
      {previewLabel && <PerkGuideDialog key={channel} version={isPreview ? "s4" : "s3.2"} currentLabel={contentVersion.version.toUpperCase()} previewLabel={previewLabel} />}
      <OverlimitVersionNavigation
        ariaLabel="插件赛季版本"
        activePath={isPreview ? "/perks/preview" : "/perks"}
        versions={[
          { href: "/perks", label: contentVersion.version.toUpperCase() },
          ...(previewLabel ? [{ href: "/perks/preview", label: previewLabel }] : []),
        ]}
      />
      <h1 className="mb-8 text-3xl font-bold text-white">插件图鉴</h1>

      {/* Filter section */}
      <div className="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <FilterSection
          title="稀有度"
          items={RARITY_OPTIONS.map((item) => ({
            ...item,
            colorOnlyWhenChecked: true,
          }))}
          selected={rarityState.selected}
          onToggle={rarityState.toggle}
          gridClass="grid max-w-md grid-cols-3 gap-2"
          centerClass="justify-center"
        />

        <FilterSection
          title="插件槽位"
          items={SLOT_OPTIONS}
          selected={slotState.selected}
          onToggle={slotState.toggle}
          gridClass="grid grid-cols-2 gap-2 sm:grid-cols-4"
          centerClass="justify-center"
        />

        <WeaponApplicabilityFilterSection
          selected={weaponApplicabilityState.selected}
          onToggle={weaponApplicabilityState.toggle}
        />

        {isPreview && <h2 className="mb-3 text-lg font-semibold text-zinc-300">快速筛选</h2>}
        <div className={isPreview ? "grid min-w-0 gap-x-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,4fr)]" : undefined}>
        {isPreview && (
          <FilterSection
            title="上线状态"
            items={PREVIEW_AVAILABILITY_OPTIONS}
            selected={previewAvailabilityState.selected}
            onToggle={(availability) => previewAvailabilityState.selectOnly(
              previewAvailabilityState.selected.has(availability) ? undefined : availability,
            )}
            gridClass="grid grid-cols-2 gap-2"
            centerClass="justify-center"
          />
        )}
        <FilterSection
          title={isPreview ? "插件分类" : "快速筛选"}
          items={quickFilterOptions}
          selected={new Set<QuickFilter | PerkPreviewChange>([
            ...effectiveQuickFilter,
            ...(isPreview ? previewChangeState.selected : []),
          ])}
          onToggle={(quickFilter) => {
            if (quickFilter === "new" || quickFilter === "changed" || quickFilter === "existing") {
              previewChangeState.toggle(quickFilter);
              return;
            }
            selectQuickFilterOnly(
              quickFilterSelected.has(quickFilter)
                ? undefined
                : quickFilter,
            );
          }}
          gridClass={
            isPreview
              ? "grid grid-cols-2 gap-2 lg:grid-cols-4"
              : quickFilterOptions.length >= 6
              ? "grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
              : quickFilterOptions.length === 5
              ? "grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-5"
              : quickFilterOptions.length === 4
                ? "grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4"
                : "grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-3"
          }
          centerClass="justify-center"
        />
        </div>
      </div>

      <p className="mb-4 text-sm text-zinc-500">
        插件总数 {filteredPerks.length}
      </p>

      {showGrouped ? (
        ([1, 2, 3, 4] as PerkSlot[]).map((slot) => {
          const slotPerks = groupedBySlot[slot];
          if (slotPerks.length === 0) return null;

          return (
            <section key={slot} className="mb-10">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-xl font-semibold text-zinc-300">
                  {slot}号槽位
                </h2>
                <span className="text-sm text-zinc-500">
                  ({slotPerks.length}个)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                {slotPerks.map((perk) => (
                  <PerkCard
                    key={perk.slug}
                    perk={perk}
                  />
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <section>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {filteredPerks.map((perk) => (
              <PerkCard key={perk.slug} perk={perk} />
            ))}
          </div>
        </section>
      )}

      {filteredPerks.length === 0 && (
        <div className="py-16 text-center text-zinc-500">
          没有符合条件的插件
        </div>
      )}
    </>
  );
}
