"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  DESKTOP_PINNED_EVENT,
  invokeDesktop,
  shortcutFromKeyEvent,
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
    window.addEventListener(DESKTOP_PINNED_EVENT, onPinnedChange);
    return () => window.removeEventListener(DESKTOP_PINNED_EVENT, onPinnedChange);
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

      <ShortcutSettings shortcuts={settings.shortcuts} onChange={setShortcuts} />

      <AboutSettings version={settings.version} />
    </div>
  );
}

// 检查更新暂为占位，接入 updater 后替换点击逻辑
function AboutSettings({ version }: { version: string }) {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <section>
      <SectionTitle>关于</SectionTitle>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <span>
          <span className="block text-zinc-200">桌面端版本</span>
          <span className="mt-0.5 block text-sm text-zinc-500">v{version}{notice && ` · ${notice}`}</span>
        </span>
        <button
          type="button"
          onClick={() => setNotice("自动更新暂未接入")}
          className={textButtonClass}
        >
          检查更新
        </button>
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
          这里是 NZM Wiki 桌面端的设置页，需要在桌面端中打开。
        </p>
      )}
    </div>
  );
}
