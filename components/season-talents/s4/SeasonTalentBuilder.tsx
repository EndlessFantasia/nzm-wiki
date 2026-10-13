"use client";

import Image from "next/image";
import { TalentHeader, TalentPassiveSlot, TalentNode, TalentDetails, TalentLevelActions, TalentLevelPreview, useTalentPreviewLevel, TalentTreeSections, TalentWorkspace, TalentConnectorLines } from "@/components/season-talents/TalentEditor";
import { ArrowLeftRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { TalentPassiveSelector } from "@/components/season-talents/TalentPassiveSelector";
import { MultiplierSourceBadges } from "@/components/MultiplierBadges";
import {
  getSpentTalentPoints,
  isTalentNodeUnlocked,
  restoreSeasonTalentBuild,
  setTalentNodeLevel,
  type SavedSeasonTalentBuild,
  type SeasonTalentNodeData,
  type SeasonTalentPassiveData,
  type SeasonTalentTreeData,
} from "@/lib/season-talent-builder";
import { getAssetPath } from "@/lib/path";

export type S4TalentId = "dual-star" | "matrix-symbiosis" | "black-hole";

type EnergyType = "light" | "dark";

const THEMES: Record<
  S4TalentId,
  { accent: string; accentSoft: string; glow: string }
> = {
  "dual-star": {
    accent: "#c06cff",
    accentSoft: "rgba(192,108,255,0.16)",
    glow: "rgba(192,108,255,0.46)",
  },
  "matrix-symbiosis": {
    accent: "#ff6557",
    accentSoft: "rgba(255,101,87,0.24)",
    glow: "rgba(255,101,87,0.52)",
  },
  "black-hole": {
    accent: "#52c8ff",
    accentSoft: "rgba(82,200,255,0.22)",
    glow: "rgba(82,200,255,0.54)",
  },
};

const TREE_LINKS: Array<{ id: S4TalentId; name: string }> = [
  { id: "dual-star", name: "双星" },
  { id: "matrix-symbiosis", name: "矩阵共生" },
  { id: "black-hole", name: "黑洞" },
];

function getDesktopColumn(column: number) {
  return column >= 5 ? column - 1 : column;
}

type MutualPair = {
  id: string;
  members: [SeasonTalentNodeData, SeasonTalentNodeData];
  column: number;
  phase: number;
};

function getMutualPairs(nodes: readonly SeasonTalentNodeData[]) {
  const groups = new Map<string, SeasonTalentNodeData[]>();
  for (const node of nodes) {
    if (!node.mutualGroup) continue;
    const group = groups.get(node.mutualGroup) ?? [];
    group.push(node);
    groups.set(node.mutualGroup, group);
  }

  return Array.from(groups.entries()).flatMap(([id, members]) => {
    if (members.length !== 2 || members[0].phase !== members[1].phase) return [];
    const pair = [...members].sort((a, b) => a.column - b.column) as [
      SeasonTalentNodeData,
      SeasonTalentNodeData,
    ];
    return [
      {
        id,
        members: pair,
        column: (getDesktopColumn(pair[0].column) + getDesktopColumn(pair[1].column)) / 2,
        phase: pair[0].phase,
      } satisfies MutualPair,
    ];
  });
}

function isMutuallyExcluded(
  node: SeasonTalentNodeData,
  nodes: readonly SeasonTalentNodeData[],
  levels: Record<string, number>,
) {
  if (!node.mutualGroup || (levels[node.id] ?? 0) > 0) return false;
  return nodes.some(
    (candidate) =>
      candidate.id !== node.id &&
      candidate.mutualGroup === node.mutualGroup &&
      (levels[candidate.id] ?? 0) > 0,
  );
}

function getThemeStyle(id: S4TalentId): CSSProperties {
  const theme = THEMES[id];
  return {
    "--s4-accent": theme.accent,
    "--s4-accent-soft": theme.accentSoft,
    "--s4-glow": theme.glow,
  } as CSSProperties;
}

function RichText({ children }: { children: string }) {
  const parts = children.split(/(<qiangdiao>|<\/qiangdiao>|<span typeface="Bold">|<C003>|<\/>)/g);
  let style: "highlight" | "heading" | "hint" | null = null;
  const rendered: ReactNode[] = [];

  parts.forEach((part, index) => {
    if (part === "<qiangdiao>") {
      style = "highlight";
      return;
    }
    if (part === '<span typeface="Bold">') {
      style = "heading";
      return;
    }
    if (part === "<C003>") {
      style = "hint";
      return;
    }
    if (part === "</qiangdiao>" || part === "</>") {
      style = null;
      return;
    }
    if (!part) return;
    rendered.push(
      style === "highlight" || style === "heading" ? (
        <strong key={index} className={style === "highlight" ? "font-semibold text-[#f1c85d]" : "font-semibold"}>
          {part}
        </strong>
      ) : (
        <span key={index} className={style === "hint" ? "text-zinc-400" : undefined}>{part}</span>
      ),
    );
  });

  return <>{rendered}</>;
}

function updateDeepLink(selection: { nodeId?: string; passiveId?: string }) {
  const url = new URL(window.location.href);
  url.searchParams.delete("node");
  url.searchParams.delete("passive");
  if (selection.nodeId) url.searchParams.set("node", selection.nodeId);
  if (selection.passiveId) url.searchParams.set("passive", selection.passiveId);
  url.hash = selection.nodeId
    ? `season-talent-node-${selection.nodeId}`
    : selection.passiveId
      ? `season-talent-passive-${selection.passiveId}`
      : "";
  window.history.replaceState(null, "", url);
}

function EnergySlot({ energy, passive, onOpen, buttonRef }: {
  energy: EnergyType; passive: SeasonTalentPassiveData | null; onOpen: () => void; buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  return <TalentPassiveSlot buttonRef={buttonRef} tone={energy} label={energy === "light" ? "光能量" : "暗能量"}
    ariaLabel={`选择${energy === "light" ? "光能" : "暗能"}被动天赋`} icon={passive?.icon} name={passive?.name ?? "选择被动"} onClick={onOpen} />;
}

function TalentNodeButton({ node, selected, level, unlocked, onSelect, onIncrease, layout = "desktop", mutualPairPosition, mutuallyExcluded = false }: {
  node: SeasonTalentNodeData; selected: boolean; level: number; unlocked: boolean; onSelect: () => void; onIncrease: () => void;
  layout?: "desktop" | "mobile-exclusive" | "mobile-general"; mutualPairPosition?: "left" | "right"; mutuallyExcluded?: boolean;
}) {
  return <TalentNode node={node} selected={selected} level={level} unlocked={unlocked} mutuallyExcluded={mutuallyExcluded} onSelect={onSelect} onIncrease={onIncrease}
    style={layout === "desktop" ? { gridColumn: mutualPairPosition ? 2 : getDesktopColumn(node.column), gridRow: node.phase - 1,
      transform: mutualPairPosition === "left" ? "translateX(-70%)" : mutualPairPosition === "right" ? "translateX(70%)" : undefined }
      : { gridColumn: layout === "mobile-general" ? node.column - 4 : node.column, gridRow: 1 }} />;
}

function TalentConnectors({
  nodes,
  levels,
}: {
  nodes: SeasonTalentNodeData[];
  levels: Record<string, number>;
}) {
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const mutualPairs = getMutualPairs(nodes);
  const pairByNodeId = new Map(
    mutualPairs.flatMap((pair) => pair.members.map((node) => [node.id, pair] as const)),
  );
  const renderedEdges = new Set<string>();
  const paths = nodes.flatMap((target) =>
    target.prerequisites.flatMap((sourceId) => {
      const source = nodeMap.get(sourceId);
      if (!source || source.isRoot || target.isRoot) return [];
      const sourcePair = pairByNodeId.get(source.id);
      const targetPair = pairByNodeId.get(target.id);
      const edgeKey = `${sourcePair?.id ?? source.id}-${targetPair?.id ?? target.id}`;
      if (renderedEdges.has(edgeKey)) return [];
      renderedEdges.add(edgeKey);

      const sourceColumn = sourcePair?.column ?? getDesktopColumn(source.column);
      const targetColumn = targetPair?.column ?? getDesktopColumn(target.column);
      const sourceX = ((sourceColumn - 0.5) / 7) * 100;
      const sourceCenterY = (((sourcePair?.phase ?? source.phase) - 1.5) / 5) * 100;
      const sourceY = sourceCenterY + 8.25;
      const targetX = ((targetColumn - 0.5) / 7) * 100;
      const targetCenterY = (((targetPair?.phase ?? target.phase) - 1.5) / 5) * 100;
      const targetY = targetCenterY - 5.25;
      const midpoint = (sourceY + targetY) / 2;
      const sourceActive = sourcePair
        ? sourcePair.members.some((node) => (levels[node.id] ?? 0) >= node.maxLevel)
        : (levels[source.id] ?? 0) >= (target.column >= 5 ? 1 : source.maxLevel);
      const targetActive = targetPair
        ? targetPair.members.some((node) => (levels[node.id] ?? 0) > 0)
        : (levels[target.id] ?? 0) > 0;
      return [{ id: edgeKey, d: `M ${sourceX} ${sourceY} V ${midpoint} H ${targetX} V ${targetY}`, active: sourceActive && targetActive,
        style: { stroke: sourceActive && targetActive ? "var(--s4-accent)" : "rgba(118,145,164,.28)", strokeWidth: sourceActive && targetActive ? .5 : .32, opacity: 1 } }];
    }),
  );

  return <TalentConnectorLines paths={paths} />;
}

function MutualConflictMarkers({
  nodes,
  levels,
  layout = "desktop",
}: {
  nodes: readonly SeasonTalentNodeData[];
  levels: Record<string, number>;
  layout?: "desktop" | "mobile-exclusive";
}) {
  return getMutualPairs(nodes).map((pair) => {
    const [first, second] = pair.members;
    const active = (levels[first.id] ?? 0) > 0 || (levels[second.id] ?? 0) > 0;
    const className = `pointer-events-none z-20 flex h-7 w-9 items-center justify-center ${
      active
        ? "text-[color:var(--s4-accent)] drop-shadow-[0_0_7px_var(--s4-glow)]"
        : "text-cyan-100/45"
    }`;

    if (layout === "mobile-exclusive") {
      return (
        <span
          key={pair.id}
          role="img"
          aria-label={`${first.name}与${second.name}互斥`}
          className={`${className} place-self-center`}
          style={{ gridColumn: 2, gridRow: 1 }}
        >
          <ArrowLeftRight aria-hidden="true" className="h-6 w-6" />
        </span>
      );
    }

    const left = ((pair.column - 0.5) / 7) * 100;
    const top = ((pair.phase - 1.5) / 5) * 100;
    return (
      <span
        key={pair.id}
        role="img"
        aria-label={`${first.name}与${second.name}互斥`}
        className={`${className} absolute -translate-x-1/2 -translate-y-1/2`}
        style={{ left: `${left}%`, top: `${top}%` }}
      >
        <ArrowLeftRight aria-hidden="true" className="h-6 w-6" />
      </span>
    );
  });
}

function MutualPairCards({
  nodes,
  levels,
}: {
  nodes: readonly SeasonTalentNodeData[];
  levels: Record<string, number>;
}) {
  return getMutualPairs(nodes).map((pair) => {
    const active = pair.members.some((node) => (levels[node.id] ?? 0) > 0);
    const left = ((pair.column - 0.5) / 7) * 100;
    const top = ((pair.phase - 1.5) / 5) * 100;

    return (
      <span
        key={pair.id}
        aria-hidden="true"
        className={`pointer-events-none absolute z-[5] h-[clamp(5rem,10.5vh,6.75rem)] w-[clamp(10rem,14vw,13.75rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-[#06131d] shadow-[0_8px_24px_rgba(0,0,0,.4)] ${
          active
            ? "border-[color:var(--s4-accent)]"
            : "border-cyan-100/30"
        }`}
        style={{ left: `${left}%`, top: `${top}%` }}
      />
    );
  });
}

function NodeDetail({ talentId, node, level, unlocked, spentPoints, pointLimit, onChangeLevel, onReset }: {
  talentId: S4TalentId; node: SeasonTalentNodeData; level: number; unlocked: boolean; spentPoints: number; pointLimit: number;
  onChangeLevel: (level: number) => void; onReset: () => void;
}) {
  const [previewLevel, setPreviewLevel] = useTalentPreviewLevel(node.id, level);
  return <TalentDetails season="s4" name={node.name} icon={node.icon} level={level} maxLevel={node.isRoot ? undefined : node.maxLevel} onReset={onReset}
    actions={!node.isRoot && <TalentLevelActions name={node.name} level={level} maxLevel={node.maxLevel} canDecrease={level > 0}
      canIncrease={unlocked && level < node.maxLevel && spentPoints < pointLimit} onChange={onChangeLevel} />}>
    {!node.isRoot && <TalentLevelPreview level={previewLevel} maxLevel={node.maxLevel} onChange={setPreviewLevel} />}
    <p className="whitespace-pre-line"><RichText>{node.descriptions[previewLevel - 1] ?? "暂无技能说明"}</RichText></p>
    <div id={`multiplier-provider-node-${node.id}`} data-multiplier-provider-target={`node-${node.id}`} className="mt-3">
      <MultiplierSourceBadges source={{ type: "season-talent", season: "s4", tree: talentId, nodeId: node.id }} />
    </div>
  </TalentDetails>;
}

function PassiveSelector({ talentId, energy, passives, equippedId, previewId, onPreview, onApply, onClose }: {
  talentId: S4TalentId; energy: EnergyType; passives: SeasonTalentPassiveData[]; equippedId: string | null;
  previewId: string; onPreview: (id: string) => void; onApply: (id: string) => void; onClose: () => void;
}) {
  const selected = passives.find(p => p.id === previewId) ?? passives[0];
  return <TalentPassiveSelector season="s4" title={energy === "light" ? "选择光能天赋" : "选择暗能天赋"}
    theme={{ ...getThemeStyle(talentId), "--s4-accent": energy === "light" ? "#e2c95f" : "#78c9f4",
      "--s4-accent-soft": energy === "light" ? "#e2c95f20" : "#78c9f420" } as CSSProperties}
    options={passives} previewId={previewId} equippedId={equippedId} onPreview={onPreview} onApply={onApply} onClose={onClose}>
    <p className="whitespace-pre-line"><RichText>{selected?.description ?? ""}</RichText></p>
    {selected && <div id={`multiplier-provider-passive-${selected.id}`} data-multiplier-provider-target={`passive-${selected.id}`} className="mt-3">
      <MultiplierSourceBadges source={{ type: "season-talent", season: "s4", tree: talentId, passiveId: selected.id }} />
    </div>}
  </TalentPassiveSelector>;
}

export function S4SeasonTalentBuilder({
  tree,
  passives,
}: {
  tree: SeasonTalentTreeData;
  passives: SeasonTalentPassiveData[];
}) {
  const talentId = tree.id as S4TalentId;
  const rootNode = tree.nodes.find((node) => node.isRoot) ?? tree.nodes[0];
  const defaultLight = passives.find(
    (passive) => passive.energy === "light" && passive.isDefault,
  );
  const defaultDark = passives.find(
    (passive) => passive.energy === "dark" && passive.isDefault,
  );
  const storageKey = `nzm-wiki:season-talents:s4:${talentId}:v1`;
  const [selectedNodeId, setSelectedNodeId] = useState(rootNode.id);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [lightPassiveId, setLightPassiveId] = useState<string | null>(
    defaultLight?.id ?? null,
  );
  const [darkPassiveId, setDarkPassiveId] = useState<string | null>(defaultDark?.id ?? null);
  const [selectorEnergy, setSelectorEnergy] = useState<EnergyType | null>(null);
  const [previewPassiveId, setPreviewPassiveId] = useState(defaultLight?.id ?? passives[0]?.id);
  const [storageReady, setStorageReady] = useState(false);
  const lightButtonRef = useRef<HTMLButtonElement>(null);
  const darkButtonRef = useRef<HTMLButtonElement>(null);

  const nodeMap = useMemo(() => new Map(tree.nodes.map((node) => [node.id, node])), [tree.nodes]);
  const selectedNode = nodeMap.get(selectedNodeId) ?? rootNode;
  const selectedLevel = selectedNode.isRoot ? 1 : (levels[selectedNode.id] ?? 0);
  const spentPoints = getSpentTalentPoints(levels);
  const lightPassive = passives.find((passive) => passive.id === lightPassiveId) ?? null;
  const darkPassive = passives.find((passive) => passive.id === darkPassiveId) ?? null;
  const visiblePassives = passives.filter((passive) => passive.energy === selectorEnergy);

  const closeSelector = useCallback(
    (restoreFocus = true) => {
      const closingEnergy = selectorEnergy;
      setSelectorEnergy(null);
      updateDeepLink({});
      if (restoreFocus && closingEnergy) {
        window.requestAnimationFrame(() => {
          (closingEnergy === "light" ? lightButtonRef : darkButtonRef).current?.focus();
        });
      }
    },
    [selectorEnergy],
  );

  const openSelector = useCallback(
    (energy: EnergyType, passiveId?: string) => {
      const candidates = passives.filter((passive) => passive.energy === energy);
      const equippedId = energy === "light" ? lightPassiveId : darkPassiveId;
      const selectedId = passiveId ?? equippedId ?? candidates[0]?.id;
      if (!selectedId) return;
      setPreviewPassiveId(selectedId);
      setSelectorEnergy(energy);
      updateDeepLink({ passiveId: selectedId });
    },
    [darkPassiveId, lightPassiveId, passives],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const restored = restoreSeasonTalentBuild(tree, JSON.parse(raw), passives);
        setLevels(restored.levels);
        setLightPassiveId(restored.lightPassiveId ?? defaultLight?.id ?? null);
        setDarkPassiveId(restored.darkPassiveId ?? defaultDark?.id ?? null);
      }
    } catch {
      // Keep the clean default build when storage is unavailable or malformed.
    } finally {
      const params = new URLSearchParams(window.location.search);
      const nodeId = params.get("node");
      const passiveId = params.get("passive");
      if (nodeId && nodeMap.has(nodeId)) setSelectedNodeId(nodeId);
      if (passiveId) {
        const passive = passives.find((candidate) => candidate.id === passiveId);
        if (passive) {
          setPreviewPassiveId(passive.id);
          setSelectorEnergy(passive.energy);
        }
      }
      setStorageReady(true);
    }
  }, [defaultDark?.id, defaultLight?.id, nodeMap, passives, storageKey, tree]);

  useEffect(() => {
    if (!storageReady) return;
    const saved: SavedSeasonTalentBuild = {
      version: 1,
      levels,
      lightPassiveId,
      darkPassiveId,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      // The builder remains usable when storage is unavailable.
    }
  }, [darkPassiveId, levels, lightPassiveId, storageKey, storageReady]);

  const selectNode = (node: SeasonTalentNodeData) => {
    setSelectedNodeId(node.id);
    updateDeepLink({ nodeId: node.id });
  };

  const resetBuild = () => {
    setLevels({});
    setLightPassiveId(defaultLight?.id ?? null);
    setDarkPassiveId(defaultDark?.id ?? null);
  };

  const increaseNodeLevel = (node: SeasonTalentNodeData) => {
    if (node.isRoot) return;
    setLevels((current) =>
      setTalentNodeLevel(tree, current, node.id, (current[node.id] ?? 0) + 1),
    );
  };

  const applyPassive = (passiveId: string) => {
    const passive = passives.find((candidate) => candidate.id === passiveId);
    if (!selectorEnergy || passive?.energy !== selectorEnergy) return;
    if (selectorEnergy === "light") setLightPassiveId(passiveId);
    else setDarkPassiveId(passiveId);
    closeSelector();
  };

  const mutualPairPositions = new Map(
    getMutualPairs(tree.nodes).flatMap((pair) => [
      [pair.members[0].id, "left" as const],
      [pair.members[1].id, "right" as const],
    ]),
  );

  return (
    <article
      className="relative -mx-4 flex min-h-full flex-col gap-4 px-4 py-4 sm:-mx-6 sm:px-6 lg:h-full lg:min-h-0 lg:gap-3 lg:py-0 xl:-mx-12 xl:px-12"
      data-s4-talent={talentId}
      style={getThemeStyle(talentId)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
      >
        <Image
          src={getAssetPath(
            talentId === "matrix-symbiosis"
              ? "/webp/images/season-talents/s4/details/grid-orange.webp"
              : "/webp/images/season-talents/s4/details/grid-blue.webp",
          )}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className={`absolute inset-0 ${
            talentId === "matrix-symbiosis"
              ? "bg-[linear-gradient(135deg,rgba(165,48,31,0.08),rgba(2,10,16,0.3)_48%,rgba(2,10,16,0.7))]"
              : talentId === "black-hole"
                ? "bg-[linear-gradient(135deg,rgba(18,126,166,0.16),rgba(2,10,16,0.3)_48%,rgba(2,10,16,0.7))]"
                : "bg-[linear-gradient(135deg,rgba(116,45,158,0.1),rgba(2,10,16,0.26)_48%,rgba(2,10,16,0.66))]"
          }`}
        />
      </div>
      <TalentHeader season="s4" links={TREE_LINKS} activeId={talentId} name={tree.name} icon={tree.icon}
        points={spentPoints} limit={tree.pointLimit} weapons={<RichText>{tree.applicableWeapons}</RichText>} onInspect={() => selectNode(rootNode)}>
        <EnergySlot energy="light" passive={lightPassive} onOpen={() => openSelector("light")} buttonRef={lightButtonRef} />
        <EnergySlot energy="dark" passive={darkPassive} onOpen={() => openSelector("dark")} buttonRef={darkButtonRef} />
      </TalentHeader>

      <TalentWorkspace details={
            <NodeDetail
              key={selectedNode.id}
              talentId={talentId}
              node={selectedNode}
              level={selectedLevel}
              unlocked={isTalentNodeUnlocked(selectedNode, tree.nodes, levels)}
              spentPoints={spentPoints}
              pointLimit={tree.pointLimit}
              onChangeLevel={(level) =>
                setLevels((current) =>
                  setTalentNodeLevel(tree, current, selectedNode.id, level),
                )
              }
              onReset={resetBuild}
            />
      }>
        <div className="relative mx-auto hidden h-full min-h-0 max-w-[1120px] grid-cols-7 grid-rows-5 gap-x-1 gap-y-1 lg:grid">
              <TalentTreeSections />
              <TalentConnectors nodes={tree.nodes} levels={levels} />
              <MutualPairCards nodes={tree.nodes} levels={levels} />
              <MutualConflictMarkers nodes={tree.nodes} levels={levels} />
              {tree.nodes
                .filter((node) => !node.isRoot)
                .map((node) => (
                  <TalentNodeButton
                    key={node.id}
                    node={node}
                    selected={selectedNode.id === node.id}
                    level={levels[node.id] ?? 0}
                    unlocked={isTalentNodeUnlocked(node, tree.nodes, levels)}
                    onSelect={() => selectNode(node)}
                    onIncrease={() => increaseNodeLevel(node)}
                    mutualPairPosition={mutualPairPositions.get(node.id)}
                    mutuallyExcluded={isMutuallyExcluded(node, tree.nodes, levels)}
                  />
                ))}
            </div>

            <div className="relative space-y-7 lg:hidden">
              {[
                { label: "专属天赋", columns: 3, kind: "exclusive" as const },
                { label: "通用天赋", columns: 4, kind: "general" as const },
              ].map((section) => {
                const sectionNodes = tree.nodes.filter((node) =>
                  section.kind === "exclusive"
                    ? !node.isRoot && node.column <= 3
                    : node.column >= 5,
                );
                return (
                  <div
                    key={section.kind}
                    className={`border-l-2 pl-3 ${
                      section.kind === "exclusive"
                        ? "border-[color:var(--s4-accent)]"
                        : "border-cyan-200/45"
                    }`}
                  >
                    <h2
                      className={`mb-3 text-sm font-semibold ${
                        section.kind === "exclusive"
                          ? "text-[color:var(--s4-accent)]"
                          : "text-cyan-100/75"
                      }`}
                    >
                      {section.label}
                    </h2>
                    <div className="space-y-3">
                      {[2, 3, 4, 5, 6].map((phase) => (
                        <div
                          key={phase}
                          className="relative grid min-h-[5rem] items-center gap-2 rounded-lg border border-slate-700/35 bg-[#06131d]/45 px-1 py-1"
                          style={{ gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))` }}
                        >
                          <span className="absolute left-1 top-1 text-[0.6rem] text-slate-600">
                            {phase - 1}
                          </span>
                          {sectionNodes
                            .filter((node) => node.phase === phase)
                            .map((node) => (
                              <TalentNodeButton
                                key={node.id}
                                node={node}
                                selected={selectedNode.id === node.id}
                                level={levels[node.id] ?? 0}
                                unlocked={isTalentNodeUnlocked(node, tree.nodes, levels)}
                                onSelect={() => selectNode(node)}
                                onIncrease={() => increaseNodeLevel(node)}
                                mutuallyExcluded={isMutuallyExcluded(
                                  node,
                                  tree.nodes,
                                  levels,
                                )}
                                layout={
                                  section.kind === "general"
                                    ? "mobile-general"
                                    : "mobile-exclusive"
                                }
                              />
                            ))}
                          {section.kind === "exclusive" && (
                            <MutualConflictMarkers
                              nodes={sectionNodes.filter((node) => node.phase === phase)}
                              levels={levels}
                              layout="mobile-exclusive"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

          </TalentWorkspace>

      {selectorEnergy && (
        <PassiveSelector
          talentId={talentId}
          energy={selectorEnergy}
          passives={visiblePassives}
          equippedId={selectorEnergy === "light" ? lightPassiveId : darkPassiveId}
          previewId={previewPassiveId}
          onPreview={(id) => {
            setPreviewPassiveId(id);
            updateDeepLink({ passiveId: id });
          }}
          onApply={applyPassive}
          onClose={closeSelector}
        />
      )}
    </article>
  );
}
