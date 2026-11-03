export type SiteNavItemId =
  | "weapons"
  | "perks"
  | "enemies"
  | "tower-defense"
  | "overlimit"
  | "origin"
  | "survival"
  | "season-talents"
  | "builds"
  | "multiplier"
  | "articles"
  | "credits";

export interface SiteNavItem {
  id: SiteNavItemId;
  label: string;
  href: string;
}

export interface SiteNavSection {
  id: "catalogs" | "gameplay" | "guides";
  label: string;
  items: readonly SiteNavItem[];
}

export interface SiteNavigationLocation {
  pathname: string;
  hash?: string;
}

export interface ResolvedSiteNavigation {
  activeItemId: SiteNavItemId | null;
  sectionLabel: string | null;
  itemLabel: string;
}

export const SITE_NAVIGATION_CHANGE_EVENT =
  "nzm-wiki:site-navigation-change";

export const SITE_NAV_SECTIONS: readonly SiteNavSection[] = [
  {
    id: "catalogs",
    label: "图鉴",
    items: [
      { id: "weapons", label: "武器图鉴", href: "/weapons" },
      { id: "perks", label: "插件图鉴", href: "/perks" },
      { id: "enemies", label: "敌人图鉴", href: "/bosses" },
    ],
  },
  {
    id: "gameplay",
    label: "玩法",
    items: [
      {
        id: "tower-defense",
        label: "塔防图鉴",
        href: "/tower-defense",
      },
      { id: "overlimit", label: "超限图鉴", href: "/overlimit" },
      { id: "origin", label: "原点图鉴", href: "/origin" },
      { id: "survival", label: "生存战图鉴", href: "/survival" },
    ],
  },
  {
    id: "guides",
    label: "攻略资料",
    items: [
      {
        id: "multiplier",
        label: "游戏乘区",
        href: "/multiplier",
      },
      {
        id: "season-talents",
        label: "赛季天赋",
        href: "/season-talents",
      },
      {
        id: "builds",
        label: "搭配攻略",
        href: "/builds",
      },
      {
        id: "articles",
        label: "攻略文章",
        href: "/posts",
      },
    ],
  },
];

export const SITE_NAV_FOOTER_ITEM: SiteNavItem = {
  id: "credits",
  label: "致谢",
  href: "/credits",
};

function normalizePathname(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

function isPath(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function resolveItem(id: SiteNavItemId): ResolvedSiteNavigation {
  const section = SITE_NAV_SECTIONS.find((candidate) =>
    candidate.items.some((item) => item.id === id),
  );
  const item =
    section?.items.find((candidate) => candidate.id === id) ??
    (SITE_NAV_FOOTER_ITEM.id === id ? SITE_NAV_FOOTER_ITEM : null);

  if (!item) {
    throw new Error(`Unknown site navigation item: ${id}`);
  }

  return {
    activeItemId: id,
    sectionLabel: section?.label ?? null,
    itemLabel: item.label,
  };
}

export function resolveSiteNavigation({
  pathname,
  hash = "",
}: SiteNavigationLocation): ResolvedSiteNavigation | null {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedHash = hash.replace(/^#/, "");

  if (normalizedPathname === "/") {
    return { activeItemId: null, sectionLabel: null, itemLabel: "首页" };
  }

  if (
    isPath(normalizedPathname, "/tower-defense") ||
    isPath(normalizedPathname, "/weapons/td") ||
    isPath(normalizedPathname, "/traps") ||
    isPath(normalizedPathname, "/enemies/td")
  ) {
    return resolveItem("tower-defense");
  }

  if (
    normalizedPathname === "/season-talents" ||
    isPath(normalizedPathname, "/guides/season-talents") ||
    (normalizedPathname === "/guides" && normalizedHash === "season-talents")
  ) {
    return resolveItem("season-talents");
  }

  if (isPath(normalizedPathname, "/builds")) {
    return resolveItem("builds");
  }

  if (
    isPath(normalizedPathname, "/posts") ||
    (normalizedPathname === "/guides" && normalizedHash === "archive")
  ) {
    return resolveItem("articles");
  }

  if (normalizedPathname === "/multiplier") {
    return resolveItem("multiplier");
  }

  if (normalizedPathname === "/guides") {
    return resolveItem("multiplier");
  }

  if (isPath(normalizedPathname, "/weapons")) {
    return resolveItem("weapons");
  }

  if (isPath(normalizedPathname, "/perks")) {
    return resolveItem("perks");
  }

  if (
    isPath(normalizedPathname, "/bosses") ||
    isPath(normalizedPathname, "/enemies")
  ) {
    return resolveItem("enemies");
  }

  if (isPath(normalizedPathname, "/overlimit")) {
    return resolveItem("overlimit");
  }

  if (isPath(normalizedPathname, "/origin")) {
    return resolveItem("origin");
  }

  if (isPath(normalizedPathname, "/survival")) {
    return resolveItem("survival");
  }

  if (normalizedPathname === "/credits") {
    return resolveItem("credits");
  }

  return null;
}
