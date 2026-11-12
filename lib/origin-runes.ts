export type OriginRuneQuality = 3 | 4 | 5;
export type OriginRuneCategory = "special" | "normal";

export const ORIGIN_RUNE_QUALITY_STYLES = {
  5: { label: "橙色", border: "border-[#d86b32]/65", bg: "bg-[#d86b32]/10", active: "border-[#d86b32]/75 bg-[#d86b32]/15 text-[#f29b63]", text: "text-[#ef8d4f]", dot: "bg-[#d86b32]" },
  4: { label: "金色", border: "border-[#d1ac69]/65", bg: "bg-[#d1ac69]/10", active: "border-[#d1ac69]/75 bg-[#d1ac69]/15 text-[#e2c38b]", text: "text-[#e2c38b]", dot: "bg-[#d1ac69]" },
  3: { label: "紫色", border: "border-[#a65aae]/60", bg: "bg-[#a65aae]/10", active: "border-[#a65aae]/70 bg-[#a65aae]/15 text-[#d28ad8]", text: "text-[#c57acc]", dot: "bg-[#a65aae]" },
} as const;

export function getOriginRuneHref(id: string): string {
  return `/origin/runes/${encodeURIComponent(id)}`;
}

export interface OriginRune {
  id: string;
  name: string;
  description: string;
  category: OriginRuneCategory;
  quality: OriginRuneQuality;
  icon: string;
  tagIds: number[];
}

export interface OriginRuneCatalog {
  schemaVersion: 2;
  tags: { id: number; name: string }[];
  runes: OriginRune[];
}

export interface OriginRuneFilters {
  query: string;
  categories: ReadonlySet<OriginRuneCategory>;
  qualities: ReadonlySet<OriginRuneQuality>;
  tagIds: ReadonlySet<number>;
}

export function filterOriginRunes(runes: readonly OriginRune[], filters: OriginRuneFilters): OriginRune[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return runes.filter((rune) =>
    (!query || rune.name.toLocaleLowerCase().includes(query) || rune.id.includes(query)) &&
    (!filters.categories.size || filters.categories.has(rune.category)) &&
    (!filters.qualities.size || filters.qualities.has(rune.quality)) &&
    (!filters.tagIds.size || rune.tagIds.some((id) => filters.tagIds.has(id))),
  ).sort((a, b) => {
    if (a.category !== b.category) return a.category === "special" ? -1 : 1;
    if (a.category === "special") return 0;
    return b.quality - a.quality || Number(a.id) - Number(b.id);
  });
}

export function resolveOriginRuneSelection(runes: readonly OriginRune[], selectedId: string | null): string | null {
  if (!runes.length) return null;
  return selectedId && runes.some((rune) => rune.id === selectedId) ? selectedId : runes[0].id;
}
