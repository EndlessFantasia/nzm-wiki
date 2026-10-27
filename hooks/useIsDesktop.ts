"use client";

import { useSyncExternalStore } from "react";
import { isDesktopApp } from "@/lib/desktop";

const subscribe = () => () => {};

export function useIsDesktop() {
  return useSyncExternalStore(subscribe, isDesktopApp, () => false);
}
