import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPerkPreviewCatalog } from "@/lib/perk-preview";
import { getShanghaiDateKey } from "@/lib/date-key";
import PerksPageClient from "../client";

export function generateMetadata(): Metadata {
  const catalog = getPerkPreviewCatalog();
  return {
    title: catalog ? `${catalog.season.label} 插件图鉴` : "插件预览",
    description: catalog ? `${catalog.season.label} 插件效果与独立伤害预览，以正式上线为准。` : undefined,
    alternates: { canonical: "/perks/preview" },
  };
}

export default function PerksPreviewPage() {
  const catalog = getPerkPreviewCatalog();
  if (!catalog) notFound();
  return (
    <PerksPageClient
      channel="preview"
      previewLabel={catalog.season.label}
      initialPerks={catalog.entries.map(entry => entry.perk)}
      initialDateKey={getShanghaiDateKey()}
    />
  );
}
