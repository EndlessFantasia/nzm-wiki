"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { usePresence } from "@/hooks/usePresence";

interface PreviewPosition {
  left: number;
  top: number;
  placement: "above" | "below";
  originX: number;
}

interface HoverPreviewPanelProps {
  anchorRef: RefObject<HTMLElement | null>;
  id: string;
  children: ReactNode;
  widthClassName?: string;
}

// 鼠标快速划过网格时不弹出；刚关闭一个预览后再进入相邻卡片则立即显示
const OPEN_DELAY = 90;
const WARM_WINDOW = 400;
let lastClosedAt = 0;

export function HoverPreviewPanel({
  open,
  ...props
}: HoverPreviewPanelProps & { open: boolean }) {
  const [shown, setShown] = useState(false);
  const shownRef = useRef(false);
  if (!open && shown) setShown(false);

  useEffect(() => {
    if (!open) return;
    const delay = Date.now() - lastClosedAt < WARM_WINDOW ? 0 : OPEN_DELAY;
    const timer = window.setTimeout(() => {
      shownRef.current = true;
      setShown(true);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      if (shownRef.current) lastClosedAt = Date.now();
      shownRef.current = false;
    };
  }, [open]);

  const presence = usePresence(open && shown, "catalog-preview-out");
  if (!presence.mounted) return null;

  return (
    <HoverPreviewSurface
      {...props}
      state={presence.state}
      onAnimationEnd={presence.onAnimationEnd}
    />
  );
}

function HoverPreviewSurface({
  anchorRef,
  id,
  children,
  widthClassName = "w-[min(24rem,calc(100vw-2rem))]",
  state,
  onAnimationEnd,
}: HoverPreviewPanelProps & {
  state: "open" | "closed";
  onAnimationEnd: ReturnType<typeof usePresence>["onAnimationEnd"];
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PreviewPosition | null>(null);

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const preview = previewRef.current?.getBoundingClientRect();
      if (!anchor || !preview) return;

      const padding = 16;
      const gap = 10;
      const spaceBelow = window.innerHeight - anchor.bottom - padding;
      const placement =
        spaceBelow < preview.height + gap && anchor.top - padding > spaceBelow
          ? "above"
          : "below";
      const top =
        placement === "above"
          ? anchor.top - preview.height - gap
          : anchor.bottom + gap;
      const left = Math.min(
        Math.max(padding, anchor.left + anchor.width / 2 - preview.width / 2),
        Math.max(padding, window.innerWidth - preview.width - padding),
      );
      setPosition({
        placement,
        top: Math.min(
          Math.max(padding, top),
          Math.max(padding, window.innerHeight - preview.height - padding),
        ),
        left,
        originX: Math.min(
          Math.max(0, anchor.left + anchor.width / 2 - left),
          preview.width,
        ),
      });
    };

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef]);

  return createPortal(
    <div
      ref={previewRef}
      id={state === "open" ? id : undefined}
      role="tooltip"
      data-placement={position?.placement}
      data-state={state}
      onAnimationEnd={onAnimationEnd}
      className={`catalog-hover-preview pointer-events-none fixed z-[100] max-h-[calc(100dvh-2rem)] overflow-hidden rounded-lg border border-white/[0.09] bg-[#16181c] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_6px_rgba(0,0,0,0.35),0_20px_44px_-12px_rgba(0,0,0,0.7)] ${widthClassName}`}
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? "visible" : "hidden",
        transformOrigin: position
          ? `${position.originX}px ${position.placement === "above" ? "bottom" : "top"}`
          : undefined,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
