import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { renderInlineDescription } from "@/components/InlineDescription";
import { MultiplierProviderPanel } from "@/components/MultiplierBadges";
import { ORIGIN_RUNE_QUALITY_STYLES, type OriginRune } from "@/lib/origin-runes";
import { getAssetPath } from "@/lib/path";

export function OriginRuneDetail({ rune, tags }: { rune: OriginRune; tags: string[] }) {
  const quality = ORIGIN_RUNE_QUALITY_STYLES[rune.quality];
  const maskImage = `url("${getAssetPath(rune.icon)}")`;

  return (
    <>
      <Link href={`/origin#rune-${rune.id}`} prefetch={false}
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-zinc-400 outline-none hover:text-white focus-visible:underline focus-visible:underline-offset-4">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />返回强化图鉴
      </Link>
      <article className={`relative overflow-hidden rounded-xl border-2 ${quality.border} ${quality.bg}`}>
        <div className={`absolute inset-x-0 top-0 h-1 ${quality.dot}`} />
        <header className="flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:p-6">
          <span aria-hidden="true" className={`h-24 w-24 shrink-0 bg-current sm:h-32 sm:w-32 ${quality.text}`}
            style={{ maskImage, WebkitMaskImage: maskImage, maskSize: "contain", WebkitMaskSize: "contain",
              maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center", WebkitMaskPosition: "center" }} />
          <div className="min-w-0">
            <p className="mb-2 text-xs text-zinc-400">原点猎场 · 强化卡</p>
            <h1 className="break-words text-2xl font-bold text-white sm:text-3xl">{rune.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={`rounded border px-2 py-1 ${quality.active}`}>{quality.label}品质</span>
              {[rune.category === "special" ? "特殊强化" : "普通强化", ...tags].map((tag) => (
                <span key={tag} className="rounded border border-white/10 bg-white/5 px-2 py-1 text-zinc-200">{tag}</span>
              ))}
            </div>
          </div>
        </header>
        <section className="border-t border-white/10 px-4 py-5 sm:px-6">
          <h2 className="detail-heading mb-3 text-sm font-medium text-zinc-400">强化效果</h2>
          <div className="space-y-2 break-words text-sm leading-7 text-zinc-200 [&_strong]:font-semibold [&_strong]:text-[#e2bd75]">
            {rune.description.match(/[^。]+。?|。/g)?.map((sentence, index) => (
              <p key={index} className="whitespace-pre-line">{renderInlineDescription(sentence)}</p>
            ))}
          </div>
        </section>
        <MultiplierProviderPanel source={{ type: "origin-rune", id: rune.id }} />
      </article>
    </>
  );
}
