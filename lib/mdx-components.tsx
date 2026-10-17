import { ProseTable } from "@/components/ProseTable";
import { Callout } from "@/components/Callout";
import { LevelTable } from "@/components/LevelTable";
import { DataTable } from "@/components/DataTable";
import { Credit } from "@/components/Credit";
import { EnemyCard, EnemyCardGrid } from "@/components/EnemyCard";
import { BuffCard, BuffCardGrid, BuffDetail, CardRef } from "@/components/BuffCard";
import { PeekabooGrid } from "@/components/PeekabooGrid";
import {
  Red,
  Yellow,
  Green,
  Grey,
  Orange,
  Brown,
  Blue,
  Purple,
  Pink,
  Fire,
  Ice,
  Shock,
  Corrosive,
  Kinetic,
  Highlight,
} from "@/components/TextStyle";
import { MDXImage } from "@/components/MDXImage";
import { MDXLink } from "@/components/MDXLink";
import { VideoGif } from "@/components/VideoGif";
import { HuntingGrowth } from "@/components/HuntingGrowth";
import {
  AttenuationChart,
  WeaponAttenuationChart,
} from "@/components/WeaponAttenuationChart";
import { CritCalculator } from "@/components/CritCalculator";
import { DamageCalculator } from "@/components/DamageCalculator";
import {
  WeaponSkill,
  ActiveSkill,
  PassiveSkill,
} from "@/components/WeaponSkill";
import type { Boss } from "@/types";
import { bossToEnemy } from "@/lib/bosses";
import {
  ElementStatusSummary,
  StatusEffectCatalog,
} from "@/components/StatusEffectCatalog";
import { SummonCompendium } from "@/components/SummonCompendium";
import { WeeklyBuffGuide } from "@/components/WeeklyBuffGuide";
import { HuntingTacticalSkillCatalog } from "@/components/HuntingTacticalSkillCatalog";
import {
  HuntingSpeedrunCardCatalog,
  HuntingSpeedrunTacticalPropCatalog,
} from "@/components/HuntingSpeedrunCatalog";
import { TriggerDamageCatalog } from "@/components/TriggerDamageCatalog";
import { FireRateCatalog } from "@/components/FireRateCatalog";

export const mdxComponents = {
  img: MDXImage,
  a: MDXLink,
  table: ProseTable,
  Callout,
  LevelTable,
  DataTable,
  Credit,
  BossCard: EnemyCard,
  BossCardGrid: EnemyCardGrid,
  BuffCard,
  BuffCardGrid,
  BuffDetail,
  CardRef,
  PeekabooGrid,
  Red,
  Yellow,
  Green,
  Grey,
  Orange,
  Brown,
  Blue,
  Purple,
  Pink,
  Fire,
  Ice,
  Shock,
  Corrosive,
  Kinetic,
  Highlight,
  VideoGif,
  HuntingGrowth,
  AttenuationChart,
  WeaponAttenuationChart,
  CritCalculator,
  DamageCalculator,
  WeaponSkill,
  ActiveSkill,
  PassiveSkill,
  ElementStatusSummary,
  StatusEffectCatalog,
  SummonCompendium,
  WeeklyBuffGuide,
  HuntingTacticalSkillCatalog,
  HuntingSpeedrunCardCatalog,
  HuntingSpeedrunTacticalPropCatalog,
  TriggerDamageCatalog,
  FireRateCatalog,
};

/**
 * 创建带有 boss 数据的 MDX 组件
 * 在服务端按 title 或 slug 解析 boss 对象，然后传递给客户端组件
 */
export function getMdxComponents(bossData?: Record<string, Boss>) {
  if (!bossData) return mdxComponents;

  return {
    ...mdxComponents,
    // 服务端解析 title 或 slug，直接传递完整的 boss 对象给客户端
    BossCard: ({ title, boss }: { title?: string; boss?: Boss }) => {
      const resolvedBoss = boss ?? (title ? bossData[title] : undefined);
      if (!resolvedBoss) {
        return (
          <div className="not-prose flex h-32 w-full items-center justify-center rounded border border-red-500/30 bg-red-500/5 text-red-400">
            Boss not found: {title}
          </div>
        );
      }
      return <EnemyCard enemy={bossToEnemy(resolvedBoss)} />;
    },
  };
}

export { TableOfContents } from "@/components/TableOfContents";
