"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  Crosshair,
  TimerReset,
} from "lucide-react";
import { useSyncExternalStore } from "react";
import { getMultiplierFactorStyle } from "@/components/multiplier-badge-styles";
import { getAssetPath } from "@/lib/path";
import { revealLocatedTarget } from "@/lib/locate-target";
import {
  MULTIPLIER_FACTORS,
  resolveMultiplierFactorHref,
} from "@/lib/multiplier-data";
import {
  getWeeklyBuffFactors,
  getWeeklyBuffRotationWindow,
  getWeeklyBuffsForRotation,
  WEEKLY_BUFF_DAMAGE_INDEX,
  WEEKLY_BUFF_POOLS,
  type WeeklyBuff,
  type WeeklyBuffDifficulty,
  type WeeklyBuffPool,
  type WeeklyBuffRotationWindow,
} from "@/lib/weekly-buffs";

type PoolId = WeeklyBuffPool["id"];
type IndexFilter = "all" | "dilution" | "weakness" | "critical" | "extra";

const INDEX_FILTERS: readonly { id: IndexFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "dilution", label: "大稀释乘区" },
  { id: "weakness", label: "弱点增伤" },
  { id: "critical", label: "暴击收益" },
  { id: "extra", label: "额外伤害" },
];

const INDEX_KIND_STYLES: Record<"critical" | "extra", string> = {
  critical: "border-orange-400/40 bg-orange-400/10 text-orange-200",
  extra: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
};

const FACTOR_LABELS = new Map(
  MULTIPLIER_FACTORS.map((factor) => [factor.id, factor.label]),
);

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function readQueryState(windowInfo: WeeklyBuffRotationWindow) {
  const params = new URLSearchParams(window.location.search);
  const pool = params.get("pool");
  const rotation = Number(params.get("rotation"));
  const filter = params.get("filter");

  return {
    poolId: pool === "b" ? "b" : ("a" as PoolId),
    rotationIndex: [1, 2, 3].includes(rotation)
      ? rotation
      : windowInfo.rotationIndex,
    indexFilter: INDEX_FILTERS.some((item) => item.id === filter)
      ? (filter as IndexFilter)
      : ("all" as IndexFilter),
  };
}

function updateQuery(
  state: { poolId?: PoolId; rotationIndex?: number; indexFilter?: IndexFilter },
  hash?: string,
) {
  const url = new URL(window.location.href);
  if (state.poolId) url.searchParams.set("pool", state.poolId);
  if (state.rotationIndex) url.searchParams.set("rotation", String(state.rotationIndex));
  if (state.indexFilter) {
    if (state.indexFilter === "all") url.searchParams.delete("filter");
    else url.searchParams.set("filter", state.indexFilter);
  }
  if (hash) url.hash = hash;
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event("nzm-wiki:weekly-buff-query-change"));
}

function subscribeToWeeklyBuffState(onStoreChange: () => void) {
  const rotationWindow = getWeeklyBuffRotationWindow();
  const timeout = window.setTimeout(
    onStoreChange,
    Math.max(0, rotationWindow.endsAt.getTime() - Date.now() + 1000),
  );
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("nzm-wiki:weekly-buff-query-change", onStoreChange);

  return () => {
    window.clearTimeout(timeout);
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("nzm-wiki:weekly-buff-query-change", onStoreChange);
  };
}

function getWeeklyBuffStateSnapshot() {
  return `${window.location.href}|${getWeeklyBuffRotationWindow().rotationIndex}`;
}

function getServerWeeklyBuffStateSnapshot() {
  return "";
}

function formatRotationRange(windowInfo: WeeklyBuffRotationWindow) {
  return `${DATE_FORMATTER.format(windowInfo.startsAt)} - ${DATE_FORMATTER.format(windowInfo.endsAt)}`;
}

function IndexBadges({ buff, stacked = false }: { buff: WeeklyBuff; stacked?: boolean }) {
  if (buff.indexKind === "utility") return null;
  const factors = getWeeklyBuffFactors(buff);
  return (
    <div className={`flex gap-1.5 ${stacked ? "shrink-0 flex-col items-end" : "flex-wrap items-center"}`}>
      {factors.map(({ factorId }) => (
        <Link
          key={factorId}
          href={resolveMultiplierFactorHref(factorId, { view: "providers" })}
          prefetch={false}
          className={`inline-flex min-h-7 touch-manipulation items-center gap-1 rounded border px-2 py-1 text-xs font-semibold transition-[filter] hover:brightness-125 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${getMultiplierFactorStyle(factorId)}`}
        >
          {FACTOR_LABELS.get(factorId)}
          <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
        </Link>
      ))}
      {buff.indexLabel && (
        buff.indexKind === "extra" ? (
          <Link
            href="/multiplier?part=damage-sources"
            prefetch={false}
            className={`inline-flex min-h-7 touch-manipulation items-center gap-1 rounded border px-2 py-1 text-xs font-semibold hover:brightness-125 focus-visible:outline-none focus-visible:underline ${INDEX_KIND_STYLES.extra}`}
          >
            {buff.indexLabel}
            <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
          </Link>
        ) : (
          <span className={`inline-flex min-h-7 items-center rounded border px-2 py-1 text-xs font-semibold ${INDEX_KIND_STYLES.critical}`}>
            {buff.indexLabel}
          </span>
        )
      )}
    </div>
  );
}

function BuffCard({ buff }: { buff: WeeklyBuff }) {
  const hasMultipleBadges =
    getWeeklyBuffFactors(buff).length + Number(Boolean(buff.indexLabel)) > 1;

  return (
    <article
      id={`buff-${buff.id}`}
      className="scroll-mt-20 rounded-lg border border-zinc-700 bg-zinc-900/75 p-4 transition-colors target:border-amber-400/70 sm:p-5"
    >
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-600 bg-zinc-950 sm:h-20 sm:w-20">
          <Image
            src={getAssetPath(buff.icon)}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-base font-semibold text-zinc-100 sm:text-lg">{buff.name}</h3>
            <IndexBadges buff={buff} stacked={hasMultipleBadges} />
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-300">{buff.description}</p>
        </div>
      </div>
    </article>
  );
}

function RotationButton({
  index,
  selected,
  current,
  onClick,
}: {
  index: number;
  selected: boolean;
  current: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 touch-manipulation rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
        selected
          ? "border-amber-400/70 bg-amber-400/12 text-amber-100"
          : "border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      }`}
    >
      <span className="text-sm font-semibold">第 {index} 周</span>
      {current && <span className="ml-2 text-[10px] text-amber-300">本周</span>}
    </button>
  );
}

export function WeeklyBuffGuide({
  difficulty = "torment",
}: {
  difficulty?: WeeklyBuffDifficulty;
}) {
  const stateSnapshot = useSyncExternalStore(
    subscribeToWeeklyBuffState,
    getWeeklyBuffStateSnapshot,
    getServerWeeklyBuffStateSnapshot,
  );
  const rotationWindow = stateSnapshot ? getWeeklyBuffRotationWindow() : null;
  const queryState = rotationWindow
    ? readQueryState(rotationWindow)
    : {
        poolId: "a" as PoolId,
        rotationIndex: 1,
        indexFilter: "all" as IndexFilter,
      };
  const { poolId, rotationIndex, indexFilter } = queryState;
  const selectionQuery = stateSnapshot
    ? new URLSearchParams({ pool: poolId, rotation: String(rotationIndex) }).toString()
    : "";

  const selectedPool =
    WEEKLY_BUFF_POOLS.find((pool) => pool.id === poolId) ?? WEEKLY_BUFF_POOLS[0];
  const selectedBuffs = getWeeklyBuffsForRotation(selectedPool, rotationIndex);
  const nextBuffs = rotationWindow
    ? getWeeklyBuffsForRotation(selectedPool, rotationWindow.nextRotationIndex)
    : [];
  const indexedBuffs = WEEKLY_BUFF_DAMAGE_INDEX.filter(
    (buff) => indexFilter === "all" || buff.indexKind === indexFilter ||
      getWeeklyBuffFactors(buff).some(({ factorId }) => factorId === indexFilter),
  );

  const selectPool = (nextPoolId: PoolId) => {
    updateQuery({ poolId: nextPoolId });
  };

  const selectRotation = (nextRotation: number) => {
    updateQuery({ rotationIndex: nextRotation }, "rotation");
  };

  const selectFilter = (filter: IndexFilter) => {
    updateQuery({ indexFilter: filter }, "damage-index");
  };

  const revealBuff = (buff: WeeklyBuff) => {
    const placement = WEEKLY_BUFF_POOLS.flatMap((pool) =>
      pool.rotations.map((ids, index) => ({ pool, index: index + 1, ids })),
    ).find((item) => item.ids.includes(buff.id));
    if (!placement) return;
    updateQuery(
      { poolId: placement.pool.id, rotationIndex: placement.index },
      `buff-${buff.id}`,
    );
    window.setTimeout(() => {
      revealLocatedTarget(`buff-${buff.id}`, {
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }, 0);
  };

  return (
    <div className="not-prose mx-auto max-w-6xl pb-12 [--weekly-accent:#e4b457]">
      <nav aria-label="周 Buff 难度" className="mb-5 flex gap-5 border-b border-zinc-700">
        {([
          { id: "torment", label: "折磨", href: "/posts/weekly-buffs" },
          { id: "inferno", label: "炼狱", href: "/posts/inferno-weekly-buffs" },
        ] as const).map((item) => (
          <Link
            key={item.id}
            href={selectionQuery ? item.href + "?" + selectionQuery : item.href}
            aria-current={difficulty === item.id ? "page" : undefined}
            className={"min-h-11 touch-manipulation border-b-2 px-2 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 " +
              (difficulty === item.id
                ? "border-amber-400 text-amber-100"
                : "border-transparent text-zinc-400 hover:text-zinc-100")}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <section className="grid overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/45 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
        <div className="p-4 lg:border-r lg:border-zinc-700">
          <div className="flex items-start gap-3">
            <TimerReset aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">本周</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                {rotationWindow
                  ? `第 ${rotationWindow.rotationIndex} 周 · ${formatRotationRange(rotationWindow)}`
                  : "正在读取本地时间…"}
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-zinc-700 p-4 lg:border-t-0">
          <div className="flex items-start gap-3">
            <ChevronRight aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-zinc-100">下周</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                {rotationWindow ? `第 ${rotationWindow.nextRotationIndex} 周` : "下一轮"}
                {nextBuffs.length > 0 ? ` · ${nextBuffs.map((buff) => buff.name).join(" / ")}` : ""}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="rotation" className="scroll-mt-20 py-5">
        <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(17rem,0.7fr)_minmax(0,1.3fr)]">
          <div
            role="group"
            aria-label="选择地图池"
            className="grid grid-cols-2 rounded-lg border border-zinc-700 bg-zinc-900 p-1"
          >
            {WEEKLY_BUFF_POOLS.map((pool) => (
              <button
                key={pool.id}
                type="button"
                aria-pressed={pool.id === poolId}
                onClick={() => selectPool(pool.id)}
                className={`min-h-11 touch-manipulation rounded-md border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                  pool.id === poolId
                    ? "border-amber-400/70 bg-amber-400/12 text-amber-100"
                    : "border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                {pool.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 rounded-lg border border-zinc-700 bg-zinc-900/70 p-1">
            {[1, 2, 3].map((index) => (
              <RotationButton
                key={index}
                index={index}
                selected={rotationIndex === index}
                current={rotationWindow?.rotationIndex === index}
                onClick={() => selectRotation(index)}
              />
            ))}
          </div>
        </div>

        <p className="mb-4 text-sm leading-6 text-zinc-500">
          <span className="font-medium text-zinc-300">适用地图：</span>
          {selectedPool.maps[difficulty].join("、")}
        </p>

        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {selectedBuffs.map((buff) => (
            <BuffCard key={buff.id} buff={buff} />
          ))}
        </div>
      </section>

      <details
        id="damage-index"
        className="scroll-mt-20 rounded-lg border border-zinc-700 bg-zinc-900/35"
      >
        <summary className="flex min-h-12 cursor-pointer select-none items-center justify-between gap-3 px-4 text-sm font-semibold text-zinc-200 hover:text-white focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4">
          <span className="flex items-center gap-2">
            <Crosshair aria-hidden="true" className="h-4 w-4 text-rose-300" />
            乘区与伤害事件索引
          </span>
          <span className="text-xs font-normal text-zinc-500">
            {WEEKLY_BUFF_DAMAGE_INDEX.length} 项
          </span>
        </summary>

        <div className="border-t border-zinc-700 p-3 sm:p-4">
          <div
            role="group"
            aria-label="筛选增伤索引"
            className="mb-4 grid grid-cols-2 rounded-lg border border-zinc-700 bg-zinc-900 p-1 sm:grid-cols-5"
          >
            {INDEX_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={indexFilter === filter.id}
                onClick={() => selectFilter(filter.id)}
                className={`min-h-11 touch-manipulation rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${
                  indexFilter === filter.id
                    ? "border-rose-400/60 bg-rose-400/10 text-rose-100"
                    : "border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/65">
          <div className="hidden grid-cols-[minmax(12rem,0.8fr)_minmax(9rem,0.65fr)_minmax(0,1.55fr)_2rem] gap-4 border-b border-zinc-700 px-5 py-3 text-xs font-semibold text-zinc-500 md:grid">
            <span>Buff</span>
            <span>收益归类</span>
            <span>效果</span>
            <span className="sr-only">定位</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {indexedBuffs.map((buff) => (
              <div
                key={buff.id}
                className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(12rem,0.8fr)_minmax(9rem,0.65fr)_minmax(0,1.55fr)_2rem] md:items-center md:gap-4 md:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-zinc-700 bg-zinc-950">
                    <Image
                      src={getAssetPath(buff.icon)}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => revealBuff(buff)}
                      className="touch-manipulation text-left text-sm font-semibold text-zinc-100 transition-colors hover:text-amber-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
                    >
                      {buff.name}
                    </button>
                  </div>
                </div>
                <div>
                  <IndexBadges buff={buff} />
                </div>
                <p className="text-sm leading-6 text-zinc-400">{buff.description}</p>
                <button
                  type="button"
                  onClick={() => revealBuff(buff)}
                  aria-label={`在轮换表中定位${buff.name}`}
                  title={`定位${buff.name}`}
                  className="hidden h-8 w-8 touch-manipulation items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:underline md:flex"
                >
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
        </div>
      </details>
    </div>
  );
}
