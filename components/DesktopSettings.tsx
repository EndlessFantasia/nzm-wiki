"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  DESKTOP_APP_UPDATE_EVENT,
  DESKTOP_APP_UPDATE_PROGRESS_EVENT,
  DESKTOP_CACHE_EVENT,
  DESKTOP_CHECK_UPDATE_QUERY,
  DESKTOP_PINNED_EVENT,
  invokeDesktop,
  shortcutFromKeyEvent,
  type DesktopAppUpdate,
  type DesktopSettingsState,
  type DesktopShortcut,
  type DesktopShortcutAction,
} from "@/lib/desktop";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-500">{children}</h2>;
}

function Switch({
  checked,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  label: string;
  hint: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full cursor-pointer touch-manipulation items-center justify-between gap-4 px-4 py-3 text-left outline-none"
    >
      <span>
        <span className="block text-zinc-200 group-focus-visible:underline group-focus-visible:decoration-2 group-focus-visible:underline-offset-4">
          {label}
        </span>
        <span className="mt-0.5 block text-sm text-zinc-500">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 motion-reduce:transition-none ${
          checked
            ? "border-emerald-500 bg-emerald-600"
            : "border-zinc-600 bg-zinc-800 group-hover:border-zinc-500"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

const textButtonClass =
  "shrink-0 cursor-pointer rounded-md px-2.5 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 disabled:cursor-default disabled:text-zinc-600 disabled:hover:bg-transparent";

function ShortcutSettings({
  shortcuts,
  onChange,
}: {
  shortcuts: DesktopShortcut[];
  onChange: (shortcuts: DesktopShortcut[]) => void;
}) {
  const [recording, setRecording] = useState<DesktopShortcutAction | null>(null);
  const [message, setMessage] = useState<{ action: DesktopShortcutAction; text: string } | null>(null);

  useEffect(() => {
    if (!recording) return;
    let busy = false;
    const pause = invokeDesktop<DesktopShortcut[]>("set_shortcuts_paused", { paused: true }).catch(() => {});

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (busy) return;
      if (event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        setRecording(null);
        return;
      }
      const result = shortcutFromKeyEvent(event);
      if (!result) return;
      if ("error" in result) {
        setMessage({ action: recording, text: result.error });
        return;
      }
      busy = true;
      void pause
        .then(() => invokeDesktop<DesktopShortcut[]>("set_shortcut", { action: recording, keys: result.keys }))
        .then((next) => {
          onChange(next);
          setMessage(null);
        })
        .catch((err: unknown) => setMessage({ action: recording, text: String(err) }))
        .finally(() => setRecording(null));
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      void pause
        .then(() => invokeDesktop<DesktopShortcut[]>("set_shortcuts_paused", { paused: false }))
        .then(onChange)
        .catch(() => {});
    };
  }, [recording, onChange]);

  const startRecording = (action: DesktopShortcutAction) => {
    setMessage(null);
    setRecording((current) => (current === action ? null : action));
  };

  const clearShortcut = (action: DesktopShortcutAction) => {
    setRecording(null);
    setMessage(null);
    invokeDesktop<DesktopShortcut[]>("set_shortcut", { action, keys: null })
      .then(onChange)
      .catch((err: unknown) => setMessage({ action, text: String(err) }));
  };

  const resetAll = () => {
    setRecording(null);
    setMessage(null);
    invokeDesktop<DesktopShortcut[]>("reset_shortcuts").then(onChange).catch(() => {});
  };

  const isDefault = shortcuts.every((shortcut) => shortcut.keys === shortcut.defaultKeys);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium tracking-wide text-zinc-500">全局快捷键</h2>
        <button type="button" onClick={resetAll} disabled={isDefault} className={`-my-1 ${textButtonClass}`}>
          恢复默认
        </button>
      </div>
      <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900/60">
        {shortcuts.map((shortcut) => {
          const isRecording = recording === shortcut.action;
          const rowMessage = message?.action === shortcut.action ? message.text : null;
          return (
            <li key={shortcut.action} className="px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <span className="min-w-0 text-zinc-200">{shortcut.label}</span>
                <span className="flex items-center gap-3">
                  {isRecording ? (
                    <span className="text-sm text-zinc-500">Esc 取消</span>
                  ) : !shortcut.keys || shortcut.registered ? null : (
                    <span
                      className="text-sm text-red-400"
                      title="该组合键已被其他程序占用，可从托盘菜单使用对应功能"
                    >
                      被占用
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => startRecording(shortcut.action)}
                    aria-label={`${shortcut.label}：${
                      isRecording ? "正在录制，再次点击取消" : shortcut.keys ? `${shortcut.keys}，点击修改` : "未绑定，点击绑定"
                    }`}
                    title={isRecording ? "再次点击取消" : shortcut.keys ? "点击修改" : "点击绑定"}
                    className={`min-w-24 cursor-pointer rounded border px-2 py-1 text-center font-mono text-xs transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 ${
                      isRecording
                        ? "border-emerald-500 bg-zinc-800 text-emerald-300"
                        : shortcut.keys
                          ? "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:text-white"
                          : "border-dashed border-zinc-600 text-zinc-500 hover:border-zinc-400 hover:text-zinc-300"
                    }`}
                  >
                    {isRecording ? "按下组合键…" : (shortcut.keys ?? "未绑定")}
                  </button>
                  <button
                    type="button"
                    onClick={() => clearShortcut(shortcut.action)}
                    disabled={!shortcut.keys || isRecording}
                    className={`${textButtonClass} ${!shortcut.keys || isRecording ? "invisible" : ""}`}
                  >
                    清除
                  </button>
                </span>
              </div>
              {rowMessage && <p className="mt-1 text-sm text-red-400">{rowMessage}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DesktopSettingsPanel() {
  const [settings, setSettings] = useState<DesktopSettingsState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invokeDesktop<DesktopSettingsState>("get_settings_state")
      .then(setSettings)
      .catch((err: unknown) => setError(String(err)));

    const onPinnedChange = (event: Event) => {
      const pinned = (event as CustomEvent<boolean>).detail;
      setSettings((current) => (current ? { ...current, pinned } : current));
    };
    const onCacheChange = (event: Event) => {
      const desktopCache = (event as CustomEvent<boolean>).detail;
      setSettings((current) => (current ? { ...current, desktopCache } : current));
    };
    window.addEventListener(DESKTOP_PINNED_EVENT, onPinnedChange);
    window.addEventListener(DESKTOP_CACHE_EVENT, onCacheChange);
    return () => {
      window.removeEventListener(DESKTOP_PINNED_EVENT, onPinnedChange);
      window.removeEventListener(DESKTOP_CACHE_EVENT, onCacheChange);
    };
  }, []);

  const setShortcuts = useCallback((shortcuts: DesktopShortcut[]) => {
    setSettings((current) => (current ? { ...current, shortcuts } : current));
  }, []);

  const setPinned = (pinned: boolean) => {
    setSettings((current) => (current ? { ...current, pinned } : current));
    invokeDesktop("set_pinned", { pinned }).catch(() =>
      setSettings((current) => (current ? { ...current, pinned: !pinned } : current)),
    );
  };

  const setDesktopCache = (desktopCache: boolean) => {
    setSettings((current) => (current ? { ...current, desktopCache } : current));
    invokeDesktop("set_desktop_cache", { enabled: desktopCache }).catch(() =>
      setSettings((current) => (current ? { ...current, desktopCache: !desktopCache } : current)),
    );
  };

  if (error) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">
        读取桌面端设置失败，可能需要更新桌面端：{error}
      </p>
    );
  }
  if (!settings) return null;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>窗口</SectionTitle>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60">
          <Switch
            checked={settings.pinned}
            label="窗口置顶"
            hint="游戏需使用窗口化或无边框模式，独占全屏下无法覆盖游戏画面"
            onChange={setPinned}
          />
        </div>
      </section>

      {settings.desktopCache !== undefined && (
        <section>
          <SectionTitle>缓存</SectionTitle>
          <div className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900/60">
            <Switch
              checked={settings.desktopCache}
              label="桌面端缓存"
              hint="关闭窗口后常驻托盘，后台保持页面为最新部署，再次打开无需重新加载；关闭后与 Edge 打开站点一致，关闭即退出"
              onChange={setDesktopCache}
            />
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span>
                <span className="block text-zinc-200">刷新缓存</span>
                <span className="mt-0.5 block text-sm text-zinc-500">
                  清空本地磁盘缓存并重新加载页面，站点里的偏好设置不受影响；也可从托盘菜单使用
                </span>
              </span>
              <button
                type="button"
                onClick={() => void invokeDesktop("refresh_site_cache").catch(() => {})}
                className={textButtonClass}
              >
                刷新
              </button>
            </div>
          </div>
        </section>
      )}

      <ShortcutSettings shortcuts={settings.shortcuts} onChange={setShortcuts} />

      <AboutSettings version={settings.version} initialUpdate={settings.appUpdate} />
    </div>
  );
}

type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "latest" }
  | { kind: "error"; phase: "check" | "install"; message: string }
  | { kind: "downloading"; percent: number | null }
  | { kind: "installing" };

function updateStatusText(status: UpdateStatus, update: DesktopAppUpdate | null) {
  switch (status.kind) {
    case "checking":
      return "正在检查…";
    case "latest":
      return "已是最新版本";
    case "error":
      return status.phase === "check" ? "检查失败，请检查网络后重试" : `安装失败：${status.message}`;
    case "downloading":
      return status.percent === null ? "正在下载…" : `正在下载 ${status.percent}%`;
    case "installing":
      return "正在安装，完成后自动重启";
    case "idle":
      return update ? `发现新版本 v${update.version}` : null;
  }
}

// initialUpdate 为 undefined 表示桌面端版本过旧、没有内置更新功能
function AboutSettings({
  version,
  initialUpdate,
}: {
  version: string;
  initialUpdate: DesktopAppUpdate | null | undefined;
}) {
  const [update, setUpdate] = useState(initialUpdate ?? null);
  const [status, setStatus] = useState<UpdateStatus>({ kind: "idle" });
  const busy = status.kind === "checking" || status.kind === "downloading" || status.kind === "installing";

  const check = useCallback(() => {
    setStatus({ kind: "checking" });
    invokeDesktop<DesktopAppUpdate | null>("check_app_update")
      .then((next) => {
        setUpdate(next);
        setStatus(next ? { kind: "idle" } : { kind: "latest" });
      })
      .catch((err: unknown) => setStatus({ kind: "error", phase: "check", message: String(err) }));
  }, []);

  const install = () => {
    setStatus({ kind: "downloading", percent: null });
    invokeDesktop("install_app_update").catch((err: unknown) =>
      setStatus({ kind: "error", phase: "install", message: String(err) }),
    );
  };

  useEffect(() => {
    if (initialUpdate === undefined) return;
    const onAvailable = (event: Event) => setUpdate((event as CustomEvent<DesktopAppUpdate>).detail);
    const onProgress = (event: Event) => {
      const { downloaded, total } = (event as CustomEvent<{ downloaded: number; total: number | null }>).detail;
      const percent = total ? Math.min(100, Math.floor((downloaded / total) * 100)) : null;
      setStatus(percent === 100 ? { kind: "installing" } : { kind: "downloading", percent });
    };
    window.addEventListener(DESKTOP_APP_UPDATE_EVENT, onAvailable);
    window.addEventListener(DESKTOP_APP_UPDATE_PROGRESS_EVENT, onProgress);
    const autoCheck = new URLSearchParams(window.location.search).has(DESKTOP_CHECK_UPDATE_QUERY)
      ? window.setTimeout(check, 0)
      : undefined;
    return () => {
      window.removeEventListener(DESKTOP_APP_UPDATE_EVENT, onAvailable);
      window.removeEventListener(DESKTOP_APP_UPDATE_PROGRESS_EVENT, onProgress);
      window.clearTimeout(autoCheck);
    };
  }, [initialUpdate, check]);

  const statusText = updateStatusText(status, update);

  return (
    <section>
      <SectionTitle>关于</SectionTitle>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-zinc-200">桌面端版本</span>
            <span
              title={status.kind === "error" ? status.message : undefined}
              className={`mt-0.5 block text-sm ${status.kind === "error" ? "text-red-400" : "text-zinc-500"}`}
            >
              v{version}
              {statusText && ` · ${statusText}`}
            </span>
          </span>
          {initialUpdate !== undefined && (
            <button type="button" onClick={update ? install : check} disabled={busy} className={textButtonClass}>
              {update ? "安装更新" : "检查更新"}
            </button>
          )}
        </div>
        {update?.notes && (
          <p className="mt-2 whitespace-pre-line border-t border-zinc-800 pt-2 text-sm text-zinc-400">
            {update.notes}
          </p>
        )}
      </div>
    </section>
  );
}

export default function DesktopSettings() {
  const isDesktop = useIsDesktop();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <h1 className="mb-2 text-2xl font-bold text-white">桌面端设置</h1>
      {isDesktop ? (
        <DesktopSettingsPanel />
      ) : (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">
          这里是逆战未来维基桌面端的设置页，需要在桌面端中打开。
        </p>
      )}
    </div>
  );
}
