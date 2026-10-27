/// <reference types="react/canary" />
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, ViewTransition } from "react";
import { ArrowLeft, Command, Github, Menu, Search, X } from "lucide-react";
import {
  BossDifficultyProvider,
  useBossDifficulty,
} from "@/components/BossDifficultyProvider";
import DesktopSettingsButton from "@/components/DesktopSettingsButton";
import { canReturnToCatalog } from "@/lib/catalog-navigation";
import { getAssetPath } from "@/lib/path";
import {
  resolveSiteNavigation,
  SITE_NAV_FOOTER_ITEM,
  SITE_NAV_SECTIONS,
  SITE_NAVIGATION_CHANGE_EVENT,
  type SiteNavItem,
} from "@/lib/site-navigation";

const GITHUB_REPO = "https://github.com/EndlessFantasia/nzm-wiki";
const DEFAULT_SIDEBAR_WIDTH = 184;
const MIN_SIDEBAR_WIDTH = 184;
const MAX_SIDEBAR_WIDTH = 320;
const SIDEBAR_WIDTH_STORAGE_KEY = "nzm-wiki:sidebar-width";

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

function getMobileBackLink(pathname: string) {
  if (pathname.startsWith("/enemies/lc/monsters/")) {
    return { href: "/enemies/lc/monsters", label: "返回猎场怪物" };
  }
  if (pathname === "/enemies/lc/monsters" || pathname === "/enemies/lc/shooting-range") return null;
  if (pathname.startsWith("/perks/")) {
    return { href: "/perks", label: "返回插件图鉴" };
  }
  if (/^\/weapons\/td\/[^/]+\/?$/.test(pathname)) {
    return { href: "/weapons?mode=td", label: "返回塔防武器图鉴" };
  }
  if (/^\/weapons\/[^/]+\/?$/.test(pathname)) {
    return { href: "/weapons", label: "返回武器图鉴" };
  }
  if (/^\/overlimit\/[^/]+\/?$/.test(pathname)) {
    return { href: "/overlimit", label: "返回超限图鉴" };
  }
  if (
    /^\/bosses\/[^/]+\/?$/.test(pathname) ||
    /^\/enemies\/lc\/[^/]+\/?$/.test(pathname)
  ) {
    return { href: "/bosses", label: "返回敌人图鉴" };
  }
  if (pathname.startsWith("/traps/")) {
    return { href: "/tower-defense#traps", label: "返回塔防图鉴" };
  }
  if (pathname.startsWith("/enemies/td/")) {
    return { href: "/tower-defense#enemies", label: "返回塔防图鉴" };
  }
  if (pathname.startsWith("/guides/season-talents/")) {
    return { href: "/season-talents", label: "返回赛季天赋" };
  }
  if (/^\/builds\/[^/]+\/?$/.test(pathname)) {
    return { href: "/builds", label: "返回搭配攻略" };
  }
  return null;
}

function triggerShortcut(key: string, shiftKey = false) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      ctrlKey: true,
      shiftKey,
      bubbles: true,
    }),
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="flex min-h-11 min-w-0 items-center gap-2 text-white transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
    >
      <Image
        src={getAssetPath("/logo.png")}
        alt=""
        width={compact ? 26 : 30}
        height={compact ? 26 : 30}
        className="h-auto shrink-0"
      />
      <span className={`truncate font-bold ${compact ? "text-lg" : "text-base"}`}>
        逆战未来 维基
      </span>
    </Link>
  );
}

function SiteNavigation({
  activeItemId,
  onNavigate,
}: {
  activeItemId: SiteNavItem["id"] | null;
  onNavigate?: () => void;
}) {
  const { withDifficulty } = useBossDifficulty();

  const renderItem = (item: SiteNavItem) => {
    const active = activeItemId === item.id;
    const href = item.id === "enemies" ? withDifficulty(item.href) : item.href;

    return (
      <Link
        key={item.id}
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={`relative flex min-h-11 touch-manipulation items-center rounded-md border px-4 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none ${
          active
            ? "border-zinc-600 bg-zinc-800 text-white"
            : "border-transparent text-zinc-300 hover:bg-zinc-800/65 hover:text-white"
        }`}
      >
        {active && (
          <span
            aria-hidden="true"
            className="absolute left-2 h-5 w-0.5 rounded-full bg-amber-400"
          />
        )}
        <span className="pl-3">{item.label}</span>
      </Link>
    );
  };

  return (
    <nav aria-label="全站导航" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {SITE_NAV_SECTIONS.map((section, index) => (
          <section key={section.id} className={index === 0 ? "" : "mt-4"}>
            <h2 className="mb-1 px-3 text-xs font-semibold text-zinc-500">
              {section.label}
            </h2>
            <div className="space-y-0.5">{section.items.map(renderItem)}</div>
          </section>
        ))}
      </div>
      <div className="border-t border-zinc-700/80 p-3">
        {renderItem(SITE_NAV_FOOTER_ITEM)}
      </div>
    </nav>
  );
}

function SidebarResizeHandle({
  width,
  onWidthChange,
  onWidthCommit,
}: {
  width: number;
  onWidthChange: (width: number) => void;
  onWidthCommit: (width: number) => void;
}) {
  const draggingRef = useRef(false);
  const widthRef = useRef(width);
  const bodyStylesRef = useRef<{ cursor: string; userSelect: string } | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const updateWidth = useCallback(
    (nextWidth: number) => {
      const clampedWidth = clampSidebarWidth(nextWidth);
      widthRef.current = clampedWidth;
      onWidthChange(clampedWidth);
      return clampedWidth;
    },
    [onWidthChange],
  );

  const finishDragging = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    onWidthCommit(widthRef.current);

    if (bodyStylesRef.current) {
      document.body.style.cursor = bodyStylesRef.current.cursor;
      document.body.style.userSelect = bodyStylesRef.current.userSelect;
      bodyStylesRef.current = null;
    }
  }, [onWidthCommit]);

  useEffect(() => finishDragging, [finishDragging]);

  const handleKeyboardResize = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let nextWidth = widthRef.current;

    switch (event.key) {
      case "ArrowLeft":
        nextWidth -= 8;
        break;
      case "ArrowRight":
        nextWidth += 8;
        break;
      case "PageDown":
        nextWidth -= 32;
        break;
      case "PageUp":
        nextWidth += 32;
        break;
      case "Home":
        nextWidth = MIN_SIDEBAR_WIDTH;
        break;
      case "End":
        nextWidth = MAX_SIDEBAR_WIDTH;
        break;
      default:
        return;
    }

    event.preventDefault();
    onWidthCommit(updateWidth(nextWidth));
  };

  return (
    <div
      role="separator"
      aria-label="调整侧栏宽度"
      aria-orientation="vertical"
      aria-valuemin={MIN_SIDEBAR_WIDTH}
      aria-valuemax={MAX_SIDEBAR_WIDTH}
      aria-valuenow={width}
      aria-valuetext={`${width} 像素`}
      tabIndex={0}
      title="拖动调整侧栏宽度，双击恢复默认"
      onDoubleClick={() => onWidthCommit(updateWidth(DEFAULT_SIDEBAR_WIDTH))}
      onKeyDown={handleKeyboardResize}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        draggingRef.current = true;
        setIsDragging(true);
        bodyStylesRef.current = {
          cursor: document.body.style.cursor,
          userSelect: document.body.style.userSelect,
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(event) => {
        if (draggingRef.current) updateWidth(event.clientX);
      }}
      onPointerUp={finishDragging}
      onPointerCancel={finishDragging}
      onLostPointerCapture={finishDragging}
      className="group absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize touch-none focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors duration-150 motion-reduce:transition-none ${
          isDragging
            ? "bg-amber-400"
            : "bg-transparent group-hover:bg-zinc-500 group-focus-visible:bg-amber-400"
        }`}
      />
    </div>
  );
}

function SiteSidebar({
  activeItemId,
  width,
  onWidthChange,
  onWidthCommit,
}: {
  activeItemId: SiteNavItem["id"] | null;
  width: number;
  onWidthChange: (width: number) => void;
  onWidthCommit: (width: number) => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--site-sidebar-width)] flex-col border-r border-zinc-700 bg-surface-1 shadow-[8px_0_28px_rgba(0,0,0,0.14)] xl:flex">
      <div className="flex h-14 shrink-0 items-center border-b border-zinc-700 px-4">
        <Brand />
      </div>
      <SiteNavigation activeItemId={activeItemId} />
      <SidebarResizeHandle
        width={width}
        onWidthChange={onWidthChange}
        onWidthCommit={onWidthCommit}
      />
    </aside>
  );
}

function MobileNavigationDialog({
  dialogRef,
  activeItemId,
  onClose,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  activeItemId: SiteNavItem["id"] | null;
  onClose: () => void;
}) {
  return (
    <dialog
      ref={dialogRef}
      aria-label="全站导航"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="site-nav-dialog fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-[min(84vw,20rem)] max-w-none overflow-hidden border-0 border-r border-zinc-700 bg-surface-1 p-0 text-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-[1px] xl:hidden"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-700 px-4">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭导航"
            title="关闭导航"
            className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <SiteNavigation activeItemId={activeItemId} onNavigate={onClose} />
      </div>
    </dialog>
  );
}

function SiteHeader({
  pathname,
  sectionLabel,
  itemLabel,
  drawerOpen,
  onOpenDrawer,
}: {
  pathname: string;
  sectionLabel: string | null;
  itemLabel: string | null;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
}) {
  const router = useRouter();
  const { withDifficulty } = useBossDifficulty();
  const mobileBackLink = getMobileBackLink(pathname);

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-zinc-700 bg-surface-1/95 backdrop-blur">
      <div className="flex h-full w-full items-center justify-between gap-2 px-3 sm:px-4 xl:px-6">
        <div className="flex min-w-0 items-center">
          {mobileBackLink && (
            <Link
              href={
                mobileBackLink.href === "/bosses" || mobileBackLink.href === "/enemies/lc/monsters"
                  ? withDifficulty(mobileBackLink.href)
                  : mobileBackLink.href
              }
              aria-label={mobileBackLink.label}
              title={mobileBackLink.label}
              onClick={(event) => {
                if (canReturnToCatalog(pathname)) {
                  event.preventDefault();
                  router.back();
                }
              }}
              className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline xl:hidden"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Link>
          )}
          <div className={mobileBackLink ? "hidden" : "xl:hidden"}>
            <Brand compact />
          </div>
          {itemLabel && (
            <div className="hidden items-center gap-2 text-sm xl:flex">
              {sectionLabel && (
                <>
                  <span className="text-zinc-500">{sectionLabel}</span>
                  <span aria-hidden="true" className="text-zinc-700">
                    /
                  </span>
                </>
              )}
              <strong className="font-medium text-zinc-300">{itemLabel}</strong>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => triggerShortcut("p")}
            aria-label="搜索资料"
            title="搜索 (Ctrl+P)"
            className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline lg:px-3"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
            <span className="hidden text-sm lg:inline">搜索</span>
            <kbd className="hidden rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500 lg:inline">
              Ctrl+P
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => triggerShortcut("p", true)}
            aria-label="命令面板"
            title="命令面板 (Ctrl+Shift+P)"
            className="flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline"
          >
            <Command aria-hidden="true" className="h-4 w-4" />
          </button>
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
            className="flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline"
          >
            <Github aria-hidden="true" className="h-4 w-4" />
          </a>
          <DesktopSettingsButton />
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            aria-label="打开导航"
            title="导航"
            className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline xl:hidden"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function SiteShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [hash, setHash] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);

  useEffect(() => {
    const storedWidth = Number.parseInt(
      window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY) ?? "",
      10,
    );
    if (!Number.isFinite(storedWidth)) return;
    // The persisted value is browser-only state and is restored after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarWidth(clampSidebarWidth(storedWidth));
  }, []);

  const commitSidebarWidth = useCallback((width: number) => {
    const clampedWidth = clampSidebarWidth(width);
    setSidebarWidth(clampedWidth);
    window.localStorage.setItem(
      SIDEBAR_WIDTH_STORAGE_KEY,
      String(clampedWidth),
    );
  }, []);

  const closeDrawer = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    setDrawerOpen(false);
  }, []);

  const openDrawer = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    setDrawerOpen(true);
  }, []);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    window.addEventListener(SITE_NAVIGATION_CHANGE_EVENT, syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
      window.removeEventListener(SITE_NAVIGATION_CHANGE_EVENT, syncHash);
    };
  }, [pathname]);

  useEffect(() => {
    const timeout = window.setTimeout(closeDrawer, 0);
    return () => window.clearTimeout(timeout);
  }, [pathname, hash, closeDrawer]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1280px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) closeDrawer();
    };
    desktopQuery.addEventListener("change", closeAtDesktop);
    return () => desktopQuery.removeEventListener("change", closeAtDesktop);
  }, [closeDrawer]);

  const resolvedNavigation = resolveSiteNavigation({ pathname, hash });

  return (
    <div
      className="min-h-dvh"
      style={
        { "--site-sidebar-width": `${sidebarWidth}px` } as React.CSSProperties
      }
    >
      <SiteSidebar
        activeItemId={resolvedNavigation?.activeItemId ?? null}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
        onWidthCommit={commitSidebarWidth}
      />
      <div className="min-w-0 xl:pl-[var(--site-sidebar-width)] xl:[container-type:inline-size]">
        <SiteHeader
          pathname={pathname}
          sectionLabel={resolvedNavigation?.sectionLabel ?? null}
          itemLabel={resolvedNavigation?.itemLabel ?? null}
          drawerOpen={drawerOpen}
          onOpenDrawer={openDrawer}
        />
        {/* 以路径为 key：换页时新旧页面交叉过渡，仅 query 或 hash 变化时不播放 */}
        <ViewTransition key={pathname} default="none" enter="page-enter" exit="page-exit">
          <div className="min-w-0">{children}</div>
        </ViewTransition>
      </div>
      <MobileNavigationDialog
        dialogRef={dialogRef}
        activeItemId={resolvedNavigation?.activeItemId ?? null}
        onClose={closeDrawer}
      />
    </div>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <BossDifficultyProvider>
      <SiteShellContent>{children}</SiteShellContent>
    </BossDifficultyProvider>
  );
}
