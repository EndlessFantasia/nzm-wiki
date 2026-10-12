import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { verifyVersion } from "../content-versions/store";

const read = (archive: string, file: string) => JSON.parse(fs.readFileSync(`${archive}/files/${file}`, "utf8"));

test("frozen S4 release retains its exact historical catalog and audited changes", () => {
  const archive = "archives/content-versions/s4/s4-final-20260922";
  verifyVersion(archive);
  const release = read(archive, "config/content-version.json");
  const { perks } = read(archive, "frozen/perks.json") as { perks: { itemId: string; slug: string; season?: string; description?: string }[] };
  const overlimit = read(archive, "data/overlimit/current.json");
  assert.equal(release.season, "s4");
  assert.equal("preview" in release, false);
  assert.equal(perks.length, 551);
  assert.equal(overlimit.season.id, "s4");
  assert.equal(overlimit.cards.length, 177);
  for (const perk of perks) {
    assert.ok(!perk.slug.startsWith("preview/"));
    assert.ok(!perk.season?.endsWith("-preview"));
  }
  assert.match(perks.find(perk => perk.itemId === "20703040104")?.description ?? "", /45/);
  for (const id of ["20703040160", "20703040164"]) assert.ok(perks.some(perk => perk.itemId === id));
});

test("frozen S3 Numerical-derived descriptions retain their historical audited values", () => {
  const archive = "archives/content-versions/s3/s3.2";
  verifyVersion(archive);
  const { perks } = read(archive, "frozen/perks.json") as { perks: { name: string; description?: string }[] };
  const samples = [
    { name: "递进膛压", values: ["2.5%"] }, { name: "川流不息", values: ["0.8%", "80%"] },
    { name: "精密追击", values: ["7%", "42%"], forbidden: ["10%"] }, { name: "致命节拍", values: ["0.4%", "32%"] },
    { name: "近距增幅", values: ["5%", "35%"] }, { name: "裁决充能", values: ["2%", "8%", "100%", "400%"] },
    { name: "紫奖掉物", values: ["16%", "18%"] },
  ];
  for (const sample of samples) {
    const description = perks.find(perk => perk.name === sample.name)?.description;
    assert.ok(description, sample.name);
    for (const value of sample.values) assert.ok(description.includes(value), `${sample.name}/${value}`);
    for (const value of sample.forbidden ?? []) assert.ok(!description.includes(value), `${sample.name}/${value}`);
  }
});
