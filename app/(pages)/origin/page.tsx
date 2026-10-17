import type { Metadata } from "next";
import affixCatalog from "@/data/origin/affixes.json";
import catalog from "@/data/origin/runes.json";
import talentCatalog from "@/data/origin/talents.json";
import type { OriginAffixCatalog } from "@/lib/origin-affixes";
import type { OriginRuneCatalog } from "@/lib/origin-runes";
import { resolveOriginTalentUnlockedRunes, type OriginTalentCatalog } from "@/lib/origin-talents";
import OriginCatalogClient from "./catalog-client";

const runes = catalog as OriginRuneCatalog;
const affixes = affixCatalog as OriginAffixCatalog;
const talents = talentCatalog as OriginTalentCatalog;
const unlockedRunes = resolveOriginTalentUnlockedRunes(talents.talents, runes.runes);

export const metadata: Metadata = {
  title: "原点图鉴",
  description: `逆战未来原点图鉴，查看战斗、幸运、技巧天赋树、升级消耗与解锁条件，并检索 ${runes.runes.length} 项强化与 ${affixes.affixes.length} 项武器词条。`,
  alternates: { canonical: "/origin" },
};

export default function OriginPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">原点图鉴</h1>
      </header>
      <OriginCatalogClient runes={runes} affixes={affixes} talents={talents}
        unlockedRunes={unlockedRunes} />
    </main>
  );
}
