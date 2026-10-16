import type { Metadata } from "next";
import { getAllTraps } from "@/lib/traps";
import TrapsClient from "./client";

export const metadata: Metadata = {
  title: "陷阱图鉴",
  description: "逆战未来塔防陷阱图鉴，收录各陷阱的属性与效果。",
  alternates: { canonical: "/traps" },
};

export default async function TrapsPage() {
  const traps = await getAllTraps();
  return <TrapsClient traps={traps} />;
}
