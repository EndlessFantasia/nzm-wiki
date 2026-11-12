import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { stripInlineDescriptionMarkup } from "@/components/InlineDescription";
import { OriginRuneDetail } from "@/components/OriginRuneDetail";
import { ORIGIN_RUNE_CATALOG, getOriginRuneById } from "@/lib/origin-rune-catalog";
import { getOriginRuneHref } from "@/lib/origin-runes";

export const dynamicParams = false;

export function generateStaticParams() {
  return ORIGIN_RUNE_CATALOG.runes.map((rune) => ({ id: rune.id }));
}

export async function generateMetadata({ params }: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const rune = getOriginRuneById((await params).id);
  if (!rune) notFound();
  return {
    title: `${rune.name} · 原点强化`,
    description: `${rune.name} — ${stripInlineDescriptionMarkup(rune.description)}`,
    alternates: { canonical: getOriginRuneHref(rune.id) },
  };
}

export default async function OriginRunePage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const rune = getOriginRuneById((await params).id);
  if (!rune) notFound();
  const tags = ORIGIN_RUNE_CATALOG.tags
    .filter((tag) => rune.tagIds.includes(tag.id))
    .map((tag) => tag.name);

  return <div className="mx-auto max-w-3xl py-6"><OriginRuneDetail rune={rune} tags={tags} /></div>;
}
