"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  DESKTOP_APP_UPDATE_EVENT,
  DESKTOP_SETTINGS_PATH,
  invokeDesktop,
  type DesktopSettingsState,
} from "@/lib/desktop";

// 有桌面端新版本时在齿轮上标一个点
function useAppUpdateAvailable(isDesktop: boolean) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;
    let active = true;
    invokeDesktop<DesktopSettingsState>("get_settings_state")
      .then((settings) => {
        if (active && settings.appUpdate) setAvailable(true);
      })
      .catch(() => {});
    const onAvailable = () => setAvailable(true);
    window.addEventListener(DESKTOP_APP_UPDATE_EVENT, onAvailable);
    return () => {
      active = false;
      window.removeEventListener(DESKTOP_APP_UPDATE_EVENT, onAvailable);
    };
  }, [isDesktop]);

  return available;
}

export default function DesktopSettingsButton() {
  const isDesktop = useIsDesktop();
  const updateAvailable = useAppUpdateAvailable(isDesktop);
  if (!isDesktop) return null;

  const label = updateAvailable ? "桌面端设置（有新版本）" : "桌面端设置";
  return (
    <Link
      href={DESKTOP_SETTINGS_PATH}
      aria-label={label}
      title={label}
      className="relative flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline"
    >
      <Settings aria-hidden="true" className="h-4 w-4" />
      {updateAvailable && (
        <span aria-hidden="true" className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
      )}
    </Link>
  );
}
