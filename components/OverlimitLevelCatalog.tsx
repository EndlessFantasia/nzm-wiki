"use client";

import { ChevronDown } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { OVERLIMIT_QUALITY_STYLES } from "@/components/OverlimitCardMeta";
import type {
  OverlimitCardQuality,
  OverlimitLevelCatalog as OverlimitLevelCatalogData,
  OverlimitLevelEntry,
  OverlimitRerollCost,
} from "@/types";

const QUALITY_ORDER: readonly OverlimitCardQuality[] = [3, 4, 5];
const DEFAULT_MAX_LEVEL = 20;
const percentageFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
});
const integerFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0,
});

interface RerollRange {
  start: number;
  end: number;
  cost: number;
}

function formatPercentage(value: number) {
  return `${percentageFormatter.format(value * 100)}%`;
}

function getQualityProbabilities(level: OverlimitLevelEntry) {
  const total = QUALITY_ORDER.reduce(
    (sum, quality) => sum + level.qualityWeights[quality],
    0,
  );

  return Object.fromEntries(
    QUALITY_ORDER.map((quality) => [
      quality,
      total > 0 ? level.qualityWeights[quality] / total : 0,
    ]),
  ) as Record<OverlimitCardQuality, number>;
}

function getMixedPoolProbabilities(catalog: OverlimitLevelCatalogData) {
  const { nonSlot4, slot4 } = catalog.slot4.mixedPoolWeights;
  const total = nonSlot4 + slot4;

  return {
    nonSlot4: nonSlot4 / total,
    slot4: slot4 / total,
  };
}

function mergeRerollCosts(costs: OverlimitRerollCost[]): RerollRange[] {
  return costs.reduce<RerollRange[]>((ranges, row) => {
    const previous = ranges.at(-1);
    if (
      previous &&
      previous.cost === row.cost &&
      previous.end + 1 === row.time
    ) {
      previous.end = row.time;
      return ranges;
    }

    ranges.push({ start: row.time, end: row.time, cost: row.cost });
    return ranges;
  }, []);
}

function QualityLabel({ quality }: { quality: OverlimitCardQuality }) {
  const style = OVERLIMIT_QUALITY_STYLES[quality];

  return (
    <span className={`inline-flex items-center justify-center gap-2 ${style.text}`}>
      <span aria-hidden="true" className={`h-2.5 w-2.5 ${style.bar}`} />
      {style.label}
    </span>
  );
}

function LevelToggle({
  expanded,
  hiddenLevelCount,
  onToggle,
}: {
  expanded: boolean;
  hiddenLevelCount: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-controls="level-catalog-list"
      aria-expanded={expanded}
      onClick={onToggle}
      className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 bg-zinc-800/20 px-4 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-zinc-400"
    >
      {expanded
        ? `收起至 ${DEFAULT_MAX_LEVEL} 级`
        : `展开剩余 ${hiddenLevelCount} 级`}
      <ChevronDown
        aria-hidden="true"
        className={`h-4 w-4 transition-transform duration-300 ease-out motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
      />
    </button>
  );
}

function Summary({ catalog }: { catalog: OverlimitLevelCatalogData }) {
  const mixedPoolProbabilities = getMixedPoolProbabilities(catalog);

  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800/30 lg:grid-cols-[28%_repeat(4,minmax(0,1fr))]">
      <div className="col-span-2 border-b border-zinc-700 p-4 lg:col-span-1 lg:border-b-0 lg:border-r">
        <dt className="text-xs font-medium text-zinc-500">必定进入四插池等级</dt>
        <dd className="mt-2 text-base font-semibold tabular-nums text-zinc-100">
          {catalog.slot4.guaranteedLevels.join("、")}
        </dd>
      </div>
      <div className="border-b border-r border-zinc-700 p-4 lg:border-b-0">
        <dt className="text-xs font-medium text-zinc-500">四插池基础概率</dt>
        <dd className="mt-2 text-xl font-semibold tabular-nums text-zinc-100">
          {formatPercentage(catalog.slot4.baseProbability)}
        </dd>
      </div>
      <div className="border-b border-zinc-700 p-4 lg:border-b-0 lg:border-r">
        <dt className="text-xs font-medium text-zinc-500">
          每多 1 张四插卡提升四插池概率
        </dt>
        <dd className="mt-2 text-xl font-semibold tabular-nums text-emerald-300">
          +{formatPercentage(catalog.slot4.bonusPerObtainedSlot4)}
        </dd>
      </div>
      <div className="border-r border-zinc-700 p-4">
        <dt className="text-xs font-medium text-zinc-500">2x 暴击概率</dt>
        <dd className="mt-2 text-xl font-semibold tabular-nums text-zinc-100">
          {formatPercentage(catalog.criticalProbability)}
        </dd>
      </div>
      <div className="p-4">
        <dt className="text-xs font-medium text-zinc-500">混池内插槽概率</dt>
        <dd className="mt-2 flex flex-col gap-1 text-sm font-semibold tabular-nums text-zinc-100 sm:flex-row sm:items-center sm:gap-1.5">
          <span className="whitespace-nowrap">
            1–3 插 {formatPercentage(mixedPoolProbabilities.nonSlot4)}
          </span>
          <span aria-hidden="true" className="hidden text-zinc-600 sm:inline">
            /
          </span>
          <span className="whitespace-nowrap">
            4 插 {formatPercentage(mixedPoolProbabilities.slot4)}
          </span>
        </dd>
      </div>
    </dl>
  );
}

function DesktopLevelTable({
  catalog,
  levels,
  expanded,
  hiddenLevelCount,
  onToggle,
}: {
  catalog: OverlimitLevelCatalogData;
  levels: OverlimitLevelEntry[];
  expanded: boolean;
  hiddenLevelCount: number;
  onToggle: () => void;
}) {
  const guaranteedLevels = new Set(catalog.slot4.guaranteedLevels);

  return (
    <div className="relative hidden rounded-lg border border-zinc-700 md:block">
      <table
        aria-describedby="level-probability-note"
        className="w-full table-fixed border-collapse text-sm"
      >
        <caption className="sr-only">
          超限猎场等级对应的卡片品质、4 插卡池和 2x 暴击概率
        </caption>
        <colgroup>
          <col className="w-[10%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
          <col className="w-[24%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-zinc-700">
            <th className="sticky top-(--site-header-height) z-10 bg-zinc-800/95 px-3 py-3 text-center font-medium text-zinc-300 backdrop-blur">
              等级
            </th>
            {QUALITY_ORDER.map((quality) => (
              <th
                key={quality}
                className="sticky top-(--site-header-height) z-10 bg-zinc-800/95 px-3 py-3 text-center font-medium backdrop-blur"
              >
                <QualityLabel quality={quality} />
              </th>
            ))}
            <th className="sticky top-(--site-header-height) z-10 bg-zinc-800/95 px-3 py-3 text-center font-medium text-zinc-300 backdrop-blur">
              四插池概率
            </th>
            <th className="sticky top-(--site-header-height) z-10 bg-zinc-800/95 px-3 py-3 text-center font-medium text-zinc-300 backdrop-blur">
              2x 暴击概率
            </th>
          </tr>
        </thead>
        <tbody>
          {levels.map((level) => {
            const probabilities = getQualityProbabilities(level);
            const guaranteed = guaranteedLevels.has(level.level);

            return (
              <tr
                key={level.level}
                className="border-t border-zinc-700/50 bg-zinc-900/20 transition-colors hover:bg-zinc-800/60"
              >
                <th
                  scope="row"
                  className="px-3 py-2.5 text-center font-semibold tabular-nums text-zinc-200"
                >
                  {level.level}
                </th>
                {QUALITY_ORDER.map((quality) => (
                  <td
                    key={quality}
                    className={`px-3 py-2.5 text-center font-medium tabular-nums ${OVERLIMIT_QUALITY_STYLES[quality].text}`}
                  >
                    {formatPercentage(probabilities[quality])}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center tabular-nums text-zinc-200">
                  {guaranteed ? (
                    <span className="inline-flex items-center justify-center gap-2 font-semibold text-[#e2c58d]">
                      100%
                      <span className="rounded border border-[#d1ac69]/40 bg-[#d1ac69]/10 px-1.5 py-0.5 text-xs">
                        必定
                      </span>
                    </span>
                  ) : (
                    formatPercentage(catalog.slot4.baseProbability)
                  )}
                </td>
                <td className="px-3 py-2.5 text-center tabular-nums text-zinc-200">
                  {formatPercentage(catalog.criticalProbability)}
                </td>
              </tr>
            );
          })}
          {hiddenLevelCount > 0 && (
            <tr className="border-t border-zinc-700/60">
              <td colSpan={6} className="p-0">
                <LevelToggle
                  expanded={expanded}
                  hiddenLevelCount={hiddenLevelCount}
                  onToggle={onToggle}
                />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MobileLevelList({
  catalog,
  levels,
  expanded,
  hiddenLevelCount,
  onToggle,
}: {
  catalog: OverlimitLevelCatalogData;
  levels: OverlimitLevelEntry[];
  expanded: boolean;
  hiddenLevelCount: number;
  onToggle: () => void;
}) {
  const guaranteedLevels = new Set(catalog.slot4.guaranteedLevels);

  return (
    <ol className="overflow-hidden rounded-lg border border-zinc-700 md:hidden">
      {levels.map((level) => {
        const probabilities = getQualityProbabilities(level);
        const guaranteed = guaranteedLevels.has(level.level);

        return (
          <li
            key={level.level}
            className="border-t border-zinc-700/60 bg-zinc-900/20 first:border-t-0"
          >
            <div className="flex min-h-11 items-center justify-between border-b border-zinc-800 px-3 py-2">
              <h3 className="text-sm font-semibold tabular-nums text-zinc-100">
                等级 {level.level}
              </h3>
              {guaranteed && (
                <span className="rounded border border-[#d1ac69]/40 bg-[#d1ac69]/10 px-2 py-1 text-xs font-semibold text-[#e2c58d]">
                  必定 4 插
                </span>
              )}
            </div>

            <dl className="grid grid-cols-3 divide-x divide-zinc-800">
              {QUALITY_ORDER.map((quality) => (
                <div key={quality} className="px-2 py-2.5 text-center">
                  <dt className={`text-xs ${OVERLIMIT_QUALITY_STYLES[quality].text}`}>
                    {OVERLIMIT_QUALITY_STYLES[quality].label}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">
                    {formatPercentage(probabilities[quality])}
                  </dd>
                </div>
              ))}
            </dl>

            <dl className="grid grid-cols-2 divide-x divide-zinc-800 border-t border-zinc-800 bg-zinc-800/20">
              <div className="px-3 py-2.5">
                <dt className="text-xs text-zinc-500">四插池概率</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">
                  {guaranteed
                    ? "100%"
                    : formatPercentage(catalog.slot4.baseProbability)}
                </dd>
              </div>
              <div className="px-3 py-2.5">
                <dt className="text-xs text-zinc-500">2x 暴击</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">
                  {formatPercentage(catalog.criticalProbability)}
                </dd>
              </div>
            </dl>
          </li>
        );
      })}
      {hiddenLevelCount > 0 && (
        <li className="border-t border-zinc-700/60">
          <LevelToggle
            expanded={expanded}
            hiddenLevelCount={hiddenLevelCount}
            onToggle={onToggle}
          />
        </li>
      )}
    </ol>
  );
}

function RerollCostTable({ costs }: { costs: OverlimitRerollCost[] }) {
  const ranges = mergeRerollCosts(costs);

  return (
    <section aria-labelledby="reroll-cost-title" className="mt-10">
      <div className="mb-4">
        <h3 id="reroll-cost-title" className="text-lg font-semibold text-zinc-100">
          重抽费用
        </h3>
        <p className="mt-1 text-sm text-zinc-500">连续相同费用按次数区间合并展示。</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-700">
        <table className="w-full text-sm">
          <caption className="sr-only">超限猎场各次重抽所需费用</caption>
          <thead className="bg-zinc-800/80">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-300">
                重抽次数
              </th>
              <th className="px-4 py-3 text-right font-medium text-zinc-300">
                费用
              </th>
            </tr>
          </thead>
          <tbody>
            {ranges.map((range) => (
              <tr
                key={`${range.start}-${range.end}`}
                className="border-t border-zinc-700/50 bg-zinc-900/20"
              >
                <th
                  scope="row"
                  className="px-4 py-2.5 text-left font-medium tabular-nums text-zinc-300"
                >
                  {range.start === range.end
                    ? range.start
                    : `${range.start}–${range.end}`}
                </th>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-zinc-100">
                  {integerFormatter.format(range.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function OverlimitLevelCatalog({
  catalog,
}: {
  catalog: OverlimitLevelCatalogData;
}) {
  const [expanded, setExpanded] = useState(false);
  const levelListRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const animationStartHeightRef = useRef<number | null>(null);
  const defaultLevels = catalog.levels.filter(
    (level) => level.level <= DEFAULT_MAX_LEVEL,
  );
  const hasMoreLevels = defaultLevels.length < catalog.levels.length;
  const visibleLevels = expanded ? catalog.levels : defaultLevels;
  const hiddenLevelCount = catalog.levels.length - defaultLevels.length;

  useLayoutEffect(() => {
    const levelList = levelListRef.current;
    const startHeight = animationStartHeightRef.current;
    animationStartHeightRef.current = null;

    if (!levelList || startHeight === null) return;

    const endHeight = levelList.scrollHeight;
    if (
      Math.abs(startHeight - endHeight) < 1 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    levelList.style.overflow = "hidden";
    const animation = levelList.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      {
        duration: expanded ? 360 : 240,
        easing: expanded
          ? "cubic-bezier(0.22, 1, 0.36, 1)"
          : "cubic-bezier(0.4, 0, 1, 1)",
      },
    );
    animationRef.current = animation;

    const finishAnimation = () => {
      if (animationRef.current !== animation) return;
      animationRef.current = null;
      levelList.style.removeProperty("overflow");
    };

    animation.addEventListener("finish", finishAnimation, { once: true });
    animation.addEventListener("cancel", finishAnimation, { once: true });
  }, [expanded]);

  const toggleExpanded = () => {
    const levelList = levelListRef.current;
    if (levelList) {
      const startHeight = levelList.getBoundingClientRect().height;
      animationRef.current?.cancel();
      animationStartHeightRef.current = startHeight;
    }
    setExpanded((current) => !current);
  };

  return (
    <section aria-labelledby="levels-title">
      <header className="mb-5">
        <h2 id="levels-title" className="text-2xl font-semibold text-zinc-100">
          等级图鉴
        </h2>
        <p id="level-probability-note" className="mt-2 text-sm leading-6 text-zinc-400">
          普通等级先以 10% 概率进入四插池，每多 1 张四插卡提升 8 个百分点。
          未进入时走混池，混池内会出现 1–4 插插件。
        </p>
      </header>

      <Summary catalog={catalog} />

      <div id="level-catalog-list" ref={levelListRef} className="mt-6">
        <DesktopLevelTable
          catalog={catalog}
          levels={visibleLevels}
          expanded={expanded}
          hiddenLevelCount={hasMoreLevels ? hiddenLevelCount : 0}
          onToggle={toggleExpanded}
        />
        <MobileLevelList
          catalog={catalog}
          levels={visibleLevels}
          expanded={expanded}
          hiddenLevelCount={hasMoreLevels ? hiddenLevelCount : 0}
          onToggle={toggleExpanded}
        />
      </div>

      <RerollCostTable costs={catalog.rerollCosts} />
    </section>
  );
}
