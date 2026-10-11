import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { getPageExtensions } from "./scripts/static-build-config";

// 直接读取 GitHub Action 注入的环境变量
// 如果在本地开发，这个变量通常不存在，默认为空字符串，正好符合本地开发需求
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  agentRules: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  pageExtensions: getPageExtensions(isDev),
  typescript: { tsconfigPath: isDev ? "tsconfig.json" : "tsconfig.build.json" },
  output: isDev ? undefined : "export",
  // output: "export",

  // 使用读取到的路径
  basePath: basePath,
  assetPrefix: basePath ? `${basePath}/` : "",

  images: {
    unoptimized: true,
  },

  // 再次确保环境变量能传递给前端组件 (client.tsx)
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
