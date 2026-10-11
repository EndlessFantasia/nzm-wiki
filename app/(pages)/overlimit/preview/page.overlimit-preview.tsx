import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOverlimitCatalog, getOverlimitPreviewCatalog, getOverlimitVersions } from "@/lib/overlimit";
import { getActivePreview, getPreviewSeasonKey } from "@/lib/content-preview";
import OverlimitPageClient from "../client";

export function generateMetadata(): Metadata {
  const catalog = getOverlimitPreviewCatalog();
  return {
    title: catalog ? `${catalog.season.label} 超限图鉴` : "超限预览",
    description: catalog ? `${catalog.season.label} 超限卡片、羁绊效果及地图轮换预览，以正式上线为准。` : undefined,
    alternates: { canonical: "/overlimit/preview" },
  };
}

export default function OverlimitPreviewPage() {
  const catalog = getOverlimitPreviewCatalog();
  const preview = getActivePreview();
  if (!catalog || !preview) notFound();
  return <OverlimitPageClient basePath="/overlimit/preview" versions={getOverlimitVersions()}
    existingCardIds={getOverlimitCatalog().withdrawn ? undefined : getOverlimitCatalog().cards.map(card => card.id)}
    sourceSeason={getPreviewSeasonKey(preview)}
    season={catalog.season} initialCards={catalog.cards} bondCatalog={catalog.bonds}
    levelCatalog={catalog.levels} mapRotation={catalog.mapRotation} />;
}
