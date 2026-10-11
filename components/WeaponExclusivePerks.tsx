import Image from "next/image";
import { PerkHoverPreview } from "@/components/PerkHoverPreview";
import { getAssetPath } from "@/lib/path";
import { getWeaponExclusivePerks } from "@/lib/weapon-perks";
import { getPerkAvailability } from "@/lib/perk-release";
import type { Perk } from "@/types";

function PerkLinks({ perks }: { perks: Perk[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {perks.map((perk) => {
        const offline = getPerkAvailability(perk) === "offline";
        return (
          <li key={perk.itemId} className="max-w-full min-w-0">
            <PerkHoverPreview
              perk={perk}
              href={`/perks/${perk.slug.split("/").map(encodeURIComponent).join("/")}`}
            >
              <span className="detail-panel detail-perk flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 transition-colors group-hover:border-white/20 group-hover:bg-white/[0.06]">
                {perk.icon ? (
                  <Image
                    src={getAssetPath(`/webp/icons/perks/${perk.icon}.webp`)}
                    alt=""
                    width={28}
                    height={28}
                    className={`h-7 w-7 shrink-0 object-contain${offline ? " grayscale opacity-50" : ""}`}
                  />
                ) : null}
                <span className="min-w-0 text-sm font-medium text-zinc-200 [overflow-wrap:anywhere]">
                  {perk.name}
                  {offline && <span className="sr-only">（未上线）</span>}
                </span>
                <span className="detail-muted shrink-0 border-l border-white/10 pl-2 text-xs text-zinc-400">
                  {perk.slot}号槽
                </span>
              </span>
            </PerkHoverPreview>
          </li>
        );
      })}
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
      <h2 id="weapon-exclusive-perks" className="detail-heading text-sm font-semibold text-zinc-300">
        专属插件
      </h2>
      <PerkLinks perks={[...online, ...offline]} />
    </section>
  );
}
