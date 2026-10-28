"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Calculator, Search, Github, Pencil, History } from "lucide-react";
import { usePresence } from "@/hooks/usePresence";

// GitHub 仓库基础 URL
const GITHUB_REPO_URL = "https://github.com/qiekn/nzm-wiki/blob/main";
const GITHUB_COMMITS_URL = "https://github.com/qiekn/nzm-wiki/commits/main";

// URL 路径到 data 目录的映射
const PATH_TO_DATA_MAP: Record<string, string> = {
  "/weapons": "data/weapons",
  "/perks": "data/perks",
  "/traps": "data/traps",
  "/bosses": "data/enemies/lc/boss",
  "/enemies/lc/monsters": "data/enemies/lc/monsters",
  "/enemies/lc": "data/enemies/lc/boss",
  "/enemies/td": "data/enemies/td",
  "/cards": "data/cards",
  "/builds": "data/builds",
  "/posts": "data/posts",
};

/**
 * 解析当前 URL 路径，返回 data 目录路径和 slug
 */
function resolveDataPath(): { dataPath: string; slug: string } | null {
  if (typeof window === "undefined") return null;

  const pathname = window.location.pathname;

  // 移除 basePath（如 /nzm-wiki）
  const basePath = process.env.NODE_ENV === "production" ? "/nzm-wiki" : "";
  const relativePath = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length)
    : pathname;

  if (relativePath.replace(/\/$/, "") === "/enemies/lc/monsters") return null;

  for (const [urlPrefix, dataPath] of Object.entries(PATH_TO_DATA_MAP)) {
    if (relativePath.startsWith(urlPrefix + "/")) {
      const slug = relativePath.slice(urlPrefix.length + 1);
      if (slug) {
        return { dataPath, slug: decodeURIComponent(slug) };
      }
    }
  }

  return null;
}

/**
 * 根据当前 URL 路径获取对应的 GitHub 编辑链接
 */
function getGitHubEditUrl(): string | null {
  const resolved = resolveDataPath();
  if (!resolved) return null;
  return `${GITHUB_REPO_URL}/${resolved.dataPath}/${resolved.slug}.mdx?plain=1`;
}

/**
 * 根据当前 URL 路径获取对应的 Editor 链接（仅 dev 模式）
 */
function getEditorUrl(): string | null {
  if (process.env.NODE_ENV !== "development") return null;
  const resolved = resolveDataPath();
  if (!resolved || resolved.dataPath !== "data/builds") return null;
  // editor API 的 file 参数是相对于 data/ 的路径
  const relativePath = resolved.dataPath.replace(/^data\//, "");
  return `/editor/builds?file=${encodeURIComponent(`${relativePath}/${resolved.slug}.mdx`)}`;
}

/**
 * 根据当前 URL 路径获取对应的 GitHub 提交历史链接
 */
function getGitHubCommitsUrl(): string | null {
  const resolved = resolveDataPath();
  if (!resolved) return null;
  return `${GITHUB_COMMITS_URL}/${resolved.dataPath}/${resolved.slug}.mdx`;
}

interface Command {
  id: string;
  name: string;
  description?: string;
  icon?: React.ReactNode;
  action: () => void;
  hidden?: boolean; // 是否隐藏（条件不满足时）
}

interface CommandPaletteProps {
  commands: Command[];
}

export function CommandPalette({ commands }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [githubEditUrl, setGithubEditUrl] = useState<string | null>(null);
  const [githubCommitsUrl, setGithubCommitsUrl] = useState<string | null>(null);
  const [editorUrl, setEditorUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const presence = usePresence(isOpen, "palette-panel-out");

  const openPalette = useCallback(() => {
    setQuery("");
    setSelectedIndex(0);
    setGithubEditUrl(getGitHubEditUrl());
    setGithubCommitsUrl(getGitHubCommitsUrl());
    setEditorUrl(getEditorUrl());
    setIsOpen(true);
  }, []);

  // 合并命令列表（包括动态命令）
  const allCommands = useMemo(() => {
    const cmds = [...commands];

    if (editorUrl) {
      cmds.push({
        id: "editor",
        name: "在编辑器中打开",
        description: "在内置编辑器中编辑当前页面",
        icon: <Pencil className="h-4 w-4" />,
        action: () => {
          window.location.href = editorUrl;
        },
      });
    }

    if (githubEditUrl) {
      cmds.push({
        id: "github-edit",
        name: "在 GitHub 上编辑",
        description: "打开当前页面对应的 MDX 文件",
        icon: <Github className="h-4 w-4" />,
        action: () => {
          window.open(githubEditUrl, "_blank");
        },
      });
    }

    if (githubCommitsUrl) {
      cmds.push({
        id: "history",
        name: "查看更新记录",
        description: "查看当前页面的 Git 提交历史",
        icon: <History className="h-4 w-4" />,
        action: () => {
          window.open(githubCommitsUrl, "_blank");
        },
      });
    }

    return cmds;
  }, [commands, githubEditUrl, githubCommitsUrl, editorUrl]);

  // 过滤命令
  const filteredCommands = allCommands.filter(
    (cmd) =>
      !cmd.hidden &&
      (cmd.name.toLowerCase().includes(query.toLowerCase()) ||
        cmd.id.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(query.toLowerCase()))
  );

  // 快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+P 或 Cmd+Shift+P
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (isOpen) {
          setIsOpen(false);
        } else {
          openPalette();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, openPalette]);

  // 打开时聚焦
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(0);
  };

  const executeCommand = useCallback(
    (cmd: Command) => {
      setIsOpen(false);
      cmd.action();
    },
    []
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) =>
          i < filteredCommands.length - 1 ? i + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) =>
          i > 0 ? i - 1 : filteredCommands.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  if (!presence.mounted) return null;

  return (
    <div
      data-state={presence.state}
      inert={!isOpen}
      onAnimationEnd={presence.onAnimationEnd}
      className="palette fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
    >
      {/* 背景遮罩 */}
      <div
        className="palette-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* 命令面板 */}
      <div className="palette-panel relative w-full max-w-lg mx-4 overflow-hidden rounded-xl bg-zinc-900 shadow-2xl ring-1 ring-zinc-700">
        {/* 搜索框 */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <Search className="h-5 w-5 text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder="输入命令..."
            className="flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500 sm:inline">
            ESC
          </kbd>
        </div>

        {/* 命令列表 */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-zinc-500">
              没有找到匹配的命令
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={() => executeCommand(cmd)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  index === selectedIndex
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
              >
                {cmd.icon && (
                  <span className="flex h-8 w-8 items-center justify-center rounded bg-zinc-800 text-zinc-400">
                    {cmd.icon}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{cmd.name}</div>
                  {cmd.description && (
                    <div className="text-xs text-zinc-500 truncate">
                      {cmd.description}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2 text-xs text-zinc-600">
          <div className="flex gap-2">
            <span>
              <kbd className="rounded bg-zinc-800 px-1 py-0.5">↑↓</kbd> 选择
            </span>
            <span>
              <kbd className="rounded bg-zinc-800 px-1 py-0.5">Enter</kbd> 执行
            </span>
          </div>
          <span>
            <kbd className="rounded bg-zinc-800 px-1 py-0.5">Ctrl+Shift+P</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}

// 预定义的命令生成器
export function useCommands(options: {
  onOpenCalculator?: () => void;
}) {
  const commands: Command[] = [];

  if (options.onOpenCalculator) {
    commands.push({
      id: "calculator",
      name: "打开计算器",
      description: "通用多行计算与乘区连乘",
      icon: <Calculator className="h-4 w-4" />,
      action: options.onOpenCalculator,
    });
  }

  return commands;
}
