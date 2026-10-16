import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "伤害计算器",
  description: "逆战未来伤害计算器。",
  alternates: { canonical: "/damage" },
};

export default function DamagePage() {
  return <h1>伤害计算器</h1>;
}
