"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { MultiplierBadges } from "@/components/MultiplierBadges";
import {
  TalentConnectorLines,
  TalentDetails,
  TalentLevelActions,
  TalentLevelPreview,
  TalentNode,
  TalentWorkspace,
  useTalentPreviewLevel,
} from "@/components/season-talents/TalentEditor";
import { revealLocatedTarget } from "@/lib/locate-target";
import { getProviderRelationsForSource } from "@/lib/multiplier-data";
import {
  getOriginTalentCost,
  getOriginTalentTotals,
  isOriginTalentUnlocked,
  restoreOriginTalentLevels,
  setOriginTalentLevel,
  type OriginTalent,
  type OriginTalentBranchId,
  type OriginTalentCatalog,
  type OriginTalentLevels,
  type OriginTalentUnlockedRune,
} from "@/lib/origin-talents";
import { getAssetPath } from "@/lib/path";

const branchColors: Record<OriginTalentBranchId, string> = { 1: "#ef8c8c", 2: "#dcc46e", 3: "#7dc6e4", 4: "#e3ac68" };
const runeColors = { 5: "#ef8d4f", 4: "#e2c38b", 3: "#c57acc" } as const;
const storageKey = "nzm-wiki:origin:talents:v1";
const desktopQuery = "(min-width: 1024px)";
const rowCount = 8;
const rowPx = 84;
const nodePx = 58;
const nodeStyle = { width: 56, height: nodePx };
// 连线从节点底边直通下一节点，名称垫底色压在线上
const nodeName = "w-auto! whitespace-nowrap rounded-sm bg-[#15171a] px-1";
const chip = "inline-flex min-h-[26px] items-center gap-1.5 rounded border px-2 py-1 text-xs leading-4";
const chipLink = `${chip} border-white/10 bg-white/5 text-zinc-200 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white`;

function branchTheme(branchId: OriginTalentBranchId): CSSProperties {
  const color = branchColors[branchId];
  return { "--talent-accent": color, "--talent-accent-soft": `${color}1f`, "--talent-glow": `${color}55` } as CSSProperties;
}

function branchName(catalog: OriginTalentCatalog, branchId: OriginTalentBranchId) {
  return catalog.branches.find((branch) => branch.id === branchId)?.name ?? "终极";
}

function columnFor(talent: OriginTalent, talents: readonly OriginTalent[]) {
  const row = talents.filter((other) => other.branchId === talent.branchId && other.row === talent.row);
  return row.length === 1 ? { start: 2, x: 50 } : row.indexOf(talent) === 0 ? { start: 1, x: 25 } : { start: 3, x: 75 };
}

function rowPercent(row: number, offset: number, rows: number) {
  return (((row - 0.5) * rowPx + offset) / (rows * rowPx)) * 100;
}

function DetailSection({ label, children }: { label: string; children: ReactNode }) {
  return <div className="mt-3 border-t border-white/10 pt-3">
    <div className="mb-2 text-xs font-medium leading-4 text-zinc-400">{label}</div>
    {children}
  </div>;
}

function RuneMaskIcon({ rune }: { rune: OriginTalentUnlockedRune }) {
  const maskImage = `url("${getAssetPath(rune.icon)}")`;
  return <span aria-hidden="true" className="block h-4 w-4 shrink-0"
    style={{ backgroundColor: runeColors[rune.quality], maskImage, WebkitMaskImage: maskImage, maskSize: "contain",
      WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center", WebkitMaskPosition: "center" }} />;
}

function OriginTalentDetails({ talent, catalog, levels, unlockedRunes, showOperation, onChangeLevel, onReset, onSelect, onClose }: {
  talent: OriginTalent;
  catalog: OriginTalentCatalog;
  levels: OriginTalentLevels;
  unlockedRunes: OriginTalentUnlockedRune[];
  showOperation: boolean;
  onChangeLevel: (level: number) => void;
  onReset: () => void;
  onSelect: (talent: OriginTalent) => void;
  onClose?: () => void;
}) {
  const level = levels[talent.id] ?? 0;
  const [previewLevel, setPreviewLevel] = useTalentPreviewLevel(talent.id, level);
  const preview = talent.levels.find((item) => item.level === previewLevel) ?? talent.levels[0];
  const unlocked = isOriginTalentUnlocked(talent, levels);
  const relations = getProviderRelationsForSource({ type: "origin-talent", id: talent.id });
  const byId = new Map(catalog.talents.map((item) => [item.id, item]));
  const totalLevels = getOriginTalentTotals(catalog.talents, levels).level - level;
  const talentButton = (target: OriginTalent, suffix?: string) =>
    <button key={target.id} type="button" onClick={() => onSelect(target)} className={chipLink}>
      {target.name}{suffix && <span className="text-zinc-400">{suffix}</span>}
    </button>;
  const previewCost = preview?.cost ?? 0;
  const output = <output aria-label="当前等级">{level}/{talent.maxLevel}</output>;

  return <div style={branchTheme(talent.branchId)} className="flex min-h-0 flex-col">
    <TalentDetails season="origin" eyebrow={`${branchName(catalog, talent.branchId)}天赋`} hideImage name={talent.name} icon={talent.icon}
      level={level} maxLevel={onClose ? undefined : talent.maxLevel} onReset={onReset}
      headingActions={onClose && <span className="flex shrink-0 items-start gap-1">
        {output}
        <button type="button" onClick={onClose} aria-label="关闭天赋详情" title="关闭"
          className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center text-zinc-400 hover:text-white">
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </span>}
      actions={<TalentLevelActions name={talent.name} level={level} maxLevel={talent.maxLevel}
        canDecrease={level > 0} canIncrease={unlocked && level < talent.maxLevel} onChange={onChangeLevel} />}>
      {talent.maxLevel > 1 && <TalentLevelPreview level={previewLevel} maxLevel={talent.maxLevel} onChange={setPreviewLevel} />}
      <div className="mt-3">
        <div className="mb-1 text-xs font-medium leading-4 text-zinc-400">天赋效果</div>
        <p className="whitespace-pre-line break-words text-zinc-100">{preview?.description ?? talent.description}</p>
      </div>
      {getOriginTalentCost(talent, talent.maxLevel) > 0 && <DetailSection label="升级消耗">
        <div className="flex flex-wrap gap-1.5">
          <span className={`${chip} border-white/10 bg-white/5 tabular-nums text-zinc-200`}>
            {talent.maxLevel > 1 ? `${previewLevel} 级 ${previewCost}` : previewCost}
          </span>
          {talent.maxLevel > 1 && previewLevel > 1 && <span className={`${chip} border-white/10 bg-white/5 tabular-nums text-zinc-300`}>
            累计 {getOriginTalentCost(talent, previewLevel)}
          </span>}
        </div>
      </DetailSection>}
      {unlockedRunes.length > 0 && <DetailSection label="解锁限定强化">
        <div className="flex flex-wrap gap-1.5">
          {unlockedRunes.map((rune) => <a key={rune.id} href={`#rune-${rune.id}`} className={chipLink}>
            <RuneMaskIcon rune={rune} />{rune.name}
          </a>)}
        </div>
      </DetailSection>}
      {(talent.prerequisites.length > 1 || talent.requiredTotalLevels > 0) && <DetailSection label="解锁条件">
        <div className="flex flex-wrap gap-1.5">
          {talent.prerequisites.map((prerequisite) => {
            const target = byId.get(prerequisite.id);
            return target && talentButton(target, ` ${prerequisite.level} 级`);
          })}
          {talent.requiredTotalLevels > 0 && <span className={`${chip} border-white/10 bg-white/5 tabular-nums text-zinc-300`}>
            其他天赋合计 {talent.requiredTotalLevels} 级（当前 {totalLevels}）
          </span>}
        </div>
      </DetailSection>}
      {relations.length > 0 && <DetailSection label="关联乘区">
        <MultiplierBadges relations={relations} variant="catalog-compact" showOperation={showOperation} className="[&_a]:min-h-[26px]" />
      </DetailSection>}
    </TalentDetails>
  </div>;
}

function BranchTree({ talents, levels, selectedId, onSelect, onIncrease }: {
  talents: OriginTalent[];
  levels: OriginTalentLevels;
  selectedId: string;
  onSelect: (talent: OriginTalent) => void;
  onIncrease: (talent: OriginTalent) => void;
}) {
  const half = nodePx / 2;
  // 移动端只显示单个分支，不需要跨分支对齐，折叠掉空行
  const usedRows = [...new Set(talents.map((talent) => talent.row))].sort((a, b) => a - b);
  const compactRow = (row: number) => usedRows.indexOf(row) + 1;
  const pathsFor = (rowOf: (row: number) => number, rows: number) => talents.flatMap((talent) => talent.prerequisites.flatMap((prerequisite) => {
    const parent = talents.find((item) => item.id === prerequisite.id);
    if (!parent) return [];
    const fromX = columnFor(parent, talents).x;
    const toX = columnFor(talent, talents).x;
    const fromY = rowPercent(rowOf(parent.row), half, rows);
    const toY = rowPercent(rowOf(talent.row), -half, rows);
    const midY = rowPercent(rowOf(talent.row), -half - 4, rows);
    const active = (levels[parent.id] ?? 0) >= prerequisite.level && (levels[talent.id] ?? 0) > 0;
    return [{ id: `${parent.id}-${talent.id}`, d: `M ${fromX} ${fromY} V ${midY} H ${toX} V ${toY}`, active,
      style: { stroke: active ? "var(--talent-accent)" : "rgba(148,163,184,.32)", strokeWidth: active ? 1.5 : 1, opacity: 1 } }];
  }));
  return <div className="relative grid grid-cols-4 [grid-template-rows:repeat(var(--compact-rows),var(--row-px))] lg:[grid-template-rows:repeat(var(--rows),var(--row-px))]"
    style={{ "--rows": rowCount, "--compact-rows": usedRows.length, "--row-px": `${rowPx}px` } as CSSProperties}>
    <TalentConnectorLines paths={pathsFor(compactRow, usedRows.length)} className="lg:hidden" />
    <TalentConnectorLines paths={pathsFor((row) => row, rowCount)} className="hidden lg:block" />
    {talents.map((talent) => <TalentNode key={talent.id} anchorId={`talent-${talent.id}`} nameClassName={nodeName}
      node={talent} selected={selectedId === talent.id} level={levels[talent.id] ?? 0}
      unlocked={isOriginTalentUnlocked(talent, levels)} onSelect={() => onSelect(talent)} onIncrease={() => onIncrease(talent)}
      className="scroll-mt-24 [grid-row:var(--compact-row)] lg:[grid-row:var(--row)]"
      style={{ ...nodeStyle, gridColumn: `${columnFor(talent, talents).start} / span 2`, "--row": talent.row, "--compact-row": compactRow(talent.row) } as CSSProperties} />)}
  </div>;
}

export default function OriginTalentsClient({ catalog, unlockedRunes, showOperation }: {
  catalog: OriginTalentCatalog;
  unlockedRunes: Record<string, OriginTalentUnlockedRune[]>;
  showOperation: boolean;
}) {
  const [selectedId, setSelectedId] = useState(catalog.talents[0]?.id ?? "");
  const [activeBranch, setActiveBranch] = useState<Exclude<OriginTalentBranchId, 4>>(1);
  const [levels, setLevels] = useState<OriginTalentLevels>({});
  const [storageReady, setStorageReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selected = catalog.talents.find((talent) => talent.id === selectedId) ?? catalog.talents[0];
  const ultimate = catalog.talents.find((talent) => talent.branchId === 4);
  const totals = getOriginTalentTotals(catalog.talents, levels);

  useEffect(() => {
    const restoreSavedLevels = () => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) setLevels(restoreOriginTalentLevels(catalog.talents, JSON.parse(raw)));
      } catch {
        // 存储不可用或内容损坏时保留空方案。
      }
      setStorageReady(true);
    };
    restoreSavedLevels();
  }, [catalog.talents]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ version: 1, levels }));
    } catch {
      // 存储不可用时规划仍可在当前页面使用。
    }
  }, [levels, storageReady]);

  useEffect(() => {
    const focusLinkedTalent = () => {
      const talent = catalog.talents.find((item) => `#talent-${item.id}` === window.location.hash);
      if (!talent) return;
      setSelectedId(talent.id);
      if (talent.branchId !== 4) setActiveBranch(talent.branchId);
      window.requestAnimationFrame(() => revealLocatedTarget(`talent-${talent.id}`));
    };
    focusLinkedTalent();
    window.addEventListener("hashchange", focusLinkedTalent);
    return () => window.removeEventListener("hashchange", focusLinkedTalent);
  }, [catalog.talents]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialogOpen) dialog?.showModal();
    else if (dialog?.open) dialog.close();
    return () => { if (dialog?.open) dialog.close(); };
  }, [dialogOpen]);

  const selectTalent = (talent: OriginTalent, fromTree = false) => {
    setSelectedId(talent.id);
    if (talent.branchId !== 4) setActiveBranch(talent.branchId);
    window.history.replaceState(window.history.state, "", `#talent-${talent.id}`);
    if (fromTree && !window.matchMedia(desktopQuery).matches) setDialogOpen(true);
    else if (!fromTree) window.requestAnimationFrame(() => document.getElementById(`talent-${talent.id}`)
      ?.scrollIntoView({ block: "nearest" }));
  };
  const changeLevel = (talent: OriginTalent, level: number) =>
    setLevels((current) => setOriginTalentLevel(catalog.talents, current, talent.id, level));
  const increase = (talent: OriginTalent) => changeLevel(talent, (levels[talent.id] ?? 0) + 1);
  const details = (onClose?: () => void) => selected && <OriginTalentDetails key={selected.id} talent={selected} catalog={catalog}
    levels={levels} unlockedRunes={unlockedRunes[selected.id] ?? []} showOperation={showOperation} onClose={onClose}
    onChangeLevel={(level) => changeLevel(selected, level)} onReset={() => setLevels({})}
    onSelect={(talent) => selectTalent(talent)} />;

  return <section id="talents" aria-label="原点天赋图鉴" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="text-sm leading-6 text-zinc-400">
        <span className="lg:hidden">点击节点查看详情并加点规划</span>
        <span className="hidden lg:inline">点击节点查看详情，双击节点或在详情中加点规划</span>
      </p>
      <div aria-live="polite" className="flex flex-wrap gap-1.5">
        <span className={`${chip} border-white/10 bg-white/5 tabular-nums text-zinc-200`}>已点 {totals.level}/{totals.maxLevel} 级</span>
        <span className={`${chip} border-white/10 bg-white/5 tabular-nums text-zinc-200`}>材料 {totals.cost}/{totals.maxCost}</span>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2 lg:hidden">
      {catalog.branches.map((branch) => {
        const active = activeBranch === branch.id;
        return <button key={branch.id} type="button" aria-pressed={active} style={branchTheme(branch.id)}
          onClick={() => {
            setActiveBranch(branch.id);
            const first = catalog.talents.find((talent) => talent.branchId === branch.id);
            if (first) setSelectedId(first.id);
          }}
          className={`min-h-11 touch-manipulation rounded border px-2 text-sm font-semibold transition-colors outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 ${active
            ? "border-[color:var(--talent-accent)] bg-[color:var(--talent-accent-soft)] text-[color:var(--talent-accent)]"
            : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700/70 hover:text-white"}`}>
          {branch.name}
        </button>;
      })}
    </div>
    <div style={{ "--talent-frame": "#ffffff1f" } as CSSProperties}>
      <TalentWorkspace details={<div className="hidden lg:sticky lg:top-[4.5rem] lg:flex lg:max-h-[calc(100dvh-9.5rem)] lg:flex-col">{details()}</div>}>
        <div className="grid gap-3 lg:grid-cols-3">
          {catalog.branches.map((branch) => {
            const talents = catalog.talents.filter((talent) => talent.branchId === branch.id);
            const branchTotals = getOriginTalentTotals(talents, levels);
            return <div key={branch.id} aria-label={`${branch.name}天赋树`} style={branchTheme(branch.id)}
              className={`min-w-0 rounded-lg border border-white/10 border-t-[color:var(--talent-accent)] bg-[linear-gradient(160deg,var(--talent-accent-soft),transparent_45%)] px-1 pb-3 ${activeBranch === branch.id ? "block" : "hidden lg:block"}`}>
              <div className="flex items-baseline justify-between gap-2 px-2 pb-1 pt-2">
                <h2 className="text-sm font-semibold text-[color:var(--talent-accent)]">{branch.name}</h2>
                <span className="text-xs tabular-nums text-zinc-400">{branchTotals.level}/{branchTotals.maxLevel} 级 · 材料 {branchTotals.cost}</span>
              </div>
              <BranchTree talents={talents} levels={levels} selectedId={selected?.id ?? ""}
                onSelect={(talent) => selectTalent(talent, true)} onIncrease={increase} />
            </div>;
          })}
        </div>
        {ultimate && <div style={branchTheme(4)}
          className="mt-3 flex items-center gap-4 rounded-lg border border-white/10 border-t-[color:var(--talent-accent)] bg-[linear-gradient(160deg,var(--talent-accent-soft),transparent_45%)] px-4 py-2.5 sm:px-6">
          <TalentNode anchorId={`talent-${ultimate.id}`} className="scroll-mt-24" nameClassName="hidden!" node={ultimate} selected={selected?.id === ultimate.id}
            level={levels[ultimate.id] ?? 0} unlocked={isOriginTalentUnlocked(ultimate, levels)} style={{ ...nodeStyle, margin: 0 }}
            onSelect={() => selectTalent(ultimate, true)} onIncrease={() => increase(ultimate)} />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white"><span className="text-[color:var(--talent-accent)]">终极天赋</span> · {ultimate.name}</h2>
            <p className="mt-0.5 text-xs leading-5 text-zinc-400">
              其他天赋合计 {ultimate.requiredTotalLevels} 级后解锁（当前 {totals.level - (levels[ultimate.id] ?? 0)}）
            </p>
          </div>
        </div>}
      </TalentWorkspace>
    </div>
    <dialog ref={dialogRef} onClose={() => { setDialogOpen(false); document.getElementById(`talent-${selected?.id}`)?.focus(); }}
      aria-label="天赋详情" className="m-auto max-h-[85dvh] w-[min(92vw,420px)] max-w-none overflow-y-auto rounded-lg border border-zinc-600 bg-zinc-950 p-0 text-white shadow-2xl backdrop:bg-black/70">
      {dialogOpen && details(() => setDialogOpen(false))}
    </dialog>
  </section>;
}
