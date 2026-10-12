import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseOverlimitCatalog, type OverlimitCatalog } from "../../lib/overlimit-catalog";
import { getOverlimitMapImagePath } from "../../lib/overlimit-map-images";
import { OVERLIMIT_BOND_ICON_PATHS } from "../../constants/overlimit-bond-icons";

export const CURRENT_FILE = "data/overlimit/current.json";
export const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

export function readCatalog(file: string) {
  return parseOverlimitCatalog(JSON.parse(fs.readFileSync(file, "utf8")));
}

/** Resolve only project-owned image paths, never containers or reference directories. */
export function catalogAssets(catalog: OverlimitCatalog): string[] {
  const urls = new Set<string>();
  const bondNames = new Set(catalog.bonds?.map(bond => bond.name));
  for (const card of catalog.cards) {
    urls.add(card.icon);
    for (const tag of card.tags) {
      if (tag.icon) urls.add(tag.icon);
      bondNames.add(tag.name);
    }
  }
  for (const period of catalog.mapRotation?.periods ?? []) {
    for (const map of period.maps) {
      for (const name of map.activeBonds) bondNames.add(name);
      const url = getOverlimitMapImagePath(map.name);
      if (url) urls.add(url);
    }
  }
  for (const name of bondNames) {
    const icon = OVERLIMIT_BOND_ICON_PATHS[name];
    if (icon) urls.add(icon);
  }
  return [...urls].sort().flatMap(url => {
    if (!/^\/(?!\/)[^?#]+\.(png|webp|jpe?g|svg)$/i.test(url) || url.includes("..") || url.includes("\\")) {
      throw new Error(`Invalid catalog image: ${url}`);
    }
    const original = `public${url}`;
    return /\.(png|jpe?g)$/i.test(url)
      ? [original, `public/webp${url.replace(/\.(png|jpe?g)$/i, ".webp")}`]
      : [original];
  });
}

export function checkCatalog(catalog: OverlimitCatalog, root: string): void {
  const missing = catalogAssets(catalog).filter(file => !fs.existsSync(path.join(root, file)));
  if (missing.length) throw new Error(`Missing published assets:\n${missing.join("\n")}`);
  for (const card of catalog.cards) {
    if (/\{(?:GPModifier|GPNumericalID):|\{\{num:|\?\?/.test(card.description)) {
      throw new Error(`Unresolved description on card ${card.id}`);
    }
  }
}

export function archiveCatalog(root: string, destination: string, extraEvidence?: unknown): string {
  const base = path.resolve(root, "MD/_local/overlimit/archives");
  const target = path.resolve(destination);
  const relative = path.relative(base, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Archive must be a new directory inside MD/_local/overlimit/archives");
  }
  if (fs.existsSync(target)) throw new Error(`Archive already exists: ${target}`);
  const bytes = fs.readFileSync(path.join(root, CURRENT_FILE));
  const catalog = parseOverlimitCatalog(JSON.parse(bytes.toString("utf8")));
  checkCatalog(catalog, root);
  const assets = [...new Set(catalogAssets(catalog))];
  // Read and hash everything before creating the immutable archive directory.
  const files = [
    { name: "catalog.json", bytes },
    ...assets.map(name => ({ name, bytes: fs.readFileSync(path.join(root, name)) })),
    ...(extraEvidence === undefined ? [] : [{ name: "relations.json", bytes: Buffer.from(JSON.stringify(extraEvidence, null, 2) + "\n") }]),
  ];
  fs.mkdirSync(target, { recursive: true });
  for (const file of files) {
    const output = path.join(target, file.name);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, file.bytes, { flag: "wx" });
  }
  fs.writeFileSync(path.join(target, "manifest.json"), JSON.stringify({
    schemaVersion: 1, season: catalog.season, archivedAt: new Date().toISOString(),
    files: files.map(file => ({ path: file.name, bytes: file.bytes.length, sha256: sha256(file.bytes) })),
  }, null, 2) + "\n", { flag: "wx" });
  return target;
}

export function verifyArchive(directory: string): void {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8")) as {
    files: { path: string; bytes: number; sha256: string }[];
  };
  if (!Array.isArray(manifest.files) || !manifest.files.some(file => file.path === "catalog.json")) throw new Error("Invalid archive manifest");
  for (const file of manifest.files) {
    const absolute = path.resolve(directory, file.path);
    const relative = path.relative(path.resolve(directory), absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid archive entry path");
    const bytes = fs.readFileSync(absolute);
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error(`Archive checksum mismatch: ${file.path}`);
  }
  readCatalog(path.join(directory, "catalog.json"));
}

/** Approval records bind a reviewed projection to its exact bytes, not a season name. */
export function reviewedCatalog(root: string, candidateFile: string, reviewFile: string) {
  const bytes = fs.readFileSync(candidateFile);
  const catalog = parseOverlimitCatalog(JSON.parse(bytes.toString("utf8")));
  const review = JSON.parse(fs.readFileSync(reviewFile, "utf8")) as Record<string, unknown>;
  if (review.status !== "approved" || review.catalogSha256 !== sha256(bytes) ||
    typeof review.basis !== "string" || !review.basis.trim()) {
    throw new Error("A reviewed projection requires status=approved, its exact catalogSha256, and an evidence basis");
  }
  checkCatalog(catalog, root);
  return { bytes, catalog };
}

export function activateCatalog(root: string, candidateFile: string, reviewFile: string, archiveDirectory: string): void {
  const { bytes } = reviewedCatalog(root, candidateFile, reviewFile);
  const current = path.join(root, CURRENT_FILE);
  if (bytes.equals(fs.readFileSync(current))) throw new Error("Candidate is already current");
  archiveCatalog(root, archiveDirectory);
  verifyArchive(archiveDirectory);
  const staged = `${current}.pending`;
  fs.writeFileSync(staged, bytes, { flag: "wx" });
  fs.renameSync(staged, current);
}
