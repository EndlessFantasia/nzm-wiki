import rawHuntingGrowth from "@/data/guides/hunting-growth.json";

export type HuntingGrowthKind = "level" | "attack";

export interface HuntingGrowthRow {
  level: number;
  bonus: number;
  cost: number | null;
  totalCost: number | null;
}

export interface HuntingGrowthTrack {
  kind: HuntingGrowthKind;
  source: string;
  rows: HuntingGrowthRow[];
  purchasableMaxLevel: number;
}

type RawTrack = {
  source: string;
  costs: number[];
  bonuses: number[];
};

function isNumberList(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "number" && Number.isFinite(item) && item >= 0)
  );
}

function readTrack(kind: HuntingGrowthKind): RawTrack {
  const data = rawHuntingGrowth as unknown as {
    schemaVersion?: number;
    level?: { source?: unknown; upgradeExp?: unknown; healthBonus?: unknown };
    attack?: { source?: unknown; upgradeGold?: unknown; attackBonus?: unknown };
  };
  if (data.schemaVersion !== 1) throw new Error("猎场成长数据版本无效");

  const raw =
    kind === "level"
      ? { source: data.level?.source, costs: data.level?.upgradeExp, bonuses: data.level?.healthBonus }
      : { source: data.attack?.source, costs: data.attack?.upgradeGold, bonuses: data.attack?.attackBonus };

  const { source, costs, bonuses } = raw;
  if (
    typeof source !== "string" ||
    !isNumberList(costs) ||
    !isNumberList(bonuses) ||
    bonuses.length < costs.length ||
    bonuses.some((value, index) => index > 0 && value <= bonuses[index - 1])
  ) {
    throw new Error(`猎场成长数据无效：${kind}`);
  }

  return { source, costs, bonuses };
}

function buildTrack(kind: HuntingGrowthKind): HuntingGrowthTrack {
  const { source, costs, bonuses } = readTrack(kind);
  const rows: HuntingGrowthRow[] = [{ level: 0, bonus: 0, cost: null, totalCost: 0 }];
  let total = 0;

  bonuses.forEach((bonus, index) => {
    const cost = costs[index] ?? null;
    if (cost !== null) total += cost;
    rows.push({
      level: index + 1,
      bonus,
      cost,
      totalCost: cost === null ? null : total,
    });
  });

  return { kind, source, rows, purchasableMaxLevel: costs.length };
}

export const HUNTING_GROWTH: Record<HuntingGrowthKind, HuntingGrowthTrack> = {
  level: buildTrack("level"),
  attack: buildTrack("attack"),
};
