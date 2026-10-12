import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { getPageExtensions, isS4SeasonTalentDraft } from "./static-build-config";

/** Check the actual build config and exported pages, rather than compiler success alone. */
export function assertStaticExport(root = process.cwd()): number {
  const manifestFile = path.join(root, process.env.NEXT_DIST_DIR || ".next", "required-server-files.json");
  const { config } = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as {
    config: { configFileName: string; pageExtensions: string[] };
  };
  const expectedExtensions = getPageExtensions(false, root);
  if (config.configFileName !== "next.config.ts" ||
    !isDeepStrictEqual([...config.pageExtensions].sort(), expectedExtensions.sort())) {
    throw new Error(`Static export used ${config.configFileName} with unexpected pageExtensions; ` +
      "next.config.ts must remain the only Next configuration. Check deployment config injection.");
  }

  const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/overlimit/current.json"), "utf8")) as {
    withdrawn?: boolean; cards: { id: string }[];
  };
  const requiredPages = catalog.withdrawn === true ? [] : catalog.cards.map(card => `/overlimit/${card.id}`);
  if (!isS4SeasonTalentDraft(root)) {
    requiredPages.push(...["black-hole", "dual-star", "matrix-symbiosis"].map(id => `/guides/season-talents/s4/${id}`));
  }
  const missing = requiredPages.filter(route => {
    const outputPath = path.join(root, "out", route.slice(1));
    return ![`${outputPath}.html`, path.join(outputPath, "index.html")].some(file =>
      fs.existsSync(file) && fs.statSync(file).isFile());
  });
  if (missing.length > 0) {
    throw new Error(`Static export is missing ${missing.length} published pages: ${missing.slice(0, 5).join(", ")}`);
  }
  return requiredPages.length;
}
