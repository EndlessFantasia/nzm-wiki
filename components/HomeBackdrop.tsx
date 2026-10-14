"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { getAssetPath } from "@/lib/path";

// S4 新地图：朔望计划、禁魔岛
const BACKDROP_IMAGES = [
  "/webp/images/overlimit/maps/T_Bg_Loading_72.webp",
  "/webp/images/overlimit/maps/T_Bg_Loading_73.webp",
];

const clientPick = Math.floor(Math.random() * BACKDROP_IMAGES.length);
const subscribe = () => () => {};

export function HomeBackdrop() {
  const pick = useSyncExternalStore(subscribe, () => clientPick, () => -1);
  const [loaded, setLoaded] = useState(false);

  return (
    <div aria-hidden="true" className="home-backdrop">
      {pick >= 0 && (
        <Image
          src={getAssetPath(BACKDROP_IMAGES[pick])}
          alt=""
          fill
          sizes="100vw"
          priority
          data-loaded={loaded || undefined}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}
