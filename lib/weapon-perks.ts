import { getPerkAvailability } from "@/lib/perk-release";
import type { Perk } from "@/types";

export function getWeaponExclusivePerks(
  perks: readonly Perk[],
  weaponName: string,
) {
  const online: Perk[] = [];
  const offline: Perk[] = [];

  for (const perk of perks) {
    if (!perk.weaponNames?.includes(weaponName)) continue;
    if (perk.slug.startsWith("preview/")) continue;

    const availability = getPerkAvailability(perk);
    if (availability === "online") online.push(perk);
    if (availability === "offline") offline.push(perk);
  }

  const compare = (a: Perk, b: Perk) =>
    a.slot - b.slot || a.name.localeCompare(b.name, "zh-CN");

  return { online: online.sort(compare), offline: offline.sort(compare) };
}
