/** MDX prototype_id -> WeaponSkinConnect base row -> sibling skins -> CommonItem/TagInfo/NormalIcon.
 * Writes data/weapon-skins.json and owns public/icons/weapon-skins + its WebP mirror.
 * A skin is published only when its CommonItem has a real name, an Access text and an exported icon;
 * every skipped row is listed in the local report. The original skin leads the list and is emitted
 * only for weapons with at least one published skin. Default is check mode; --write regenerates.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import sharp from "sharp";

const root = process.cwd();
const args = process.argv.slice(2);
const argument = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing ${name}`);
  return args[index + 1];
};
const content = path.resolve(root, argument("--content-root", "refs/Exports/NZM/Content"));
const reportPath = path.resolve(root, argument("--report", "MD/_local/weapon-skins/report.json"));
const write = args.includes("--write");
const outputPath = path.join(root, "data/weapon-skins.json");
const pngRoot = path.join(root, "public/icons/weapon-skins");
const webpRoot = path.join(root, "public/webp/icons/weapon-skins");
const hash = (bytes: Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");

type Text = { LocalizedString?: string; SourceString?: string };
type ConnectRow = {
  WeaponSkinItemID: number; WeaponSkinPrototypeID: number; ItemID: number;
  WeaponName: Text; WeaponVisualSkinType: number;
};
type ItemRow = {
  ItemID: number; Name?: Text; Description?: Text; NarrativeDesc?: Text; Access?: Text;
  Quality?: number; CommonTagIDs?: string; IconPath?: { NormalIcon?: { AssetPathName?: string } };
};
type TagRow = { TagDesc?: string; TagDetails?: Text };

const RARITY: Record<number, string> = { 2: "稀有", 3: "史诗", 4: "传说" };
const text = (value?: Text) => (value?.LocalizedString ?? value?.SourceString ?? "").trim();
const rows = <T>(relative: string) =>
  JSON.parse(fs.readFileSync(path.join(content, relative), "utf8"))[0].Rows as Record<string, T>;

async function main() {
  const connect = Object.values(rows<ConnectRow>("DataTables/LuaDataTable/WeaponSkinConnect.json"));
  const items = rows<ItemRow>("DataTables/System/Items/CommonItemDataTable.json");
  const tags = rows<TagRow>("DataTables/TagInfo.json");

  const baseByPrototype = new Map<string, ConnectRow>();
  for (const row of connect.filter((row) => row.WeaponVisualSkinType === 0)) {
    const key = String(row.WeaponSkinPrototypeID);
    if (baseByPrototype.has(key)) throw new Error(`Duplicate base skin prototype: ${key}`);
    baseByPrototype.set(key, row);
  }

  const weapons: Record<string, unknown[]> = {};
  const icons = new Map<string, Buffer>();
  const skipped: { weapon: string; itemId: string; name: string; reasons: string[] }[] = [];
  const files = fs.readdirSync(path.join(root, "data/weapons")).filter((file) => file.endsWith(".mdx")).sort();
  for (const file of files) {
    const slug = file.replace(/\.mdx$/, "");
    const data = matter(fs.readFileSync(path.join(root, "data/weapons", file), "utf8")).data;
    const base = data.prototype_id ? baseByPrototype.get(String(data.prototype_id)) : undefined;
    if (!base) continue;
    const siblings = connect.filter((row) => row.ItemID === base.ItemID && row.WeaponVisualSkinType !== 0);
    const skins = [];
    const sources = new Map<string, string>();
    for (const row of [base, ...siblings]) {
      const original = row === base;
      const itemId = String(row.WeaponSkinItemID);
      const item = items[itemId];
      const name = text(item?.Name).replace(/\s*-\s*/g, "-");
      const access = text(item?.Access).split("|").map((value) => value.trim()).filter(Boolean);
      const asset = item?.IconPath?.NormalIcon?.AssetPathName ?? "";
      const source = asset.startsWith("/Game/UI/") && !asset.includes("..")
        ? path.join(content, asset.split(".")[0].slice("/Game/".length) + ".png") : "";
      const reasons = [
        !item && "missing CommonItem",
        (!name || /占位符|绑定/.test(name)) && "placeholder name",
        !original && access.length === 0 && "missing Access",
        !(source && fs.existsSync(source)) && "missing icon",
        item && !RARITY[item.Quality ?? 0] && `unknown Quality ${item.Quality}`,
      ].filter((reason): reason is string => Boolean(reason));
      if (reasons.length > 0) {
        if (original) throw new Error(`Unusable original skin ${itemId} for ${slug}: ${reasons.join(", ")}`);
        skipped.push({ weapon: slug, itemId, name: name || text(row.WeaponName), reasons });
        continue;
      }
      skins.push({
        itemId,
        name,
        original,
        rarity: RARITY[item.Quality!],
        special: row.WeaponVisualSkinType >= 2,
        tags: (item.CommonTagIDs ?? "").split("|").filter(Boolean).map((id) => {
          const tag = tags[id];
          if (!tag?.TagDesc) throw new Error(`Unknown TagInfo ${id} on ${itemId}`);
          return { name: tag.TagDesc, detail: text(tag.TagDetails) };
        }),
        access,
        description: text(item.Description),
        story: text(item.NarrativeDesc),
      });
      sources.set(itemId, source);
    }
    if (skins.length < 2) continue;
    const quality = (itemId: string) => items[itemId].Quality!;
    skins.sort((left, right) => Number(right.original) - Number(left.original)
      || Number(right.special) - Number(left.special)
      || quality(right.itemId) - quality(left.itemId) || left.itemId.localeCompare(right.itemId));
    for (const skin of skins) icons.set(skin.itemId, fs.readFileSync(sources.get(skin.itemId)!));
    weapons[slug] = skins;
  }

  const output = JSON.stringify({ weapons }, null, 2) + "\n";
  const stalePng = fs.existsSync(pngRoot)
    ? fs.readdirSync(pngRoot).filter((file) => !icons.has(file.replace(/\.png$/, ""))) : [];
  const staleWebp = fs.existsSync(webpRoot)
    ? fs.readdirSync(webpRoot).filter((file) => !icons.has(file.replace(/\.webp$/, ""))) : [];
  const changedPng = [...icons].filter(([id, image]) => {
    const target = path.join(pngRoot, `${id}.png`);
    return !fs.existsSync(target) || hash(fs.readFileSync(target)) !== hash(image);
  });
  const missingWebp = [...icons.keys()].filter((id) => !fs.existsSync(path.join(webpRoot, `${id}.webp`)));
  const jsonChanged = !fs.existsSync(outputPath) || fs.readFileSync(outputPath, "utf8") !== output;

  if (write) {
    fs.mkdirSync(pngRoot, { recursive: true });
    fs.mkdirSync(webpRoot, { recursive: true });
    for (const file of stalePng) fs.unlinkSync(path.join(pngRoot, file));
    for (const file of staleWebp) fs.unlinkSync(path.join(webpRoot, file));
    for (const [id, image] of changedPng) fs.writeFileSync(path.join(pngRoot, `${id}.png`), image);
    for (const id of new Set([...changedPng.map(([id]) => id), ...missingWebp])) {
      fs.writeFileSync(path.join(webpRoot, `${id}.webp`),
        await sharp(icons.get(id)!).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer());
    }
    if (jsonChanged) fs.writeFileSync(outputPath, output);
  }

  const summary = {
    weapons: Object.keys(weapons).length, skins: icons.size, skipped: skipped.length,
    jsonChanged, pngChanged: changedPng.length, webpMissing: missingWebp.length,
    stale: stalePng.length + staleWebp.length,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ write, summary, skipped }, null, 2) + "\n");
  console.log(JSON.stringify(summary));
  const dirty = summary.jsonChanged || summary.pngChanged || summary.webpMissing || summary.stale;
  if (!write && dirty) {
    console.error("weapon-skins output is stale; run pnpm weapon-skins:write");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
