"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, FileText, ArrowRight } from "lucide-react";
import { getAssetPath } from "@/lib/path";
import { usePresence } from "@/hooks/usePresence";

interface SearchItem {
  title: string;
  slug: string;
  path: string;
  category: string;
  keywords: string[];
  pinyin: string[];  // 预计算的拼音
}

// 默认显示的快捷入口（无搜索内容时显示）
const DEFAULT_ENTRIES = [
  { title: "武器图鉴", path: "/weapons", category: "导航" },
  { title: "插件图鉴", path: "/perks", category: "导航" },
  { title: "敌人图鉴", path: "/bosses", category: "导航" },
  { title: "靶场", path: "/enemies/lc/shooting-range", category: "导航" },
  { title: "塔防图鉴", path: "/tower-defense", category: "导航" },
  { title: "超限图鉴", path: "/overlimit", category: "导航" },
  { title: "原点图鉴", path: "/origin", category: "导航" },
  { title: "赛季天赋", path: "/season-talents", category: "导航" },
  { title: "游戏乘区", path: "/multiplier", category: "导航" },
  { title: "搭配攻略", path: "/builds", category: "导航" },
  { title: "攻略文章", path: "/posts", category: "导航" },
];

function matchSearch(item: SearchItem, query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // 匹配标题
  if (item.title.toLowerCase().includes(lowerQuery)) return true;

  // 匹配关键词
  for (const keyword of item.keywords) {
    if (String(keyword).toLowerCase().includes(lowerQuery)) return true;
  }

  // 匹配预计算的拼音
  if (item.pinyin) {
    for (const py of item.pinyin) {
      if (py.includes(lowerQuery)) return true;
    }
  }

  return false;
}

function searchScore(item: SearchItem, query: string): number {
  const normalized = query.toLowerCase();
  const title = item.title.toLowerCase();
  let score = 100;

  if (title === normalized) score = 0;
  else if (title.startsWith(normalized)) score = 10;
  else if (title.includes(normalized)) score = 20;
  else if (item.keywords.some((keyword) => String(keyword).toLowerCase() === normalized)) score = 30;
  else if (item.keywords.some((keyword) => String(keyword).toLowerCase().startsWith(normalized))) score = 40;
  else if (item.keywords.some((keyword) => String(keyword).toLowerCase().includes(normalized))) score = 50;
  else if (item.pinyin?.some((value) => value.startsWith(normalized))) score = 60;
  else if (item.pinyin?.some((value) => value.includes(normalized))) score = 70;

  // A concrete page should precede Buffs that merely list it as related content.
  if (item.category === "状态效果") score += 1;
  return score;
}

// 分类图标颜色
const categoryColors: Record<string, string> = {
  武器: "text-amber-400",
  特性: "text-purple-400",
  陷阱: "text-green-400",
  首领: "text-red-400",
  塔防敌人: "text-orange-400",
  卡牌: "text-blue-400",
  状态效果: "text-cyan-400",
  召唤物: "text-emerald-400",
  文章: "text-zinc-400",
  搭配攻略: "text-amber-300",
};

export function SearchPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchData, setSearchData] = useState<SearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const presence = usePresence(isOpen, "palette-panel-out");

  // 加载搜索数据
  useEffect(() => {
    if (isOpen && searchData.length === 0) {
      setIsLoading(true);
      fetch(getAssetPath("/search-index.json"))
        .then((res) => res.json())
        .then((data) => {
          setSearchData(data);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load search index:", err);
          setIsLoading(false);
        });
    }
  }, [isOpen, searchData.length]);

  // 过滤结果
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      // 默认不加载全部，返回空数组
      return [];
    }
    const normalized = query.trim();
    return searchData
      .filter((item) => matchSearch(item, normalized))
      .sort((left, right) =>
        searchScore(left, normalized) - searchScore(right, normalized) ||
        left.title.localeCompare(right.title, "zh-CN"),
      );
  }, [searchData, query]);

  // 显示的项目：有搜索词时显示搜索结果，否则显示默认入口
  const displayItems = useMemo(() => {
    if (query.trim()) {
      return filteredItems;
    }
    // 返回默认入口（转换为 SearchItem 格式）
    return DEFAULT_ENTRIES.map((entry) => ({
      ...entry,
      slug: entry.path,
      keywords: [],
      pinyin: [],
    }));
  }, [query, filteredItems]);

  // 按分类分组
  const groupedItems = useMemo(() => {
    const groups: Record<string, SearchItem[]> = {};
    for (const item of displayItems) {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    }
    return groups;
  }, [displayItems]);

  // 扁平化列表（用于键盘导航）
  const flatItems = useMemo(() => {
    return Object.values(groupedItems).flat();
  }, [groupedItems]);

  // 快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P 或 Cmd+P（不带 Shift）
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 打开时聚焦
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // 选中项变化时重置
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // 滚动到选中项
  useEffect(() => {
    if (listRef.current && flatItems.length > 0) {
      const selectedEl = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, flatItems.length]);

  const navigateTo = useCallback((item: SearchItem) => {
    setIsOpen(false);
    window.location.href = getAssetPath(item.path);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => (i < flatItems.length - 1 ? i + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => (i > 0 ? i - 1 : flatItems.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          navigateTo(flatItems[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  if (!presence.mounted) return null;

  let currentIndex = 0;

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

      {/* 搜索面板 */}
      <div className="palette-panel relative w-full max-w-xl mx-4 overflow-hidden rounded-xl bg-zinc-900 shadow-2xl ring-1 ring-zinc-700">
        {/* 搜索框 */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <Search className="h-5 w-5 text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索页面..."
            className="flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500 sm:inline">
            ESC
          </kbd>
        </div>

        {/* 搜索结果 */}
        <div ref={listRef} className="max-h-96 overflow-y-auto p-2">
          {isLoading ? (
            <div className="px-3 py-8 text-center text-sm text-zinc-500">
              加载中...
            </div>
          ) : query.trim() && flatItems.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-zinc-500">
              没有找到匹配的结果
            </div>
          ) : (
            Object.entries(groupedItems).map(([category, items]) => (
              <div key={category} className="mb-2">
                <div className="px-3 py-1 text-xs font-medium text-zinc-500">
                  {category}
                </div>
                {items.map((item) => {
                  const index = currentIndex++;
                  return (
                    <button
                      key={item.slug}
                      data-index={index}
                      onClick={() => navigateTo(item)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                        index === selectedIndex
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded bg-zinc-800 ${
                          categoryColors[category] || "text-zinc-400"
                        }`}
                      >
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {item.title}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">
                          {item.path}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-zinc-600" />
                    </button>
                  );
                })}
              </div>
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
              <kbd className="rounded bg-zinc-800 px-1 py-0.5">Enter</kbd> 打开
            </span>
          </div>
          <span>
            <kbd className="rounded bg-zinc-800 px-1 py-0.5">Ctrl+P</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
