import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OverlimitCardDetail } from "@/components/OverlimitCardDetail";
import { OverlimitVersionNavigation } from "@/components/OverlimitVersionNavigation";
import { stripInlineDescriptionMarkup } from "@/components/InlineDescription";
import { IndependentDamagePanel } from "@/components/TriggerDamageCatalog";
import { getOverlimitPreviewCatalog, getOverlimitVersions } from "@/lib/overlimit";
import { getActivePreview, getPreviewSeasonKey } from "@/lib/content-preview";

export function generateStaticParams() {
  return getOverlimitPreviewCatalog()?.cards.map(card => ({ id: card.id })) ?? [];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const catalog = getOverlimitPreviewCatalog();
  const card = catalog?.cards.find(card => card.id === id);
  if (!card || !catalog) return {};
  return { title: `${card.name} · ${catalog.season.label}`,
    description: `${catalog.season.label} — ${stripInlineDescriptionMarkup(card.description)}`,
    alternates: { canonical: `/overlimit/preview/${id}` } };
}

export default async function PreviewCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const catalog = getOverlimitPreviewCatalog();
  const card = catalog?.cards.find(card => card.id === id);
  const preview = getActivePreview();
  if (!card || !catalog || !preview) notFound();
  return <div className="mx-auto max-w-4xl py-6">
    <OverlimitVersionNavigation versions={getOverlimitVersions()} activePath="/overlimit/preview" />
    <p className="mb-4 text-sm text-zinc-400">
      <Link href="/overlimit/preview" className="hover:text-white focus-visible:underline">{catalog.season.label} 超限图鉴</Link>
      <span> · 预下载内容，以正式上线为准</span>
    </p>
    <OverlimitCardDetail card={card} sourceSeason={getPreviewSeasonKey(preview)} />
    {(catalog.independentDamage[id] ?? []).map(entry => <IndependentDamagePanel key={`${entry.name}-${entry.numericalId}`} entry={entry} />)}
  </div>;
}
