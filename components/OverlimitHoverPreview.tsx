"use client";

import {
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CatalogLink } from "@/components/CatalogLink";
import { HoverPreviewPanel } from "@/components/HoverPreviewPanel";
import { OverlimitWeaponApplicability } from "@/components/OverlimitCardMeta";
import type { OverlimitCard } from "@/types";

export function OverlimitHoverPreview({
  card,
  href,
  children,
}: {
  card: OverlimitCard;
  href: string;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const showPreview = () => setIsOpen(true);
  const hidePreview = () => setIsOpen(false);

  return (
    <>
      <CatalogLink
        ref={anchorRef}
        href={href}
        className="group block h-full rounded-lg outline-none focus-visible:[&_h3]:underline focus-visible:[&_h3]:decoration-2 focus-visible:[&_h3]:underline-offset-4"
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={() => {
          if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
            showPreview();
          }
        }}
        onMouseLeave={hidePreview}
        onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) showPreview(); }}
        onBlur={hidePreview}
        onKeyDown={(event) => {
          if (event.key === "Escape") hidePreview();
        }}
      >
        {children}
      </CatalogLink>

      {(card.weight !== undefined || card.applicabilityKnown !== false) &&
        <HoverPreviewPanel open={isOpen} anchorRef={anchorRef} id={tooltipId} widthClassName="w-[min(13rem,calc(100vw-2rem))]">
            {card.weight !== undefined && <div className="flex items-center justify-between gap-3 px-2 py-3">
              <div className="text-xs font-medium text-zinc-400">
                抽取权重
              </div>
              <strong className="text-sm font-semibold tabular-nums text-[#e2c38b]">
                {card.weight}
              </strong>
            </div>}
            {card.applicabilityKnown !== false && <div className="border-t border-white/10 px-2 py-3">
              <div className="mb-2.5 text-xs font-medium text-zinc-400">
                适用武器
              </div>
              <OverlimitWeaponApplicability
                weaponType={card.weaponType}
                weaponNames={card.weaponNames}
                compact
              />
            </div>}
        </HoverPreviewPanel>}
    </>
  );
}
