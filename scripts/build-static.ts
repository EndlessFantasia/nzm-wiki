import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { isS4SeasonTalentDraft } from "./static-build-config";
import { assertStaticExport } from "./static-export-check";

try {
  console.log("[START] Preparing for static build...");
  execSync("pnpm overlimit check", { stdio: "inherit" });
  execSync("pnpm perks:check", { stdio: "inherit" });
  execSync("pnpm num-modifier:check", { stdio: "inherit" });
  execSync("pnpm multiplier-index:check", { stdio: "inherit" });
  execSync("pnpm weapon-mode-diff:check", { stdio: "inherit" });

  console.log("[INDEX] Generating search index and sitemap...");
  execSync("pnpm exec tsx scripts/generate-search-index.ts", { stdio: "inherit" });
  execSync("pnpm exec tsx scripts/generate-sitemap.ts", { stdio: "inherit" });

  // Next cleans production output and types itself, retaining .next/cache.
  // tsconfig.build.json excludes dev route validators; no source directories move.
  console.log("[BUILD] Running Next.js static export...");
  execSync("pnpm exec next build", { stdio: "inherit" });
  console.log(`[EXPORT] Verified ${assertStaticExport()} published overlimit and S4 talent pages and the active Next config.`);

  if (isS4SeasonTalentDraft()) {
    // Prune only the exported copy; public assets remain available in dev.
    const outputDir = path.resolve("out");
    const draftAssets = path.resolve(outputDir, "webp/images/season-talents/s4");
    if (!draftAssets.startsWith(`${outputDir}${path.sep}`)) throw new Error("Invalid static asset output path");
    fs.rmSync(draftAssets, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  console.log("[SUCCESS] Build completed successfully.");
} catch (error) {
  console.error("\n[ERROR] Build failed.");
  console.error(error);
  process.exitCode = 1;
}
