"use client";

import Image, { type ImageProps } from "next/image";

// 只隐藏挂载时仍在加载的图片，避免服务端渲染的已加载图片在水合前被藏起来。
function markPending(img: HTMLImageElement | null) {
  if (img && !img.complete) img.setAttribute("data-pending", "");
}

function clearPending(img: HTMLImageElement) {
  img.removeAttribute("data-pending");
}

export function FadeInImage({ className, onLoad, onError, alt, ...props }: ImageProps) {
  return (
    <Image
      {...props}
      alt={alt}
      ref={markPending}
      className={`fade-in-image ${className ?? ""}`}
      onLoad={(event) => {
        clearPending(event.currentTarget);
        onLoad?.(event);
      }}
      onError={(event) => {
        clearPending(event.currentTarget);
        onError?.(event);
      }}
    />
  );
}
