"use client";

import { ChevronDown, RotateCcw, Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { HoverPreviewPanel } from "@/components/HoverPreviewPanel";
import { renderInlineDescription } from "@/components/InlineDescription";
import { MultiplierBadges } from "@/components/MultiplierBadges";
import { getProviderRelationsForSource } from "@/lib/multiplier-data";
import { filterOriginRunes, resolveOriginRuneSelection,
  type OriginRune, type OriginRuneCatalog, type OriginRuneCategory,
  type OriginRuneQuality } from "@/lib/origin-runes";
import { getAssetPath } from "@/lib/path";

const qualityOptions = [5, 4, 3] as const;
const qualityStyles = {
  5: { label: "橙色", border: "border-[#d86b32]/65", bg: "bg-[#d86b32]/10", active: "border-[#d86b32]/75 bg-[#d86b32]/15 text-[#f29b63]", text: "text-[#ef8d4f]", dot: "bg-[#d86b32]" },
  4: { label: "金色", border: "border-[#d1ac69]/65", bg: "bg-[#d1ac69]/10", active: "border-[#d1ac69]/75 bg-[#d1ac69]/15 text-[#e2c38b]", text: "text-[#e2c38b]", dot: "bg-[#d1ac69]" },
  3: { label: "紫色", border: "border-[#a65aae]/60", bg: "bg-[#a65aae]/10", active: "border-[#a65aae]/70 bg-[#a65aae]/15 text-[#d28ad8]", text: "text-[#c57acc]", dot: "bg-[#a65aae]" },
} as const;
const inactiveFilter = "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/70 hover:text-white";
const filterButton = "flex min-h-11 touch-manipulation items-center justify-center gap-1 rounded border px-2 py-2 text-sm font-medium transition-colors outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 sm:gap-2 sm:px-3";

function RuneIcon({ path, quality }: { path: string; quality: OriginRuneQuality }) {
  const maskImage = `url("${getAssetPath(path)}")`;
  return <span aria-hidden="true"
    className={`block h-20 w-20 max-w-full shrink-0 bg-current ${qualityStyles[quality].text}`}
    style={{ maskImage, WebkitMaskImage: maskImage, maskSize: "contain", WebkitMaskSize: "contain",
      maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center", WebkitMaskPosition: "center" }} />;
}

function RuneDescription({ description }: { description: string }) {
  return <span className="block space-y-1.5 [&_strong]:font-semibold [&_strong]:text-[#e2bd75]">
    {description.match(/[^。]+。?|。/g)?.map((sentence, index) =>
      <span key={index} className="block whitespace-pre-line">{renderInlineDescription(sentence)}</span>)}
  </span>;
}

function RuneTags({ rune, tagNames }: { rune: OriginRune; tagNames: Map<number, string> }) {
  return <span className="flex flex-wrap gap-1.5">
    {rune.tagIds.map((id) => <span key={id}
      className="max-w-full break-words rounded border border-white/10 bg-zinc-800/80 px-1.5 py-0.5 text-[11px] leading-4 text-zinc-200">
      {tagNames.get(id)}
    </span>)}
  </span>;
}

function toggleSet<T>(current: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function RuneDetails({ rune, tagNames, showOperation, onClose }: {
  rune: OriginRune;
  tagNames: Map<number, string>;
  showOperation: boolean;
  onClose?: () => void;
}) {
  const quality = qualityStyles[rune.quality];
  const relations = getProviderRelationsForSource({ type: "origin-rune", id: rune.id });
  return (
    <div className="min-w-0 bg-[#15171b]">
      <div className="flex min-h-12 items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
        <h2 className="min-w-0 break-words text-sm font-semibold leading-6 text-white">{rune.name}</h2>
        {onClose && <button type="button" onClick={onClose} aria-label="关闭强化详情" title="关闭"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-zinc-400 outline-none hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white">
          <X aria-hidden="true" className="h-5 w-5" />
        </button>}
      </div>
      <div className="space-y-2 border-b border-white/10 px-4 py-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={quality.text}>{quality.label}品质</span>
          <span className="text-zinc-400">{rune.category === "special" ? "特殊强化" : "普通强化"}</span>
        </div>
        <RuneTags rune={rune} tagNames={tagNames} />
      </div>
      <div className="px-4 py-3.5">
        <h3 className="mb-2 text-xs font-medium text-zinc-400">强化效果</h3>
        <div className="break-words text-sm leading-6 text-zinc-200">
          <RuneDescription description={rune.description} />
        </div>
      </div>
      {relations.length > 0 && <div className="border-t border-white/10 px-4 py-3">
        <MultiplierBadges relations={relations} variant="catalog-compact" showOperation={showOperation} />
      </div>}
    </div>
  );
}

function RuneCard({ rune, tagNames, showOperation, onOpenMobile }: {
  rune: OriginRune;
  tagNames: Map<number, string>;
  showOperation: boolean;
  onOpenMobile: (rune: OriginRune, trigger: HTMLButtonElement) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const quality = qualityStyles[rune.quality];
  const relations = getProviderRelationsForSource({ type: "origin-rune", id: rune.id });
  const hasMultipleFactors = new Set(relations.map((relation) => relation.factorId)).size > 1;

  const showPreview = () => setIsOpen(true);
  return <div id={`rune-${rune.id}`} className="relative min-w-0 scroll-mt-24 transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
    <button ref={buttonRef} type="button" aria-describedby={isOpen ? tooltipId : undefined}
      onMouseEnter={() => { if (window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1024px)").matches) showPreview(); }}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={(event) => { if (event.currentTarget.matches(":focus-visible") && window.matchMedia("(min-width: 1024px)").matches) showPreview(); }}
      onBlur={() => setIsOpen(false)}
      onKeyDown={(event) => { if (event.key === "Escape") setIsOpen(false); }}
      onClick={(event) => {
        if (window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1024px)").matches) showPreview();
        else { setIsOpen(false); onOpenMobile(rune, event.currentTarget); }
      }}
      className={`group relative flex h-full w-full min-w-0 touch-manipulation flex-col items-center overflow-hidden rounded-lg border-2 p-3 pb-4 text-left transition-colors duration-200 outline-none hover:brightness-110 focus-visible:[&_h3]:underline focus-visible:[&_h3]:decoration-2 focus-visible:[&_h3]:underline-offset-4 ${quality.border} ${quality.bg}`}>
      <span className="sr-only">{quality.label}品质，{rune.category === "special" ? "特殊强化" : "普通强化"}</span>
      <span className={`pointer-events-none absolute inset-x-0.5 top-0.5 flex-wrap gap-0.5 ${relations.length ? (hasMultipleFactors || rune.tagIds.length > 1 ? "hidden" : "hidden sm:flex") : "flex"}`}>
        {rune.tagIds.map((id) => <span key={id}
          className="rounded border border-white/30 bg-zinc-700 px-[3px] py-px text-[10px] font-medium leading-3 text-zinc-200">
          {tagNames.get(id)}
        </span>)}
      </span>
      <RuneIcon path={rune.icon} quality={rune.quality} />
      <h3 className="mt-2 w-full break-words text-center text-sm font-medium leading-tight text-white">{rune.name}</h3>
    </button>
    {relations.length > 0 && <MultiplierBadges relations={relations} variant="catalog-compact"
      showOperation={showOperation}
      className={`absolute top-1 z-10 [&_a]:min-h-5 [&_a]:min-w-0 [&_a]:justify-center [&_a]:py-0 [&_a]:text-center [&_a]:leading-3 [&_a_span]:break-all ${hasMultipleFactors
        ? "inset-x-1 flex-nowrap gap-0.5 [&_a]:flex-1 [&_a]:px-0.5 [&_a]:text-[9px]"
        : "right-1 max-w-[calc(100%-0.5rem)] justify-end [&_a]:px-1 [&_a]:text-[9px] sm:[&_a]:text-[10px]"}`} />}
    <HoverPreviewPanel open={isOpen} anchorRef={buttonRef} id={tooltipId}>
      <RuneDetails rune={rune} tagNames={tagNames} showOperation={showOperation} />
    </HoverPreviewPanel>
  </div>;
}

export default function OriginRunesClient({ catalog, showOperation, onShowOperationChange }: {
  catalog: OriginRuneCatalog;
  showOperation: boolean;
  onShowOperationChange: (value: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [categories, setCategories] = useState<Set<OriginRuneCategory>>(new Set());
  const [qualities, setQualities] = useState<Set<OriginRuneQuality>>(new Set());
  const [tagIds, setTagIds] = useState<Set<number>>(new Set());
  const [showMobileTags, setShowMobileTags] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(catalog.runes[0]?.id ?? null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectedTrigger = useRef<HTMLButtonElement>(null);
  const tagNames = useMemo(() => new Map(catalog.tags.map((tag) => [tag.id, tag.name])), [catalog.tags]);
  const filtered = useMemo(() => filterOriginRunes(catalog.runes, {
    query: deferredQuery, categories, qualities, tagIds,
  }), [catalog.runes, deferredQuery, categories, qualities, tagIds]);
  const resolvedId = resolveOriginRuneSelection(filtered, selectedId);
  const selected = filtered.find((rune) => rune.id === resolvedId);
  const hasFilters = Boolean(query || categories.size || qualities.size || tagIds.size);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialogOpen) dialog?.showModal();
    else if (dialog?.open) dialog.close();
    return () => { if (dialog?.open) dialog.close(); };
  }, [dialogOpen]);

  useEffect(() => {
    const focusLinkedRune = () => {
      const id = window.location.hash.match(/^#rune-(\d+)$/)?.[1];
      if (!id || !catalog.runes.some((rune) => rune.id === id)) return;
      setSelectedId(id);
      window.requestAnimationFrame(() => document.getElementById(`rune-${id}`)?.scrollIntoView({ block: "center" }));
    };
    focusLinkedRune();
    window.addEventListener("hashchange", focusLinkedRune);
    return () => window.removeEventListener("hashchange", focusLinkedRune);
  }, [catalog.runes]);

  const resetFilters = () => {
    setQuery(""); setCategories(new Set()); setQualities(new Set()); setTagIds(new Set());
    setDialogOpen(false);
  };
  const selectRune = (rune: OriginRune, trigger: HTMLButtonElement) => {
    setSelectedId(rune.id);
    selectedTrigger.current = trigger;
    setDialogOpen(true);
  };

  return (
    <section id="runes" aria-label="强化图鉴" className="scroll-mt-6">
      <div className="mb-5 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <div role="search" className="relative mb-6 max-w-xl">
          <label htmlFor="origin-rune-search" className="sr-only">搜索强化名称或 ID</label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input id="origin-rune-search" type="search" value={query}
            onChange={(event) => { setQuery(event.target.value); setDialogOpen(false); }}
            placeholder="搜索强化名称或 ID"
            className="min-h-11 w-full rounded border border-zinc-700 bg-zinc-900/80 py-2 pl-10 pr-11 text-base text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus-visible:border-zinc-400 focus-visible:underline" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="清空搜索" title="清空搜索"
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-zinc-400 outline-none hover:bg-zinc-800 hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>}
        </div>
        <div className="grid gap-x-6 gap-y-5 lg:grid-cols-2">
          <fieldset>
            <legend className="mb-3 text-base font-semibold text-zinc-300">强化分类</legend>
            <div className="grid max-w-md grid-cols-2 gap-2">
              {([{ id: "special", label: "特殊强化" }, { id: "normal", label: "普通强化" }] as const).map((item) =>
                <button key={item.id} type="button" aria-pressed={categories.has(item.id)}
                  onClick={() => { setCategories(toggleSet(categories, item.id)); setDialogOpen(false); }}
                  className={`${filterButton} ${categories.has(item.id) ? "border-zinc-400 bg-zinc-600 text-white" : inactiveFilter}`}>
                  {item.label}
                </button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-3 text-base font-semibold text-zinc-300">强化品质</legend>
            <div className="grid max-w-md grid-cols-3 gap-2">
              {qualityOptions.map((quality) => <button key={quality} type="button" aria-pressed={qualities.has(quality)}
                onClick={() => { setQualities(toggleSet(qualities, quality)); setDialogOpen(false); }}
                className={`${filterButton} ${qualities.has(quality) ? qualityStyles[quality].active : inactiveFilter}`}>
                <span aria-hidden="true" className={`h-3 w-3 shrink-0 ${qualityStyles[quality].dot}`} />
                <span className="whitespace-nowrap">{qualityStyles[quality].label}</span>
              </button>)}
            </div>
          </fieldset>
        </div>
        <fieldset className="mt-5">
          <legend className="mb-3 text-base font-semibold text-zinc-300">强化标签</legend>
          <button type="button" aria-expanded={showMobileTags} onClick={() => setShowMobileTags(!showMobileTags)}
            className="mb-2 flex min-h-11 w-full items-center justify-between border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-300 outline-none focus-visible:underline lg:hidden">
            {showMobileTags ? "收起标签" : "展开标签"}
            <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${showMobileTags ? "rotate-180" : ""}`} />
          </button>
          <div className={`${showMobileTags ? "grid" : "hidden"} grid-cols-3 gap-2 sm:grid-cols-5 lg:grid lg:grid-cols-7`}>
            {catalog.tags.map((tag) => <button key={tag.id} type="button" aria-pressed={tagIds.has(tag.id)}
              onClick={() => { setTagIds(toggleSet(tagIds, tag.id)); setDialogOpen(false); }}
              className={`${filterButton} min-w-0 px-2 ${tagIds.has(tag.id) ? "border-zinc-400 bg-zinc-600 text-white" : inactiveFilter}`}>
              <span className="min-w-0 break-words">{tag.name}</span>
            </button>)}
          </div>
        </fieldset>
        <fieldset className="mt-5">
          <legend className="mb-3 text-base font-semibold text-zinc-300">开发者选项</legend>
          <button type="button" aria-pressed={showOperation} onClick={() => onShowOperationChange(!showOperation)}
            className={`${filterButton} ${showOperation ? "border-zinc-400 bg-zinc-600 text-white" : inactiveFilter}`}>
            显示运算符
          </button>
        </fieldset>
      </div>
      <div className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-zinc-400">共 {filtered.length} 项强化</p>
        {hasFilters && <button type="button" onClick={resetFilters}
          className="flex min-h-11 items-center gap-1.5 px-3 text-sm text-zinc-400 outline-none hover:text-white focus-visible:underline">
          <RotateCcw aria-hidden="true" className="h-4 w-4" />重置筛选
        </button>}
      </div>
      {filtered.length ? <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {filtered.map((rune) => <RuneCard key={rune.id} rune={rune} tagNames={tagNames} showOperation={showOperation} onOpenMobile={selectRune} />)}
      </div> : <div className="py-16 text-center text-zinc-400">没有符合条件的强化</div>}
      <dialog ref={dialogRef} onClose={() => { setDialogOpen(false); selectedTrigger.current?.focus(); }}
        aria-label="强化详情" className="m-auto max-h-[85dvh] w-[min(92vw,420px)] max-w-none overflow-y-auto border border-zinc-600 bg-zinc-900 p-0 text-white shadow-2xl backdrop:bg-black/70">
        {selected && <RuneDetails rune={selected} tagNames={tagNames} showOperation={showOperation} onClose={() => dialogRef.current?.close()} />}
      </dialog>
    </section>
  );
}
