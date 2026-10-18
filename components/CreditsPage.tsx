"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Credit } from "@/components/Credit";
import { getAssetPath } from "@/lib/path";

interface CoreContributor {
  name: string;
  platform: "github" | "bilibili" | "douyin";
  url: string;
  description: string;
  avatarUrl: string | null;
  fallbackAvatarUrl?: string | null;
  extraLink?: string;
  extraLabel?: string;
  flair?: "golden" | "frost";
  backgroundUrl?: string;
  backgroundExtUrl?: string;
}

interface ContentContributor {
  platform: "bilibili" | "douyin" | "github" | "tieba";
  author: string;
  url: string;
  title: string;
}

const PLATFORM_ICONS: Record<string, string> = {
  github: "/icons/social/github.svg",
  bilibili: "/icons/social/bilibili.svg",
  douyin: "/icons/social/douyin.svg",
};

function Avatar({
  src,
  fallbackSrc,
  alt,
  platform,
}: {
  src: string | null;
  fallbackSrc?: string | null;
  alt: string;
  platform: string;
}) {
  const iconPath = PLATFORM_ICONS[platform];

  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={48}
        height={48}
        className="h-12 w-12 rounded-full object-cover flex-shrink-0"
        unoptimized
        onError={(e) => {
          if (fallbackSrc) {
            (e.target as HTMLImageElement).src = fallbackSrc;
          }
        }}
      />
    );
  }

  // Fallback: 平台图标
  if (iconPath) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700/50 flex-shrink-0">
        <Image
          src={getAssetPath(iconPath)}
          alt={platform}
          width={28}
          height={28}
          className="object-contain"
        />
      </div>
    );
  }

  // 兜底：首字母圆圈
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700/50 text-zinc-400 text-lg font-bold flex-shrink-0">
      {alt.charAt(0)}
    </div>
  );
}

const SNOWFLAKES = [
  { left: "4%", delay: "0s", duration: "7s", size: "4px" },
  { left: "12%", delay: "-4.2s", duration: "8.5s", size: "3px" },
  { left: "21%", delay: "-1.8s", duration: "6.5s", size: "5px" },
  { left: "29%", delay: "-6s", duration: "9s", size: "2px" },
  { left: "37%", delay: "-3s", duration: "7.5s", size: "4px" },
  { left: "46%", delay: "-5.4s", duration: "8s", size: "3px" },
  { left: "54%", delay: "-0.8s", duration: "6s", size: "5px" },
  { left: "62%", delay: "-7s", duration: "9.5s", size: "3px" },
  { left: "70%", delay: "-2.4s", duration: "7s", size: "4px" },
  { left: "78%", delay: "-4.8s", duration: "8.5s", size: "2px" },
  { left: "86%", delay: "-1.2s", duration: "6.5s", size: "4px" },
  { left: "94%", delay: "-3.6s", duration: "8s", size: "3px" },
];

function FrostDecor({
  backgroundUrl,
  backgroundExtUrl,
}: {
  backgroundUrl?: string;
  backgroundExtUrl?: string;
}) {
  return (
    <>
      {backgroundUrl && backgroundExtUrl && (
        <div className="credit-frost-strip" aria-hidden>
          <div className="credit-frost-ext">
            <Image src={backgroundExtUrl} alt="" fill sizes="200px" unoptimized />
          </div>
          <div className="credit-frost-ext-blur">
            <Image src={backgroundExtUrl} alt="" fill sizes="200px" unoptimized />
          </div>
          <div className="credit-frost-orig">
            <Image src={backgroundUrl} alt="" fill sizes="480px" unoptimized />
          </div>
        </div>
      )}
      <div className="credit-frost-shade" aria-hidden />
      <div className="credit-snow" aria-hidden>
        {SNOWFLAKES.map((f, i) => (
          <span
            key={i}
            style={
              {
                left: f.left,
                animationDelay: f.delay,
                animationDuration: f.duration,
                "--flake": f.size,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </>
  );
}

function CoreCard({ person }: { person: CoreContributor }) {
  const hasDesc = person.description.length > 0;
  const hasExtra = !!(person.extraLink && person.extraLabel);
  const flair = person.flair;

  return (
    <div
      className={`group relative flex items-center gap-4 rounded-xl border transition-colors p-4 ${
        flair
          ? `credit-${flair} overflow-hidden`
          : "border-zinc-800 bg-zinc-800/40 hover:bg-zinc-800/70 hover:border-zinc-700"
      }`}
    >
      {flair === "frost" && (
        <FrostDecor
          backgroundUrl={person.backgroundUrl}
          backgroundExtUrl={person.backgroundExtUrl}
        />
      )}
      <span className={flair ? "credit-avatar-ring relative z-10 rounded-full p-[2px]" : "contents"}>
        <Avatar
          src={person.avatarUrl}
          fallbackSrc={person.fallbackAvatarUrl}
          alt={person.name}
          platform={person.platform}
        />
      </span>
      <div className="relative z-10 flex-1 min-w-0">
        <a
          href={person.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 hover:text-white transition-colors"
        >
          <span className={`font-semibold transition-colors truncate ${flair ? "credit-name" : "text-zinc-200 group-hover:text-white"}`}>
            {person.name}
          </span>
          <svg
            className={`h-4 w-4 flex-shrink-0 transition-colors ${flair ? "credit-link-icon" : "text-zinc-500 group-hover:text-zinc-300"}`}
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
        </a>
        {hasDesc && (
          <p className={`text-sm transition-colors mt-0.5 ${flair ? "credit-desc" : "text-zinc-400 group-hover:text-zinc-300"}`}>
            {person.description}
          </p>
        )}
        {hasExtra && (
          <a
            href={person.extraLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-0.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {person.extraLabel} →
          </a>
        )}
      </div>
    </div>
  );
}

function Pagination({
  page,
  total,
  onPageChange,
}: {
  page: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3 pt-8">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="flex items-center justify-center h-9 w-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="上一页"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="text-sm text-zinc-500 tabular-nums select-none">
        {page} / {total}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= total}
        className="flex items-center justify-center h-9 w-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="下一页"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

interface CreditsPageProps {
  coreContributors: CoreContributor[];
  contentContributors: ContentContributor[];
}

export function CreditsPage({
  coreContributors,
  contentContributors,
}: CreditsPageProps) {
  const [page, setPage] = useState(1);
  const totalPages = 2;

  return (
    <div className="mx-auto max-w-3xl py-6 md:py-10 px-4">
      {/* 标题 */}
      <h1 className="text-2xl font-bold text-white mb-2">致谢</h1>
      <p className="text-zinc-400 mb-8">
        感谢为逆战未来 Wiki 做出贡献的每一位玩家和创作者
      </p>

      {/* 翻页内容 */}
      <div className="min-h-[400px]">
        {page === 1 && (
          <div className="animate-in fade-in duration-200">
            <h2
              id="main-credits"
              className="scroll-mt-6 text-sm font-medium text-zinc-500 mb-4 tracking-wide"
            >
              核心致谢
            </h2>
            <div className="space-y-3">
              {coreContributors.map((person) => (
                <CoreCard key={person.name} person={person} />
              ))}
            </div>
          </div>
        )}
        {page === 2 && (
          <div className="animate-in fade-in duration-200">
            <h2 className="text-sm font-medium text-zinc-500 mb-3 tracking-wide">
              内容致谢
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 [&>*]:my-0">
              {contentContributors.map((c) => (
                <Credit
                  key={`${c.author}-${c.title}`}
                  platform={c.platform}
                  author={c.author}
                  url={c.url}
                  title={c.title}
                />
              ))}
            </div>
            <p className="mt-4 text-sm text-zinc-500 text-center">
              以及所有不愿意透露姓名的贡献者
            </p>
          </div>
        )}
      </div>

      <Pagination page={page} total={totalPages} onPageChange={setPage} />
    </div>
  );
}
