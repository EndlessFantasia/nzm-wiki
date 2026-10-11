"use client";

import { useSyncExternalStore } from "react";

const ICP_RECORD_NUMBER = "闽ICP备2024059713号-8";
const subscribe = () => () => {};
const getSnapshot = () => {
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "nzm-wiki.com" ||
    (process.env.NODE_ENV === "development" &&
      (hostname === "localhost" || hostname === "127.0.0.1"))
  );
};
const getServerSnapshot = () => false;

export function IcpFilingNotice() {
  const isPrimaryDomain = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (!isPrimaryDomain || !ICP_RECORD_NUMBER) return null;

  return (
    <footer className="absolute inset-x-0 bottom-2 text-center text-xs text-zinc-500">
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:text-zinc-300"
      >
        ICP备案号：{ICP_RECORD_NUMBER}
      </a>
    </footer>
  );
}
