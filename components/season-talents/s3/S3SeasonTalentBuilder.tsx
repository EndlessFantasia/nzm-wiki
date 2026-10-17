"use client";

import Image from "next/image";
import { TalentHeader, TalentPassiveSlot, TalentNode, TalentDetails, TalentLevelActions, TalentLevelPreview, useTalentPreviewLevel, TalentTreeSections, TalentWorkspace, TalentConnectorLines } from "@/components/season-talents/TalentEditor";
import { TalentPassiveSelector } from "@/components/season-talents/TalentPassiveSelector";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import grapplingHookData from "@/data/season-talents/s3/grappling-hook.json";
import ironFistData from "@/data/season-talents/s3/iron-fist.json";
import passiveData from "@/data/season-talents/s3/passives.json";
import zeroData from "@/data/season-talents/s3/zero.json";
import { MultiplierSourceBadges } from "@/components/MultiplierBadges";
import type { MultiplierSource } from "@/lib/multiplier-data";
import { getAssetPath } from "@/lib/path";
import {
  getDefaultS3TalentLevels,
  getS3SpentTalentPoints,
  isS3TalentNodeUnlocked,
  restoreS3TalentBuild,
  setS3TalentNodeLevel,
  type SavedS3TalentBuild,
} from "@/lib/s3-season-talent-builder";

interface TalentNode {
  id: string;
  canonicalId?: string;
  name: string;
  phase: number;
  column: number;
  prerequisites: string[];
  maxLevel: number;
  powerful: boolean;
  icon: string;
  descriptions: string[];
}

interface TalentData {
  id: string;
  talentType: number;
  season: string;
  name: string;
  subtitle: string;
  applicableWeapons: string[];
  nodes: TalentNode[];
}

interface PassiveTalent {
  id: string;
  passiveSkillId: string;
  name: string;
  unlockLevel: number;
  tags: string[];
  icon: string;
  preview: string;
  description: string;
}

interface PassiveTalentData {
  season: string;
  passives: PassiveTalent[];
}

const PASSIVE_DATA = passiveData as PassiveTalentData;

export type S3TalentId = "iron-fist" | "zero" | "grappling-hook";

interface TalentTheme {
  accent: string;
  accentText: string;
  accentStrong: string;
  accentDark: string;
  accentSoft: string;
  accentMuted: string;
  glow: string;
  frame: string;
  divider: string;
  surfaceSoft: string;
  radial: string;
  grid: string;
}

const THEMES: Record<S3TalentId, TalentTheme> = {
  zero: {
    accent: "#67e8f9",
    accentText: "#cffafe",
    accentStrong: "#0891b2",
    accentDark: "#164e63",
    accentSoft: "rgba(34,211,238,0.14)",
    accentMuted: "rgba(103,232,249,0.38)",
    glow: "rgba(34,211,238,0.34)",
    frame: "rgba(103,232,249,0.34)",
    divider: "rgba(8,145,178,0.25)",
    surfaceSoft: "rgba(8,145,178,0.13)",
    radial: "rgba(34,211,238,0.18)",
    grid: "rgba(103,232,249,0.05)",
  },
  "iron-fist": {
    accent: "#fb7185",
    accentText: "#ffe4e6",
    accentStrong: "#e11d48",
    accentDark: "#881337",
    accentSoft: "rgba(244,63,94,0.14)",
    accentMuted: "rgba(251,113,133,0.4)",
    glow: "rgba(244,63,94,0.34)",
    frame: "rgba(251,113,133,0.34)",
    divider: "rgba(225,29,72,0.25)",
    surfaceSoft: "rgba(225,29,72,0.13)",
    radial: "rgba(244,63,94,0.18)",
    grid: "rgba(251,113,133,0.05)",
  },
  "grappling-hook": {
    accent: "#4ade80",
    accentText: "#dcfce7",
    accentStrong: "#16a34a",
    accentDark: "#14532d",
    accentSoft: "rgba(34,197,94,0.14)",
    accentMuted: "rgba(74,222,128,0.4)",
    glow: "rgba(34,197,94,0.34)",
    frame: "rgba(74,222,128,0.34)",
    divider: "rgba(22,163,74,0.25)",
    surfaceSoft: "rgba(22,163,74,0.13)",
    radial: "rgba(34,197,94,0.18)",
    grid: "rgba(74,222,128,0.05)",
  },
};

function mapGeneralNodes(talentType: number): TalentNode[] {
  return (zeroData as TalentData).nodes
    .filter((node) => node.column >= 5)
    .map((node) => ({
      ...node,
      id: `shared-${talentType}-${node.id}`,
      canonicalId: node.id,
      prerequisites: node.prerequisites.map((id) =>
        `shared-${talentType}-${id}`,
      ),
    }));
}

function completeTalentData(rawData: TalentData): TalentData {
  if (rawData.nodes.some((node) => node.column >= 5)) return rawData;

  return {
    ...rawData,
    nodes: [...rawData.nodes, ...mapGeneralNodes(rawData.talentType)],
  };
}

const TALENT_DATA: Record<S3TalentId, TalentData> = {
  zero: completeTalentData(zeroData as TalentData),
  "iron-fist": completeTalentData(ironFistData as TalentData),
  "grappling-hook": completeTalentData(grapplingHookData as TalentData),
};

function getThemeStyle(theme: TalentTheme): CSSProperties {
  return {
    "--talent-accent": theme.accent,
    "--talent-accent-text": theme.accentText,
    "--talent-accent-strong": theme.accentStrong,
    "--talent-accent-dark": theme.accentDark,
    "--talent-accent-soft": theme.accentSoft,
    "--talent-accent-muted": theme.accentMuted,
    "--talent-glow": theme.glow,
    "--talent-frame": theme.frame,
    "--talent-divider": theme.divider,
    "--talent-surface-soft": theme.surfaceSoft,
    "--talent-radial": theme.radial,
    "--talent-grid": theme.grid,
  } as CSSProperties;
}

const TREE_LINKS: Array<{ id: S3TalentId; name: string }> = [
  { id: "iron-fist", name: "铁拳狂徒" },
  { id: "zero", name: "零点" },
  { id: "grappling-hook", name: "劫掠钩锁" },
];

const POINT_LIMIT = 40;

function getDesktopColumn(column: number) {
  return column >= 5 ? column - 1 : column;
}

function renderRichText(value: string): ReactNode[] {
  const result: ReactNode[] = [];
  const pattern = /<(qiangdiao|T002)>(.*?)<\/>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) {
      result.push(value.slice(cursor, match.index));
    }

    result.push(
      <strong
        key={`${match.index}-${match[1]}`}
        className={
          match[1] === "T002"
            ? "text-[color:var(--talent-accent)]"
            : "text-[#ffd45e]"
        }
      >
        {match[2]}
      </strong>,
    );
    cursor = pattern.lastIndex;
  }

  if (cursor < value.length) {
    result.push(value.slice(cursor));
  }

  return result;
}

function TalentDescription({ value }: { value: string }) {
  return (
    <div className="space-y-2 text-[0.95rem] leading-7 text-slate-200">
      {value.split("\n").map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 12)}`}>
          {renderRichText(paragraph)}
        </p>
      ))}
    </div>
  );
}

function DetailCard({ node, talentId, rootNodeId, level, unlocked, spentPoints, onLevelChange, onReset }: {
  node: TalentNode; talentId: S3TalentId; rootNodeId: string; level: number; unlocked: boolean; spentPoints: number;
  onLevelChange: (level: number) => void; onReset: () => void;
}) {
  const isRoot = node.id === rootNodeId;
  const [previewLevel, setPreviewLevel] = useTalentPreviewLevel(node.id, level);
  const providerSource: MultiplierSource = { type: "season-talent", season: "s3",
    tree: node.column >= 5 ? "zero" : talentId, nodeId: node.canonicalId ?? node.id };
  return <TalentDetails season="s3" name={node.name} icon={node.icon} level={level} maxLevel={isRoot ? undefined : node.maxLevel} onReset={onReset}
    actions={!isRoot && <TalentLevelActions name={node.name} level={level} maxLevel={node.maxLevel}
      canDecrease={level > 0} canIncrease={unlocked && level < node.maxLevel && spentPoints < POINT_LIMIT} onChange={onLevelChange} />}>
    {!isRoot && <TalentLevelPreview level={previewLevel} maxLevel={node.maxLevel} onChange={setPreviewLevel} />}
    <TalentDescription value={node.descriptions[previewLevel - 1]} />
    <div data-multiplier-provider-target={`node-${node.id}`} className="mt-3"><MultiplierSourceBadges source={providerSource} /></div>
  </TalentDetails>;
}

function TalentNodeButton({ node, selected, level, unlocked, mutuallyExcluded, onSelect, onActivate, layout = "desktop" }: {
  node: TalentNode; selected: boolean; level: number; unlocked: boolean; mutuallyExcluded: boolean;
  onSelect: (node: TalentNode) => void; onActivate: (node: TalentNode) => void;
  layout?: "desktop" | "mobile-exclusive" | "mobile-general";
}) {
  return <TalentNode node={node} selected={selected} level={level} unlocked={unlocked} mutuallyExcluded={mutuallyExcluded}
    onSelect={() => onSelect(node)} onIncrease={() => onActivate(node)}
    style={{ gridColumn: layout === "desktop" ? getDesktopColumn(node.column) : layout === "mobile-general" ? node.column - 4 : node.column, gridRow: layout === "desktop" ? node.phase - 1 : 1 }} />;
}

interface PositionedTalentNode extends TalentNode {
  x: number;
  y: number;
}

interface ConnectorEdge {
  key: string;
  source: PositionedTalentNode;
  target: PositionedTalentNode;
  railY: number;
}

function createConnectorEdges(nodes: TalentNode[]): ConnectorEdge[] {
  const positionedNodes = nodes.map((node) => ({
    ...node,
    x: ((getDesktopColumn(node.column) - 0.5) / 7) * 100,
    y: ((node.phase - 1.5) / 5) * 100,
  }));
  const nodeMap = new Map(positionedNodes.map((node) => [node.id, node]));
  const groups = new Map<string, Array<[PositionedTalentNode, PositionedTalentNode]>>();

  positionedNodes.forEach((target) => {
    target.prerequisites.forEach((prerequisiteId) => {
      const source = nodeMap.get(prerequisiteId);
      if (!source) return;
      const section = target.column >= 5 ? "general" : "exclusive";
      const key = `${section}-${source.phase}-${target.phase}`;
      groups.set(key, [...(groups.get(key) ?? []), [source, target]]);
    });
  });

  // 同一层之间的连线共用一条横轨高度
  return [...groups.entries()].flatMap(([key, edges]) => {
    const sourceBottom = Math.max(...edges.map(([source]) => source.y + 8.25));
    const targetTop = Math.min(...edges.map(([, target]) => target.y - 5.25));
    const railY = (sourceBottom + targetTop) / 2;
    return edges.map(([source, target]) => ({ key: `${key}-${source.id}-${target.id}`, source, target, railY }));
  });
}

function TalentConnectors({ nodes, levels }: { nodes: TalentNode[]; levels: Record<string, number> }) {
  return <TalentConnectorLines paths={createConnectorEdges(nodes).map(({ key, source, target, railY }) => ({
    id: key,
    d: `M ${source.x} ${source.y + 8.25} V ${railY} H ${target.x} V ${target.y - 5.25}`,
    active: (levels[source.id] ?? 0) > 0 && (levels[target.id] ?? 0) > 0,
  }))} />;
}

function PassiveTalentSelector({ theme, previewTalent, equippedId, onPreview, onApply, onClose }: {
  theme: TalentTheme; previewTalent: PassiveTalent; equippedId: string | null;
  onPreview: (talent: PassiveTalent) => void; onApply: (talent: PassiveTalent) => void; onClose: () => void;
}) {
  return <TalentPassiveSelector season="s3" id="s3-passive-talent-selector" theme={getThemeStyle(theme)}
    options={PASSIVE_DATA.passives} previewId={previewTalent.id} equippedId={equippedId}
    onPreview={id => { const option = PASSIVE_DATA.passives.find(p => p.id === id); if (option) onPreview(option); }}
    onApply={id => { const option = PASSIVE_DATA.passives.find(p => p.id === id); if (option) onApply(option); }}
    onClose={onClose} tags={previewTalent.tags} requirement={<>赛季等级 <strong>{previewTalent.unlockLevel}</strong> 解锁</>}>
    <TalentDescription value={previewTalent.description} />
    <div id={`multiplier-provider-passive-${previewTalent.id}`} data-multiplier-provider-target={`passive-${previewTalent.id}`} className="mt-4">
      <MultiplierSourceBadges source={{ type: "season-talent", season: "s3", tree: "zero", passiveId: previewTalent.id }} />
    </div>
  </TalentPassiveSelector>;
}

export function S3SeasonTalentBuilder({ talentId }: { talentId: S3TalentId }) {
  const DATA = TALENT_DATA[talentId];
  const ROOT_NODE_ID = DATA.nodes[0].id;
  const TALENT_BUILD_STORAGE_KEY = `nzm-wiki:season-talents:s3:${talentId}:v1`;
  const [selectedNodeId, setSelectedNodeId] = useState(ROOT_NODE_ID);
  const [talentLevels, setTalentLevels] = useState(getDefaultS3TalentLevels);
  const [selectedPassiveId, setSelectedPassiveId] = useState<string | null>(null);
  const [previewPassiveId, setPreviewPassiveId] = useState(PASSIVE_DATA.passives[0].id);
  const [passiveSelectorOpen, setPassiveSelectorOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const passiveButtonRef = useRef<HTMLButtonElement>(null);

  const nodeMap = useMemo(
    () => new Map(DATA.nodes.map((node) => [node.id, node])),
    [DATA.nodes],
  );
  const selectedNode = nodeMap.get(selectedNodeId) ?? DATA.nodes[0];
  const selectedLevel =
    selectedNode.id === ROOT_NODE_ID ? 1 : (talentLevels[selectedNode.id] ?? 0);
  const selectedPassive =
    PASSIVE_DATA.passives.find((talent) => talent.id === selectedPassiveId) ?? null;
  const previewPassive =
    PASSIVE_DATA.passives.find((talent) => talent.id === previewPassiveId) ??
    PASSIVE_DATA.passives[0];
  const exclusiveNodes = DATA.nodes.filter(
    (node) => node.id !== ROOT_NODE_ID && node.column <= 3,
  );
  const generalNodes = DATA.nodes.filter((node) => node.column >= 5);

  const updateDeepLink = useCallback((selection: { nodeId?: string; passiveId?: string }) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("node");
    url.searchParams.delete("passive");
    if (selection.nodeId) url.searchParams.set("node", selection.nodeId);
    if (selection.passiveId) url.searchParams.set("passive", selection.passiveId);
    url.hash = selection.passiveId
      ? `season-talent-passive-${selection.passiveId}`
      : selection.nodeId
        ? `season-talent-node-${selection.nodeId}`
        : "";
    window.history.replaceState(null, "", url);
  }, []);

  const spentPoints = useMemo(
    () => getS3SpentTalentPoints(talentLevels),
    [talentLevels],
  );

  const closePassiveSelector = useCallback((restoreFocus = true) => {
    setPassiveSelectorOpen(false);
    updateDeepLink({});
    if (restoreFocus) {
      window.requestAnimationFrame(() => passiveButtonRef.current?.focus());
    }
  }, [updateDeepLink]);

  const openPassiveSelector = useCallback((passiveId?: string) => {
    const targetId =
      passiveId ?? selectedPassiveId ?? PASSIVE_DATA.passives[0].id;
    setPreviewPassiveId(targetId);
    setPassiveSelectorOpen(true);
    updateDeepLink({ passiveId: targetId });
  }, [selectedPassiveId, updateDeepLink]);

  const updateNodeLevel = useCallback((node: TalentNode, requestedLevel: number) => {
    if (node.id === ROOT_NODE_ID) return;

    setTalentLevels((current) =>
      setS3TalentNodeLevel(
        DATA.nodes,
        current,
        node.id,
        requestedLevel,
        POINT_LIMIT,
      ),
    );
  }, [DATA.nodes, ROOT_NODE_ID]);

  const selectNode = (node: TalentNode) => {
    setSelectedNodeId(node.id);
    updateDeepLink({ nodeId: node.id });
  };

  const activateNode = (node: TalentNode) => {
    setSelectedNodeId(node.id);
    updateDeepLink({ nodeId: node.id });
    if (node.id !== ROOT_NODE_ID) {
      updateNodeLevel(node, (talentLevels[node.id] ?? 0) + 1);
    }
  };

  const resetBuild = () => {
    setTalentLevels(getDefaultS3TalentLevels());
    setSelectedPassiveId(null);
    setSelectedNodeId(ROOT_NODE_ID);
    updateDeepLink({});
  };

  const isGeneralNodeDimmed = (node: TalentNode) =>
    node.column >= 5 &&
    !talentLevels[node.id] &&
    generalNodes.some(
      (candidate) =>
        candidate.phase === node.phase && Boolean(talentLevels[candidate.id]),
    );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TALENT_BUILD_STORAGE_KEY);
      if (!raw) return;

      const restored = restoreS3TalentBuild(
        DATA.nodes,
        ROOT_NODE_ID,
        JSON.parse(raw),
        new Set(PASSIVE_DATA.passives.map((talent) => talent.id)),
        POINT_LIMIT,
      );
      setTalentLevels(restored.levels);
      setSelectedPassiveId(restored.passiveId);
    } catch {
      // Ignore unavailable or malformed local storage and keep a clean build.
    } finally {
      setStorageReady(true);
    }
  }, [DATA.nodes, ROOT_NODE_ID, TALENT_BUILD_STORAGE_KEY]);

  useEffect(() => {
    let frame = 0;
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const nodeId = params.get("node");
      const passiveId = params.get("passive");
      if (nodeId && nodeMap.has(nodeId)) setSelectedNodeId(nodeId);
      else if (!passiveId) setSelectedNodeId(ROOT_NODE_ID);

      const passive = PASSIVE_DATA.passives.find(
        (talent) => talent.id === passiveId,
      );
      if (passive) {
        setPreviewPassiveId(passive.id);
        setPassiveSelectorOpen(true);
      } else {
        setPassiveSelectorOpen(false);
      }

      const targetId = passiveId
        ? `season-talent-passive-${passiveId}`
        : nodeId
          ? `season-talent-node-${nodeId}`
          : null;
      if (!targetId) return;
      frame = window.requestAnimationFrame(() => {
        const targets = document.querySelectorAll<HTMLElement>(
          `[id="${targetId}"]`,
        );
        const visibleTarget = [...targets].find(
          (target) => target.getClientRects().length > 0,
        );
        visibleTarget?.scrollIntoView({
          block: "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
      });
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, [ROOT_NODE_ID, nodeMap]);

  useEffect(() => {
    if (!storageReady) return;

    const saved: SavedS3TalentBuild = {
      version: 1,
      levels: talentLevels,
      passiveId: selectedPassiveId,
    };

    try {
      window.localStorage.setItem(TALENT_BUILD_STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // The builder remains usable when storage is disabled.
    }
  }, [TALENT_BUILD_STORAGE_KEY, selectedPassiveId, storageReady, talentLevels]);

  return (
    <article
      className="relative -mx-4 flex min-h-full flex-col gap-4 px-4 py-4 sm:-mx-6 sm:px-6 lg:h-full lg:min-h-0 lg:gap-3 lg:py-0 xl:-mx-12 xl:px-12"
      data-s3-talent={talentId}
      style={getThemeStyle(THEMES[talentId])}
    >
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <Image
          src={getAssetPath("/webp/images/season-talents/s3/T_FX_TalentS3_08.webp")}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(2,10,16,.3),rgba(2,10,16,.5)_48%,rgba(2,10,16,.76))]" />
      </div>

      <TalentHeader season="s3" links={TREE_LINKS} activeId={talentId} name={DATA.name} icon={DATA.nodes[0].icon}
        points={spentPoints} limit={POINT_LIMIT} weapons={<>适用武器：{DATA.applicableWeapons.join("、")}</>}
        onInspect={() => selectNode(nodeMap.get(ROOT_NODE_ID) ?? DATA.nodes[0])}>
        <TalentPassiveSlot buttonRef={passiveButtonRef} ariaLabel="选择 S3 被动天赋" expanded={passiveSelectorOpen} controls="s3-passive-talent-selector" icon={selectedPassive?.icon} name={selectedPassive?.name} onClick={() => openPassiveSelector()} />
      </TalentHeader>

      {passiveSelectorOpen && (
        <PassiveTalentSelector
          theme={THEMES[talentId]}
          previewTalent={previewPassive}
          equippedId={selectedPassiveId}
          onPreview={(talent) => {
            setPreviewPassiveId(talent.id);
            updateDeepLink({ passiveId: talent.id });
          }}
          onApply={(talent) => {
            setSelectedPassiveId(talent.id);
            closePassiveSelector();
          }}
          onClose={closePassiveSelector}
        />
      )}

      <TalentWorkspace details={
          <DetailCard
            key={selectedNode.id}
            node={selectedNode}
            talentId={talentId}
            rootNodeId={ROOT_NODE_ID}
            level={selectedLevel}
            unlocked={isS3TalentNodeUnlocked(selectedNode, DATA.nodes, talentLevels)}
            spentPoints={spentPoints}
            onLevelChange={(level) => updateNodeLevel(selectedNode, level)}
            onReset={resetBuild}
          />
      }>
        <div className="relative mx-auto hidden h-full min-h-0 max-w-[1120px] grid-cols-7 grid-rows-5 gap-x-1 gap-y-1 lg:grid">
            <TalentTreeSections />
            <TalentConnectors nodes={[...exclusiveNodes, ...generalNodes]} levels={talentLevels} />
            {[...exclusiveNodes, ...generalNodes].map((node) => (
              <TalentNodeButton
                key={node.id}
                node={node}
                selected={node.id === selectedNode.id}
                level={talentLevels[node.id] ?? 0}
                unlocked={isS3TalentNodeUnlocked(node, DATA.nodes, talentLevels)}
                mutuallyExcluded={isGeneralNodeDimmed(node)}
                onSelect={selectNode}
                onActivate={activateNode}
              />
            ))}
          </div>

          <div className="relative space-y-7 lg:hidden">
            {[
              {
                label: "专属天赋",
                kind: "exclusive" as const,
                columns: 3,
                nodes: exclusiveNodes,
              },
              {
                label: "通用天赋",
                kind: "general" as const,
                columns: 4,
                nodes: generalNodes,
              },
            ].map((section) => (
              <div
                key={section.kind}
                className={`border-l-2 pl-3 ${
                  section.kind === "exclusive"
                    ? "border-[color:var(--talent-accent)]"
                    : "border-cyan-200/45"
                }`}
              >
                <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
                  <h2 className={`text-sm font-semibold ${
                    section.kind === "exclusive"
                      ? "text-[color:var(--talent-accent)]"
                      : "text-cyan-100/75"
                  }`}>
                    {section.label}
                  </h2>
                  <span className="text-[0.68rem] text-slate-500">
                    {storageReady ? "方案已保存" : "正在读取方案"}
                  </span>
                </div>
                <div className="space-y-3">
                  {[2, 3, 4, 5, 6].map((phase) => (
                    <div
                      key={phase}
                      className="relative grid min-h-[6rem] items-center gap-1 rounded-lg border border-slate-700/35 bg-[#06131d]/55 px-1 py-1"
                      style={{ gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))` }}
                    >
                      <span className="absolute left-1 top-1 text-[0.6rem] text-slate-600">
                        {phase - 1}
                      </span>
                      {section.nodes
                        .filter((node) => node.phase === phase)
                        .map((node) => (
                          <TalentNodeButton
                            key={node.id}
                            node={node}
                            selected={node.id === selectedNode.id}
                            level={talentLevels[node.id] ?? 0}
                            unlocked={isS3TalentNodeUnlocked(
                              node,
                              DATA.nodes,
                              talentLevels,
                            )}
                            mutuallyExcluded={isGeneralNodeDimmed(node)}
                            onSelect={selectNode}
                            onActivate={activateNode}
                            layout={
                              section.kind === "general"
                                ? "mobile-general"
                                : "mobile-exclusive"
                            }
                          />
                        ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TalentWorkspace>
    </article>
  );
}
