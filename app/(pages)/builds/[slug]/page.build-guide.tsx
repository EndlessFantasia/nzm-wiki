import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { BuildGuideDetail } from "@/components/build-guides/BuildGuideView";
import {
  getAllBuildGuides,
  getBuildGuideBySlug,
} from "@/lib/build-guides";
import { mdxComponents, TableOfContents } from "@/lib/mdx-components";
import { mdxOptions } from "@/lib/mdx-options";

export const dynamicParams = false;
export const dynamic = "force-static";

export async function generateStaticParams() {
  return (await getAllBuildGuides()).map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getBuildGuideBySlug(slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.summary,
    alternates: { canonical: `/builds/${guide.slug}` },
  };
}

export default async function BuildGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = await getBuildGuideBySlug(slug);
  if (!guide) notFound();

  return (
    <>
      <TableOfContents enabled={guide.content.trim().length > 0} />
      <BuildGuideDetail guide={guide} />
      {guide.content.trim() && (
        <article className="prose prose-lg prose-invert mx-auto max-w-4xl border-t border-zinc-700 py-8 sm:py-10">
          <MDXRemote
            source={guide.content}
            components={mdxComponents}
            options={mdxOptions}
          />
        </article>
      )}
    </>
  );
}
