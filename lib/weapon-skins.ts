import weaponSkinsJson from "@/data/weapon-skins.json";
import type { Rarity } from "@/types";

export interface WeaponSkinTag {
  name: string;
  detail: string;
}

export interface WeaponSkin {
  itemId: string;
  name: string;
  original: boolean;
  rarity: Rarity;
  special: boolean;
  tags: WeaponSkinTag[];
  access: string[];
  description: string;
  story: string;
}

const weaponSkins = (weaponSkinsJson as { weapons: Record<string, WeaponSkin[]> }).weapons;

export function getWeaponSkins(slug: string): WeaponSkin[] {
  return weaponSkins[slug] ?? [];
}
