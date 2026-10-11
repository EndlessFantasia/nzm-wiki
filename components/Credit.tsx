"use client";

import Image from "next/image";
import Link from "next/link";
import { getAssetPath } from "@/lib/path";

type Platform =
  | "bilibili"
  | "youtube"
  | "twitter"
  | "github"
  | "douyin"
  | "tieba"
  | "link";

const PLATFORM_ICONS: Record<Platform, string | null> = {
  bilibili: "/icons/social/bilibili.svg",
  youtube: "/icons/social/youtube.svg",
  twitter: "/icons/social/twitter.svg",
  github: "/icons/social/github.svg",
  douyin: "/icons/social/douyin.svg",
  tieba: "/icons/social/tieba.svg",
  link: null,
};

const PLATFORM_COLORS: Record<Platform, string> = {
  bilibili: "text-[#00A1D6]",
  youtube: "text-[#FF0000]",
  twitter: "text-white",
  github: "text-white",
  douyin: "text-white",
  tieba: "text-[#503ac2]",
  // tieba: "text-[#4E6EF2]",
  link: "text-zinc-400",
};

interface CreditProps {
  platform?: Platform;
  author: string;
  url: string;
  title?: string;
}

export function Credit({ platform = "link", author, url, title }: CreditProps) {
  const iconPath = PLATFORM_ICONS[platform];

  return (
    <div className="detail-panel not-prose my-4 rounded-xl border border-zinc-700 bg-zinc-800/80 to-zinc-800/40 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {/* 图标 */}
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-700/50 ${PLATFORM_COLORS[platform] || "text-zinc-400"}`}
        >
          {iconPath ? (
            <Image
              src={getAssetPath(iconPath)}
              alt={platform}
              width={24}
              height={24}
              className="object-contain"
            />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-zinc-400"
              aria-hidden="true"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-zinc-500 mb-0.5">致谢参考</div>
          <Link
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 text-zinc-200 hover:text-white transition-colors"
          >
            <span className="font-medium truncate">{author}</span>
            {title && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-sm text-zinc-400 truncate group-hover:text-zinc-300">
                  {title}
                </span>
              </>
            )}
            <svg
              className="h-4 w-4 flex-shrink-0 text-zinc-500 group-hover:text-zinc-300 transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
