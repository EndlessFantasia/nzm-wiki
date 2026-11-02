/**
 * 宿主客户端（App 内嵌 WebView）与站点之间的契约。
 *
 * 和桌面端的 `data-desktop` + `__TAURI__` 同构，只是换成中性名字：
 * - **身份**：宿主在文档创建时给 `<html>` 打 `data-client`，并在 `window.__NZM_CLIENT__`
 *   上留下 `{ name, version, platform, protocol }`；CSS 直接按属性分支，不闪。
 * - **能力**：站点把「开侧栏 / 开搜索 / 开命令面板」注册进同一个对象的 `actions`，
 *   宿主按需调用，不再去点 aria-label 按钮、也不合成键盘事件。
 * - **状态**：站点用 DOM 事件回灌（`nzm:sidebar-change`），不开放别的权限。
 *
 * 站点自己**不判断**来者是谁 —— 属性是宿主打的；没打就当普通浏览器，所有分支不生效。
 */

export type ClientActions = {
  toggleSidebar: () => void;
  openSearch: () => void;
  openCommandPalette: () => void;
};

type ClientGlobal = {
  name?: string;
  version?: string;
  platform?: string;
  protocol?: number;
  actions?: Partial<ClientActions>;
};

declare global {
  interface Window {
    __NZM_CLIENT__?: ClientGlobal;
  }
}

/** 已注册的动作。组件各自注册，宿主调用时再查表，所以先后顺序无所谓。 */
const actions: Partial<ClientActions> = {};

/** 是否被宿主嵌着跑（属性在文档创建时就打上了，水合前就存在）。 */
export function isClientHost(): boolean {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-client");
}

/** 注册一个动作，返回注销函数 —— 组件卸载时调用。 */
export function registerClientAction<K extends keyof ClientActions>(
  key: K,
  run: ClientActions[K],
): () => void {
  actions[key] = run;
  return () => {
    if (actions[key] === run) delete actions[key];
  };
}

/**
 * 把动作挂到宿主留下的全局对象上，并广播一次 `nzm:ready`。
 * 没有宿主（或宿主没留对象）时什么都不做。
 */
export function installClientActions() {
  if (typeof window === "undefined" || !isClientHost()) return;
  const client = (window.__NZM_CLIENT__ ??= {});
  client.actions = {
    toggleSidebar: () => actions.toggleSidebar?.(),
    openSearch: () => actions.openSearch?.(),
    openCommandPalette: () => actions.openCommandPalette?.(),
  };
  window.dispatchEvent(
    new CustomEvent("nzm:ready", { detail: { protocol: client.protocol ?? 0 } }),
  );
}
