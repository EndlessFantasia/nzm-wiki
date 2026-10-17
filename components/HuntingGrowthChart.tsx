"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface HuntingGrowthChartPoint {
  level: number;
  bonus: number;
  totalCost: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
  costLabel: string;
  bonusLabel: string;
  color: string;
}

function formatCost(value: number): string {
  if (value === 0) return "0";
  if (value >= 10000) return `${Number((value / 10000).toFixed(1))}w`;
  return value.toLocaleString("zh-CN");
}

function formatBonus(value: number): string {
  return `+${Math.round(value * 100).toLocaleString("zh-CN")}%`;
}

function getNiceTicks(max: number, maxSegments: number): number[] {
  const rough = max / maxSegments;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((value) => value >= rough)!;
  const ticks: number[] = [];
  for (let value = 0; value < max + step; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks;
}

function isPoint(value: unknown): value is HuntingGrowthChartPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.level === "number" &&
    typeof point.bonus === "number" &&
    typeof point.totalCost === "number"
  );
}

function ChartTooltip({ active, payload, costLabel, bonusLabel, color }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (!isPoint(point)) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm shadow-lg">
      <p className="text-zinc-400">
        等级 <span className="text-zinc-200 tabular-nums">{point.level}</span>
      </p>
      <p className="text-zinc-400">
        {bonusLabel}{" "}
        <span className="tabular-nums" style={{ color }}>
          {formatBonus(point.bonus)}
        </span>
      </p>
      <p className="text-zinc-400">
        {costLabel}{" "}
        <span className="text-zinc-200 tabular-nums">
          {point.totalCost.toLocaleString("zh-CN")}
        </span>
      </p>
    </div>
  );
}

export function HuntingGrowthChart({
  points,
  color,
  costLabel,
  bonusLabel,
}: {
  points: HuntingGrowthChartPoint[];
  color: string;
  costLabel: string;
  bonusLabel: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const maxCost = points.at(-1)?.totalCost ?? 0;
  const costTicks = getNiceTicks(maxCost, 6).filter((tick) => tick <= maxCost);
  const bonusTicks = getNiceTicks(points.at(-1)?.bonus ?? 0, 4);

  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="totalCost"
            type="number"
            domain={[0, maxCost]}
            ticks={costTicks}
            tickFormatter={formatCost}
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={{ stroke: "#3f3f46" }}
          />
          <YAxis
            dataKey="bonus"
            type="number"
            domain={[0, bonusTicks.at(-1)!]}
            ticks={bonusTicks}
            tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={{ stroke: "#3f3f46" }}
            width={52}
          />
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltip
                active={active}
                payload={payload}
                costLabel={costLabel}
                bonusLabel={bonusLabel}
                color={color}
              />
            )}
          />
          <Area
            type="linear"
            dataKey="bonus"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: color, stroke: "#18181b", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
