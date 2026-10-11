"use client";

import {
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Crosshair } from "lucide-react";
import { CatalogLink } from "@/components/CatalogLink";
import { HoverPreviewPanel } from "@/components/HoverPreviewPanel";
import { renderInlineDescription } from "@/components/InlineDescription";
import { SpriteIcon } from "@/components/SpriteIcon";
import { WEAPON_TYPE_SPRITES } from "@/constants/sprites";
import { getPerkWeaponApplicability } from "@/lib/perk-applicability";
import type { Perk } from "@/types";

interface PerkHoverPreviewProps {
  perk: Perk;
  href: string;
  children: ReactNode;
}

export function PerkHoverPreview({
  perk,
  href,
  children,
}: PerkHoverPreviewProps) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const {
    applicableWeaponTypes,
    exclusiveWeaponNames,
    hasUnknownWeaponTypes,
    appliesToAllWeapons,
  } = getPerkWeaponApplicability(perk.weaponType, perk.weaponNames);

  const showPreview = () => setIsOpen(true);

  const showHoverPreview = () => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }
    showPreview();
  };

  const hidePreview = () => setIsOpen(false);

  return (
    <>
      <CatalogLink
        ref={anchorRef}
        href={href}
        className="group block rounded-lg focus-visible:outline-none focus-visible:underline focus-visible:decoration-[#d1ac69] focus-visible:underline-offset-4"
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={showHoverPreview}
        onMouseLeave={hidePreview}
        onFocus={showPreview}
        onBlur={hidePreview}
        onKeyDown={(event) => {
          if (event.key === "Escape") hidePreview();
        }}
      >
        {children}
      </CatalogLink>

      {isOpen &&
        <HoverPreviewPanel anchorRef={anchorRef} id={tooltipId}>
            <div className="border-b border-white/10 px-4 py-3">
              <p className="truncate text-sm font-semibold text-white">
                {perk.name}
              </p>
            </div>

            <div className="px-4 py-3.5">
              <div className="mb-2 text-xs font-medium text-zinc-400">
                插件效果
              </div>
              <p className="whitespace-pre-line text-sm leading-6 text-zinc-200 [&_strong]:font-semibold [&_strong]:text-[#e2bd75]">
                {perk.description
                  ? renderInlineDescription(perk.description)
                  : "暂无插件效果说明"}
              </p>
            </div>

            <div className="border-t border-white/10 px-4 py-3.5">
              <div className="mb-2.5 text-xs font-medium text-zinc-400">
                适用武器
              </div>

              {appliesToAllWeapons ? (
                <span className="inline-flex items-center gap-1.5 rounded border border-[#d1ac69]/30 bg-[#d1ac69]/10 px-2.5 py-1.5 text-xs font-medium text-[#e2c38b]">
                  <Crosshair aria-hidden="true" className="h-3.5 w-3.5" />
                  全部武器类型
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {applicableWeaponTypes.map((type) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200"
                    >
                      <SpriteIcon
                        sprite={WEAPON_TYPE_SPRITES[type]}
                        size={28}
                        className="shrink-0"
                      />
                      {type}
                    </span>
                  ))}
                  {hasUnknownWeaponTypes && (
                    <span className="inline-flex items-center rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400">
                      其他武器类型
                    </span>
                  )}
                  {exclusiveWeaponNames.map((weaponName) => (
                    <span
                      key={weaponName}
                      className="inline-flex items-center gap-1.5 rounded border border-[#d1ac69]/25 bg-[#d1ac69]/10 px-2 py-1 text-xs font-medium text-[#e2c38b]"
                    >
                      <Crosshair
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      {weaponName}
                    </span>
                  ))}
                </div>
              )}
            </div>
        </HoverPreviewPanel>}
    </>
  );
}
