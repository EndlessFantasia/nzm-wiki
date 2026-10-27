"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { DESKTOP_SETTINGS_PATH } from "@/lib/desktop";

export default function DesktopSettingsButton() {
  const isDesktop = useIsDesktop();
  if (!isDesktop) return null;

  return (
    <Link
      href={DESKTOP_SETTINGS_PATH}
      aria-label="桌面端设置"
      title="桌面端设置"
      className="flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline"
    >
      <Settings aria-hidden="true" className="h-4 w-4" />
    </Link>
  );
}
