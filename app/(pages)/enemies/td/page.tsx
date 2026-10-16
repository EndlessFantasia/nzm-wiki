import type { Metadata } from "next";
import { getAllTDEnemies, tdEnemyToEnemy } from "@/lib/td-enemies";
import TDEnemiesClient from "./client";

export const metadata: Metadata = {
  title: "塔防敌人图鉴",
  description: "逆战未来塔防模式敌人图鉴，收录各敌人的属性资料。",
  alternates: { canonical: "/enemies/td" },
};

export default async function TDEnemiesPage() {
  const enemies = await getAllTDEnemies();
  const converted = enemies.map(tdEnemyToEnemy);
  return <TDEnemiesClient enemies={converted} />;
}
