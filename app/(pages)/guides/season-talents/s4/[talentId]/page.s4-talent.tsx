import type { Metadata } from "next";
import { notFound } from "next/navigation";
import blackHoleData from "@/data/season-talents/s4/black-hole.json";
import dualStarData from "@/data/season-talents/s4/dual-star.json";
import matrixSymbiosisData from "@/data/season-talents/s4/matrix-symbiosis.json";
import passiveData from "@/data/season-talents/s4/passives.json";
import {
  S4SeasonTalentBuilder,
  type S4TalentId,
} from "@/components/season-talents/s4/SeasonTalentBuilder";
import type {
  SeasonTalentPassiveData,
  SeasonTalentTreeData,
} from "@/lib/season-talent-builder";

const TREES: Record<S4TalentId, SeasonTalentTreeData> = {
  "dual-star": dualStarData as SeasonTalentTreeData,
  "matrix-symbiosis": matrixSymbiosisData as SeasonTalentTreeData,
  "black-hole": blackHoleData as SeasonTalentTreeData,
};

const PASSIVES = passiveData as {
  draft?: boolean;
  trees: Record<S4TalentId, { light: SeasonTalentPassiveData[]; dark: SeasonTalentPassiveData[] }>;
};

export const dynamicParams = false;

const showDrafts = process.env.NODE_ENV === "development";

function isS4TalentId(value: string): value is S4TalentId {
  return value in TREES;
}

function isS4TalentVisible(talentId: S4TalentId) {
  return (
    showDrafts ||
    (TREES[talentId].draft !== true && PASSIVES.draft !== true)
  );
}

export function generateStaticParams() {
  return (Object.keys(TREES) as S4TalentId[])
    .filter(isS4TalentVisible)
    .map((talentId) => ({ talentId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ talentId: string }>;
}): Promise<Metadata> {
  const { talentId } = await params;
  if (!isS4TalentId(talentId) || !isS4TalentVisible(talentId)) return {};
  const tree = TREES[talentId];
  return {
    title: `${tree.name}天赋树（S4）`,
    description: `逆战未来 S4 赛季天赋${tree.name}的完整节点、加点方案和光暗被动技能。`,
    alternates: { canonical: `/guides/season-talents/s4/${talentId}` },
  };
}

export default async function S4SeasonTalentPage({
  params,
}: {
  params: Promise<{ talentId: string }>;
}) {
  const { talentId } = await params;
  if (!isS4TalentId(talentId) || !isS4TalentVisible(talentId)) notFound();
  const tree = TREES[talentId];
  const treePassives = PASSIVES.trees[talentId];

  return (
    <S4SeasonTalentBuilder
      tree={tree}
      passives={[...treePassives.light, ...treePassives.dark]}
    />
  );
}
