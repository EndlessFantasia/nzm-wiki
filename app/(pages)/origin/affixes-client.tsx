"use client";

import { RotateCcw, Search, Star, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { MultiplierBadges } from "@/components/MultiplierBadges";
import { getProviderRelationsForSource } from "@/lib/multiplier-data";
import { revealLocatedTarget } from "@/lib/locate-target";
import { filterOriginAffixes, type OriginAffix, type OriginAffixCatalog,
  type OriginAffixCategory } from "@/lib/origin-affixes";

const categoryOptions = [
  { id: "special", label: "特殊词条" },
  { id: "normal", label: "普通词条" },
] as const satisfies readonly { id: OriginAffixCategory; label: string }[];
const categoryStyles = {
  special: { label: "特殊词条", border: "border-[#d1ac69]/65", bg: "bg-[#d1ac69]/10", star: "fill-[#e2bd75] text-[#e2bd75]" },
  normal: { label: "普通词条", border: "border-zinc-600", bg: "bg-zinc-800/60", star: "fill-zinc-400 text-zinc-400" },
} as const;
const inactiveFilter = "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/70 hover:text-white";
const filterButton = "flex min-h-11 touch-manipulation items-center justify-center rounded border px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4";

function AffixCard({ affix, linked, showOperation }: { affix: OriginAffix; linked: boolean; showOperation: boolean }) {
  const style = categoryStyles[affix.category];
  const relations = getProviderRelationsForSource({ type: "origin-affix", id: affix.id });
  return <article id={`affix-${affix.id}`} aria-labelledby={`affix-${affix.id}-name`}
    className={`relative flex min-w-0 scroll-mt-24 gap-3 rounded-lg border-2 p-3 transition duration-200 hover:-translate-y-0.5 hover:brightness-110 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-4 ${linked ? "border-zinc-300" : style.border} ${style.bg}`}>
    <span className="sr-only">{style.label}，ID {affix.id}</span>
    <Star aria-hidden="true" className={`mt-0.5 h-7 w-7 shrink-0 ${style.star}`} />
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h3 id={`affix-${affix.id}-name`} className="min-w-0 break-words text-base font-semibold leading-6 text-white">{affix.name}</h3>
        {relations.length > 0 && <MultiplierBadges relations={relations} variant="catalog-compact"
          showOperation={showOperation}
          className="max-w-[60%] shrink-0 justify-end gap-1 [&_a]:px-1.5 [&_a]:text-[10px] sm:[&_a]:text-[11px]" />}
      </div>
      <p className="mt-1 break-words text-sm leading-6 text-zinc-300">{affix.description}</p>
    </div>
  </article>;
}

export default function OriginAffixesClient({ catalog, showOperation }: { catalog: OriginAffixCatalog; showOperation: boolean }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [categories, setCategories] = useState<Set<OriginAffixCategory>>(new Set());
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const filtered = useMemo(() => filterOriginAffixes(catalog.affixes, { query: deferredQuery, categories }),
    [catalog.affixes, deferredQuery, categories]);
  const hasFilters = Boolean(query || categories.size);

  useEffect(() => {
    const focusLinkedAffix = () => {
      const id = window.location.hash.match(/^#affix-(\d+)$/)?.[1];
      setLinkedId(id && catalog.affixes.some((affix) => affix.id === id) ? id : null);
      if (id) window.requestAnimationFrame(() => revealLocatedTarget(`affix-${id}`));
    };
    focusLinkedAffix();
    window.addEventListener("hashchange", focusLinkedAffix);
    return () => window.removeEventListener("hashchange", focusLinkedAffix);
  }, [catalog.affixes]);

  const toggleCategory = (id: OriginAffixCategory) => {
    const next = new Set(categories);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCategories(next);
  };

  return (
    <section id="affixes" aria-label="词条图鉴" className="scroll-mt-6">
      <div className="mb-5 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <div role="search" className="relative mb-6 max-w-xl">
          <label htmlFor="origin-affix-search" className="sr-only">搜索词条名称、描述或 ID</label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input id="origin-affix-search" type="search" value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索词条名称、描述或 ID"
            className="min-h-11 w-full rounded border border-zinc-700 bg-zinc-900/80 py-2 pl-10 pr-11 text-base text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus-visible:border-zinc-400 focus-visible:underline" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="清空搜索" title="清空搜索"
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-zinc-400 outline-none hover:bg-zinc-800 hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>}
        </div>
        <fieldset>
          <legend className="mb-3 text-base font-semibold text-zinc-300">词条分类</legend>
          <div className="grid max-w-md grid-cols-2 gap-2">
            {categoryOptions.map((item) => <button key={item.id} type="button" aria-pressed={categories.has(item.id)}
              onClick={() => toggleCategory(item.id)}
              className={`${filterButton} ${categories.has(item.id) ? "border-zinc-400 bg-zinc-600 text-white" : inactiveFilter}`}>
              {item.label}
            </button>)}
          </div>
        </fieldset>
      </div>
      <div className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-zinc-400">共 {filtered.length} 项词条</p>
        {hasFilters && <button type="button" onClick={() => { setQuery(""); setCategories(new Set()); }}
          className="flex min-h-11 items-center gap-1.5 px-3 text-sm text-zinc-400 outline-none hover:text-white focus-visible:underline">
          <RotateCcw aria-hidden="true" className="h-4 w-4" />重置筛选
        </button>}
      </div>
      {filtered.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((affix) => <AffixCard key={affix.id} affix={affix} linked={affix.id === linkedId} showOperation={showOperation} />)}
      </div> : <div className="py-16 text-center text-zinc-400">暂无对应词条</div>}
    </section>
  );
}
