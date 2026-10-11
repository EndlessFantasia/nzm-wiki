import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import { WeaponAttenuationChart } from "@/components/WeaponAttenuationChart";
import { WeaponDetailCard } from "@/components/WeaponCard";
import { WeaponDetailProvider } from "@/components/WeaponDetailContext";
import { WeaponModeDiff as WeaponModeDiffTable } from "@/components/WeaponModeDiff";
import { MultiplierProviderPanel } from "@/components/MultiplierBadges";
import {
  WeaponSkill,
} from "@/components/WeaponSkill";
import { createNumWeaponSkillComponents } from "@/components/NumWeaponSkill";
import {
  toWeaponDetailData,
} from "@/lib/weapon-consumers";
import { mdxComponents, TableOfContents } from "@/lib/mdx-components";
import { mdxOptions } from "@/lib/mdx-options";
import {
  getResolvedWeaponBySlug,
  getResolvedWeaponDocument,
  getResolvedWeaponSlugs,
} from "@/lib/weapons";

export async function generateStaticParams() {
  return (await getResolvedWeaponSlugs("td")).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const document = await getResolvedWeaponDocument(slug, "td");
  const title = document?.weapon.title ?? decodeURIComponent(slug);
  return {
    title: `${title}（塔防）`,
    description: `${title} — 逆战未来塔防武器详情`,
    alternates: { canonical: `/weapons/td/${slug}` },
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

export default async function TDWeaponDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [document, lcWeapon] = await Promise.all([
    getResolvedWeaponDocument(slug, "td"),
    getResolvedWeaponBySlug(slug, "lc"),
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

  const WeaponSkillForWeapon = ({ children }: { children: ReactNode }) => (
    <>
      <WeaponSkill>{children}</WeaponSkill>
      <WeaponAttenuationChart />
      <MultiplierProviderPanel
        source={{ type: "weapon", slug: weapon.slug }}
        className="not-prose mt-4 rounded-xl border border-zinc-700 bg-zinc-900/60"
      />
      {hasWeaponModeDiff && lcWeapon ? (
        <WeaponModeDiffTable lcWeapon={lcWeapon} tdWeapon={document.weapon} />
      ) : null}
    </>
  );
  const GameModeForWeapon = ({
    only,
    children,
  }: {
    only: "lc" | "td";
    children: ReactNode;
  }) => (only === "td" ? <>{children}</> : null);
  const WeaponModeDiffForWeapon = () =>
    !hasWeaponSkill && lcWeapon ? (
      <WeaponModeDiffTable lcWeapon={lcWeapon} tdWeapon={document.weapon} />
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
        className={`mx-auto ${widthClass} py-6 ${customWidth ? "max-md:max-w-full" : ""}`}
        style={customStyle}
      >
        <WeaponDetailCard />
        {!hasWeaponSkill && (
          <MultiplierProviderPanel
            source={{ type: "weapon", slug: weapon.slug }}
            className="mt-4 rounded-xl border border-zinc-700 bg-zinc-900/60"
          />
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
