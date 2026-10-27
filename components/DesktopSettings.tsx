"use client";

import { useEffect, useState } from "react";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  DESKTOP_PINNED_EVENT,
  invokeDesktop,
  type DesktopSettingsState,
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

      <section>
        <SectionTitle>全局快捷键</SectionTitle>
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900/60">
          {settings.shortcuts.map((shortcut) => (
            <li key={shortcut.keys} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-zinc-200">{shortcut.action}</span>
              <span className="flex items-center gap-3">
                {shortcut.registered ? (
                  <span className="text-sm text-zinc-500">已启用</span>
                ) : (
                  <span
                    className="text-sm text-red-400"
                    title="该组合键已被其他程序占用，可从托盘菜单使用对应功能"
                  >
                    被占用
                  </span>
                )}
                <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                  {shortcut.keys}
                </kbd>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-zinc-600">NZM Wiki 桌面端 v{settings.version}</p>
    </div>
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
