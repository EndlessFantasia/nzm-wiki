import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { LEGACY_TALENT_CATALOG, legacyTalentHref } from "../lib/s0s1-talent-presentation";
import { getOverlimitCatalog, getOverlimitPreviewCatalog } from "../lib/overlimit";
import { getAllPublishedPerks } from "../lib/perks";
import { getPerkPreviewCatalog } from "../lib/perk-preview";

const SITE_URL = "https://nzm-wiki.com";
const baseDir = path.join(process.cwd(), "data");

// 路径映射（与 generate-search-index.ts 保持一致）
const pathMap: Record<string, string> = {
  weapons: "/weapons",
  perks: "/perks",
  traps: "/traps",
  "enemies/lc/boss": "/bosses",
  "enemies/lc/monsters": "/enemies/lc/monsters",
  "enemies/td": "/enemies/td",
  cards: "/cards",
  posts: "/posts",
  builds: "/builds",
};

interface PageEntry {
  url: string;
  lastmod?: string;
}

function scanDirectory(dirPath: string, relativePath: string = ""): PageEntry[] {
  const results: PageEntry[] = [];

  if (!fs.existsSync(dirPath)) {
    return results;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // 插件只从正式发布服务和预览投影收录，不扫描预览编辑草稿。
      if (["perks", "perk-preview"].includes(entry.name)) continue;
      if (entry.name.startsWith("(")) {
        results.push(...scanDirectory(fullPath, relativePath));
      } else {
        const currentRelativePath = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;
        results.push(...scanDirectory(fullPath, currentRelativePath));
      }
    } else if (entry.name.endsWith(".mdx")) {
      const fileContent = fs.readFileSync(fullPath, "utf-8");
      const { data } = matter(fileContent);

      // draft 文章不加入 sitemap
      if (data.draft) continue;

      const fileName = entry.name.replace(/\.mdx$/, "");
      const slug = relativePath ? `${relativePath}/${fileName}` : fileName;

      // 猎场精英敌人尚未有公开路由，不写入站点地图。
      if (slug.startsWith("enemies/lc/elite/")) continue;
      // 猎场怪物血量链路尚未补全，暂时停止公开收录。
      if (slug.startsWith("enemies/lc/monsters/")) continue;

      const stat = fs.statSync(fullPath);
      const lastmod = stat.mtime.toISOString().split("T")[0];
      if (relativePath === "weapons" && Array.isArray(data.game_modes)) {
        for (const mode of data.game_modes) {
          if (mode !== "lc" && mode !== "td") continue;
          results.push({
            url: `/weapons${mode === "td" ? "/td" : ""}/${fileName}`,
            lastmod,
          });
        }
        continue;
      }

      // 确定 URL 路径
      let urlPath = "";
      for (const [prefix, p] of Object.entries(pathMap)) {
        if (slug.startsWith(prefix)) {
          const remainder = slug.slice(prefix.length);
          urlPath = p + remainder;
          break;
        }
      }
      if (!urlPath) {
        urlPath = `/${slug}`;
      }

      // 获取文件修改时间
      results.push({ url: urlPath, lastmod });
    }
  }

  return results;
}

function generateSitemap() {
  console.log("Generating sitemap...");

  const pages = scanDirectory(baseDir);
  pages.push(...getAllPublishedPerks().map((perk) => ({ url: `/perks/${perk.slug}` })));
  const overlimit = getOverlimitCatalog();
  const overlimitPreview = getOverlimitPreviewCatalog();

  // 添加静态页面
  const staticPages: PageEntry[] = [
    { url: "/" },
    { url: "/weapons" },
    { url: "/perks" },
    ...(getPerkPreviewCatalog() ? [{ url: "/perks/preview" }] : []),
    { url: "/overlimit", lastmod: overlimit.season.updatedAt },
    { url: "/origin" },
    ...(overlimitPreview ? [{ url: "/overlimit/preview", lastmod: overlimitPreview.season.updatedAt }] : []),
    { url: "/tower-defense" },
    { url: "/traps" },
    { url: "/enemies" },
    { url: "/bosses" },
    { url: "/enemies/lc/shooting-range" },
    { url: "/enemies/td" },
    { url: "/guides" },
    { url: "/multiplier" },
    { url: "/season-talents" },
    ...LEGACY_TALENT_CATALOG.map(talent => ({ url: legacyTalentHref(talent.season, talent.id) })),
    { url: "/builds" },
    { url: "/guides/season-talents/s3/iron-fist" },
    { url: "/guides/season-talents/s2/invisibility" },
    { url: "/guides/season-talents/s2/inferno-arm" },
    { url: "/guides/season-talents/s2/holographic-sync" },
    { url: "/guides/season-talents/s3/zero" },
    { url: "/guides/season-talents/s3/grappling-hook" },
    { url: "/posts" },
    { url: "/damage" },
    { url: "/credits" },
  ];

  const overlimitPages: PageEntry[] = [...overlimit.cards.map((card) => ({
    url: `/overlimit/${card.id}`,
    lastmod: overlimit.season.updatedAt,
  })), ...(overlimitPreview?.cards.map(card => ({
    url: `/overlimit/preview/${card.id}`, lastmod: overlimitPreview.season.updatedAt,
  })) ?? [])];

  const s4SeasonTalentPages: PageEntry[] = [
    "dual-star",
    "matrix-symbiosis",
    "black-hole",
  ].flatMap((talentId) => {
    const talentFile = path.join(
      baseDir,
      "season-talents",
      "s4",
      `${talentId}.json`,
    );
    if (!fs.existsSync(talentFile)) return [];

    const talent = JSON.parse(fs.readFileSync(talentFile, "utf-8")) as {
      draft?: boolean;
    };
    if (talent.draft === true) return [];

    return [
      {
        url: `/guides/season-talents/s4/${talentId}`,
        lastmod: fs.statSync(talentFile).mtime.toISOString().split("T")[0],
      },
    ];
  });

  const allPages = [
    ...staticPages,
    ...pages,
    ...overlimitPages,
    ...s4SeasonTalentPages,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${SITE_URL}${page.url}</loc>${
      page.lastmod ? `\n    <lastmod>${page.lastmod}</lastmod>` : ""
    }
  </url>`
  )
  .join("\n")}
</urlset>
`;

  const outputPath = path.join(process.cwd(), "public", "sitemap.xml");
  fs.writeFileSync(outputPath, xml, "utf-8");

  console.log(`Generated sitemap with ${allPages.length} URLs`);
  console.log(`Output: ${outputPath}`);
}

generateSitemap();
