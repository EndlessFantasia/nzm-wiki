// 桌面端（desktop/ 下的 Tauri 壳）注入的全局 API。命令需在 desktop/src-tauri/capabilities/site.json 中授权。

type TauriGlobal = {
  core: {
    invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  };
};

declare global {
  interface Window {
    __TAURI__?: TauriGlobal;
  }
}

export type DesktopShortcut = {
  action: string;
  keys: string;
  registered: boolean;
};

export type DesktopSettingsState = {
  version: string;
  pinned: boolean;
  shortcuts: DesktopShortcut[];
};

export const DESKTOP_SETTINGS_PATH = "/desktop/settings";
export const DESKTOP_PINNED_EVENT = "nzm-desktop:pinned-changed";

export function isDesktopApp() {
  return typeof window !== "undefined" && typeof window.__TAURI__?.core?.invoke === "function";
}

export function invokeDesktop<T>(command: string, args?: Record<string, unknown>) {
  const tauri = window.__TAURI__;
  if (!tauri) return Promise.reject(new Error("当前不在桌面端中运行"));
  return tauri.core.invoke<T>(command, args);
}
