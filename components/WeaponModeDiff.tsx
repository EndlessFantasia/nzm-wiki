import type { ResolvedField, ResolvedWeapon } from "@/lib/weapon-resolver";
import {
  buildWeaponModeDiff,
  getWeaponModeDiffFieldLabel,
  type WeaponModeDiffField,
  type WeaponModeDiffRow,
} from "@/lib/weapon-mode-diff";
import {
  getHealthSettlementDefinition,
  type WeaponHealthSettlementType,
} from "@/lib/weapon-health-settlement";

const STATE_LABELS = {
  not_applicable: "不适用",
  missing: "缺失",
  unavailable: "不可用",
  unrecognized: "未识别",
} as const;

const TOUGHNESS_LABELS = {
  none: "无",
  impulse: "冲击",
  penetration: "贯穿",
  explosion: "爆炸",
} as const;

function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function formatDamage(value: number, table: "lc" | "td", pellets?: number): string {
  const damage = formatNumber(value * (table === "lc" ? 500 : 400));
  return pellets && pellets > 1 ? `${damage} × ${pellets}` : damage;
}

function formatField(
  field: ResolvedField<unknown> | undefined,
  key: WeaponModeDiffField,
  table: "lc" | "td",
  pellets?: number,
  healthType?: WeaponHealthSettlementType,
): string {
  if (!field) return "无来源";
  if (field.state !== "resolved" && field.state !== "zero") {
    return STATE_LABELS[field.state];
  }
  const value = field.value;
  if (key === "health.type" && typeof value === "string") {
    return getHealthSettlementDefinition(
      value as WeaponHealthSettlementType,
    ).label;
  }
  if (key === "health.scale" && typeof value === "number") {
    const definition = healthType
      ? getHealthSettlementDefinition(healthType)
      : undefined;
    return definition?.valueFormat === "percentage"
      ? `${formatNumber(value * 100)}%`
      : `系数 ${formatNumber(value)}`;
  }
  if (key === "health.base" && typeof value === "number") {
    const definition = healthType
      ? getHealthSettlementDefinition(healthType)
      : undefined;
    return definition?.valueFormat === "raw"
      ? `固定值 ${formatNumber(value)}`
      : `${formatNumber(value)} 点`;
  }
  if (key === "damage.base" && typeof value === "number") {
    return formatDamage(value, table, pellets);
  }
  if (key === "elementAddRate" && typeof value === "number") {
    return `${formatNumber(value * 100)}%`;
  }
  if (key === "weaknessMultiplier" && typeof value === "number") {
    return `×${formatNumber(value)}`;
  }
  if (key === "toughness" && typeof value === "string") {
    return TOUGHNESS_LABELS[value as keyof typeof TOUGHNESS_LABELS] ?? value;
  }
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return formatNumber(value);
  return value === undefined ? "缺失" : String(value);
}

function cellValue(row: WeaponModeDiffRow, table: "lc" | "td"): string {
  if (row.field === "availability") {
    return (table === "lc" ? row.lcAvailable : row.tdAvailable)
      ? "可用"
      : "无来源";
  }
  return formatField(
    table === "lc" ? row.lcField : row.tdField,
    row.field,
    table,
    table === "lc" ? row.lcPellets : row.tdPellets,
    table === "lc" ? row.lcHealthType : row.tdHealthType,
  );
}

export function WeaponModeDiff({
  lcWeapon,
  tdWeapon,
}: {
  lcWeapon: ResolvedWeapon;
  tdWeapon: ResolvedWeapon;
}) {
  const rows = buildWeaponModeDiff(lcWeapon, tdWeapon);
  if (rows.length === 0) return null;

  return (
    <section className="not-prose my-6">
      <h2 className="mb-3 text-lg font-semibold text-white">
        猎场 / 塔防数值差异
      </h2>
      <div className="overflow-x-auto rounded-xl border border-zinc-700">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="bg-zinc-800/80 text-zinc-300">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">来源</th>
              <th className="px-3 py-2.5 text-left font-medium">字段</th>
              <th className="px-3 py-2.5 text-right font-medium">猎场</th>
              <th className="px-3 py-2.5 text-right font-medium">塔防</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.sourceId}:${row.field}`}
                className="border-t border-zinc-700/60 bg-zinc-900/40"
              >
                <td className="whitespace-nowrap px-3 py-2 text-zinc-200">
                  {row.sourceName}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
                  {getWeaponModeDiffFieldLabel(row)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-100">
                  {cellValue(row, "lc")}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-100">
                  {cellValue(row, "td")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
