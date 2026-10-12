import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createValidFileMatcher } from "next/dist/server/lib/find-page-file";
import { getPageExtensions } from "./static-build-config";

test("route discovery keeps dev pages out of export and honors content publication gates", (t) => {
  const files: Record<string, string> = {
    "data/overlimit/current.json": '{"withdrawn":true}',
    "data/overlimit/preview.json": "null",
    "data/perk-preview/preview.json": "null",
    "config/content-version.json": '{"preview":null}',
    "data/builds/draft.mdx": "---\ndraft: true\n---\nDraft",
    ...Object.fromEntries(["black-hole", "dual-star", "matrix-symbiosis", "passives"].map(name => [`data/season-talents/s4/${name}.json`, '{"draft":true}'])),
  };
  t.mock.method(fs, "existsSync", () => true);
  t.mock.method(fs, "readdirSync", () => ["draft.mdx"]);
  t.mock.method(fs, "readFileSync", (file: string) => {
    const key = file.replace(/\\/g, "/").replace(/^.*?\/fixture\//, "");
    assert.ok(key in files, `unexpected input ${key}`);
    return files[key];
  });
  const devOnly = ["editor/page.dev.tsx", "api/editor/builds/route.dev.ts"];
  const gated = [
    "overlimit/[id]/page.overlimit.tsx", "overlimit/preview/page.overlimit-preview.tsx",
    "perks/preview/page.perk-preview.tsx", "builds/[slug]/page.build-guide.tsx",
    "guides/season-talents/s4/[talentId]/page.s4-talent.tsx",
  ];
  const matches = (dev: boolean) => createValidFileMatcher(getPageExtensions(dev, "D:/fixture"), undefined);
  for (const file of [...devOnly, ...gated]) {
    assert.equal(matches(true).isAppRouterPage(file), true, file);
    assert.equal(matches(false).isAppRouterPage(file), false, file);
  }
  assert.equal(matches(false).isAppRouterPage("weapons/page.tsx"), true);

  files["data/overlimit/current.json"] = '{"withdrawn":false}';
  files["data/overlimit/preview.json"] = '{}';
  files["data/perk-preview/preview.json"] = '{}';
  files["data/builds/draft.mdx"] = "---\ndraft: false\n---\nPublished";
  for (const key of Object.keys(files).filter(key => key.startsWith("data/season-talents/s4/"))) files[key] = '{"draft":false}';
  // A snapshot alone must not publish the perk preview route.
  assert.equal(matches(false).isAppRouterPage(gated[2]), false);
  files["config/content-version.json"] = '{"preview":{"version":"preview"}}';
  for (const file of gated) assert.equal(matches(false).isAppRouterPage(file), true, file);
  for (const file of devOnly) assert.equal(matches(false).isAppRouterPage(file), false, file);

  delete files["data/season-talents/s4/passives.json"];
  t.mock.method(fs, "existsSync", (file: string) => !file.endsWith("passives.json"));
  assert.equal(matches(false).isAppRouterPage(gated[4]), false);
});
