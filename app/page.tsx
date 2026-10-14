import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  BookOpenText,
  GalleryVerticalEnd,
  GitBranch,
  Search,
  Skull,
  Sword,
  Target,
  Terminal,
  Zap,
} from "lucide-react";
import { getAssetPath } from "@/lib/path";
import { IcpFilingNotice } from "@/components/IcpFilingNotice";
import { HomeBackdrop } from "@/components/HomeBackdrop";

const GITHUB_FORK = "https://github.com/lostlightll/nzm-wiki";

interface NavCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  index: number;
}

const NAV_ITEMS = [
  {
    href: "/weapons",
    icon: <Sword className="h-8 w-8 sm:h-10 sm:w-10" />,
    title: "武器图鉴",
  },
  {
    href: "/perks",
    icon: <Zap className="h-8 w-8 sm:h-10 sm:w-10" />,
    title: "插件图鉴",
  },
  {
    href: "/tower-defense",
    icon: <Target className="h-8 w-8 sm:h-10 sm:w-10" />,
    title: "塔防图鉴",
  },
  {
    href: "/bosses",
    icon: <Skull className="h-8 w-8 sm:h-10 sm:w-10" />,
    title: "敌人图鉴",
  },
  {
    href: "/overlimit",
    icon: <GalleryVerticalEnd className="h-8 w-8 sm:h-10 sm:w-10" />,
    title: "超限图鉴",
  },
  {
    href: "/builds",
    icon: <BookOpenText className="h-8 w-8 sm:h-10 sm:w-10" />,
    title: "攻略搭配",
  },
];

function NavCard({ href, icon, title, index }: NavCardProps) {
  return (
    <Link
      href={href}
      style={{ "--i": index } as React.CSSProperties}
      className="home-nav-card group flex flex-col items-center justify-center rounded-xl border border-zinc-600/90 bg-zinc-800/50 px-4 transition-[transform,border-color,background-color,box-shadow] duration-200 hover:scale-[1.02] hover:border-zinc-400/80 hover:bg-zinc-700/50 focus-visible:border-zinc-300 focus-visible:outline-none active:scale-[0.98]"
    >
      <span className="home-nav-icon relative z-10 text-zinc-400 transition-colors group-hover:text-white">
        {icon}
      </span>
      <span className="home-nav-label relative z-10 mt-2 text-base font-medium text-white sm:text-lg">
        {title}
      </span>
      <span aria-hidden="true" className="home-nav-accent" />
    </Link>
  );
}

export default function Home() {
  return (
    <main className="home-page relative h-[calc(100dvh-3.5rem)] overflow-hidden bg-background px-4">
      <HomeBackdrop />
      <div className="home-shell relative mx-auto flex h-full w-full max-w-md flex-col items-center justify-center xl:-left-8 2xl:-left-14">
        {/* Logo 和标题 */}
        <div className="home-header flex shrink-0 flex-col items-center text-center">
          <span
            className="home-logo-wrap"
            style={{ "--logo-mask": `url("${getAssetPath("/logo.png")}")` } as React.CSSProperties}
          >
            <Image
              src={getAssetPath("/logo.png")}
              alt="逆战未来 维基"
              width={180}
              height={180}
              className="home-logo"
              priority
            />
          </span>
          <h1 className="text-2xl font-bold tracking-normal text-zinc-100 sm:text-4xl">
            逆战未来 维基
          </h1>
          <p className="home-subtitle mt-1 text-sm text-zinc-400 sm:mt-1.5 sm:text-base">
            武器、插件、首领、超限卡片、塔防与攻略机制资料库
          </p>
        </div>

        {/* 导航卡片网格 */}
        <div className="w-full max-w-md">
          <div className="home-nav-grid grid grid-cols-2 gap-2 sm:gap-3">
            {NAV_ITEMS.map((item, index) => (
              <NavCard
                key={item.href}
                href={item.href}
                icon={item.icon}
                title={item.title}
                index={index}
              />
            ))}
          </div>
        </div>

        {/* 社区维护信息 */}
        <section className="home-community w-full max-w-[26rem] shrink-0 rounded-xl border border-zinc-700/90 bg-zinc-900/60 px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <GitBranch aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" />
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">社区维护项目</h2>
                <p className="mt-0.5 text-xs text-zinc-400">
                  基于 qiekn/nzm-wiki 构建
                </p>
              </div>
            </div>
            <a
              href={GITHUB_FORK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-100"
            >
              查看仓库
              <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="home-community-details">
            <div className="my-3 h-px bg-zinc-700/70" />
            <p className="text-sm leading-relaxed text-zinc-300">
              原项目的武器与怪物资料可能不完整，本站将继续补充与维护，欢迎反馈。
            </p>
            <div className="mt-3 flex items-center justify-center gap-4 border-t border-zinc-700/70 pt-2.5 text-xs text-zinc-400">
              <a
                href={GITHUB_FORK}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-zinc-100"
              >
                项目说明
              </a>
              <Link href="/credits" className="transition-colors hover:text-zinc-100">
                致谢名单
              </Link>
              <a
                href={`${GITHUB_FORK}/issues`}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-zinc-100"
              >
                问题反馈
              </a>
            </div>
          </div>
        </section>

        {/* 快捷键提示 */}
        <div className="home-shortcuts hidden items-center justify-center gap-4 rounded-xl border border-zinc-700/80 bg-zinc-900/60 px-5 py-2.5 text-xs text-zinc-400 sm:flex">
          <span className="flex items-center gap-2">
            <Search aria-hidden="true" className="h-4 w-4" />
            <span>搜索资料</span>
            <kbd className="rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-300">Ctrl P</kbd>
          </span>
          <span aria-hidden="true" className="h-5 w-px bg-zinc-700" />
          <span className="flex items-center gap-2">
            <Terminal aria-hidden="true" className="h-4 w-4" />
            <span>命令面板</span>
            <kbd className="rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-300">Ctrl Shift P</kbd>
          </span>
        </div>
        <IcpFilingNotice />
      </div>
    </main>
  );
}
