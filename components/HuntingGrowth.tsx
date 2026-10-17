import { HuntingGrowthChart } from "@/components/HuntingGrowthChart";
import {
  HUNTING_GROWTH,
  type HuntingGrowthKind,
  type HuntingGrowthRow,
} from "@/lib/hunting-growth";

const TRACK_META: Record<
  HuntingGrowthKind,
  { bonusLabel: string; costUnit: string; color: string; showMultiplier: boolean }
> = {
  level: { bonusLabel: "血量加成", costUnit: "经验", color: "#f87171", showMultiplier: false },
  attack: { bonusLabel: "攻击力加成", costUnit: "金币", color: "#e2c38b", showMultiplier: true },
};

function formatInteger(value: number): string {
  return value.toLocaleString("zh-CN");
}

function formatBonus(value: number): string {
  return `+${formatInteger(Math.round(value * 100))}%`;
}

function formatMultiplier(value: number): string {
  return `×${Number((1 + value).toFixed(2))}`;
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 px-4 py-3 sm:px-5">
      <dt className="text-xs leading-5 text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold leading-7 text-zinc-100 tabular-nums">
        {value}
        {note && <span className="ml-1.5 text-xs font-normal text-zinc-500">{note}</span>}
      </dd>
    </div>
  );
}

function GrowthTable({
  rows,
  kind,
  purchasableMaxLevel,
}: {
  rows: HuntingGrowthRow[];
  kind: HuntingGrowthKind;
  purchasableMaxLevel: number;
}) {
  const meta = TRACK_META[kind];

  return (
    <table className="w-full text-sm tabular-nums">
      <thead className="bg-zinc-800/80 text-zinc-300">
        <tr>
          <th scope="col" className="whitespace-nowrap px-2.5 py-2.5 text-left font-medium sm:px-5">等级</th>
          <th scope="col" className="whitespace-nowrap px-2.5 py-2.5 text-right font-medium sm:px-5">{meta.bonusLabel}</th>
          <th scope="col" className="whitespace-nowrap px-2.5 py-2.5 text-right font-medium sm:px-5">本级{meta.costUnit}</th>
          <th scope="col" className="whitespace-nowrap px-2.5 py-2.5 text-right font-medium sm:px-5">累计{meta.costUnit}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const beyondShop = row.level > purchasableMaxLevel;
          return (
            <tr
              key={row.level}
              className={`border-t border-zinc-700/50 ${beyondShop ? "bg-amber-400/[0.04]" : ""}`}
            >
              <td className="whitespace-nowrap px-2.5 py-2 text-zinc-200 sm:px-5">
                {row.level}
                {beyondShop && (
                  <span className="ml-1.5 rounded border border-amber-400/40 px-1 py-px text-[11px] text-amber-200/90 sm:ml-2 sm:px-1.5">
                    非商店
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-2.5 py-2 text-right sm:px-5">
                <span style={{ color: row.level === 0 ? undefined : meta.color }}>
                  {row.level === 0 ? <span className="text-zinc-500">0%</span> : formatBonus(row.bonus)}
                </span>
                {meta.showMultiplier && (
                  <span className="ml-2 hidden min-w-[3.25rem] text-left text-xs text-zinc-500 sm:inline-block">
                    {formatMultiplier(row.bonus)}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-2.5 py-2 text-right text-zinc-300 sm:px-5">
                {row.cost === null ? <span className="text-zinc-600">—</span> : formatInteger(row.cost)}
              </td>
              <td className="whitespace-nowrap px-2.5 py-2 text-right text-zinc-200 sm:px-5">
                {row.totalCost === null ? <span className="text-zinc-600">—</span> : formatInteger(row.totalCost)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function HuntingGrowth({ kind }: { kind: HuntingGrowthKind }) {
  const track = HUNTING_GROWTH[kind];
  const meta = TRACK_META[kind];
  const purchasable = track.rows.filter((row) => row.totalCost !== null);
  const shopMax = purchasable.at(-1)!;
  const absoluteMax = track.rows.at(-1)!;
  const hasBeyondShop = absoluteMax.level > shopMax.level;

  return (
    <section id={`growth-${kind}`} className="not-prose my-5 scroll-mt-20 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/35">
      <dl className="grid grid-cols-2 divide-zinc-700/70 border-b border-zinc-700/70 sm:grid-cols-4 sm:divide-x">
        <Stat
          label={hasBeyondShop ? "商店满级" : "满级"}
          value={`${shopMax.level} 级`}
        />
        <Stat label={`累计${meta.costUnit}`} value={formatInteger(shopMax.totalCost ?? 0)} />
        <Stat
          label={meta.bonusLabel}
          value={formatBonus(shopMax.bonus)}
          note={meta.showMultiplier ? formatMultiplier(shopMax.bonus) : undefined}
        />
        {hasBeyondShop ? (
          <Stat
            label={`配置上限 ${absoluteMax.level} 级`}
            value={formatBonus(absoluteMax.bonus)}
            note={meta.showMultiplier ? formatMultiplier(absoluteMax.bonus) : undefined}
          />
        ) : (
          <Stat
            label={`末级所需${meta.costUnit}`}
            value={formatInteger(shopMax.cost ?? 0)}
          />
        )}
      </dl>

      <div className="border-b border-zinc-700/70 px-2 pb-2 pt-4 sm:px-4">
        <HuntingGrowthChart
          points={purchasable.map((row) => ({
            level: row.level,
            bonus: row.bonus,
            totalCost: row.totalCost ?? 0,
          }))}
          color={meta.color}
          bonusLabel={meta.bonusLabel}
          costLabel={`累计${meta.costUnit}`}
        />
        <p className="px-2 pt-1 text-center text-xs text-zinc-500">
          横轴为累计{meta.costUnit}，纵轴为{meta.bonusLabel}
        </p>
      </div>

      <GrowthTable rows={track.rows} kind={kind} purchasableMaxLevel={track.purchasableMaxLevel} />
    </section>
  );
}
