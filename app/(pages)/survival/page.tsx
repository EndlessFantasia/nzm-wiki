import type { Metadata } from "next";
import { SURVIVAL_CODEX } from "@/lib/survival-codex";
import SurvivalCodexClient from "./client";

const { skills, passives, specials, rules } = SURVIVAL_CODEX;

export const metadata: Metadata = {
  title: "生存战图鉴",
  description: `逆战未来时空猎场生存战图鉴，查看 ${skills.length} 个主动技能的升级路线与终极进化、${passives.length} 条被动增益和 ${specials.length} 个特殊增益。`,
  alternates: { canonical: "/survival" },
};

export default function SurvivalPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold text-white">生存战图鉴</h1>
        <p className="text-sm leading-6 text-zinc-400">
          最多同时携带 {rules.maxActiveSkillTypes} 种主动技能、{rules.maxPassiveBuffTypes} 种被动增益。主动技能升到 V 级并持有配套被动后，有机会进化为终极技能。
        </p>
      </header>
      <SurvivalCodexClient codex={SURVIVAL_CODEX} />
    </main>
  );
}
