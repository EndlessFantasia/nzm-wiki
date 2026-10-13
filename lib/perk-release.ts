import type { Perk } from "@/types";
import { isDateKeyWithinPastDays } from "@/lib/date-key";
import { isPreviewSeason } from "@/lib/content-preview";
import s4NewPerks from "@/data/s4-new-perks.json";

const s4NewItemIds = new Set(s4NewPerks.itemIds);
const s4SeasonLaunchItemIds = new Set(s4NewPerks.seasonLaunchItemIds);
const s4SuperItemIds = new Set(s4NewPerks.superItemIds);

/** First-launch membership is frozen; unreleased status comes from the live catalog. */
export function getS4PerkLaunchGroup(
  perk: Pick<Perk, "itemId" | "season" | "collectModItem">,
): "season-new" | "midseason-new" | "season-unreleased" | undefined {
  if (perk.season !== "s4" || !perk.itemId || !s4NewItemIds.has(perk.itemId)) return undefined;
  if (getPerkConfiguredAvailability(perk) === "offline") {
    return s4SuperItemIds.has(perk.itemId) ? undefined : "season-unreleased";
  }
  return s4SeasonLaunchItemIds.has(perk.itemId) ? "season-new" : "midseason-new";
}

export const RECENT_PERK_WINDOW_DAYS = 7;

/** Configured collection state within a channel, including unpublished preview seasons. */
export function getPerkConfiguredAvailability(
  perk: Pick<Perk, "collectModItem">,
): "online" | "offline" {
  return perk.collectModItem === 1 ? "online" : "offline";
}

export function getPerkAvailability(
  perk: Pick<Perk, "collectModItem" | "season">,
): "preview" | "online" | "offline" {
  if (isPreviewSeason(perk.season)) return "preview";
  return getPerkConfiguredAvailability(perk);
}

export function isPerkRecent(
  perk: Pick<Perk, "collectModItem" | "releaseDate" | "season">,
  todayKey: string,
): boolean {
  return (
    getPerkAvailability(perk) === "online" &&
    isDateKeyWithinPastDays(
      perk.releaseDate,
      todayKey,
      RECENT_PERK_WINDOW_DAYS,
    )
  );
}
