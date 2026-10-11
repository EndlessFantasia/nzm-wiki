import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

function readJson(root: string, file: string) {
  const filePath = path.join(root, file);
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : null;
}

export function isS4SeasonTalentDraft(root = process.cwd()): boolean {
  return ["black-hole", "dual-star", "matrix-symbiosis", "passives"].some(name => {
    const data = readJson(root, `data/season-talents/s4/${name}.json`);
    return !data || data.draft === true;
  });
}

// Composite extensions let Next discover only the routes available in this build.
// Source files stay in place, including when a build fails or dev is running.
export function getPageExtensions(isDev: boolean, root = process.cwd()): string[] {
  const buildsDir = path.join(root, "data/builds");
  const hasBuildGuides = fs.existsSync(buildsDir) && fs.readdirSync(buildsDir)
    .filter(file => file.endsWith(".mdx"))
    .some(file => matter(fs.readFileSync(path.join(buildsDir, file), "utf8")).data.draft !== true);
  const routes = {
    "dev.ts": isDev,
    "dev.tsx": isDev,
    "overlimit.tsx": isDev || readJson(root, "data/overlimit/current.json")?.withdrawn !== true,
    "overlimit-preview.tsx": isDev || Boolean(readJson(root, "data/overlimit/preview.json")),
    "perk-preview.tsx": isDev || Boolean(readJson(root, "config/content-version.json")?.preview && readJson(root, "data/perk-preview/preview.json")),
    "build-guide.tsx": isDev || hasBuildGuides,
    "s4-talent.tsx": isDev || !isS4SeasonTalentDraft(root),
  };
  return [...Object.entries(routes).filter(([, enabled]) => enabled).map(([extension]) => extension), "js", "jsx", "md", "mdx", "ts", "tsx"];
}
