import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OverlimitCardDetail } from "@/components/OverlimitCardDetail";
import { stripInlineDescriptionMarkup } from "@/components/InlineDescription";
import { IndependentDamagePanel } from "@/components/TriggerDamageCatalog";
import {
  getAllOverlimitCards,
  getOverlimitCardById,
} from "@/lib/overlimit-cards";
import { getOverlimitCatalog, getOverlimitVersions } from "@/lib/overlimit";
import { OverlimitVersionNavigation } from "@/components/OverlimitVersionNavigation";

const cards = getAllOverlimitCards();

export function generateStaticParams() {
  return cards.map((card) => ({ id: card.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const card = getOverlimitCardById(id);
  if (!card) return {};

  return {
    title: card.name,
    description: `${card.name} — ${stripInlineDescriptionMarkup(card.description)}`,
    alternates: { canonical: `/overlimit/${card.id}` },
  };
}

export default async function OverlimitCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = getOverlimitCardById(id);
  if (!card) notFound();
  const independentDamage = getOverlimitCatalog().independentDamage[id] ?? [];

  return (
    <div className="mx-auto max-w-4xl py-6">
      <OverlimitVersionNavigation versions={getOverlimitVersions()} activePath="/overlimit" />
      <OverlimitCardDetail card={card} />
      {independentDamage.map((entry) => (
        <IndependentDamagePanel
          key={`${entry.name}-${entry.numericalId}`}
          entry={entry}
        />
      ))}
    </div>
  );
}
