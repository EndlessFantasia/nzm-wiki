"use client";

import { useId, useRef, useState } from "react";
import { FadeInImage } from "@/components/FadeInImage";
import { HoverPreviewPanel } from "@/components/HoverPreviewPanel";
import { ImageViewer } from "@/components/ImageViewer";
import { RARITY_CARD_STYLES, RARITY_KEY_MAP } from "@/constants/common";
import { getAssetPath } from "@/lib/path";
import type { WeaponSkin } from "@/lib/weapon-skins";

const getWeaponSkinIcon = (skin: WeaponSkin) => `/icons/weapon-skins/${skin.itemId}.png`;

function shortName(skin: WeaponSkin) {
  if (skin.original) return "原皮";
  const index = skin.name.indexOf("-");
  return index > 0 ? skin.name.slice(index + 1) : skin.name;
}

function PreviewSegment({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5">
      <div className="mb-2 text-xs font-medium text-zinc-400">{label}</div>
      {children}
    </div>
  );
}

function WeaponSkinCard({ skin, onOpen }: { skin: WeaponSkin; onOpen: () => void }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const rarityText = RARITY_CARD_STYLES[RARITY_KEY_MAP[skin.rarity]].text;
  const story = skin.story !== skin.description ? skin.story : "";

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={onOpen}
        aria-label={`查看 ${skin.name} 大图`}
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={() => {
          if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) setIsOpen(true);
        }}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
        }}
        className="group block w-full text-left focus-visible:outline-none"
      >
        <span className="detail-panel flex flex-col overflow-hidden rounded-lg border transition-colors group-hover:border-white/20 group-hover:bg-white/[0.06]">
          <span className="relative block aspect-[8/3] w-full">
            <FadeInImage
              src={getAssetPath(getWeaponSkinIcon(skin))}
              alt=""
              fill
              sizes="(min-width: 640px) 190px, 45vw"
              className="object-contain p-1.5"
            />
          </span>
          <span className="flex h-5 items-center gap-1.5 px-2.5 pb-2 leading-5 box-content">
            <span
              className={`min-w-0 truncate text-xs underline-offset-4 group-focus-visible:underline ${
                skin.original ? "text-zinc-400" : "text-zinc-200"
              }`}
            >
              {shortName(skin)}
            </span>
            {skin.tags[0] && (
              <span className="ml-auto shrink-0 text-[11px] text-[#e2c38b]">{skin.tags[0].name}</span>
            )}
          </span>
        </span>
      </button>

      <HoverPreviewPanel
        open={isOpen}
        anchorRef={anchorRef}
        id={tooltipId}
        widthClassName="w-[min(26rem,calc(100vw-2rem))]"
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-white/[0.08] bg-white/[0.025] px-4 py-3">
          <p className="min-w-0 truncate text-sm font-semibold text-white">{skin.name}</p>
          <span className={`text-xs font-medium ${rarityText}`}>{skin.rarity}</span>
          {skin.tags.map((tag) => (
            <span
              key={tag.name}
              className="inline-flex items-center rounded border border-[#d1ac69]/25 bg-[#d1ac69]/10 px-2 py-0.5 text-xs font-medium text-[#e2c38b]"
            >
              {tag.name}
            </span>
          ))}
        </div>
        <div className="divide-y divide-white/10">
          {skin.access.length > 0 && (
            <PreviewSegment label="获取途径">
              <div className="flex flex-wrap gap-1.5">
                {skin.access.map((access) => (
                  <span
                    key={access}
                    className="inline-flex items-center rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200"
                  >
                    {access}
                  </span>
                ))}
              </div>
            </PreviewSegment>
          )}
          {skin.description && (
            <PreviewSegment label="简介">
              <p className="text-sm leading-6 text-zinc-200">{skin.description}</p>
            </PreviewSegment>
          )}
          {story && (
            <PreviewSegment label="背景故事">
              <p className="line-clamp-[8] whitespace-pre-line text-sm leading-6 text-zinc-300">{story}</p>
            </PreviewSegment>
          )}
        </div>
      </HoverPreviewPanel>
    </>
  );
}

export function WeaponSkins({ skins }: { skins: WeaponSkin[] }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  if (skins.length === 0) return null;

  return (
    <section aria-labelledby="weapon-skins" className="not-prose mt-6 space-y-3">
      <h2 id="weapon-skins" className="detail-heading text-sm font-semibold text-zinc-300">
        涂装
        <span className="detail-muted ml-2 text-xs font-normal">{skins.length - 1} 款</span>
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {skins.map((skin, index) => (
          <li key={skin.itemId} className="min-w-0">
            <WeaponSkinCard skin={skin} onOpen={() => setViewerIndex(index)} />
          </li>
        ))}
      </ul>
      {viewerIndex !== null && (
        <ImageViewer
          images={skins.map((skin) => ({ src: getWeaponSkinIcon(skin), alt: skin.name }))}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </section>
  );
}
