"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Minus, Plus, RotateCcw } from "lucide-react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { getAssetPath } from "@/lib/path";
import styles from "./talent-editor.module.css";

export function TalentHeader({ season, links, activeId, name, icon, points, limit, weapons, onInspect, children, activeSkillId }: {
  season: string; links: readonly { id: string; name: string }[]; activeId: string;
  name: string; icon: string; points?: number; limit?: number; weapons: ReactNode;
  onInspect: () => void; children?: ReactNode; activeSkillId?: string;
}) {
  return <header className={`${styles.theme} ${styles.header}`}>
    <div className={styles.navigation}>
      <Link href={`/season-talents#${season}`} aria-label="返回赛季天赋总览" title="返回赛季天赋总览"><ArrowLeft size={20} /></Link>
      <nav aria-label={`${season.toUpperCase()} 天赋树`}>{links.map(link => <Link key={link.id} href={`/guides/season-talents/${season}/${link.id}`} aria-current={link.id === activeId ? "page" : undefined}>{link.name}</Link>)}</nav>
    </div>
    <button type="button" id={activeSkillId ? `season-talent-node-${activeSkillId}` : undefined} className={styles.summary} onClick={onInspect} aria-label={`${name}主动技能`}>
      <Image src={getAssetPath(icon)} alt="" width={64} height={64} priority />
      <span><span className={styles.title}><h1>{name}</h1>{points !== undefined && limit !== undefined && <span aria-live="polite">{points}/{limit}</span>}</span><span className={styles.weapons}>{weapons}</span></span>
    </button>
    {children && <div className={styles.slots}>{children}</div>}
  </header>;
}

export function TalentPassiveSlot({ label = "被动天赋", name = "选择被动天赋", icon, onClick, buttonRef, tone = "default", ariaLabel, expanded, controls }: {
  label?: string; name?: string; icon?: string; onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>; tone?: "default" | "light" | "dark"; ariaLabel?: string; expanded?: boolean; controls?: string;
}) {
  return <button ref={buttonRef} type="button" className={`${styles.theme} ${styles.passive}`} data-tone={tone} aria-label={ariaLabel ?? `选择${label}`} aria-expanded={expanded} aria-controls={controls} onClick={onClick}>
    <span className={styles.passiveIcon}>{icon ? <Image src={getAssetPath(icon)} alt="" fill sizes="40px" /> : <Plus size={24} />}</span>
    <span className={styles.passiveText}><small>{label}</small><strong>{name}</strong></span><ChevronRight size={16} />
  </button>;
}

export interface TalentNodeView { id: string; name: string; icon: string; maxLevel: number; isRoot?: boolean }

export function TalentNode({ node, selected, level, unlocked, mutuallyExcluded = false, onSelect, onIncrease, style, className = "", iconContent, preview = false, anchorId, nameClassName = "" }: {
  node: TalentNodeView; selected: boolean; level: number; unlocked: boolean; mutuallyExcluded?: boolean;
  onSelect: () => void; onIncrease?: () => void; style?: CSSProperties; className?: string; iconContent?: ReactNode; preview?: boolean; anchorId?: string; nameClassName?: string;
}) {
  const rapidUntil = useRef(0);
  return <button type="button" id={anchorId ?? `season-talent-node-${node.id}`} className={`${styles.theme} ${styles.node} ${className}`} style={style}
    data-selected={selected} data-active={!!node.isRoot || level > 0} data-maxed={!!node.isRoot || level >= node.maxLevel} data-unlocked={unlocked} data-excluded={mutuallyExcluded}
    aria-pressed={selected} aria-label={preview ? `${node.name}，效果预览，最高 ${node.maxLevel} 级` : `${node.name}，${node.isRoot ? "根技能" : `${level}/${node.maxLevel} 级`}${mutuallyExcluded ? "，与已选天赋互斥" : unlocked ? "" : "，前置未满足"}`}
    onClick={() => onIncrease && Date.now() <= rapidUntil.current ? onIncrease() : onSelect()}
    onDoubleClick={() => {
      if (node.isRoot || !onIncrease) return onSelect();
      if (Date.now() <= rapidUntil.current) return;
      rapidUntil.current = Date.now() + 1000; onIncrease();
    }}>
    <span className={styles.nodeIcon}>{iconContent ?? <Image src={getAssetPath(node.icon)} alt="" fill sizes="80px" />}</span>
    {!node.isRoot && <span className={styles.pips} aria-hidden="true">{Array.from({ length: node.maxLevel }, (_, i) => <span key={i} data-filled={i < level} />)}</span>}
    <span className={`${styles.nodeName} ${nameClassName}`}>{node.name}</span>
  </button>;
}

export function TalentDetails({ season, eyebrow, name, icon, level, maxLevel, children, actions, onReset, resetLabel = "重置方案", imageContent, hideImage = false, headingActions, panelRef, id }: {
  season: string; eyebrow?: string; name: string; icon: string; level?: number; maxLevel?: number;
  children: ReactNode; actions?: ReactNode; onReset: () => void; resetLabel?: string;
  imageContent?: ReactNode; hideImage?: boolean; headingActions?: ReactNode; panelRef?: Ref<HTMLElement>; id?: string;
}) {
  return <aside ref={panelRef} id={id} className={`${styles.theme} ${styles.details}`} aria-label="天赋详情" aria-live="polite">
    <div className={styles.detailHeading}><div><small>{eyebrow ?? `${season.toUpperCase()} 赛季天赋详情`}</small><h2>{name}</h2></div>{headingActions}{maxLevel !== undefined && <output aria-label="当前等级">{level}/{maxLevel}</output>}</div>
    {!hideImage && <div className={styles.detailImage}>{imageContent ?? <Image src={getAssetPath(icon)} alt="" fill sizes="(min-width: 1024px) 320px, 100vw" />}</div>}
    <div className={styles.detailBody}>{children}</div>
    <footer>{actions}<button type="button" className={styles.reset} onClick={onReset}><RotateCcw size={16} />{resetLabel}</button></footer>
  </aside>;
}

export function useTalentPreviewLevel(nodeId: string, allocatedLevel: number) {
  const [preview, setPreview] = useState({ nodeId, allocatedLevel, level: Math.max(1, allocatedLevel) });
  if (preview.nodeId !== nodeId || preview.allocatedLevel !== allocatedLevel) {
    setPreview({ nodeId, allocatedLevel, level: Math.max(1, allocatedLevel) });
  }
  return [preview.level, (next: number) => setPreview({ nodeId, allocatedLevel, level: next })] as const;
}

export function TalentLevelPreview({ level, maxLevel, onChange }: {
  level: number; maxLevel: number; onChange: (level: number) => void;
}) {
  return <div className={styles.levelPreview} role="group" aria-label="等级预览">
    {Array.from({ length: maxLevel }, (_, i) => <button type="button" key={i} aria-label={`预览 ${i + 1} 级`}
      aria-pressed={level === i + 1} onClick={() => onChange(i + 1)}>{i + 1} 级</button>)}
  </div>;
}

export function TalentLevelActions({ name, level, maxLevel, canDecrease, canIncrease, onChange }: {
  name: string; level: number; maxLevel: number; canDecrease: boolean; canIncrease: boolean; onChange: (level: number) => void;
}) {
  return <div className={styles.levelActions}>
    <button type="button" aria-label={`降低${name}等级`} disabled={!canDecrease} onClick={() => onChange(level - 1)}><Minus size={16} /></button>
    <button type="button" disabled={!canIncrease} onClick={() => onChange(maxLevel)}>加满</button>
    <button type="button" aria-label={`提升${name}等级`} disabled={!canIncrease} onClick={() => onChange(level + 1)}><Plus size={16} /></button>
  </div>;
}

export function TalentWorkspace({ details, children }: { details: ReactNode; children: ReactNode }) {
  return <div className={styles.workspace}><div className={styles.detailColumn}>{details}</div><section className={`${styles.theme} ${styles.treePanel}`}>{children}</section></div>;
}

export function TalentTreeSections({ exclusiveWidth = "42.5%", generalWidth = "56.8%" }: { exclusiveWidth?: string; generalWidth?: string }) {
  return <div className={`${styles.theme} ${styles.sections}`} aria-hidden="true">
    <div style={{ width: exclusiveWidth }}><span>专属天赋</span></div>
    <div style={{ width: generalWidth }}><span>通用天赋</span></div>
  </div>;
}

const CONNECTOR_RADIUS = 4;

// 路径以 0–100 百分比坐标给出（仅 M/L/H/V），按容器像素尺寸换算后给折点加圆角，避免非等比拉伸把圆弧压成椭圆
function roundConnectorPath(d: string, width: number, height: number) {
  const tokens = d.match(/[MLHV]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  const subpaths: { x: number; y: number }[][] = [];
  let x = 0, y = 0, i = 0;
  while (i < tokens.length) {
    const command = tokens[i++].toUpperCase();
    if (command === "M" || command === "L") { x = Number(tokens[i++]); y = Number(tokens[i++]); }
    else if (command === "H") x = Number(tokens[i++]);
    else if (command === "V") y = Number(tokens[i++]);
    else continue;
    const point = { x: (x / 100) * width, y: (y / 100) * height };
    if (command === "M") { subpaths.push([point]); continue; }
    const current = subpaths.at(-1);
    const last = current?.at(-1);
    if (!current || !last || (Math.abs(last.x - point.x) < .01 && Math.abs(last.y - point.y) < .01)) continue;
    const previous = current.at(-2);
    if (previous && Math.abs((last.x - previous.x) * (point.y - last.y) - (last.y - previous.y) * (point.x - last.x)) < .01) current.pop();
    current.push(point);
  }
  const format = (value: number) => Number(value.toFixed(2));
  return subpaths.filter(points => points.length > 1).map(points => {
    let path = `M ${format(points[0].x)} ${format(points[0].y)}`;
    for (let index = 1; index < points.length - 1; index++) {
      const [before, corner, after] = [points[index - 1], points[index], points[index + 1]];
      const inLength = Math.hypot(corner.x - before.x, corner.y - before.y);
      const outLength = Math.hypot(after.x - corner.x, after.y - corner.y);
      const radius = Math.min(CONNECTOR_RADIUS, inLength / 2, outLength / 2);
      const start = { x: corner.x - ((corner.x - before.x) / inLength) * radius, y: corner.y - ((corner.y - before.y) / inLength) * radius };
      const end = { x: corner.x + ((after.x - corner.x) / outLength) * radius, y: corner.y + ((after.y - corner.y) / outLength) * radius };
      path += ` L ${format(start.x)} ${format(start.y)} Q ${format(corner.x)} ${format(corner.y)} ${format(end.x)} ${format(end.y)}`;
    }
    const end = points[points.length - 1];
    return `${path} L ${format(end.x)} ${format(end.y)}`;
  }).join(" ");
}

export function TalentConnectorLines({ paths, className = "" }: { paths: readonly { id: string; d: string; active: boolean; style?: CSSProperties }[]; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize(width > 0 && height > 0 ? { width: Math.round(width), height: Math.round(height) } : null);
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const resolve = (d: string) => size ? roundConnectorPath(d, size.width, size.height) : d;
  const inactive = paths.filter(path => !path.active);
  const active = paths.filter(path => path.active);
  return <svg ref={svgRef} className={`${styles.theme} ${styles.connectors} ${className}`} aria-hidden="true"
    viewBox={size ? `0 0 ${size.width} ${size.height}` : "0 0 100 100"} preserveAspectRatio="none">
    <g>{inactive.map(path => <path key={path.id} d={resolve(path.d)} style={path.style} vectorEffect="non-scaling-stroke" />)}</g>
    <g className={styles.connectorGlow}>{active.map(path => <path key={path.id} d={resolve(path.d)} vectorEffect="non-scaling-stroke" />)}</g>
    <g className={styles.connectorActive}>{active.map(path => <path key={path.id} d={resolve(path.d)} style={path.style} vectorEffect="non-scaling-stroke" />)}</g>
  </svg>;
}
