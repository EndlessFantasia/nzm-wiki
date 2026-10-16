import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "敌人图鉴",
  description: "逆战未来敌人图鉴，按游戏模式查看塔防敌人与猎场首领。",
  alternates: { canonical: "/enemies" },
};

const ENEMY_CATEGORIES = [
  {
    title: "塔防敌人",
    description: "塔防模式中出现的各类敌人",
    href: "/enemies/td",
    available: true,
  },
  {
    title: "猎场首领",
    description: "僵尸猎场模式中出现的各类首领",
    href: "/bosses",
    available: true,
  },
];

export default function EnemiesPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">敌人图鉴</h1>
        <p className="mt-2 text-zinc-400">选择游戏模式查看对应的敌人</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ENEMY_CATEGORIES.map((category) => (
          <div key={category.title}>
            {category.available ? (
              <Link href={category.href}>
                <div className="group rounded-lg border-2 border-zinc-700 bg-zinc-800/50 p-6 transition-all hover:scale-[1.02] hover:border-zinc-500 hover:bg-zinc-800">
                  <h2 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                    {category.title}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    {category.description}
                  </p>
                  <div className="mt-4 text-sm text-blue-400">
                    查看详情 →
                  </div>
                </div>
              </Link>
            ) : (
              <div className="rounded-lg border-2 border-zinc-800 bg-zinc-900/50 p-6 opacity-60">
                <h2 className="text-xl font-bold text-zinc-500">
                  {category.title}
                </h2>
                <p className="mt-2 text-sm text-zinc-600">
                  {category.description}
                </p>
                <div className="mt-4 text-sm text-zinc-600">
                  即将推出
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
