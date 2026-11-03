"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { HoverPreviewPanel } from "@/components/HoverPreviewPanel";
import { revealLocatedTarget } from "@/lib/locate-target";
import { getAssetPath } from "@/lib/path";
import type {
  SurvivalBuffNode, SurvivalCodex, SurvivalPassive, SurvivalSkill, SurvivalSpecial, SurvivalSpecialKind, SurvivalTag,
} from "@/lib/survival-codex";

type Kind = "skill" | "passive" | "special";
interface Entry { kind: Kind; id: number }
type Select = (entry: Entry) => void;

const LEVELS = ["I", "II", "III", "IV", "V"];
const SPECIAL_KINDS: Record<SurvivalSpecialKind, string> = { tempBoost: "临时进化", trigger: "触发增益", allMaxReward: "满级奖励" };
const HOVER = "(hover: hover) and (pointer: fine) and (min-width: 1024px)";
const cardBase = "flex h-full w-full min-w-0 touch-manipulation rounded-lg border border-zinc-700 bg-zinc-800/50 text-left transition-colors outline-none hover:border-zinc-500 hover:bg-zinc-700/50 focus-visible:[&_.card-name]:underline focus-visible:[&_.card-name]:decoration-2 focus-visible:[&_.card-name]:underline-offset-4";

function parseHash(hash: string): Entry | null {
  const match = /^#(skill|passive|special)-(\d+)$/.exec(hash);
  return match ? { kind: match[1] as Kind, id: Number(match[2]) } : null;
}

function Icon({ src, size }: { src: string; size: number }) {
  return <Image src={getAssetPath(src)} alt="" width={size} height={size} className="shrink-0 object-contain"
    style={{ width: size, height: size }} />;
}

function Tags({ tags }: { tags: SurvivalTag[] }) {
  if (!tags.length) return null;
  return <span className="flex flex-wrap gap-1">
    {tags.map((tag) => <span key={tag.text} className="rounded border px-1.5 py-px text-xs leading-4"
      style={{ color: tag.color, borderColor: `${tag.color}59`, backgroundColor: `${tag.color}14` }}>
      {tag.text}
    </span>)}
  </span>;
}

function Text({ children, muted = false }: { children: string; muted?: boolean }) {
  return <p className={`whitespace-pre-line break-words ${muted ? "text-xs leading-5 text-zinc-400" : "text-sm leading-6 text-zinc-100"}`}>
    {children}
  </p>;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <div className="border-t border-white/10 px-4 py-3">
    <div className="mb-2 text-xs font-medium text-zinc-400">{title}</div>
    {children}
  </div>;
}

function LevelList({ levels, showCurrent }: { levels: SurvivalBuffNode[]; showCurrent: boolean }) {
  return <ol className="divide-y divide-white/[0.06]">
    {levels.map((level, index) => <li key={level.id} className={`flex gap-3 first:pt-0 last:pb-0 ${showCurrent ? "py-2" : "py-1"}`}>
      <span className="w-6 shrink-0 font-mono text-xs font-semibold leading-6 text-zinc-500">{LEVELS[index]}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <Text>{level.description}</Text>
        {showCurrent && index > 0 && level.currentLevelDescription && level.currentLevelDescription !== level.description &&
          <Text muted>{level.currentLevelDescription}</Text>}
      </div>
    </li>)}
  </ol>;
}

/** 悬停预览不可交互，只显示静态行；弹窗里才可点击跳转。 */
function RefItem({ icon, name, note, onClick }: { icon: string; name: string; note?: string; onClick?: () => void }) {
  const body = <>
    <Icon src={icon} size={32} />
    <span className="min-w-0 flex-1">
      <span className="ref-name block break-words text-sm font-medium text-white">{name}</span>
      {note && <span className="block break-words text-xs leading-5 text-zinc-400">{note}</span>}
    </span>
  </>;
  const shape = "flex w-full items-center gap-3 rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-left";
  if (!onClick) return <div className={shape}>{body}</div>;
  return <button type="button" onClick={onClick}
    className={`${shape} min-h-11 touch-manipulation outline-none transition-colors hover:border-white/25 hover:bg-white/[0.06] focus-visible:[&_.ref-name]:underline focus-visible:[&_.ref-name]:underline-offset-4`}>
    {body}
  </button>;
}

function DetailHeader({ icon, name, meta, tags, onClose }: {
  icon: string; name: string; meta: string; tags: SurvivalTag[]; onClose?: () => void;
}) {
  return <div className={`flex items-center gap-3 border-b border-white/[0.08] bg-white/[0.025] py-3 pl-4 ${onClose ? "pr-1" : "pr-4"}`}>
    <Icon src={icon} size={48} />
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="break-words text-base font-semibold leading-6 text-white">{name}</h2>
        <span className="text-xs text-zinc-400">{meta}</span>
      </div>
      <Tags tags={tags} />
    </div>
    {onClose && <button type="button" onClick={onClose} aria-label="关闭详情" title="关闭"
      className="flex h-11 w-11 shrink-0 items-center justify-center self-start text-zinc-400 outline-none hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white">
      <X aria-hidden="true" className="h-5 w-5" />
    </button>}
  </div>;
}

interface Lookup {
  codex: SurvivalCodex;
  skills: Map<number, SurvivalSkill>;
  passives: Map<number, SurvivalPassive>;
  specials: Map<number, SurvivalSpecial>;
}

interface DetailProps {
  lookup: Lookup;
  /** 省略时为悬停预览：精简内容且不可交互。 */
  select?: Select;
  onClose?: () => void;
}

function SkillDetails({ skill, lookup, select, onClose }: DetailProps & { skill: SurvivalSkill }) {
  const passive = lookup.passives.get(skill.passiveId);
  const boosts = lookup.codex.specials.filter((special) => special.targetSkillIds.includes(skill.id));
  return <>
    <DetailHeader icon={skill.levels[0].icon} name={skill.name} meta="主动技能" tags={skill.tags} onClose={onClose} />
    <div className="lg:grid lg:grid-cols-2">
      <Block title="升级路线"><LevelList levels={skill.levels} showCurrent={Boolean(select)} /></Block>
      <div className="lg:border-l lg:border-white/10">
        <Block title="终极进化">
          <div className="flex gap-3">
            <Icon src={skill.ultimate.icon} size={40} />
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="text-sm font-semibold leading-6 text-white">{skill.ultimate.name}</h3>
              <Text>{skill.ultimate.description}</Text>
              {skill.ultimate.currentLevelDescription && <Text muted>{skill.ultimate.currentLevelDescription}</Text>}
            </div>
          </div>
          {passive && <div className="mt-3 space-y-2">
            <p className="text-xs leading-5 text-zinc-400">进化条件：{skill.name}升到 V 级，并持有配套被动</p>
            <RefItem icon={passive.levels[0].icon} name={passive.name} note={select && passive.levels[0].description}
              onClick={select && (() => select({ kind: "passive", id: passive.id }))} />
          </div>}
        </Block>
        {boosts.length > 0 && <Block title="临时进化">
          <div className="space-y-2">
            {boosts.map((special) => <RefItem key={special.id} icon={special.node.icon} name={special.name}
              note={select && special.node.description} onClick={select && (() => select({ kind: "special", id: special.id }))} />)}
          </div>
        </Block>}
      </div>
    </div>
  </>;
}

function PassiveDetails({ passive, lookup, select, onClose }: DetailProps & { passive: SurvivalPassive }) {
  const skill = passive.combinesWithSkillId === null ? undefined : lookup.skills.get(passive.combinesWithSkillId);
  const attributes = passive.levels[0].attributeDisplays.map((attribute, index) => ({
    label: attribute.label,
    values: passive.levels.map((level) => level.attributeDisplays[index]?.value),
  }));
  return <>
    <DetailHeader icon={passive.levels[0].icon} name={passive.name} meta={skill ? "配套被动" : "通用被动"}
      tags={passive.tags} onClose={onClose} />
    {attributes.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-3 text-xs text-zinc-400">
      {attributes.map((attribute) => <span key={attribute.label}>
        {attribute.label}<span className="ml-1.5 font-mono text-zinc-200">{attribute.values.join(" / ")}</span>
      </span>)}
    </div>}
    <Block title="升级路线"><LevelList levels={passive.levels} showCurrent={false} /></Block>
    {skill && <Block title="终极进化">
      <RefItem icon={skill.ultimate.icon} name={skill.ultimate.name} note={`与${skill.name} V 级组合进化`}
        onClick={select && (() => select({ kind: "skill", id: skill.id }))} />
    </Block>}
  </>;
}

function SpecialDetails({ special, lookup, select, onClose }: DetailProps & { special: SurvivalSpecial }) {
  const targets = special.targetSkillIds.flatMap((id) => lookup.skills.get(id) ?? []);
  const current = special.node.currentLevelDescription;
  return <>
    <DetailHeader icon={special.node.icon} name={special.name} meta={SPECIAL_KINDS[special.kind]}
      tags={special.tags} onClose={onClose} />
    <div className="space-y-1 px-4 py-3">
      <Text>{special.node.description}</Text>
      {current && current !== special.node.description && <Text muted>{current}</Text>}
    </div>
    {targets.length > 0 && <Block title="临时进化技能">
      <p className="mb-2 text-xs leading-5 text-zinc-400">持有其中任一技能时才会出现</p>
      <div className="space-y-2">
        {targets.map((skill) => <RefItem key={skill.id} icon={skill.levels[0].icon} name={skill.name}
          onClick={select && (() => select({ kind: "skill", id: skill.id }))} />)}
      </div>
    </Block>}
    {special.kind === "allMaxReward" && <Block title="出现条件">
      <p className="text-sm leading-6 text-zinc-200">携带的技能与被动全部满级后出现</p>
    </Block>}
  </>;
}

function EntryDetails({ entry, ...props }: DetailProps & { entry: Entry }) {
  const { skills, passives, specials } = props.lookup;
  if (entry.kind === "skill") {
    const skill = skills.get(entry.id);
    return skill ? <SkillDetails skill={skill} {...props} /> : null;
  }
  if (entry.kind === "passive") {
    const passive = passives.get(entry.id);
    return passive ? <PassiveDetails passive={passive} {...props} /> : null;
  }
  const special = specials.get(entry.id);
  return special ? <SpecialDetails special={special} {...props} /> : null;
}

function EntryCard({ entry, lookup, onOpen, className, children }: {
  entry: Entry;
  lookup: Lookup;
  onOpen: (entry: Entry, trigger: HTMLButtonElement) => void;
  className: string;
  children: ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  return <div id={`${entry.kind}-${entry.id}`} className="min-w-0 scroll-mt-24">
    <button ref={buttonRef} type="button" aria-haspopup="dialog" aria-describedby={isOpen ? tooltipId : undefined}
      onMouseEnter={() => { if (window.matchMedia(HOVER).matches) setIsOpen(true); }}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={(event) => { if (event.currentTarget.matches(":focus-visible") && window.matchMedia(HOVER).matches) setIsOpen(true); }}
      onBlur={() => setIsOpen(false)}
      onKeyDown={(event) => { if (event.key === "Escape") setIsOpen(false); }}
      onClick={(event) => { setIsOpen(false); onOpen(entry, event.currentTarget); }}
      className={`${cardBase} ${className}`}>
      {children}
    </button>
    <HoverPreviewPanel open={isOpen} anchorRef={buttonRef} id={tooltipId}
      widthClassName={entry.kind === "skill" ? "w-[min(46rem,calc(100vw-2rem))]" : "w-[min(26rem,calc(100vw-2rem))]"}>
      <EntryDetails entry={entry} lookup={lookup} />
    </HoverPreviewPanel>
  </div>;
}

function Section({ id, title, count, className, children }: {
  id: string; title: string; count: number; className: string; children: ReactNode;
}) {
  return <section aria-labelledby={id}>
    <h2 id={id} className="mb-3 flex items-baseline gap-2 text-lg font-semibold text-white">
      {title}<span className="text-sm font-normal text-zinc-500">{count}</span>
    </h2>
    <div className={`grid gap-3 ${className}`}>{children}</div>
  </section>;
}

function TileContent({ icon, name, note }: { icon: string; name: string; note: string }) {
  return <>
    <Icon src={icon} size={40} />
    <span className="min-w-0 flex-1">
      <span className="card-name block break-words text-sm font-medium leading-5 text-white">{name}</span>
      <span className="block break-words text-xs leading-4 text-zinc-400">{note}</span>
    </span>
  </>;
}

export default function SurvivalCodexClient({ codex }: { codex: SurvivalCodex }) {
  const [selected, setSelected] = useState<Entry | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const lookup = useMemo<Lookup>(() => ({
    codex,
    skills: new Map(codex.skills.map((skill) => [skill.id, skill])),
    passives: new Map(codex.passives.map((passive) => [passive.id, passive])),
    specials: new Map(codex.specials.map((special) => [special.id, special])),
  }), [codex]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selected) { if (!dialog?.open) dialog?.showModal(); }
    else if (dialog?.open) dialog.close();
  }, [selected]);

  useEffect(() => {
    const focusLinked = () => {
      const linked = parseHash(window.location.hash);
      if (!linked || !{ skill: lookup.skills, passive: lookup.passives, special: lookup.specials }[linked.kind].has(linked.id)) return;
      window.requestAnimationFrame(() => revealLocatedTarget(`${linked.kind}-${linked.id}`));
    };
    focusLinked();
    window.addEventListener("hashchange", focusLinked);
    return () => window.removeEventListener("hashchange", focusLinked);
  }, [lookup]);

  const select: Select = (entry) => {
    setSelected(entry);
    window.history.replaceState(null, "", `#${entry.kind}-${entry.id}`);
    dialogRef.current?.scrollTo({ top: 0 });
  };
  const open = (entry: Entry, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    select(entry);
  };

  return <>
    <div className="space-y-8">
      <Section id="survival-skills" title="主动技能" count={codex.skills.length} className="grid-cols-2 lg:grid-cols-4">
        {codex.skills.map((skill) => <EntryCard key={skill.id} entry={{ kind: "skill", id: skill.id }} lookup={lookup}
          onOpen={open} className="flex-col items-start gap-2 p-3 sm:flex-row sm:gap-3">
          <Icon src={skill.levels[0].icon} size={48} />
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="card-name block break-words text-sm font-semibold leading-5 text-white">{skill.name}</span>
            <Tags tags={skill.tags} />
            <span className="block break-words text-xs leading-4 text-zinc-400">终极 · {skill.ultimate.name}</span>
          </span>
        </EntryCard>)}
      </Section>
      <Section id="survival-passives" title="被动增益" count={codex.passives.length} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {codex.passives.map((passive) => {
          const skill = passive.combinesWithSkillId === null ? undefined : lookup.skills.get(passive.combinesWithSkillId);
          return <EntryCard key={passive.id} entry={{ kind: "passive", id: passive.id }} lookup={lookup} onOpen={open}
            className="items-center gap-2.5 p-2.5">
            <TileContent icon={passive.levels[0].icon} name={passive.name} note={skill ? `配套${skill.name}` : "通用被动"} />
          </EntryCard>;
        })}
      </Section>
      <Section id="survival-specials" title="特殊增益" count={codex.specials.length} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {codex.specials.map((special) => <EntryCard key={special.id} entry={{ kind: "special", id: special.id }} lookup={lookup}
          onOpen={open} className="items-center gap-2.5 p-2.5">
          <TileContent icon={special.node.icon} name={special.name} note={SPECIAL_KINDS[special.kind]} />
        </EntryCard>)}
      </Section>
    </div>
    <dialog ref={dialogRef} onClose={() => { setSelected(null); triggerRef.current?.focus(); }} aria-label="详情"
      className={`m-auto max-h-[85dvh] w-[min(92vw,440px)] max-w-none overflow-y-auto ${selected?.kind === "skill" ? "lg:w-[min(92vw,46rem)]" : ""} border border-zinc-600 bg-[#15171b] p-0 text-white shadow-2xl backdrop:bg-black/70`}>
      {selected && <EntryDetails entry={selected} lookup={lookup} select={select} onClose={() => setSelected(null)} />}
    </dialog>
  </>;
}
