"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Minus, Plus, Download, Maximize2 } from "lucide-react";
import { getAssetPath } from "@/lib/path";

interface TooltipButtonProps {
  onClick: () => void;
  tooltip: string;
  children: React.ReactNode;
  className?: string;
  tooltipPosition?: "top" | "bottom";
}

function TooltipButton({ onClick, tooltip, children, className = "", tooltipPosition = "top" }: TooltipButtonProps) {
  const tooltipClass = tooltipPosition === "top"
    ? "bottom-full mb-2"
    : "top-full mt-2";

  return (
    <div className="relative group">
      <button
        type="button"
        aria-label={tooltip}
        onClick={onClick}
        className={className}
      >
        {children}
      </button>
      <div className={`absolute left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-zinc-200 bg-zinc-900 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${tooltipClass}`}>
        {tooltip}
      </div>
    </div>
  );
}

interface ImageViewerProps {
  images: { src: string; pngSrc?: string; alt?: string }[];
  initialIndex?: number;
  onClose: () => void;
}

export function ImageViewer({ images, initialIndex = 0, onClose: onClosed }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(100);
  const [closing, setClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentImage = images[currentIndex];

  // 先播放退场动画，结束后再通知父组件卸载
  const onClose = useCallback(() => setClosing(true), []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
          break;
        case "ArrowRight":
        case "d":
        case "D":
          setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
          break;
        case "-":
          setScale((prev) => Math.max(25, prev - 25));
          break;
        case "=":
        case "+":
          setScale((prev) => Math.min(400, prev + 25));
          break;
        case "1":
          setScale(100);
          break;
        case "2":
          setScale(200);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [images.length, onClose]);

  // Mouse wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -25 : 25;
      setScale((prev) => Math.max(25, Math.min(400, prev + delta)));
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
    }

    // Also prevent wheel on the whole viewer
    const handleGlobalWheel = (e: WheelEvent) => {
      e.preventDefault();
    };

    document.addEventListener("wheel", handleGlobalWheel, { passive: false });

    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel);
      }
      document.removeEventListener("wheel", handleGlobalWheel);
    };
  }, []);

  // Prevent body scroll when open
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, []);

  // Handle fullscreen
  const handleFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      elem.requestFullscreen?.();
    }
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(25, prev - 25));
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(400, prev + 25));
  }, []);

  const handleReset = useCallback(() => {
    setScale(100);
  }, []);

  const handleDownload = useCallback(() => {
    const downloadSrc = currentImage.pngSrc || currentImage.src;
    const link = document.createElement("a");
    link.href = getAssetPath(downloadSrc);
    link.download = downloadSrc.split("/").pop() || "image";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentImage]);

  const btnClass = "rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors";

  return createPortal(
    <div
      ref={containerRef}
      data-state={closing ? "closed" : "open"}
      inert={closing}
      onAnimationEnd={(e) => {
        if (closing && e.animationName === "image-viewer-out") onClosed();
      }}
      className="image-viewer fixed inset-0 z-[200] flex items-center justify-center bg-black/90 overflow-hidden"
    >
      {/* Close button */}
      <div className="absolute top-4 right-4">
        <TooltipButton
          onClick={onClose}
          tooltip="关闭 (Esc)"
          tooltipPosition="bottom"
          className="rounded-lg bg-zinc-800 p-2 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </TooltipButton>
      </div>

      {/* Main image */}
      <div
        className="image-viewer-stage flex items-center justify-center overflow-hidden"
        style={{ width: "calc(100% - 80px)", height: "calc(100% - 120px)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Native img preserves direct CSS zoom behavior for the full-resolution viewer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={currentIndex}
          src={getAssetPath(currentImage.src)}
          alt={currentImage.alt || ""}
          className="image-viewer-image max-h-full max-w-full object-contain transition-transform duration-200"
          style={{ transform: `scale(${scale / 100})` }}
          draggable={false}
        />
      </div>

      {/* Side navigation (for larger screens) */}
      {images.length > 1 && (
        <>
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <TooltipButton
              onClick={handlePrev}
              tooltip="上一张 (A / ←)"
              className="rounded-lg bg-zinc-800/80 p-3 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </TooltipButton>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <TooltipButton
              onClick={handleNext}
              tooltip="下一张 (D / →)"
              className="rounded-lg bg-zinc-800/80 p-3 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </TooltipButton>
          </div>
        </>
      )}

      {/* Bottom toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-lg bg-zinc-800 px-2 py-1.5 shadow-lg">
        {/* Navigation arrows */}
        <TooltipButton onClick={handlePrev} tooltip="上一张 (A / ←)" className={btnClass}>
          <ChevronLeft className="h-5 w-5" />
        </TooltipButton>
        <TooltipButton onClick={handleNext} tooltip="下一张 (D / →)" className={btnClass}>
          <ChevronRight className="h-5 w-5" />
        </TooltipButton>

        <div className="mx-1 h-6 w-px bg-zinc-600" />

        {/* Zoom controls */}
        <TooltipButton onClick={handleZoomOut} tooltip="缩小 (-)" className={btnClass}>
          <Minus className="h-5 w-5" />
        </TooltipButton>
        <TooltipButton
          onClick={handleReset}
          tooltip="1=100%, 2=200%"
          className="min-w-[60px] rounded px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
        >
          {scale}%
        </TooltipButton>
        <TooltipButton onClick={handleZoomIn} tooltip="放大 (+)" className={btnClass}>
          <Plus className="h-5 w-5" />
        </TooltipButton>

        <div className="mx-1 h-6 w-px bg-zinc-600" />

        {/* Download */}
        <TooltipButton onClick={handleDownload} tooltip="下载原图" className={btnClass}>
          <Download className="h-5 w-5" />
        </TooltipButton>

        {/* Fullscreen */}
        <TooltipButton onClick={handleFullscreen} tooltip="全屏" className={btnClass}>
          <Maximize2 className="h-5 w-5" />
        </TooltipButton>

        <div className="mx-1 h-6 w-px bg-zinc-600" />

        {/* Image counter */}
        <span className="px-2 text-sm text-zinc-400">
          {currentIndex + 1} / {images.length}
        </span>
      </div>
    </div>,
    document.body,
  );
}
