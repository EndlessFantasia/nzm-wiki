import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WeaponExclusivePerks } from "./WeaponExclusivePerks";
import type { Perk } from "@/types";

const PERK: Perk = {
  id: "冷焰爆破",
  itemId: "20703040083",
  slug: "slot-4/冷焰爆破",
  name: "冷焰爆破",
  slot: 4,
  rarity: "传说",
  category: "伤害类",
  icon: "1312041001",
  effects: [],
  collectModItem: 1,
  weaponNames: ["层流冷焰"],
};

function render(perks: Perk[], weaponName = "层流冷焰") {
  return renderToStaticMarkup(
    <WeaponExclusivePerks weaponName={weaponName} perks={perks} />,
  );
}

test("omits the section when the weapon has no exclusive perks", () => {
  assert.equal(render([]), "");
  assert.equal(render([PERK], "制式手枪"), "");
});

test("online exclusives link to encoded detail URLs without an empty disclosure", () => {
  const markup = render([PERK]);
  assert.match(markup, /专属插件/);
  assert.match(markup, /4号槽/);
  assert.match(markup, new RegExp(`href="/perks/slot-4/${encodeURIComponent(PERK.name)}"`));
  assert.doesNotMatch(markup, /<details|未上线插件/);
});

test("offline-only and mixed sections keep unreleased perks in a closed disclosure", () => {
  const offline = { ...PERK, itemId: "offline", collectModItem: 0 as const };
  for (const perks of [[offline], [PERK, offline]]) {
    const markup = render(perks);
    assert.match(markup, /专属插件/);
    assert.match(markup, /未上线插件（1）/);
    assert.match(markup, /<details\b[^>]*>/);
    assert.doesNotMatch(markup, /<details\b[^>]*\bopen(?:[= >])/);
    assert.match(markup.split("<details")[1], /冷焰爆破/);
  }
});

test("icons include the deployment basePath and missing icons still preserve the link", () => {
  const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
  try {
    process.env.NEXT_PUBLIC_BASE_PATH = "/nzm-wiki";
    const imageSrc = render([PERK]).match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1];
    assert.ok(imageSrc);
    assert.match(decodeURIComponent(imageSrc), /\/nzm-wiki\/webp\/icons\/perks\/1312041001\.webp/);
    const withoutIcon = render([{ ...PERK, icon: undefined }]);
    assert.doesNotMatch(withoutIcon, /<img/);
    assert.match(withoutIcon, /冷焰爆破/);
  } finally {
    if (originalBasePath === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
  }
});
