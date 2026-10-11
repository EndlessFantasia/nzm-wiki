import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import { WeaponAttenuationChart } from "@/components/WeaponAttenuationChart";
import { WeaponDetailCard } from "@/components/WeaponCard";
import { WeaponExclusivePerks } from "@/components/WeaponExclusivePerks";
import { WeaponDetailProvider } from "@/components/WeaponDetailContext";
import { WeaponModeDiff as WeaponModeDiffTable } from "@/components/WeaponModeDiff";
import { WeaponEffectValuesPanel } from "@/components/FireRateCatalog";
import {
  WeaponSkill,
} from "@/components/WeaponSkill";
import { createNumWeaponSkillComponents } from "@/components/NumWeaponSkill";
import {
  toWeaponDetailData,
} from "@/lib/weapon-consumers";
import { mdxComponents, TableOfContents } from "@/lib/mdx-components";
import { mdxOptions } from "@/lib/mdx-options";
import { getAllPerks } from "@/lib/perks";
import {
  getResolvedWeaponBySlug,
  getResolvedWeaponDocument,
  getResolvedWeaponSlugs,
} from "@/lib/weapons";

export async function generateStaticParams() {
  return (await getResolvedWeaponSlugs("lc")).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const document = await getResolvedWeaponDocument(slug, "lc");
  const title = document?.weapon.title ?? decodeURIComponent(slug);
  return {
    title,
    description: `${title} — 逆战未来武器详情`,
    alternates: { canonical: `/weapons/${slug}` },
  };
}

const PAGE_WIDTH_CLASSES: Record<string, string> = {
  sm: "max-w-xl",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
  "3xl": "max-w-6xl",
  full: "max-w-7xl",
};

function isCustomWidth(value: string): boolean {
  return /^\d+(px|rem|em|vw|%)$/.test(value);
}

export default async function WeaponDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [document, tdWeapon] = await Promise.all([
    getResolvedWeaponDocument(slug, "lc"),
    getResolvedWeaponBySlug(slug, "td"),
  ]);
  if (!document) {
    return (
      <div className="mx-auto max-w-3xl py-6">
        <p className="text-zinc-500">武器不存在</p>
      </div>
    );
  }

  const weapon = toWeaponDetailData(document.weapon);
  const hasWeaponSkill = /<WeaponSkill(?:\s|>)/.test(document.content);
  const hasWeaponModeDiff = /<WeaponModeDiff(?:\s|\/|>)/.test(
    document.content,
  );
  const pageWidth = document.page.pageWidth;
  const customWidth = pageWidth !== undefined && isCustomWidth(pageWidth);
  const widthClass = customWidth
    ? ""
    : pageWidth && PAGE_WIDTH_CLASSES[pageWidth]
      ? PAGE_WIDTH_CLASSES[pageWidth]
      : "max-w-3xl";
  const customStyle = customWidth ? { maxWidth: pageWidth } : undefined;
  const exclusivePerks = (
    <WeaponExclusivePerks
      weaponName={document.weapon.title}
      perks={getAllPerks()}
    />
  );

  const WeaponSkillForWeapon = ({ children }: { children: ReactNode }) => (
    <>
      <WeaponSkill>{children}</WeaponSkill>
      <WeaponAttenuationChart />
      <WeaponEffectValuesPanel slug={weapon.slug} />
      {exclusivePerks}
      {hasWeaponModeDiff && tdWeapon ? (
        <WeaponModeDiffTable lcWeapon={document.weapon} tdWeapon={tdWeapon} />
      ) : null}
    </>
  );
  const GameModeForWeapon = ({
    only,
    children,
  }: {
    only: "lc" | "td";
    children: ReactNode;
  }) => (only === "lc" ? <>{children}</> : null);
  const WeaponModeDiffForWeapon = () =>
    !hasWeaponSkill && tdWeapon ? (
      <WeaponModeDiffTable lcWeapon={document.weapon} tdWeapon={tdWeapon} />
    ) : null;
  const weaponMdxComponents = {
    ...mdxComponents,
    ...createNumWeaponSkillComponents(document.weapon.skills ?? []),
    AttenuationChart: WeaponAttenuationChart,
    WeaponAttenuationChart,
    WeaponSkill: WeaponSkillForWeapon,
    GameMode: GameModeForWeapon,
    WeaponModeDiff: WeaponModeDiffForWeapon,
  };

  return (
    <WeaponDetailProvider weapon={weapon}>
      <TableOfContents enabled={document.page.toc} />
      <div
        className={`weapon-detail mx-auto ${widthClass} py-6 ${customWidth ? "max-md:max-w-full" : ""}`}
        style={customStyle}
      >
        <WeaponDetailCard />
        {!hasWeaponSkill && (
          <>
            <WeaponEffectValuesPanel slug={weapon.slug} />
            {exclusivePerks}
          </>
        )}
        {document.content.trim() && (
          <article className="prose prose-lg prose-invert mt-8 max-w-none">
            <MDXRemote
              source={document.content}
              components={weaponMdxComponents}
              options={mdxOptions}
            />
          </article>
        )}
      </div>
    </WeaponDetailProvider>
  );
}
