"use client";

import Image from "next/image";
import { Copy, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import catalog from "@/data/season-talents/s2/catalog.json";
import { MultiplierSourceBadges } from "@/components/MultiplierBadges";
import { getAssetPath } from "@/lib/path";
import { emptyS2Build, restoreS2Build, s2PrerequisiteGroups, s2SpentPoints, s2UnlockReason, setS2Level, type S2TalentNode, type S2TalentTree } from "@/lib/s2-season-talent-builder";
import styles from "./s2.module.css";
import editor from "./s2-editor.module.css";
import { TalentPassiveSelector } from "@/components/season-talents/TalentPassiveSelector";
import { TalentHeader, TalentPassiveSlot, TalentNode, TalentDetails, TalentLevelActions, TalentLevelPreview, TalentWorkspace, TalentTreeSections, TalentConnectorLines } from "@/components/season-talents/TalentEditor";

function column(node: S2TalentNode) { return node.column >= 5 ? node.column - 4 : node.column + 3; }

function connectorPaths(tree: S2TalentTree, levels: Record<string, number>, section?: "special" | "common") {
  const groups = new Map<string, Map<string, [S2TalentNode, S2TalentNode]>>();
  for (const node of tree.nodes.filter(n => !n.isRoot)) {
    if (section && (node.column >= 5 ? "special" : "common") !== section) continue;
    for (const id of s2PrerequisiteGroups(node.prerequisite).flat()) {
      const source = tree.nodes.find(n => n.id === id && !n.isRoot);
      if (!source) continue;
      const key = `${node.column >= 5 ? "special" : "common"}-${source.phase}-${node.phase}`;
      const group = groups.get(key) ?? new Map<string, [S2TalentNode, S2TalentNode]>();
      group.set(`${source.id}-${node.id}`, [source, node]); groups.set(key, group);
    }
  }
  const x = (n: S2TalentNode) => section ? ((n.column >= 5 ? n.column - 4 : n.column) - .5) / 3 * 100 : (column(n) - .5) / 6 * 100;
  const y = (n: S2TalentNode) => (n.phase - 1.5) / 5 * 100;
  return [...groups].flatMap(([id, group]) => {
    const edges = [...group];
    const rail = (Math.max(...edges.map(([, [source]]) => y(source) + 8.25)) + Math.min(...edges.map(([, [, target]]) => y(target) - 5.25))) / 2;
    return edges.map(([edgeId, [source, target]]) => ({ id: `${id}-${edgeId}`, d: `M ${x(source)} ${y(source) + 8.25} V ${rail} H ${x(target)} V ${y(target) - 5.25}`,
      active: (levels[source.id] ?? 0) > 0 && (levels[target.id] ?? 0) > 0 }));
  });
}

function Description({ text }: { text: string }) {
  return <div className="space-y-2 text-[0.95rem] leading-7 text-slate-200">{text.split("\n").map((line, i) => <p key={i}>{line.split(/([+-]?\d+(?:\.\d+)?%?)/g).map((part, j) => j % 2 ? <strong className="text-[#ffd45e]" key={j}>{part}</strong> : part)}</p>)}</div>;
}

export function S2SeasonTalentBuilder({ tree }: { tree: S2TalentTree }) {
  const root = tree.nodes.find(n => n.isRoot)!;
  const [build, setBuild] = useState(emptyS2Build);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState(root.id);
  const [previewLevel, setPreviewLevel] = useState(1);
  const [mobileTab, setMobileTab] = useState<"special" | "common">("special");
  const [detailOpen, setDetailOpen] = useState(false);
  const [modal, setModal] = useState<"passives" | "reset" | null>(null);
  const [passivePreviewId, setPassivePreviewId] = useState(tree.passives[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const key = `nzm-wiki:s2-talents:${tree.id}:v1`;
  const node = tree.nodes.find(n => n.id === selected);
  const previewPassive = tree.passives.find(p => p.id === passivePreviewId) ?? tree.passives[0];
  const activePassive = tree.passives.find(p => p.id === build.passiveId);
  const points = s2SpentPoints(tree, build.levels);
  const current = node?.isRoot ? 1 : build.levels[selected] ?? 0;
  const reason = node ? s2UnlockReason(tree, node, build.levels) : null;
  const level = Math.min(previewLevel, node?.maxLevel ?? 1);

  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      let value: unknown = null;
      try { value = JSON.parse(params.get("build") ?? localStorage.getItem(key) ?? "null"); } catch { /* Invalid saves cannot modify other seasons. */ }
      setBuild(restoreS2Build(tree, value));
      setReady(true);
      const id = params.get("node") ?? params.get("passive");
      const target = tree.nodes.find(n => n.id === id);
      if (id && !target && tree.passives.some(p => p.id === id)) {
        setPassivePreviewId(id);
        setDetailOpen(false);
        setModal("passives");
      } else if (id && target) {
        setSelected(id);
        setMobileTab(target && target.column < 5 ? "common" : "special");
        setPreviewLevel(1);
        setDetailOpen(true);
      }
    };
    const frame = requestAnimationFrame(sync);
    window.addEventListener("popstate", sync);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("popstate", sync); };
  }, [key, tree]);

  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("build")) {
      url.searchParams.set("build", JSON.stringify(build));
      window.history.replaceState(window.history.state, "", url);
    }
    try { localStorage.setItem(key, JSON.stringify(build)); }
    catch { const frame = requestAnimationFrame(() => setNotice("浏览器存储不可用，配点仅在本次访问保留。")); return () => cancelAnimationFrame(frame); }
  }, [build, key, ready]);

  useEffect(() => {
    if (modal === "reset") dialog.current?.showModal(); else dialog.current?.close();
  }, [modal]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      if (detailOpen && media.matches) detailDialog.current?.showModal();
      else detailDialog.current?.close();
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [detailOpen]);

  const inspect = (id: string) => {
    setSelected(id); setPreviewLevel(Math.max(1, build.levels[id] ?? 0)); setDetailOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("node"); url.searchParams.delete("passive");
    url.searchParams.set(tree.passives.some(p => p.id === id) ? "passive" : "node", id);
    window.history.replaceState(window.history.state, "", url);
  };
  const change = (value: number) => {
    setBuild(previous => setS2Level(tree, previous, selected, value));
    setPreviewLevel(Math.max(1, value));
  };
  const previewPassiveOption = (id: string) => {
    setPassivePreviewId(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("node");
    url.searchParams.set("passive", id);
    window.history.replaceState(window.history.state, "", url);
  };
  const closePassives = () => {
    setModal(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("passive");
    window.history.replaceState(window.history.state, "", url);
  };
  const share = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("build", JSON.stringify(build));
    try { await navigator.clipboard.writeText(url.toString()); setNotice("配点链接已复制"); }
    catch { setNotice("无法访问剪贴板，未复制配点链接。"); }
  };
  const canIncrease = !!node && !node.isRoot && ready && !reason && current < node.maxLevel && setS2Level(tree, build, node.id, current + 1) !== build;
  const theme = { "--talent-accent": tree.id === "invisibility" ? "#79d5f2" : tree.id === "inferno-arm" ? "#ecc376" : "#d99cef",
    "--talent-accent-soft": tree.id === "invisibility" ? "#79d5f224" : tree.id === "inferno-arm" ? "#ecc37624" : "#d99cef24" } as CSSProperties;
  const details = <TalentDetails season="s2" name={node?.name ?? tree.name} icon={node?.icon ?? tree.icon}
    level={current} maxLevel={node && !node.isRoot ? node.maxLevel : undefined} onReset={() => setModal("reset")}
    actions={<>
      {node && !node.isRoot && <TalentLevelActions name={node.name} level={current} maxLevel={node.maxLevel} canDecrease={ready && current > 0} canIncrease={canIncrease} onChange={value => {
        let next = value;
        while (next > current + 1 && setS2Level(tree, build, node.id, next) === build) next--;
        change(next);
      }} />}
      <div className={editor.actions}><button type="button" className={editor.share} title="复制配点链接" aria-label="复制配点链接" disabled={!ready} onClick={share}><Copy size={18} /></button></div>
    </>}>
    {node && !node.isRoot && <TalentLevelPreview level={level} maxLevel={node.maxLevel} onChange={setPreviewLevel} />}
    <Description text={node?.descriptions[level - 1] ?? ""} />
    {node && <div data-multiplier-provider-target={`node-${node.id}`} className="mt-3">
      <MultiplierSourceBadges source={{ type: "season-talent", season: "s2", tree: tree.id, nodeId: node.id }} />
    </div>}
  </TalentDetails>;

  return <section className={editor.editor} style={theme} aria-label={`${tree.name}天赋树`}>
    <div className={editor.background}><Image src={getAssetPath(catalog.background)} alt="" fill priority sizes="100vw" /></div>
    <TalentHeader season="s2" links={catalog.trees} activeId={tree.id} activeSkillId={root.id} name={tree.name} icon={tree.icon} points={points} limit={tree.pointLimit}
      weapons={tree.applicableWeapons} onInspect={() => inspect(root.id)}>
      <TalentPassiveSlot icon={activePassive?.icon} name={activePassive?.name} expanded={modal === "passives"} controls="s2-passive-talent-selector" onClick={() => {
        previewPassiveOption(activePassive?.id ?? tree.passives[0]?.id ?? ""); setDetailOpen(false); setModal("passives");
      }} />
    </TalentHeader>
    <TalentWorkspace details={<div className={editor.desktopDetails}>{details}</div>}>
      <div className={editor.mobileTabs} role="group" aria-label="天赋类别">
        <button type="button" aria-pressed={mobileTab === "special"} onClick={() => setMobileTab("special")}>专属天赋</button>
        <button type="button" aria-pressed={mobileTab === "common"} onClick={() => setMobileTab("common")}>通用天赋</button>
      </div>
      <div className={editor.board} data-mobile-tab={mobileTab}>
        <TalentTreeSections exclusiveWidth="49.5%" generalWidth="49.5%" />
        <TalentConnectorLines className={editor.desktopConnections} paths={connectorPaths(tree, build.levels)} />
        <TalentConnectorLines className={editor.mobileConnections} paths={connectorPaths(tree, build.levels, mobileTab)} />
        {tree.nodes.filter(n => !n.isRoot).map(n => {
          const allocated = build.levels[n.id] ?? 0;
          const excluded = tree.nodes.some(peer => (build.levels[peer.id] ?? 0) > 0 && peer.id !== n.id && (n.mutualGroups.includes(peer.group) || peer.mutualGroups.includes(n.group)));
          return <TalentNode key={n.id} node={n} selected={selected === n.id} level={allocated} unlocked={!s2UnlockReason(tree, n, build.levels)} mutuallyExcluded={excluded}
            className={n.column >= 5 ? editor.specialNode : editor.commonNode}
            style={{ gridColumn: column(n), gridRow: n.phase - 1, "--mobile-column": n.column >= 5 ? n.column - 4 : n.column } as CSSProperties}
            onSelect={() => inspect(n.id)} onIncrease={() => {
              if (!ready) return;
              setBuild(b => setS2Level(tree, b, n.id, (b.levels[n.id] ?? 0) + 1));
              setPreviewLevel(Math.min(n.maxLevel, allocated + 1));
            }} />;
        })}
      </div>
    </TalentWorkspace>
    <p className={styles.notice} role="status">{notice}</p>
    <dialog ref={detailDialog} className={editor.detailsMobile} style={theme} onCancel={() => setDetailOpen(false)} onClose={() => setDetailOpen(false)}>
      <button type="button" className={editor.close} aria-label="关闭天赋详情" onClick={() => setDetailOpen(false)}><X size={21} /></button>{details}
    </dialog>
    {modal === "passives" && <TalentPassiveSelector season="s2" id="s2-passive-talent-selector" theme={theme}
      options={tree.passives} previewId={passivePreviewId} equippedId={build.passiveId} disabled={!ready}
      onPreview={previewPassiveOption} onClose={closePassives}
      onApply={id => { setBuild(b => ({ ...b, passiveId: id })); closePassives(); }}
      onUnequip={() => { setBuild(b => ({ ...b, passiveId: null })); closePassives(); }}>
      <Description text={previewPassive?.description ?? ""} />
      {previewPassive && <div id={`multiplier-provider-passive-${previewPassive.id}`} data-multiplier-provider-target={`passive-${previewPassive.id}`} className="mt-4">
        <MultiplierSourceBadges source={{ type: "season-talent", season: "s2", tree: tree.id, passiveId: previewPassive.id }} />
      </div>}
    </TalentPassiveSelector>}
    <dialog ref={dialog} className={styles.modal} onCancel={() => setModal(null)} onClose={() => setModal(null)}>
      <header><h2>重置配点</h2><button type="button" aria-label="关闭" onClick={() => setModal(null)}><X size={22} /></button></header>
      <div className={styles.resetBody}><p>清空「{tree.name}」的配点与被动选择？</p><button type="button" className={styles.equip} onClick={() => { setBuild(emptyS2Build()); setPreviewLevel(1); setModal(null); }}><RotateCcw size={18} />重置</button></div>
    </dialog>
  </section>;
}
