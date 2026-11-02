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
import DesktopUpdateNotice from "@/components/DesktopUpdateNotice";
import DesktopWindowControls from "@/components/DesktopWindowControls";
import { canReturnToCatalog } from "@/lib/catalog-navigation";
import { DESKTOP_CALCULATOR_PATH } from "@/lib/desktop";
import { getAssetPath } from "@/lib/path";
import {
  resolveSiteNavigation,
  SITE_NAV_FOOTER_ITEM,
  SITE_NAV_SECTIONS,
  SITE_NAVIGATION_CHANGE_EVENT,
  type SiteNavItem,
} from "@/lib/site-navigation";

const GITHUB_REPO = "https://github.com/EndlessFantasia/nzm-wiki";
// 手势方向判定：横向位移超过它才开始"拉起"抽屉，之前的位移只用来分辨横竖
const DRAWER_DRAG_START = 8;
// 松手时展开比例超过它就算打开（配合快速的甩动）；取四成，
// 拖到一半反悔还能轻松收回去
const DRAWER_OPEN_RATIO = 0.4;
// 收起门槛比打开低一点：关掉一个东西总该比打开更容易
const DRAWER_CLOSE_RATIO = 0.3;
// 甩动判定的速度阈值，单位 px/ms
const DRAWER_FLING_VELOCITY = 0.5;
// 抽屉吸附到打开 / 收起时的动画时长
const DRAWER_SWIPE_OUT_MS = 180;

/**
 * 把手势期间写进 dialog 的内联位移和遮罩浓度清掉，交回 CSS 的开关状态。
 *
 * ⚠️ 必须和 `openDrawer()` 共用：手势中途被返回键 / 点遮罩关掉时，
 * `translate: -100%` 会留在元素上，下一次正常打开就会停在屏幕外。
 */
function resetDialogDragStyles(dialog: HTMLDialogElement) {
  dialog.style.transition = "";
  dialog.style.translate = "";
  dialog.style.removeProperty("--site-nav-drag");
  delete dialog.dataset.dragging;
}

// 手势起点若落在横向可滚动容器（筛选条等）里，交给它自己滚动，不当作呼出抽屉
function isInsideHorizontalScroller(target: EventTarget | null) {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    if (
      (style.overflowX === "auto" || style.overflowX === "scroll") &&
      node.scrollWidth > node.clientWidth + 8
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
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
        className="web-only h-auto shrink-0"
      />
      <Image
        src={getAssetPath("/desktop/avatar.webp")}
        alt=""
        width={compact ? 24 : 28}
        height={compact ? 24 : 28}
        className="desktop-only shrink-0 rounded-[22%]"
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
        className={`relative flex min-h-11 touch-manipulation items-center rounded-md px-4 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 motion-reduce:transition-none ${
          active
            ? "bg-zinc-800 text-white"
            : "text-zinc-300 hover:bg-zinc-800/65 hover:text-white"
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

function SiteSidebar({ activeItemId }: { activeItemId: SiteNavItem["id"] | null }) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-(--site-sidebar-width) flex-col border-r border-zinc-700 bg-surface-1 shadow-[8px_0_28px_rgba(0,0,0,0.14)] lg:flex"
    >
      <div
        data-tauri-drag-region="deep"
        className="flex h-(--site-header-height) shrink-0 items-center border-b border-zinc-700 px-4"
      >
        <Brand />
      </div>
      <SiteNavigation activeItemId={activeItemId} />
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
  // 抽屉内向左拖动收起：拖动期直接改内联 translate，松手后再交回 CSS 过渡
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    dx: 0,
    width: 1,
    lastX: 0,
    lastAt: 0,
    velocity: 0,
  });

  const handleTouchStart = (event: React.TouchEvent<HTMLDialogElement>) => {
    if (event.touches.length !== 1) {
      dragRef.current.active = false;
      return;
    }
    const touch = event.touches[0];
    const width = dialogRef.current?.getBoundingClientRect().width ?? 0;
    dragRef.current = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      dx: 0,
      // 收起阈值按"拖掉多少比例"算，抽屉在窄屏上也能有一样的手感
      width: width > 0 ? width : 1,
      lastX: touch.clientX,
      lastAt: performance.now(),
      velocity: 0,
    };
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDialogElement>) => {
    const drag = dragRef.current;
    if (!drag.active || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - drag.startX;
    const dy = touch.clientY - drag.startY;
    // 首个移动若以竖直为主，说明用户在滚动导航，退出本次拖动
    if (drag.dx === 0 && Math.abs(dy) > Math.abs(dx)) {
      drag.active = false;
      return;
    }
    const dt = performance.now() - drag.lastAt;
    if (dt > 0) {
      // 最近一次移动的瞬时速度：停住再松手时它会自然衰减，不会误判成甩动
      drag.velocity = (touch.clientX - drag.lastX) / dt;
      drag.lastX = touch.clientX;
      drag.lastAt = performance.now();
    }
    drag.dx = Math.min(0, dx);
    const dialog = dialogRef.current;
    if (!dialog) return;
    const remaining = Math.min(1, Math.max(0, 1 + drag.dx / drag.width));
    dialog.style.transition = "none";
    dialog.style.translate = `${drag.dx}px 0`;
    dialog.style.setProperty("--site-nav-drag", String(remaining));
    dialog.dataset.dragging = "";
  };

  const handleTouchEnd = () => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;
    const dialog = dialogRef.current;
    if (!dialog) return;

    // 拖过三成宽度，或者向左甩得够快，就收起
    const close =
      drag.dx <= -drag.width * DRAWER_CLOSE_RATIO ||
      drag.velocity <= -DRAWER_FLING_VELOCITY;
    dialog.style.transition = `translate ${DRAWER_SWIPE_OUT_MS}ms ${
      close ? "ease-in" : "cubic-bezier(0.16, 1, 0.3, 1)"
    }`;

    if (close) {
      // 先滑出屏幕再关闭，避免直接 close 时从 -1rem 处弹回
      dialog.style.translate = "-100% 0";
      dialog.style.setProperty("--site-nav-drag", "0");
      window.setTimeout(() => {
        const current = dialogRef.current;
        if (!current) return;
        if (current.open) current.close();
        resetDialogDragStyles(current);
      }, DRAWER_SWIPE_OUT_MS);
      return;
    }

    // 没到阈值：吸附回打开态，然后交回 CSS
    dialog.style.translate = "0px 0";
    dialog.style.setProperty("--site-nav-drag", "1");
    window.setTimeout(() => resetDialogDragStyles(dialog), DRAWER_SWIPE_OUT_MS);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="全站导航"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="site-nav-dialog fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-[min(84vw,20rem)] max-w-none overflow-hidden border-0 border-r border-zinc-700 bg-surface-1 p-0 text-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-[1px] lg:hidden"
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
    <header
      data-tauri-drag-region="deep"
      className="sticky top-0 z-40 h-(--site-header-height) border-b border-zinc-700 bg-surface-1/95 backdrop-blur"
    >
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
              className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline lg:hidden"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Link>
          )}
          <div className={mobileBackLink ? "hidden" : "lg:hidden"}>
            <Brand compact />
          </div>
          {itemLabel && (
            <div className="hidden items-center gap-2 text-sm lg:flex">
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

        <div className="flex h-full shrink-0 items-center gap-0.5">
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
            className="desktop-compact-hidden flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline"
          >
            <Command aria-hidden="true" className="h-4 w-4" />
          </button>
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
            className="desktop-compact-hidden flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline"
          >
            <Github aria-hidden="true" className="h-4 w-4" />
          </a>
          <DesktopUpdateNotice />
          <DesktopSettingsButton />
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            aria-label="打开导航"
            title="导航"
            className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline lg:hidden"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
          <DesktopWindowControls />
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

  const closeDrawer = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    setDrawerOpen(false);
  }, []);

  const openDrawer = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialog.open) {
      // 手势中途被打断（来电、切后台、渲染进程被回收）可能把它留在屏幕外，
      // 而 dialog 又是模态的 —— 那时点按钮、搜索、计算器全都没反应。
      // 所以「已经 open」不代表不用管：先把手势残留清掉，再同步一次状态。
      resetDialogDragStyles(dialog);
      setDrawerOpen(true);
      return;
    }
    // 清掉上一次手势留下的内联位移，否则再次打开会停在屏幕外
    resetDialogDragStyles(dialog);
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
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) closeDrawer();
    };
    desktopQuery.addEventListener("change", closeAtDesktop);
    return () => desktopQuery.removeEventListener("change", closeAtDesktop);
  }, [closeDrawer]);

  // 侧栏收进抽屉后，在左半边屏幕向右滑可以「把抽屉拉出来」：
  // 方向确认后立刻把抽屉挂到屏幕外，之后的位移全部交给手指，
  // 松手时按展开比例 / 甩动速度吸附到打开或收起 —— 拖到一半反悔也能收回去。
  useEffect(() => {
    if (drawerOpen) return;
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const gesture = {
      tracking: false,
      dragging: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastAt: 0,
      velocity: 0,
      width: 1,
      progress: 0,
    };

    const onTouchStart = (event: TouchEvent) => {
      gesture.tracking = false;
      gesture.dragging = false;
      gesture.progress = 0;
      gesture.velocity = 0;
      if (event.touches.length !== 1 || desktopQuery.matches) return;
      const touch = event.touches[0];
      if (touch.clientX > window.innerWidth / 2) return;
      // 其他弹层（搜索、图片查看等）打开时不抢手势
      if (document.querySelector("dialog[open]")) return;
      if (isInsideHorizontalScroller(event.target)) return;
      gesture.startX = touch.clientX;
      gesture.startY = touch.clientY;
      gesture.lastX = touch.clientX;
      gesture.lastAt = performance.now();
      gesture.tracking = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!gesture.tracking || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;

      if (!gesture.dragging) {
        // 竖直方向优先，交还给页面滚动
        if (Math.abs(dy) > Math.abs(dx)) {
          gesture.tracking = false;
          return;
        }
        // 位移还太小：先不把抽屉挂上来，免得轻轻一划就闪一下
        if (dx < DRAWER_DRAG_START) return;
        const dialog = dialogRef.current;
        if (!dialog || dialog.open) {
          gesture.tracking = false;
          return;
        }
        // ⚠️ 先关掉过渡、停在屏幕外再 showModal：直接 showModal 会先播一遍
        // CSS 入场动画，手指位置和抽屉就对不上了
        dialog.style.transition = "none";
        dialog.style.translate = "-100% 0";
        dialog.style.setProperty("--site-nav-drag", "0");
        dialog.dataset.dragging = "";
        dialog.showModal();
        gesture.width = dialog.getBoundingClientRect().width || 1;
        gesture.dragging = true;
      }

      const dt = performance.now() - gesture.lastAt;
      if (dt > 0) {
        gesture.velocity = (touch.clientX - gesture.lastX) / dt;
        gesture.lastX = touch.clientX;
        gesture.lastAt = performance.now();
      }

      const dialog = dialogRef.current;
      if (!dialog) return;
      const progress = Math.min(1, Math.max(0, dx / gesture.width));
      gesture.progress = progress;
      dialog.style.translate = `${-gesture.width * (1 - progress)}px 0`;
      // 遮罩浓度也按展开比例走：抽屉还在外面时背景不该先暗下来
      dialog.style.setProperty("--site-nav-drag", String(progress));
    };

    const onTouchEnd = () => {
      gesture.tracking = false;
      if (!gesture.dragging) return;
      gesture.dragging = false;
      const dialog = dialogRef.current;
      if (!dialog) return;

      // 拉过三成宽度，或者向右甩得够快，就打开
      const open =
        gesture.progress >= DRAWER_OPEN_RATIO ||
        gesture.velocity >= DRAWER_FLING_VELOCITY;
      dialog.style.transition = `translate ${DRAWER_SWIPE_OUT_MS}ms ${
        open ? "cubic-bezier(0.16, 1, 0.3, 1)" : "ease-in"
      }`;

      if (open) {
        dialog.style.translate = "0px 0";
        dialog.style.setProperty("--site-nav-drag", "1");
        window.setTimeout(() => {
          const current = dialogRef.current;
          if (!current) return;
          // 交回 CSS 的打开态，之后的收起手势照旧
          resetDialogDragStyles(current);
          setDrawerOpen(true);
        }, DRAWER_SWIPE_OUT_MS);
        return;
      }

      // 没到阈值：滑回屏幕外再关，别让它从半途弹回来
      dialog.style.translate = "-100% 0";
      dialog.style.setProperty("--site-nav-drag", "0");
      window.setTimeout(() => {
        const current = dialogRef.current;
        if (!current) return;
        if (current.open) current.close();
        resetDialogDragStyles(current);
      }, DRAWER_SWIPE_OUT_MS);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [drawerOpen]);

  const resolvedNavigation = resolveSiteNavigation({ pathname, hash });

  return (
    <div className="min-h-dvh">
      <SiteSidebar activeItemId={resolvedNavigation?.activeItemId ?? null} />
      <div className="min-w-0 lg:pl-(--site-sidebar-width) lg:[container-type:inline-size]">
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
  const pathname = usePathname();
  // 桌面端独立计算器窗口不需要顶栏和侧栏
  if (pathname === DESKTOP_CALCULATOR_PATH) return children;
  return (
    <BossDifficultyProvider>
      <SiteShellContent>{children}</SiteShellContent>
    </BossDifficultyProvider>
  );
}
