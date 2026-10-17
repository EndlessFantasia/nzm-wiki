import Image from "next/image";
import Link from "next/link";
import { EffectValuesPanel } from "@/components/EffectValues";
import {
  getBaseFireRateEntries,
  getMechanicFireRateSources,
  getOverlimitFireRateSources,
  getPerkFireRateSources,
  getWeaponFireRateSources,
  toWeaponFireRateEffect,
  type FireRateCatalogGroup,
} from "@/lib/fire-rate";
import { getProviderRelationsForSource } from "@/lib/multiplier-data";
import { getAssetPath } from "@/lib/path";
import { getPerkAvailability } from "@/lib/perk-release";
import type { EffectValueStage } from "@/types";

interface CatalogEntry {
  id: string;
  name: string;
  href: string;
  icon: string;
  sourceLabel: string;
  stages: EffectValueStage[];
  offline?: boolean;
}

function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits,
  }).format(value);
}

function FireRateStages({ stages }: { stages: EffectValueStage[] }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1.5 sm:justify-end">
      {stages.map((stage) => (
        <p
          key={`${stage.condition ?? "base"}:${stage.value}`}
          className="text-sm leading-6 text-zinc-400"
        >
          {stage.condition && <span>{stage.condition} </span>}
          <strong className="font-semibold text-[#e2c38b] tabular-nums">
            {stage.value}
          </strong>
        </p>
      ))}
    </div>
  );
}

function CatalogRows({ entries }: { entries: CatalogEntry[] }) {
  return (
    <div className="not-prose my-5 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/35">
      {entries.map((entry) => (
        <article
          key={entry.id}
          className="grid min-w-0 gap-3 border-t border-zinc-700/70 px-4 py-4 first:border-t-0 sm:grid-cols-[3rem_minmax(10rem,1fr)_minmax(16rem,1.35fr)] sm:items-center sm:gap-4 sm:px-5"
        >
          <Image
            src={getAssetPath(entry.icon)}
            alt=""
            width={48}
            height={48}
            className={`h-12 w-12 object-contain${entry.offline ? " grayscale opacity-50" : ""}`}
          />
          <div className="min-w-0">
            <Link
              href={entry.href}
              className="break-words text-sm font-semibold text-zinc-100 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:text-amber-300 focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
            >
              {entry.name}
              {entry.offline && <span className="sr-only">（未上线）</span>}
            </Link>
            <p className="mt-0.5 break-words text-xs leading-5 text-zinc-500">
              {entry.sourceLabel}
            </p>
          </div>
          <FireRateStages stages={entry.stages} />
        </article>
      ))}
    </div>
  );
}

async function BaseFireRateCatalog() {
  const entries = await getBaseFireRateEntries();

  return (
    <div className="not-prose my-5 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/35">
      {entries.map((entry) => (
        <article
          key={entry.slug}
          className="grid min-w-0 gap-4 border-t border-zinc-700/70 px-4 py-4 first:border-t-0 sm:grid-cols-[3rem_minmax(9rem,0.8fr)_repeat(3,minmax(8rem,1fr))] sm:items-center sm:px-5"
        >
          <Image
            src={getAssetPath(`/icons/weapons/normal/${entry.name}.png`)}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
          />
          <div className="min-w-0">
            <Link
              href={`/weapons/${entry.slug}`}
              className="break-words text-sm font-semibold text-zinc-100 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:text-amber-300 focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
            >
              {entry.name}
            </Link>
            <p className="mt-0.5 text-xs text-zinc-500">持续射击被动</p>
          </div>
          <dl>
            <dt className="text-xs leading-5 text-zinc-500">初始基础射速</dt>
            <dd className="mt-0.5 text-sm leading-6 text-zinc-200 tabular-nums">
              {formatNumber(entry.baseRpm)} RPM
              <span className="block text-xs text-zinc-500">
                间隔 {formatNumber(entry.baseInterval, 4)} 秒
              </span>
            </dd>
          </dl>
          <dl>
            <dt className="text-xs leading-5 text-zinc-500">被动满速</dt>
            <dd className="mt-0.5 text-sm leading-6 text-[#e2c38b] tabular-nums">
              {formatNumber(entry.maxRpm)} RPM
              <span className="block text-xs text-zinc-500">
                间隔 {formatNumber(entry.maxInterval, 4)} 秒
              </span>
            </dd>
          </dl>
          <dl>
            <dt className="text-xs leading-5 text-zinc-500">相对初始射速</dt>
            <dd className="mt-0.5 text-sm leading-6 text-zinc-200 tabular-nums">
              {formatNumber(entry.multiplier)} 倍
              {entry.combinedMaxRpm !== undefined && (
                <span className="block text-xs text-zinc-500">
                  主动 +50% 后 {formatNumber(entry.combinedMaxRpm)} RPM
                </span>
              )}
            </dd>
          </dl>
        </article>
      ))}
    </div>
  );
}

export async function FireRateCatalog({
  group,
}: {
  group: FireRateCatalogGroup;
}) {
  if (group === "base") return <BaseFireRateCatalog />;

  if (group === "talents" || group === "origin" || group === "limits") {
    return <CatalogRows entries={getMechanicFireRateSources(group)} />;
  }

  if (group === "weapons") {
    return (
      <CatalogRows
        entries={getWeaponFireRateSources().map((source) => ({
          id: source.id,
          name: source.name,
          href: `/weapons/${source.slug}`,
          icon: `/icons/weapons/normal/${source.name}.png`,
          sourceLabel: source.skillName,
          stages: source.stages,
        }))}
      />
    );
  }

  if (group === "perks") {
    return (
      <CatalogRows
        entries={getPerkFireRateSources().map(({ perk, effect }) => ({
          id: `perk:${perk.itemId}`,
          name: perk.name,
          href: `/perks/${perk.slug}`,
          icon: `/webp/icons/perks/${perk.icon}.webp`,
          sourceLabel: `${perk.slot}号槽位`,
          stages: effect.stages,
          offline: getPerkAvailability(perk) === "offline",
        }))}
      />
    );
  }

  return (
    <CatalogRows
      entries={getOverlimitFireRateSources().map(({ card, effect }) => ({
        id: `overlimit:${card.id}`,
        name: card.name,
        href: `/overlimit/${card.id}`,
        icon: card.icon,
        sourceLabel: "超限卡片",
        stages: effect.stages,
      }))}
    />
  );
}

export function WeaponEffectValuesPanel({ slug }: { slug: string }) {
  const effects = getWeaponFireRateSources(slug).map(toWeaponFireRateEffect);
  return (
    <EffectValuesPanel
      id="weapon-effect-values"
      effects={effects}
      relations={getProviderRelationsForSource({ type: "weapon", slug })}
      title="效果数值"
      className="not-prose mt-4 rounded-xl!"
    />
  );
}
