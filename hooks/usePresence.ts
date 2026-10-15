"use client";

import { useState, type AnimationEvent } from "react";

// 关闭后保留挂载，等指定的退场动画结束再卸载。
export function usePresence(open: boolean, exitAnimation: string) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  const onAnimationEnd = (event: AnimationEvent) => {
    if (!open && event.animationName === exitAnimation) setMounted(false);
  };

  return {
    mounted: open || mounted,
    state: open ? "open" : "closed",
    onAnimationEnd,
  } as const;
}
