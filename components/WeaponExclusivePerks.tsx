import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { PerkHoverPreview } from "@/components/PerkHoverPreview";
import { getAssetPath } from "@/lib/path";
import { getWeaponExclusivePerks } from "@/lib/weapon-perks";
import type { Perk } from "@/types";

function PerkLinks({ perks }: { perks: Perk[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {perks.map((perk) => (
        <li key={perk.itemId} className="max-w-full min-w-0">
          <PerkHoverPreview
            perk={perk}
            href={`/perks/${perk.slug.split("/").map(encodeURIComponent).join("/")}`}
          >
            <span className="flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 transition-colors group-hover:border-white/20 group-hover:bg-white/[0.06]">
              {perk.icon ? (
                <Image
                  src={getAssetPath(`/webp/icons/perks/${perk.icon}.webp`)}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 object-contain"
                />
              ) : null}
              <span className="min-w-0 text-sm font-medium text-zinc-200 [overflow-wrap:anywhere]">
                {perk.name}
              </span>
              <span className="shrink-0 border-l border-white/10 pl-2 text-xs text-zinc-400">
                {perk.slot}号槽
              </span>
            </span>
          </PerkHoverPreview>
        </li>
      ))}
    </ul>
  );
}

export function WeaponExclusivePerks({
  weaponName,
  perks,
}: {
  weaponName: string;
  perks: Perk[];
}) {
  const { online, offline } = getWeaponExclusivePerks(perks, weaponName);
  if (online.length === 0 && offline.length === 0) return null;

  return (
    <section aria-labelledby="weapon-exclusive-perks" className="not-prose mt-6 space-y-3">
      <h2 id="weapon-exclusive-perks" className="text-sm font-semibold text-zinc-300">
        专属插件
      </h2>
      {online.length > 0 && <PerkLinks perks={online} />}
      {offline.length > 0 && (
        <details className="group/offline">
          <summary className="flex min-h-11 w-fit max-w-full cursor-pointer list-none items-center gap-1.5 rounded text-sm text-zinc-400 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 [&::-webkit-details-marker]:hidden">
            <ChevronDown
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 transition-transform group-open/offline:rotate-180 motion-reduce:transition-none"
            />
            未上线插件（{offline.length}）
          </summary>
          <div className="pt-2">
            <PerkLinks perks={offline} />
          </div>
        </details>
      )}
    </section>
  );
}
