"use client";

import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { DESKTOP_MAXIMIZED_EVENT, desktopWindow } from "@/lib/desktop";

const controlClass =
  "flex h-full w-12 items-center justify-center text-zinc-400 transition-colors hover:text-white focus-visible:outline-none";

function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    desktopWindow()?.isMaximized().then(setMaximized).catch(() => {});
    const onChange = (event: Event) => setMaximized((event as CustomEvent<boolean>).detail);
    window.addEventListener(DESKTOP_MAXIMIZED_EVENT, onChange);
    return () => window.removeEventListener(DESKTOP_MAXIMIZED_EVENT, onChange);
  }, []);

  return (
    <div className="-mr-3 ml-1.5 flex shrink-0 self-stretch sm:-mr-4 xl:-mr-6">
      <button
        type="button"
        onClick={() => void desktopWindow()?.minimize()}
        aria-label="最小化"
        title="最小化"
        className={`${controlClass} hover:bg-zinc-800 focus-visible:bg-zinc-800`}
      >
        <Minus aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={() => void desktopWindow()?.toggleMaximize()}
        aria-label={maximized ? "还原" : "最大化"}
        title={maximized ? "还原" : "最大化"}
        className={`${controlClass} hover:bg-zinc-800 focus-visible:bg-zinc-800`}
      >
        {maximized ? (
          <Copy aria-hidden="true" className="h-3.5 w-3.5 -scale-x-100" strokeWidth={1.5} />
        ) : (
          <Square aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
        )}
      </button>
      <button
        type="button"
        onClick={() => void desktopWindow()?.close()}
        aria-label="关闭"
        title="关闭"
        className={`${controlClass} hover:bg-[#c42b1c] focus-visible:bg-[#c42b1c]`}
      >
        <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}

// 桌面端隐藏了系统标题栏，由站点顶栏右侧提供窗口按钮
export default function DesktopWindowControls() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <WindowControls /> : null;
}
