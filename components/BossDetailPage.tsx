import { MapPinned, Skull } from "lucide-react";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getBossBySlug } from "@/lib/bosses";
import { getMDXDetail } from "@/lib/mdx";
import { mdxComponents } from "@/lib/mdx-components";
import { mdxOptions } from "@/lib/mdx-options";
import { getLcMapImagePath } from "@/lib/lc-maps";
import { getAssetPath } from "@/lib/path";
import { TableOfContents } from "@/components/TableOfContents";
import { FadeInImage } from "@/components/FadeInImage";
import { BossDetailHealth } from "@/components/BossHealth";
import type { Boss } from "@/types";

function getMaps(boss: Boss): string[] {
  return Array.isArray(boss.map) ? boss.map : [boss.map];
}

export async function BossDetailPage({ slug }: { slug: string }) {
  const boss = await getBossBySlug(slug);
  if (!boss) notFound();

  const { content, metadata } = getMDXDetail("enemies/lc/boss", slug);
  const maps = getMaps(boss);
  const mapImage = getLcMapImagePath(maps[0]);
  const showToc = metadata.toc !== false;

  return (
    <>
      <TableOfContents enabled={showToc} />
      <div className="mx-auto max-w-5xl">
        <section
          aria-labelledby="boss-title"
          className="relative isolate overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900"
        >
          {mapImage && (
            <FadeInImage
              src={getAssetPath(mapImage)}
              alt=""
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 1024px"
              className="object-cover object-center"
            />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-b from-zinc-950/45 via-zinc-950/75 to-zinc-950 md:bg-linear-to-r md:from-zinc-950/95 md:via-zinc-950/75 md:to-zinc-950/35"
          />

          <div className="relative z-10 grid min-h-[420px] gap-6 px-4 py-6 sm:px-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-center md:gap-10 md:px-10 md:py-10">
            <div className="order-2 min-w-0 md:order-1">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded border border-[#d1ac69]/45 bg-zinc-950/70 px-2.5 py-1 text-sm font-medium text-[#e1c58f] backdrop-blur-sm">
                  <Skull aria-hidden="true" className="h-4 w-4" />
                  Boss 首领
                </span>
                {maps.map((map) => (
                  <span
                    key={map}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded border border-zinc-600 bg-zinc-950/70 px-2.5 py-1 text-sm text-zinc-300 backdrop-blur-sm"
                  >
                    <MapPinned aria-hidden="true" className="h-4 w-4" />
                    {map}
                  </span>
                ))}
              </div>

              <h1
                id="boss-title"
                className="break-words text-3xl font-bold text-white drop-shadow-md sm:text-4xl"
              >
                {boss.title}
              </h1>
              {boss.nickname && (
                <p className="mt-2 text-base text-zinc-300">{boss.nickname}</p>
              )}
              {boss.description && (
                <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-200 drop-shadow-sm">
                  {boss.description}
                </p>
              )}

              <BossDetailHealth boss={boss} />
            </div>

            <div className="order-1 flex justify-center md:order-2 md:justify-end">
              <div className="relative aspect-square w-full max-w-72 overflow-hidden rounded-lg border border-zinc-600 bg-zinc-950/75 shadow-2xl shadow-black/40">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(209,172,105,0.2),_transparent_70%)]"
                />
                <div className="absolute inset-4">
                  <FadeInImage
                    src={getAssetPath(
                      `/icons/enemies/lc/boss/${boss.slug}.png`,
                    )}
                    alt={boss.title}
                    fill
                    priority
                    sizes="256px"
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {content.trim() && (
          <article className="prose prose-lg prose-invert mx-auto mt-10 max-w-4xl">
            <MDXRemote
              source={content}
              components={mdxComponents}
              options={mdxOptions}
            />
          </article>
        )}
      </div>
    </>
  );
}
