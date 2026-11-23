import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  HUNTING_TACTICAL_SKILLS,
  HUNTING_TACTICAL_SKILLS_PATH,
  STARSHIP_TACTICAL_ITEMS,
} from "@/lib/hunting-tactical-skills";
import { NUM_MODIFIER_RESOLVER } from "@/lib/num-modifier-data";
import { getAssetPath } from "@/lib/path";

export function HuntingTacticalSkillCatalog({
  section = "skills",
}: {
  section?: "skills" | "starship";
}) {
  const isStarship = section === "starship";
  const entries = isStarship ? STARSHIP_TACTICAL_ITEMS : HUNTING_TACTICAL_SKILLS;
  const CardHeading = isStarship ? "h3" : "h2";

  return (
    <div className="not-prose mx-auto max-w-6xl pb-10">
      {isStarship && (
        <h2
          id="星舰战术道具"
          className="mb-5 scroll-mt-20 text-2xl font-semibold text-zinc-100"
        >
          星舰战术道具
        </h2>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((skill) => (
          <article
            key={skill.id}
            className={`relative flex min-h-40 gap-4 rounded-lg border border-zinc-700 bg-zinc-900/70 p-4 sm:p-5 ${isStarship ? "hover:border-zinc-500" : ""}`}
          >
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-600 bg-zinc-950">
              <Image
                src={getAssetPath(skill.icon)}
                alt=""
                fill
                sizes="64px"
                className="object-contain p-1"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardHeading className="text-lg font-semibold leading-7 text-zinc-100">
                  {"slug" in skill ? (
                    <Link
                      href={`${HUNTING_TACTICAL_SKILLS_PATH}/${skill.slug}`}
                      className="inline-flex items-center gap-2 after:absolute after:inset-0 focus-visible:underline focus-visible:underline-offset-4 focus-visible:outline-none"
                    >
                      {skill.name}
                      <ArrowRight aria-hidden="true" className="size-4 text-zinc-400" />
                    </Link>
                  ) : skill.name}
                </CardHeading>
                {"availability" in skill && skill.availability === "limited" && (
                  <span className="inline-flex min-h-7 items-center rounded border border-amber-400/50 bg-amber-400/10 px-2 py-1 text-xs font-semibold text-amber-200">
                    限时
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                {skill.description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function StarshipTacticalItemIntro({ slug }: { slug: string }) {
  const item = STARSHIP_TACTICAL_ITEMS.find((entry) => entry.slug === slug);
  if (!item) throw new Error(`未知星舰战术道具 ${slug}`);

  return (
    <div className="not-prose">
      <Link
        href={`${HUNTING_TACTICAL_SKILLS_PATH}#星舰战术道具`}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-zinc-300 hover:underline focus-visible:underline focus-visible:underline-offset-4 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        返回星舰战术道具
      </Link>
      <div className="mt-2 flex items-center gap-4 rounded-lg border border-zinc-700 bg-zinc-900/70 p-4">
        <Image
          src={getAssetPath(item.icon)}
          alt=""
          width={64}
          height={64}
          className="size-16 shrink-0 rounded-md border border-zinc-600 bg-zinc-950 p-1"
        />
        <p className="text-sm leading-6 text-zinc-200">{item.description}</p>
      </div>
    </div>
  );
}

export function StarshipEmpVulnerability() {
  const effect = NUM_MODIFIER_RESOLVER.resolveEffect(
    { row: "lc:19010021_1_0", field: "base" },
    { recipient: "enemy" },
    "星舰战术道具/电磁脉冲弹",
  );
  return <>{(-effect.value.value).toLocaleString("zh-CN", { style: "percent" })}</>;
}
