// 桌面端（desktop/ 下的 Tauri 壳）注入的全局 API。命令需在 desktop/src-tauri/capabilities/site.json 中授权。

type TauriWindow = {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  close: () => Promise<void>;
};

type TauriGlobal = {
  core: {
    invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  };
  window: {
    getCurrentWindow: () => TauriWindow;
  };
};

declare global {
  interface Window {
    __TAURI__?: TauriGlobal;
  }
}

export type DesktopShortcutAction = "toggle_window" | "toggle_pin";

export type DesktopShortcut = {
  action: DesktopShortcutAction;
  label: string;
  // null 表示未绑定
  keys: string | null;
  defaultKeys: string | null;
  registered: boolean;
};

export type DesktopSettingsState = {
  version: string;
  pinned: boolean;
  shortcuts: DesktopShortcut[];
};

export const DESKTOP_SETTINGS_PATH = "/desktop/settings";
export const DESKTOP_PINNED_EVENT = "nzm-desktop:pinned-changed";
export const DESKTOP_MAXIMIZED_EVENT = "nzm-desktop:maximized-changed";

export function isDesktopApp() {
  return typeof window !== "undefined" && typeof window.__TAURI__?.core?.invoke === "function";
}

const MODIFIER_KEYS = new Set(["Control", "Alt", "AltGraph", "Shift", "Meta"]);

// 把按键事件转成 global-hotkey 可解析的组合键，如 Ctrl+Alt+N；只按下修饰键时返回 null
export function shortcutFromKeyEvent(event: KeyboardEvent): { keys: string } | { error: string } | null {
  if (MODIFIER_KEYS.has(event.key)) return null;
  const { code } = event;
  if (event.metaKey) return { error: "不支持 Win 键组合" };
  const isFunctionKey = /^F\d{1,2}$/.test(code);
  if (!isFunctionKey && !event.ctrlKey && !event.altKey) {
    return { error: "组合键需要包含 Ctrl 或 Alt，功能键 F1–F24 除外" };
  }
  const key = /^Key[A-Z]$/.test(code) ? code.slice(3) : /^Digit\d$/.test(code) ? code.slice(5) : code;
  const parts = [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift", key];
  return { keys: parts.filter(Boolean).join("+") };
}

export function desktopWindow() {
  return window.__TAURI__?.window.getCurrentWindow() ?? null;
}

export function invokeDesktop<T>(command: string, args?: Record<string, unknown>) {
  const tauri = window.__TAURI__;
  if (!tauri) return Promise.reject(new Error("当前不在桌面端中运行"));
  return tauri.core.invoke<T>(command, args);
}
