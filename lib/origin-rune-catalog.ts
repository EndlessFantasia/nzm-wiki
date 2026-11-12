import rawCatalog from "@/data/origin/runes.json";
import type { OriginRuneCatalog } from "@/lib/origin-runes";

export const ORIGIN_RUNE_CATALOG = rawCatalog as OriginRuneCatalog;

export function getOriginRuneById(id: string) {
  return ORIGIN_RUNE_CATALOG.runes.find((rune) => rune.id === id);
}
