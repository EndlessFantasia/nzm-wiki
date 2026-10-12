import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { captureCurrent } from "./capture";
import { diffVersions, exportVersion, listVersions, saveVersion, verifyVersion } from "./store";
import { assertReleaseReady, git, prepareRelease, readRelease, RELEASE_FILE, writeRelease } from "./release";
import { getPreviewSeasonKey, isPreviewSeason } from "../../lib/content-preview";
import { withdrawCurrent } from "./withdraw";
import { planPromotion, applyPromotion } from "./promotion";

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  season: { type: "string" }, version: { type: "string" }, archive: { type: "string" },
  left: { type: "string" }, right: { type: "string" }, output: { type: "string" },
  "content-root": { type: "string" }, baseline: { type: "string" }, candidate: { type: "string" },
  review: { type: "string" }, "perk-providers": { type: "string" }, write: { type: "boolean" },
} });
const root = process.cwd();
function required(key: keyof typeof values): string {
  const value = values[key];
  if (typeof value !== "string" || !value) throw new Error(`Missing --${key}`);
  return value;
}

async function archiveCurrent(includePreview = false) {
  const release = readRelease(root);
  if (release.phase !== "current") throw new Error("Finalize a candidate before archiving it as a release");
  const [{ getAllPublishedPerks }, { getOverlimitCatalog }] = await Promise.all([
    import("../../lib/perks"), import("../../lib/overlimit"),
  ]);
  assertReleaseReady(release, getOverlimitCatalog(), getAllPublishedPerks());
  const preview = release.preview;
  if (includePreview && !preview) throw new Error("No active preview is registered");
  if (includePreview && getAllPublishedPerks().some(perk => isPreviewSeason(perk.season) && perk.season !== getPreviewSeasonKey(preview!))) {
    throw new Error("Preview content does not match the registered transition");
  }
  const snapshot = await captureCurrent(root, { includePreview });
  snapshot.files[RELEASE_FILE] = fs.readFileSync(path.join(root, RELEASE_FILE));
  snapshot.files["evidence/git.json"] = Buffer.from(JSON.stringify({
    commit: git(root, ["rev-parse", "HEAD"]),
    dirty: Boolean(git(root, ["status", "--porcelain", "--", "data", "lib", "components", "app", "public", "config"])),
    note: "The archived file bytes and resolved results are authoritative; commit records code provenance.",
  }, null, 2) + "\n");
  return saveVersion(root, includePreview ? { season: preview!.season, version: preview!.version } : { season: release.season, version: release.version }, {
    ...snapshot,
    summary: { ...snapshot.summary, channel: includePreview ? "preview" : "current",
      ...(includePreview ? { preview, baseRelease: { season: release.season, version: release.version } } : {}) },
  });
}

async function main() {
  switch (positionals[0]) {
    case "promote": {
      const options = { root, season: required("season"), version: required("version"),
        contentRoot: path.resolve(required("content-root")), archive: path.resolve(required("archive")),
        baseline: path.resolve(required("baseline")), candidate: path.resolve(required("candidate")),
        review: path.resolve(required("review")),
        perkProviders: values["perk-providers"] ? path.resolve(values["perk-providers"]) : undefined };
      const plan = planPromotion(options);
      console.log(JSON.stringify({ ...plan.report, blockers: plan.blockers }, null, 2));
      if (plan.blockers.length) throw new Error(plan.blockers.join("\n"));
      if (values.write) console.log(JSON.stringify(applyPromotion(options, plan), null, 2));
      break;
    }
    case "withdraw":
      withdrawCurrent(root, path.resolve(required("archive")), required("season"), required("version"));
      break;
    case "status":
      console.log(JSON.stringify({ current: readRelease(root), archives: listVersions(root).map(({ directory, manifest }) => ({
        directory, ...manifest.identity, createdAt: manifest.createdAt, summary: manifest.summary,
      })) }, null, 2));
      break;
    case "archive":
      console.log(`Archived perks and all overlimit modules: ${await archiveCurrent()}`);
      break;
    case "archive-preview":
      console.log(`Archived transition snapshot (current base plus preview): ${await archiveCurrent(true)}`);
      break;
    case "verify":
      console.log(`Verified ${verifyVersion(required("archive")).files.length} archived files.`);
      break;
    case "diff":
      console.log(JSON.stringify(diffVersions(required("left"), required("right")), null, 2));
      break;
    case "export":
      console.log(`Exported for comparison/recovery: ${exportVersion(required("archive"), required("output"))}`);
      break;
    case "prepare": {
      const current = readRelease(root);
      verifyVersion(path.join(root, "archives/content-versions", current.season, current.version));
      console.log(`Candidate worktree: ${prepareRelease(root, required("season"), required("version"))}`);
      console.log("Install dependencies there and audit the next version. Current checkout remains available for maintenance.");
      break;
    }
    case "finalize": {
      const release = readRelease(root);
      if (release.phase !== "candidate") throw new Error("Only a candidate can be finalized");
      const [{ getAllPublishedPerks }, { getOverlimitCatalog }] = await Promise.all([
        import("../../lib/perks"), import("../../lib/overlimit"),
      ]);
      assertReleaseReady(release, getOverlimitCatalog(), getAllPublishedPerks());
      // Explicit fixed command only; no shell interpolation of user-provided identifiers.
      execFileSync(process.platform === "win32" ? "cmd.exe" : "pnpm", process.platform === "win32"
        ? ["/d", "/s", "/c", "pnpm build"] : ["build"], { cwd: root, stdio: "inherit", windowsHide: true });
      const before = fs.readFileSync(path.join(root, RELEASE_FILE));
      writeRelease(root, { ...release, phase: "current" });
      try {
        console.log(`Finalized and archived: ${await archiveCurrent()}`);
      } catch (error) {
        fs.writeFileSync(path.join(root, RELEASE_FILE), before);
        throw error;
      }
      console.log("Review and commit this worktree, then merge through the normal project release process. Nothing deployed.");
      break;
    }
    default:
      throw new Error("Usage: pnpm content-version <status|archive|archive-preview|verify|diff|export|prepare|withdraw|promote|finalize> [--season ID --version ID --content-root PATH --archive PATH --baseline PATH --candidate PATH --review PATH --perk-providers PATH --write --left PATH --right PATH --output PATH]");
  }
}
main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  if (positionals[0] === "promote") console.error(JSON.stringify({ status: "blocked", blockers: [message] }, null, 2));
  else console.error(message);
  process.exitCode = 1;
});
