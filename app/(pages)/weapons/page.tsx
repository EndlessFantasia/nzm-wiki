import type { Metadata } from "next";
import { Suspense } from "react";
import { toWeaponCatalogEntry } from "@/lib/weapon-consumers";
import { getAllResolvedWeapons } from "@/lib/weapons";
import WeaponsClient from "./client";

export const metadata: Metadata = {
  title: "武器图鉴",
  description: "逆战未来僵尸猎场与塔防武器图鉴，按模式、类型、稀有度和元素筛选武器。",
  alternates: { canonical: "/weapons" },
};

export default async function WeaponsPage() {
  const [lcResolved, tdResolved] = await Promise.all([
    getAllResolvedWeapons("lc"),
    getAllResolvedWeapons("td"),
  ]);
  const lcWeapons = lcResolved.map(toWeaponCatalogEntry);
  const tdWeapons = tdResolved.map(toWeaponCatalogEntry);

  return (
    <Suspense>
      <WeaponsClient weapons={lcWeapons} tdWeapons={tdWeapons} />
    </Suspense>
  );
}
