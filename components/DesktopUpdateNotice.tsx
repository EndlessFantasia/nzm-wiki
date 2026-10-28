"use client";

import { RefreshCw } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { DESKTOP_BEFORE_AUTO_RELOAD_EVENT, DESKTOP_VISIBILITY_EVENT } from "@/lib/desktop";
import { getAssetPath } from "@/lib/path";

// 构建时由 scripts/build-static.ts 注入，与线上 site-version.json 对比判断是否有新部署；开发模式下为空，不检查
const SITE_VERSION = process.env.NEXT_PUBLIC_SITE_VERSION;

const MINUTE = 60_000;
const HIDDEN_INTERVAL = 10 * MINUTE;
const VISIBLE_INTERVAL = 30 * MINUTE;
const SHOW_MIN_GAP = MINUTE;
const NAVIGATION_MIN_GAP = 5 * MINUTE;
const CHECK_TIMEOUT = 5000;

async function fetchLatestVersion() {
  try {
    const response = await fetch(getAssetPath("/site-version.json"), {
      cache: "no-cache",
      signal: AbortSignal.timeout(CHECK_TIMEOUT),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { version?: unknown };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

function canAutoReload() {
  return window.dispatchEvent(new Event(DESKTOP_BEFORE_AUTO_RELOAD_EVENT, { cancelable: true }));
}

// 隐藏在托盘或刚呼出时发现新部署直接重载；前台使用中只提示，下次站内跳转改为整页加载
function UpdateWatcher({ currentVersion }: { currentVersion: string }) {
  const pathname = usePathname();
  const [updateReady, setUpdateReady] = useState(false);
  const state = useRef({ lastCheck: 0, checking: false, hidden: false, updateReady: false });

  const check = useCallback(
    async (minGap: number, reloadOnUpdate: boolean) => {
      const current = state.current;
      if (current.updateReady || current.checking || Date.now() - current.lastCheck < minGap) return;
      current.checking = true;
      current.lastCheck = Date.now();
      const latest = await fetchLatestVersion();
      current.checking = false;
      if (!latest || latest === currentVersion) return;
      const hidden = current.hidden || document.visibilityState === "hidden";
      if ((reloadOnUpdate || hidden) && canAutoReload()) {
        window.location.reload();
        return;
      }
      current.updateReady = true;
      setUpdateReady(true);
    },
    [currentVersion],
  );

  useEffect(() => {
    state.current.lastCheck = Date.now();
    const isHidden = () => state.current.hidden || document.visibilityState === "hidden";
    const timer = window.setInterval(
      () => void check(isHidden() ? HIDDEN_INTERVAL : VISIBLE_INTERVAL, false),
      MINUTE,
    );
    const onDesktopVisibility = (event: Event) => {
      const visible = (event as CustomEvent<boolean>).detail;
      state.current.hidden = !visible;
      if (visible) void check(SHOW_MIN_GAP, true);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !state.current.hidden) void check(SHOW_MIN_GAP, true);
    };
    window.addEventListener(DESKTOP_VISIBILITY_EVENT, onDesktopVisibility);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(DESKTOP_VISIBILITY_EVENT, onDesktopVisibility);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [check]);

  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    // 有新部署时旧页面脚本不再做客户端跳转，避免新旧版本混用
    if (state.current.updateReady && canAutoReload()) {
      window.location.reload();
      return;
    }
    const timeout = window.setTimeout(() => void check(NAVIGATION_MIN_GAP, false), 0);
    return () => window.clearTimeout(timeout);
  }, [pathname, check]);

  useEffect(() => {
    if (!updateReady) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(url.href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [updateReady]);

  if (!updateReady) return null;

  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      title="站点已更新，点击刷新"
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm text-amber-300 transition-colors hover:bg-zinc-800 hover:text-amber-200 focus-visible:outline-none focus-visible:underline"
    >
      <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
      站点已更新
    </button>
  );
}

export default function DesktopUpdateNotice() {
  const isDesktop = useIsDesktop();
  if (!isDesktop || !SITE_VERSION) return null;
  return <UpdateWatcher currentVersion={SITE_VERSION} />;
}
